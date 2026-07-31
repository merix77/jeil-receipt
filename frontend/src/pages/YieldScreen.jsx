import { useEffect, useRef, useState } from 'react';
import { todayStr } from '../dates.js';
import { YIELD_PARTS, FIXED_PART_REVENUE } from '../yieldParts.js';
import { geunPriceLabel } from '../units.js';
import { createYield, confirmYield } from '../api/receipts.js';

const won = (n) => `${Math.round(n).toLocaleString()}원`;

const STEP_LABELS = { 1: '마리 등록', 2: '부위 입력', 3: '결과 확인' };

// 장부 스타일 입력 행 (라벨 좌 / 입력 우 / 하단 가로줄)
function Field({ label, unit, children }) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '14px 0',
        borderBottom: '1px solid var(--hairline)',
      }}
    >
      <span style={{ width: 92, color: 'var(--ink-muted)', fontSize: 14 }}>{label}</span>
      <span style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
        {children}
        {unit && <span style={{ color: 'var(--ink-muted)', fontSize: 13 }}>{unit}</span>}
      </span>
    </label>
  );
}

const inputStyle = {
  flex: 1,
  minWidth: 0,
  padding: '8px 10px',
  fontSize: 16,
  border: '1px solid var(--hairline)',
  borderRadius: 8,
  background: 'transparent',
  color: 'var(--ink)',
};

// step은 App이 소유(뒤로가기 스택에 편입). 앞으로 가기 onNext(step), 뒤로 onBack, 홈 복귀 onGoHome.
export default function YieldScreen({ step, onNext, onBack, onGoHome }) {
  // 1단계 · 마리 등록 (확정 전까지 로컬 보관)
  const [measuredDate, setMeasuredDate] = useState(todayStr());
  const [pricePerKg, setPricePerKg] = useState('');
  const [totalWeight, setTotalWeight] = useState('');
  const [totalPurchase, setTotalPurchase] = useState('');
  const [error, setError] = useState(null);

  // 2단계 · 부위 입력 (일반부위 중량/단가, 등뼈·미니족 완료 여부, 펼친 부위)
  const [partValues, setPartValues] = useState({}); // { [부위명]: { weight, price } }
  const [fixedDone, setFixedDone] = useState({}); // { [부위명]: true } (등뼈·미니족)
  const [openPart, setOpenPart] = useState(null);

  // 3단계 · 결과 확인 / 시트 반영
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [done, setDone] = useState(false);
  const savedIdRef = useRef(null); // 반영 중 실패 후 재시도 시 중복 생성 방지

  // 뒤로가기로 2단계 이하로 돌아가면 저장 상태 무효화(값을 고치면 새 측정으로 다시 저장)
  useEffect(() => {
    if (step < 3) {
      savedIdRef.current = null;
      setSubmitError(null);
      setDone(false);
    }
  }, [step]);

  // 입력 중 앱 이탈(새로고침·닫기 등) 시 경고 — 홈까지 되감긴 경우가 아니라 값이 남아있을 때만
  useEffect(() => {
    const handler = (e) => {
      const hasInput = pricePerKg || totalWeight || totalPurchase || Object.keys(partValues).length > 0;
      if (hasInput && !done) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [pricePerKg, totalWeight, totalPurchase, partValues, done]);

  function handleNext() {
    if (!(Number(totalWeight) > 0)) {
      setError('총중량을 숫자로 입력해주세요.');
      return;
    }
    if (totalPurchase === '' || !(Number(totalPurchase) >= 0)) {
      setError('총매입가를 숫자로 입력해주세요.');
      return;
    }
    setError(null);
    onNext(2);
  }

  const marginDone = (name) => {
    const v = partValues[name];
    return !!v && Number(v.weight) > 0 && Number(v.price) > 0;
  };
  const isDone = (p) => (p.marginIncluded ? marginDone(p.name) : !!fixedDone[p.name]);
  const revenueOf = (p) => {
    if (!p.marginIncluded) return fixedDone[p.name] ? FIXED_PART_REVENUE : 0;
    return marginDone(p.name) ? Number(partValues[p.name].weight) * Number(partValues[p.name].price) : 0;
  };
  // 총매출액 = 마진 포함 부위(1~10)만 합산. 등뼈·미니족 제외.
  const totalRevenue = YIELD_PARTS.filter((p) => p.marginIncluded).reduce((s, p) => s + revenueOf(p), 0);
  const purchaseNum = Number(totalPurchase) || 0;
  const marginAmount = totalRevenue - purchaseNum;
  // 판매가 대비 마진율 = 마진금액 ÷ 총매출액 × 100 (총매출액 0이면 0)
  const marginRate = totalRevenue > 0 ? Math.round((marginAmount / totalRevenue) * 1000) / 10 : 0;

  // 시트에 기록될 부위(입력된 마진부위 + 등뼈·미니족 고정 5,000)
  const summaryRows = YIELD_PARTS.filter((p) => !p.marginIncluded || revenueOf(p) > 0).map((p) =>
    p.marginIncluded
      ? { name: p.name, weight: partValues[p.name].weight, revenue: revenueOf(p) }
      : { name: p.name, weight: null, revenue: FIXED_PART_REVENUE }
  );

  async function handleConfirm() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      // 실패 후 재시도 시엔 이미 만든 측정을 그대로 confirm (중복 저장 방지)
      if (savedIdRef.current == null) {
        const parts = YIELD_PARTS.filter((p) => p.marginIncluded)
          .map((p) => ({ name: p.name, v: partValues[p.name] }))
          .filter(({ v }) => v && (v.weight !== '' || v.price !== ''))
          .map(({ name, v }) => ({
            part_name: name,
            weight_kg: v.weight === '' ? null : v.weight,
            unit_price: v.price === '' ? null : v.price,
          }));
        const { measurement } = await createYield({
          measured_date: measuredDate,
          price_per_kg: pricePerKg === '' ? null : pricePerKg,
          total_weight_kg: totalWeight,
          total_purchase_price: totalPurchase,
          parts,
        });
        savedIdRef.current = measurement.id;
      }
      await confirmYield(savedIdRef.current);
      setDone(true);
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function tapPart(p) {
    if (p.marginIncluded) {
      setOpenPart(openPart === p.name ? null : p.name);
    } else {
      // 등뼈·미니족: 입력창 없이 즉시 완료 토글
      setFixedDone((prev) => ({ ...prev, [p.name]: !prev[p.name] }));
    }
  }
  const updatePart = (name, field, val) =>
    setPartValues((prev) => ({ ...prev, [name]: { ...prev[name], [field]: val } }));

  return (
    <div style={{ padding: '0 16px 40px' }}>
      <button
        onClick={onGoHome}
        style={{ marginTop: 12, padding: 0, fontSize: 14, color: 'var(--ink-muted)', background: 'transparent', border: 'none' }}
      >
        ‹ 홈으로
      </button>

      <h2 style={{ margin: '8px 0 0' }}>
        수율표{' '}
        <span style={{ fontSize: 14, color: 'var(--ink-muted)' }}>· {STEP_LABELS[step]} (단계 {step})</span>
      </h2>

      {step === 1 && (
        <>
          <div
            style={{
              margin: '14px 0 8px',
              padding: 10,
              background: 'var(--accent-bg)',
              borderRadius: 8,
              fontSize: 13,
              color: 'var(--ink)',
            }}
          >
            ※ 이분도체(반쪽) 기준으로 입력하세요
          </div>

          <Field label="날짜">
            <input type="date" value={measuredDate} onChange={(e) => setMeasuredDate(e.target.value)} style={inputStyle} />
          </Field>
          <Field label="돈가" unit="원/kg">
            <input
              type="number"
              inputMode="decimal"
              placeholder="경매 돈가 (참고용)"
              value={pricePerKg}
              onChange={(e) => setPricePerKg(e.target.value)}
              style={inputStyle}
            />
          </Field>
          <Field label="총중량" unit="kg">
            <input type="number" inputMode="decimal" value={totalWeight} onChange={(e) => setTotalWeight(e.target.value)} style={inputStyle} />
          </Field>
          <Field label="총매입가" unit="원">
            <input type="number" inputMode="numeric" value={totalPurchase} onChange={(e) => setTotalPurchase(e.target.value)} style={inputStyle} />
          </Field>

          {error && <p style={{ marginTop: 10, color: 'var(--warn)', fontSize: 14 }}>{error}</p>}

          <button onClick={handleNext} className="btn-accent" style={{ width: '100%', marginTop: 20, padding: 14, fontSize: 16 }}>
            다음
          </button>
        </>
      )}

      {step === 2 && (
        <>
          <p style={{ margin: '14px 0 10px', fontSize: 13, color: 'var(--ink-muted)' }}>
            부위를 눌러 중량·단가를 입력하세요. 입력 안 한 부위는 비워둬도 됩니다.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {YIELD_PARTS.map((p) => {
              const done = isDone(p);
              const open = p.marginIncluded && openPart === p.name;
              return (
                <button
                  key={p.order}
                  onClick={() => tapPart(p)}
                  style={{
                    padding: '14px 4px',
                    borderRadius: 10,
                    fontSize: 13,
                    fontWeight: 700,
                    lineHeight: 1.3,
                    border: `1.5px solid ${done ? 'var(--primary)' : 'var(--hairline)'}`,
                    background: done ? 'var(--primary)' : open ? 'var(--accent-bg)' : 'transparent',
                    color: done ? 'var(--accent)' : 'var(--ink)',
                  }}
                >
                  {done ? '✓ ' : ''}
                  {p.name}
                </button>
              );
            })}
          </div>

          {openPart && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 2 }}>{openPart}</div>
              <Field label="중량" unit="kg">
                <input
                  type="number"
                  inputMode="decimal"
                  value={partValues[openPart]?.weight ?? ''}
                  onChange={(e) => updatePart(openPart, 'weight', e.target.value)}
                  style={inputStyle}
                />
              </Field>
              <Field label="판매단가" unit="원/kg">
                <input
                  type="number"
                  inputMode="numeric"
                  value={partValues[openPart]?.price ?? ''}
                  onChange={(e) => updatePart(openPart, 'price', e.target.value)}
                  style={inputStyle}
                />
              </Field>
              {geunPriceLabel(partValues[openPart]?.price) && (
                <div style={{ marginTop: 6, textAlign: 'right', fontSize: 13, color: 'var(--ink-muted)' }}>
                  {geunPriceLabel(partValues[openPart]?.price)}
                </div>
              )}
            </div>
          )}

          <div
            style={{
              marginTop: 20,
              paddingTop: 12,
              borderTop: '1px solid var(--hairline)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              fontSize: 15,
            }}
          >
            <span>현재 매출액 합계</span>
            <strong style={{ color: 'var(--primary)', fontSize: 18 }}>{Math.round(totalRevenue).toLocaleString()}원</strong>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button
              onClick={onBack}
              style={{
                flex: 1,
                padding: 14,
                fontSize: 16,
                fontWeight: 700,
                color: 'var(--primary)',
                background: 'transparent',
                border: '2px solid var(--primary)',
                borderRadius: 8,
              }}
            >
              이전
            </button>
            <button onClick={() => onNext(3)} className="btn-accent" style={{ flex: 2, padding: 14, fontSize: 16 }}>
              다음
            </button>
          </div>
        </>
      )}

      {step === 3 && !done && (
        <>
          <div
            style={{
              marginTop: 18,
              padding: '18px 16px',
              background: 'var(--primary)',
              borderRadius: 12,
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>총매출액</div>
            <div style={{ fontSize: 30, fontWeight: 700, fontFamily: 'var(--font-title)', color: 'var(--accent)' }}>
              {won(totalRevenue)}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
            <div style={{ flex: 1, padding: '14px 8px', border: '1.5px solid var(--hairline)', borderRadius: 10, textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: 'var(--ink-muted)' }}>마진금액</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: marginAmount < 0 ? 'var(--warn)' : 'var(--primary)' }}>
                {won(marginAmount)}
              </div>
            </div>
            <div style={{ flex: 1, padding: '14px 8px', border: '1.5px solid var(--hairline)', borderRadius: 10, textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: 'var(--ink-muted)' }}>마진율</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: marginAmount < 0 ? 'var(--warn)' : 'var(--primary)' }}>
                {marginRate}%
              </div>
            </div>
          </div>

          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 13, color: 'var(--ink-muted)', marginBottom: 4 }}>입력한 부위</div>
            {summaryRows.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--ink-muted)' }}>입력한 부위가 없습니다.</p>
            ) : (
              summaryRows.map((r) => (
                <div
                  key={r.name}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '9px 0',
                    borderBottom: '1px solid var(--hairline)',
                    fontSize: 14,
                  }}
                >
                  <span style={{ fontWeight: 700 }}>{r.name}</span>
                  <span style={{ color: 'var(--ink-muted)' }}>
                    {r.weight != null ? `${r.weight}kg · ` : ''}
                    {won(r.revenue)}
                  </span>
                </div>
              ))
            )}
          </div>

          {submitError && (
            <div
              style={{
                marginTop: 14,
                padding: 12,
                border: '1px solid var(--warn)',
                background: 'var(--accent-bg)',
                color: 'var(--warn)',
                borderRadius: 8,
                fontSize: 14,
              }}
            >
              반영 실패: {submitError}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button
              onClick={onBack}
              disabled={submitting}
              style={{
                flex: 1,
                padding: 14,
                fontSize: 16,
                fontWeight: 700,
                color: 'var(--primary)',
                background: 'transparent',
                border: '2px solid var(--primary)',
                borderRadius: 8,
                opacity: submitting ? 0.5 : 1,
              }}
            >
              이전
            </button>
            <button
              onClick={handleConfirm}
              disabled={submitting}
              className="btn-accent"
              style={{ flex: 2, padding: 14, fontSize: 16, opacity: submitting ? 0.6 : 1 }}
            >
              {submitting ? '반영 중...' : '구글시트에 반영'}
            </button>
          </div>
        </>
      )}

      {done && (
        <div style={{ marginTop: 40, textAlign: 'center' }}>
          <div
            style={{
              display: 'inline-grid',
              placeItems: 'center',
              width: 64,
              height: 64,
              borderRadius: '50%',
              border: '3px solid var(--primary)',
              color: 'var(--primary)',
              fontFamily: 'var(--font-title)',
              fontWeight: 700,
              fontSize: 30,
            }}
          >
            印
          </div>
          <p style={{ marginTop: 14, fontSize: 16, fontWeight: 700 }}>구글시트에 반영되었습니다</p>
          <button
            onClick={onGoHome}
            className="btn-accent"
            style={{ width: '100%', marginTop: 24, padding: 14, fontSize: 16 }}
          >
            홈으로
          </button>
        </div>
      )}
    </div>
  );
}

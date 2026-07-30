import { useState } from 'react';
import { todayStr } from '../dates.js';

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

export default function YieldScreen({ onBack }) {
  const [step, setStep] = useState(1);
  // 마리 등록(공통 정보) — 확정 전까지 로컬 보관
  const [measuredDate, setMeasuredDate] = useState(todayStr());
  const [pricePerKg, setPricePerKg] = useState('');
  const [totalWeight, setTotalWeight] = useState('');
  const [totalPurchase, setTotalPurchase] = useState('');
  const [error, setError] = useState(null);

  function handleNext() {
    if (!(Number(totalWeight) > 0)) {
      setError('총중량을 숫자로 입력해주세요.');
      return;
    }
    if (!(Number(totalPurchase) >= 0) || totalPurchase === '') {
      setError('총매입가를 숫자로 입력해주세요.');
      return;
    }
    setError(null);
    setStep(2);
  }

  return (
    <div style={{ padding: '0 16px 40px' }}>
      <button
        onClick={onBack}
        style={{ marginTop: 12, padding: 0, fontSize: 14, color: 'var(--ink-muted)', background: 'transparent', border: 'none' }}
      >
        ‹ 홈으로
      </button>

      <h2 style={{ margin: '8px 0 0' }}>
        수율표{' '}
        <span style={{ fontSize: 14, color: 'var(--ink-muted)' }}>· 마리 등록 (1/3)</span>
      </h2>

      {step > 1 && (
        <p style={{ marginTop: 24, color: 'var(--ink-muted)' }}>부위 입력 단계 — 준비 중</p>
      )}

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
            <input
              type="number"
              inputMode="decimal"
              value={totalWeight}
              onChange={(e) => setTotalWeight(e.target.value)}
              style={inputStyle}
            />
          </Field>
          <Field label="총매입가" unit="원">
            <input
              type="number"
              inputMode="numeric"
              value={totalPurchase}
              onChange={(e) => setTotalPurchase(e.target.value)}
              style={inputStyle}
            />
          </Field>

          {error && <p style={{ marginTop: 10, color: 'var(--warn)', fontSize: 14 }}>{error}</p>}

          <button
            onClick={handleNext}
            className="btn-accent"
            style={{ width: '100%', marginTop: 20, padding: 14, fontSize: 16 }}
          >
            다음
          </button>
        </>
      )}
    </div>
  );
}


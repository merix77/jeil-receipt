import { useState } from 'react';

// 계산 전용 화면 — 저장/시트/DB 없음. 입력이 바뀔 때마다 실시간 계산.

function Field({ label, unit, value, onChange }) {
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
      <span style={{ width: 120, color: 'var(--ink-muted)', fontSize: 14 }}>{label}</span>
      <span style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
        <input
          type="number"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            flex: 1,
            minWidth: 0,
            padding: '8px 10px',
            fontSize: 16,
            border: '1px solid var(--hairline)',
            borderRadius: 8,
            background: 'transparent',
            color: 'var(--ink)',
          }}
        />
        <span style={{ color: 'var(--ink-muted)', fontSize: 13, width: 44 }}>{unit}</span>
      </span>
    </label>
  );
}

function Row({ label, children, strong }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        padding: '11px 0',
        borderBottom: '1px solid var(--hairline)',
        fontSize: strong ? 16 : 14,
      }}
    >
      <span style={{ color: 'var(--ink-muted)' }}>{label}</span>
      <span style={{ fontWeight: 700 }}>{children}</span>
    </div>
  );
}

const num = (v) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};
const won = (n) => `${Math.round(n).toLocaleString()}원`;
const perKg = (n) => `${Math.round(n).toLocaleString()}원/kg`;
const kg = (n) => `${Math.round(n * 100) / 100}kg`;
const pct = (n) => `${Math.round(n * 10) / 10}%`;

export default function CostCalcScreen({ onBack }) {
  const [buyWeight, setBuyWeight] = useState('');
  const [buyPrice, setBuyPrice] = useState('');
  const [lossWeight, setLossWeight] = useState('');
  const [targetRate, setTargetRate] = useState('');
  const [myPrice, setMyPrice] = useState('');

  const buyW = num(buyWeight);
  const buyP = num(buyPrice);
  const lossW = num(lossWeight);
  const tRate = num(targetRate);
  const myP = num(myPrice);

  const realW = buyW - lossW; // 실중량
  const yieldPct = buyW > 0 ? (realW / buyW) * 100 : 0; // 수율
  const costPerKg = realW > 0 ? buyP / realW : 0; // kg당 실원가
  const targetPrice = realW > 0 && tRate < 100 ? costPerKg / (1 - tRate / 100) : 0; // 목표 판매가
  const totalRevenue = realW > 0 ? myP * realW : 0; // 내 판매가 기준 총매출액
  const marginAmount = totalRevenue - buyP;
  const marginRate = totalRevenue > 0 ? (marginAmount / totalRevenue) * 100 : 0;

  // 한방향 자동 산출: 목표 마진율을 입력/수정할 때만 판매가를 목표 판매가로 채운다.
  // (매입중량·총매입가·로스중량 변경으로는 재채움하지 않음 — 사용자가 고친 값 유지)
  function handleTargetRate(v) {
    setTargetRate(v);
    const r = num(v);
    if (realW > 0 && r < 100) {
      setMyPrice(String(Math.round(costPerKg / (1 - r / 100))));
    }
    // 계산 불가(실중량 0, 목표마진율 100 이상 등)면 판매가를 덮어쓰지 않음
  }

  const negColor = (n) => (n < 0 ? 'var(--warn)' : 'var(--primary)');

  return (
    <div style={{ padding: '0 16px 40px' }}>
      <button
        onClick={onBack}
        style={{ marginTop: 12, padding: 0, fontSize: 14, color: 'var(--ink-muted)', background: 'transparent', border: 'none' }}
      >
        ‹ 홈으로
      </button>

      <h2 style={{ margin: '8px 0 0' }}>부분육 원가 계산기</h2>
      <p style={{ margin: '6px 0 8px', fontSize: 13, color: 'var(--ink-muted)' }}>
        입력하면 실시간으로 계산됩니다. (저장·기록 없음)
      </p>

      <Field label="매입 총중량" unit="kg" value={buyWeight} onChange={setBuyWeight} />
      <Field label="총매입가" unit="원" value={buyPrice} onChange={setBuyPrice} />
      <Field label="로스 중량" unit="kg" value={lossWeight} onChange={setLossWeight} />
      <Field label="목표 마진율" unit="%" value={targetRate} onChange={handleTargetRate} />
      <Field label="마진율 대비 판매가" unit="원/kg" value={myPrice} onChange={setMyPrice} />

      <div style={{ marginTop: 22 }}>
        <div style={{ fontSize: 13, color: 'var(--ink-muted)', marginBottom: 2 }}>계산 결과</div>
        <Row label="실중량 (매입 - 로스)">{kg(realW)}</Row>
        <Row label="수율">{buyW > 0 ? pct(yieldPct) : '—'}</Row>
        <Row label="kg당 실원가">{realW > 0 ? perKg(costPerKg) : '—'}</Row>
        <Row label="목표 판매가" strong>
          <span style={{ color: 'var(--primary)', fontSize: 17 }}>
            {realW > 0 && tRate < 100 ? perKg(targetPrice) : '—'}
          </span>
        </Row>
      </div>

      <div style={{ marginTop: 20 }}>
        <div style={{ fontSize: 13, color: 'var(--ink-muted)', marginBottom: 2 }}>판매가 기준 결과</div>
        <Row label="총매출액">{realW > 0 && myP > 0 ? won(totalRevenue) : '—'}</Row>
        <Row label="마진금액">
          <span style={{ color: negColor(marginAmount) }}>{realW > 0 && myP > 0 ? won(marginAmount) : '—'}</span>
        </Row>
        <Row label="마진율 (판매가 대비)" strong>
          <span style={{ color: negColor(marginAmount), fontSize: 17 }}>
            {totalRevenue > 0 ? pct(marginRate) : '—'}
          </span>
        </Row>
      </div>
    </div>
  );
}

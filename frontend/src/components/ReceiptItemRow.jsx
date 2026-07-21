const FIELDS = [
  { key: 'trade_date', label: '거래년월일' },
  { key: 'meat_type', label: '축종' },
  { key: 'weight_kg', label: '물량(kg)' },
  { key: 'origin', label: '원산지' },
  { key: 'cut_name', label: '부위명칭' },
  { key: 'grade', label: '등급' },
  { key: 'slaughterhouse', label: '도축장명' },
  { key: 'trace_number', label: '이력번호' },
  { key: 'supplier', label: '매입처' },
];

function isUncertain(value) {
  return typeof value === 'string' && value.trim().endsWith('?');
}

export default function ReceiptItemRow({ item, onChange }) {
  return (
    <div style={{ borderBottom: '1px solid var(--hairline)', padding: '8px 0' }}>
      {FIELDS.map(({ key, label }) => {
        const uncertain = isUncertain(item[key]);
        return (
          <div key={key} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <label style={{ width: 80, color: 'var(--ink-muted)' }}>{label}</label>
            <input
              value={item[key] ?? ''}
              onChange={(e) => onChange({ ...item, [key]: e.target.value })}
              style={{
                flex: 1,
                border: uncertain ? '2px solid var(--accent)' : '1px solid var(--hairline)',
                background: uncertain ? '#FBEAE7' : 'transparent',
              }}
            />
            {uncertain && <span style={{ color: 'var(--accent)' }}>원본 대조 필요</span>}
          </div>
        );
      })}
    </div>
  );
}

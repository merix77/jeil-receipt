// Two uncertainty signals: a trailing "?" the OCR left in the value itself, and
// the backend's uncertain_fields list (e.g. an unreadable date replaced with today).
function isUncertain(item, key) {
  const value = item[key];
  if (typeof value === 'string' && value.trim().endsWith('?')) return true;
  return Array.isArray(item.uncertain_fields) && item.uncertain_fields.includes(key);
}

export default function ReceiptItemRow({ item, fields, onChange }) {
  return (
    <div style={{ borderBottom: '1px solid var(--hairline)', padding: '8px 0' }}>
      {fields.map(({ key, label }) => {
        const uncertain = isUncertain(item, key);
        return (
          <div key={key} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <label style={{ width: 80, color: 'var(--ink-muted)' }}>{label}</label>
            <input
              value={item[key] ?? ''}
              onChange={(e) => onChange({ ...item, [key]: e.target.value })}
              style={{
                flex: 1,
                border: uncertain ? '2px solid var(--accent)' : '1px solid var(--hairline)',
                background: uncertain ? 'var(--accent-bg)' : 'transparent',
              }}
            />
            {uncertain && <span style={{ color: 'var(--accent)' }}>원본 대조 필요</span>}
          </div>
        );
      })}
    </div>
  );
}

import { FIELDS } from '../fields.js';

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

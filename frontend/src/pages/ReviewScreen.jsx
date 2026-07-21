import { useState } from 'react';
import ReceiptItemRow from '../components/ReceiptItemRow.jsx';
import { updateReceiptItems, confirmReceipt } from '../api/receipts.js';

export default function ReviewScreen({ receipt, items: initialItems, onDone }) {
  const [items, setItems] = useState(initialItems);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  function updateItem(index, updated) {
    setItems((prev) => prev.map((it, i) => (i === index ? updated : it)));
  }

  async function handleConfirm() {
    // Legal-record gate: "?"-marked guesses must be corrected against the
    // original photo before anything reaches the sheet.
    const unresolved = items.some((item) =>
      Object.values(item).some((v) => typeof v === 'string' && v.trim().endsWith('?'))
    );
    if (unresolved) {
      setError('"?"가 남아있는 항목이 있습니다. 원본 사진과 대조해 수정한 뒤 기록해주세요.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await updateReceiptItems(receipt.id, items);
      await confirmReceipt(receipt.id);
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: '0 16px 80px' }}>
      <h2>내용 확인</h2>
      {items.map((item, i) => (
        <ReceiptItemRow key={item.id} item={item} onChange={(updated) => updateItem(i, updated)} />
      ))}

      {error && <p style={{ color: 'var(--accent)' }}>{error}</p>}

      <button
        onClick={handleConfirm}
        disabled={saving}
        className="btn-accent"
        style={{
          position: 'sticky',
          bottom: 16,
          width: '100%',
          padding: '14px',
          fontSize: 16,
        }}
      >
        {saving ? '기록 중...' : '장부에 기록하기'}
      </button>
    </div>
  );
}

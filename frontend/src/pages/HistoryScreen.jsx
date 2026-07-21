import { useEffect, useState } from 'react';
import { listReceipts, getReceiptImageUrl, confirmReceipt } from '../api/receipts.js';
import StampMark from '../components/StampMark.jsx';

function monthString(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function summarize(items) {
  if (items.length === 0) return '항목 없음';
  const first = items[0];
  const head = [first.meat_type, first.cut_name, first.weight_kg && `${first.weight_kg}kg`]
    .filter(Boolean)
    .join(' ');
  return items.length > 1 ? `${head} 외 ${items.length - 1}건` : head;
}

export default function HistoryScreen({ onBack }) {
  const [month, setMonth] = useState(() => monthString(new Date()));
  const [receipts, setReceipts] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [resending, setResending] = useState(false);
  const [msg, setMsg] = useState(null);

  function load() {
    listReceipts(month).then(setReceipts);
  }

  useEffect(load, [month]);

  function shiftMonth(delta) {
    const [y, m] = month.split('-').map(Number);
    setMonth(monthString(new Date(y, m - 1 + delta, 1)));
    setOpenId(null);
    setImageUrl(null);
    setMsg(null);
  }

  async function toggleOpen(receipt) {
    setMsg(null);
    if (openId === receipt.id) {
      setOpenId(null);
      setImageUrl(null);
      return;
    }
    setOpenId(receipt.id);
    setImageUrl(null);
    try {
      setImageUrl(await getReceiptImageUrl(receipt.id));
    } catch {
      setImageUrl(null);
    }
  }

  async function handleResend(receiptId) {
    setResending(true);
    setMsg(null);
    try {
      await confirmReceipt(receiptId);
      setMsg('시트에 반영되었습니다');
      load();
    } catch (err) {
      setMsg(`재전송 실패: ${err.message}`);
    } finally {
      setResending(false);
    }
  }

  const [year, mon] = month.split('-');

  return (
    <div style={{ padding: '0 16px 40px' }}>
      <button
        onClick={onBack}
        style={{ marginTop: 12, padding: 0, fontSize: 14, color: 'var(--ink-muted)', background: 'transparent', border: 'none' }}
      >
        ‹ 홈으로
      </button>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '12px 0' }}>
        <button onClick={() => shiftMonth(-1)} style={{ fontSize: 20, background: 'transparent', border: 'none', color: 'var(--accent)', padding: '4px 12px' }}>
          ‹
        </button>
        <h2 style={{ margin: 0, fontSize: 18 }}>{year}년 {Number(mon)}월 거래 조회</h2>
        <button onClick={() => shiftMonth(1)} style={{ fontSize: 20, background: 'transparent', border: 'none', color: 'var(--accent)', padding: '4px 12px' }}>
          ›
        </button>
      </div>

      {receipts.length === 0 && <p style={{ color: 'var(--ink-muted)' }}>이 달의 기록이 없습니다</p>}

      {receipts.map((r) => (
        <div key={r.id} style={{ borderBottom: '1px solid var(--hairline)' }}>
          <div
            onClick={() => toggleOpen(r)}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0' }}
          >
            <div>
              <div style={{ fontWeight: 700 }}>
                {r.created_at.slice(5, 10).replace('-', '/')}{' '}
                <span style={{ fontWeight: 400 }}>{r.items[0]?.supplier || ''}</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--ink-muted)', marginTop: 2 }}>{summarize(r.items)}</div>
            </div>
            {r.sheet_synced ? (
              <StampMark />
            ) : (
              <span style={{ fontSize: 13, color: 'var(--accent)' }}>미반영</span>
            )}
          </div>

          {openId === r.id && (
            <div style={{ paddingBottom: 16 }}>
              {imageUrl ? (
                <img src={imageUrl} alt="원본 사진" style={{ maxWidth: '100%', borderRadius: 8, border: '1px solid var(--hairline)' }} />
              ) : (
                <p style={{ fontSize: 13, color: 'var(--ink-muted)' }}>사진 불러오는 중...</p>
              )}

              <div style={{ overflowX: 'auto', marginTop: 8 }}>
                <table style={{ borderCollapse: 'collapse', fontSize: 13, whiteSpace: 'nowrap' }}>
                  <thead>
                    <tr style={{ color: 'var(--ink-muted)' }}>
                      {['거래일', '축종', '부위', 'kg', '등급', '도축장', '이력번호', '매입처'].map((h) => (
                        <th key={h} style={{ padding: '4px 8px', borderBottom: '1px solid var(--hairline)', textAlign: 'left', fontWeight: 400 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {r.items.map((it) => (
                      <tr key={it.id}>
                        <td style={{ padding: '4px 8px' }}>{it.trade_date}</td>
                        <td style={{ padding: '4px 8px' }}>{it.meat_type}</td>
                        <td style={{ padding: '4px 8px' }}>{it.cut_name}</td>
                        <td style={{ padding: '4px 8px' }}>{it.weight_kg}</td>
                        <td style={{ padding: '4px 8px' }}>{it.grade}</td>
                        <td style={{ padding: '4px 8px' }}>{it.slaughterhouse}</td>
                        <td style={{ padding: '4px 8px' }}>{it.trace_number}</td>
                        <td style={{ padding: '4px 8px' }}>{it.supplier}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {r.sync_error && (
                <p style={{ fontSize: 13, color: 'var(--accent)', marginTop: 8 }}>전송 오류: {r.sync_error}</p>
              )}

              {!r.sheet_synced && (
                <button
                  onClick={() => handleResend(r.id)}
                  disabled={resending}
                  style={{
                    marginTop: 8,
                    padding: '10px 20px',
                    fontSize: 14,
                    fontWeight: 700,
                    color: '#fff',
                    background: 'var(--accent)',
                    border: 'none',
                    borderRadius: 8,
                  }}
                >
                  {resending ? '전송 중...' : '시트에 재전송'}
                </button>
              )}

              {msg && <p style={{ fontSize: 13, color: 'var(--ink-muted)', marginTop: 8 }}>{msg}</p>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

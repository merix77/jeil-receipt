import { useEffect, useState } from 'react';
import { createReceipt, listReceipts, autoHygieneCheck, registerEducation } from '../api/receipts.js';
import { compressReceiptImage } from '../api/compressImage.js';
import CameraCapture from '../components/CameraCapture.jsx';
import { todayStr, monthStr, localDateStr } from '../dates.js';

const HYGIENE_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1_Ud__ZfAFF8xFhfMa-oWkfC0YSx6otrrSE5tdBGiFnY';
const EDU_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1vVdyIGuYhGELd8OZHaSNyjGXqqOOapcXAk44kkJsUWM';

const cardStyle = {
  flex: 1,
  padding: '16px 8px',
  fontSize: 15,
  fontWeight: 700,
  color: 'var(--accent)',
  background: 'transparent',
  border: '1.5px solid var(--accent)',
  borderRadius: 10,
  lineHeight: 1.4,
};

export default function HomeScreen({ onExtracted, onOpenHistory }) {
  const [todayCount, setTodayCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const [docType, setDocType] = useState('purchase');
  const [hygieneMsg, setHygieneMsg] = useState(null);
  const [hygieneLoading, setHygieneLoading] = useState(false);
  const [eduMsg, setEduMsg] = useState(null);
  const [eduLoading, setEduLoading] = useState(false);

  useEffect(() => {
    listReceipts(monthStr(new Date()))
      .then((receipts) => {
        const today = todayStr();
        setTodayCount(receipts.filter((r) => localDateStr(r.created_at) === today).length);
      })
      .catch(console.error);
  }, []);

  async function uploadFile(file, type) {
    setLoading(true);
    setError(null);
    try {
      const compressed = await compressReceiptImage(file);
      const { receipt, items } = await createReceipt(compressed, type);
      onExtracted(receipt, items);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function openCamera(type) {
    setDocType(type);
    setError(null);
    setShowCamera(true);
  }

  function handleCapture(file) {
    setShowCamera(false);
    uploadFile(file, docType);
  }

  function handleFileChange(e) {
    const file = e.target.files[0];
    if (file) uploadFile(file, docType);
  }

  async function handleHygieneCheck() {
    setHygieneLoading(true);
    setHygieneMsg(null);
    try {
      const { message } = await autoHygieneCheck();
      setHygieneMsg(message);
    } catch (err) {
      setHygieneMsg(`등록 실패: ${err.message}`);
    } finally {
      setHygieneLoading(false);
    }
  }

  async function handleEducation() {
    setEduLoading(true);
    setEduMsg(null);
    try {
      const { message } = await registerEducation();
      setEduMsg(message);
    } catch (err) {
      setEduMsg(`등록 실패: ${err.message}`);
    } finally {
      setEduLoading(false);
    }
  }

  return (
    <div style={{ padding: '0 16px' }}>
      <button
        onClick={() => openCamera('purchase')}
        disabled={loading}
        className="btn-accent"
        style={{
          width: '100%',
          marginTop: 24,
          padding: '26px 12px',
          fontSize: 18,
          lineHeight: 1.35,
          fontFamily: 'var(--font-title)',
          borderRadius: 12,
        }}
      >
        {loading && docType === 'purchase' ? '분석 중...' : '📷 거래내역서(매입) 촬영하기'}
      </button>

      <button
        onClick={() => openCamera('sale')}
        disabled={loading}
        className="btn-accent"
        style={{
          width: '100%',
          marginTop: 10,
          padding: '26px 12px',
          fontSize: 18,
          lineHeight: 1.35,
          fontFamily: 'var(--font-title)',
          borderRadius: 12,
        }}
      >
        {loading && docType === 'sale' ? '분석 중...' : '📷 영업자간거래내역서(판매) 촬영하기'}
      </button>

      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 16,
          marginTop: 10,
          color: 'var(--ink-muted)',
          fontSize: 14,
        }}
      >
        {['purchase', 'sale'].map((type) => (
          <label key={type} style={{ textDecoration: 'underline' }}>
            {type === 'purchase' ? '매입' : '판매'} 갤러리에서 선택
            <input
              type="file"
              accept="image/*"
              onClick={() => setDocType(type)}
              onChange={handleFileChange}
              disabled={loading}
              style={{ display: 'none' }}
            />
          </label>
        ))}
      </div>

      <button
        onClick={onOpenHistory}
        style={{
          width: '100%',
          marginTop: 12,
          padding: '18px 16px',
          fontSize: 17,
          fontWeight: 700,
          fontFamily: 'var(--font-title)',
          color: 'var(--accent)',
          background: 'transparent',
          border: '2px solid var(--accent)',
          borderRadius: 12,
        }}
      >
        🔍 거래내역 조회하기
      </button>

      {error && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            border: '1px solid var(--accent)',
            background: 'var(--accent-bg)',
            color: 'var(--accent)',
            borderRadius: 8,
          }}
        >
          업로드 실패: {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        <button onClick={handleHygieneCheck} disabled={hygieneLoading} style={cardStyle}>
          🧼
          <br />
          {hygieneLoading ? '등록 중...' : '위생점검 자동등록'}
        </button>
        <button onClick={handleEducation} disabled={eduLoading} style={cardStyle}>
          📋
          <br />
          {eduLoading ? '등록 중...' : '위생교육 결과서 등록'}
        </button>
      </div>

      {hygieneMsg && <p style={{ marginTop: 8, color: 'var(--ink-muted)', fontSize: 14 }}>{hygieneMsg}</p>}
      {eduMsg && <p style={{ marginTop: 8, color: 'var(--ink-muted)', fontSize: 14 }}>{eduMsg}</p>}

      <hr style={{ border: 'none', borderTop: '1px solid var(--hairline)', margin: '24px 0 0' }} />

      <p style={{ padding: '14px 0', margin: 0, fontSize: 15 }}>
        오늘 기록 <strong style={{ color: 'var(--accent)' }}>{todayCount}건</strong>
      </p>

      <div style={{ display: 'flex', gap: 16, paddingBottom: 24, fontSize: 13 }}>
        <a href={HYGIENE_SHEET_URL} target="_blank" rel="noreferrer" style={{ color: 'var(--ink-muted)' }}>
          위생점검표 시트 열기 ↗
        </a>
        <a href={EDU_SHEET_URL} target="_blank" rel="noreferrer" style={{ color: 'var(--ink-muted)' }}>
          위생교육 시트 열기 ↗
        </a>
      </div>

      {showCamera && (
        <CameraCapture onCapture={handleCapture} onClose={() => setShowCamera(false)} />
      )}
    </div>
  );
}

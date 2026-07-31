import { useRegisterSW } from 'virtual:pwa-register/react';

// 새 버전이 배포되면(서비스 워커가 대기 상태가 되면) 하단 배너를 띄우고,
// '새로고침'을 누르면 새 워커를 즉시 활성화하고 페이지를 리로드한다.
export default function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div
      style={{
        position: 'fixed',
        left: 12,
        right: 12,
        bottom: 12,
        maxWidth: 456,
        margin: '0 auto',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        background: 'var(--primary)',
        color: '#fff',
        borderRadius: 12,
        boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
        zIndex: 1000,
      }}
    >
      <span style={{ fontSize: 14, fontWeight: 700 }}>새 버전이 있습니다</span>
      <button
        onClick={() => updateServiceWorker(true)}
        style={{
          padding: '8px 16px',
          fontSize: 14,
          fontWeight: 700,
          color: 'var(--primary)',
          background: 'var(--accent)',
          border: 'none',
          borderRadius: 8,
          whiteSpace: 'nowrap',
        }}
      >
        새로고침
      </button>
    </div>
  );
}

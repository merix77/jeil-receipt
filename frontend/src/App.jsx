import { useEffect, useState } from 'react';
import HomeScreen from './pages/HomeScreen.jsx';
import ReviewScreen from './pages/ReviewScreen.jsx';
import HistoryScreen from './pages/HistoryScreen.jsx';
import { listReceipts } from './api/receipts.js';
import { todayStr, monthStr, localDateStr } from './dates.js';

export default function App() {
  const [screen, setScreen] = useState('home');
  const [activeReceipt, setActiveReceipt] = useState(null);

  useEffect(() => {
    async function restorePendingReceipt() {
      const receipts = await listReceipts(monthStr(new Date()));
      const today = todayStr();
      const pending = receipts.find(
        (r) => !r.sheet_synced && localDateStr(r.created_at) === today
      );
      if (!pending) return;

      setActiveReceipt({ receipt: pending, items: pending.items });
      setScreen('review');
    }

    restorePendingReceipt().catch(console.error);
  }, []);

  function goToReview(receipt, items) {
    setActiveReceipt({ receipt, items });
    setScreen('review');
  }

  function goHome() {
    setActiveReceipt(null);
    setScreen('home');
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100vh' }}>
      <header
        style={{
          padding: '16px',
          background: 'var(--primary)',
          textAlign: 'center',
        }}
        onClick={goHome}
      >
        <h1
          style={{
            margin: 0,
            fontSize: 20,
            color: 'var(--accent)',
            letterSpacing: '0.05em',
          }}
        >
          제일축산 PREMIUM
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.85)' }}>
          거래명세 · 위생관리 장부
        </p>
      </header>

      {screen === 'home' && (
        <HomeScreen onExtracted={goToReview} onOpenHistory={() => setScreen('history')} />
      )}
      {screen === 'review' && activeReceipt && (
        <ReviewScreen
          key={activeReceipt.receipt.id}
          receipt={activeReceipt.receipt}
          items={activeReceipt.items}
          onDone={goHome}
        />
      )}
      {screen === 'history' && <HistoryScreen onBack={goHome} />}
    </div>
  );
}

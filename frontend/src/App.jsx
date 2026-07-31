import { useEffect, useRef, useState } from 'react';
import HomeScreen from './pages/HomeScreen.jsx';
import ReviewScreen from './pages/ReviewScreen.jsx';
import HistoryScreen from './pages/HistoryScreen.jsx';
import YieldScreen from './pages/YieldScreen.jsx';
import CostCalcScreen from './pages/CostCalcScreen.jsx';
import { listReceipts } from './api/receipts.js';
import { todayStr, monthStr, localDateStr } from './dates.js';

// 라우터 없이 History API로 뒤로가기 스택을 구성한다.
// - 앞으로 가기: navigate() → history.pushState + 스택 push
// - 뒤로가기: 브라우저/버튼 모두 history.back() → popstate → 스택 pop
// - 홈 복귀(완료 등): goHomeUnwind() → 스택을 홈까지 되감아 결과 화면으로 안 돌아가게
export default function App() {
  const [view, setView] = useState({ screen: 'home' });
  const [activeReceipt, setActiveReceipt] = useState(null);
  const stackRef = useRef([{ screen: 'home' }]); // 브라우저 히스토리와 1:1 미러
  const suppressRef = useRef(0); // goHomeUnwind가 유발한 popstate 억제 카운트

  useEffect(() => {
    const onPop = () => {
      if (suppressRef.current > 0) {
        suppressRef.current -= 1;
        return;
      }
      if (stackRef.current.length > 1) {
        stackRef.current = stackRef.current.slice(0, -1);
        setView(stackRef.current[stackRef.current.length - 1]);
      }
      // 스택이 홈 하나뿐이면 pop할 게 없어 브라우저가 앱을 나간다
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  function navigate(next) {
    stackRef.current = [...stackRef.current, next];
    window.history.pushState({ depth: stackRef.current.length }, '');
    setView(next);
  }

  function goBack() {
    window.history.back();
  }

  function goHomeUnwind() {
    const n = stackRef.current.length - 1;
    stackRef.current = [{ screen: 'home' }];
    setActiveReceipt(null);
    setView({ screen: 'home' });
    if (n > 0) {
      suppressRef.current += n;
      window.history.go(-n); // 히스토리도 홈까지 되감음(발생하는 popstate는 억제)
    }
  }

  useEffect(() => {
    async function restorePendingReceipt() {
      const receipts = await listReceipts(monthStr(new Date()));
      const today = todayStr();
      const pending = receipts.find((r) => !r.sheet_synced && localDateStr(r.created_at) === today);
      if (!pending) return;
      setActiveReceipt({ receipt: pending, items: pending.items });
      navigate({ screen: 'review' });
    }
    restorePendingReceipt().catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function goToReview(receipt, items) {
    setActiveReceipt({ receipt, items });
    navigate({ screen: 'review' });
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100vh' }}>
      <header
        style={{
          padding: '16px',
          background: 'var(--primary)',
          borderBottom: '2px solid var(--accent)',
          textAlign: 'center',
        }}
        onClick={goHomeUnwind}
      >
        <h1 style={{ margin: 0, fontSize: 20, color: 'var(--accent)', letterSpacing: '0.05em' }}>
          제일축산 PREMIUM
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.85)' }}>
          거래명세 · 위생관리 장부
        </p>
      </header>

      {view.screen === 'home' && (
        <HomeScreen
          onExtracted={goToReview}
          onOpenHistory={() => navigate({ screen: 'history' })}
          onOpenYield={() => navigate({ screen: 'yield', step: 1 })}
          onOpenCostCalc={() => navigate({ screen: 'costcalc' })}
        />
      )}
      {view.screen === 'review' && activeReceipt && (
        <ReviewScreen
          key={activeReceipt.receipt.id}
          receipt={activeReceipt.receipt}
          items={activeReceipt.items}
          onDone={goHomeUnwind}
        />
      )}
      {view.screen === 'history' && <HistoryScreen onBack={goBack} />}
      {view.screen === 'yield' && (
        <YieldScreen
          step={view.step}
          onNext={(s) => navigate({ screen: 'yield', step: s })}
          onBack={goBack}
          onGoHome={goHomeUnwind}
        />
      )}
      {view.screen === 'costcalc' && <CostCalcScreen onBack={goBack} />}
    </div>
  );
}

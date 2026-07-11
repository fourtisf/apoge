import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Shell } from './components/Shell';
import { useRealtime } from './lib/queries';
import { useSession, useUi } from './state/store';
import { useWallet } from './wallet/useWallet';
import { Home } from './views/Home';
import { Portfolio } from './views/Portfolio';
import { SaleDetail } from './views/SaleDetail';
import { Staking } from './views/Staking';

/* The full wallet SDK stack (wagmi/viem/solana) loads only when needed. */
const WalletHost = lazy(() => import('./wallet/WalletHost'));

export function App() {
  useRealtime();

  /* Refresh the off-chain account on load if a session was persisted. */
  const { refreshAccount } = useWallet();
  const hasSession = useSession((s) => !!s.token);
  useEffect(() => {
    if (hasSession) void refreshAccount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSession]);

  const walletStackRequested = useUi((s) => s.walletStackRequested);

  return (
    <>
      <Routes>
        <Route element={<Shell />}>
          <Route path="/" element={<Home />} />
          <Route path="/sale/:slug" element={<SaleDetail />} />
          <Route path="/staking" element={<Staking />} />
          <Route path="/portfolio" element={<Portfolio />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      {walletStackRequested && (
        <Suspense fallback={null}>
          <WalletHost />
        </Suspense>
      )}
    </>
  );
}

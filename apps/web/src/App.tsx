import { lazy, Suspense, useEffect } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Shell } from './components/Shell';
import { useRealtime } from './lib/queries';
import { useSession, useUi } from './state/store';
import { useWallet } from './wallet/useWallet';
import { Admin } from './views/Admin';
import { Applications } from './views/Applications';
import { Apply } from './views/Apply';
import { Home } from './views/Home';
import { HowItWorks, Privacy, Risk, Terms } from './views/InfoPages';
import { Leaderboard } from './views/Leaderboard';
import { News } from './views/News';
import { NotFound } from './views/NotFound';
import { Portfolio } from './views/Portfolio';
import { SaleDetail } from './views/SaleDetail';
import { Staking } from './views/Staking';
import { Stats } from './views/Stats';
import { TokenPage } from './views/TokenPage';

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
          <Route path="/stats" element={<Stats />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/token" element={<TokenPage />} />
          <Route path="/news" element={<News />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/apply" element={<Apply />} />
          <Route path="/applications" element={<Applications />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/risk" element={<Risk />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<NotFound />} />
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

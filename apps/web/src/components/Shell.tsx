import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fmtNum, truncAddr } from '@apogee/shared';
import { useGasPill } from '../lib/useGasPill';
import { useUi } from '../state/store';
import { useWallet } from '../wallet/useWallet';
import { ConnectModal } from './ConnectModal';
import { Toasts } from './Toasts';
import { useCopy } from './ui';
import {
  BrandMark,
  IconBriefcase,
  IconChevronDown,
  IconCopy,
  IconCheck,
  IconFlame,
  IconOrbit,
  IconCoin,
  IconNews,
  IconRocket,
  IconSearch,
  IconSend,
  IconSignal,
  IconTelegram,
  IconTrophy,
  IconWallet,
  IconX,
  IconXSocial,
} from './icons';
import { SOCIAL_LINKS } from '../lib/links';

const NAV = [
  { to: '/', label: 'Launchpad', icon: IconRocket, end: true },
  { to: '/staking', label: 'Staking', icon: IconOrbit, end: false },
  { to: '/portfolio', label: 'Portfolio', icon: IconBriefcase, end: false },
];

const NAV_EXPLORE = [
  { to: '/stats', label: 'Stats', icon: IconSignal, end: false },
  { to: '/leaderboard', label: 'Leaderboard', icon: IconTrophy, end: false },
  { to: '/token', label: 'Token', icon: IconCoin, end: false },
  { to: '/news', label: 'News', icon: IconNews, end: false },
];

function pageTitle(pathname: string): string {
  if (pathname.startsWith('/sale/')) return 'Sale';
  if (pathname.startsWith('/staking')) return 'Staking';
  if (pathname.startsWith('/portfolio')) return 'Portfolio';
  if (pathname.startsWith('/admin')) return 'Admin';
  if (pathname.startsWith('/apply')) return 'Apply';
  if (pathname.startsWith('/stats')) return 'Stats';
  if (pathname.startsWith('/leaderboard')) return 'Leaderboard';
  if (pathname.startsWith('/token')) return 'Token';
  if (pathname.startsWith('/news')) return 'News';
  if (pathname.startsWith('/how-it-works')) return 'Guide';
  if (/^\/(terms|privacy|risk)/.test(pathname)) return 'Legal';
  return 'Launchpad';
}

/* ── Sidebar ──────────────────────────────────────────────────────── */

function WalletCard() {
  const { account, tier, connect } = useWallet();
  const [copied, copy] = useCopy();

  if (!account) {
    return (
      <div className="panel p-4">
        <div className="label">Wallet</div>
        <p className="mt-2 text-[12.5px] leading-relaxed text-muted">
          Connect to see balances, tier and allocations.
        </p>
        <button onClick={connect} className="btn btn-gold mt-3 w-full">
          <IconWallet size={15} />
          Connect Wallet
        </button>
      </div>
    );
  }

  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between">
        <div className="label">Wallet</div>
        {tier ? <span className="pill pill-gold">{tier.name}</span> : <span className="pill">No tier</span>}
      </div>
      <button
        onClick={() => copy(account.wallet)}
        className="num mt-2.5 flex items-center gap-1.5 text-[12.5px] text-ivory transition-colors hover:text-gold"
        title="Copy address"
      >
        {truncAddr(account.wallet, 5, 4)}
        {copied ? <IconCheck size={12} /> : <IconCopy size={12} />}
      </button>
      <div className="mt-3 border-t border-line pt-1">
        <div className="kv">
          <span className="k text-[12px]">USDC</span>
          <span className="num text-[12.5px]">{fmtNum(account.usdcBalance)}</span>
        </div>
        <div className="kv">
          <span className="k text-[12px]">APG</span>
          <span className="num text-[12.5px]">{fmtNum(account.apgBalance)}</span>
        </div>
        <div className="kv">
          <span className="k text-[12px]">Staked</span>
          <span className="num text-[12.5px] text-gold">{fmtNum(account.staked)}</span>
        </div>
      </div>
    </div>
  );
}

function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-[264px] flex-col border-r border-line bg-panel/60 px-4 py-5 backdrop-blur max-[900px]:hidden">
      <NavLink to="/" className="flex items-center gap-2.5 px-2">
        <BrandMark size={26} />
        <span className="text-[15.5px] font-semibold tracking-[0.16em] text-ivory">APOGE</span>
      </NavLink>

      <nav className="mt-7 flex flex-col gap-1" aria-label="Primary">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className="nav-item">
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
        <div className="label mb-1 mt-5 px-3">Explore</div>
        {NAV_EXPLORE.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className="nav-item">
            <Icon size={16} />
            {label}
          </NavLink>
        ))}

        <div className="label mb-1 mt-5 px-3">For builders</div>
        <NavLink to="/apply" className="nav-item">
          <IconSend size={16} />
          Apply for Launch
        </NavLink>
      </nav>

      <div className="mt-auto flex flex-col gap-3">
        <WalletCard />
        <div className="flex items-center justify-between px-2 py-1">
          <span className="flex items-center gap-2 text-[11px] text-muted">
            <span className="dot h-1.5 w-1.5 rounded-full bg-mint shadow-[0_0_8px_rgba(61,214,140,.7)]" />
            All systems nominal
          </span>
          <span className="label !text-[9.5px]">v1.0 · P1</span>
        </div>
      </div>
    </aside>
  );
}

/* ── Topbar ───────────────────────────────────────────────────────── */

function WalletButton() {
  const { account, connect, disconnect } = useWallet();
  const [open, setOpen] = useState(false);
  const [copied, copy] = useCopy();
  const navigate = useNavigate();

  if (!account) {
    return (
      <button onClick={connect} className="btn btn-gold h-[38px] !px-4" aria-label="Connect Wallet">
        <IconWallet size={15} />
        <span className="max-[640px]:hidden">Connect Wallet</span>
      </button>
    );
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} className="btn btn-ghost h-[38px] !px-3.5">
        <span className="h-1.5 w-1.5 rounded-full bg-gold shadow-[0_0_8px_rgba(201,163,102,.8)]" />
        <span className="num text-[12.5px]">{truncAddr(account.wallet, 4, 4)}</span>
        <IconChevronDown size={13} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="panel absolute right-0 top-[46px] z-50 w-52 p-1.5">
            <button
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] text-muted transition-colors hover:bg-panel3 hover:text-ivory"
              onClick={() => copy(account.wallet)}
            >
              {copied ? <IconCheck size={13} /> : <IconCopy size={13} />}
              Copy address
            </button>
            <button
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] text-muted transition-colors hover:bg-panel3 hover:text-ivory"
              onClick={() => {
                setOpen(false);
                navigate('/portfolio');
              }}
            >
              <IconBriefcase size={13} />
              View portfolio
            </button>
            <div className="mx-2 my-1 border-t border-line" />
            <button
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] text-red transition-colors hover:bg-panel3"
              onClick={() => {
                setOpen(false);
                disconnect();
              }}
            >
              <IconWallet size={13} />
              Disconnect
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/** "$APG CA: SOON" in the topbar — flips to LIVE once the token deploys
 *  (onchain config carries an APG address). Links to the token page. */
function CaPill() {
  const { data } = useQuery({
    queryKey: ['onchain-config'],
    queryFn: async () => {
      const res = await fetch('/api/onchain/config');
      return (await res.json()) as { chains: Record<string, { apg?: string }> };
    },
    staleTime: 5 * 60_000,
    retry: 1,
  });
  const live = Object.values(data?.chains ?? {}).some((c) => c.apg);
  return (
    <Link to="/token" className="pill pill-upcoming" title="Token status">
      <IconCoin size={11} />
      {live ? '$APOGE · LIVE' : '$APOGE CA · SOON'}
    </Link>
  );
}

/** X + Telegram, always visible up top — the footer is below the fold. */
function TopbarSocials() {
  return (
    <span className="flex items-center gap-1.5 max-[900px]:hidden">
      <a
        href={SOCIAL_LINKS.x}
        target="_blank"
        rel="noreferrer noopener"
        aria-label="Apoge on X"
        className="flex h-[30px] w-[30px] items-center justify-center rounded-[10px] border border-line bg-panel2 text-muted transition-all duration-300 hover:border-gold/40 hover:text-ivory"
      >
        <IconXSocial size={12} />
      </a>
      <a
        href={SOCIAL_LINKS.telegram}
        target="_blank"
        rel="noreferrer noopener"
        aria-label="Apoge on Telegram"
        className="flex h-[30px] w-[30px] items-center justify-center rounded-[10px] border border-line bg-panel2 text-muted transition-all duration-300 hover:border-gold/40 hover:text-ivory"
      >
        <IconTelegram size={12} />
      </a>
    </span>
  );
}

function Topbar() {
  const location = useLocation();
  const { account } = useWallet();
  const search = useUi((s) => s.search);
  const setSearch = useUi((s) => s.setSearch);
  const searchRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const gas = useGasPill(account?.chainType === 'sol' ? 'SOL' : 'ETH');

  /* ⌘K / Ctrl-K focuses search from anywhere. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-bg/80 px-6 backdrop-blur-md max-[640px]:px-4">
      <h1 className="mr-1 w-28 flex-none text-[15px] font-semibold text-ivory max-[640px]:w-auto">
        {pageTitle(location.pathname)}
      </h1>

      <div className="search-wrap max-[900px]:w-44 max-[640px]:hidden">
        <IconSearch size={14} className="flex-none text-faint" />
        <input
          ref={searchRef}
          value={search}
          placeholder="Search projects…"
          onChange={(e) => {
            setSearch(e.target.value);
            if (location.pathname !== '/') navigate('/');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') (e.target as HTMLInputElement).blur();
          }}
          aria-label="Search projects"
        />
        <span className="kbd">⌘K</span>
      </div>

      <div className="ml-auto flex items-center gap-2.5">
        <TopbarSocials />
        <CaPill />
        <span className="pill max-[640px]:hidden" title="Estimated network fee (Phase 1 preview)">
          <IconFlame size={11} className="text-gold" />
          <span className="num">{gas}</span>
        </span>
        <span className="pill max-[640px]:hidden">
          <span className="dot bg-mint" />
          Mainnet
        </span>
        <WalletButton />
      </div>
    </header>
  );
}

/* ── Phase 1 banner ───────────────────────────────────────────────── */

const BANNER_KEY = 'apogee-p1-banner-dismissed';

function PhaseBanner() {
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(BANNER_KEY) === '1');
  if (dismissed) return null;
  return (
    <div className="flex items-center justify-center gap-3 border-b border-gold/20 bg-gold/10 px-4 py-2 text-center">
      <p className="text-[11.5px] text-gold-hi">
        <span className="font-semibold">Phase 1 preview</span> — balances, staking and purchases
        are simulated off-chain. No real funds are involved.{' '}
        <Link to="/how-it-works" className="underline underline-offset-2 hover:text-ivory">
          Learn more
        </Link>
      </p>
      <button
        onClick={() => {
          localStorage.setItem(BANNER_KEY, '1');
          setDismissed(true);
        }}
        className="text-gold transition-colors hover:text-ivory"
        aria-label="Dismiss notice"
      >
        <IconX size={13} />
      </button>
    </div>
  );
}

/* ── Footer ───────────────────────────────────────────────────────── */

/* /admin stays reachable by URL for operators — deliberately unlisted. */
const FOOTER_LINKS = [
  { to: '/how-it-works', label: 'How it works' },
  { to: '/apply', label: 'Apply for Launch' },
  { to: '/terms', label: 'Terms' },
  { to: '/privacy', label: 'Privacy' },
  { to: '/risk', label: 'Risk' },
];

function Footer() {
  return (
    <footer className="mx-auto max-w-[1280px] px-6 pb-10 max-[900px]:pb-24 max-[640px]:px-4">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line pt-5">
        {FOOTER_LINKS.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            className="text-[11.5px] text-faint transition-colors hover:text-ivory"
          >
            {l.label}
          </Link>
        ))}
        <span className="ml-auto flex items-center gap-2">
          <a
            href={SOCIAL_LINKS.x}
            target="_blank"
            rel="noreferrer noopener"
            aria-label="Apoge on X"
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-line bg-panel2 text-faint transition-all duration-300 hover:border-gold/40 hover:text-ivory"
          >
            <IconXSocial size={12} />
          </a>
          <a
            href={SOCIAL_LINKS.telegram}
            target="_blank"
            rel="noreferrer noopener"
            aria-label="Apoge on Telegram"
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-line bg-panel2 text-faint transition-all duration-300 hover:border-gold/40 hover:text-ivory"
          >
            <IconTelegram size={12} />
          </a>
          <span className="label ml-2 !text-[9.5px]">© 2026 Apoge · Phase 1 preview</span>
        </span>
      </div>
    </footer>
  );
}

/* ── Mobile bottom nav ────────────────────────────────────────────── */

function MobileNav() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 hidden border-t border-line bg-panel/90 backdrop-blur-md max-[900px]:flex"
      aria-label="Primary mobile"
    >
      {[...NAV, NAV_EXPLORE[0]!].map(({ to, label, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end} className="bottom-nav-item">
          <Icon size={18} />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

/* ── Shell ────────────────────────────────────────────────────────── */

export function Shell() {
  const location = useLocation();

  /* Scroll to top on route change. */
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <div className="min-h-screen">
      <Sidebar />
      <div className="ml-[264px] max-[900px]:ml-0">
        <PhaseBanner />
        <Topbar />
        <main className="mx-auto min-h-[70vh] max-w-[1280px] px-6 py-7 pb-16 max-[640px]:px-4">
          <Outlet />
        </main>
        <Footer />
      </div>
      <MobileNav />
      <ConnectModal />
      <Toasts />
    </div>
  );
}

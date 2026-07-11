import {
  useEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import {
  CHAIN_META,
  countdownParts,
  pad2,
  type Chain,
  type ProjectLogo,
  type ProjectStatus,
} from '@apogee/shared';

/* ── SpotlightCard: cursor-tracking gold border ───────────────────── */

export function SpotlightCard({
  children,
  className = '',
  ...rest
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      className={`panel spot ${className}`}
      onMouseMove={(e) => {
        const el = ref.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        el.style.setProperty('--mx', `${e.clientX - rect.left}px`);
        el.style.setProperty('--my', `${e.clientY - rect.top}px`);
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

/* ── Pills ────────────────────────────────────────────────────────── */

const STATUS_COPY: Record<ProjectStatus, string> = {
  live: 'Live',
  upcoming: 'Upcoming',
  tba: 'TBA',
  ended: 'Ended',
};

export function StatusPill({ status }: { status: ProjectStatus }) {
  const cls =
    status === 'live' ? 'pill-live' : status === 'upcoming' ? 'pill-upcoming' : status === 'ended' ? 'pill-ended' : '';
  return (
    <span className={`pill ${cls}`}>
      {status === 'live' && <span className="dot" />}
      {STATUS_COPY[status]}
    </span>
  );
}

export function ChainPill({ chain }: { chain: Chain }) {
  const meta = CHAIN_META[chain];
  return (
    <span className="pill">
      <span className="dot" style={{ background: meta.color }} />
      {chain}
    </span>
  );
}

/* ── Project logo tile (letter + gradient, per spec) ──────────────── */

export function LogoTile({
  logo,
  size = 40,
  radius = 12,
}: {
  logo: ProjectLogo;
  size?: number;
  radius?: number;
}) {
  return (
    <div
      aria-hidden
      className="flex items-center justify-center font-semibold text-[#0A0B0E] flex-none"
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        fontSize: size * 0.44,
        background: `linear-gradient(135deg, ${logo.from}, ${logo.to})`,
        boxShadow: `0 6px 18px -6px ${logo.to}66`,
      }}
    >
      {logo.letter}
    </div>
  );
}

/* ── Countdown ────────────────────────────────────────────────────── */

export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** "02d 13:45:09" — days segment drops out when zero. */
export function Countdown({ target, className = '' }: { target: string; className?: string }) {
  const now = useNow();
  const p = countdownParts(target, now);
  return (
    <span className={`num ${className}`}>
      {p.days > 0 && <>{pad2(p.days)}<span className="text-faint">d</span>{' '}</>}
      {pad2(p.hours)}:{pad2(p.minutes)}:{pad2(p.seconds)}
    </span>
  );
}

/* ── Progress bar ─────────────────────────────────────────────────── */

export function ProgressBar({
  pct,
  thin = false,
  label = 'Progress',
}: {
  pct: number;
  thin?: boolean;
  label?: string;
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div
      className={`progress ${thin ? 'progress-thin' : ''}`}
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="progress-fill" style={{ width: `${clamped}%` }} />
    </div>
  );
}

/* ── Skeleton ─────────────────────────────────────────────────────── */

export function Skeleton({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`skeleton ${className}`} style={style} aria-hidden />;
}

/* ── Copyable (contract addresses) ────────────────────────────────── */

export function useCopy(): [boolean, (text: string) => void] {
  const [copied, setCopied] = useState(false);
  const copy = (text: string) => {
    navigator.clipboard?.writeText(text).catch(() => undefined);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };
  return [copied, copy];
}

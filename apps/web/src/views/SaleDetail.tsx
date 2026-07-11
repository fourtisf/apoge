import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  fmtNumCompact,
  fmtPrice,
  fmtUsd,
  fmtUsdCompact,
  truncAddr,
  type Project,
} from '@apogee/shared';
import { BuyPanel } from '../components/BuyPanel';
import {
  IconArrowLeft,
  IconCheck,
  IconCopy,
  IconDiscord,
  IconDocs,
  IconGlobe,
  IconXSocial,
} from '../components/icons';
import { ChainPill, LogoTile, Skeleton, StatusPill, useCopy } from '../components/ui';
import { useProject } from '../lib/queries';
import { fmtDateTime } from '../lib/time';

type SaleTab = 'overview' | 'tokenomics' | 'vesting';

/** Allocation bar palette — gold family first, then cool accents. */
const ALLOC_COLORS = ['#C9A366', '#EAD1A2', '#8A6A3B', '#98948B', '#5E5A52', '#3DD68C', '#627EEA', '#9945FF'];

/* ── Header ───────────────────────────────────────────────────────── */

function SaleHeader({ p }: { p: Project }) {
  const [copied, copy] = useCopy();

  const socials = [
    { href: p.socials.website, icon: IconGlobe, label: 'Website' },
    { href: p.socials.x, icon: IconXSocial, label: 'X' },
    { href: p.socials.discord, icon: IconDiscord, label: 'Discord' },
    { href: p.socials.docs, icon: IconDocs, label: 'Docs' },
  ].filter((s) => s.href);

  return (
    <header className="panel p-6 max-[640px]:p-5">
      <div className="flex flex-wrap items-start gap-4">
        <LogoTile logo={p.logo} size={60} radius={16} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-[22px] font-semibold tracking-tight text-ivory">{p.name}</h1>
            <span className="num text-[12.5px] text-faint">{p.ticker}</span>
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <StatusPill status={p.status} />
            <ChainPill chain={p.chain} />
            <span className="pill">{p.sector}</span>
            {p.audited &&
              (p.auditUrl ? (
                <a
                  href={p.auditUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="pill !text-mint transition-colors hover:!text-ivory"
                  style={{ borderColor: 'rgba(61,214,140,.25)' }}
                  title="Open audit report"
                >
                  <IconCheck size={10} />
                  Audited ↗
                </a>
              ) : (
                <span className="pill !text-mint" style={{ borderColor: 'rgba(61,214,140,.25)' }}>
                  <IconCheck size={10} />
                  Audited
                </span>
              ))}
            {p.kycTeam && (
              <span className="pill !text-mint" style={{ borderColor: 'rgba(61,214,140,.25)' }}>
                <IconCheck size={10} />
                KYC team
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {socials.map(({ href, icon: Icon, label }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noreferrer noopener"
              aria-label={label}
              className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-line bg-panel2 text-muted transition-all duration-300 hover:border-gold/40 hover:text-ivory"
            >
              <Icon size={13} />
            </a>
          ))}
        </div>
      </div>

      {p.contract && (
        <button
          onClick={() => copy(p.contract!)}
          className="num mt-4 flex items-center gap-2 rounded-lg border border-line bg-panel2 px-3 py-1.5 text-[11px] text-muted transition-colors hover:text-gold"
          title="Copy contract address"
        >
          <span className="label !text-[9.5px]">Contract</span>
          {truncAddr(p.contract, 8, 6)}
          {copied ? <IconCheck size={11} className="text-mint" /> : <IconCopy size={11} />}
        </button>
      )}
    </header>
  );
}

/* ── Tabs content ─────────────────────────────────────────────────── */

function Overview({ p }: { p: Project }) {
  return (
    <div className="flex flex-col gap-5">
      <p className="text-[13.5px] leading-relaxed text-muted">{p.about}</p>
      <div>
        <div className="label mb-3">Highlights</div>
        <ul className="flex flex-col gap-2.5">
          {p.highlights.map((h) => (
            <li key={h} className="flex items-start gap-2.5 text-[13px] leading-relaxed text-ivory">
              <span className="mt-[7px] h-1 w-1 flex-none rounded-full bg-gold" />
              {h}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Tokenomics({ p }: { p: Project }) {
  return (
    <div>
      <div className="flex h-3.5 w-full overflow-hidden rounded-full">
        {p.tokenomics.map((t, i) => (
          <div
            key={t.label}
            style={{ width: `${t.pct}%`, background: ALLOC_COLORS[i % ALLOC_COLORS.length] }}
            title={`${t.label} ${t.pct}%`}
          />
        ))}
      </div>
      <div className="mt-5 grid grid-cols-2 gap-x-8 gap-y-1 max-[640px]:grid-cols-1">
        {p.tokenomics.map((t, i) => (
          <div key={t.label} className="kv">
            <span className="flex items-center gap-2.5 text-[12.5px] text-muted">
              <span
                className="h-2.5 w-2.5 flex-none rounded-[3px]"
                style={{ background: ALLOC_COLORS[i % ALLOC_COLORS.length] }}
              />
              {t.label}
            </span>
            <span className="num text-[12.5px] text-ivory">{t.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Vesting({ p }: { p: Project }) {
  const v = p.vesting;
  const linearPct = 100 - v.tgePct;
  const rows = [
    { label: 'TGE unlock', value: `${v.tgePct}% of allocation` },
    {
      label: 'Cliff',
      value: v.cliffMonths === 0 ? 'None' : `${v.cliffMonths} month${v.cliffMonths > 1 ? 's' : ''}`,
    },
    { label: 'Linear vesting', value: `${linearPct}% over ${v.linearMonths} months` },
    { label: 'Claim cadence', value: 'Continuous — claim any time' },
  ];

  return (
    <div>
      {/* Timeline: TGE slice, then cliff gap, then linear stretch. */}
      <div className="flex items-center gap-1">
        <div
          className="flex h-3.5 items-center justify-center rounded-l-full bg-gold"
          style={{ width: `${Math.max(8, v.tgePct)}%` }}
          title={`TGE ${v.tgePct}%`}
        />
        {v.cliffMonths > 0 && (
          <div
            className="h-3.5 bg-panel3"
            style={{ width: `${Math.min(20, v.cliffMonths * 7)}%` }}
            title={`Cliff ${v.cliffMonths}mo`}
          />
        )}
        <div
          className="h-3.5 flex-1 rounded-r-full"
          style={{ background: 'linear-gradient(90deg, #8A6A3B, rgba(201,163,102,.25))' }}
          title={`Linear ${v.linearMonths}mo`}
        />
      </div>
      <div className="mt-2 flex justify-between text-[10.5px] text-faint">
        <span className="num">TGE</span>
        {v.cliffMonths > 0 && <span className="num">cliff {v.cliffMonths}mo</span>}
        <span className="num">+{v.linearMonths}mo</span>
      </div>

      <div className="mt-5 border-t border-line pt-1">
        {rows.map((r) => (
          <div key={r.label} className="kv">
            <span className="k">{r.label}</span>
            <span className="num text-[12.5px] text-ivory">{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Pool information ─────────────────────────────────────────────── */

function PoolInfo({ p }: { p: Project }) {
  const rows: [string, string][] = [
    ['Sale price', fmtPrice(p.price)],
    ['Soft cap', fmtUsd(p.softCap)],
    ['Hard cap', fmtUsd(p.hardCap)],
    ['Total supply', fmtNumCompact(p.supply)],
    ['Initial mcap', fmtUsdCompact(p.initMcap)],
    ['FDV', fmtUsdCompact(p.fdv)],
    ['Listing', p.listing],
    ['Sale start', p.startAt ? fmtDateTime(p.startAt) : 'TBA'],
    ['Sale end', p.endAt ? fmtDateTime(p.endAt) : 'TBA'],
  ];
  return (
    <section className="panel p-6 max-[640px]:p-5" aria-label="Pool information">
      <div className="label mb-2">Pool information</div>
      <div className="grid grid-cols-2 gap-x-10 max-[640px]:grid-cols-1">
        {rows.map(([k, v]) => (
          <div key={k} className="kv">
            <span className="k">{k}</span>
            <span className="num text-right text-[12.5px] text-ivory">{v}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── View ─────────────────────────────────────────────────────────── */

export function SaleDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { data: p, isLoading, isError } = useProject(slug);
  const [tab, setTab] = useState<SaleTab>('overview');

  if (isLoading) {
    return (
      <div className="grid grid-cols-[1fr_360px] gap-6 max-[900px]:grid-cols-1">
        <div className="flex flex-col gap-6">
          <Skeleton className="h-[180px] !rounded-2xl" />
          <Skeleton className="h-[320px] !rounded-2xl" />
          <Skeleton className="h-[260px] !rounded-2xl" />
        </div>
        <Skeleton className="h-[420px] !rounded-2xl" />
      </div>
    );
  }

  if (isError || !p) {
    return (
      <div className="panel mx-auto max-w-md p-10 text-center">
        <p className="text-[14px] text-muted">This sale doesn’t exist or has been removed.</p>
        <Link to="/" className="btn btn-ghost mt-4">
          <IconArrowLeft size={14} />
          Back to launchpad
        </Link>
      </div>
    );
  }

  const tabs: { key: SaleTab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'tokenomics', label: 'Tokenomics' },
    { key: 'vesting', label: 'Vesting' },
  ];

  return (
    <div>
      <Link
        to="/"
        className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] text-faint transition-colors hover:text-ivory"
      >
        <IconArrowLeft size={13} />
        All launches
      </Link>

      <div className="grid grid-cols-[1fr_360px] items-start gap-6 max-[900px]:grid-cols-1">
        <div className="flex min-w-0 flex-col gap-6">
          <SaleHeader p={p} />

          <section className="panel p-6 max-[640px]:p-5">
            <div
              className="mb-5 flex items-center gap-6 border-b border-line"
              role="tablist"
              aria-label="Project details"
            >
              {tabs.map((t) => (
                <button
                  key={t.key}
                  role="tab"
                  aria-selected={tab === t.key}
                  className="utab"
                  data-on={tab === t.key}
                  onClick={() => setTab(t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {tab === 'overview' && <Overview p={p} />}
            {tab === 'tokenomics' && <Tokenomics p={p} />}
            {tab === 'vesting' && <Vesting p={p} />}
          </section>

          <PoolInfo p={p} />
        </div>

        <BuyPanel project={p} />
      </div>
    </div>
  );
}

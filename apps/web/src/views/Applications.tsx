import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fmtUsdCompact, type ApplicationStatus, type PublicApplicationDTO } from '@apogee/shared';
import { ChainPill, Skeleton } from '../components/ui';
import { api } from '../lib/api';
import { timeAgo } from '../lib/time';

const STATUS_META: Record<ApplicationStatus, { label: string; cls: string }> = {
  pending: { label: 'Pending', cls: 'pill-upcoming' },
  accepted: { label: 'Approved', cls: 'pill-live' },
  rejected: { label: 'Rejected', cls: 'pill-red' },
};

const FILTERS = ['all', 'pending', 'accepted', 'rejected'] as const;
type Filter = (typeof FILTERS)[number];
const FILTER_LABEL: Record<Filter, string> = {
  all: 'All',
  pending: 'Pending',
  accepted: 'Approved',
  rejected: 'Rejected',
};

function LogoThumb({ app }: { app: PublicApplicationDTO }) {
  if (app.logo) {
    return (
      <img
        src={app.logo}
        alt=""
        loading="lazy"
        className="h-10 w-10 flex-none rounded-xl border border-line object-cover"
        onError={(e) => {
          e.currentTarget.style.display = 'none';
        }}
      />
    );
  }
  return (
    <div className="flex h-10 w-10 flex-none items-center justify-center rounded-xl border border-line bg-panel2 text-[15px] font-semibold text-gold">
      {app.projectName.charAt(0).toUpperCase()}
    </div>
  );
}

function ApplicationCard({ app }: { app: PublicApplicationDTO }) {
  const status = STATUS_META[app.status];
  return (
    <section className="panel flex flex-col p-5">
      <div className="flex items-center gap-3">
        <LogoThumb app={app} />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-[14px] font-semibold text-ivory">{app.projectName}</span>
            <span className="num text-[11px] text-faint">{app.ticker}</span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <ChainPill chain={app.chain} />
            {app.raiseTarget > 0 && <span className="pill pill-gold">{fmtUsdCompact(app.raiseTarget)}</span>}
          </div>
        </div>
        <span className={`pill ${status.cls} ml-auto`}>{status.label}</span>
      </div>

      <p className="mt-3 line-clamp-3 text-[12.5px] leading-relaxed text-muted">{app.pitch}</p>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-line pt-3 text-[12px]">
        <a
          href={app.website}
          target="_blank"
          rel="noreferrer noopener"
          className="text-gold hover:underline"
        >
          Website
        </a>
        {app.x && (
          <a href={app.x} target="_blank" rel="noreferrer noopener" className="text-muted hover:text-ivory">
            X
          </a>
        )}
        {app.telegram && (
          <a href={app.telegram} target="_blank" rel="noreferrer noopener" className="text-muted hover:text-ivory">
            Telegram
          </a>
        )}
        <span className="num ml-auto text-[10.5px] text-faint">{timeAgo(app.ts)}</span>
      </div>
    </section>
  );
}

export function Applications() {
  const [filter, setFilter] = useState<Filter>('all');
  const q = useQuery({
    queryKey: ['public-applications'],
    queryFn: () => api.applications().then((r) => r.applications),
  });

  const all = q.data ?? [];
  const counts: Record<Filter, number> = {
    all: all.length,
    pending: all.filter((a) => a.status === 'pending').length,
    accepted: all.filter((a) => a.status === 'accepted').length,
    rejected: all.filter((a) => a.status === 'rejected').length,
  };
  const rows = filter === 'all' ? all : all.filter((a) => a.status === filter);

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-[24px] font-semibold tracking-tight text-ivory">Applications</h1>
      <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-muted">
        Projects that applied to launch on Apoge, and where each stands in review. Want your token
        here?{' '}
        <a href="/apply" className="text-gold hover:underline">
          Apply for launch
        </a>
        .
      </p>

      <div className="mt-5 flex items-center gap-1 self-start rounded-xl border border-line bg-panel p-1">
        {FILTERS.map((f) => (
          <button key={f} className="tab" data-on={filter === f} onClick={() => setFilter(f)}>
            {FILTER_LABEL[f]}
            <span className="num ml-1.5 text-[10px] text-faint">{counts[f]}</span>
          </button>
        ))}
      </div>

      {q.isLoading ? (
        <div className="mt-5 grid grid-cols-2 gap-4 max-[720px]:grid-cols-1">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[190px] !rounded-2xl" />
          ))}
        </div>
      ) : q.isError ? (
        <div className="panel mt-5 p-10 text-center text-[13px] text-muted">
          Couldn’t load applications.{' '}
          <button className="text-gold hover:underline" onClick={() => q.refetch()}>
            Retry
          </button>
        </div>
      ) : rows.length === 0 ? (
        <div className="panel mt-5 p-10 text-center text-[13px] text-muted">
          {all.length === 0 ? 'No applications yet — be the first to apply.' : `No ${FILTER_LABEL[filter].toLowerCase()} applications.`}
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-4 max-[720px]:grid-cols-1">
          {rows.map((a) => (
            <ApplicationCard key={a.id} app={a} />
          ))}
        </div>
      )}
    </div>
  );
}

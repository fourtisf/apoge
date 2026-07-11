import { useMemo, useState } from 'react';
import {
  CHAIN_META,
  fmtNumCompact,
  fmtUsdCompact,
  type Chain,
  type Project,
} from '@apogee/shared';
import { ActivityFeed } from '../components/ActivityFeed';
import { FeaturedSale } from '../components/FeaturedSale';
import { ProjectCard } from '../components/ProjectCard';
import { TierCard } from '../components/TierCard';
import { Skeleton, SpotlightCard } from '../components/ui';
import { useProjects, useStats } from '../lib/queries';
import { useUi } from '../state/store';

type Tab = 'all' | 'live' | 'upcoming' | 'ended';

const TABS: { key: Tab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'live', label: 'Live' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'ended', label: 'Ended' },
];

const CHAINS = Object.keys(CHAIN_META) as Chain[];

/* ── Stat tiles ───────────────────────────────────────────────────── */

function StatTiles() {
  const { data: stats, isLoading } = useStats();

  const tiles = [
    { label: 'Total raised', value: stats ? fmtUsdCompact(stats.totalRaised) : '—' },
    { label: 'Participants', value: stats ? fmtNumCompact(stats.totalParticipants) : '—' },
    { label: 'Projects launched', value: stats ? String(stats.projectsLaunched) : '—' },
    { label: 'Avg ROI', value: stats ? `${stats.avgRoi}×` : '—' },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-4 gap-4 max-[900px]:grid-cols-2">
        {tiles.map((t) => (
          <Skeleton key={t.label} className="h-[86px] !rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-4 gap-4 max-[900px]:grid-cols-2">
      {tiles.map((t, i) => (
        <SpotlightCard key={t.label} className="card p-4.5 !py-4 px-5">
          <div className="label">{t.label}</div>
          <div className={`num mt-1.5 text-[22px] font-medium ${i === 3 ? 'text-mint' : 'text-ivory'}`}>
            {t.value}
          </div>
        </SpotlightCard>
      ))}
    </div>
  );
}

/* ── Home ─────────────────────────────────────────────────────────── */

export function Home() {
  const [tab, setTab] = useState<Tab>('all');
  const [chains, setChains] = useState<Set<Chain>>(new Set());
  const search = useUi((s) => s.search);
  const { data: projects, isLoading, isError, refetch } = useProjects();

  const featured = useMemo(() => {
    const live = (projects ?? []).filter((p) => p.status === 'live' && p.endAt);
    return live.sort((a, b) => new Date(a.endAt!).getTime() - new Date(b.endAt!).getTime())[0];
  }, [projects]);

  const filtered = useMemo(() => {
    let list: Project[] = projects ?? [];
    if (tab === 'live') list = list.filter((p) => p.status === 'live');
    else if (tab === 'upcoming') list = list.filter((p) => p.status === 'upcoming' || p.status === 'tba');
    else if (tab === 'ended') list = list.filter((p) => p.status === 'ended');
    if (chains.size > 0) list = list.filter((p) => chains.has(p.chain));
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.ticker.toLowerCase().includes(q) ||
          p.sector.toLowerCase().includes(q),
      );
    }
    return list;
  }, [projects, tab, chains, search]);

  const toggleChain = (c: Chain) =>
    setChains((prev) => {
      const nextSet = new Set(prev);
      if (nextSet.has(c)) nextSet.delete(c);
      else nextSet.add(c);
      return nextSet;
    });

  return (
    <div className="grid grid-cols-[1fr_300px] gap-6 max-[1180px]:grid-cols-1">
      <div className="flex min-w-0 flex-col gap-6">
        <StatTiles />

        {isLoading ? (
          <Skeleton className="h-[240px] !rounded-2xl" />
        ) : (
          featured && <FeaturedSale project={featured} />
        )}

        <div className="flex flex-wrap items-center gap-2">
          <div
            className="flex items-center gap-1 rounded-xl border border-line bg-panel p-1"
            role="tablist"
            aria-label="Filter by status"
          >
            {TABS.map((t) => (
              <button
                key={t.key}
                role="tab"
                aria-selected={tab === t.key}
                className="tab"
                data-on={tab === t.key}
                onClick={() => setTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-1.5 max-[640px]:ml-0">
            {CHAINS.map((c) => (
              <button
                key={c}
                className="pill chip"
                data-on={chains.has(c)}
                onClick={() => toggleChain(c)}
                aria-pressed={chains.has(c)}
              >
                <span className="dot" style={{ background: CHAIN_META[c].color }} />
                {c}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[220px] !rounded-2xl" />
            ))}
          </div>
        ) : isError ? (
          <div className="panel flex flex-col items-center gap-3 p-10 text-center">
            <p className="text-[13.5px] text-muted">Couldn’t load projects.</p>
            <button className="btn btn-ghost" onClick={() => refetch()}>
              Retry
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="panel p-10 text-center">
            <p className="text-[13.5px] text-muted">No projects match these filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
            {filtered.map((p) => (
              <ProjectCard key={p.slug} project={p} />
            ))}
          </div>
        )}
      </div>

      <aside className="flex flex-col gap-5 max-[1180px]:grid max-[1180px]:grid-cols-2 max-[640px]:grid-cols-1">
        <TierCard />
        <ActivityFeed />
      </aside>
    </div>
  );
}

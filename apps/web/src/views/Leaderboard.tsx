import { useQuery } from '@tanstack/react-query';
import { fmtNum, fmtUsd, TIERS } from '@apogee/shared';
import { Skeleton } from '../components/ui';
import { api } from '../lib/api';

/** Gold / silver / bronze rank badges for the podium, muted after. */
function RankBadge({ rank }: { rank: number }) {
  const podium =
    rank === 1
      ? 'bg-gold/20 text-gold-hi border-gold/40'
      : rank === 2
        ? 'bg-[#98948B]/15 text-[#C9C5BC] border-[#98948B]/35'
        : rank === 3
          ? 'bg-[#8A6A3B]/20 text-[#C9A366] border-[#8A6A3B]/40'
          : 'border-transparent text-faint';
  return (
    <span
      className={`num flex h-6 w-6 flex-none items-center justify-center rounded-md border text-[11px] ${podium}`}
    >
      {rank}
    </span>
  );
}

export function Leaderboard() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: () => api.leaderboard(),
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-5 max-[900px]:grid-cols-1">
        <Skeleton className="h-[420px] !rounded-2xl" />
        <Skeleton className="h-[420px] !rounded-2xl" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="panel mx-auto max-w-md p-10 text-center">
        <p className="text-[13.5px] text-muted">Couldn’t load the leaderboard.</p>
        <button className="btn btn-ghost mt-4" onClick={() => refetch()}>
          Retry
        </button>
      </div>
    );
  }

  const tierPill = (key: string | null) => {
    const tier = TIERS.find((t) => t.key === key);
    return tier ? <span className="pill pill-gold !text-[9px]">{tier.name}</span> : null;
  };

  return (
    <div className="grid grid-cols-2 items-start gap-5 max-[900px]:grid-cols-1">
      <section className="panel overflow-hidden" aria-label="Top stakers">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-[13.5px] font-semibold text-ivory">Top stakers</h2>
          <p className="mt-0.5 text-[11px] text-faint">Largest APG orbits on the platform</p>
        </div>
        {data.stakers.length === 0 ? (
          <p className="p-8 text-center text-[12.5px] text-faint">No stakers yet — be the first.</p>
        ) : (
          <ul>
            {data.stakers.map((s, i) => (
              <li
                key={`${s.wallet}-${i}`}
                className="flex items-center gap-3 border-b border-line px-5 py-3 last:border-0"
              >
                <RankBadge rank={i + 1} />
                <span className="num flex-1 text-[12.5px] text-ivory">{s.wallet}</span>
                {tierPill(s.tierKey)}
                <span className="num text-[12.5px] text-gold">{fmtNum(s.staked)} APG</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel overflow-hidden" aria-label="Top buyers">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-[13.5px] font-semibold text-ivory">Top buyers</h2>
          <p className="mt-0.5 text-[11px] text-faint">Most invested across all sales</p>
        </div>
        {data.buyers.length === 0 ? (
          <p className="p-8 text-center text-[12.5px] text-faint">No purchases yet.</p>
        ) : (
          <ul>
            {data.buyers.map((b, i) => (
              <li
                key={`${b.wallet}-${i}`}
                className="flex items-center gap-3 border-b border-line px-5 py-3 last:border-0"
              >
                <RankBadge rank={i + 1} />
                <span className="num flex-1 text-[12.5px] text-ivory">{b.wallet}</span>
                <span className="text-[10.5px] text-faint">
                  {b.buys} buy{b.buys === 1 ? '' : 's'}
                </span>
                <span className="num text-[12.5px] text-mint">{fmtUsd(b.invested)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

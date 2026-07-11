import { fmtUsd } from '@apogee/shared';
import { useActivity } from '../lib/queries';
import { timeAgo } from '../lib/time';
import { Skeleton, useNow } from './ui';

/** Live purchase ticker — socket-fed via the shared query cache. */
export function ActivityFeed() {
  const { data: events, isLoading } = useActivity();
  const now = useNow(30_000);

  return (
    <section className="panel p-5" aria-label="Live activity">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-[13.5px] font-semibold text-ivory">Live activity</h3>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-mint" />
          <span className="label !text-mint">Live</span>
        </span>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-9" />
          ))}
        </div>
      ) : !events?.length ? (
        <p className="py-6 text-center text-[12.5px] text-faint">No purchases yet. Be the first.</p>
      ) : (
        <ul className="flex flex-col">
          {events.map((ev) => (
            <li
              key={ev.id}
              className="feed-item flex items-center gap-2.5 border-b border-line py-2.5 last:border-0"
            >
              <span className="num flex-none text-[11.5px] text-muted">{ev.wallet}</span>
              <span className="min-w-0 flex-1 truncate text-[11.5px] text-faint">
                bought <span className="num text-ivory">{fmtUsd(ev.amountUsd)}</span>{' '}
                <span className="num text-gold">{ev.ticker}</span>
              </span>
              <span className="num flex-none text-[10.5px] text-faint">{timeAgo(ev.ts, now)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

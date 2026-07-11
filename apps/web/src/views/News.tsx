import { useQuery } from '@tanstack/react-query';
import type { AnnouncementDTO } from '@apogee/shared';
import { Skeleton } from '../components/ui';
import { api } from '../lib/api';
import { timeAgo } from '../lib/time';

const TAG_STYLE: Record<AnnouncementDTO['tag'], string> = {
  news: 'pill-gold',
  update: '!text-mint',
  alert: '!text-red',
};

export function News() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['news'],
    queryFn: () => api.news().then((r) => r.announcements),
    refetchInterval: 120_000,
  });

  if (isLoading) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-[110px] !rounded-2xl" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="panel mx-auto max-w-md p-10 text-center">
        <p className="text-[13.5px] text-muted">Couldn’t load announcements.</p>
        <button className="btn btn-ghost mt-4" onClick={() => refetch()}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-[24px] font-semibold tracking-tight text-ivory">News</h1>
      <p className="mt-1 text-[12.5px] text-muted">
        Launch schedules, TGE dates and platform updates — straight from the team.
      </p>

      {(data ?? []).length === 0 ? (
        <div className="panel mt-5 p-10 text-center">
          <p className="text-[13px] text-muted">Nothing announced yet. Watch this space.</p>
        </div>
      ) : (
        <div className="mt-5 flex flex-col gap-4">
          {data!.map((a) => (
            <article key={a.id} className="panel p-5">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className={`pill ${TAG_STYLE[a.tag]}`}>{a.tag}</span>
                <h2 className="text-[14.5px] font-semibold text-ivory">{a.title}</h2>
                <span className="num ml-auto text-[10.5px] text-faint">{timeAgo(a.ts)}</span>
              </div>
              <p className="mt-2.5 whitespace-pre-line text-[13px] leading-relaxed text-muted">
                {a.body}
              </p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

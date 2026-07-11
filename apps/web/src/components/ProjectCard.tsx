import { Link } from 'react-router-dom';
import {
  fmtNumCompact,
  fmtPct,
  fmtPrice,
  fmtUsdCompact,
  type Project,
} from '@apogee/shared';
import { ChainPill, Countdown, LogoTile, ProgressBar, SpotlightCard, StatusPill } from './ui';

export function ProjectCard({ project }: { project: Project }) {
  const p = project;
  const pct = p.hardCap > 0 ? (p.raised / p.hardCap) * 100 : 0;

  return (
    <Link to={`/sale/${p.slug}`} className="block">
      <SpotlightCard className="card flex h-full flex-col gap-3.5 p-5">
        <div className="flex items-start gap-3">
          <LogoTile logo={p.logo} size={42} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-[15px] font-semibold text-ivory">{p.name}</span>
              <span className="num text-[11px] text-faint">{p.ticker}</span>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <ChainPill chain={p.chain} />
              <span className="pill">{p.sector}</span>
            </div>
          </div>
          <StatusPill status={p.status} />
        </div>

        <p className="line-clamp-2 min-h-[2.6em] text-[12.5px] leading-relaxed text-muted">
          {p.description}
        </p>

        {p.status === 'live' && (
          <div className="mt-auto flex flex-col gap-2">
            <div className="flex items-baseline justify-between text-[12px]">
              <span className="num text-ivory">{fmtUsdCompact(p.raised)}</span>
              <span className="num text-faint">
                of {fmtUsdCompact(p.hardCap)} · <span className="text-gold">{fmtPct(pct)}</span>
              </span>
            </div>
            <ProgressBar pct={pct} thin />
            <div className="flex items-center justify-between pt-1 text-[11.5px]">
              <span className="text-faint">
                Price <span className="num text-muted">{fmtPrice(p.price)}</span>
              </span>
              {p.endAt && (
                <span className="text-faint">
                  Ends in <Countdown target={p.endAt} className="text-ivory" />
                </span>
              )}
            </div>
          </div>
        )}

        {p.status === 'upcoming' && (
          <div className="mt-auto flex flex-col gap-2">
            <div className="kv !border-0 !py-1">
              <span className="k text-[11.5px]">Starts in</span>
              {p.startAt ? (
                <Countdown target={p.startAt} className="text-[12.5px] text-gold" />
              ) : (
                <span className="num text-[12.5px] text-muted">TBA</span>
              )}
            </div>
            <div className="flex items-center justify-between border-t border-line pt-2.5 text-[11.5px]">
              <span className="text-faint">
                Price <span className="num text-muted">{fmtPrice(p.price)}</span>
              </span>
              <span className="text-faint">
                Raise <span className="num text-muted">{fmtUsdCompact(p.hardCap)}</span>
              </span>
            </div>
          </div>
        )}

        {p.status === 'tba' && (
          <div className="mt-auto flex flex-col gap-2">
            <div className="kv !border-0 !py-1">
              <span className="k text-[11.5px]">Sale window</span>
              <span className="num text-[12.5px] tracking-widest text-faint">TBA</span>
            </div>
            <div className="flex items-center justify-between border-t border-line pt-2.5 text-[11.5px]">
              <span className="text-faint">
                Price <span className="num text-muted">{fmtPrice(p.price)}</span>
              </span>
              <span className="text-faint">
                Raise <span className="num text-muted">{fmtUsdCompact(p.hardCap)}</span>
              </span>
            </div>
          </div>
        )}

        {p.status === 'ended' && (
          <div className="mt-auto flex flex-col gap-2.5">
            <div className="flex items-baseline justify-between text-[12px]">
              <span className="num text-ivory">{fmtUsdCompact(p.raised)} raised</span>
              <span className="num text-faint">{fmtNumCompact(p.participants)} backers</span>
            </div>
            <div className="flex items-center gap-1.5 border-t border-line pt-2.5">
              {p.roi !== undefined && (
                <span className="pill !text-mint" style={{ borderColor: 'rgba(61,214,140,.25)' }}>
                  ROI {p.roi}×
                </span>
              )}
              {p.ath !== undefined && <span className="pill">ATH {p.ath}×</span>}
              {p.cex?.slice(0, 2).map((c) => (
                <span key={c} className="pill max-[640px]:hidden">
                  {c}
                </span>
              ))}
            </div>
          </div>
        )}
      </SpotlightCard>
    </Link>
  );
}

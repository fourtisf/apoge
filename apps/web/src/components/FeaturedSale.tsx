import { Link } from 'react-router-dom';
import {
  fmtNum,
  fmtPct,
  fmtPrice,
  fmtUsd,
  type Project,
} from '@apogee/shared';
import { ChainPill, Countdown, LogoTile, ProgressBar, StatusPill } from './ui';

/** The gold-foil hero strip for the flagship live sale. */
export function FeaturedSale({ project }: { project: Project }) {
  const p = project;
  const pct = p.hardCap > 0 ? (p.raised / p.hardCap) * 100 : 0;

  return (
    <section
      aria-label={`Featured sale: ${p.name}`}
      className="panel foil relative overflow-hidden p-6 max-[640px]:p-5"
      style={{
        background:
          'linear-gradient(120deg, rgba(201,163,102,.09), rgba(201,163,102,.02) 45%, transparent 70%), linear-gradient(180deg, rgba(255,255,255,.015), transparent 40%), #0F1116',
        borderColor: 'rgba(201,163,102,.22)',
      }}
    >
      <div className="label mb-4 text-gold">Featured launch</div>

      <div className="flex flex-wrap items-center gap-x-8 gap-y-5">
        <div className="flex min-w-[240px] flex-1 items-center gap-4">
          <LogoTile logo={p.logo} size={56} radius={14} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-xl font-semibold tracking-tight text-ivory">{p.name}</h2>
              <span className="num text-xs text-faint">{p.ticker}</span>
              <StatusPill status={p.status} />
              <ChainPill chain={p.chain} />
            </div>
            <p className="mt-1.5 line-clamp-2 max-w-[480px] text-[12.5px] leading-relaxed text-muted">
              {p.description}
            </p>
          </div>
        </div>

        <div className="flex flex-none flex-wrap items-center gap-x-8 gap-y-4">
          {p.endAt && (
            <div>
              <div className="label mb-1.5">Ends in</div>
              <Countdown target={p.endAt} className="text-[22px] font-medium text-ivory" />
            </div>
          )}
          <div>
            <div className="label mb-1.5">Price</div>
            <div className="num text-[22px] font-medium text-ivory">{fmtPrice(p.price)}</div>
          </div>
          <div className="max-[640px]:hidden">
            <div className="label mb-1.5">Participants</div>
            <div className="num text-[22px] font-medium text-ivory">{fmtNum(p.participants)}</div>
          </div>
          <Link to={`/sale/${p.slug}`} className="btn btn-gold !px-6 !py-3">
            View sale
          </Link>
        </div>
      </div>

      <div className="mt-6">
        <div className="mb-2 flex items-baseline justify-between text-[12.5px]">
          <span>
            <span className="num text-ivory">{fmtUsd(p.raised)}</span>
            <span className="text-faint"> raised of </span>
            <span className="num text-muted">{fmtUsd(p.hardCap)}</span>
          </span>
          <span className="num text-gold">{fmtPct(pct)}</span>
        </div>
        <ProgressBar pct={pct} />
      </div>
    </section>
  );
}

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CHAIN_META,
  fmtNum,
  fmtUsdCompact,
  TIERS,
  type StatsDetailDTO,
} from '@apogee/shared';
import { Skeleton, SpotlightCard } from '../components/ui';
import { api } from '../lib/api';

/* Chart palette — validated (dataviz six checks, dark surface #0F1116):
 * fixed order SOL, ETH, BNB, BASE; BNB uses a darker chart step of the
 * brand hue so it sits in the lightness band. Identity is never
 * color-alone: every bar is direct-labeled. */
const CHART_CHAIN: Record<string, string> = {
  SOL: '#9945FF',
  ETH: '#627EEA',
  BNB: '#B8880A',
  BASE: '#3773F5',
};
/* Sequential gold ramp for the ordered tier ladder. */
const TIER_RAMP = ['#8A6A3B', '#A98449', '#C9A366', '#EAD1A2'];

interface Tip {
  x: number;
  y: number;
  label: string;
  value: string;
}

function ChartCard({
  title,
  sub,
  children,
}: {
  title: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <SpotlightCard className="card p-5">
      <h2 className="text-[13.5px] font-semibold text-ivory">{title}</h2>
      {sub && <p className="mt-0.5 text-[11px] text-faint">{sub}</p>}
      <div className="relative mt-4">{children}</div>
    </SpotlightCard>
  );
}

function Tooltip({ tip }: { tip: Tip | null }) {
  if (!tip) return null;
  return (
    <div
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-line-strong bg-panel3 px-2.5 py-1.5 shadow-lg"
      style={{ left: tip.x, top: tip.y - 8 }}
    >
      <div className="text-[10.5px] text-faint">{tip.label}</div>
      <div className="num text-[12px] text-ivory">{tip.value}</div>
    </div>
  );
}

/* ── Horizontal bar rows (magnitude by category) ──────────────────── */

function BarRows({
  rows,
}: {
  rows: { label: string; sublabel?: string; value: number; display: string; color: string }[];
}) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className="flex flex-col gap-3">
      {rows.map((r) => (
        <div key={r.label} className="group">
          <div className="mb-1 flex items-baseline justify-between text-[11.5px]">
            <span className="text-muted">
              {r.label}
              {r.sublabel && <span className="text-faint"> · {r.sublabel}</span>}
            </span>
            <span className="num text-ivory">{r.display}</span>
          </div>
          <div className="h-[10px] rounded-full bg-panel3">
            <div
              className="h-full rounded-full transition-all duration-700 group-hover:brightness-125"
              style={{
                width: r.value === 0 ? 0 : `${Math.max(1.5, (r.value / max) * 100)}%`,
                background: r.color,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Volume line (change over time, single gold series) ───────────── */

function VolumeLine({ data }: { data: StatsDetailDTO['volumeByDay'] }) {
  const [tip, setTip] = useState<Tip | null>(null);
  const W = 520;
  const H = 150;
  const PAD = { l: 8, r: 8, t: 12, b: 22 };
  const max = Math.max(...data.map((d) => d.volume), 1);
  const x = (i: number) => PAD.l + (i * (W - PAD.l - PAD.r)) / Math.max(1, data.length - 1);
  const y = (v: number) => H - PAD.b - (v / max) * (H - PAD.t - PAD.b);
  const points = data.map((d, i) => [x(i), y(d.volume)] as const);
  const path = points.map(([px, py], i) => `${i === 0 ? 'M' : 'L'}${px},${py}`).join(' ');
  const area = `${path} L${points.at(-1)![0]},${H - PAD.b} L${points[0]![0]},${H - PAD.b} Z`;

  return (
    <>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="Buy volume per day, last 7 days"
      >
        {[0.5, 1].map((f) => (
          <line
            key={f}
            x1={PAD.l}
            x2={W - PAD.r}
            y1={y(max * f)}
            y2={y(max * f)}
            stroke="rgba(240,238,230,.06)"
            strokeWidth="1"
          />
        ))}
        <path d={area} fill="rgba(201,163,102,.12)" />
        <path d={path} fill="none" stroke="#C9A366" strokeWidth="2" strokeLinejoin="round" />
        {points.map(([px, py], i) => (
          <g key={data[i]!.day}>
            {/* generous invisible hit target, small visible dot */}
            <circle
              cx={px}
              cy={py}
              r="12"
              fill="transparent"
              onMouseEnter={(e) => {
                const rect = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                setTip({
                  x: (px / W) * rect.width,
                  y: (py / H) * rect.height,
                  label: `${data[i]!.day} · ${data[i]!.buys} buys`,
                  value: fmtUsdCompact(data[i]!.volume),
                });
              }}
              onMouseLeave={() => setTip(null)}
            />
            <circle cx={px} cy={py} r={i === data.length - 1 ? 4 : 2.5} fill="#EAD1A2" />
          </g>
        ))}
        {data.map((d, i) => (
          <text
            key={d.day}
            x={x(i)}
            y={H - 6}
            textAnchor="middle"
            className="fill-[#5E5A52]"
            fontSize="9"
            fontFamily="Geist Mono, monospace"
          >
            {d.day.slice(5)}
          </text>
        ))}
        {/* direct label on the last point only — flips below when near the top edge */}
        <text
          x={points.at(-1)![0] - 8}
          y={points.at(-1)![1] < 34 ? points.at(-1)![1] + 20 : points.at(-1)![1] - 10}
          textAnchor="end"
          className="fill-[#F2F0EA]"
          fontSize="11"
          fontFamily="Geist Mono, monospace"
        >
          {fmtUsdCompact(data.at(-1)!.volume)}
        </text>
      </svg>
      <Tooltip tip={tip} />
      <details className="mt-2">
        <summary className="cursor-pointer text-[10.5px] text-faint hover:text-muted">
          View as table
        </summary>
        <table className="tbl mt-2">
          <thead>
            <tr>
              <th>Day</th>
              <th>Volume</th>
              <th>Buys</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.day}>
                <td className="num">{d.day}</td>
                <td className="num">{fmtUsdCompact(d.volume)}</td>
                <td className="num">{d.buys}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </>
  );
}

/* ── View ─────────────────────────────────────────────────────────── */

export function Stats() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['stats-detail'],
    queryFn: () => api.statsDetail().then((r) => r.detail),
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-5 max-[900px]:grid-cols-1">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[240px] !rounded-2xl" />
        ))}
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="panel mx-auto max-w-md p-10 text-center">
        <p className="text-[13.5px] text-muted">Couldn’t load analytics.</p>
        <button className="btn btn-ghost mt-4" onClick={() => refetch()}>
          Retry
        </button>
      </div>
    );
  }

  const tierName = (key: string) => TIERS.find((t) => t.key === key)?.name ?? key;

  return (
    <div className="grid grid-cols-2 items-start gap-5 max-[900px]:grid-cols-1">
      <ChartCard title="Raised by chain" sub="All launches, lifetime">
        <BarRows
          rows={data.byChain.map((c) => ({
            label: CHAIN_META[c.chain].label,
            sublabel: `${c.projects} launch${c.projects === 1 ? '' : 'es'}`,
            value: c.raised,
            display: fmtUsdCompact(c.raised),
            color: CHART_CHAIN[c.chain] ?? '#C9A366',
          }))}
        />
      </ChartCard>

      <ChartCard title="Buy volume" sub="Last 7 days, all sales">
        <VolumeLine data={data.volumeByDay} />
      </ChartCard>

      <ChartCard title="ROI of ended launches" sub="Listing return vs. sale price">
        {data.endedRoi.length === 0 ? (
          <p className="py-6 text-center text-[12px] text-faint">No ended launches yet.</p>
        ) : (
          <BarRows
            rows={data.endedRoi.map((p) => ({
              label: p.name,
              sublabel: p.ath ? `ATH ${p.ath}×` : undefined,
              value: p.roi,
              display: `${p.roi}×`,
              color: '#C9A366',
            }))}
          />
        )}
      </ChartCard>

      <ChartCard title="Stakers by orbit" sub="Wallets holding each tier">
        {data.tierDistribution.every((t) => t.count === 0) ? (
          <p className="py-6 text-center text-[12px] text-faint">No stakers yet — be the first.</p>
        ) : (
          <BarRows
            rows={data.tierDistribution.map((t, i) => ({
              label: tierName(t.tierKey),
              value: t.count,
              display: fmtNum(t.count),
              color: TIER_RAMP[i] ?? '#C9A366',
            }))}
          />
        )}
      </ChartCard>
    </div>
  );
}

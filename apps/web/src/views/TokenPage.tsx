import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  fmtNum,
  ONCHAIN_CHAINS,
  STAKING_APR_PCT,
  TIERS,
  truncAddr,
  type OnchainConfig,
} from '@apogee/shared';
import { IconCheck, IconCoin, IconCopy, IconOrbit } from '../components/icons';
import { SpotlightCard, useCopy } from '../components/ui';

/** APG allocation plan (Phase 2 publishes the final on-chain schedule). */
const APG_ALLOCATION = [
  { label: 'Staking Rewards', pct: 30, color: '#C9A366' },
  { label: 'Ecosystem & Grants', pct: 20, color: '#EAD1A2' },
  { label: 'Liquidity', pct: 15, color: '#8A6A3B' },
  { label: 'Team · 24mo vest', pct: 15, color: '#98948B' },
  { label: 'Treasury', pct: 15, color: '#5E5A52' },
  { label: 'Public Rounds', pct: 5, color: '#3DD68C' },
];

function ContractRow({ chainId, address }: { chainId: string; address: string }) {
  const [copied, copy] = useCopy();
  const info = ONCHAIN_CHAINS[Number(chainId)];
  return (
    <div className="kv">
      <span className="k text-[12px]">{info?.name ?? `Chain ${chainId}`}</span>
      <button
        onClick={() => copy(address)}
        className="num flex items-center gap-1.5 text-[11.5px] text-muted transition-colors hover:text-gold"
      >
        {truncAddr(address, 8, 6)}
        {copied ? <IconCheck size={11} className="text-mint" /> : <IconCopy size={11} />}
      </button>
    </div>
  );
}

export function TokenPage() {
  const { data } = useQuery({
    queryKey: ['onchain-config'],
    queryFn: async () => {
      const res = await fetch('/api/onchain/config');
      return (await res.json()) as { chains: OnchainConfig };
    },
    staleTime: 5 * 60_000,
  });
  const chains = Object.entries(data?.chains ?? {}).filter(([, c]) => c.apg);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      {/* Hero */}
      <section className="panel foil p-7 max-[640px]:p-5" style={{ borderColor: 'rgba(201,163,102,.22)' }}>
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gold/10 text-gold">
            <IconCoin size={28} />
          </div>
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight text-ivory">
              APG <span className="text-[13px] font-normal text-faint">· the Apogee token</span>
            </h1>
            <p className="mt-1 text-[12.5px] text-muted">
              One token, one job: your stake is your seat at every launch.
            </p>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-3 gap-4 max-[640px]:grid-cols-1">
          {[
            ['Total supply', '1,000,000,000', 'fixed — no mint function exists'],
            ['Staking APR', `${STAKING_APR_PCT}%`, 'paid to stakers'],
            ['Utility', 'Tier access', 'allocation weight + fee discounts'],
          ].map(([k, v, sub]) => (
            <div key={k}>
              <div className="label">{k}</div>
              <div className="num mt-1 text-[19px] font-medium text-ivory">{v}</div>
              <div className="mt-0.5 text-[10.5px] text-faint">{sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Allocation */}
      <SpotlightCard className="card p-6 max-[640px]:p-5">
        <h2 className="text-[14px] font-semibold text-ivory">Allocation</h2>
        <div className="mt-4 flex h-3.5 w-full gap-[2px] overflow-hidden rounded-full">
          {APG_ALLOCATION.map((a) => (
            <div key={a.label} style={{ width: `${a.pct}%`, background: a.color }} title={`${a.label} ${a.pct}%`} />
          ))}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-1 max-[640px]:grid-cols-1">
          {APG_ALLOCATION.map((a) => (
            <div key={a.label} className="kv">
              <span className="flex items-center gap-2.5 text-[12.5px] text-muted">
                <span className="h-2.5 w-2.5 flex-none rounded-[3px]" style={{ background: a.color }} />
                {a.label}
              </span>
              <span className="num text-[12.5px] text-ivory">{a.pct}%</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[10.5px] leading-relaxed text-faint">
          Planned distribution — the final on-chain vesting schedule is published at TGE (Phase 2).
        </p>
      </SpotlightCard>

      {/* Tier utility */}
      <SpotlightCard className="card overflow-x-auto p-0">
        <div className="px-6 pb-2 pt-5">
          <h2 className="text-[14px] font-semibold text-ivory">What staking APG unlocks</h2>
        </div>
        <table className="tbl min-w-[480px]">
          <thead>
            <tr>
              <th>Tier</th>
              <th>Stake</th>
              <th>Allocation</th>
              <th>Max buy</th>
              <th>Fee</th>
            </tr>
          </thead>
          <tbody>
            {TIERS.map((t) => (
              <tr key={t.key}>
                <td className="num text-ivory">{t.name}</td>
                <td className="num text-muted">{fmtNum(t.minStake)}</td>
                <td className="num text-muted">{t.multiplier}</td>
                <td className="num text-muted">${fmtNum(t.maxBuyUsd)}</td>
                <td className="num text-muted">{t.feePct}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </SpotlightCard>

      {/* Contracts */}
      <SpotlightCard className="card p-6 max-[640px]:p-5">
        <h2 className="text-[14px] font-semibold text-ivory">Token contracts</h2>
        {chains.length === 0 ? (
          <p className="mt-3 text-[12.5px] leading-relaxed text-muted">
            <span className="pill pill-upcoming mr-2">TBA</span>
            APG deploys on-chain with Phase 2 — addresses will be published here and only here.
            Anything claiming to be APG before that is a scam.
          </p>
        ) : (
          <div className="mt-2">
            {chains.map(([chainId, c]) => (
              <ContractRow key={chainId} chainId={chainId} address={c.apg} />
            ))}
          </div>
        )}
      </SpotlightCard>

      <Link to="/staking" className="btn btn-gold self-start !px-6 !py-3">
        <IconOrbit size={15} />
        Stake APG
      </Link>
    </div>
  );
}

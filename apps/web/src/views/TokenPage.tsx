import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  fmtNum,
  ONCHAIN_CHAINS,
  TIERS,
  truncAddr,
  type OnchainConfig,
} from '@apogee/shared';
import {
  IconCheck,
  IconCoin,
  IconCopy,
  IconOrbit,
  IconTelegram,
  IconXSocial,
} from '../components/icons';
import { SpotlightCard, useCopy } from '../components/ui';
import { SOCIAL_LINKS } from '../lib/links';

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
      {/* Teaser hero — the token is NOT live; no numbers, no ticker. */}
      <section
        className="panel foil p-9 text-center max-[640px]:p-6"
        style={{ borderColor: 'rgba(201,163,102,.22)' }}
      >
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gold/10 text-gold">
          <IconCoin size={32} />
        </div>
        <h1 className="mt-5 text-[30px] font-semibold tracking-[0.14em] text-ivory">APOGE</h1>
        <div className="num mt-3 text-[20px] font-medium tracking-[0.18em] text-gold">
          CA · COMING SOON
        </div>
        <p className="mx-auto mt-4 max-w-md text-[12.5px] leading-relaxed text-muted">
          The token is <span className="text-ivory">not live yet</span>. The contract address
          will be announced on our official X and Telegram first — anything claiming to be it
          before then is a scam.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <a
            href={SOCIAL_LINKS.x}
            target="_blank"
            rel="noreferrer noopener"
            className="btn btn-gold !px-6"
          >
            <IconXSocial size={14} />
            Follow on X
          </a>
          <a
            href={SOCIAL_LINKS.telegram}
            target="_blank"
            rel="noreferrer noopener"
            className="btn btn-ghost !px-6"
          >
            <IconTelegram size={14} />
            Join Telegram
          </a>
        </div>
      </section>

      {/* Once deployed, the official addresses appear here automatically. */}
      {chains.length > 0 && (
        <SpotlightCard className="card p-6 max-[640px]:p-5">
          <h2 className="text-[14px] font-semibold text-ivory">Official contract address</h2>
          <div className="mt-2">
            {chains.map(([chainId, c]) => (
              <ContractRow key={chainId} chainId={chainId} address={c.apg} />
            ))}
          </div>
        </SpotlightCard>
      )}

      {/* Platform utility — live product feature, no speculative numbers. */}
      <SpotlightCard className="card overflow-x-auto p-0">
        <div className="px-6 pb-2 pt-5">
          <h2 className="text-[14px] font-semibold text-ivory">What staking unlocks</h2>
          <p className="mt-0.5 text-[11px] text-faint">
            Stake to climb the orbit — your tier sets allocation, max buy and fees on every launch.
          </p>
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

      <Link to="/staking" className="btn btn-gold self-center !px-6 !py-3">
        <IconOrbit size={15} />
        Go to Staking
      </Link>
    </div>
  );
}

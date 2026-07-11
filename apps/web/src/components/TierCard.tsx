import { Link } from 'react-router-dom';
import { fmtNum, nextTier, TIERS } from '@apogee/shared';
import { useWallet } from '../wallet/useWallet';
import { IconOrbit, IconWallet } from './icons';
import { ProgressBar } from './ui';

/** "Your orbit" — the tier summary card in the launchpad right rail. */
export function TierCard() {
  const { account, tier, connect } = useWallet();

  if (!account) {
    return (
      <section className="panel p-5" aria-label="Your orbit">
        <div className="label mb-3">Your orbit</div>
        <p className="text-[12.5px] leading-relaxed text-muted">
          Connect a wallet and stake APG to unlock guaranteed allocations across every launch.
        </p>
        <button onClick={connect} className="btn btn-gold mt-4 w-full">
          <IconWallet size={15} />
          Connect Wallet
        </button>
      </section>
    );
  }

  const staked = account.staked;
  const next = nextTier(staked);
  const floor = tier?.minStake ?? 0;
  const pctToNext = next
    ? Math.min(100, ((staked - floor) / (next.minStake - floor)) * 100)
    : 100;

  return (
    <section className="panel p-5" aria-label="Your orbit">
      <div className="mb-3 flex items-center justify-between">
        <span className="label">Your orbit</span>
        {tier ? <span className="pill pill-gold">{tier.name}</span> : <span className="pill">No tier</span>}
      </div>

      <div className="flex items-baseline gap-2">
        <span className="num text-[24px] font-medium text-ivory">{fmtNum(staked)}</span>
        <span className="text-[11.5px] text-faint">APG staked</span>
      </div>

      <div className="mt-4">
        <ProgressBar pct={pctToNext} thin />
        <div className="mt-2 flex items-center justify-between text-[11px]">
          {next ? (
            <>
              <span className="text-faint">
                Next: <span className="text-gold">{next.name}</span>
              </span>
              <span className="num text-faint">{fmtNum(next.minStake)} APG</span>
            </>
          ) : (
            <span className="text-gold">Maximum orbit reached</span>
          )}
        </div>
      </div>

      {tier && (
        <div className="mt-3 border-t border-line pt-1">
          <div className="kv">
            <span className="k text-[11.5px]">Allocation</span>
            <span className="num text-[12px] text-ivory">{tier.multiplier}</span>
          </div>
          <div className="kv">
            <span className="k text-[11.5px]">Max buy</span>
            <span className="num text-[12px] text-ivory">${fmtNum(tier.maxBuyUsd)}</span>
          </div>
          <div className="kv">
            <span className="k text-[11.5px]">Fee</span>
            <span className="num text-[12px] text-ivory">{tier.feePct}%</span>
          </div>
        </div>
      )}

      {!tier && (
        <p className="mt-3 text-[11.5px] leading-relaxed text-faint">
          Stake at least {fmtNum(TIERS[0]!.minStake)} APG to enter {TIERS[0]!.name}.
        </p>
      )}

      <Link to="/staking" className="btn btn-ghost mt-4 w-full">
        <IconOrbit size={14} />
        Manage staking
      </Link>
    </section>
  );
}

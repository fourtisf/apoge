import { Link } from 'react-router-dom';
import {
  fmtNum2,
  fmtPct,
  fmtPrice,
  fmtUsd,
  fmtUsdCents,
  type PositionDTO,
} from '@apogee/shared';
import { IconRocket, IconWallet } from '../components/icons';
import { ChainPill, LogoTile, ProgressBar, Skeleton, SpotlightCard } from '../components/ui';
import { useClaim, usePortfolio } from '../lib/queries';
import { toast } from '../state/store';
import { useWallet } from '../wallet/useWallet';

function ClaimButton({ position }: { position: PositionDTO }) {
  const claim = useClaim();
  const claimable = position.claimableTokens;

  // On-chain positions are claimed on the sale contract, not via the API —
  // route the user to the sale page's buy panel (which handles claim/refund).
  if (position.onchain) {
    return (
      <Link
        to={`/sale/${position.projectSlug}`}
        className="btn btn-ghost !px-3.5 !py-1.5 !text-[12px]"
        title={claimable > 0 ? 'Claim on-chain' : 'View sale'}
      >
        {claimable > 0 ? 'Claim ↗' : 'View'}
      </Link>
    );
  }

  const onClaim = async () => {
    try {
      const res = await claim.mutateAsync(position.id);
      toast.success(
        'Claimed',
        `${fmtNum2(res.claimedTokens)} ${position.ticker} added to your allocation`,
      );
    } catch (err) {
      toast.error('Claim failed', err instanceof Error ? err.message : undefined);
    }
  };

  return (
    <button
      className="btn btn-gold !px-3.5 !py-1.5 !text-[12px]"
      disabled={claimable <= 0 || claim.isPending}
      onClick={onClaim}
    >
      {claim.isPending ? <span className="spinner" /> : 'Claim'}
    </button>
  );
}

export function Portfolio() {
  const { account, connect } = useWallet();
  const { data, isLoading, isError, refetch } = usePortfolio(account?.wallet ?? null);

  /* Empty state: no wallet. */
  if (!account) {
    return (
      <div className="panel mx-auto mt-10 max-w-md p-10 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gold/10 text-gold">
          <IconWallet size={22} />
        </div>
        <h2 className="mt-4 text-[16px] font-semibold text-ivory">No wallet connected</h2>
        <p className="mt-2 text-[12.5px] leading-relaxed text-muted">
          Connect a wallet to see your allocations, vesting schedules and claimable tokens.
        </p>
        <button onClick={connect} className="btn btn-gold mt-5">
          <IconWallet size={15} />
          Connect Wallet
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-3 gap-4 max-[640px]:grid-cols-1">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[86px] !rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-[280px] !rounded-2xl" />
      </div>
    );
  }

  /* Error state — never masquerade a failed fetch as an empty portfolio. */
  if (isError) {
    return (
      <div className="panel mx-auto mt-10 max-w-md p-10 text-center">
        <h2 className="text-[16px] font-semibold text-ivory">Couldn’t load your portfolio</h2>
        <p className="mt-2 text-[12.5px] leading-relaxed text-muted">
          The API didn’t respond. Your allocations are safe — try again in a moment.
        </p>
        <button onClick={() => refetch()} className="btn btn-ghost mt-5">
          Retry
        </button>
      </div>
    );
  }

  const positions = data?.positions ?? [];
  const summary = data?.summary ?? { invested: 0, estValue: 0, claimableUsd: 0 };

  const tiles = [
    { label: 'Total invested', value: fmtUsd(summary.invested), accent: 'text-ivory' },
    { label: 'Est. value', value: fmtUsd(summary.estValue), accent: 'text-ivory' },
    { label: 'Claimable', value: fmtUsdCents(summary.claimableUsd), accent: 'text-mint' },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-3 gap-4 max-[640px]:grid-cols-1">
        {tiles.map((t) => (
          <SpotlightCard key={t.label} className="card px-5 py-4">
            <div className="label">{t.label}</div>
            <div className={`num mt-1.5 text-[22px] font-medium ${t.accent}`}>{t.value}</div>
          </SpotlightCard>
        ))}
      </div>

      {/* Empty state: wallet, no positions. */}
      {positions.length === 0 ? (
        <div className="panel p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gold/10 text-gold">
            <IconRocket size={22} />
          </div>
          <h2 className="mt-4 text-[16px] font-semibold text-ivory">No allocations yet</h2>
          <p className="mx-auto mt-2 max-w-sm text-[12.5px] leading-relaxed text-muted">
            When you participate in a sale, your allocation, vesting progress and claimable tokens
            show up here.
          </p>
          <Link to="/" className="btn btn-gold mt-5 inline-flex">
            Browse live sales
          </Link>
        </div>
      ) : (
        <section className="panel overflow-x-auto" aria-label="Your allocations">
          <table className="tbl min-w-[760px]">
            <thead>
              <tr>
                <th>Project</th>
                <th>Invested</th>
                <th>Tokens</th>
                <th>Price</th>
                <th className="w-[190px]">Vesting</th>
                <th>Claimable</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {positions.map((pos) => (
                <tr key={pos.id}>
                  <td>
                    <Link to={`/sale/${pos.projectSlug}`} className="flex items-center gap-3">
                      <LogoTile logo={pos.logo} size={34} radius={10} />
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-semibold text-ivory">
                          {pos.projectName}
                        </span>
                        <span className="mt-0.5 flex items-center gap-1.5">
                          <span className="num text-[10.5px] text-faint">{pos.ticker}</span>
                          <ChainPill chain={pos.chain} />
                          {pos.onchain && <span className="pill pill-live !text-[9px]">on-chain</span>}
                        </span>
                      </span>
                    </Link>
                  </td>
                  <td className="num text-ivory">{fmtUsd(pos.invested)}</td>
                  <td className="num text-muted">{fmtNum2(pos.tokens)}</td>
                  <td className="num text-muted">{fmtPrice(pos.price)}</td>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <div className="flex-1">
                        <ProgressBar pct={pos.vestedPct} thin />
                      </div>
                      <span className="num w-11 text-right text-[11px] text-muted">
                        {fmtPct(pos.vestedPct)}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className={`num ${pos.claimableTokens > 0 ? 'text-mint' : 'text-faint'}`}>
                      {fmtNum2(pos.claimableTokens)}
                    </span>
                  </td>
                  <td className="text-right">
                    <ClaimButton position={pos} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

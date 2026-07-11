import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  feeForBuy,
  fmtNum,
  fmtNum2,
  fmtPct,
  fmtPrice,
  fmtUsd,
  fmtUsdCents,
  MIN_BUY_USD,
  type PositionDTO,
  type Project,
} from '@apogee/shared';
import { ApiError } from '../lib/api';
import { useParticipate, usePortfolio } from '../lib/queries';
import { toast } from '../state/store';
import { useWallet } from '../wallet/useWallet';
import { IconCheck, IconOrbit, IconWallet } from './icons';
import { Countdown, ProgressBar } from './ui';

/** Display-only network fee estimate (Phase 1; real gas lands with contracts in Phase 3). */
const GAS_ESTIMATE: Record<Project['chain'], string> = {
  SOL: '~$0.02',
  ETH: '~$1.80',
  BASE: '~$0.04',
  BNB: '~$0.11',
};

export function BuyPanel({ project }: { project: Project }) {
  const p = project;
  const { account, tier, connect } = useWallet();
  const portfolio = usePortfolio(account?.wallet ?? null);
  const participate = useParticipate(p.slug);

  const [amount, setAmount] = useState('');
  const [success, setSuccess] = useState<PositionDTO | null>(null);
  const [confirming, setConfirming] = useState(false);
  const confirmTimer = useRef<number | null>(null);

  const pct = p.hardCap > 0 ? (p.raised / p.hardCap) * 100 : 0;
  const isLive =
    p.status === 'live' &&
    p.startAt !== null &&
    p.endAt !== null &&
    Date.now() >= new Date(p.startAt).getTime() &&
    Date.now() <= new Date(p.endAt).getTime();

  const investedHere = useMemo(
    () =>
      portfolio.data?.positions.find((pos) => pos.projectSlug === p.slug)?.invested ?? 0,
    [portfolio.data, p.slug],
  );

  const amountNum = Number(amount) || 0;
  const fee = tier ? feeForBuy(amountNum, tier) : 0;
  const total = amountNum + fee;
  const remainingTier = tier ? Math.max(0, tier.maxBuyUsd - investedHere) : 0;
  const remainingCap = Math.max(0, p.hardCap - p.raised);
  const maxSpendable = account
    ? Math.min(remainingTier, remainingCap, tier ? account.usdcBalance / (1 + tier.feePct / 100) : 0)
    : 0;

  const validation = !amount
    ? null
    : amountNum < MIN_BUY_USD
      ? `Minimum buy is ${fmtUsd(MIN_BUY_USD)}`
      : amountNum > remainingTier
        ? `Your ${tier?.name} allocation has ${fmtUsd(remainingTier)} left`
        : amountNum > remainingCap
          ? `Only ${fmtUsd(remainingCap)} left before hard cap`
          : account && total > account.usdcBalance
            ? 'Insufficient USDC balance'
            : null;

  const canBuy = isLive && !!account && !!tier && !!amount && !validation && !confirming;

  const onBuy = async () => {
    if (!canBuy) return;
    setConfirming(true);
    const started = Date.now();
    try {
      const res = await participate.mutateAsync(Math.floor(amountNum * 100) / 100);
      /* Keep the confirming state perceivable — it reads as tx settlement. */
      const waitLeft = Math.max(0, 900 - (Date.now() - started));
      confirmTimer.current = window.setTimeout(() => {
        setConfirming(false);
        setSuccess(res.position);
        setAmount('');
        toast.success('Allocation secured', `${fmtUsd(res.position.invested)} in ${p.ticker}`);
      }, waitLeft);
    } catch (err) {
      setConfirming(false);
      const msg =
        err instanceof ApiError ? err.message : 'Transaction failed — please try again';
      toast.error('Purchase failed', msg);
    }
  };

  /* ── Frame (countdown + progress header, shared by all states) ──── */

  const header = (
    <>
      {p.status === 'live' && p.endAt && (
        <div className="flex items-center justify-between">
          <span className="label">Sale ends in</span>
          <Countdown target={p.endAt} className="text-[17px] text-ivory" />
        </div>
      )}
      {p.status === 'upcoming' && p.startAt && (
        <div className="flex items-center justify-between">
          <span className="label">Sale starts in</span>
          <Countdown target={p.startAt} className="text-[17px] text-gold" />
        </div>
      )}
      {p.status === 'tba' && (
        <div className="flex items-center justify-between">
          <span className="label">Sale window</span>
          <span className="num text-[15px] tracking-widest text-faint">TBA</span>
        </div>
      )}
      {p.status === 'ended' && (
        <div className="flex items-center justify-between">
          <span className="label">Sale ended</span>
          {p.roi !== undefined && <span className="pill !text-mint">ROI {p.roi}×</span>}
        </div>
      )}

      <div className="mt-4">
        <div className="mb-2 flex items-baseline justify-between text-[12px]">
          <span className="num text-ivory">{fmtUsd(p.raised)}</span>
          <span className="num text-faint">
            of {fmtUsd(p.hardCap)} · <span className="text-gold">{fmtPct(pct)}</span>
          </span>
        </div>
        <ProgressBar pct={pct} />
        <div className="mt-2 flex items-center justify-between text-[11px] text-faint">
          <span>
            <span className="num">{fmtNum(p.participants)}</span> participants
          </span>
          <span>
            Price <span className="num">{fmtPrice(p.price)}</span>
          </span>
        </div>
      </div>
    </>
  );

  /* ── Body by state ──────────────────────────────────────────────── */

  let body: React.ReactNode;

  if (success) {
    body = (
      <div className="success-pop mt-5 rounded-xl border border-mint/30 bg-mint/5 p-5 text-center">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-mint/15 text-mint">
          <IconCheck size={18} />
        </div>
        <div className="mt-3 text-[15px] font-semibold text-ivory">You’re in</div>
        <p className="mt-1 text-[12px] text-muted">
          {fmtUsd(success.invested)} secured · <span className="num">{fmtNum2(success.tokens)}</span>{' '}
          {p.ticker}
        </p>
        <p className="num mt-2 text-[10.5px] text-faint">{success.txRef}</p>
        <Link to="/portfolio" className="btn btn-gold mt-4 w-full">
          View in portfolio
        </Link>
        <button className="btn btn-dim mt-2 w-full" onClick={() => setSuccess(null)}>
          Buy more
        </button>
      </div>
    );
  } else if (p.status === 'ended') {
    body = (
      <div className="mt-5 border-t border-line pt-2">
        <div className="kv">
          <span className="k">Final raise</span>
          <span className="num">{fmtUsd(p.raised)}</span>
        </div>
        {p.ath !== undefined && (
          <div className="kv">
            <span className="k">All-time high</span>
            <span className="num text-mint">{p.ath}×</span>
          </div>
        )}
        {p.cex && p.cex.length > 0 && (
          <div className="kv">
            <span className="k">Listed on</span>
            <span className="text-[12.5px] text-ivory">{p.cex.join(', ')}</span>
          </div>
        )}
      </div>
    );
  } else if (!account) {
    body = (
      <div className="mt-5 rounded-xl border border-line bg-panel2 p-5 text-center">
        <p className="text-[12.5px] leading-relaxed text-muted">
          Connect a wallet to participate in this sale.
        </p>
        <button onClick={connect} className="btn btn-gold mt-3.5 w-full">
          <IconWallet size={15} />
          Connect Wallet
        </button>
      </div>
    );
  } else if (!tier) {
    body = (
      <div className="mt-5 rounded-xl border border-gold/25 bg-gold/5 p-5">
        <div className="label !text-gold">Tier required</div>
        <p className="mt-2 text-[12.5px] leading-relaxed text-muted">
          Stake at least <span className="num text-ivory">1,000 APG</span> to reach IGNITION and
          unlock sale participation.
        </p>
        <Link to="/staking" className="btn btn-gold mt-3.5 w-full">
          <IconOrbit size={14} />
          Stake APG
        </Link>
      </div>
    );
  } else if (p.status === 'upcoming' || p.status === 'tba' || !isLive) {
    body = (
      <div className="mt-5 rounded-xl border border-line bg-panel2 p-5 text-center">
        <p className="text-[12.5px] leading-relaxed text-muted">
          {p.status === 'tba'
            ? 'The sale window hasn’t been announced yet.'
            : 'You’re set. Come back when the sale opens —'}{' '}
          your <span className="text-gold">{tier.name}</span> tier reserves up to{' '}
          <span className="num text-ivory">{fmtUsd(tier.maxBuyUsd)}</span>.
        </p>
      </div>
    );
  } else {
    body = (
      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <span className="label">Amount · USDC</span>
          <span className="num text-[10.5px] text-faint">
            Balance {fmtNum(account.usdcBalance)}
          </span>
        </div>
        <div className="input-wrap">
          <input
            type="number"
            inputMode="decimal"
            min={MIN_BUY_USD}
            placeholder={`Min ${MIN_BUY_USD}`}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-label="Amount in USDC"
            disabled={confirming}
          />
          <button
            className="max-btn"
            onClick={() => setAmount(String(Math.floor(maxSpendable)))}
            disabled={confirming}
          >
            MAX
          </button>
        </div>

        {validation && <p className="mt-2 text-[11.5px] text-red">{validation}</p>}

        <div className="mt-3 border-t border-line pt-1">
          <div className="kv !py-2">
            <span className="k text-[11.5px]">
              Your tier · <span className="text-gold">{tier.name}</span>
            </span>
            <span className="num text-[11.5px]">
              {fmtUsd(investedHere)} / {fmtUsd(tier.maxBuyUsd)}
            </span>
          </div>
          <div className="kv !py-2">
            <span className="k text-[11.5px]">You receive</span>
            <span className="num text-[11.5px] text-ivory">
              {amountNum > 0 ? `${fmtNum2(amountNum / p.price)} ${p.ticker}` : '—'}
            </span>
          </div>
          <div className="kv !py-2">
            <span className="k text-[11.5px]">Fee ({tier.feePct}%)</span>
            <span className="num text-[11.5px]">{amountNum > 0 ? fmtUsdCents(fee) : '—'}</span>
          </div>
          <div className="kv !py-2">
            <span className="k text-[11.5px]">Est. network fee</span>
            <span className="num text-[11.5px] text-faint">{GAS_ESTIMATE[p.chain]}</span>
          </div>
        </div>

        <button className="btn btn-gold mt-3 w-full !py-3" disabled={!canBuy} onClick={onBuy}>
          {confirming ? (
            <>
              <span className="spinner" />
              Confirming…
            </>
          ) : amountNum > 0 ? (
            `Buy ${fmtUsd(amountNum)} of ${p.ticker}`
          ) : (
            'Enter an amount'
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="panel sticky top-[84px] p-5 max-[900px]:static" aria-label="Participate">
      {header}
      {body}
    </div>
  );
}

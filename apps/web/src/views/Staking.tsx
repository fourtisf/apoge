import { useMemo, useState } from 'react';
import {
  fmtNum,
  nextTier,
  pad2,
  STAKING_APR_PCT,
  tierForStake,
  TIERS,
  type Tier,
} from '@apogee/shared';
import { IconOrbit, IconWallet } from '../components/icons';
import { SpotlightCard, useNow } from '../components/ui';
import { useStake } from '../lib/queries';
import { toast } from '../state/store';
import { useWallet } from '../wallet/useWallet';

/* Node positions along the orbit track (evenly spaced). */
const NODE_POS = [12.5, 37.5, 62.5, 87.5];

function orbitFillPct(staked: number): number {
  if (staked <= 0) return 0;
  const anchors = [{ stake: 0, pos: 0 }, ...TIERS.map((t, i) => ({ stake: t.minStake, pos: NODE_POS[i]! }))];
  for (let i = anchors.length - 1; i >= 0; i--) {
    const a = anchors[i]!;
    if (staked >= a.stake) {
      const b = anchors[i + 1];
      if (!b) return 100;
      const frac = (staked - a.stake) / (b.stake - a.stake);
      return a.pos + frac * (b.pos - a.pos);
    }
  }
  return 0;
}

/* ── Orbit progress track ─────────────────────────────────────────── */

function OrbitTrack({ staked }: { staked: number }) {
  const fill = orbitFillPct(staked);
  return (
    <div className="px-2 pb-10 pt-6">
      <div className="orbit-track">
        <div className="orbit-fill" style={{ width: `${fill}%` }} />
        {TIERS.map((t, i) => (
          <div key={t.key}>
            <div
              className="orbit-node"
              data-hit={staked >= t.minStake}
              style={{ left: `${NODE_POS[i]}%` }}
            />
            <div
              className="absolute top-[18px] -translate-x-1/2 text-center"
              style={{ left: `${NODE_POS[i]}%` }}
            >
              <div
                className={`label !text-[9.5px] ${staked >= t.minStake ? '!text-gold' : ''}`}
              >
                {t.name}
              </div>
              <div className="num mt-0.5 text-[10.5px] text-faint">
                {t.minStake >= 1000 ? `${fmtNum(t.minStake / 1000)}K` : t.minStake}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Snapshot countdown (daily 00:00 UTC) ─────────────────────────── */

function useSnapshotCountdown(): string {
  const now = useNow();
  const next = new Date(now);
  next.setUTCHours(24, 0, 0, 0);
  const ms = next.getTime() - now;
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
}

/* ── Stake / unstake panel ────────────────────────────────────────── */

function StakePanel() {
  const { account, connect } = useWallet();
  const [mode, setMode] = useState<'stake' | 'unstake'>('stake');
  const [amount, setAmount] = useState('');
  const stakeMutation = useStake();

  const staked = account?.staked ?? 0;
  const available = mode === 'stake' ? (account?.apgBalance ?? 0) : staked;
  const amountNum = Number(amount) || 0;

  const resulting = useMemo(() => {
    const delta = mode === 'stake' ? amountNum : -amountNum;
    return tierForStake(Math.max(0, staked + delta));
  }, [mode, amountNum, staked]);

  const current = tierForStake(staked);
  const changed = (resulting?.key ?? null) !== (current?.key ?? null);
  const upgraded =
    changed &&
    (resulting ? TIERS.findIndex((t) => t.key === resulting.key) : -1) >
      (current ? TIERS.findIndex((t) => t.key === current.key) : -1);

  const invalid =
    amountNum > 0 && amountNum > available
      ? mode === 'stake'
        ? 'Insufficient APG balance'
        : 'You don’t have that much staked'
      : null;

  const submit = async () => {
    if (!account || amountNum <= 0 || invalid) return;
    try {
      await stakeMutation.mutateAsync({ amount: amountNum, direction: mode });
      toast.success(
        mode === 'stake' ? 'Staked' : 'Unstaked',
        `${fmtNum(amountNum)} APG · ${resulting ? resulting.name : 'no tier'}`,
      );
      setAmount('');
    } catch (err) {
      toast.error(
        mode === 'stake' ? 'Stake failed' : 'Unstake failed',
        err instanceof Error ? err.message : undefined,
      );
    }
  };

  if (!account) {
    return (
      <div className="panel sticky top-[84px] p-5 text-center max-[900px]:static">
        <div className="label mb-3 text-left">Stake APG</div>
        <p className="py-4 text-[12.5px] leading-relaxed text-muted">
          Connect a wallet to stake APG and climb the orbit.
        </p>
        <button onClick={connect} className="btn btn-gold w-full">
          <IconWallet size={15} />
          Connect Wallet
        </button>
      </div>
    );
  }

  return (
    <div className="panel sticky top-[84px] p-5 max-[900px]:static">
      <div className="mb-4 flex items-center gap-1 rounded-xl border border-line bg-panel2 p-1">
        {(['stake', 'unstake'] as const).map((m) => (
          <button
            key={m}
            className="tab flex-1 text-center capitalize"
            data-on={mode === m}
            onClick={() => {
              setMode(m);
              setAmount('');
            }}
          >
            {m}
          </button>
        ))}
      </div>

      <div className="mb-2 flex items-center justify-between">
        <span className="label">Amount · APG</span>
        <span className="num text-[10.5px] text-faint">
          {mode === 'stake' ? 'Balance' : 'Staked'} {fmtNum(available)}
        </span>
      </div>
      <div className="input-wrap">
        <input
          type="number"
          inputMode="decimal"
          min={0}
          placeholder="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          aria-label={`Amount to ${mode}`}
        />
        <button className="max-btn" onClick={() => setAmount(String(Math.floor(available)))}>
          MAX
        </button>
      </div>
      {invalid && <p className="mt-2 text-[11.5px] text-red">{invalid}</p>}

      {/* Live resulting-tier preview while typing. */}
      <div className="mt-3 rounded-xl border border-line bg-panel2 px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-[11.5px] text-faint">Resulting tier</span>
          <span className="num text-[12.5px]">
            {amountNum > 0 && changed ? (
              <>
                <span className="text-muted">{current?.name ?? 'NONE'}</span>
                <span className={upgraded ? 'text-mint' : 'text-red'}> → {resulting?.name ?? 'NONE'}</span>
              </>
            ) : (
              <span className="text-gold">{(resulting ?? current)?.name ?? 'NONE'}</span>
            )}
          </span>
        </div>
        <div className="mt-1.5 flex items-center justify-between">
          <span className="text-[11.5px] text-faint">Total staked after</span>
          <span className="num text-[12.5px] text-ivory">
            {fmtNum(Math.max(0, staked + (mode === 'stake' ? amountNum : -amountNum)))}
          </span>
        </div>
      </div>

      <button
        className="btn btn-gold mt-3.5 w-full !py-3"
        disabled={amountNum <= 0 || !!invalid || stakeMutation.isPending}
        onClick={submit}
      >
        {stakeMutation.isPending ? (
          <>
            <span className="spinner" />
            Confirming…
          </>
        ) : mode === 'stake' ? (
          'Stake APG'
        ) : (
          'Unstake APG'
        )}
      </button>

      <p className="mt-3 text-center text-[10.5px] leading-relaxed text-faint">
        Tier snapshots are taken daily at 00:00 UTC. Unstaking drops your tier immediately.
      </p>
    </div>
  );
}

/* ── View ─────────────────────────────────────────────────────────── */

export function Staking() {
  const { account, tier } = useWallet();
  const snapshot = useSnapshotCountdown();
  const staked = account?.staked ?? 0;
  const next = nextTier(staked);

  const tiles = [
    { label: 'Staking APR', value: `${STAKING_APR_PCT}%`, accent: 'text-mint' },
    { label: 'Your multiplier', value: tier ? tier.multiplier : '—', accent: 'text-ivory' },
    { label: 'Next snapshot', value: snapshot, accent: 'text-ivory' },
    {
      label: 'To next tier',
      value: next ? `${fmtNum(Math.max(0, next.minStake - staked))} APG` : 'Max orbit',
      accent: next ? 'text-gold' : 'text-gold',
    },
  ];

  return (
    <div className="grid grid-cols-[1fr_340px] items-start gap-6 max-[900px]:grid-cols-1">
      <div className="flex min-w-0 flex-col gap-6">
        <div className="grid grid-cols-4 gap-4 max-[900px]:grid-cols-2">
          {tiles.map((t) => (
            <SpotlightCard key={t.label} className="card px-5 py-4">
              <div className="label">{t.label}</div>
              <div className={`num mt-1.5 text-[20px] font-medium ${t.accent}`}>{t.value}</div>
            </SpotlightCard>
          ))}
        </div>

        <section className="panel p-6 max-[640px]:p-5" aria-label="Orbit progress">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ivory">
                <IconOrbit size={16} className="text-gold" />
                Your orbit
              </h2>
              <p className="mt-1 text-[12px] text-muted">
                <span className="num text-ivory">{fmtNum(staked)}</span> APG staked
                {tier && (
                  <>
                    {' '}
                    · currently <span className="text-gold">{tier.name}</span>
                  </>
                )}
              </p>
            </div>
            {tier && <span className="pill pill-gold">{tier.name}</span>}
          </div>
          <OrbitTrack staked={staked} />
        </section>

        <section className="panel overflow-x-auto" aria-label="Tier benefits">
          <table className="tbl min-w-[520px]">
            <thead>
              <tr>
                <th>Tier</th>
                <th>Required stake</th>
                <th>Allocation</th>
                <th>Max buy</th>
                <th>Fee</th>
              </tr>
            </thead>
            <tbody>
              {TIERS.map((t: Tier) => (
                <tr key={t.key} className={tier?.key === t.key ? 'tbl-row-hi' : ''}>
                  <td>
                    <span className={`num text-[12.5px] ${tier?.key === t.key ? 'text-gold' : 'text-ivory'}`}>
                      {t.name}
                    </span>
                    {tier?.key === t.key && (
                      <span className="label ml-2 !text-[9px] !text-gold">· You</span>
                    )}
                  </td>
                  <td className="num text-muted">{fmtNum(t.minStake)} APG</td>
                  <td className="num text-muted">{t.multiplier}</td>
                  <td className="num text-muted">${fmtNum(t.maxBuyUsd)}</td>
                  <td className="num text-muted">{t.feePct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <StakePanel />
    </div>
  );
}

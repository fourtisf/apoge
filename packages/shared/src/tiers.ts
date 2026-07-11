import type { Tier, TierKey } from './types.js';

/**
 * Tier ladder. Order matters: ascending by minStake.
 * Numbers are the product spec and must match the UI everywhere.
 */
export const TIERS: readonly Tier[] = [
  { key: 'ignition', name: 'IGNITION', minStake: 1_000, multiplier: 'Lottery', maxBuyUsd: 250, feePct: 1 },
  { key: 'orbit', name: 'ORBIT', minStake: 10_000, multiplier: '1×', maxBuyUsd: 1_250, feePct: 1 },
  { key: 'zenith', name: 'ZENITH', minStake: 50_000, multiplier: '4×', maxBuyUsd: 5_000, feePct: 0.5 },
  { key: 'apogee', name: 'APOGEE', minStake: 250_000, multiplier: '12×', maxBuyUsd: 15_000, feePct: 0 },
] as const;

/** Minimum participation amount for any sale, USD. */
export const MIN_BUY_USD = 50;

/** Staking program display constants. */
export const STAKING_APR_PCT = 12.5;

/** Highest tier whose minStake the given stake meets, or null if below IGNITION. */
export function tierForStake(staked: number): Tier | null {
  let current: Tier | null = null;
  for (const tier of TIERS) {
    if (staked >= tier.minStake) current = tier;
  }
  return current;
}

/** The next tier above the given stake, or null if already at APOGEE. */
export function nextTier(staked: number): Tier | null {
  for (const tier of TIERS) {
    if (staked < tier.minStake) return tier;
  }
  return null;
}

export function tierByKey(key: TierKey): Tier {
  const tier = TIERS.find((t) => t.key === key);
  if (!tier) throw new Error(`Unknown tier: ${key}`);
  return tier;
}

/** Participation fee in USD for a buy of `amountUsd` at the given tier. */
export function feeForBuy(amountUsd: number, tier: Tier): number {
  return Math.round(amountUsd * tier.feePct) / 100;
}

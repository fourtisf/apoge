import type { VestingConfig } from './types.js';

const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Phase 1 (off-chain) vesting curve for a position:
 * - `tgePct` unlocks immediately at purchase,
 * - nothing more until `cliffMonths` after purchase,
 * - then the remainder vests linearly over `linearMonths`.
 *
 * Phase 3 swaps this for on-chain vesting anchored to the real TGE;
 * keep all consumers going through this function so that swap is local.
 */
export function vestedPctFor(
  vesting: VestingConfig,
  purchasedAtIso: string,
  now: number = Date.now(),
): number {
  const purchased = new Date(purchasedAtIso).getTime();
  const elapsed = now - purchased;
  if (elapsed <= 0) return vesting.tgePct;

  const cliffMs = vesting.cliffMonths * MONTH_MS;
  const linearMs = vesting.linearMonths * MONTH_MS;
  if (elapsed <= cliffMs) return vesting.tgePct;
  if (linearMs <= 0) return 100;

  const linearElapsed = Math.min(1, (elapsed - cliffMs) / linearMs);
  const pct = vesting.tgePct + (100 - vesting.tgePct) * linearElapsed;
  return Math.min(100, Math.round(pct * 10) / 10);
}

/** Tokens currently claimable for a position. */
export function claimableTokens(
  tokens: number,
  claimedTokens: number,
  vestedPct: number,
): number {
  const vested = (tokens * vestedPct) / 100;
  return Math.max(0, Math.floor((vested - claimedTokens) * 100) / 100);
}

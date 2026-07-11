/**
 * Money is stored as plain JS numbers (Phase 1). To keep doubles sane we
 * round to 2 decimals at every mutation boundary.
 */
export function roundUsd(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Token amounts share the 2-decimal convention. */
export const roundTokens = roundUsd;

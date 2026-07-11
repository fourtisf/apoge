/** Formatters shared by web + api so numbers render identically everywhere. */

const usd0 = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const usd2 = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const num0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const num2 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

/** "$1,234" — whole-dollar amounts. */
export function fmtUsd(n: number): string {
  return usd0.format(n);
}

/** "$1,234.56" — cent-precise amounts (fees, prices ≥ $1). */
export function fmtUsdCents(n: number): string {
  return usd2.format(n);
}

/** Token sale prices can be sub-cent: "$0.042". */
export function fmtPrice(n: number): string {
  if (n >= 1) return usd2.format(n);
  return `$${n.toPrecision(2).replace(/\.?0+$/, '')}`;
}

/** "$24.6M" / "$611K" — compact for tiles and cards. */
export function fmtUsdCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `$${trim(n / 1_000_000_000)}B`;
  if (abs >= 1_000_000) return `$${trim(n / 1_000_000)}M`;
  if (abs >= 1_000) return `$${trim(n / 1_000)}K`;
  return usd0.format(n);
}

/** "12,500" */
export function fmtNum(n: number): string {
  return num0.format(n);
}

/** "12,500.25" */
export function fmtNum2(n: number): string {
  return num2.format(n);
}

/** "1.2M" / "50K" — compact plain numbers. */
export function fmtNumCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${trim(n / 1_000_000_000)}B`;
  if (abs >= 1_000_000) return `${trim(n / 1_000_000)}M`;
  if (abs >= 1_000) return `${trim(n / 1_000)}K`;
  return num0.format(n);
}

function trim(n: number): string {
  const fixed = n.toFixed(1);
  return fixed.endsWith('.0') ? fixed.slice(0, -2) : fixed;
}

/** "7xKX…9kQd" — middle-truncated wallet address. */
export function truncAddr(addr: string, lead = 4, tail = 4): string {
  if (addr.length <= lead + tail + 1) return addr;
  return `${addr.slice(0, lead)}…${addr.slice(-tail)}`;
}

export interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** Total remaining ms, clamped at 0. */
  totalMs: number;
}

/** Break a ms delta into countdown segments. */
export function countdownParts(targetIso: string, now = Date.now()): CountdownParts {
  const totalMs = Math.max(0, new Date(targetIso).getTime() - now);
  const s = Math.floor(totalMs / 1000);
  return {
    days: Math.floor(s / 86_400),
    hours: Math.floor((s % 86_400) / 3_600),
    minutes: Math.floor((s % 3_600) / 60),
    seconds: s % 60,
    totalMs,
  };
}

/** "00" zero-padded segment for mono countdown displays. */
export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Percent with at most one decimal: "71.9%". */
export function fmtPct(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}%`;
}

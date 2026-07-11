import { useEffect, useState } from 'react';
import type { Chain } from '@apogee/shared';

/**
 * Phase 1 placeholder gas readout: plausible per-chain baselines with a
 * gentle jitter every 12s. Phase 3 replaces this with live reads from the
 * configured RPC endpoints (RPC_ETH etc.) — keep the hook signature stable.
 */
const BASELINES: Record<Chain, { value: number; unit: string; decimals: number }> = {
  ETH: { value: 14, unit: 'GWEI', decimals: 0 },
  BASE: { value: 0.03, unit: 'GWEI', decimals: 2 },
  BNB: { value: 1.1, unit: 'GWEI', decimals: 1 },
  SOL: { value: 0.00025, unit: 'SOL', decimals: 5 },
};

export function useGasPill(chain: Chain = 'ETH'): string {
  const [jitter, setJitter] = useState(1);

  useEffect(() => {
    const id = window.setInterval(() => {
      setJitter(0.85 + Math.random() * 0.3);
    }, 12_000);
    return () => window.clearInterval(id);
  }, []);

  const base = BASELINES[chain];
  const value = (base.value * jitter).toFixed(base.decimals);
  return `${value} ${base.unit}`;
}

import { createPublicClient, http, type PublicClient } from 'viem';
import type { OnchainConfig } from '@apogee/shared';
import { env } from '../env';

/** Default public RPCs; ONCHAIN_RPC env JSON overrides per chain id. */
const DEFAULT_RPC: Record<number, string> = {
  1: process.env.RPC_ETH || 'https://eth.llamarpc.com',
  8453: process.env.RPC_BASE || 'https://mainnet.base.org',
  56: process.env.RPC_BNB || 'https://bsc-dataseed.binance.org',
  84532: process.env.RPC_BASE_SEPOLIA || 'https://sepolia.base.org',
  31337: 'http://127.0.0.1:8545',
};

function rpcOverrides(): Record<string, string> {
  if (!env.ONCHAIN_RPC) return {};
  try {
    return JSON.parse(env.ONCHAIN_RPC) as Record<string, string>;
  } catch {
    console.warn('[chains] ONCHAIN_RPC is not valid JSON — ignoring');
    return {};
  }
}

export function rpcUrlFor(chainId: number): string | null {
  return rpcOverrides()[String(chainId)] ?? DEFAULT_RPC[chainId] ?? null;
}

const clients = new Map<number, PublicClient>();

export function clientFor(chainId: number): PublicClient | null {
  const cached = clients.get(chainId);
  if (cached) return cached;
  const url = rpcUrlFor(chainId);
  if (!url) return null;
  const client = createPublicClient({ transport: http(url) });
  clients.set(chainId, client);
  return client;
}

/** Parsed ONCHAIN_CONTRACTS env (staking/usdc/apg per chain). */
export function onchainConfig(): OnchainConfig {
  if (!env.ONCHAIN_CONTRACTS) return {};
  try {
    return JSON.parse(env.ONCHAIN_CONTRACTS) as OnchainConfig;
  } catch {
    console.warn('[chains] ONCHAIN_CONTRACTS is not valid JSON — ignoring');
    return {};
  }
}

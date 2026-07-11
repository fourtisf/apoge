import type { ChainType } from '@apogee/shared';

export const EVM_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
/** Base58, 32–44 chars — the usual encoding of a 32-byte ed25519 pubkey. */
export const SOL_ADDRESS_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/** Combined matcher for path params where the chain type is unknown. */
export const ANY_WALLET_RE = /^(0x[0-9a-fA-F]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})$/;

export function isValidWallet(wallet: string, chainType: ChainType): boolean {
  return chainType === 'evm' ? EVM_ADDRESS_RE.test(wallet) : SOL_ADDRESS_RE.test(wallet);
}

/** EVM addresses are stored lowercased; Solana addresses are case-sensitive base58, stored verbatim. */
export function normalizeWallet(wallet: string, chainType: ChainType): string {
  return chainType === 'evm' ? wallet.toLowerCase() : wallet;
}

/** Best-effort normalization for path params (no chainType available). */
export function normalizeWalletParam(wallet: string): string {
  return wallet.startsWith('0x') || wallet.startsWith('0X') ? wallet.toLowerCase() : wallet;
}

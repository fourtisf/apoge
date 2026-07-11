/**
 * Registry connecting the lazily-loaded wallet stack (WalletHost) to the
 * always-loaded UI. The heavy SDKs (wagmi/viem/solana) stay out of the
 * startup bundle; once WalletHost mounts it registers real implementations
 * here.
 */
export type BridgeProviderKind = 'phantom' | 'metamask' | 'coinbase' | 'walletconnect';

export interface WalletImpl {
  connect: (kind: BridgeProviderKind) => Promise<void>;
  disconnect: () => Promise<void>;
}

let impl: WalletImpl | null = null;
let resolveReady: (() => void) | null = null;
let ready: Promise<void> | null = null;

export function registerWalletImpl(i: WalletImpl): void {
  impl = i;
  resolveReady?.();
}

export function unregisterWalletImpl(): void {
  impl = null;
  ready = null;
  resolveReady = null;
}

/** Resolves once WalletHost has mounted and registered. */
export function walletImplReady(): Promise<void> {
  if (impl) return Promise.resolve();
  if (!ready) {
    ready = new Promise<void>((resolve) => {
      resolveReady = resolve;
    });
  }
  return ready;
}

export function getWalletImpl(): WalletImpl | null {
  return impl;
}

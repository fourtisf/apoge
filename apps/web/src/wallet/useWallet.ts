import { useCallback } from 'react';
import { tierByKey, type Account, type ChainType, type Tier } from '@apogee/shared';
import { api, ApiError } from '../lib/api';
import { toast, useSession, useUi } from '../state/store';
import { DEMO_ADDRESS, DEMO_WALLET_ENABLED, signInDemo } from './auth';
import { getWalletImpl, walletImplReady, type BridgeProviderKind } from './bridge';

export { DEMO_WALLET_ENABLED };

export type ProviderKind = BridgeProviderKind | 'demo';

export interface UseWalletResult {
  /** Authenticated identity (present once sign-in completed). */
  address: string | null;
  chainType: ChainType | null;
  account: Account | null;
  tier: Tier | null;
  isDemo: boolean;
  /** Opens the connect modal. */
  connect: () => void;
  /** Connects a specific provider (called from the modal). */
  connectProvider: (kind: ProviderKind) => Promise<void>;
  disconnect: () => void;
  refreshAccount: () => Promise<void>;
}

/**
 * The single wallet abstraction the UI touches. Reads identity/balances
 * from the session store; the heavy wallet SDKs live in WalletHost, which
 * lazy-loads the first time the connect modal opens (see bridge.ts).
 */
export function useWallet(): UseWalletResult {
  const account = useSession((s) => s.account);
  const setConnectOpen = useUi((s) => s.setConnectOpen);
  const requestWalletStack = useUi((s) => s.requestWalletStack);

  const connectProvider = useCallback(
    async (kind: ProviderKind) => {
      try {
        if (kind === 'demo') {
          await signInDemo();
          return;
        }
        requestWalletStack();
        await walletImplReady();
        await getWalletImpl()!.connect(kind);
      } catch (err) {
        if (!(err instanceof Error) || !/User rejected|declined/i.test(err.message)) {
          toast.error(
            'Connection failed',
            err instanceof Error ? err.message : 'Could not connect wallet',
          );
        }
        throw err;
      }
    },
    [requestWalletStack],
  );

  const disconnect = useCallback(() => {
    useSession.getState().clear();
    getWalletImpl()
      ?.disconnect()
      .catch(() => undefined);
    toast.info('Wallet disconnected');
  }, []);

  const refreshAccount = useCallback(async () => {
    const wallet = useSession.getState().account?.wallet;
    if (!wallet) return;
    try {
      const { account: fresh } = await api.account(wallet);
      useSession.getState().setAccount(fresh);
    } catch (err) {
      // The account no longer exists (fresh DB after a restart) — drop the
      // persisted session instead of showing a dead "connected" wallet.
      // 401s are already handled globally by the api client.
      if (err instanceof ApiError && err.status === 404) useSession.getState().clear();
      /* keep stale account on transient failures */
    }
  }, []);

  return {
    address: account?.wallet ?? null,
    chainType: account?.chainType ?? null,
    account,
    tier: account?.tierKey ? tierByKey(account.tierKey) : null,
    isDemo: account?.wallet === DEMO_ADDRESS,
    connect: () => setConnectOpen(true),
    connectProvider,
    disconnect,
    refreshAccount,
  };
}

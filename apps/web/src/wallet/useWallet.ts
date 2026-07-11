import { useCallback, useEffect, useRef } from 'react';
import { useWallet as useSolanaWallet } from '@solana/wallet-adapter-react';
import {
  useAccount,
  useConnect,
  useDisconnect,
  useSignMessage,
} from 'wagmi';
import { tierByKey, type Account, type ChainType, type Tier } from '@apogee/shared';
import { api } from '../lib/api';
import { base58Encode } from '../lib/base58';
import { toast, useSession, useUi } from '../state/store';

export const DEMO_WALLET_ENABLED = import.meta.env.VITE_DEMO_WALLET === '1' || import.meta.env.DEV;
const DEMO_ADDRESS = 'ApgDemoWa11et4Ever1111111111111111111111111';

export type ProviderKind = 'phantom' | 'metamask' | 'coinbase' | 'walletconnect' | 'demo';

export interface UseWalletResult {
  /** Authenticated identity (present once sign-in completed). */
  address: string | null;
  chainType: ChainType | null;
  account: Account | null;
  tier: Tier | null;
  isDemo: boolean;
  /** True while a signature/verify round-trip is in flight. */
  authenticating: boolean;
  /** Opens the connect modal. */
  connect: () => void;
  /** Connects a specific provider (called from the modal). */
  connectProvider: (kind: ProviderKind) => Promise<void>;
  disconnect: () => void;
  refreshAccount: () => Promise<void>;
}

const authState = { inFlight: false };

/**
 * The single wallet abstraction the UI is allowed to touch.
 * Wraps Solana wallet-adapter + wagmi, runs the nonce/sign/verify flow,
 * and exposes the off-chain account (balances, stake, tier).
 */
export function useWallet(): UseWalletResult {
  const session = useSession();
  const setConnectOpen = useUi((s) => s.setConnectOpen);

  const sol = useSolanaWallet();
  const evm = useAccount();
  const { connectAsync, connectors } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const { signMessageAsync } = useSignMessage();

  const attempted = useRef<Set<string>>(new Set());

  const signIn = useCallback(
    async (wallet: string, chainType: ChainType, sign: (message: string) => Promise<string>) => {
      if (authState.inFlight) return;
      authState.inFlight = true;
      try {
        const { message } = await api.nonce(wallet, chainType);
        const signature = await sign(message);
        const { token, account } = await api.verify(wallet, chainType, signature);
        useSession.getState().setSession(token, account);
        toast.success('Wallet connected', `Signed in as ${wallet.slice(0, 6)}…`);
      } catch (err) {
        toast.error('Sign-in failed', err instanceof Error ? err.message : 'Signature rejected');
        throw err;
      } finally {
        authState.inFlight = false;
      }
    },
    [],
  );

  /* Auto sign-in whenever a wallet connects with a new address. */
  useEffect(() => {
    const pubkey = sol.publicKey;
    if (!pubkey || !sol.signMessage) return;
    const address = pubkey.toBase58();
    if (session.account?.wallet === address || attempted.current.has(address)) return;
    attempted.current.add(address);
    void signIn(address, 'sol', async (message) => {
      const sig = await sol.signMessage!(new TextEncoder().encode(message));
      return base58Encode(sig);
    }).catch(() => sol.disconnect().catch(() => undefined));
  }, [sol.publicKey, sol.signMessage, session.account?.wallet, signIn, sol]);

  useEffect(() => {
    const address = evm.address;
    if (!address) return;
    if (session.account?.wallet === address.toLowerCase() || attempted.current.has(address)) return;
    attempted.current.add(address);
    void signIn(address, 'evm', (message) => signMessageAsync({ message })).catch(() =>
      disconnectAsync().catch(() => undefined),
    );
  }, [evm.address, session.account?.wallet, signIn, signMessageAsync, disconnectAsync]);

  const connectProvider = useCallback(
    async (kind: ProviderKind) => {
      setConnectOpen(false);
      try {
        if (kind === 'phantom') {
          const phantom = sol.wallets.find((w) => w.adapter.name === 'Phantom');
          if (!phantom) {
            toast.error('Phantom not found', 'Install the Phantom extension and reload.');
            return;
          }
          sol.select(phantom.adapter.name);
          await phantom.adapter.connect();
        } else if (kind === 'demo') {
          attempted.current.delete(DEMO_ADDRESS);
          await signIn(DEMO_ADDRESS, 'sol', async () => 'demo');
        } else {
          const id =
            kind === 'metamask' ? 'injected' : kind === 'coinbase' ? 'coinbaseWalletSDK' : 'walletConnect';
          const connector = connectors.find((c) => c.id === id) ?? connectors[0];
          if (!connector) {
            toast.error('No EVM connector available');
            return;
          }
          await connectAsync({ connector });
        }
      } catch (err) {
        // signIn already toasts its own failures; only surface connect errors.
        if (!(err instanceof Error) || !/User rejected/i.test(err.message)) {
          toast.error(
            'Connection failed',
            err instanceof Error ? err.message : 'Could not connect wallet',
          );
        }
      }
    },
    [connectAsync, connectors, setConnectOpen, signIn, sol],
  );

  const disconnect = useCallback(() => {
    attempted.current.clear();
    useSession.getState().clear();
    sol.disconnect().catch(() => undefined);
    disconnectAsync().catch(() => undefined);
    toast.info('Wallet disconnected');
  }, [disconnectAsync, sol]);

  const refreshAccount = useCallback(async () => {
    const wallet = useSession.getState().account?.wallet;
    if (!wallet) return;
    try {
      const { account } = await api.account(wallet);
      useSession.getState().setAccount(account);
    } catch {
      /* keep stale account on transient failures */
    }
  }, []);

  const account = session.account;
  return {
    address: account?.wallet ?? null,
    chainType: account?.chainType ?? null,
    account,
    tier: account?.tierKey ? tierByKey(account.tierKey) : null,
    isDemo: account?.wallet === DEMO_ADDRESS,
    authenticating: authState.inFlight,
    connect: () => setConnectOpen(true),
    connectProvider,
    disconnect,
    refreshAccount,
  };
}

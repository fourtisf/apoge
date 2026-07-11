import { useEffect, useMemo, useRef, type FC, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider, useAccount, useConnect, useDisconnect, useSignMessage } from 'wagmi';
import { ConnectionProvider, WalletProvider, useWallet as useSolanaWallet } from '@solana/wallet-adapter-react';
import type { Adapter } from '@solana/wallet-adapter-base';
import { base58Encode } from '../lib/base58';
import { queryClient } from '../lib/queries';
import { toast, useSession } from '../state/store';
import { signIn } from './auth';
import { registerWalletImpl, unregisterWalletImpl, type BridgeProviderKind } from './bridge';
import { wagmiConfig } from './wagmi';

const SOLANA_RPC =
  (import.meta.env.VITE_RPC_SOLANA as string | undefined) ?? 'https://api.mainnet-beta.solana.com';

/* wallet-adapter-react ships nested React 19 types (via react-native) that
 * npm overrides can't flatten; re-type the two providers against our React 18
 * types. Runtime behavior is unaffected. */
const SolConnectionProvider = ConnectionProvider as unknown as FC<{
  endpoint: string;
  children: ReactNode;
}>;
const SolWalletProvider = WalletProvider as unknown as FC<{
  wallets: Adapter[];
  autoConnect: boolean;
  children: ReactNode;
}>;

/**
 * Invisible bridge: exposes connect/disconnect to the light useWallet()
 * via the module registry, and auto-runs the nonce/sign/verify flow when
 * a wallet reports a new address.
 */
function Bridge() {
  const sol = useSolanaWallet();
  const evm = useAccount();
  const { connectAsync, connectors } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const attempted = useRef<Set<string>>(new Set());

  const session = useSession();

  /* Auto sign-in: Solana. */
  useEffect(() => {
    const pubkey = sol.publicKey;
    if (!pubkey || !sol.signMessage) return;
    const address = pubkey.toBase58();
    if (session.account?.wallet === address || attempted.current.has(address)) return;
    attempted.current.add(address);
    void signIn(address, 'sol', async (message) => {
      const sig = await sol.signMessage!(new TextEncoder().encode(message));
      return base58Encode(sig);
    }).catch(() => {
      // Allow a clean retry on the same address after a rejected signature.
      attempted.current.delete(address);
      sol.disconnect().catch(() => undefined);
    });
  }, [sol.publicKey, sol.signMessage, session.account?.wallet, sol]);

  /* Auto sign-in: EVM. */
  useEffect(() => {
    const address = evm.address;
    if (!address) return;
    const normalized = address.toLowerCase();
    if (session.account?.wallet === normalized || attempted.current.has(normalized)) return;
    attempted.current.add(normalized);
    void signIn(address, 'evm', (message) => signMessageAsync({ message })).catch(() => {
      attempted.current.delete(normalized);
      disconnectAsync().catch(() => undefined);
    });
  }, [evm.address, session.account?.wallet, signMessageAsync, disconnectAsync]);

  useEffect(() => {
    registerWalletImpl({
      connect: async (kind: BridgeProviderKind) => {
        if (kind === 'phantom') {
          const phantom = sol.wallets.find((w) => w.adapter.name === 'Phantom');
          if (!phantom) {
            toast.error('Phantom not found', 'Install the Phantom extension and reload.');
            return;
          }
          sol.select(phantom.adapter.name);
          await phantom.adapter.connect();
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
      },
      disconnect: async () => {
        attempted.current.clear();
        await Promise.allSettled([sol.disconnect(), disconnectAsync()]);
      },
    });
    return () => unregisterWalletImpl();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sol.wallets, sol.select, connectAsync, connectors, disconnectAsync]);

  return null;
}

/** Lazily-mounted host for the full wallet stack. Renders nothing. */
export default function WalletHost() {
  const wallets = useMemo<Adapter[]>(() => [], []);
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <SolConnectionProvider endpoint={SOLANA_RPC}>
          <SolWalletProvider wallets={wallets} autoConnect={false}>
            <Bridge />
          </SolWalletProvider>
        </SolConnectionProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

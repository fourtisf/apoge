import { type FC, type ReactNode, useMemo } from 'react';
import { WagmiProvider } from 'wagmi';
import { QueryClientProvider } from '@tanstack/react-query';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import type { Adapter } from '@solana/wallet-adapter-base';
import { wagmiConfig } from './wagmi';
import { queryClient } from '../lib/queries';

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

const SOLANA_RPC =
  (import.meta.env.VITE_RPC_SOLANA as string | undefined) ?? 'https://api.mainnet-beta.solana.com';

/**
 * Wraps the app with both wallet stacks. Phantom registers itself via the
 * Wallet Standard, so no adapter list is needed — the adapter picks it up.
 * The UI never touches these providers directly; everything goes through
 * useWallet().
 */
export function WalletProviders({ children }: { children: ReactNode }) {
  const wallets = useMemo<Adapter[]>(() => [], []);
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <SolConnectionProvider endpoint={SOLANA_RPC}>
          <SolWalletProvider wallets={wallets} autoConnect={false}>
            {children}
          </SolWalletProvider>
        </SolConnectionProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

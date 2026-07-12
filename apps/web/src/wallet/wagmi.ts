import { createConfig, http } from 'wagmi';
import { base, baseSepolia, bsc, hardhat, mainnet } from 'wagmi/chains';
import { coinbaseWallet, injected, walletConnect } from 'wagmi/connectors';

const wcProjectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string | undefined;

/** EVM wallet config: MetaMask (injected), Coinbase Wallet, and
 *  WalletConnect v2 when a project id is configured. */
export const wagmiConfig = createConfig({
  // Mainnets + Base Sepolia (Phase 2 testnet dry-runs) + local hardhat (dev).
  chains: [mainnet, base, bsc, baseSepolia, hardhat],
  connectors: [
    injected(),
    coinbaseWallet({ appName: 'Apoge' }),
    ...(wcProjectId ? [walletConnect({ projectId: wcProjectId, showQrModal: true })] : []),
  ],
  transports: {
    [mainnet.id]: http(),
    [base.id]: http(),
    [bsc.id]: http(),
    [baseSepolia.id]: http(),
    [hardhat.id]: http(),
  },
});

export const hasWalletConnect = Boolean(wcProjectId);

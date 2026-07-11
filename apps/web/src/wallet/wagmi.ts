import { createConfig, http } from 'wagmi';
import { base, bsc, mainnet } from 'wagmi/chains';
import { coinbaseWallet, injected, walletConnect } from 'wagmi/connectors';

const wcProjectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string | undefined;

/** EVM wallet config: MetaMask (injected), Coinbase Wallet, and
 *  WalletConnect v2 when a project id is configured. */
export const wagmiConfig = createConfig({
  chains: [mainnet, base, bsc],
  connectors: [
    injected(),
    coinbaseWallet({ appName: 'Apogee' }),
    ...(wcProjectId ? [walletConnect({ projectId: wcProjectId, showQrModal: true })] : []),
  ],
  transports: {
    [mainnet.id]: http(),
    [base.id]: http(),
    [bsc.id]: http(),
  },
});

export const hasWalletConnect = Boolean(wcProjectId);

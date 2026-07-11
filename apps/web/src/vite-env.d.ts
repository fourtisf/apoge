/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WALLETCONNECT_PROJECT_ID?: string;
  readonly VITE_DEMO_WALLET?: string;
  readonly VITE_RPC_SOLANA?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

import { useEffect, useState } from 'react';
import { useUi } from '../state/store';
import { DEMO_WALLET_ENABLED, useWallet, type ProviderKind } from '../wallet/useWallet';
import { IconX } from './icons';

interface ProviderRow {
  kind: ProviderKind;
  name: string;
  hint: string;
  letter: string;
  color: string;
  show: boolean;
}

const HAS_WALLETCONNECT = Boolean(import.meta.env.VITE_WALLETCONNECT_PROJECT_ID);

export function ConnectModal() {
  const open = useUi((s) => s.connectOpen);
  const setOpen = useUi((s) => s.setConnectOpen);
  const { connectProvider, account } = useWallet();
  const [busy, setBusy] = useState<ProviderKind | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  /* Close once a session lands (auto sign-in finished). */
  useEffect(() => {
    if (open && account) {
      setOpen(false);
      setBusy(null);
    }
  }, [open, account, setOpen]);

  if (!open) return null;

  const providers: ProviderRow[] = [
    { kind: 'phantom', name: 'Phantom', hint: 'Solana', letter: 'P', color: '#9945FF', show: true },
    { kind: 'metamask', name: 'MetaMask', hint: 'Ethereum · Base · BNB', letter: 'M', color: '#F6851B', show: true },
    { kind: 'coinbase', name: 'Coinbase Wallet', hint: 'Ethereum · Base', letter: 'C', color: '#3773F5', show: true },
    { kind: 'walletconnect', name: 'WalletConnect', hint: 'Any EVM wallet', letter: 'W', color: '#3B99FC', show: HAS_WALLETCONNECT },
    { kind: 'demo', name: 'Demo wallet', hint: 'Local preview · no extension needed', letter: 'D', color: '#C9A366', show: DEMO_WALLET_ENABLED },
  ];

  const pick = async (kind: ProviderKind) => {
    if (busy) return;
    setBusy(kind);
    try {
      await connectProvider(kind);
    } catch {
      /* toasts handled downstream */
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <div className="modal-backdrop" onClick={() => setOpen(false)} />
      <div
        className="modal panel fixed left-1/2 top-1/2 z-[70] w-[min(400px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 p-6"
        role="dialog"
        aria-modal="true"
        aria-label="Connect a wallet"
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-[17px] font-semibold text-ivory">Connect a wallet</h2>
            <p className="mt-1 text-[12.5px] text-muted">
              Sign a message to verify ownership. No transaction, no fees.
            </p>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="text-faint transition-colors hover:text-ivory"
            aria-label="Close"
          >
            <IconX size={17} />
          </button>
        </div>

        <div className="mt-5 flex flex-col gap-2">
          {providers
            .filter((p) => p.show)
            .map((p) => (
              <button
                key={p.kind}
                onClick={() => void pick(p.kind)}
                disabled={busy !== null}
                className="group flex items-center gap-3.5 rounded-xl border border-line bg-panel2 px-4 py-3 text-left transition-all duration-300 hover:border-gold/40 hover:bg-panel3 disabled:opacity-60"
              >
                <span
                  className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px] text-[15px] font-bold text-[#0A0B0E]"
                  style={{ background: p.color }}
                >
                  {p.letter}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-semibold text-ivory">{p.name}</span>
                  <span className="block text-[11.5px] text-faint">{p.hint}</span>
                </span>
                {busy === p.kind && <span className="spinner spinner-gold" />}
              </button>
            ))}
        </div>

        <p className="label mt-5 text-center">Phase 1 · Read-only connections</p>
      </div>
    </>
  );
}

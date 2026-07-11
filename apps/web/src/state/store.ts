import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Account } from '@apogee/shared';

/* ── Auth session (JWT + off-chain account) ───────────────────────── */

interface SessionState {
  token: string | null;
  account: Account | null;
  setSession: (token: string, account: Account) => void;
  setAccount: (account: Account) => void;
  clear: () => void;
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      token: null,
      account: null,
      setSession: (token, account) => set({ token, account }),
      setAccount: (account) => set({ account }),
      clear: () => set({ token: null, account: null }),
    }),
    { name: 'apogee-session' },
  ),
);

/* ── Toasts ───────────────────────────────────────────────────────── */

export type ToastKind = 'default' | 'success' | 'error';

export interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  body?: string;
}

interface ToastState {
  toasts: Toast[];
  push: (kind: ToastKind, title: string, body?: string) => void;
  dismiss: (id: number) => void;
}

let toastId = 0;

export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  push: (kind, title, body) => {
    const id = ++toastId;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, kind, title, body }] }));
    window.setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 4200);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = {
  info: (title: string, body?: string) => useToasts.getState().push('default', title, body),
  success: (title: string, body?: string) => useToasts.getState().push('success', title, body),
  error: (title: string, body?: string) => useToasts.getState().push('error', title, body),
};

/* ── UI state ─────────────────────────────────────────────────────── */

interface UiState {
  connectOpen: boolean;
  setConnectOpen: (open: boolean) => void;
  /** Topbar search query — filters the launchpad grid. */
  search: string;
  setSearch: (search: string) => void;
  /** True once something needs the heavy wallet SDK stack (lazy-loaded). */
  walletStackRequested: boolean;
  requestWalletStack: () => void;
}

export const useUi = create<UiState>((set) => ({
  connectOpen: false,
  setConnectOpen: (connectOpen) =>
    set((s) => ({
      connectOpen,
      /* Opening the modal preloads the wallet stack so provider clicks are instant. */
      walletStackRequested: s.walletStackRequested || connectOpen,
    })),
  search: '',
  setSearch: (search) => set({ search }),
  walletStackRequested: false,
  requestWalletStack: () => set({ walletStackRequested: true }),
}));

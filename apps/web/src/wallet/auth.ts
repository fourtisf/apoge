import type { ChainType } from '@apogee/shared';
import { api } from '../lib/api';
import { toast, useSession } from '../state/store';

export const DEMO_WALLET_ENABLED = import.meta.env.VITE_DEMO_WALLET === '1' || import.meta.env.DEV;
export const DEMO_ADDRESS = 'ApgDemoWa11et4Ever1111111111111111111111111';

let inFlight = false;

/** Nonce → sign → verify → store session. Shared by every provider path. */
export async function signIn(
  wallet: string,
  chainType: ChainType,
  sign: (message: string) => Promise<string>,
): Promise<void> {
  // Throw rather than resolve, so a concurrent caller never mistakes the
  // other flow's outcome for its own success.
  if (inFlight) throw new Error('Sign-in already in progress');
  inFlight = true;
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
    inFlight = false;
  }
}

/** Local-dev demo identity — no extension, no signature (API DEMO_MODE). */
export function signInDemo(): Promise<void> {
  return signIn(DEMO_ADDRESS, 'sol', async () => 'demo');
}

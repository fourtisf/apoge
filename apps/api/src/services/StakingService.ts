/**
 * StakingService — off-chain APG staking ledger + Account assembly (Phase 1).
 * Phase 3 swaps these internals for on-chain staking reads/writes; keep the
 * signatures stable so routes and the UI never change.
 */
import { tierForStake, type Account } from '@apogee/shared';
import { ApiError } from '../lib/errors';
import { roundTokens } from '../lib/round';
import { StakeModel } from '../models/Stake';
import { UserModel } from '../models/User';

/** Currently staked APG for a wallet (0 when the wallet never staked). */
export async function getStaked(wallet: string): Promise<number> {
  const stake = await StakeModel.findOne({ wallet }).lean();
  return stake?.amount ?? 0;
}

/** Full Account DTO, or null when the wallet has never authenticated. */
export async function getAccount(wallet: string): Promise<Account | null> {
  const user = await UserModel.findOne({ wallet }).lean();
  if (!user) return null;
  const staked = roundTokens(await getStaked(wallet));
  return {
    wallet: user.wallet,
    chainType: user.chainType,
    // Repeated $inc updates can accumulate double dust — round at the wire.
    usdcBalance: roundTokens(user.usdcBalance),
    apgBalance: roundTokens(user.apgBalance),
    staked,
    tierKey: tierForStake(staked)?.key ?? null,
  };
}

/** Like getAccount but 404s — for authenticated flows where the user must exist. */
export async function requireAccount(wallet: string): Promise<Account> {
  const account = await getAccount(wallet);
  if (!account) throw new ApiError(404, 'NOT_FOUND', 'Account not found');
  return account;
}

/** Move wallet APG → stake. Atomic: the balance check + deduct is one findOneAndUpdate. */
export async function stake(wallet: string, rawAmount: number): Promise<Account> {
  const amount = roundTokens(rawAmount);
  if (amount <= 0) throw new ApiError(400, 'VALIDATION', 'amount must be positive');

  const user = await UserModel.findOneAndUpdate(
    { wallet, apgBalance: { $gte: amount } },
    { $inc: { apgBalance: -amount } },
    { new: true },
  );
  if (!user) {
    const exists = await UserModel.exists({ wallet });
    if (!exists) throw new ApiError(404, 'NOT_FOUND', 'Account not found');
    throw new ApiError(400, 'INSUFFICIENT_FUNDS', 'Not enough APG in wallet to stake that amount');
  }

  await StakeModel.findOneAndUpdate(
    { wallet },
    { $inc: { amount }, $set: { updatedAt: new Date() } },
    { upsert: true, new: true },
  );

  return requireAccount(wallet);
}

/** Move stake → wallet APG. Atomic guard on the staked amount. */
export async function unstake(wallet: string, rawAmount: number): Promise<Account> {
  const amount = roundTokens(rawAmount);
  if (amount <= 0) throw new ApiError(400, 'VALIDATION', 'amount must be positive');

  const stakeDoc = await StakeModel.findOneAndUpdate(
    { wallet, amount: { $gte: amount } },
    { $inc: { amount: -amount }, $set: { updatedAt: new Date() } },
    { new: true },
  );
  if (!stakeDoc) {
    throw new ApiError(400, 'INSUFFICIENT_STAKE', 'Not enough staked APG to unstake that amount');
  }

  await UserModel.updateOne({ wallet }, { $inc: { apgBalance: amount } });

  return requireAccount(wallet);
}

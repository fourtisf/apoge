import mongoose, { Schema, type HydratedDocument } from 'mongoose';
import type { ChainType } from '@apogee/shared';

export interface UserEntity {
  /** Unique. Lowercased for EVM, verbatim base58 for Solana. */
  wallet: string;
  chainType: ChainType;
  /** Off-chain accounted demo balances (Phase 1). */
  usdcBalance: number;
  apgBalance: number;
  createdAt: Date;
}

const userSchema = new Schema<UserEntity>(
  {
    wallet: { type: String, required: true, unique: true },
    chainType: { type: String, required: true, enum: ['sol', 'evm'] },
    usdcBalance: { type: Number, required: true, default: 25_000 },
    apgBalance: { type: Number, required: true, default: 60_000 },
    createdAt: { type: Date, required: true, default: () => new Date() },
  },
  { versionKey: false },
);

export type UserDoc = HydratedDocument<UserEntity>;

export const UserModel = mongoose.model<UserEntity>('User', userSchema);

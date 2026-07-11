import mongoose, { Schema, type HydratedDocument } from 'mongoose';

export interface StakeEntity {
  /** One stake record per wallet. */
  wallet: string;
  /** Total APG currently staked. */
  amount: number;
  updatedAt: Date;
}

const stakeSchema = new Schema<StakeEntity>(
  {
    wallet: { type: String, required: true, unique: true },
    amount: { type: Number, required: true, default: 0 },
    updatedAt: { type: Date, required: true, default: () => new Date() },
  },
  { versionKey: false },
);

export type StakeDoc = HydratedDocument<StakeEntity>;

export const StakeModel = mongoose.model<StakeEntity>('Stake', stakeSchema);

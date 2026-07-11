import mongoose, { Schema, type HydratedDocument, type Types } from 'mongoose';

export interface PositionEntity {
  wallet: string;
  projectId: Types.ObjectId;
  /** USD invested (excluding fees). */
  invested: number;
  /** Tokens purchased. */
  tokens: number;
  /** Tokens already claimed against the vesting curve. */
  claimedTokens: number;
  /** Latest participation reference, `APG-` + 10 hex chars. */
  txRef: string;
  createdAt: Date;
}

const positionSchema = new Schema<PositionEntity>(
  {
    wallet: { type: String, required: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    invested: { type: Number, required: true, default: 0 },
    tokens: { type: Number, required: true, default: 0 },
    claimedTokens: { type: Number, required: true, default: 0 },
    txRef: { type: String, required: true },
    createdAt: { type: Date, required: true, default: () => new Date() },
  },
  { versionKey: false },
);

// One position per (wallet, sale); participate upserts into it.
positionSchema.index({ wallet: 1, projectId: 1 }, { unique: true });

export type PositionDoc = HydratedDocument<PositionEntity>;

export const PositionModel = mongoose.model<PositionEntity>('Position', positionSchema);

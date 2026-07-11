import mongoose, { Schema, type HydratedDocument } from 'mongoose';

export interface NonceEntity {
  /** One pending nonce per wallet (upserted on each request). */
  wallet: string;
  nonce: string;
  expiresAt: Date;
}

const nonceSchema = new Schema<NonceEntity>(
  {
    wallet: { type: String, required: true, unique: true },
    nonce: { type: String, required: true },
    // TTL index: Mongo reaps the doc at `expiresAt`. TTL sweeps run ~every
    // 60s, so verify also checks expiresAt explicitly.
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { versionKey: false },
);

export type NonceDoc = HydratedDocument<NonceEntity>;

export const NonceModel = mongoose.model<NonceEntity>('Nonce', nonceSchema);

import mongoose, { Schema, type HydratedDocument } from 'mongoose';
import type { ApplicationDTO, ApplicationStatus, Chain } from '@apogee/shared';

export interface ApplicationEntity {
  projectName: string;
  ticker: string;
  chain: Chain;
  website: string;
  contactEmail: string;
  pitch: string;
  raiseTarget: number;
  x?: string;
  telegram?: string;
  logoUrl?: string;
  devHandle?: string;
  devEmail?: string;
  ts: Date;
  status: ApplicationStatus;
  reviewedAt?: Date | null;
}

const applicationSchema = new Schema<ApplicationEntity>(
  {
    projectName: { type: String, required: true },
    ticker: { type: String, required: true },
    chain: { type: String, required: true, enum: ['SOL', 'ETH', 'BASE', 'BNB'] },
    website: { type: String, required: true },
    contactEmail: { type: String, required: true },
    pitch: { type: String, required: true },
    raiseTarget: { type: Number, required: true, default: 0 },
    x: { type: String },
    telegram: { type: String },
    logoUrl: { type: String },
    devHandle: { type: String },
    devEmail: { type: String },
    ts: { type: Date, required: true, default: () => new Date() },
    status: {
      type: String,
      required: true,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'pending',
      index: true,
    },
    reviewedAt: { type: Date, default: null },
  },
  { versionKey: false },
);

export type ApplicationDoc = HydratedDocument<ApplicationEntity>;

export const ApplicationModel = mongoose.model<ApplicationEntity>('Application', applicationSchema);

export function toApplicationDTO(doc: ApplicationDoc): ApplicationDTO {
  return {
    id: doc._id.toString(),
    projectName: doc.projectName,
    ticker: doc.ticker,
    chain: doc.chain,
    website: doc.website,
    contactEmail: doc.contactEmail,
    pitch: doc.pitch,
    raiseTarget: doc.raiseTarget ?? 0,
    ...(doc.x ? { x: doc.x } : {}),
    ...(doc.telegram ? { telegram: doc.telegram } : {}),
    ...(doc.logoUrl ? { logoUrl: doc.logoUrl } : {}),
    ...(doc.devHandle ? { devHandle: doc.devHandle } : {}),
    ...(doc.devEmail ? { devEmail: doc.devEmail } : {}),
    ts: doc.ts.toISOString(),
    // Legacy rows created before this field default to 'pending'.
    status: doc.status ?? 'pending',
    ...(doc.reviewedAt ? { reviewedAt: doc.reviewedAt.toISOString() } : {}),
  };
}

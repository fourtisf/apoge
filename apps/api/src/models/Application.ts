import mongoose, { Schema, type HydratedDocument } from 'mongoose';
import type { ApplicationDTO, Chain } from '@apogee/shared';

export interface ApplicationEntity {
  projectName: string;
  ticker: string;
  chain: Chain;
  website: string;
  contactEmail: string;
  pitch: string;
  ts: Date;
}

const applicationSchema = new Schema<ApplicationEntity>(
  {
    projectName: { type: String, required: true },
    ticker: { type: String, required: true },
    chain: { type: String, required: true, enum: ['SOL', 'ETH', 'BASE', 'BNB'] },
    website: { type: String, required: true },
    contactEmail: { type: String, required: true },
    pitch: { type: String, required: true },
    ts: { type: Date, required: true, default: () => new Date() },
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
    ts: doc.ts.toISOString(),
  };
}

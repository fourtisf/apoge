import mongoose, { Schema, type HydratedDocument } from 'mongoose';
import type { Project } from '@apogee/shared';

// Sub-schemas carry `_id: false` so serialized projects mirror the shared
// `Project` type exactly.
const logoSchema = new Schema<Project['logo']>(
  {
    letter: { type: String, required: true },
    from: { type: String, required: true },
    to: { type: String, required: true },
  },
  { _id: false },
);

const tokenomicsSchema = new Schema<Project['tokenomics'][number]>(
  {
    label: { type: String, required: true },
    pct: { type: Number, required: true },
  },
  { _id: false },
);

const vestingSchema = new Schema<Project['vesting']>(
  {
    tgePct: { type: Number, required: true },
    cliffMonths: { type: Number, required: true },
    linearMonths: { type: Number, required: true },
  },
  { _id: false },
);

const socialsSchema = new Schema<Project['socials']>(
  {
    website: String,
    x: String,
    discord: String,
    docs: String,
  },
  { _id: false },
);

/** Internal persistence shape: shared Project + indexer cursor. */
export type ProjectEntity = Project & { lastIndexedBlock?: number };

const projectSchema = new Schema<ProjectEntity>(
  {
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    ticker: { type: String, required: true },
    chain: { type: String, required: true, enum: ['SOL', 'ETH', 'BASE', 'BNB'] },
    sector: { type: String, required: true },
    status: { type: String, required: true, enum: ['live', 'upcoming', 'tba', 'ended'] },
    description: { type: String, required: true },
    about: { type: String, required: true },
    highlights: { type: [String], required: true },
    logo: { type: logoSchema, required: true },
    contract: { type: String, default: null },
    socials: { type: socialsSchema, default: {} },
    tokenomics: { type: [tokenomicsSchema], required: true },
    vesting: { type: vestingSchema, required: true },
    supply: { type: Number, required: true },
    initMcap: { type: Number, required: true },
    fdv: { type: Number, required: true },
    listing: { type: String, required: true },
    softCap: { type: Number, required: true },
    hardCap: { type: Number, required: true },
    price: { type: Number, required: true },
    // ISO strings (or null for TBA), matching the shared type verbatim.
    startAt: { type: String, default: null },
    endAt: { type: String, default: null },
    raised: { type: Number, required: true, default: 0 },
    participants: { type: Number, required: true, default: 0 },
    audited: { type: Boolean, required: true },
    kycTeam: { type: Boolean, required: true },
    auditUrl: { type: String },
    featured: { type: Boolean },
    // Phase 3 on-chain settlement.
    settlement: { type: String, enum: ['offchain', 'onchain'] },
    chainId: { type: Number },
    saleContract: { type: String },
    // Internal indexer cursor — never serialized to clients.
    lastIndexedBlock: { type: Number },
    // Post-listing performance — only present for ended sales.
    roi: { type: Number },
    ath: { type: Number },
    cex: { type: [String], default: undefined },
  },
  { versionKey: false, minimize: false },
);

export type ProjectDoc = HydratedDocument<ProjectEntity>;

export const ProjectModel = mongoose.model<ProjectEntity>('Project', projectSchema);

/** Strip Mongo internals so the wire shape is exactly the shared `Project`. */
export function serializeProject(doc: ProjectDoc): Project {
  const { _id, ...project } = doc.toObject<
    Project & { _id: unknown; lastIndexedBlock?: number }
  >();
  delete (project as { lastIndexedBlock?: number }).lastIndexedBlock;
  // raised is $inc-mutated by participations — keep the wire value at 2dp.
  project.raised = Math.round(project.raised * 100) / 100;
  return project as Project;
}

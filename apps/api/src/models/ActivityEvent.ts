import mongoose, { Schema, type HydratedDocument, type Types } from 'mongoose';

export interface ActivityEventEntity {
  /** FULL wallet address — truncated only at DTO mapping time. */
  wallet: string;
  projectId: Types.ObjectId;
  amountUsd: number;
  ts: Date;
}

const activityEventSchema = new Schema<ActivityEventEntity>(
  {
    wallet: { type: String, required: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    amountUsd: { type: Number, required: true },
    ts: { type: Date, required: true, default: () => new Date() },
  },
  { versionKey: false },
);

activityEventSchema.index({ ts: -1 });

export type ActivityEventDoc = HydratedDocument<ActivityEventEntity>;

export const ActivityEventModel = mongoose.model<ActivityEventEntity>(
  'ActivityEvent',
  activityEventSchema,
);

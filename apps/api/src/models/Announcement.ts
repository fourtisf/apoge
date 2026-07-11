import mongoose, { Schema, type HydratedDocument } from 'mongoose';
import type { AnnouncementDTO } from '@apogee/shared';

export interface AnnouncementEntity {
  title: string;
  body: string;
  tag: 'news' | 'update' | 'alert';
  ts: Date;
}

const announcementSchema = new Schema<AnnouncementEntity>(
  {
    title: { type: String, required: true },
    body: { type: String, required: true },
    tag: { type: String, required: true, enum: ['news', 'update', 'alert'], default: 'news' },
    ts: { type: Date, required: true, default: () => new Date() },
  },
  { versionKey: false },
);

announcementSchema.index({ ts: -1 });

export type AnnouncementDoc = HydratedDocument<AnnouncementEntity>;

export const AnnouncementModel = mongoose.model<AnnouncementEntity>(
  'Announcement',
  announcementSchema,
);

export function toAnnouncementDTO(doc: AnnouncementDoc): AnnouncementDTO {
  return {
    id: doc._id.toString(),
    title: doc.title,
    body: doc.body,
    tag: doc.tag,
    ts: doc.ts.toISOString(),
  };
}

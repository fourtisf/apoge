import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler';
import { AnnouncementModel, toAnnouncementDTO } from '../models/Announcement';

export const newsRouter = Router();

/** Latest 20 operator announcements, newest first. */
newsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const docs = await AnnouncementModel.find().sort({ ts: -1 }).limit(20);
    res.json({ announcements: docs.map(toAnnouncementDTO) });
  }),
);

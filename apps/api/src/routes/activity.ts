import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler';
import { latestEvents } from '../services/ActivityService';

export const activityRouter = Router();

/** GET /api/activity — latest 20 events, newest first. */
activityRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json({ events: await latestEvents(20) });
  }),
);

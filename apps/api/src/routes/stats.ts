import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler';
import { getStats } from '../services/SaleService';

export const statsRouter = Router();

/** GET /api/stats */
statsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json({ stats: await getStats() });
  }),
);

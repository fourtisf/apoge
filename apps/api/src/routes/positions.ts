import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/asyncHandler';
import { requireAuth } from '../middleware/auth';
import { claim } from '../services/VestingService';

const paramsSchema = z.object({ id: z.string().min(1).max(64) });

export const positionsRouter = Router();

/** POST /api/positions/:id/claim — claim vested tokens on own position. */
positionsRouter.post(
  '/:id/claim',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { id } = paramsSchema.parse(req.params);
    res.json(await claim(req.wallet as string, id));
  }),
);

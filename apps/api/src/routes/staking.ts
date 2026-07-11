import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/asyncHandler';
import { requireAuth } from '../middleware/auth';
import { stake, unstake } from '../services/StakingService';

const bodySchema = z.object({ amount: z.number().finite().positive() });

export const stakingRouter = Router();

/** POST /api/staking/stake { amount } — wallet APG → stake. */
stakingRouter.post(
  '/stake',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { amount } = bodySchema.parse(req.body);
    res.json({ account: await stake(req.wallet as string, amount) });
  }),
);

/** POST /api/staking/unstake { amount } — stake → wallet APG. */
stakingRouter.post(
  '/unstake',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { amount } = bodySchema.parse(req.body);
    res.json({ account: await unstake(req.wallet as string, amount) });
  }),
);

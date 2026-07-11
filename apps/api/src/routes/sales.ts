import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/asyncHandler';
import { requireAuth } from '../middleware/auth';
import { participateLimiter } from '../middleware/rateLimit';
import { participate } from '../services/SaleService';

const paramsSchema = z.object({ slug: z.string().min(1).max(64) });
// Business minimums (MIN_BUY, tier caps…) are enforced in SaleService so the
// contract's validation order and error codes are preserved.
const bodySchema = z.object({ amountUsd: z.number().finite().positive() });

export const salesRouter = Router();

/** POST /api/sales/:slug/participate { amountUsd } */
salesRouter.post(
  '/:slug/participate',
  participateLimiter,
  requireAuth,
  asyncHandler(async (req, res) => {
    const { slug } = paramsSchema.parse(req.params);
    const { amountUsd } = bodySchema.parse(req.body);
    res.json(await participate(req.wallet as string, slug, amountUsd));
  }),
);

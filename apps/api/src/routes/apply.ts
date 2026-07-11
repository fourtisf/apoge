import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/asyncHandler';
import { applyLimiter } from '../middleware/rateLimit';
import { ApplicationModel, toApplicationDTO } from '../models/Application';

const applySchema = z.object({
  projectName: z.string().min(2).max(64),
  ticker: z.string().min(1).max(12),
  chain: z.enum(['SOL', 'ETH', 'BASE', 'BNB']),
  website: z.string().url().max(200),
  contactEmail: z.string().email().max(120),
  pitch: z.string().min(30).max(2000),
});

export const applyRouter = Router();

/** Public "Apply for launch" intake — lands in the admin inbox. */
applyRouter.post(
  '/',
  applyLimiter,
  asyncHandler(async (req, res) => {
    const input = applySchema.parse(req.body);
    const doc = await ApplicationModel.create(input);
    res.status(201).json({ application: toApplicationDTO(doc) });
  }),
);

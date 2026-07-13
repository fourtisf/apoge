import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/asyncHandler';
import { notifyOps } from '../lib/notify';
import { applyLimiter } from '../middleware/rateLimit';
import { ApplicationModel, toApplicationDTO } from '../models/Application';

const optionalUrl = z.string().url().max(300).optional().or(z.literal(''));

// Client uploads a logo, resized to a small square and encoded as a data URL.
const optionalLogo = z
  .string()
  .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/, 'logo must be an uploaded image')
  .max(600_000)
  .optional()
  .or(z.literal(''));

const applySchema = z.object({
  projectName: z.string().min(2).max(64),
  ticker: z.string().min(1).max(12),
  chain: z.enum(['SOL', 'ETH', 'BASE', 'BNB']),
  website: z.string().url().max(200),
  contactEmail: z.string().email().max(120),
  pitch: z.string().min(30).max(2000),
  raiseTarget: z.number().positive().max(1_000_000_000),
  x: optionalUrl,
  telegram: optionalUrl,
  logo: optionalLogo,
  devHandle: z.string().max(64).optional().or(z.literal('')),
  devEmail: z.string().email().max(120).optional().or(z.literal('')),
});

/** Drop empty-string optionals so they don't persist as ''. */
function cleanApplyInput(input: z.infer<typeof applySchema>) {
  const trimmed = Object.fromEntries(
    Object.entries(input).filter(([, v]) => !(typeof v === 'string' && v.length === 0)),
  );
  return trimmed as z.infer<typeof applySchema>;
}

const usd = (n: number) => `$${n.toLocaleString('en-US')}`;

export const applyRouter = Router();

/** Public "Apply for launch" intake — lands in the admin inbox. */
applyRouter.post(
  '/',
  applyLimiter,
  asyncHandler(async (req, res) => {
    const input = cleanApplyInput(applySchema.parse(req.body));
    const doc = await ApplicationModel.create(input);
    notifyOps(
      `📬 New launch application: <b>${input.projectName}</b> (${input.ticker} · ${input.chain})\n` +
        `Raise target: ${usd(input.raiseTarget)}\n${input.website}`,
    );
    res.status(201).json({ application: toApplicationDTO(doc) });
  }),
);

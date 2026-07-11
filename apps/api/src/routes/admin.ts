import crypto from 'node:crypto';
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../env';
import { asyncHandler } from '../lib/asyncHandler';
import { ApiError } from '../lib/errors';
import { requireAdmin } from '../middleware/adminAuth';
import { adminLoginLimiter } from '../middleware/rateLimit';
import { ApplicationModel, toApplicationDTO } from '../models/Application';
import { PositionModel } from '../models/Position';
import { ProjectModel, serializeProject } from '../models/Project';
import { listProjects } from '../services/SaleService';

export const adminRouter = Router();

/* ── Login ────────────────────────────────────────────────────────── */

const loginSchema = z.object({ password: z.string().min(1).max(256) });

adminRouter.post(
  '/login',
  adminLoginLimiter,
  asyncHandler(async (req, res) => {
    const { password } = loginSchema.parse(req.body);
    if (!env.ADMIN_PASSWORD) {
      throw new ApiError(503, 'ADMIN_DISABLED', 'Set ADMIN_PASSWORD to enable the admin panel');
    }
    const given = Buffer.from(password);
    const expected = Buffer.from(env.ADMIN_PASSWORD);
    const match =
      given.length === expected.length && crypto.timingSafeEqual(given, expected);
    if (!match) throw new ApiError(401, 'INVALID_PASSWORD', 'Wrong admin password');

    const token = jwt.sign({ role: 'admin' }, env.JWT_SECRET, { expiresIn: '4h' });
    res.json({ token });
  }),
);

/* ── Project CRUD ─────────────────────────────────────────────────── */

const projectInputSchema = z.object({
  slug: z
    .string()
    .min(2)
    .max(48)
    .regex(/^[a-z0-9-]+$/, 'lowercase letters, digits and dashes only'),
  name: z.string().min(1).max(64),
  ticker: z.string().min(1).max(12),
  chain: z.enum(['SOL', 'ETH', 'BASE', 'BNB']),
  sector: z.string().min(1).max(24),
  status: z.enum(['live', 'upcoming', 'tba', 'ended']),
  description: z.string().min(1).max(300),
  about: z.string().min(1).max(2000),
  highlights: z.array(z.string().min(1).max(200)).max(8),
  logo: z.object({
    letter: z.string().min(1).max(2),
    from: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    to: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  }),
  contract: z.string().max(64).nullable(),
  socials: z.object({
    website: z.string().url().optional().or(z.literal('')),
    x: z.string().url().optional().or(z.literal('')),
    discord: z.string().url().optional().or(z.literal('')),
    docs: z.string().url().optional().or(z.literal('')),
  }),
  tokenomics: z
    .array(z.object({ label: z.string().min(1).max(32), pct: z.number().min(0).max(100) }))
    .min(1)
    .max(10)
    .refine(
      (slices) => Math.abs(slices.reduce((sum, s) => sum + s.pct, 0) - 100) < 0.01,
      'tokenomics percentages must sum to 100',
    ),
  vesting: z.object({
    tgePct: z.number().min(0).max(100),
    cliffMonths: z.number().min(0).max(60),
    linearMonths: z.number().min(0).max(120),
  }),
  supply: z.number().positive(),
  initMcap: z.number().positive(),
  fdv: z.number().positive(),
  listing: z.string().min(1).max(80),
  softCap: z.number().positive(),
  hardCap: z.number().positive(),
  price: z.number().positive(),
  startAt: z.string().datetime({ offset: true }).nullable(),
  endAt: z.string().datetime({ offset: true }).nullable(),
  raised: z.number().min(0).default(0),
  participants: z.number().int().min(0).default(0),
  audited: z.boolean(),
  kycTeam: z.boolean(),
  auditUrl: z.string().url().optional().or(z.literal('')),
  featured: z.boolean().optional(),
  settlement: z.enum(['offchain', 'onchain']).optional(),
  chainId: z.number().int().positive().optional(),
  saleContract: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/, 'must be a 0x… contract address')
    .optional()
    .or(z.literal('')),
  roi: z.number().positive().optional(),
  ath: z.number().positive().optional(),
  cex: z.array(z.string().min(1).max(24)).max(8).optional(),
}).superRefine((val, ctx) => {
  if (val.settlement === 'onchain' && (!val.chainId || !val.saleContract)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['saleContract'],
      message: 'onchain settlement requires both chainId and saleContract',
    });
  }
});

/** '' → undefined so optional URL fields don't persist empty strings. */
function cleanProjectInput(input: z.infer<typeof projectInputSchema>) {
  const socials = Object.fromEntries(
    Object.entries(input.socials).filter(([, v]) => v && v.length > 0),
  );
  return {
    ...input,
    socials,
    auditUrl: input.auditUrl || undefined,
    saleContract: input.saleContract || undefined,
  };
}

adminRouter.use(requireAdmin);

adminRouter.get(
  '/projects',
  asyncHandler(async (_req, res) => {
    res.json({ projects: await listProjects() });
  }),
);

adminRouter.post(
  '/projects',
  asyncHandler(async (req, res) => {
    const input = cleanProjectInput(projectInputSchema.parse(req.body));
    if (await ProjectModel.exists({ slug: input.slug })) {
      throw new ApiError(409, 'SLUG_TAKEN', `A project with slug "${input.slug}" already exists`);
    }
    const doc = await ProjectModel.create(input);
    res.status(201).json({ project: serializeProject(doc) });
  }),
);

adminRouter.put(
  '/projects/:slug',
  asyncHandler(async (req, res) => {
    const slug = z.string().parse(req.params.slug);
    const input = cleanProjectInput(projectInputSchema.parse(req.body));
    if (input.slug !== slug && (await ProjectModel.exists({ slug: input.slug }))) {
      throw new ApiError(409, 'SLUG_TAKEN', `A project with slug "${input.slug}" already exists`);
    }
    const doc = await ProjectModel.findOneAndUpdate({ slug }, input, { new: true });
    if (!doc) throw new ApiError(404, 'NOT_FOUND', 'Project not found');
    res.json({ project: serializeProject(doc) });
  }),
);

adminRouter.delete(
  '/projects/:slug',
  asyncHandler(async (req, res) => {
    const slug = z.string().parse(req.params.slug);
    const doc = await ProjectModel.findOne({ slug });
    if (!doc) throw new ApiError(404, 'NOT_FOUND', 'Project not found');
    const positions = await PositionModel.countDocuments({ projectId: doc._id });
    if (positions > 0) {
      throw new ApiError(
        409,
        'HAS_POSITIONS',
        `${positions} wallet(s) hold positions in this sale — it can't be deleted`,
      );
    }
    await doc.deleteOne();
    res.json({ deleted: slug });
  }),
);

/* ── Applications inbox ───────────────────────────────────────────── */

adminRouter.get(
  '/applications',
  asyncHandler(async (_req, res) => {
    const docs = await ApplicationModel.find().sort({ ts: -1 }).limit(200);
    res.json({ applications: docs.map(toApplicationDTO) });
  }),
);

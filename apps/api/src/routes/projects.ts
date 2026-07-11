import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/asyncHandler';
import { getProjectBySlug, listProjects } from '../services/SaleService';

const listQuerySchema = z.object({
  status: z.enum(['live', 'upcoming', 'tba', 'ended']).optional(),
  chain: z.enum(['SOL', 'ETH', 'BASE', 'BNB']).optional(),
});

const slugParamsSchema = z.object({
  slug: z.string().min(1).max(64),
});

export const projectsRouter = Router();

/** GET /api/projects?status=&chain= */
projectsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const filters = listQuerySchema.parse(req.query);
    res.json({ projects: await listProjects(filters) });
  }),
);

/** GET /api/projects/:slug */
projectsRouter.get(
  '/:slug',
  asyncHandler(async (req, res) => {
    const { slug } = slugParamsSchema.parse(req.params);
    res.json({ project: await getProjectBySlug(slug) });
  }),
);

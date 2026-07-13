import { Router } from 'express';
import { z } from 'zod';
import type { PublicApplicationDTO } from '@apogee/shared';
import { asyncHandler } from '../lib/asyncHandler';
import { ApiError } from '../lib/errors';
import { ApplicationModel } from '../models/Application';

export const applicationsRouter = Router();

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/);

/**
 * Public list of launch applications with their status. Deliberately
 * PII-free — contact/dev emails and the dev handle are never exposed here;
 * the logo is served as a URL, not an inline data blob.
 */
applicationsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const docs = await ApplicationModel.aggregate([
      { $sort: { ts: -1 } },
      { $limit: 120 },
      {
        $project: {
          projectName: 1,
          ticker: 1,
          chain: 1,
          website: 1,
          pitch: 1,
          raiseTarget: 1,
          x: 1,
          telegram: 1,
          status: 1,
          ts: 1,
          hasLogo: { $gt: [{ $strLenCP: { $ifNull: ['$logo', ''] } }, 0] },
        },
      },
    ]);

    const applications: PublicApplicationDTO[] = docs.map((d) => ({
      id: d._id.toString(),
      projectName: d.projectName,
      ticker: d.ticker,
      chain: d.chain,
      website: d.website,
      pitch: d.pitch,
      raiseTarget: d.raiseTarget ?? 0,
      status: d.status ?? 'pending',
      ...(d.x ? { x: d.x } : {}),
      ...(d.telegram ? { telegram: d.telegram } : {}),
      ...(d.hasLogo ? { logo: `/api/applications/${d._id.toString()}/logo` } : {}),
      ts: (d.ts instanceof Date ? d.ts : new Date(d.ts)).toISOString(),
    }));

    res.json({ applications });
  }),
);

/** Serve a stored (resized) logo as an image so lists stay small and cacheable. */
applicationsRouter.get(
  '/:id/logo',
  asyncHandler(async (req, res) => {
    const id = objectId.parse(req.params.id);
    const doc = await ApplicationModel.findById(id).select('logo').lean();
    const match = doc?.logo
      ? /^data:(image\/(?:png|jpeg|webp|svg\+xml));base64,([A-Za-z0-9+/=]+)$/.exec(doc.logo)
      : null;
    if (!match) throw new ApiError(404, 'NOT_FOUND', 'No logo for this application');
    const buf = Buffer.from(match[2]!, 'base64');
    res.setHeader('Content-Type', match[1]!);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(buf);
  }),
);

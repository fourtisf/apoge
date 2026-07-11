import { Router } from 'express';
import { env } from '../env';
import { asyncHandler } from '../lib/asyncHandler';
import { ProjectModel } from '../models/Project';

export const sitemapRouter = Router();

/** Dynamic sitemap: core routes + every sale page. Nginx proxies /sitemap.xml here. */
sitemapRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const projects = await ProjectModel.find().select('slug').lean();
    const now = new Date().toISOString().slice(0, 10);
    const urls = [
      { loc: '/', priority: '1.0' },
      { loc: '/staking', priority: '0.8' },
      { loc: '/stats', priority: '0.7' },
      { loc: '/leaderboard', priority: '0.7' },
      { loc: '/token', priority: '0.7' },
      { loc: '/news', priority: '0.7' },
      { loc: '/how-it-works', priority: '0.7' },
      { loc: '/apply', priority: '0.6' },
      ...projects.map((p) => ({ loc: `/sale/${p.slug}`, priority: '0.9' })),
    ];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url><loc>${env.PUBLIC_ORIGIN}${u.loc}</loc><lastmod>${now}</lastmod><priority>${u.priority}</priority></url>`,
  )
  .join('\n')}
</urlset>`;
    res.type('application/xml').send(xml);
  }),
);

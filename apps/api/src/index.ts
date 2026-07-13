import http from 'node:http';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { connectDb } from './db';
import { env } from './env';
import { errorHandler, notFoundHandler } from './middleware/errors';
import { postLimiter } from './middleware/rateLimit';
import { initRealtime } from './realtime';
import { startChainIndexer } from './services/ChainIndexer';
import { startSaleScheduler } from './services/SaleScheduler';
import { activityRouter } from './routes/activity';
import { adminRouter } from './routes/admin';
import { applyRouter } from './routes/apply';
import { applicationsRouter } from './routes/applications';
import { authRouter } from './routes/auth';
import { leaderboardRouter } from './routes/leaderboard';
import { newsRouter } from './routes/news';
import { portfolioRouter } from './routes/portfolio';
import { positionsRouter } from './routes/positions';
import { projectsRouter } from './routes/projects';
import { onchainRouter } from './routes/onchain';
import { salesRouter } from './routes/sales';
import { sitemapRouter } from './routes/sitemap';
import { stakingRouter } from './routes/staking';
import { statsRouter } from './routes/stats';

async function main(): Promise<void> {
  await connectDb();

  const app = express();
  // Behind Nginx (prod) / the Vite proxy (dev) — trust only local proxies so
  // express-rate-limit keys on the real client IP.
  app.set('trust proxy', 'loopback');
  app.disable('x-powered-by');

  app.use(helmet());
  // Dev + prod both front the API with a same-origin proxy, so permissive
  // CORS is fine here.
  app.use(cors());
  // The apply form embeds a small (client-resized) logo as a data URL, so give
  // that one route more headroom than the 100kb default.
  app.use('/api/apply', express.json({ limit: '600kb' }));
  app.use(express.json({ limit: '100kb' }));

  // 30 POSTs/min per IP across the API (participate adds its own 10/min).
  app.use('/api', postLimiter);

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/apply', applyRouter);
  app.use('/api/applications', applicationsRouter);
  app.use('/api/onchain', onchainRouter);
  app.use('/api/leaderboard', leaderboardRouter);
  app.use('/api/news', newsRouter);
  app.use('/sitemap.xml', sitemapRouter);
  app.use('/api/projects', projectsRouter);
  app.use('/api/stats', statsRouter);
  app.use('/api/activity', activityRouter);
  app.use('/api/sales', salesRouter);
  app.use('/api/staking', stakingRouter);
  app.use('/api/positions', positionsRouter);
  app.use('/api', portfolioRouter); // /api/portfolio/:wallet + /api/account/:wallet

  app.use('/api', notFoundHandler);
  app.use(errorHandler);

  const server = http.createServer(app);
  initRealtime(server);
  startSaleScheduler();
  startChainIndexer();

  server.listen(env.PORT, () => {
    console.log(`[api] Apogee API listening on http://localhost:${env.PORT}`);
    if (env.DEMO_MODE) console.log('[api] DEMO_MODE is ON — "demo" signatures are accepted');
  });
}

main().catch((err) => {
  console.error('[api] fatal boot error:', err);
  process.exit(1);
});

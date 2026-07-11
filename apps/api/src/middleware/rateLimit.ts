import rateLimit from 'express-rate-limit';

const rateLimitBody = (message: string) => ({
  error: { code: 'RATE_LIMITED', message },
});

/**
 * Global POST limiter: 30/min per IP. Mounted app-wide under /api with a
 * method skip so GET reads stay unthrottled.
 */
export const postLimiter = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: (req) => req.method !== 'POST',
  message: rateLimitBody('Too many requests — try again in a minute'),
});

/** Stricter limiter for sale participation: 10/min per IP. */
export const participateLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: rateLimitBody('Too many participation attempts — try again in a minute'),
});

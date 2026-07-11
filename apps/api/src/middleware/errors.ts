import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { ApiError } from '../lib/errors';

/** 404 for unknown /api paths, in the contract error shape. */
export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
};

/**
 * Maps thrown errors to the contract shape `{ error: { code, message } }`:
 * - ApiError → its status/code/message
 * - ZodError → 400 VALIDATION with the first issue
 * - body-parser errors (bad JSON, too large) → their 4xx status
 * - anything else → 500 INTERNAL (logged, message not leaked)
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ApiError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }

  if (err instanceof ZodError) {
    const issue = err.issues[0];
    const where = issue && issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
    res.status(400).json({
      error: { code: 'VALIDATION', message: issue ? `${where}${issue.message}` : 'Invalid request' },
    });
    return;
  }

  // body-parser / http-errors style: entity.parse.failed, entity.too.large, …
  const httpErr = err as { status?: number; expose?: boolean; message?: string };
  if (typeof httpErr.status === 'number' && httpErr.status >= 400 && httpErr.status < 500) {
    res.status(httpErr.status).json({
      error: {
        code: 'BAD_REQUEST',
        message: httpErr.expose && httpErr.message ? httpErr.message : 'Bad request',
      },
    });
    return;
  }

  console.error('[api] unhandled error:', err);
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Internal server error' } });
};

import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../env';
import { ApiError } from '../lib/errors';

/** Bearer auth for /api/admin — requires a JWT with role "admin". */
export const requireAdmin: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    next(new ApiError(401, 'UNAUTHORIZED', 'Missing bearer token'));
    return;
  }
  try {
    const payload = jwt.verify(header.slice('Bearer '.length), env.JWT_SECRET) as {
      role?: unknown;
    };
    if (payload.role !== 'admin') throw new Error('not admin');
    next();
  } catch {
    next(new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired admin token'));
  }
};

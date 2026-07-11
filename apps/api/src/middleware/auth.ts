import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import type { ChainType } from '@apogee/shared';
import { env } from '../env';
import { ApiError } from '../lib/errors';

// Augment Express so authenticated handlers get req.wallet / req.chainType.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      wallet?: string;
      chainType?: ChainType;
    }
  }
}

interface JwtClaims {
  wallet?: unknown;
  chainType?: unknown;
}

/**
 * JWT bearer auth. The wallet is ALWAYS taken from the verified token —
 * never from the request body.
 */
export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    next(new ApiError(401, 'UNAUTHORIZED', 'Missing bearer token'));
    return;
  }

  try {
    const payload = jwt.verify(header.slice('Bearer '.length), env.JWT_SECRET) as JwtClaims;
    const { wallet, chainType } = payload;
    if (typeof wallet !== 'string' || (chainType !== 'sol' && chainType !== 'evm')) {
      throw new Error('malformed token payload');
    }
    req.wallet = wallet;
    req.chainType = chainType;
    next();
  } catch {
    next(new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token'));
  }
};

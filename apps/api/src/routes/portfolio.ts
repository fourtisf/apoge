import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/asyncHandler';
import { ApiError } from '../lib/errors';
import { ANY_WALLET_RE, normalizeWalletParam } from '../lib/wallet';
import { getAccount } from '../services/StakingService';
import { getPortfolio } from '../services/VestingService';

const walletParamsSchema = z.object({
  wallet: z.string().regex(ANY_WALLET_RE, 'Invalid wallet address'),
});

/** Hosts both wallet-keyed public reads; mounted at /api in index.ts. */
export const portfolioRouter = Router();

/** GET /api/portfolio/:wallet — empty arrays for unknown wallets (not 404). */
portfolioRouter.get(
  '/portfolio/:wallet',
  asyncHandler(async (req, res) => {
    const { wallet } = walletParamsSchema.parse(req.params);
    res.json(await getPortfolio(normalizeWalletParam(wallet)));
  }),
);

/** GET /api/account/:wallet — 404 if the wallet has never authenticated. */
portfolioRouter.get(
  '/account/:wallet',
  asyncHandler(async (req, res) => {
    const { wallet } = walletParamsSchema.parse(req.params);
    const account = await getAccount(normalizeWalletParam(wallet));
    if (!account) throw new ApiError(404, 'NOT_FOUND', 'Account not found');
    res.json({ account });
  }),
);

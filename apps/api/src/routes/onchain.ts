import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler';
import { onchainConfig } from '../lib/chains';

export const onchainRouter = Router();

/** Per-chain deployed infrastructure addresses (staking/usdc/apg) for the web app. */
onchainRouter.get(
  '/config',
  asyncHandler(async (_req, res) => {
    res.json({ chains: onchainConfig() });
  }),
);

import { PAYMENT_DECIMALS, SALE_ABI } from '@apogee/shared';
import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler';
import { clientFor, onchainConfig } from '../lib/chains';
import { ProjectModel } from '../models/Project';

export const onchainRouter = Router();

/** Per-chain deployed infrastructure addresses (staking/usdc/apg) for the web app. */
onchainRouter.get(
  '/config',
  asyncHandler(async (_req, res) => {
    res.json({ chains: onchainConfig() });
  }),
);

/**
 * GET /api/onchain/status — ops health for the on-chain layer:
 * per configured chain (RPC reachable + head block) and per on-chain sale
 * (raised/hardCap/finalized read live from the contract). Never throws on an
 * unreachable chain — it reports `reachable:false` instead.
 */
onchainRouter.get(
  '/status',
  asyncHandler(async (_req, res) => {
    const cfg = onchainConfig();
    const toUsd = (v: bigint) => Number(v) / 10 ** PAYMENT_DECIMALS;

    const chains = await Promise.all(
      Object.keys(cfg).map(async (chainId) => {
        const client = clientFor(Number(chainId));
        if (!client) return { chainId: Number(chainId), reachable: false, head: null };
        try {
          const head = await client.getBlockNumber();
          return { chainId: Number(chainId), reachable: true, head: Number(head) };
        } catch {
          return { chainId: Number(chainId), reachable: false, head: null };
        }
      }),
    );

    const projects = await ProjectModel.find({
      settlement: 'onchain',
      saleContract: { $nin: [null, ''] },
      chainId: { $ne: null },
    }).select('slug name chainId saleContract hardCap');

    const sales = await Promise.all(
      projects.map(async (p) => {
        const client = clientFor(p.chainId!);
        const base = { slug: p.slug, name: p.name, chainId: p.chainId, saleContract: p.saleContract };
        if (!client) return { ...base, reachable: false };
        try {
          const address = p.saleContract as `0x${string}`;
          const [raised, funded, finalized, succeeded] = (await Promise.all([
            client.readContract({ address, abi: SALE_ABI, functionName: 'raised' }),
            client.readContract({ address, abi: SALE_ABI, functionName: 'funded' }),
            client.readContract({ address, abi: SALE_ABI, functionName: 'finalized' }),
            client.readContract({ address, abi: SALE_ABI, functionName: 'succeeded' }),
          ])) as [bigint, boolean, boolean, boolean];
          return {
            ...base,
            reachable: true,
            funded,
            finalized,
            succeeded,
            raisedUsd: Math.round(toUsd(raised) * 100) / 100,
            hardCapUsd: p.hardCap,
          };
        } catch {
          return { ...base, reachable: false };
        }
      }),
    );

    res.json({ chains, sales });
  }),
);

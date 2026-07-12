/**
 * OnchainPortfolio — reads a wallet's positions in `settlement: 'onchain'`
 * sales straight from the sale contracts (viem), so the portfolio page shows
 * real on-chain allocations, vesting and claimable amounts alongside the
 * off-chain (Phase 1) ones.
 *
 * Claims for these positions happen ON THE CONTRACT (the sale page's buy
 * panel), never through the API — the DTO is flagged `onchain: true` so the
 * UI renders it read-only with a link to claim on-chain.
 */
import { PAYMENT_DECIMALS, SALE_ABI, type PositionDTO } from '@apogee/shared';
import { getAddress, isAddress } from 'viem';
import { clientFor } from '../lib/chains';
import { ProjectModel } from '../models/Project';

const E18 = 10n ** 18n;
const toTokens = (v: bigint) => Math.floor(Number(v) / 1e16) / 100; // 18dp → 2dp
const toUsd = (v: bigint) => Number(v) / 10 ** PAYMENT_DECIMALS;

/** On-chain positions for a wallet across every configured on-chain sale. */
export async function onchainPositionsFor(wallet: string): Promise<PositionDTO[]> {
  if (!isAddress(wallet)) return []; // on-chain sales are EVM-only
  const holder = getAddress(wallet);

  const projects = await ProjectModel.find({
    settlement: 'onchain',
    saleContract: { $nin: [null, ''] },
    chainId: { $ne: null },
  });

  const out: PositionDTO[] = [];
  for (const p of projects) {
    const client = clientFor(p.chainId!);
    if (!client) continue;
    const address = p.saleContract as `0x${string}`;
    try {
      const invested = (await client.readContract({
        address,
        abi: SALE_ABI,
        functionName: 'investedOf',
        args: [holder],
      })) as bigint;
      if (invested === 0n) continue;

      const [tokens, claimed, claimable] = (await Promise.all([
        client.readContract({ address, abi: SALE_ABI, functionName: 'tokensOf', args: [holder] }),
        client.readContract({ address, abi: SALE_ABI, functionName: 'claimedOf', args: [holder] }),
        client.readContract({ address, abi: SALE_ABI, functionName: 'claimableOf', args: [holder] }),
      ])) as [bigint, bigint, bigint];

      const tokensN = toTokens(tokens);
      const claimedN = toTokens(claimed);
      // vestedPct is per-user and exact: (claimed + claimable) / tokens.
      const vestedPct =
        tokens > 0n ? Math.round((Number(claimed + claimable) / Number(tokens)) * 1000) / 10 : 0;

      out.push({
        id: `onchain:${p.chainId}:${p.slug}`,
        wallet: holder,
        projectSlug: p.slug,
        projectName: p.name,
        ticker: p.ticker,
        chain: p.chain,
        logo: { letter: p.logo.letter, from: p.logo.from, to: p.logo.to },
        invested: Math.round(toUsd(invested) * 100) / 100,
        tokens: tokensN,
        price: p.price,
        vestedPct,
        claimableTokens: toTokens(claimable),
        claimedTokens: claimedN,
        txRef: 'on-chain',
        createdAt: new Date().toISOString(),
        onchain: true,
        chainId: p.chainId!,
        saleContract: address,
      });
    } catch {
      // RPC hiccup on one sale shouldn't drop the whole portfolio.
      continue;
    }
  }
  return out;
}

import { Router } from 'express';
import { TIERS, tierForStake, type Chain, type StatsDetailDTO, type TierKey } from '@apogee/shared';
import { asyncHandler } from '../lib/asyncHandler';
import { roundUsd } from '../lib/round';
import { ActivityEventModel } from '../models/ActivityEvent';
import { ProjectModel } from '../models/Project';
import { StakeModel } from '../models/Stake';
import { getStats } from '../services/SaleService';

export const statsRouter = Router();

/** GET /api/stats — the four home tiles. */
statsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json({ stats: await getStats() });
  }),
);

/** GET /api/stats/detail — analytics for the Stats page. */
statsRouter.get(
  '/detail',
  asyncHandler(async (_req, res) => {
    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000);

    const [byChainAgg, ended, volumeAgg, stakes] = await Promise.all([
      ProjectModel.aggregate<{ _id: Chain; raised: number; projects: number }>([
        { $group: { _id: '$chain', raised: { $sum: '$raised' }, projects: { $sum: 1 } } },
      ]),
      ProjectModel.find({ status: 'ended', roi: { $ne: null } })
        .select('name ticker roi ath')
        .sort({ roi: -1 })
        .lean(),
      ActivityEventModel.aggregate<{ _id: string; volume: number; buys: number }>([
        { $match: { ts: { $gte: since } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$ts' } },
            volume: { $sum: '$amountUsd' },
            buys: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      StakeModel.find({ amount: { $gt: 0 } }).select('amount').lean(),
    ]);

    // Zero-fill the last 7 days so the timeline never has holes.
    const volumeByDay: StatsDetailDTO['volumeByDay'] = [];
    for (let i = 6; i >= 0; i--) {
      const day = new Date(Date.now() - i * 24 * 3600 * 1000).toISOString().slice(0, 10);
      const hit = volumeAgg.find((v) => v._id === day);
      volumeByDay.push({ day, volume: roundUsd(hit?.volume ?? 0), buys: hit?.buys ?? 0 });
    }

    const tierCounts = new Map<TierKey, number>();
    for (const s of stakes) {
      const tier = tierForStake(s.amount);
      if (tier) tierCounts.set(tier.key, (tierCounts.get(tier.key) ?? 0) + 1);
    }

    const detail: StatsDetailDTO = {
      byChain: (['SOL', 'ETH', 'BNB', 'BASE'] as Chain[]).map((chain) => {
        const hit = byChainAgg.find((c) => c._id === chain);
        return { chain, raised: roundUsd(hit?.raised ?? 0), projects: hit?.projects ?? 0 };
      }),
      endedRoi: ended.map((p) => ({
        name: p.name,
        ticker: p.ticker,
        roi: p.roi as number,
        ath: p.ath,
      })),
      volumeByDay,
      tierDistribution: TIERS.map((t) => ({
        tierKey: t.key,
        count: tierCounts.get(t.key) ?? 0,
      })),
    };
    res.json({ detail });
  }),
);

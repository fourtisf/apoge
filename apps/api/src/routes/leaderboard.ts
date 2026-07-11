import { Router } from 'express';
import { tierForStake, truncAddr, type LeaderboardDTO } from '@apogee/shared';
import { asyncHandler } from '../lib/asyncHandler';
import { roundUsd } from '../lib/round';
import { PositionModel } from '../models/Position';
import { StakeModel } from '../models/Stake';

export const leaderboardRouter = Router();

/** Top 20 stakers and top 20 buyers — wallets truncated for display. */
leaderboardRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const [stakes, buyers] = await Promise.all([
      StakeModel.find({ amount: { $gt: 0 } }).sort({ amount: -1 }).limit(20).lean(),
      PositionModel.aggregate<{ _id: string; invested: number; buys: number }>([
        { $group: { _id: '$wallet', invested: { $sum: '$invested' }, buys: { $sum: 1 } } },
        { $sort: { invested: -1 } },
        { $limit: 20 },
      ]),
    ]);

    const dto: LeaderboardDTO = {
      stakers: stakes.map((s) => ({
        wallet: truncAddr(s.wallet),
        staked: s.amount,
        tierKey: tierForStake(s.amount)?.key ?? null,
      })),
      buyers: buyers.map((b) => ({
        wallet: truncAddr(b._id),
        invested: roundUsd(b.invested),
        buys: b.buys,
      })),
    };
    res.json(dto);
  }),
);

/**
 * VestingService — vesting math + PositionDTO/portfolio assembly + claims.
 * All vesting curves go through the shared vestedPctFor/claimableTokens
 * helpers so Phase 3 can anchor them to the real on-chain TGE in one place.
 */
import {
  claimableTokens,
  vestedPctFor,
  type PortfolioSummary,
  type PositionDTO,
  type Project,
} from '@apogee/shared';
import { Types } from 'mongoose';
import { ApiError } from '../lib/errors';
import { roundTokens, roundUsd } from '../lib/round';
import { PositionModel } from '../models/Position';
import type { ProjectDoc } from '../models/Project';

/** Minimal position shape needed for DTO assembly (hydrated docs satisfy it). */
interface PositionLike {
  _id: unknown;
  wallet: string;
  invested: number;
  tokens: number;
  claimedTokens: number;
  txRef: string;
  createdAt: Date;
}

type ProjectLike = Pick<Project, 'slug' | 'name' | 'ticker' | 'chain' | 'logo' | 'price' | 'vesting'>;

/** PositionDTO with vestedPct/claimableTokens computed at read time. */
export function toPositionDTO(
  position: PositionLike,
  project: ProjectLike,
  now: number = Date.now(),
): PositionDTO {
  const createdAt = position.createdAt.toISOString();
  const vestedPct = vestedPctFor(project.vesting, createdAt, now);
  // Repeated $inc updates can accumulate double dust — round at the wire.
  const tokens = roundTokens(position.tokens);
  const claimedTokens = roundTokens(position.claimedTokens);
  const claimable = claimableTokens(tokens, claimedTokens, vestedPct);
  return {
    id: String(position._id),
    wallet: position.wallet,
    projectSlug: project.slug,
    projectName: project.name,
    ticker: project.ticker,
    chain: project.chain,
    logo: { letter: project.logo.letter, from: project.logo.from, to: project.logo.to },
    invested: roundUsd(position.invested),
    tokens,
    price: project.price,
    vestedPct,
    claimableTokens: claimable,
    claimedTokens,
    txRef: position.txRef,
    createdAt,
  };
}

export interface Portfolio {
  positions: PositionDTO[];
  summary: PortfolioSummary;
}

/**
 * All positions for a wallet, newest first, plus the summary:
 * estValue = Σ tokens × price × (roi ?? 1); claimableUsd = Σ claimable × price.
 * Unknown wallets get empty arrays (the UI shows the empty state).
 */
export async function getPortfolio(wallet: string): Promise<Portfolio> {
  const docs = await PositionModel.find({ wallet })
    .sort({ createdAt: -1 })
    .populate<{ projectId: ProjectDoc }>('projectId');

  const now = Date.now();
  let invested = 0;
  let estValue = 0;
  let claimableUsd = 0;

  const positions = docs
    .filter((doc) => Boolean(doc.projectId))
    .map((doc) => {
      const project = doc.projectId;
      const dto = toPositionDTO(doc, project, now);
      invested += dto.invested;
      estValue += dto.tokens * project.price * (project.roi ?? 1);
      claimableUsd += dto.claimableTokens * project.price;
      return dto;
    });

  return {
    positions,
    summary: {
      invested: roundUsd(invested),
      estValue: roundUsd(estValue),
      claimableUsd: roundUsd(claimableUsd),
    },
  };
}

export interface ClaimResult {
  position: PositionDTO;
  /** Tokens claimed by this call. */
  claimedTokens: number;
}

/**
 * Claim everything currently claimable on a position (Phase 1 book-keeping).
 * The update carries an optimistic guard on claimedTokens so a concurrent
 * double-claim cannot pay out twice.
 */
export async function claim(wallet: string, positionId: string): Promise<ClaimResult> {
  if (!Types.ObjectId.isValid(positionId)) {
    throw new ApiError(404, 'NOT_FOUND', 'Position not found');
  }

  const doc = await PositionModel.findById(positionId).populate<{ projectId: ProjectDoc }>(
    'projectId',
  );
  // 404 for both "missing" and "not yours" — don't leak other users' ids.
  if (!doc || doc.wallet !== wallet || !doc.projectId) {
    throw new ApiError(404, 'NOT_FOUND', 'Position not found');
  }

  const vestedPct = vestedPctFor(doc.projectId.vesting, doc.createdAt.toISOString());
  const claimable = roundTokens(claimableTokens(doc.tokens, doc.claimedTokens, vestedPct));
  if (claimable <= 0) {
    throw new ApiError(400, 'NOTHING_TO_CLAIM', 'Nothing to claim yet');
  }

  const updated = await PositionModel.findOneAndUpdate(
    { _id: doc._id, wallet, claimedTokens: doc.claimedTokens },
    { $inc: { claimedTokens: claimable } },
    { new: true },
  );
  if (!updated) {
    throw new ApiError(409, 'CONFLICT', 'Position changed concurrently — retry');
  }

  return { position: toPositionDTO(updated, doc.projectId), claimedTokens: claimable };
}

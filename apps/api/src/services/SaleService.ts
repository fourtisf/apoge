/**
 * SaleService — project reads, launch stats, and the participate flow.
 * Phase 3 swaps participate() internals for on-chain settlement; the
 * signature and validation order stay identical.
 */
import crypto from 'node:crypto';
import {
  feeForBuy,
  MIN_BUY_USD,
  tierForStake,
  type Account,
  type Chain,
  type PositionDTO,
  type Project,
  type ProjectStatus,
  type StatsDTO,
} from '@apogee/shared';
import type { FilterQuery } from 'mongoose';
import { ApiError } from '../lib/errors';
import { roundTokens, roundUsd } from '../lib/round';
import { PositionModel, type PositionDoc } from '../models/Position';
import { ProjectModel, serializeProject, type ProjectDoc } from '../models/Project';
import { UserModel } from '../models/User';
import { emitActivity, emitSaleProgress } from '../realtime';
import { recordEvent } from './ActivityService';
import { getStaked, requireAccount } from './StakingService';
import { toPositionDTO } from './VestingService';

const STATUS_ORDER: Record<ProjectStatus, number> = { live: 0, upcoming: 1, tba: 2, ended: 3 };

/** Sort key within a status bucket: upcoming by startAt, everything else by endAt. */
function timeKey(project: Project): number {
  const src = project.status === 'upcoming' ? project.startAt : project.endAt;
  return src ? new Date(src).getTime() : Number.MAX_SAFE_INTEGER;
}

export interface ProjectFilters {
  status?: ProjectStatus;
  chain?: Chain;
}

/** All projects, optionally filtered, sorted live → upcoming → tba → ended then by time ascending. */
export async function listProjects(filters: ProjectFilters = {}): Promise<Project[]> {
  const query: FilterQuery<Project> = {};
  if (filters.status) query.status = filters.status;
  if (filters.chain) query.chain = filters.chain;

  const docs = await ProjectModel.find(query);
  return docs
    .map(serializeProject)
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || timeKey(a) - timeKey(b));
}

export async function getProjectBySlug(slug: string): Promise<Project> {
  const doc = await ProjectModel.findOne({ slug });
  if (!doc) throw new ApiError(404, 'NOT_FOUND', 'Project not found');
  return serializeProject(doc);
}

/** Aggregate launchpad stats for the landing page. */
export async function getStats(): Promise<StatsDTO> {
  const docs = await ProjectModel.find().lean();
  const rois = docs
    .filter((d) => d.status === 'ended' && typeof d.roi === 'number')
    .map((d) => d.roi as number);
  const avgRoi = rois.length
    ? Math.round((rois.reduce((sum, r) => sum + r, 0) / rois.length) * 10) / 10
    : 0;
  return {
    totalRaised: roundUsd(docs.reduce((sum, d) => sum + d.raised, 0)),
    totalParticipants: docs.reduce((sum, d) => sum + d.participants, 0),
    projectsLaunched: docs.length,
    avgRoi,
  };
}

export interface ParticipateResult {
  position: PositionDTO;
  account: Account;
  sale: { slug: string; raised: number; participants: number };
}

/**
 * Participate in a live sale. Validation order per the contract:
 * SALE_NOT_LIVE → NO_TIER → MIN_BUY → TIER_MAX → HARD_CAP → INSUFFICIENT_FUNDS.
 *
 * The pre-checks below produce the contract error codes in order for the
 * normal path; the mutation phase then re-enforces the funds and hard-cap
 * invariants with atomic guarded updates so concurrent requests can never
 * overdraw a balance or oversubscribe the cap.
 */
export async function participate(
  wallet: string,
  slug: string,
  rawAmountUsd: number,
): Promise<ParticipateResult> {
  const amountUsd = roundUsd(rawAmountUsd);
  const now = Date.now();

  // 1. Sale exists, is live, and now is inside [startAt, endAt].
  const project = await ProjectModel.findOne({ slug });
  if (!project) throw new ApiError(404, 'SALE_NOT_LIVE', 'Sale not found');
  const started = project.startAt !== null && new Date(project.startAt).getTime() <= now;
  const notEnded = project.endAt !== null && now <= new Date(project.endAt).getTime();
  if (project.status !== 'live' || !started || !notEnded) {
    throw new ApiError(400, 'SALE_NOT_LIVE', 'Sale is not live');
  }

  // 2. Wallet must hold a tier (staked >= 1,000 APG).
  const staked = await getStaked(wallet);
  const tier = tierForStake(staked);
  if (!tier) throw new ApiError(400, 'NO_TIER', 'Stake at least 1,000 APG to unlock a tier');

  // 3. Minimum buy.
  if (amountUsd < MIN_BUY_USD) {
    throw new ApiError(400, 'MIN_BUY', `Minimum participation is $${MIN_BUY_USD}`);
  }

  // 4. Cumulative per-sale tier cap.
  const existing = await PositionModel.findOne({ wallet, projectId: project._id });
  if (roundUsd((existing?.invested ?? 0) + amountUsd) > tier.maxBuyUsd) {
    throw new ApiError(
      400,
      'TIER_MAX',
      `${tier.name} tier allows up to $${tier.maxBuyUsd} cumulative per sale`,
    );
  }

  // 5. Hard cap (pre-check; enforced atomically again below).
  if (project.raised + amountUsd > project.hardCap) {
    throw new ApiError(409, 'HARD_CAP', 'Sale hard cap reached');
  }

  // 6. Funds: amount + tier fee.
  const fee = feeForBuy(amountUsd, tier);
  const totalCost = roundUsd(amountUsd + fee);
  const balanceCheck = await UserModel.findOne({ wallet }).lean();
  if (!balanceCheck) throw new ApiError(404, 'NOT_FOUND', 'Account not found');
  if (balanceCheck.usdcBalance < totalCost) {
    throw new ApiError(400, 'INSUFFICIENT_FUNDS', 'Insufficient USDC balance (amount + fee)');
  }

  // --- Effects. Each step is an atomic guarded update. ---

  // Deduct funds; the $gte guard makes check+deduct race-safe.
  const paid = await UserModel.findOneAndUpdate(
    { wallet, usdcBalance: { $gte: totalCost } },
    { $inc: { usdcBalance: -totalCost } },
    { new: true },
  );
  if (!paid) throw new ApiError(400, 'INSUFFICIENT_FUNDS', 'Insufficient USDC balance (amount + fee)');

  // Raise, guarded so `raised + amountUsd <= hardCap` holds even under races.
  let updatedProject = await ProjectModel.findOneAndUpdate(
    { _id: project._id, status: 'live', raised: { $lte: roundUsd(project.hardCap - amountUsd) } },
    { $inc: { raised: amountUsd } },
    { new: true },
  );
  if (!updatedProject) {
    // Lost the race to the cap — refund and report HARD_CAP.
    await UserModel.updateOne({ wallet }, { $inc: { usdcBalance: totalCost } });
    throw new ApiError(409, 'HARD_CAP', 'Sale hard cap reached');
  }

  const tokens = roundTokens(amountUsd / project.price);
  const txRef = `APG-${crypto.randomBytes(5).toString('hex')}`;

  // Upsert the (wallet, sale) position. includeResultMetadata tells us
  // whether this insert created it (i.e. first participation in the sale).
  let positionDoc: PositionDoc;
  let isFirstPosition = false;
  try {
    const result = await PositionModel.findOneAndUpdate(
      { wallet, projectId: project._id },
      {
        $inc: { invested: amountUsd, tokens },
        $set: { txRef },
        $setOnInsert: { claimedTokens: 0, createdAt: new Date() },
      },
      { upsert: true, new: true, includeResultMetadata: true },
    );
    isFirstPosition = !result.lastErrorObject?.updatedExisting;
    positionDoc = result.value as PositionDoc;
  } catch (err) {
    // Two concurrent first buys can collide on the unique (wallet, projectId)
    // index; the loser retries as a plain update.
    if ((err as { code?: number }).code !== 11000) throw err;
    positionDoc = (await PositionModel.findOneAndUpdate(
      { wallet, projectId: project._id },
      { $inc: { invested: amountUsd, tokens }, $set: { txRef } },
      { new: true },
    )) as PositionDoc;
  }

  // participants counts unique wallets per sale — bump only on first position.
  if (isFirstPosition) {
    updatedProject =
      (await ProjectModel.findByIdAndUpdate(
        project._id,
        { $inc: { participants: 1 } },
        { new: true },
      )) ?? updatedProject;
  }

  const activity = await recordEvent(wallet, updatedProject as ProjectDoc, amountUsd);

  const sale = {
    slug: updatedProject.slug,
    raised: roundUsd(updatedProject.raised),
    participants: updatedProject.participants,
  };
  emitSaleProgress(sale);
  emitActivity(activity);

  return {
    position: toPositionDTO(positionDoc, updatedProject),
    account: await requireAccount(wallet),
    sale,
  };
}

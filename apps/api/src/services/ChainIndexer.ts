/**
 * ChainIndexer — keeps on-chain sales in sync with the product surface:
 * polls each `settlement: 'onchain'` project's sale contract, ingests
 * `Purchased` events into the activity feed, and mirrors raised /
 * participants into Mongo so lists, stats and sockets behave identically
 * to off-chain sales.
 *
 * Restart-safe: the last scanned block is persisted per project
 * (`lastIndexedBlock`); a fresh project starts from the current head, and
 * totals are always read from contract state (not accumulated), so a
 * missed window can never corrupt them.
 */
import { PAYMENT_DECIMALS, SALE_ABI } from '@apogee/shared';
import type { ProjectStatus } from '@apogee/shared';
import { clientFor } from '../lib/chains';
import { ProjectModel } from '../models/Project';
import { emitSaleProgress, emitActivity, emitProjectsChanged } from '../realtime';
import { recordEventOnce } from './ActivityService';

const POLL_MS = Number(process.env.CHAIN_INDEXER_INTERVAL_MS) || 20_000;
/** Providers commonly cap eth_getLogs ranges; stay well under. */
const MAX_BLOCK_RANGE = 5_000n;
/** First sighting of a sale: backfill this many blocks of purchase history
 *  so the feed isn't empty when a mid-flight sale gets listed. */
const BACKFILL_BLOCKS = 2_000n;

const INDEXABLE: ProjectStatus[] = ['upcoming', 'live'];

function paymentToUsd(units: bigint): number {
  return Number(units) / 10 ** PAYMENT_DECIMALS;
}

async function indexProject(projectId: unknown): Promise<void> {
  const project = await ProjectModel.findById(projectId);
  if (!project?.saleContract || !project.chainId) return;

  const client = clientFor(project.chainId);
  if (!client) {
    console.warn(`[indexer] no RPC for chain ${project.chainId} (${project.slug})`);
    return;
  }

  const address = project.saleContract as `0x${string}`;
  const head = await client.getBlockNumber();

  // First sighting backfills a small window of history (idempotent via
  // dedupeKey); afterwards resume exactly one past the persisted cursor —
  // when no new blocks exist the loop is a no-op (never re-scan).
  let from =
    project.lastIndexedBlock != null
      ? BigInt(project.lastIndexedBlock) + 1n
      : head > BACKFILL_BLOCKS
        ? head - BACKFILL_BLOCKS
        : 0n;

  // Ingest Purchased events (chunked) for the activity feed.
  while (from <= head) {
    const to = from + MAX_BLOCK_RANGE > head ? head : from + MAX_BLOCK_RANGE;
    const logs = await client.getContractEvents({
      address,
      abi: SALE_ABI,
      eventName: 'Purchased',
      fromBlock: from,
      toBlock: to,
    });
    for (const log of logs) {
      const { buyer, paymentAmount } = log.args as { buyer: string; paymentAmount: bigint };
      const dedupeKey = `${project.chainId}:${log.transactionHash}:${log.logIndex}`;
      const activity = await recordEventOnce(
        buyer,
        project,
        paymentToUsd(paymentAmount),
        dedupeKey,
      );
      if (activity) emitActivity(activity);
    }
    from = to + 1n;
  }

  // Mirror authoritative totals + lifecycle from contract state.
  const [raisedUnits, participants, finalized] = await Promise.all([
    client.readContract({ address, abi: SALE_ABI, functionName: 'raised' }),
    client.readContract({ address, abi: SALE_ABI, functionName: 'participants' }),
    client.readContract({ address, abi: SALE_ABI, functionName: 'finalized' }),
  ]);
  const raised = paymentToUsd(raisedUnits);
  const nParticipants = Number(participants);
  const changed = raised !== project.raised || nParticipants !== project.participants;

  const patch = { raised, participants: nParticipants, lastIndexedBlock: Number(head) };
  // Contract truth wins over the time-based scheduler: a hard-cap-filled sale
  // finalizes early on-chain, so reflect that as ended (and unpin featured).
  if (finalized && project.status !== 'ended') {
    Object.assign(patch, { status: 'ended', featured: false });
    console.log(`[indexer] ${project.slug} finalized on-chain → ended`);
  }

  await ProjectModel.updateOne({ _id: project._id }, { $set: patch });

  if (changed) emitSaleProgress({ slug: project.slug, raised, participants: nParticipants });
  if (finalized && project.status !== 'ended') emitProjectsChanged();
}

let running = false;

export async function runIndexSweep(): Promise<void> {
  if (running) return; // never overlap slow RPC rounds
  running = true;
  try {
    const targets = await ProjectModel.find({
      settlement: 'onchain',
      status: { $in: INDEXABLE },
      saleContract: { $nin: [null, ''] },
      chainId: { $ne: null },
    }).select('_id slug');
    for (const target of targets) {
      try {
        await indexProject(target._id);
      } catch (err) {
        console.warn(
          `[indexer] ${target.slug}: ${err instanceof Error ? err.message.slice(0, 160) : err}`,
        );
      }
    }
  } finally {
    running = false;
  }
}

export function startChainIndexer(): void {
  void runIndexSweep().catch(() => undefined);
  const timer = setInterval(() => void runIndexSweep().catch(() => undefined), POLL_MS);
  timer.unref();
}

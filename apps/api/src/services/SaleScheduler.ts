/**
 * SaleScheduler — flips sale statuses automatically as their windows pass:
 * upcoming → live at startAt, live → ended at endAt. Runs at boot and every
 * minute after, so the launchpad never shows a stale "Live" pill and admins
 * never have to flip statuses by hand.
 *
 * startAt/endAt are stored as ISO-8601 UTC strings, which compare correctly
 * as plain strings, so the sweeps are single indexed-friendly updateMany ops.
 */
import { ProjectModel } from '../models/Project';
import { emitProjectsChanged } from '../realtime';
import { notifyOps } from '../lib/notify';

const SWEEP_INTERVAL_MS = Number(process.env.SALE_SWEEP_INTERVAL_MS) || 60_000;

export async function runSaleStatusSweep(): Promise<number> {
  const nowIso = new Date().toISOString();

  // upcoming → live (startAt reached, endAt still ahead)
  const goingLive = await ProjectModel.find({
    status: 'upcoming',
    startAt: { $ne: null, $lte: nowIso },
    endAt: { $gt: nowIso },
  }).select('slug name ticker');
  if (goingLive.length > 0) {
    await ProjectModel.updateMany(
      { _id: { $in: goingLive.map((p) => p._id) } },
      { $set: { status: 'live' } },
    );
    for (const p of goingLive) {
      console.log(`[scheduler] ${p.slug} is now LIVE`);
      notifyOps(`🚀 <b>${p.name}</b> (${p.ticker}) sale is now LIVE`);
    }
  }

  // upcoming|live → ended (endAt passed)
  const ending = await ProjectModel.find({
    status: { $in: ['upcoming', 'live'] },
    endAt: { $ne: null, $lt: nowIso },
  }).select('slug name ticker raised');
  if (ending.length > 0) {
    await ProjectModel.updateMany(
      { _id: { $in: ending.map((p) => p._id) } },
      { $set: { status: 'ended', featured: false } },
    );
    for (const p of ending) {
      console.log(`[scheduler] ${p.slug} has ENDED`);
      notifyOps(`🏁 <b>${p.name}</b> (${p.ticker}) sale ended — raised $${Math.round(p.raised).toLocaleString('en-US')}`);
    }
  }

  const changed = goingLive.length + ending.length;
  if (changed > 0) emitProjectsChanged();
  return changed;
}

export function startSaleScheduler(): void {
  void runSaleStatusSweep().catch((err) => console.error('[scheduler] sweep failed:', err));
  const timer = setInterval(() => {
    void runSaleStatusSweep().catch((err) => console.error('[scheduler] sweep failed:', err));
  }, SWEEP_INTERVAL_MS);
  timer.unref(); // never keep the process alive on its own
}

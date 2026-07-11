import crypto from 'node:crypto';
import { buildSeedProjects } from '@apogee/shared';
import { ActivityEventModel, type ActivityEventEntity } from '../models/ActivityEvent';
import { PositionModel } from '../models/Position';
import { ProjectModel } from '../models/Project';

// Base58 alphabet (no 0, O, I, l) — for plausible-looking Solana addresses.
const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function randomSolWallet(): string {
  let out = '';
  for (let i = 0; i < 44; i++) {
    out += BASE58[crypto.randomInt(BASE58.length)];
  }
  return out;
}

function randomEvmWallet(): string {
  return `0x${crypto.randomBytes(20).toString('hex')}`;
}

/**
 * $50–$5,000, weighted toward the small end (power curve), rounded to a
 * plausible-looking multiple of $5.
 */
function randomAmountUsd(): number {
  const r = Math.pow(Math.random(), 2.2);
  const raw = 50 + r * 4_950;
  return Math.max(50, Math.round(raw / 5) * 5);
}

export interface SeedSummary {
  projects: number;
  events: number;
}

/**
 * Wipes Project + ActivityEvent and re-inserts buildSeedProjects(now) plus
 * ~12 plausible activity events spread over the last hour for the live sales.
 *
 * With `force = false` (the db.ts auto-seed path) it only seeds when the
 * Project collection is empty, and returns null otherwise.
 */
export async function seedDatabase(force = false): Promise<SeedSummary | null> {
  if (!force) {
    const existing = await ProjectModel.estimatedDocumentCount();
    if (existing > 0) return null;
  }

  // Positions reference project ids, so a reseed must clear them too or
  // portfolios would point at dead projects. Users/stakes survive reseeds.
  await Promise.all([
    ProjectModel.deleteMany({}),
    ActivityEventModel.deleteMany({}),
    PositionModel.deleteMany({}),
  ]);

  const projects = await ProjectModel.insertMany(buildSeedProjects(new Date()));

  const live = projects.filter((p) => p.status === 'live');
  const events: Omit<ActivityEventEntity, never>[] = [];
  if (live.length > 0) {
    const now = Date.now();
    for (let i = 0; i < 12; i++) {
      const project = live[i % live.length]!;
      events.push({
        // Wallet format follows the sale's chain, so both formats appear.
        wallet: project.chain === 'SOL' ? randomSolWallet() : randomEvmWallet(),
        projectId: project._id,
        amountUsd: randomAmountUsd(),
        ts: new Date(now - crypto.randomInt(60 * 60 * 1000)),
      });
    }
    await ActivityEventModel.insertMany(events);
  }

  return { projects: projects.length, events: events.length };
}

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

// apps/api/src/env.ts → repo root is three levels up.
const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..', '..');

// Load apps/api/.env first (most specific wins — dotenv never overrides
// variables that are already set), then the repo-root .env.
dotenv.config({ path: path.resolve(here, '..', '.env') });
dotenv.config({ path: path.join(repoRoot, '.env') });

const DEV_JWT_SECRET = 'apogee-dev-secret-do-not-use-in-production';

function parsePort(raw: string | undefined): number {
  const n = raw === undefined ? NaN : Number(raw);
  return Number.isInteger(n) && n > 0 && n < 65_536 ? n : 4000;
}

export interface Env {
  /** HTTP port, default 4000. */
  readonly PORT: number;
  /** When unset, db.ts falls back to mongodb-memory-server + auto-seed. */
  readonly MONGO_URI: string | undefined;
  readonly JWT_SECRET: string;
  /** DEMO_MODE=1 lets `signature: "demo"` bypass signature verification (local dev only). */
  readonly DEMO_MODE: boolean;
  /** Absolute path of the monorepo root. */
  readonly REPO_ROOT: string;
}

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  console.warn(
    '[env] JWT_SECRET is not set — using an insecure development default. Set JWT_SECRET before deploying.',
  );
}

export const env: Env = {
  PORT: parsePort(process.env.PORT),
  MONGO_URI: process.env.MONGO_URI || undefined,
  JWT_SECRET: jwtSecret || DEV_JWT_SECRET,
  DEMO_MODE: process.env.DEMO_MODE === '1' || process.env.DEMO_MODE === 'true',
  REPO_ROOT: repoRoot,
};

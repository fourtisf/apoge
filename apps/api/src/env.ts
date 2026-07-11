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
  /** Password for /admin. Unset = admin panel disabled. */
  readonly ADMIN_PASSWORD: string | undefined;
  /** Telegram ops notifications — both unset = notifications off. */
  readonly TELEGRAM_BOT_TOKEN: string | undefined;
  readonly TELEGRAM_CHAT_ID: string | undefined;
  /** Phase 3: per-chain deployed addresses, JSON — {"84532":{"staking":"0x…","usdc":"0x…","apg":"0x…"}} */
  readonly ONCHAIN_CONTRACTS: string | undefined;
  /** Phase 3: per-chain RPC overrides, JSON — {"84532":"https://…"} */
  readonly ONCHAIN_RPC: string | undefined;
  /** Public origin used in sitemap/canonical URLs. */
  readonly PUBLIC_ORIGIN: string;
  /** Absolute path of the monorepo root. */
  readonly REPO_ROOT: string;
}

const jwtSecret =
  process.env.JWT_SECRET && process.env.JWT_SECRET !== 'change-me-in-production'
    ? process.env.JWT_SECRET
    : undefined;
if (!jwtSecret) {
  if (process.env.NODE_ENV === 'production') {
    console.error(
      '[env] FATAL: JWT_SECRET must be a strong random value in production (openssl rand -hex 32).',
    );
    process.exit(1);
  }
  console.warn(
    '[env] JWT_SECRET is not set — using an insecure development default. Set JWT_SECRET before deploying.',
  );
}
if (
  process.env.NODE_ENV === 'production' &&
  (process.env.DEMO_MODE === '1' || process.env.DEMO_MODE === 'true')
) {
  console.error('[env] FATAL: DEMO_MODE bypasses signature verification and must be off in production.');
  process.exit(1);
}

export const env: Env = {
  PORT: parsePort(process.env.PORT),
  MONGO_URI: process.env.MONGO_URI || undefined,
  JWT_SECRET: jwtSecret ?? DEV_JWT_SECRET,
  DEMO_MODE: process.env.DEMO_MODE === '1' || process.env.DEMO_MODE === 'true',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || undefined,
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || undefined,
  TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID || undefined,
  ONCHAIN_CONTRACTS: process.env.ONCHAIN_CONTRACTS || undefined,
  ONCHAIN_RPC: process.env.ONCHAIN_RPC || undefined,
  PUBLIC_ORIGIN: process.env.PUBLIC_ORIGIN || 'https://apoge.fun',
  REPO_ROOT: repoRoot,
};

import path from 'node:path';
import mongoose from 'mongoose';
import { env } from './env';
import { seedDatabase } from './seed/seedDatabase';

let memoryServer: { stop(): Promise<boolean>; getUri(dbName?: string): string } | null = null;

function redactUri(uri: string): string {
  return uri.replace(/\/\/[^@/]*@/, '//***@');
}

export interface ConnectDbOptions {
  /**
   * When falling back to mongodb-memory-server, seed automatically if the
   * Project collection is empty. The seed script disables this and calls
   * seedDatabase(true) itself.
   */
  autoSeed?: boolean;
}

/** Connect to MONGO_URI, or fall back to an in-memory MongoDB for zero-setup dev. */
export async function connectDb(options: ConnectDbOptions = {}): Promise<void> {
  const { autoSeed = true } = options;

  if (env.MONGO_URI) {
    await mongoose.connect(env.MONGO_URI);
    console.log(`[db] connected to ${redactUri(env.MONGO_URI)}`);
    return;
  }

  // mongodb-memory-server downloads a mongod binary on first use — cache it
  // inside the repo (gitignored) so repeat runs are instant.
  process.env.MONGOMS_DOWNLOAD_DIR ??= path.join(env.REPO_ROOT, '.mongodb-binaries');

  try {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    memoryServer = await MongoMemoryServer.create();
    await mongoose.connect(memoryServer.getUri('apogee'));
    console.log('[db] MONGO_URI not set — using mongodb-memory-server (data is ephemeral)');
    console.warn(
      '[db] ⚠ EPHEMERAL DB: every restart WIPES applications/projects/positions. ' +
        'Set MONGO_URI to persist (e.g. mongodb://127.0.0.1:27017/apogee).',
    );
  } catch (err) {
    console.error('[db] Failed to start mongodb-memory-server.');
    console.error(
      '[db] It downloads a mongod binary on first use; if you are offline or the download is blocked,',
    );
    console.error('[db] set MONGO_URI to a running MongoDB instance and restart.');
    console.error(err);
    process.exit(1);
  }

  if (autoSeed) {
    const summary = await seedDatabase(false);
    if (summary) {
      console.log(
        `[db] auto-seeded ${summary.projects} projects and ${summary.events} activity events`,
      );
    }
  }
}

/** Disconnect mongoose and stop the in-memory server if one was started. */
export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
}

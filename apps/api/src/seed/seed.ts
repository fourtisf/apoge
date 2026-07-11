/**
 * Standalone seed script: `npm run seed -w apps/api`.
 * Wipes Project + ActivityEvent, inserts buildSeedProjects(now) and ~12
 * recent activity events for the live sales, prints a summary, exits 0.
 *
 * Note: without MONGO_URI this seeds a throwaway in-memory database (the
 * same one `npm run dev` auto-seeds), which is only useful as a dry run.
 */
import { connectDb, disconnectDb } from '../db';
import { ActivityEventModel } from '../models/ActivityEvent';
import { ProjectModel } from '../models/Project';
import { seedDatabase } from './seedDatabase';

async function main(): Promise<void> {
  await connectDb({ autoSeed: false });

  const summary = await seedDatabase(true);
  if (!summary) throw new Error('seedDatabase(true) unexpectedly skipped seeding');

  const [projects, live, events] = await Promise.all([
    ProjectModel.countDocuments(),
    ProjectModel.countDocuments({ status: 'live' }),
    ActivityEventModel.countDocuments(),
  ]);

  console.log('[seed] done:');
  console.log(`[seed]   projects: ${projects} (${live} live)`);
  console.log(`[seed]   activity events: ${events} (last hour, live sales)`);

  await disconnectDb();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[seed] failed:', err);
    process.exit(1);
  });

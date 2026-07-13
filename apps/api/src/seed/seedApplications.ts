/**
 * Standalone applications seed: `npm run seed:applications -w apps/api`.
 *
 * Upserts a set of professional sample launch applications (keyed by name,
 * so it is idempotent and never touches real submissions). Safe to run
 * against a live database — it does NOT wipe anything.
 *
 * On the VPS, with MONGO_URI set, this populates the persistent database so
 * the public /applications page has content.
 */
import { connectDb, disconnectDb } from '../db';
import { ApplicationModel } from '../models/Application';
import { seedApplications } from './sampleApplications';

async function main(): Promise<void> {
  await connectDb({ autoSeed: false });

  const count = await seedApplications();
  const [total, pending, accepted, rejected] = await Promise.all([
    ApplicationModel.countDocuments(),
    ApplicationModel.countDocuments({ status: 'pending' }),
    ApplicationModel.countDocuments({ status: 'accepted' }),
    ApplicationModel.countDocuments({ status: 'rejected' }),
  ]);

  console.log(`[seed:applications] upserted ${count} sample applications`);
  console.log(
    `[seed:applications] collection now: ${total} total · ${pending} pending · ${accepted} approved · ${rejected} rejected`,
  );

  await disconnectDb();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[seed:applications] failed:', err);
    process.exit(1);
  });

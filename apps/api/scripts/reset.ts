/**
 * Recreates a local database from scratch: wipes it, applies the migrations and seeds the catalog.
 * Refuses any database that is not on this machine, so it can never wipe Neon.
 *
 * Usage: npm run db:reset   (the tests run it against their own databases via DATABASE_URL)
 */
import {connect} from '#src/db/client.ts';
import {ensureDatabase, wipeLocalDatabase} from '#src/db/localDatabase.ts';
import {runMigrations} from '#src/db/migrations.ts';
import {seedCatalog} from '#src/db/seed.ts';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set.');
}

await ensureDatabase(databaseUrl);
await wipeLocalDatabase(databaseUrl);

const {db, close} = connect(databaseUrl, 1);

try {
  await runMigrations(db);
  await seedCatalog(db);
  console.log(`Reset ${new URL(databaseUrl).pathname.slice(1)}: migrated and seeded.`);
} finally {
  await close();
}

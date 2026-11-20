/**
 * Loads (or updates) the course catalog: vehicles, instructors and who teaches what.
 *
 * Usage: npm run db:seed   (local database; for Neon, set DATABASE_URL in the shell first)
 */
import {connect} from '#src/db/client.ts';
import {seedCatalog} from '#src/db/seed.ts';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set.');
}

const {db, close} = connect(databaseUrl, 1);

try {
  await seedCatalog(db);
  console.log('Catalog seeded.');
} finally {
  await close();
}

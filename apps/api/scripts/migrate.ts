/**
 * Applies any new migrations from drizzle/ to the database at DATABASE_URL.
 *
 * Usage: npm run db:migrate   (local database, from .env.development)
 *
 * Deploys migrate Neon with scripts/release.ts instead, which also seeds the catalog.
 */
import {connect} from '#src/db/client.ts';
import {runMigrations} from '#src/db/migrations.ts';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set.');
}

const {db, close} = connect(databaseUrl, 1);

try {
  await runMigrations(db);
  console.log('Migrations are up to date.');
} finally {
  await close();
}

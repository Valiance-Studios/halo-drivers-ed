/**
 * Prepares the database for a new release: applies any new migrations, then loads the course catalog
 * so it matches the code being deployed. Both steps are safe to repeat.
 *
 * Bundled as dist/release.js, which the hde-migrate Cloud Run job runs before each deploy of the API
 * (see docs/DEPLOYMENT.md). Locally, `npm run db:migrate` and `npm run db:seed` do the same steps.
 */
import {connect} from '#src/db/client.ts';
import {runMigrations} from '#src/db/migrations.ts';
import {seedCatalog} from '#src/db/seed.ts';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set.');
}

const {db, close} = connect(databaseUrl, 1);

try {
  await runMigrations(db);
  await seedCatalog(db);
  console.log('Migrations applied and catalog seeded.');
} finally {
  await close();
}

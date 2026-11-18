import {connect} from '#src/db/client.ts';
import {ensureDatabase, wipeLocalDatabase} from '#src/db/localDatabase.ts';
import {runMigrations} from '#src/db/migrations.ts';
import {TEST_DATABASE_URL} from './database.ts';

/** Recreates the test database from the migrations before the run, as a deploy would apply them. */
export default async function setup(): Promise<void> {
  await ensureDatabase(TEST_DATABASE_URL);
  await wipeLocalDatabase(TEST_DATABASE_URL);
  const {db, close} = connect(TEST_DATABASE_URL, 1);

  try {
    await runMigrations(db);
  } finally {
    await close();
  }
}

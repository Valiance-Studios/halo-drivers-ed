/**
 * Deletes bookings and what hangs off them: everyone's, one student's, or one instructor's. Keeps the schema, the
 * catalog, the lesson plans and the allowlist. See "Clearing Data" in docs/DEVELOPMENT.md.
 *
 * Usage: npm run db:clear -- all | student <email> | instructor <slug> [--deployed] [--confirm local|deployed]
 *
 * Uses the local database, or the deployed one with --deployed, whose connection string comes from Secret Manager.
 * Only shows what would be deleted, unless --confirm says which of the two it is.
 */
import type {ClearCounts} from '#src/db/clearData.ts';

import {spawnSync} from 'node:child_process';
import {CLEAR_USAGE, clearData, parseClearArgs, previewClear} from '#src/db/clearData.ts';
import {connect} from '#src/db/client.ts';
import {isLocalDatabase} from '#src/db/localDatabase.ts';

const PROJECT = 'vs-halo-drivers-ed-dev';
const SECRET = 'hde-database-url';

function deployedDatabaseUrl(): string {
  const args = ['secrets', 'versions', 'access', 'latest', '--secret', SECRET, '--project', PROJECT];
  const {status, stdout, error} = spawnSync('gcloud', args, {
    stdio: ['inherit', 'pipe', 'inherit'],
    encoding: 'utf8',
  });

  if (error || status !== 0) {
    fail(`Could not read the connection string from Secret Manager. Is gcloud installed and signed in to ${PROJECT}?`);
  }

  return stdout.trim();
}

function fail(message: string): never {
  console.error(`Nothing deleted: ${message}`);
  process.exit(1);
}

function describe({lessons, results, timeOff, demoSessions}: ClearCounts): string {
  return [
    `  Lessons (with their notes): ${lessons}`,
    `  Skill results:              ${results}`,
    `  Time off:                   ${timeOff}`,
    `  Demo sessions:              ${demoSessions}`,
  ].join('\n');
}

const args = process.argv.slice(2);
const parsed = parseClearArgs(args);

if (!parsed) {
  console.error(CLEAR_USAGE);
  process.exit(1);
}

const {target, deployed, confirm} = parsed;
const place = deployed ? 'deployed' : 'local';

// Before connecting to anything.
if (confirm !== null && confirm !== place) {
  fail(`--confirm says "${confirm}", but this is the ${place} database, so it must be --confirm ${place}.`);
}

const databaseUrl = deployed ? deployedDatabaseUrl() : process.env.DATABASE_URL;

if (!databaseUrl) {
  fail('DATABASE_URL is not set.');
}

const {hostname, pathname} = new URL(databaseUrl);
const database = `the ${place} database (${decodeURIComponent(pathname.slice(1))} on ${hostname})`;

if (isLocalDatabase(databaseUrl) === deployed) {
  fail(
    deployed
      ? `the deployed connection string points at ${hostname}, which is this machine.`
      : `DATABASE_URL points at ${hostname}, which is not this machine. For the deployed database, use --deployed.`,
  );
}

const {db, close} = connect(databaseUrl, 1);

try {
  if (confirm === null) {
    console.log(`Would delete from ${database}:\n${describe(await previewClear(db, target))}`);
    console.log(`\nNothing deleted. To delete, run:\n  npm run db:clear -- ${args.join(' ')} --confirm ${place}`);
  } else {
    console.log(`Deleted from ${database}:\n${describe(await clearData(db, target))}`);
  }
} catch (error) {
  console.error(`Nothing deleted from ${database}: ${error instanceof Error ? error.message : String(error)}`);

  if (!deployed) {
    console.error('For the deployed database, add --deployed.');
  }

  process.exitCode = 1;
} finally {
  await close();
}

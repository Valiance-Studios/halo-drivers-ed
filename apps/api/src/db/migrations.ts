import type {Database} from '#src/db/client.ts';

import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {migrate} from 'drizzle-orm/node-postgres/migrator';

/**
 * The generated migrations in apps/api/drizzle. This file is src/db/migrations.ts when run from source
 * and part of dist/*.js when bundled, so the folder is two or one levels up respectively.
 */
function findMigrationsFolder(): string {
  const candidates = ['../../drizzle', '../drizzle'].map((path) => fileURLToPath(new URL(path, import.meta.url)));
  const folder = candidates.find((candidate) => existsSync(`${candidate}/meta/_journal.json`));

  if (!folder) {
    throw new Error(`No migrations found in ${candidates.join(' or ')}.`);
  }

  return folder;
}

export async function runMigrations(db: Database): Promise<void> {
  await migrate(db, {migrationsFolder: findMigrationsFolder()});
}

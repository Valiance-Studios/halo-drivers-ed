import type {NodePgDatabase} from 'drizzle-orm/node-postgres';

import pg from 'pg';
import {drizzle} from 'drizzle-orm/node-postgres';
import * as schema from '#src/db/schema.ts';

export type Database = NodePgDatabase<typeof schema>;

export interface DatabaseConnection {
  db: Database;
  /** Closes the pool's connections, for scripts and tests that end. */
  close: () => Promise<void>;
}

/**
 * Connects to Postgres. In production the URL is Neon's pooled endpoint (`-pooler` host), which shares
 * connections across instances, so each instance keeps only a few of its own.
 */
export function connect(databaseUrl: string, maxConnections = 5): DatabaseConnection {
  const pool = new pg.Pool({connectionString: databaseUrl, max: maxConnections});

  return {
    db: drizzle({client: pool, schema, casing: 'snake_case'}),
    close: () => pool.end(),
  };
}

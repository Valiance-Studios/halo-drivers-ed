import pg from 'pg';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/**
 * Throws unless the URL points at a database on this machine. Guards the commands that wipe data, so
 * they can never reach Neon even with its URL in the environment.
 */
export function assertLocalDatabase(databaseUrl: string): void {
  const {hostname} = new URL(databaseUrl);

  if (!LOCAL_HOSTS.has(hostname)) {
    throw new Error(`Refusing to wipe the database on "${hostname}": only local databases can be reset.`);
  }
}

/** Creates the URL's database on its server if it does not exist yet, e.g. the tests' own databases. */
export async function ensureDatabase(databaseUrl: string): Promise<void> {
  const url = new URL(databaseUrl);
  const name = decodeURIComponent(url.pathname.slice(1));
  url.pathname = '/postgres';
  const client = new pg.Client({connectionString: url.toString()});

  await client.connect();

  try {
    const {rowCount} = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);

    if (rowCount === 0) {
      await client.query(`CREATE DATABASE "${name.replaceAll('"', '""')}"`);
    }
  } finally {
    await client.end();
  }
}

/** Drops every table, type and migration record, leaving an empty database for the migrations. */
export async function wipeLocalDatabase(databaseUrl: string): Promise<void> {
  assertLocalDatabase(databaseUrl);
  const client = new pg.Client({connectionString: databaseUrl});

  await client.connect();

  try {
    await client.query('DROP SCHEMA IF EXISTS drizzle CASCADE; DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  } finally {
    await client.end();
  }
}

/**
 * Lets an account sign in, or changes its role.
 *
 * Usage: npm run db:allow -- <email> [role]   (role defaults to admin)
 *
 * Against Neon, set DATABASE_URL in the shell first; it takes precedence over .env.development.
 */
import {ROLES} from '@hde/shared';
import {connect} from '#src/db/client.ts';
import {PostgresAllowlistRepository} from '#src/repositories/allowlistRepository.ts';

const [email, role = 'admin'] = process.argv.slice(2);
const databaseUrl = process.env.DATABASE_URL;

if (!email || !ROLES.some((known) => known === role)) {
  console.error(`Usage: npm run db:allow -- <email> [${ROLES.join('|')}]`);
  process.exit(1);
}

if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set.');
}

const {db, close} = connect(databaseUrl, 1);

try {
  await new PostgresAllowlistRepository(db).allow(email, role as typeof ROLES[number]);
  console.log(`${email.toLowerCase()} can sign in as ${role} (database on ${new URL(databaseUrl).hostname}).`);
} finally {
  await close();
}

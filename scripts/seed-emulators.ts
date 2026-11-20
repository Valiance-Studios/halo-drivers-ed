/**
 * Seeds local development: a Google account in the Auth emulator, allowlisted as an admin in the local
 * database. Run by `npm run emulators` once the emulator is up; the database must be running and
 * migrated (`npm run db:up`, `npm run db:reset`).
 */
import {connect} from '../apps/api/src/db/client.ts';
import {PostgresAllowlistRepository} from '../apps/api/src/repositories/allowlistRepository.ts';
import {EmulatorAdmin} from './emulator-admin.ts';
import {emulatorConfig} from './emulator-config.ts';

export const DEV_ACCOUNT = {email: 'cadet@example.com', displayName: 'Cadet Example'};
const DEV_DATABASE_URL = 'postgres://hde:hde@localhost:5433/halo_drivers_ed';

await new EmulatorAdmin(emulatorConfig).createGoogleAccount(DEV_ACCOUNT);

const {db, close} = connect(DEV_DATABASE_URL, 1);

try {
  await new PostgresAllowlistRepository(db).allow(DEV_ACCOUNT.email, 'admin');
} finally {
  await close();
}

console.log(`Sign in as ${DEV_ACCOUNT.email} from the emulator's account chooser.`);

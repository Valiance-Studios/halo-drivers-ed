import {connect} from '../../api/src/db/client.ts';
import {PostgresAllowlistRepository} from '../../api/src/repositories/allowlistRepository.ts';
import {EmulatorAdmin} from '../../../scripts/emulator-admin.ts';
import {emulatorConfig} from '../../../scripts/emulator-config.ts';
import {E2E_DATABASE_URL} from './database.ts';
import {ALLOWED_USER, UNKNOWN_USER} from './accounts.ts';

/**
 * Starts each run with one allowlisted account and one that is not. The emulator and database are the
 * run's own (see playwright.config.ts), so this never touches development data.
 */
export default async function globalSetup(): Promise<void> {
  const admin = new EmulatorAdmin(emulatorConfig);

  await admin.reset();

  for (const account of [ALLOWED_USER, UNKNOWN_USER]) {
    await admin.createGoogleAccount(account);
  }

  const {db, close} = connect(E2E_DATABASE_URL, 1);

  try {
    await new PostgresAllowlistRepository(db).allow(ALLOWED_USER.email, 'admin');
  } finally {
    await close();
  }
}

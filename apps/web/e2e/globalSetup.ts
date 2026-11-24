import {connect} from '../../api/src/db/client.ts';
import {bookings} from '../../api/src/db/schema.ts';
import {PostgresAllowlistRepository} from '../../api/src/repositories/allowlistRepository.ts';
import {EmulatorAdmin} from '../../../scripts/emulator-admin.ts';
import {emulatorConfig} from '../../../scripts/emulator-config.ts';
import {E2E_DATABASE_URL} from './database.ts';
import {ALLOWED_USER, STUDENT_USER, UNKNOWN_USER} from './accounts.ts';

const DAY_MS = 24 * 60 * 60 * 1000;

function pastLesson(daysAgo: number) {
  const startsAt = new Date(Date.now() - daysAgo * DAY_MS);

  return {
    studentEmail: STUDENT_USER.email,
    instructorSlug: 'sergeant-johnson',
    vehicleSlug: 'mongoose',
    faction: 'unsc' as const,
    startsAt,
    endsAt: new Date(startsAt.getTime() + 45 * 60 * 1000),
  };
}

/**
 * Starts each run with an admin, a student with past lessons, and an account that is not allowlisted. The emulator and database are the
 * run's own (see playwright.config.ts), so this never touches development data.
 */
export default async function globalSetup(): Promise<void> {
  const admin = new EmulatorAdmin(emulatorConfig);

  await admin.reset();

  for (const account of [ALLOWED_USER, STUDENT_USER, UNKNOWN_USER]) {
    await admin.createGoogleAccount(account);
  }

  const {db, close} = connect(E2E_DATABASE_URL, 1);

  try {
    const allowlist = new PostgresAllowlistRepository(db);
    await allowlist.allow(ALLOWED_USER.email, 'admin');
    await allowlist.allow(STUDENT_USER.email, 'student');
    await db.insert(bookings).values([3, 2].map(pastLesson));
  } finally {
    await close();
  }
}

import {afterAll, beforeEach, describe, expect, it} from 'vite-plus/test';
import {eq} from 'drizzle-orm';
import {BookingService} from '#src/bookings/bookingService.ts';
import {clearData, previewClear} from '#src/db/clearData.ts';
import {connect} from '#src/db/client.ts';
import {
  allowedUsers,
  bookings,
  demoSlots,
  instructors,
  instructorTimeOff,
  lessonSkills,
  skillResults,
} from '#src/db/schema.ts';
import {seedCatalog, seedDemoSlots} from '#src/db/seed.ts';
import {DEMO_LESSONS} from '#src/demo/demoHistory.ts';
import {PostgresAllowlistRepository} from '#src/repositories/allowlistRepository.ts';
import {PostgresBookingRepository} from '#src/repositories/bookingRepository.ts';
import {PostgresCatalogRepository} from '#src/repositories/catalogRepository.ts';
import {PostgresDemoRepository} from '#src/repositories/demoRepository.ts';
import {TEST_DATABASE_URL} from './database.ts';

const {db, close} = connect(TEST_DATABASE_URL, 10);
const PAT = 'clear-pat@example.com';
const SAM = 'clear-sam@example.com';
const NOW = new Date('2026-06-08T10:00:00Z');
const demo = new PostgresDemoRepository(db);
const signature = {signedOffBy: 'admin@example.com', signedOffAt: NOW};

/** A lesson on its own day in June, and for a signed-off one, a result. */
async function lesson(
  day: number,
  studentEmail: string,
  instructorSlug: string,
  status: 'booked' | 'cancelled' | 'missed' | 'completed',
): Promise<void> {
  const [row] = await db
    .insert(bookings)
    .values({
      studentEmail,
      instructorSlug,
      vehicleSlug: 'mongoose',
      faction: 'unsc',
      startsAt: new Date(Date.UTC(2026, 5, day, 12)),
      endsAt: new Date(Date.UTC(2026, 5, day, 13)),
      status,
      studentNote: 'A note.',
      ...(status === 'missed' && signature),
      ...(status === 'completed' && {...signature, lessonNumber: 1}),
    })
    .returning();

  if (status === 'completed') {
    const result = {vehicleSlug: 'mongoose', lessonNumber: 1, skillId: 'startEngine', result: 'pass' as const};
    await db.insert(skillResults).values({...result, bookingId: row!.id});
  }
}

const statuses = async (email: string) =>
  (await db.select().from(bookings).where(eq(bookings.studentEmail, email)).orderBy(bookings.startsAt)).map(
    ({status}) => status,
  );

beforeEach(async () => {
  await clearData(db, {kind: 'all'});
  await seedCatalog(db);
  await seedDemoSlots(db);
  const allowlist = new PostgresAllowlistRepository(db);
  await allowlist.allow(PAT, 'admin');
  await allowlist.allow(SAM, 'student');
  await lesson(1, PAT, 'master-chief', 'completed');
  await lesson(2, PAT, 'master-chief', 'missed');
  await lesson(9, PAT, 'master-chief', 'booked');
  await lesson(10, PAT, 'sergeant-johnson', 'booked');
  await lesson(11, SAM, 'master-chief', 'cancelled');
  await lesson(12, SAM, 'master-chief', 'booked');
  await db.insert(instructorTimeOff).values([
    {instructorSlug: 'master-chief', startsOn: '2026-06-20', endsOn: '2026-06-21'},
    {instructorSlug: 'arbiter', startsOn: '2026-06-20', endsOn: '2026-06-21'},
  ]);
});

afterAll(async () => {
  await clearData(db, {kind: 'all'});
  await db.delete(allowedUsers).where(eq(allowedUsers.email, PAT));
  await db.delete(allowedUsers).where(eq(allowedUsers.email, SAM));
  await close();
});

describe('previewClear', () => {
  it('counts what would be deleted, and deletes nothing', async () => {
    await demo.claim('visitor', NOW);
    const before = await db.select().from(bookings);

    expect(await previewClear(db, {kind: 'all'})).toMatchObject({
      lessons: 6 + DEMO_LESSONS.length,
      timeOff: 2,
      demoSessions: 1,
    });
    expect(await previewClear(db, {kind: 'student', email: PAT})).toEqual({
      lessons: 4,
      results: 1,
      timeOff: 0,
      demoSessions: 0,
    });
    expect(await db.select().from(bookings)).toEqual(before);
    expect(await demo.findGuest('visitor', NOW)).not.toBeNull();
  });
});

describe('clearData', () => {
  it('clears everything but the catalog, the lesson plans, the demo places and the allowlist', async () => {
    await demo.claim('visitor', NOW);
    const kept = () => Promise.all([db.$count(instructors), db.$count(lessonSkills), db.$count(demoSlots)]);
    const before = await kept();
    const preview = await previewClear(db, {kind: 'all'});

    expect(await clearData(db, {kind: 'all'})).toEqual(preview);
    expect(await previewClear(db, {kind: 'all'})).toEqual({lessons: 0, results: 0, timeOff: 0, demoSessions: 0});
    expect(await kept()).toEqual(before);
    expect(await db.$count(allowedUsers, eq(allowedUsers.role, 'guest'))).toBe(0);
    const allowlist = new PostgresAllowlistRepository(db);
    expect([await allowlist.findRole(PAT), await allowlist.findRole(SAM)]).toEqual(['admin', 'student']);
    // The demo's places can be claimed again.
    expect(await demo.claim('visitor', NOW)).toMatchObject({claimed: true});
  });

  it("clears only one student's lessons, and keeps their account", async () => {
    expect(await clearData(db, {kind: 'student', email: PAT})).toMatchObject({lessons: 4, results: 1});

    expect(await statuses(PAT)).toEqual([]);
    expect(await statuses(SAM)).toEqual(['cancelled', 'booked']);
    expect(await db.$count(instructorTimeOff)).toBe(2);
    expect(await new PostgresAllowlistRepository(db).findRole(PAT)).toBe('admin');
  });

  it("clears only one instructor's time off and lessons that are not signed off", async () => {
    expect(await clearData(db, {kind: 'instructor', slug: 'master-chief'})).toMatchObject({
      lessons: 3,
      results: 0,
      timeOff: 1,
    });

    expect(await statuses(PAT)).toEqual(['completed', 'missed', 'booked']);
    expect(await statuses(SAM)).toEqual([]);
    expect(await db.select().from(instructorTimeOff)).toMatchObject([{instructorSlug: 'arbiter'}]);
  });

  it('refuses a student or instructor that does not exist', async () => {
    for (const run of [previewClear, clearData]) {
      await expect(run(db, {kind: 'student', email: 'nobody@example.com'})).rejects.toThrow('nobody@example.com');
      await expect(run(db, {kind: 'instructor', slug: 'nobody'})).rejects.toThrow('master-chief');
    }
  });

  it('does not deadlock with bookings and demos made at the same time', async () => {
    const catalog = new PostgresCatalogRepository(db);
    const service = new BookingService(new PostgresBookingRepository(db), catalog, () => NOW);
    const request = {
      vehicleSlug: 'mongoose',
      instructorSlug: 'master-chief',
      startsAt: new Date(Date.UTC(2026, 5, 16, 12)).toISOString(),
    };

    for (let round = 0; round < 10; round++) {
      // Refused bookings are fine; a failure without one of the API's codes is not.
      const booking = service.book(SAM, request).catch((error: {code?: string}) => {
        expect(error.code).toMatch(/^(slot-unavailable|no-lessons-left)$/);
      });
      await Promise.all([
        booking,
        demo.claim(`visitor-${round}`, NOW),
        clearData(db, {kind: 'instructor', slug: 'master-chief'}),
        clearData(db, {kind: 'all'}),
        clearData(db, {kind: 'student', email: SAM}),
      ]);
    }
  });
});

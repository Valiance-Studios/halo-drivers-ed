import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vite-plus/test';
import {eq, isNull} from 'drizzle-orm';
import {DEMO_BOOKING_LIMIT, DEMO_SESSION_MINUTES, DEMO_SLOTS} from '@hde/shared';
import {BookingService} from '#src/bookings/bookingService.ts';
import {connect} from '#src/db/client.ts';
import {allowedUsers, bookings, demoSlots, skillResults} from '#src/db/schema.ts';
import {seedCatalog, seedDemoSlots} from '#src/db/seed.ts';
import {PostgresAllowlistRepository} from '#src/repositories/allowlistRepository.ts';
import {PostgresBookingRepository} from '#src/repositories/bookingRepository.ts';
import {PostgresCatalogRepository} from '#src/repositories/catalogRepository.ts';
import {PostgresDemoRepository} from '#src/repositories/demoRepository.ts';
import {TEST_DATABASE_URL} from './database.ts';

const {db, close} = connect(TEST_DATABASE_URL, 5);
const demo = new PostgresDemoRepository(db);
const NOW = new Date('2026-06-08T10:00:00Z');
const minutesLater = (minutes: number) => new Date(NOW.getTime() + minutes * 60 * 1000);
const visitors = (count: number) => Array.from({length: count}, (_, index) => `visitor-${index}`);
const claimAll = (uids: string[]) => Promise.all(uids.map((uid) => demo.claim(uid, NOW)));

async function guestEmail(uid: string): Promise<string> {
  const guest = await demo.findGuest(uid, NOW);

  return guest!.email;
}

async function constraint(query: Promise<unknown>): Promise<string | undefined> {
  const error = await query.then(
    () => null,
    (failure: unknown) => failure as {cause?: {constraint?: string}},
  );

  return error?.cause?.constraint;
}

beforeAll(async () => {
  await seedCatalog(db);
  await seedDemoSlots(db);
});

beforeEach(async () => {
  await db.update(demoSlots).set({uid: null, guestEmail: null, expiresAt: null});
  await db.delete(bookings);
  await db.delete(allowedUsers).where(eq(allowedUsers.role, 'guest'));
});

afterAll(async () => {
  await close();
});

describe('demo slots', () => {
  it('never gives out more places than there are, even to visitors who arrive together', async () => {
    const sessions = await claimAll(visitors(DEMO_SLOTS + 5));
    const endsAt = minutesLater(DEMO_SESSION_MINUTES).toISOString();

    expect(sessions.filter(({claimed}) => claimed)).toHaveLength(DEMO_SLOTS);
    expect(sessions.filter(({claimed}) => !claimed)).toHaveLength(5);
    expect(await demo.claim('late', minutesLater(1))).toEqual({claimed: false, nextFreeAt: endsAt});
    // Every guest has their whole history, so none of them clashed.
    expect(await db.select().from(bookings)).toHaveLength(DEMO_SLOTS * 3);
  });

  it('gives an account one session, even when it asks twice together', async () => {
    const [first, second] = await claimAll(['a', 'a']);

    expect(first).toEqual(second);
    expect(await db.select().from(allowedUsers).where(eq(allowedUsers.role, 'guest'))).toHaveLength(1);
  });

  it('knows a guest only until their session ends', async () => {
    await demo.claim('a', NOW);

    expect(await demo.findGuest('a', minutesLater(1))).toMatchObject({role: 'guest'});
    expect(await demo.findGuest('a', minutesLater(DEMO_SESSION_MINUTES))).toBeNull();
    expect(await demo.findGuest('b', NOW)).toBeNull();
  });

  it("deletes the old guest's data when their place is reused", async () => {
    await claimAll(visitors(DEMO_SLOTS));
    const old = await guestEmail('visitor-0');
    await db
      .update(demoSlots)
      .set({expiresAt: minutesLater(-1)})
      .where(eq(demoSlots.guestEmail, old));

    expect(await demo.claim('next', NOW)).toMatchObject({claimed: true});
    expect(await db.select().from(bookings).where(eq(bookings.studentEmail, old))).toEqual([]);
    expect(await db.select().from(allowedUsers).where(eq(allowedUsers.email, old))).toEqual([]);
    expect(await demo.findGuest('visitor-0', NOW)).toBeNull();
  });

  it('gives an account whose session expired a new one', async () => {
    await demo.claim('a', NOW);
    const old = await guestEmail('a');
    const later = minutesLater(DEMO_SESSION_MINUTES + 1);

    expect(await demo.claim('a', later)).toMatchObject({claimed: true});
    expect((await demo.findGuest('a', later))?.email).not.toBe(old);
  });

  it('frees the place and deletes the data when a session is ended', async () => {
    await claimAll(['a', 'b']);
    await demo.release('a');

    expect(await demo.findGuest('a', NOW)).toBeNull();
    expect(await demo.findGuest('b', NOW)).not.toBeNull();
    expect(await db.select().from(bookings)).toHaveLength(3);
  });

  it('clears expired guests and their lessons, and no one else', async () => {
    await claimAll(['a', 'b']);
    const [old, current] = [await guestEmail('a'), await guestEmail('b')];
    await db
      .update(demoSlots)
      .set({expiresAt: minutesLater(-1)})
      .where(eq(demoSlots.uid, 'a'));
    // Together, as requests would.
    await Promise.all([demo.clearExpired(NOW), demo.clearExpired(NOW), demo.claim('c', NOW)]);
    await demo.clearExpired(NOW);

    expect(await db.select().from(allowedUsers).where(eq(allowedUsers.email, old))).toEqual([]);
    expect(await db.select().from(bookings).where(eq(bookings.studentEmail, current))).toHaveLength(3);
    expect(await demo.findGuest('c', NOW)).not.toBeNull();
  });

  it('keeps sessions when the slots are seeded again', async () => {
    await demo.claim('a', NOW);
    await seedDemoSlots(db);

    expect(await demo.findGuest('a', NOW)).not.toBeNull();
  });
});

describe('guests', () => {
  it('start with the Mongoose completed, which unlocks the Warthog, and a lesson to repeat', async () => {
    await demo.claim('a', NOW);
    const email = await guestEmail('a');
    const lessons = await new PostgresBookingRepository(db).listForStudent(email);

    expect(lessons.map(({vehicleSlug, status}) => [vehicleSlug, status])).toEqual([
      ['mongoose', 'completed'],
      ['mongoose', 'completed'],
      ['warthog', 'repeat'],
    ]);
    expect(await db.select().from(skillResults).where(eq(skillResults.result, 'fail'))).toHaveLength(1);
  });

  it('can book only so many lessons, counting cancelled ones', async () => {
    await demo.claim('a', NOW);
    const email = await guestEmail('a');
    const service = new BookingService(new PostgresBookingRepository(db), new PostgresCatalogRepository(db), () => NOW);

    const book = async () => {
      const slots = await service.slots(email, 'warthog', 'master-chief');
      const request = {vehicleSlug: 'warthog', instructorSlug: 'master-chief', startsAt: slots.at(-1)!.startsAt};

      return service.book(email, request, DEMO_BOOKING_LIMIT);
    };

    for (let count = 0; count < DEMO_BOOKING_LIMIT; count++) {
      const {id} = await book();
      await service.cancel(email, id);
    }

    await expect(book()).rejects.toMatchObject({code: 'demo-limit'});
  });

  it('cannot be found by email, so no signed-in account can become one', async () => {
    await demo.claim('a', NOW);

    expect(await new PostgresAllowlistRepository(db).findRole(await guestEmail('a'))).toBeNull();
  });
});

describe('demo constraints', () => {
  it('reject a guest with a real address, and anyone else with a guest address', async () => {
    const add = (email: string, role: 'guest' | 'admin') => constraint(db.insert(allowedUsers).values({email, role}));

    expect(await add('real@example.com', 'guest')).toBe('allowed_users_guest_email');
    expect(await add('guest-x@demo.invalid', 'admin')).toBe('allowed_users_guest_email');
  });

  it('reject half a session, and an account in two slots', async () => {
    await demo.claim('a', NOW);
    const [free] = await db.select().from(demoSlots).where(isNull(demoSlots.uid));
    const fill = (set: object) => constraint(db.update(demoSlots).set(set).where(eq(demoSlots.id, free!.id)));

    expect(await fill({uid: 'b'})).toBe('demo_slots_session');
    await db.insert(allowedUsers).values({email: 'guest-x@demo.invalid', role: 'guest'});
    expect(await fill({uid: 'a', guestEmail: 'guest-x@demo.invalid', expiresAt: NOW})).toBe('demo_slots_uid_unique');
  });
});

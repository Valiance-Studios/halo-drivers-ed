import type {DemoSession, Me} from '@hde/shared';
import type {Database} from '#src/db/client.ts';

import {randomUUID} from 'node:crypto';
import {and, asc, eq, gt, inArray, isNull, lt, lte, min, ne, or, sql} from 'drizzle-orm';
import {DEMO_SESSION_MINUTES, GUEST_EMAIL_DOMAIN} from '@hde/shared';
import {
  allowedUsers,
  bookings,
  demoSlots,
  instructorAvailability,
  lessonSkills,
  skillResults,
  vehicles,
} from '#src/db/schema.ts';
import {DEMO_INSTRUCTOR, DEMO_LESSONS, findHistoryTimes, historyPeriod} from '#src/demo/demoHistory.ts';

export interface DemoRepository {
  /** The guest an anonymous account is, or null if it has no demo session or it has ended. */
  findGuest(uid: string, now: Date): Promise<Me | null>;
  /** Starts a session in a free slot, or returns the one the account already has. */
  claim(uid: string, now: Date): Promise<DemoSession>;
  /** Ends the account's session, deleting its data and freeing its slot. */
  release(uid: string): Promise<void>;
  /** Deletes the data of guests whose sessions have ended. */
  clearExpired(now: Date): Promise<void>;
}

type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];
type Slot = typeof demoSlots.$inferSelect;

const EMPTY = {uid: null, guestEmail: null, expiresAt: null};

export class PostgresDemoRepository implements DemoRepository {
  private readonly db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  async findGuest(uid: string, now: Date): Promise<Me | null> {
    const [slot] = await this.db
      .select()
      .from(demoSlots)
      .where(and(eq(demoSlots.uid, uid), gt(demoSlots.expiresAt, now)));

    if (!slot?.guestEmail || !slot.expiresAt) {
      return null;
    }

    return {email: slot.guestEmail, role: 'guest', demoEndsAt: slot.expiresAt.toISOString()};
  }

  async claim(uid: string, now: Date): Promise<DemoSession> {
    return this.db.transaction(async (tx) => {
      await lockAccount(tx, uid);
      const [current] = await tx
        .select()
        .from(demoSlots)
        .where(and(eq(demoSlots.uid, uid), gt(demoSlots.expiresAt, now)));

      if (current?.expiresAt) {
        return {claimed: true, endsAt: current.expiresAt.toISOString()};
      }

      // The account's own expired slot first: an account can only be in one.
      const [slot] = await tx
        .select()
        .from(demoSlots)
        .where(or(isNull(demoSlots.expiresAt), lte(demoSlots.expiresAt, now)))
        .orderBy(sql`${demoSlots.uid} is not distinct from ${uid} desc`, sql`${demoSlots.expiresAt} asc nulls first`)
        .limit(1)
        .for('update', {skipLocked: true});

      if (!slot) {
        const [next] = await tx.select({at: min(demoSlots.expiresAt)}).from(demoSlots);

        return {claimed: false, nextFreeAt: next?.at?.toISOString() ?? null};
      }

      await emptySlot(tx, slot);

      const guestEmail = `guest-${randomUUID()}${GUEST_EMAIL_DOMAIN}`;
      const expiresAt = new Date(now.getTime() + DEMO_SESSION_MINUTES * 60 * 1000);
      await tx.insert(allowedUsers).values({email: guestEmail, displayName: `Demo guest ${slot.id}`, role: 'guest'});
      await tx.update(demoSlots).set({uid, guestEmail, expiresAt}).where(eq(demoSlots.id, slot.id));
      await addHistory(tx, slot.id, guestEmail, now);

      return {claimed: true, endsAt: expiresAt.toISOString()};
    });
  }

  async release(uid: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      await lockAccount(tx, uid);
      const [slot] = await tx.select().from(demoSlots).where(eq(demoSlots.uid, uid)).for('update');

      if (slot) {
        await emptySlot(tx, slot);
      }
    });
  }

  async clearExpired(now: Date): Promise<void> {
    await this.db.transaction(async (tx) => {
      // Skips ones another request is already clearing or reusing.
      const expired = await tx
        .select()
        .from(demoSlots)
        .where(lte(demoSlots.expiresAt, now))
        .for('update', {skipLocked: true});

      for (const slot of expired) {
        await emptySlot(tx, slot);
      }
    });
  }
}

/** Makes one account's requests take turns, until the transaction ends. */
async function lockAccount(tx: Transaction, uid: string): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${uid}, 0))`);
}

/** Deletes the slot's guest, and with it their lessons. */
async function emptySlot(tx: Transaction, {id, guestEmail}: Slot): Promise<void> {
  await tx.update(demoSlots).set(EMPTY).where(eq(demoSlots.id, id));

  if (guestEmail) {
    await tx.delete(allowedUsers).where(eq(allowedUsers.email, guestEmail));
  }
}

/** Gives a new guest some past lessons, so there is progress to see without waiting for a lesson to end. */
async function addHistory(tx: Transaction, slotId: number, studentEmail: string, now: Date): Promise<void> {
  const slugs = [...new Set(DEMO_LESSONS.map(({vehicleSlug}) => vehicleSlug))];
  const courses = await tx.select().from(vehicles).where(inArray(vehicles.slug, slugs));
  const windows = await tx
    .select()
    .from(instructorAvailability)
    .where(eq(instructorAvailability.instructorSlug, DEMO_INSTRUCTOR));
  const period = historyPeriod(slotId, now);
  const busy = await tx
    .select({startsAt: bookings.startsAt, endsAt: bookings.endsAt})
    .from(bookings)
    .where(
      and(
        ne(bookings.status, 'cancelled'),
        gt(bookings.endsAt, period.from),
        lt(bookings.startsAt, now),
        or(eq(bookings.instructorSlug, DEMO_INSTRUCTOR), inArray(bookings.vehicleSlug, slugs)),
      ),
    );
  const lessons = DEMO_LESSONS.flatMap((lesson) => {
    const vehicle = courses.find(({slug}) => slug === lesson.vehicleSlug);

    return vehicle ? [{...lesson, vehicle}] : [];
  });
  const times = findHistoryTimes(
    lessons.map(({vehicle}) => vehicle.lessonMinutes),
    period,
    windows,
    busy,
  );

  for (const [index, time] of times.entries()) {
    const lesson = lessons[index];

    if (lesson) {
      const {vehicle, lessonNumber, status, notes} = lesson;
      const [booking] = await tx
        .insert(bookings)
        .values({
          studentEmail,
          instructorSlug: DEMO_INSTRUCTOR,
          vehicleSlug: vehicle.slug,
          faction: vehicle.faction,
          ...time,
          status,
          lessonNumber,
          studentNote: notes?.student,
          privateNote: notes?.private,
          signedOffBy: 'demo',
          signedOffAt: time.endsAt,
        })
        .returning({id: bookings.id});
      const skills = await tx
        .select({skillId: lessonSkills.id})
        .from(lessonSkills)
        .where(
          and(
            eq(lessonSkills.vehicleSlug, vehicle.slug),
            eq(lessonSkills.lessonNumber, lessonNumber),
            lessonSkills.active,
          ),
        )
        .orderBy(asc(lessonSkills.position));

      if (booking && skills.length > 0) {
        await tx.insert(skillResults).values(
          skills.map(({skillId}, position) => ({
            bookingId: booking.id,
            vehicleSlug: vehicle.slug,
            lessonNumber,
            skillId,
            // A lesson to repeat has one skill failed, the last.
            result: status === 'repeat' && position === skills.length - 1 ? ('fail' as const) : ('pass' as const),
          })),
        );
      }
    }
  }
}

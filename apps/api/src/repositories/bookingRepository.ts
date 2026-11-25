import type {Booking, Faction, TimeOff} from '@hde/shared';
import type {Period} from '#src/bookings/lessonSlots.ts';
import type {AvailabilityWindow} from '#src/db/availabilityData.ts';
import type {Database} from '#src/db/client.ts';

import {and, asc, eq, gt, gte, lte, ne, or} from 'drizzle-orm';
import {isExclusionViolation} from '#src/db/errors.ts';
import {allowedUsers, bookings, instructorAvailability, instructors, instructorTimeOff} from '#src/db/schema.ts';
import {schoolDate} from '#src/timeOff/schoolDays.ts';

export interface BookingParties {
  studentEmail: string;
  instructorSlug: string;
  vehicleSlug: string;
}

export type NewBooking = BookingParties & Period & {faction: Faction};

/** When a lesson is, and who teaches it. */
export type LessonTime = Period & {instructorSlug: string};

export interface BookingRepository {
  listForStudent(email: string): Promise<Booking[]>;
  listAvailability(instructorSlug: string): Promise<AvailabilityWindow[]>;
  /** The instructor's time off that ends on or after a date. */
  listTimeOff(instructorSlug: string, from: string): Promise<Omit<TimeOff, 'id'>[]>;
  /**
   * The lessons, ending after `from`, that keep the student, instructor or vehicle busy. `exceptId` is a lesson to
   * leave out, such as one being rescheduled.
   */
  listBusy(parties: BookingParties, from: Date, exceptId: string | null): Promise<Period[]>;
  /**
   * Books a lesson if `check`, given the student's bookings, does not throw. A student's bookings are made one
   * at a time, so two requests cannot both pass it. Null if the time clashes with another lesson or
   * the instructor's time off.
   */
  create(booking: NewBooking, check: (existing: Booking[]) => void): Promise<Booking | null>;
  /**
   * Moves the student's own lesson if `check`, given the lesson (null if they have no such one), does not throw. The
   * lesson keeps its old time unless it gets the new one. Null if the new time clashes, as for `create`.
   */
  reschedule(
    email: string,
    id: string,
    time: LessonTime,
    check: (booking: Booking | null) => void,
  ): Promise<Booking | null>;
  /** Cancels the student's own lesson if `check` does not throw. Null if they have no such lesson. */
  cancel(email: string, id: string, check: (booking: Booking) => void): Promise<Booking | null>;
}

export type BookingRow = typeof bookings.$inferSelect;

export function toBooking({
  id,
  vehicleSlug,
  instructorSlug,
  startsAt,
  endsAt,
  status,
  lessonNumber,
  cancelReason,
  signedOffAt,
}: BookingRow): Booking {
  return {
    id,
    vehicleSlug,
    instructorSlug,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    status,
    lessonNumber,
    cancelReason,
    signedOffAt: signedOffAt?.toISOString() ?? null,
  };
}

type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

export class PostgresBookingRepository implements BookingRepository {
  private readonly db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  async listForStudent(email: string): Promise<Booking[]> {
    return this.studentBookings(this.db, email);
  }

  async listAvailability(instructorSlug: string): Promise<AvailabilityWindow[]> {
    const {weekday, startsAt, endsAt} = instructorAvailability;

    return this.db
      .select({weekday, startsAt, endsAt})
      .from(instructorAvailability)
      .where(eq(instructorAvailability.instructorSlug, instructorSlug));
  }

  async listTimeOff(instructorSlug: string, from: string): Promise<Omit<TimeOff, 'id'>[]> {
    const {startsOn, endsOn} = instructorTimeOff;

    return this.db
      .select({startsOn, endsOn})
      .from(instructorTimeOff)
      .where(and(eq(instructorTimeOff.instructorSlug, instructorSlug), gte(endsOn, from)));
  }

  async listBusy(
    {studentEmail, instructorSlug, vehicleSlug}: BookingParties,
    from: Date,
    exceptId: string | null,
  ): Promise<Period[]> {
    return this.db
      .select({startsAt: bookings.startsAt, endsAt: bookings.endsAt})
      .from(bookings)
      .where(
        and(
          ne(bookings.status, 'cancelled'),
          gt(bookings.endsAt, from),
          exceptId === null ? undefined : ne(bookings.id, exceptId),
          or(
            eq(bookings.studentEmail, studentEmail),
            eq(bookings.instructorSlug, instructorSlug),
            eq(bookings.vehicleSlug, vehicleSlug),
          ),
        ),
      );
  }

  async create(booking: NewBooking, check: (existing: Booking[]) => void): Promise<Booking | null> {
    return this.withStudentLocked(booking.studentEmail, async (tx) => {
      check(await this.studentBookings(tx, booking.studentEmail));

      if (await this.isAway(tx, booking)) {
        return null;
      }

      const [row] = await tx.insert(bookings).values(booking).returning();

      return row ? toBooking(row) : null;
    });
  }

  async reschedule(
    email: string,
    id: string,
    {instructorSlug, startsAt, endsAt}: LessonTime,
    check: (booking: Booking | null) => void,
  ): Promise<Booking | null> {
    return this.withStudentLocked(email, async (tx) => {
      const own = and(eq(bookings.id, id), eq(bookings.studentEmail, email));
      const [row] = await tx.select().from(bookings).where(own);
      check(row ? toBooking(row) : null);

      if (await this.isAway(tx, {instructorSlug, startsAt, endsAt})) {
        return null;
      }

      const [moved] = await tx.update(bookings).set({instructorSlug, startsAt, endsAt}).where(own).returning();

      return moved ? toBooking(moved) : null;
    });
  }

  async cancel(email: string, id: string, check: (booking: Booking) => void): Promise<Booking | null> {
    return this.withStudentLocked(email, async (tx) => {
      const own = and(eq(bookings.id, id), eq(bookings.studentEmail, email));
      const [row] = await tx.select().from(bookings).where(own);

      if (!row) {
        return null;
      }

      check(toBooking(row));
      const [cancelled] = await tx.update(bookings).set({status: 'cancelled'}).where(own).returning();

      return cancelled ? toBooking(cancelled) : null;
    });
  }

  /** Runs a change to the student's lessons in a transaction. Null if it would overlap another lesson. */
  private async withStudentLocked(
    email: string,
    change: (tx: Transaction) => Promise<Booking | null>,
  ): Promise<Booking | null> {
    try {
      return await this.db.transaction(async (tx) => {
        // Held until the end, so the student's bookings cannot change after they are checked.
        await tx.select().from(allowedUsers).where(eq(allowedUsers.email, email)).for('update');

        return change(tx);
      });
    } catch (error) {
      if (isExclusionViolation(error)) {
        return null;
      }

      throw error;
    }
  }

  /** Whether the instructor has time off then. They cannot be given any until the transaction ends. */
  private async isAway(tx: Transaction, {instructorSlug, startsAt, endsAt}: LessonTime): Promise<boolean> {
    // Shared with other bookings, but not with adding time off, which locks the instructor for itself.
    await tx.select().from(instructors).where(eq(instructors.slug, instructorSlug)).for('share');
    const away = await tx
      .select()
      .from(instructorTimeOff)
      .where(
        and(
          eq(instructorTimeOff.instructorSlug, instructorSlug),
          lte(instructorTimeOff.startsOn, schoolDate(endsAt)),
          gte(instructorTimeOff.endsOn, schoolDate(startsAt)),
        ),
      );

    return away.length > 0;
  }

  private async studentBookings(db: Pick<Database, 'select'>, email: string): Promise<Booking[]> {
    const rows = await db
      .select()
      .from(bookings)
      .where(eq(bookings.studentEmail, email))
      .orderBy(asc(bookings.startsAt));

    return rows.map(toBooking);
  }
}

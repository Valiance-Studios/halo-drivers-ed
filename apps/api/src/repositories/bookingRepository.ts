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

export interface BookingRepository {
  listForStudent(email: string): Promise<Booking[]>;
  listAvailability(instructorSlug: string): Promise<AvailabilityWindow[]>;
  /** The instructor's time off that ends on or after a date. */
  listTimeOff(instructorSlug: string, from: string): Promise<Omit<TimeOff, 'id'>[]>;
  /** The lessons, ending after `from`, that keep the student, instructor or vehicle busy. */
  listBusy(parties: BookingParties, from: Date): Promise<Period[]>;
  /**
   * Books a lesson if `check`, given the student's bookings, does not throw. A student's bookings are made one
   * at a time, so two requests cannot both pass it. Null if the time clashes with another lesson or
   * the instructor's time off.
   */
  create(booking: NewBooking, check: (existing: Booking[]) => void): Promise<Booking | null>;
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
  };
}

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

  async listBusy({studentEmail, instructorSlug, vehicleSlug}: BookingParties, from: Date): Promise<Period[]> {
    return this.db
      .select({startsAt: bookings.startsAt, endsAt: bookings.endsAt})
      .from(bookings)
      .where(
        and(
          ne(bookings.status, 'cancelled'),
          gt(bookings.endsAt, from),
          or(
            eq(bookings.studentEmail, studentEmail),
            eq(bookings.instructorSlug, instructorSlug),
            eq(bookings.vehicleSlug, vehicleSlug),
          ),
        ),
      );
  }

  async create(booking: NewBooking, check: (existing: Booking[]) => void): Promise<Booking | null> {
    try {
      return await this.db.transaction(async (tx) => {
        // Holds the student's row until the end, so their bookings cannot change after the check.
        await tx.select().from(allowedUsers).where(eq(allowedUsers.email, booking.studentEmail)).for('update');
        check(await this.studentBookings(tx, booking.studentEmail));

        // Shared with other bookings, but not with adding time off, which locks the instructor for itself.
        await tx.select().from(instructors).where(eq(instructors.slug, booking.instructorSlug)).for('share');
        const away = await tx
          .select()
          .from(instructorTimeOff)
          .where(
            and(
              eq(instructorTimeOff.instructorSlug, booking.instructorSlug),
              lte(instructorTimeOff.startsOn, schoolDate(booking.endsAt)),
              gte(instructorTimeOff.endsOn, schoolDate(booking.startsAt)),
            ),
          );

        if (away.length > 0) {
          return null;
        }

        const [row] = await tx.insert(bookings).values(booking).returning();

        return row ? toBooking(row) : null;
      });
    } catch (error) {
      if (isExclusionViolation(error)) {
        return null;
      }

      throw error;
    }
  }

  async cancel(email: string, id: string, check: (booking: Booking) => void): Promise<Booking | null> {
    return this.db.transaction(async (tx) => {
      const own = and(eq(bookings.id, id), eq(bookings.studentEmail, email));
      const [row] = await tx.select().from(bookings).where(own).for('update');

      if (!row) {
        return null;
      }

      check(toBooking(row));
      const [cancelled] = await tx.update(bookings).set({status: 'cancelled'}).where(own).returning();

      return cancelled ? toBooking(cancelled) : null;
    });
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

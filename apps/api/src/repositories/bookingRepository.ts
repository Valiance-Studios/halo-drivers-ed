import type {Booking, Faction} from '@hde/shared';
import type {Period} from '#src/bookings/lessonSlots.ts';
import type {AvailabilityWindow} from '#src/db/availabilityData.ts';
import type {Database} from '#src/db/client.ts';

import {and, asc, eq, gt, ne, or} from 'drizzle-orm';
import {allowedUsers, bookings, instructorAvailability} from '#src/db/schema.ts';

export interface BookingParties {
  studentEmail: string;
  instructorSlug: string;
  vehicleSlug: string;
}

export type NewBooking = BookingParties & Period & {faction: Faction};

export interface BookingRepository {
  listForStudent(email: string): Promise<Booking[]>;
  listAvailability(instructorSlug: string): Promise<AvailabilityWindow[]>;
  /** The lessons, ending after `from`, that keep the student, instructor or vehicle busy. */
  listBusy(parties: BookingParties, from: Date): Promise<Period[]>;
  /**
   * Books a lesson if `check`, given the student's bookings, does not throw. A student's bookings are made one
   * at a time, so two requests cannot both pass it. Null if the time clashes with another lesson.
   */
  create(booking: NewBooking, check: (existing: Booking[]) => void): Promise<Booking | null>;
  /** Cancels the student's own lesson if `check` does not throw. Null if they have no such lesson. */
  cancel(email: string, id: string, check: (booking: Booking) => void): Promise<Booking | null>;
}

/** Postgres's code for a violated exclusion constraint. */
const EXCLUSION_VIOLATION = '23P01';

export type BookingRow = typeof bookings.$inferSelect;

export function toBooking({
  id,
  vehicleSlug,
  instructorSlug,
  startsAt,
  endsAt,
  status,
  lessonNumber,
}: BookingRow): Booking {
  return {
    id,
    vehicleSlug,
    instructorSlug,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    status,
    lessonNumber,
  };
}

function isClash(error: unknown): boolean {
  const {cause} = error as {cause?: {code?: string}};

  return cause?.code === EXCLUSION_VIOLATION;
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
        const [row] = await tx.insert(bookings).values(booking).returning();

        return row ? toBooking(row) : null;
      });
    } catch (error) {
      if (isClash(error)) {
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

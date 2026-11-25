import type {TimeOff, TimeOffAnswer} from '@hde/shared';
import type {Period} from '#src/bookings/lessonSlots.ts';
import type {Database} from '#src/db/client.ts';

import {and, asc, eq, gt, gte, inArray, lt} from 'drizzle-orm';
import {allowedUsers, bookings, instructors, instructorTimeOff} from '#src/db/schema.ts';
import {isExclusionViolation} from '#src/db/errors.ts';
import {toAdminLesson} from '#src/repositories/lessonRepository.ts';

export interface NewTimeOff {
  instructorSlug: string;
  startsOn: string;
  endsOn: string;
  /** The time those days cover, from now on. */
  period: Period;
  cancel: {lessonIds: string[]; reason: string} | null;
}

export interface TimeOffRepository {
  /** An instructor's time off that ends on or after a date, soonest first. */
  list(instructorSlug: string, from: string): Promise<TimeOff[]>;
  /**
   * Adds time off and cancels the given lessons in it, unless others are booked in it. Booking with the instructor
   * waits meanwhile. Null if it overlaps time off they already have.
   */
  add(timeOff: NewTimeOff): Promise<TimeOffAnswer | null>;
  /** Whether there was any such time off. */
  remove(id: string): Promise<boolean>;
}

type Queries = Pick<Database, 'select'>;

export class PostgresTimeOffRepository implements TimeOffRepository {
  private readonly db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  async list(instructorSlug: string, from: string): Promise<TimeOff[]> {
    const {id, startsOn, endsOn} = instructorTimeOff;

    return this.db
      .select({id, startsOn, endsOn})
      .from(instructorTimeOff)
      .where(and(eq(instructorTimeOff.instructorSlug, instructorSlug), gte(endsOn, from)))
      .orderBy(asc(startsOn));
  }

  async add({instructorSlug, startsOn, endsOn, period, cancel}: NewTimeOff): Promise<TimeOffAnswer | null> {
    try {
      return await this.db.transaction(async (tx) => {
        // Students first, then the instructor, as booking does, so the two cannot deadlock.
        const expected = await this.booked(tx, instructorSlug, period);
        const emails = [...new Set(expected.map(({studentEmail}) => studentEmail))];

        if (emails.length > 0) {
          await tx
            .select()
            .from(allowedUsers)
            .where(inArray(allowedUsers.email, emails))
            .orderBy(asc(allowedUsers.email))
            .for('update');
        }

        await tx.select().from(instructors).where(eq(instructors.slug, instructorSlug)).for('update');

        // Again, now that no one can book. A lesson booked since is not in the list, so it stops the change.
        const lessons = await this.booked(tx, instructorSlug, period);
        const cancelled = new Set(cancel?.lessonIds);

        if (lessons.some(({id, studentEmail}) => !cancelled.has(id) || !emails.includes(studentEmail))) {
          return {saved: false, lessons};
        }

        if (cancel && lessons.length > 0) {
          await tx
            .update(bookings)
            .set({status: 'cancelled', cancelReason: cancel.reason})
            .where(
              inArray(
                bookings.id,
                lessons.map(({id}) => id),
              ),
            );
        }

        const {id} = instructorTimeOff;
        const [row] = await tx.insert(instructorTimeOff).values({instructorSlug, startsOn, endsOn}).returning({id});

        return row ? {saved: true, timeOff: {id: row.id, startsOn, endsOn}} : null;
      });
    } catch (error) {
      if (isExclusionViolation(error)) {
        return null;
      }

      throw error;
    }
  }

  async remove(id: string): Promise<boolean> {
    const removed = await this.db
      .delete(instructorTimeOff)
      .where(eq(instructorTimeOff.id, id))
      .returning({id: instructorTimeOff.id});

    return removed.length > 0;
  }

  private async booked(db: Queries, instructorSlug: string, {startsAt, endsAt}: Period) {
    const rows = await db
      .select({booking: bookings, studentName: allowedUsers.displayName})
      .from(bookings)
      .innerJoin(allowedUsers, eq(allowedUsers.email, bookings.studentEmail))
      .where(
        and(
          eq(bookings.instructorSlug, instructorSlug),
          eq(bookings.status, 'booked'),
          lt(bookings.startsAt, endsAt),
          gt(bookings.endsAt, startsAt),
        ),
      )
      .orderBy(asc(bookings.startsAt));

    return rows.map(({booking, studentName}) => toAdminLesson(booking, studentName));
  }
}

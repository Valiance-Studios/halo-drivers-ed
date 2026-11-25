import type {AdminLesson, AttendedLesson, Booking, BookingStatus, LessonNotes, SkillResults} from '@hde/shared';
import type {Database} from '#src/db/client.ts';
import type {BookingRow} from '#src/repositories/bookingRepository.ts';

import {and, asc, eq, inArray} from 'drizzle-orm';
import {allowedUsers, bookings, skillResults} from '#src/db/schema.ts';
import {toBooking} from '#src/repositories/bookingRepository.ts';

/** One lesson's results, for whichever of the course's lessons they were marked against. */
export interface MarkedResults {
  bookingId: string;
  lessonNumber: number;
  results: SkillResults;
}

/** A lesson and what decides its form: the student's other lessons, and their results and notes in this course. */
export interface LessonContext {
  lesson: AdminLesson;
  studentBookings: Booking[];
  marked: MarkedResults[];
  /** By booking id. */
  notes: Map<string, LessonNotes>;
}

export interface LessonChange {
  /** The course's lesson the results are for. */
  markedLesson: number;
  /** Null leaves the results as they are. */
  results: SkillResults | null;
  /** Null leaves the notes as they are. */
  notes: LessonNotes | null;
  /** Null leaves the lesson as it is, saving only the results and notes. */
  signOff: {status: BookingStatus; lessonNumber: number | null; by: string; at: Date} | null;
}

export interface LessonRepository {
  /** Lessons that were not cancelled, soonest first; null means every instructor's, or every student's. */
  list(instructorSlug: string | null, studentEmail: string | null): Promise<AdminLesson[]>;
  /** The student's lessons that were signed off as attended, with their results, soonest first. */
  listAttended(studentEmail: string): Promise<AttendedLesson[]>;
  findContext(id: string): Promise<LessonContext | null>;
  /**
   * Makes the change `decide` returns, unless it throws. The student's lessons cannot change meanwhile. Null if
   * there is no such lesson.
   */
  update(id: string, decide: (context: LessonContext) => LessonChange): Promise<AdminLesson | null>;
}

function toAdminLesson(row: BookingRow, studentName: string | null): AdminLesson {
  return {...toBooking(row), studentEmail: row.studentEmail, studentName};
}

type Queries = Pick<Database, 'select'>;

export class PostgresLessonRepository implements LessonRepository {
  private readonly db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  async list(instructorSlug: string | null, studentEmail: string | null): Promise<AdminLesson[]> {
    const rows = await this.db
      .select({booking: bookings, studentName: allowedUsers.displayName})
      .from(bookings)
      .innerJoin(allowedUsers, eq(allowedUsers.email, bookings.studentEmail))
      .where(
        and(
          instructorSlug ? eq(bookings.instructorSlug, instructorSlug) : undefined,
          studentEmail ? eq(bookings.studentEmail, studentEmail) : undefined,
        ),
      )
      .orderBy(asc(bookings.startsAt));

    return rows
      .filter(({booking}) => booking.status !== 'cancelled')
      .map(({booking, studentName}) => toAdminLesson(booking, studentName));
  }

  async listAttended(studentEmail: string): Promise<AttendedLesson[]> {
    const attended = and(eq(bookings.studentEmail, studentEmail), inArray(bookings.status, ['completed', 'repeat']));
    const rows = await this.db.select().from(bookings).where(attended).orderBy(asc(bookings.startsAt));
    const resultRows = await this.db
      .select({bookingId: skillResults.bookingId, skillId: skillResults.skillId, result: skillResults.result})
      .from(skillResults)
      .innerJoin(bookings, eq(bookings.id, skillResults.bookingId))
      .where(attended);
    const results = new Map<string, SkillResults>();

    for (const {bookingId, skillId, result} of resultRows) {
      results.set(bookingId, {...results.get(bookingId), [skillId]: result});
    }

    return rows.flatMap(({id, vehicleSlug, lessonNumber, status, startsAt}) =>
      lessonNumber === null
        ? []
        : [
            {
              bookingId: id,
              vehicleSlug,
              lessonNumber,
              status,
              startsAt: startsAt.toISOString(),
              results: results.get(id) ?? {},
            },
          ],
    );
  }

  async findContext(id: string): Promise<LessonContext | null> {
    return this.loadContext(this.db, id);
  }

  async update(id: string, decide: (context: LessonContext) => LessonChange): Promise<AdminLesson | null> {
    return this.db.transaction(async (tx) => {
      const [booking] = await tx
        .select({studentEmail: bookings.studentEmail})
        .from(bookings)
        .where(eq(bookings.id, id));

      if (!booking) {
        return null;
      }

      // The same lock booking takes, so the student's lessons cannot change after the decision.
      await tx.select().from(allowedUsers).where(eq(allowedUsers.email, booking.studentEmail)).for('update');
      const context = await this.loadContext(tx, id);

      if (!context) {
        return null;
      }

      const {markedLesson, results, notes, signOff} = decide(context);

      if (results) {
        const rows = Object.entries(results).map(([skillId, result]) => ({
          bookingId: id,
          vehicleSlug: context.lesson.vehicleSlug,
          lessonNumber: markedLesson,
          skillId,
          result,
        }));
        await tx.delete(skillResults).where(eq(skillResults.bookingId, id));

        if (rows.length > 0) {
          await tx.insert(skillResults).values(rows);
        }
      }

      if (!notes && !signOff) {
        return context.lesson;
      }

      const [changed] = await tx
        .update(bookings)
        .set({
          ...(notes && {studentNote: notes.student, privateNote: notes.private}),
          ...(signOff && {
            status: signOff.status,
            lessonNumber: signOff.lessonNumber,
            signedOffBy: signOff.by,
            signedOffAt: signOff.at,
          }),
        })
        .where(eq(bookings.id, id))
        .returning();

      return changed ? toAdminLesson(changed, context.lesson.studentName) : null;
    });
  }

  private async loadContext(db: Queries, id: string): Promise<LessonContext | null> {
    const [found] = await db
      .select({row: bookings, studentName: allowedUsers.displayName})
      .from(bookings)
      .innerJoin(allowedUsers, eq(allowedUsers.email, bookings.studentEmail))
      .where(eq(bookings.id, id));

    if (!found) {
      return null;
    }

    const {row, studentName} = found;

    // In turn rather than together: within a transaction they share one connection.
    const studentRows = await db
      .select()
      .from(bookings)
      .where(eq(bookings.studentEmail, row.studentEmail))
      .orderBy(asc(bookings.startsAt));
    const resultRows = await db
      .select({
        bookingId: skillResults.bookingId,
        lessonNumber: skillResults.lessonNumber,
        skillId: skillResults.skillId,
        result: skillResults.result,
      })
      .from(skillResults)
      .innerJoin(bookings, eq(bookings.id, skillResults.bookingId))
      .where(and(eq(bookings.studentEmail, row.studentEmail), eq(bookings.vehicleSlug, row.vehicleSlug)));
    const marked = new Map<string, MarkedResults>();

    for (const {bookingId, lessonNumber, skillId, result} of resultRows) {
      const entry = marked.get(bookingId) ?? {bookingId, lessonNumber, results: {}};
      entry.results[skillId] = result;
      marked.set(bookingId, entry);
    }

    return {
      lesson: toAdminLesson(row, studentName),
      studentBookings: studentRows.map(toBooking),
      marked: [...marked.values()],
      notes: new Map(
        studentRows
          .filter(({vehicleSlug}) => vehicleSlug === row.vehicleSlug)
          .map((other) => [other.id, {student: other.studentNote, private: other.privateNote}]),
      ),
    };
  }
}

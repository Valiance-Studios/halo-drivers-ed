import type {BookingStatus} from '@hde/shared';
import type {NewBooking} from '#src/repositories/bookingRepository.ts';

import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vite-plus/test';
import {eq} from 'drizzle-orm';
import {BookingService} from '#src/bookings/bookingService.ts';
import {connect} from '#src/db/client.ts';
import {bookings, instructorAvailability} from '#src/db/schema.ts';
import {seedCatalog} from '#src/db/seed.ts';
import {LessonService} from '#src/lessons/lessonService.ts';
import {PostgresAllowlistRepository} from '#src/repositories/allowlistRepository.ts';
import {PostgresBookingRepository} from '#src/repositories/bookingRepository.ts';
import {PostgresCatalogRepository} from '#src/repositories/catalogRepository.ts';
import {PostgresLessonRepository} from '#src/repositories/lessonRepository.ts';
import {TEST_DATABASE_URL} from './database.ts';

const {db, close} = connect(TEST_DATABASE_URL, 5);
const repository = new PostgresBookingRepository(db);
const STUDENT = 'student@example.com';
const OTHER = 'other@example.com';
// Monday 8 June 2026, 06:00 Eastern. Master Chief teaches from 08:00 (12:00 UTC) to 14:00.
const NOW = new Date('2026-06-08T10:00:00Z');
const service = new BookingService(repository, new PostgresCatalogRepository(db), () => NOW);

const at = (day: number, hour: number, minute = 0) => new Date(Date.UTC(2026, 5, day, hour, minute));
const mongoose = (startsAt: Date) => ({
  vehicleSlug: 'mongoose',
  instructorSlug: 'master-chief',
  startsAt: startsAt.toISOString(),
});
const lesson = (overrides: Partial<NewBooking & {status: BookingStatus}> = {}) => ({
  studentEmail: STUDENT,
  instructorSlug: 'master-chief',
  vehicleSlug: 'mongoose',
  faction: 'unsc' as const,
  startsAt: at(8, 13),
  endsAt: at(8, 14),
  ...overrides,
});

const COMPLETED = {status: 'completed' as const, lessonNumber: 1, signedOffBy: OTHER, signedOffAt: NOW};

async function constraint(query: Promise<unknown>): Promise<string | undefined> {
  const error = await query.then(
    () => null,
    (failure: unknown) => failure as {cause?: {constraint?: string}},
  );

  return error?.cause?.constraint;
}

/** The API error code a call fails with. */
async function errorCode(call: Promise<unknown>): Promise<string | undefined> {
  return call.then(
    () => undefined,
    (error: unknown) => (error as {code?: string}).code,
  );
}

beforeAll(async () => {
  await seedCatalog(db);
  const allowlist = new PostgresAllowlistRepository(db);
  await allowlist.allow(STUDENT, 'admin');
  await allowlist.allow(OTHER, 'admin');
});

beforeEach(async () => {
  await db.delete(bookings);
});

afterAll(async () => {
  await close();
});

describe('booking constraints', () => {
  it.each([
    ['bookings_instructor_free', {studentEmail: OTHER, vehicleSlug: 'warthog'}],
    ['bookings_vehicle_free', {studentEmail: OTHER, instructorSlug: 'sergeant-johnson'}],
    ['bookings_student_free', {instructorSlug: 'sergeant-johnson', vehicleSlug: 'warthog'}],
  ])('%s rejects an overlap', async (name, overrides) => {
    await db.insert(bookings).values(lesson());

    expect(
      await constraint(
        db.insert(bookings).values(lesson({startsAt: at(8, 13, 30), endsAt: at(8, 14, 30), ...overrides})),
      ),
    ).toBe(name);
  });

  it('allows back-to-back lessons, and reusing a cancelled time', async () => {
    await db.insert(bookings).values(lesson({status: 'cancelled'}));
    await db.insert(bookings).values(lesson());
    await db.insert(bookings).values(lesson({startsAt: at(8, 14), endsAt: at(8, 15)}));

    expect(await repository.listForStudent(STUDENT)).toHaveLength(3);
  });

  it('rejects a lesson that ends before it starts', async () => {
    expect(await constraint(db.insert(bookings).values(lesson({endsAt: at(8, 12)})))).toBe('bookings_order');
  });

  it("rejects an instructor with another faction's vehicle", async () => {
    expect(await constraint(db.insert(bookings).values(lesson({vehicleSlug: 'ghost'})))).toBe('bookings_vehicle_fkey');
  });

  it('rejects hours on an unknown weekday or in the wrong order', async () => {
    const hours = {instructorSlug: 'arbiter', weekday: 1, startsAt: '01:00', endsAt: '02:00'};

    expect(await constraint(db.insert(instructorAvailability).values({...hours, weekday: 8}))).toBe(
      'instructor_availability_weekday',
    );
    expect(await constraint(db.insert(instructorAvailability).values({...hours, endsAt: '00:30'}))).toBe(
      'instructor_availability_order',
    );
  });

  it('keeps bookings when the catalog is seeded again', async () => {
    await db.insert(bookings).values(lesson());
    await seedCatalog(db);

    expect(await repository.listForStudent(STUDENT)).toHaveLength(1);
  });
});

describe('BookingService', () => {
  it('books an offered time, which is then no longer offered to anyone', async () => {
    const [slot] = await service.slots(STUDENT, 'mongoose', 'master-chief');
    expect(slot).toEqual({startsAt: '2026-06-08T12:00:00.000Z', endsAt: '2026-06-08T12:45:00.000Z'});

    expect(await service.book(STUDENT, mongoose(at(8, 12)))).toMatchObject({...slot, status: 'booked'});
    const [next] = await service.slots(OTHER, 'mongoose', 'master-chief');
    expect(next?.startsAt).toBe('2026-06-08T13:00:00.000Z');
    expect(await errorCode(service.book(OTHER, mongoose(at(8, 12))))).toBe('slot-unavailable');
  });

  it('refuses times outside the hours, and instructors who do not teach the course', async () => {
    expect(await errorCode(service.book(STUDENT, mongoose(at(8, 11))))).toBe('slot-unavailable');
    expect(await errorCode(service.slots(STUDENT, 'pelican', 'master-chief'))).toBe('invalid-request');
  });

  it('gives one time to only one of two students who book it together', async () => {
    const codes = await Promise.all(
      [STUDENT, OTHER].map((email) => errorCode(service.book(email, mongoose(at(8, 12))))),
    );

    expect(codes).toHaveLength(2);
    expect(codes).toContain('slot-unavailable');
    expect(codes).toContain(undefined);
  });

  it('holds a student to the required lessons, even when they book together', async () => {
    const codes = await Promise.all(
      [8, 9, 10, 11].map((day) => errorCode(service.book(STUDENT, mongoose(at(day, 12))))),
    );

    expect(codes.filter((code) => code === undefined)).toHaveLength(2);
    expect(codes.filter((code) => code === 'no-lessons-left')).toHaveLength(2);
  });

  it('locks a course until every lesson of its prerequisite is completed', async () => {
    const warthog = {vehicleSlug: 'warthog', instructorSlug: 'master-chief', startsAt: at(9, 12).toISOString()};
    await db.insert(bookings).values({...lesson({startsAt: at(1, 12), endsAt: at(1, 13)}), ...COMPLETED});
    expect(await errorCode(service.book(STUDENT, warthog))).toBe('course-locked');

    await db.insert(bookings).values({...lesson({startsAt: at(2, 12), endsAt: at(2, 13)}), ...COMPLETED});
    expect(await errorCode(service.book(STUDENT, warthog))).toBeUndefined();
  });

  it('allows only the repeat to be booked until it is completed, even when booked together', async () => {
    const repeat = {status: 'repeat' as const, lessonNumber: 1, signedOffBy: OTHER, signedOffAt: NOW};
    await db.insert(bookings).values({...lesson({startsAt: at(1, 12), endsAt: at(1, 13)}), ...repeat});
    const codes = await Promise.all([9, 10].map((day) => errorCode(service.book(STUDENT, mongoose(at(day, 12))))));
    expect(codes).toContain(undefined);
    expect(codes).toContain('repeat-due');

    // Once it is completed, the next lesson can be booked.
    await db.update(bookings).set(COMPLETED).where(eq(bookings.status, 'booked'));
    expect(await errorCode(service.book(STUDENT, mongoose(at(11, 12))))).toBeUndefined();
  });

  it('cancels a lesson with a day of notice, which frees its time', async () => {
    const {id} = await service.book(STUDENT, mongoose(at(9, 12)));

    expect(await service.cancel(STUDENT, id)).toMatchObject({id, status: 'cancelled'});
    expect(await errorCode(service.book(OTHER, mongoose(at(9, 12))))).toBeUndefined();
  });

  it('never both cancels a lesson and signs it off', async () => {
    const lessons = new LessonService(new PostgresLessonRepository(db), new PostgresCatalogRepository(db), () => NOW);
    const signOff = {
      results: {},
      notes: {student: '', private: ''},
      attendance: 'missed' as const,
      early: true,
    };

    for (let round = 0; round < 30; round++) {
      await db.delete(bookings);
      const {id} = await service.book(STUDENT, mongoose(at(9, 12)));
      const codes = await Promise.all([
        errorCode(lessons.signOff(id, signOff, OTHER, null)),
        errorCode(service.cancel(STUDENT, id)),
      ]);

      expect(codes.filter((code) => code === undefined)).toHaveLength(1);
    }
  });

  it("refuses to cancel late, twice, or another student's lesson", async () => {
    const soon = await service.book(STUDENT, mongoose(at(8, 12)));
    const later = await service.book(STUDENT, mongoose(at(10, 12)));

    expect(await errorCode(service.cancel(STUDENT, soon.id))).toBe('too-late-to-cancel');
    expect(await errorCode(service.cancel(OTHER, later.id))).toBe('not-found');
    await service.cancel(STUDENT, later.id);
    expect(await errorCode(service.cancel(STUDENT, later.id))).toBe('too-late-to-cancel');
  });

  describe('rescheduling', () => {
    const to = (startsAt: Date, instructorSlug = 'master-chief') => ({
      instructorSlug,
      startsAt: startsAt.toISOString(),
    });

    it('moves a lesson, which frees its old time and takes the new one', async () => {
      const {id} = await service.book(STUDENT, mongoose(at(9, 12)));

      expect(await service.reschedule(STUDENT, id, to(at(10, 12)))).toMatchObject({
        id,
        instructorSlug: 'master-chief',
        startsAt: '2026-06-10T12:00:00.000Z',
        endsAt: '2026-06-10T12:45:00.000Z',
        status: 'booked',
      });
      expect(await service.list(STUDENT)).toHaveLength(1);
      expect(await errorCode(service.book(OTHER, mongoose(at(10, 12))))).toBe('slot-unavailable');
      expect(await errorCode(service.book(OTHER, mongoose(at(9, 12))))).toBeUndefined();
    });

    it('can move to a time that overlaps the old one, but does not offer the old one', async () => {
      const {id} = await service.book(STUDENT, mongoose(at(9, 12)));
      const starts = (await service.rescheduleSlots(STUDENT, id, 'master-chief')).map(({startsAt}) => startsAt);

      expect(starts).toContain('2026-06-09T12:30:00.000Z');
      expect(starts).not.toContain('2026-06-09T12:00:00.000Z');
      expect(await errorCode(service.reschedule(STUDENT, id, to(at(9, 12))))).toBe('slot-unavailable');
      expect(await errorCode(service.reschedule(STUDENT, id, to(at(9, 12, 30))))).toBeUndefined();
    });

    it('can change the instructor, to one who teaches the course', async () => {
      const {id} = await service.book(STUDENT, mongoose(at(9, 12)));
      const [slot] = await service.rescheduleSlots(STUDENT, id, 'sergeant-johnson');
      const startsAt = new Date(slot?.startsAt ?? '');

      expect(await service.reschedule(STUDENT, id, to(startsAt, 'sergeant-johnson'))).toMatchObject({
        instructorSlug: 'sergeant-johnson',
        ...slot,
      });
      expect(await errorCode(service.rescheduleSlots(STUDENT, id, 'arbiter'))).toBe('invalid-request');
    });

    it('keeps the old time when the new one is taken', async () => {
      const {id, startsAt} = await service.book(STUDENT, mongoose(at(9, 12)));
      await service.book(OTHER, mongoose(at(10, 12)));

      expect(await errorCode(service.reschedule(STUDENT, id, to(at(10, 12))))).toBe('slot-unavailable');
      expect(await service.list(STUDENT)).toMatchObject([{id, startsAt, status: 'booked'}]);
    });

    it('gives one time to only one of two students who move to it together', async () => {
      const own = await service.book(STUDENT, mongoose(at(9, 12)));
      const other = await service.book(OTHER, mongoose(at(10, 12)));
      const codes = await Promise.all([
        errorCode(service.reschedule(STUDENT, own.id, to(at(11, 12)))),
        errorCode(service.reschedule(OTHER, other.id, to(at(11, 12)))),
      ]);

      expect(codes).toContain('slot-unavailable');
      expect(codes).toContain(undefined);
      expect(await service.list(STUDENT)).toHaveLength(1);
      expect(await service.list(OTHER)).toHaveLength(1);
    });

    it('does not count against the lessons a course has', async () => {
      const {id} = await service.book(STUDENT, mongoose(at(9, 12)));
      await service.book(STUDENT, mongoose(at(10, 12)));

      expect(await errorCode(service.reschedule(STUDENT, id, to(at(11, 12))))).toBeUndefined();
    });

    it("refuses late, cancelled, and other students' lessons", async () => {
      const soon = await service.book(STUDENT, mongoose(at(8, 12)));
      const later = await service.book(STUDENT, mongoose(at(10, 12)));
      const move = (email: string, id: string) => errorCode(service.reschedule(email, id, to(at(11, 12))));

      expect(await move(STUDENT, soon.id)).toBe('too-late-to-reschedule');
      expect(await move(OTHER, later.id)).toBe('not-found');
      expect(await errorCode(service.rescheduleSlots(OTHER, later.id, 'master-chief'))).toBe('not-found');
      await service.cancel(STUDENT, later.id);
      expect(await move(STUDENT, later.id)).toBe('too-late-to-reschedule');
    });

    it('never brings back a lesson cancelled at the same time', async () => {
      const {id} = await service.book(STUDENT, mongoose(at(9, 12)));
      await Promise.all([
        errorCode(service.reschedule(STUDENT, id, to(at(10, 12)))),
        errorCode(service.cancel(STUDENT, id)),
      ]);

      expect(await service.list(STUDENT)).toMatchObject([{id, status: 'cancelled'}]);
    });
  });

  it("lists only the student's own lessons", async () => {
    await service.book(STUDENT, mongoose(at(9, 12)));

    expect(await service.list(STUDENT)).toHaveLength(1);
    expect(await service.list(OTHER)).toEqual([]);
  });
});

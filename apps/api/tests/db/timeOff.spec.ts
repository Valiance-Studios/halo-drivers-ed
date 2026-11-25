import type {TimeOffRequest} from '@hde/shared';

import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vite-plus/test';
import {BookingService} from '#src/bookings/bookingService.ts';
import {connect} from '#src/db/client.ts';
import {bookings, instructorTimeOff} from '#src/db/schema.ts';
import {seedCatalog} from '#src/db/seed.ts';
import {PostgresAllowlistRepository} from '#src/repositories/allowlistRepository.ts';
import {PostgresBookingRepository} from '#src/repositories/bookingRepository.ts';
import {PostgresCatalogRepository} from '#src/repositories/catalogRepository.ts';
import {PostgresTimeOffRepository} from '#src/repositories/timeOffRepository.ts';
import {TimeOffService} from '#src/timeOff/timeOffService.ts';
import {TEST_DATABASE_URL} from './database.ts';

const {db, close} = connect(TEST_DATABASE_URL, 10);
const catalog = new PostgresCatalogRepository(db);
const STUDENTS = ['student@example.com', 'other@example.com', 'third@example.com'];
const [STUDENT = '', OTHER = ''] = STUDENTS;
const CHIEF = 'master-chief';
// Monday 8 June 2026, 06:00 Eastern. Master Chief teaches on weekdays from 08:00 (12:00 UTC) to 14:00.
const NOW = new Date('2026-06-08T10:00:00Z');
const bookingRepository = new PostgresBookingRepository(db);
const bookingService = new BookingService(bookingRepository, catalog, () => NOW);
const service = new TimeOffService(new PostgresTimeOffRepository(db), catalog, () => NOW);

const book = (email: string, day: number, hour = 12) =>
  bookingService.book(email, {
    vehicleSlug: 'mongoose',
    instructorSlug: CHIEF,
    startsAt: new Date(Date.UTC(2026, 5, day, hour)).toISOString(),
  });
const add = (startsOn: string, endsOn: string, cancel: TimeOffRequest['cancel'] = null) =>
  service.add(CHIEF, {startsOn: `2026-06-${startsOn}`, endsOn: `2026-06-${endsOn}`, cancel});

async function offeredDays(): Promise<string[]> {
  const slots = await bookingService.slots(STUDENT, 'mongoose', CHIEF);

  return [...new Set(slots.map(({startsAt}) => startsAt.slice(8, 10)))];
}

async function errorCode(call: Promise<unknown>): Promise<string | undefined> {
  return call.then(
    () => undefined,
    (error: unknown) => (error as {code?: string}).code,
  );
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
  const allowlist = new PostgresAllowlistRepository(db);

  for (const email of STUDENTS) {
    await allowlist.allow(email, 'student');
  }
});

beforeEach(async () => {
  await db.delete(bookings);
  await db.delete(instructorTimeOff);
});

afterAll(async () => {
  await db.delete(instructorTimeOff);
  await close();
});

describe('time off', () => {
  it('takes whole days out of what is offered, for that instructor only', async () => {
    const before = await offeredDays();
    expect(before).toContain('09');
    expect(await add('09', '10')).toMatchObject({saved: true});

    expect(await offeredDays()).toEqual(before.filter((day) => day !== '09' && day !== '10'));
    expect(await errorCode(book(STUDENT, 9))).toBe('slot-unavailable');
    expect(await errorCode(book(STUDENT, 11))).toBeUndefined();
    const johnson = await bookingService.slots(STUDENT, 'mongoose', 'sergeant-johnson');
    expect(johnson.some(({startsAt}) => startsAt.startsWith('2026-06-09'))).toBe(true);
  });

  it('cannot be rescheduled into, or missed by a lesson moving into it at the same time', async () => {
    const {id} = await book(STUDENT, 9);
    const move = (day: number) =>
      errorCode(
        bookingService.reschedule(STUDENT, id, {
          instructorSlug: CHIEF,
          startsAt: new Date(Date.UTC(2026, 5, day, 12)).toISOString(),
        }),
      );
    await add('10', '10');
    expect(await move(10)).toBe('slot-unavailable');

    const [answer, code] = await Promise.all([add('11', '11'), move(11)]);
    expect(answer.saved).toBe(code === 'slot-unavailable');
  });

  it('is refused while lessons are booked in it, until each is cancelled with a reason', async () => {
    const [first, second] = [await book(STUDENT, 9), await book(OTHER, 10)];
    const outside = await book(STUDENT, 11);
    const answer = await add('09', '10');
    expect(answer).toMatchObject({saved: false, lessons: [{id: first.id}, {id: second.id}]});
    expect(await add('09', '10', {lessonIds: [first.id], reason: 'Away.'})).toMatchObject({saved: false});
    expect(await bookingService.list(STUDENT)).toMatchObject([{status: 'booked'}, {status: 'booked'}]);
    expect(await service.list(CHIEF)).toEqual([]);

    const cancel = {lessonIds: [first.id, second.id, outside.id], reason: 'Away.'};
    expect(await add('09', '10', cancel)).toMatchObject({saved: true});
    // The lesson outside it is not cancelled, whatever was asked.
    expect(await bookingService.list(STUDENT)).toMatchObject([
      {id: first.id, status: 'cancelled', cancelReason: 'Away.'},
      {id: outside.id, status: 'booked', cancelReason: null},
    ]);
    expect(await bookingService.list(OTHER)).toMatchObject([{status: 'cancelled', cancelReason: 'Away.'}]);
  });

  it('leaves lessons that are over to be signed off', async () => {
    const startsAt = new Date(Date.UTC(2026, 5, 8, 5));
    const endsAt = new Date(Date.UTC(2026, 5, 8, 6));
    const lesson = {instructorSlug: CHIEF, vehicleSlug: 'mongoose', faction: 'unsc' as const, startsAt, endsAt};
    await db.insert(bookings).values({...lesson, studentEmail: STUDENT});

    expect(await add('08', '08')).toMatchObject({saved: true});
    expect(await bookingService.list(STUDENT)).toMatchObject([{status: 'booked'}]);
  });

  it('never leaves a lesson booked in it, when both are made together', async () => {
    for (let round = 0; round < 10; round++) {
      await db.delete(bookings);
      await db.delete(instructorTimeOff);
      const [answer, ...booked] = await Promise.all([
        add('09', '09'),
        ...STUDENTS.map((email, index) => errorCode(book(email, 9, 12 + index))),
      ]);
      const lessons = await db.select().from(bookings);

      expect(lessons).toHaveLength(booked.filter((code) => code === undefined).length);
      expect(answer.saved).toBe(lessons.length === 0);
    }
  });

  it('can be removed, which offers its days again', async () => {
    const before = await offeredDays();
    const answer = await add('09', '10');
    const [timeOff] = await service.list(CHIEF);
    expect(answer).toEqual({saved: true, timeOff});

    await service.remove(timeOff!.id);
    expect(await offeredDays()).toEqual(before);
    expect(await errorCode(service.remove(timeOff!.id))).toBe('not-found');
  });

  it('cannot overlap, or start in the past, and is listed until it ends', async () => {
    await add('09', '10');

    expect(await errorCode(add('10', '12'))).toBe('time-off-overlap');
    expect(await errorCode(add('11', '12'))).toBeUndefined();
    expect(await errorCode(add('07', '20'))).toBe('invalid-request');
    const later = new TimeOffService(
      new PostgresTimeOffRepository(db),
      catalog,
      () => new Date('2026-06-11T10:00:00Z'),
    );
    expect(await later.list(CHIEF)).toMatchObject([{startsOn: '2026-06-11'}]);
  });

  it('keeps the catalog seed from removing it', async () => {
    await add('09', '10');
    await seedCatalog(db);

    expect(await service.list(CHIEF)).toHaveLength(1);
  });
});

describe('time off constraints', () => {
  const row = {instructorSlug: CHIEF, startsOn: '2026-06-09', endsOn: '2026-06-10'};

  it('reject an overlap, and days in the wrong order', async () => {
    await db.insert(instructorTimeOff).values(row);

    expect(await constraint(db.insert(instructorTimeOff).values({...row, startsOn: '2026-06-10'}))).toBe(
      'instructor_time_off_free',
    );
    expect(await constraint(db.insert(instructorTimeOff).values({...row, endsOn: '2026-06-01'}))).toBe(
      'instructor_time_off_order',
    );
    expect(await constraint(db.insert(instructorTimeOff).values({...row, instructorSlug: 'arbiter'}))).toBeUndefined();
  });
});

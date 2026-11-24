import type {SkillResult, SkillResults} from '@hde/shared';

import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vite-plus/test';
import {eq} from 'drizzle-orm';
import {connect} from '#src/db/client.ts';
import {CURRICULUM} from '#src/db/curriculumData.ts';
import {AVAILABILITY} from '#src/db/availabilityData.ts';
import {INSTRUCTORS, VEHICLES} from '#src/db/catalogData.ts';
import {bookings, skillResults} from '#src/db/schema.ts';
import {seedCatalog} from '#src/db/seed.ts';
import {LessonService} from '#src/lessons/lessonService.ts';
import {PostgresAllowlistRepository} from '#src/repositories/allowlistRepository.ts';
import {PostgresCatalogRepository} from '#src/repositories/catalogRepository.ts';
import {PostgresLessonRepository} from '#src/repositories/lessonRepository.ts';
import {TEST_DATABASE_URL} from './database.ts';

const {db, close} = connect(TEST_DATABASE_URL, 5);
const catalog = new PostgresCatalogRepository(db);
const STUDENT = 'student@example.com';
const OTHER = 'other@example.com';
const ADMIN = 'admin@example.com';
const NOW = new Date('2026-06-10T12:00:00Z');
const service = new LessonService(new PostgresLessonRepository(db), catalog, () => NOW);

const at = (day: number, hour = 12) => new Date(Date.UTC(2026, 5, day, hour));

/** Books a one-hour lesson and returns its id. */
async function book(startsAt: Date, vehicleSlug = 'mongoose', studentEmail = STUDENT): Promise<string> {
  const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
  const [row] = await db
    .insert(bookings)
    .values({studentEmail, instructorSlug: 'master-chief', vehicleSlug, faction: 'unsc', startsAt, endsAt})
    .returning();

  return row!.id;
}

/** The same result for every skill in a lesson, apart from `except`. */
function marks(number: number, result: SkillResult, except: SkillResults = {}, vehicleSlug = 'mongoose'): SkillResults {
  const lesson = CURRICULUM.find((item) => item.vehicleSlug === vehicleSlug && item.number === number);

  return {...Object.fromEntries(lesson!.skills.map(({id}) => [id, result])), ...except};
}

const signOff = (id: string, results: SkillResults) =>
  service.signOff(id, {results, attendance: 'attended', early: false}, ADMIN);

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
  await allowlist.allow(STUDENT, 'student');
  await allowlist.allow(OTHER, 'student');
});

beforeEach(async () => {
  await db.delete(bookings);
});

afterAll(async () => {
  await close();
});

describe('lesson forms', () => {
  it('completes a lesson when every skill is passed, then opens the next one', async () => {
    const [first, second] = [await book(at(8)), await book(at(9))];
    expect((await service.form(first)).lesson).toMatchObject({number: 1, title: 'Startup and controls'});

    expect(await signOff(first, marks(1, 'pass'))).toMatchObject({status: 'completed', lessonNumber: 1});
    expect((await service.form(second)).lesson.number).toBe(2);
    expect(await signOff(second, marks(2, 'pass'))).toMatchObject({status: 'completed', lessonNumber: 2});
  });

  it('repeats a lesson with a failed skill, keeping the passed ones', async () => {
    const [first, second] = [await book(at(8)), await book(at(9))];
    expect(await signOff(first, marks(1, 'pass', {parkingBrake: 'fail'}))).toMatchObject({status: 'repeat'});

    const form = await service.form(second);
    expect(form.lesson.number).toBe(1);
    expect(form.passedBefore).toEqual(['walkaround', 'startEngine', 'readGauges', 'throttleAndStop']);
    expect(await signOff(second, {parkingBrake: 'pass', walkaround: 'fail'})).toMatchObject({status: 'completed'});
    expect((await service.form(second)).results).toEqual(marks(1, 'pass'));
  });

  it('saves marks from when a lesson starts, but signs off only once it ends', async () => {
    const id = await book(at(10));
    const during = new LessonService(new PostgresLessonRepository(db), catalog, () => at(10, 12.5));
    const before = new LessonService(new PostgresLessonRepository(db), catalog, () => at(10, 11));

    expect(await errorCode(before.mark(id, 'startEngine', {result: 'pass', early: false}))).toBe('too-early');
    await during.mark(id, 'startEngine', {result: 'fail', early: false});
    await during.mark(id, 'startEngine', {result: 'pass', early: false});
    expect((await service.form(id)).results).toEqual({startEngine: 'pass'});
    await during.mark(id, 'startEngine', {result: null, early: false});
    expect((await service.form(id)).results).toEqual({});
    expect(await errorCode(during.mark(id, 'winch', {result: null, early: false}))).toBe('invalid-request');
    expect(
      await errorCode(during.signOff(id, {results: marks(1, 'pass'), attendance: 'attended', early: false}, ADMIN)),
    ).toBe('too-early');
  });

  it('can be marked and signed off early, when asked to', async () => {
    const id = await book(at(20));
    expect(await errorCode(service.mark(id, 'startEngine', {result: 'pass', early: false}))).toBe('too-early');
    await service.mark(id, 'startEngine', {result: 'pass', early: true});
    expect((await service.form(id)).results).toEqual({startEngine: 'pass'});

    expect(await errorCode(signOff(id, marks(1, 'pass')))).toBe('too-early');
    const signedOff = service.signOff(id, {results: marks(1, 'pass'), attendance: 'attended', early: true}, ADMIN);
    expect(await signedOff).toMatchObject({status: 'completed'});
  });

  it('keeps every mark when skills are marked at the same time', async () => {
    const id = await book(at(8));
    const expected = marks(1, 'pass');
    await Promise.all(
      Object.keys(expected).map((skillId) => service.mark(id, skillId, {result: 'pass', early: false})),
    );

    expect((await service.form(id)).results).toEqual(expected);
  });

  it('shows the name the student signed in with', async () => {
    const id = await book(at(8), 'mongoose', OTHER);
    expect(await service.find(id)).toMatchObject({studentEmail: OTHER, studentName: null});

    const allowlist = new PostgresAllowlistRepository(db);
    await allowlist.rememberName(OTHER, 'Sam Other');
    await allowlist.allow(OTHER, 'student');
    expect(await service.find(id)).toMatchObject({studentName: 'Sam Other'});
    expect(await service.list(null)).toMatchObject([{studentName: 'Sam Other'}]);
  });

  it('needs every skill marked, and only skills in the lesson', async () => {
    const id = await book(at(8));

    expect(await errorCode(signOff(id, {startEngine: 'pass'}))).toBe('invalid-request');
    expect(await errorCode(signOff(id, marks(1, 'pass', {winch: 'pass'})))).toBe('invalid-request');
  });

  it('records a missed lesson, which does not count', async () => {
    const id = await book(at(8));
    const missed = await service.signOff(
      id,
      {results: {startEngine: 'pass'}, attendance: 'missed', early: false},
      ADMIN,
    );

    expect(missed).toMatchObject({status: 'missed', lessonNumber: null});
    expect((await service.form(id)).results).toEqual({});
  });

  it('signs a course off in order', async () => {
    const [first, second] = [await book(at(8)), await book(at(9))];
    expect(await errorCode(signOff(second, marks(1, 'pass')))).toBe('sign-off-conflict');

    await signOff(first, marks(1, 'pass'));
    await signOff(second, marks(2, 'pass'));
    expect(await errorCode(signOff(first, marks(1, 'fail')))).toBe('sign-off-conflict');
  });

  it('corrects the latest sign-off', async () => {
    const id = await book(at(8));
    await signOff(id, marks(1, 'fail'));

    expect(await signOff(id, marks(1, 'pass'))).toMatchObject({status: 'completed'});
    expect(await errorCode(service.mark(id, 'startEngine', {result: 'fail', early: false}))).toBe('sign-off-conflict');
  });

  it('refuses a correction that would lock a course the student has lessons in', async () => {
    const [first, second] = [await book(at(8)), await book(at(9))];
    await signOff(first, marks(1, 'pass'));
    await signOff(second, marks(2, 'pass'));
    await book(at(12), 'warthog');

    expect(await errorCode(signOff(second, marks(2, 'fail')))).toBe('sign-off-conflict');
  });

  it('refuses a correction that would leave the student with too many lessons', async () => {
    const [first, second] = [await book(at(8)), await book(at(9))];
    await signOff(first, marks(1, 'pass'));
    await signOff(second, marks(2, 'fail'));
    await book(at(12));

    expect(await errorCode(signOff(second, marks(2, 'pass')))).toBe('sign-off-conflict');
  });

  it('shows students only their own forms, once signed off', async () => {
    const id = await book(at(8));
    expect(await errorCode(service.studentForm(STUDENT, id))).toBe('not-found');

    await signOff(id, marks(1, 'pass'));
    expect((await service.studentForm(STUDENT, id)).results).toEqual(marks(1, 'pass'));
    expect(await errorCode(service.studentForm(OTHER, id))).toBe('not-found');
  });

  it("lists everyone's lessons or one instructor's, without cancelled ones", async () => {
    await book(at(8));
    const cancelled = await book(at(9));
    await db.update(bookings).set({status: 'cancelled'}).where(eq(bookings.id, cancelled));

    expect(await service.list(null)).toHaveLength(1);
    expect(await service.list('master-chief')).toMatchObject([{studentEmail: STUDENT}]);
    expect(await service.list('arbiter')).toEqual([]);
  });
});

describe('lesson constraints', () => {
  it('rejects a completed lesson without its number or signature', async () => {
    const id = await book(at(8));
    const update = (set: object) => constraint(db.update(bookings).set(set).where(eq(bookings.id, id)));
    const signature = {signedOffBy: ADMIN, signedOffAt: NOW};

    expect(await update({status: 'completed', ...signature})).toBe('bookings_lesson_number');
    expect(await update({status: 'completed', lessonNumber: 1})).toBe('bookings_signed_off');
    expect(await update({status: 'completed', lessonNumber: 9, ...signature})).toBe('bookings_lesson_fkey');
  });

  it("rejects results for another vehicle's lesson or an unknown skill", async () => {
    const bookingId = await book(at(8));
    const row = {bookingId, vehicleSlug: 'mongoose', lessonNumber: 1, skillId: 'startEngine', result: 'pass' as const};

    expect(await constraint(db.insert(skillResults).values({...row, vehicleSlug: 'warthog'}))).toBe(
      'skill_results_booking_fkey',
    );
    expect(await constraint(db.insert(skillResults).values({...row, skillId: 'fly'}))).toBe('skill_results_skill_fkey');
  });
});

describe('curriculum', () => {
  it('lists every seeded lesson with its skills in order', async () => {
    const lessons = await catalog.listCurriculum();

    expect(lessons).toHaveLength(CURRICULUM.length);
    expect(lessons).toEqual(expect.arrayContaining(CURRICULUM));
  });

  it('drops a removed skill without losing its past results', async () => {
    const id = await book(at(8));
    await signOff(id, marks(1, 'pass'));
    const curriculum = CURRICULUM.map((lesson) => ({
      ...lesson,
      skills: lesson.skills.filter((skill) => skill.id !== 'parkingBrake'),
    }));

    try {
      await seedCatalog(db, {vehicles: VEHICLES, instructors: INSTRUCTORS, availability: AVAILABILITY, curriculum});
      expect((await service.form(id)).lesson.skills.map((skill) => skill.id)).not.toContain('parkingBrake');
      expect(await db.select().from(skillResults).where(eq(skillResults.skillId, 'parkingBrake'))).toHaveLength(1);
    } finally {
      await seedCatalog(db);
    }
  });
});

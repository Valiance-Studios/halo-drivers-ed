import type {LessonNotes, LessonSignOff, Me, NotesRequest, SkillMark, SkillResults} from '@hde/shared';
import type {SignedInEnv} from '#src/http/signedIn.ts';
import type {LessonService} from '#src/lessons/lessonService.ts';

import {Hono} from 'hono';
import {ATTENDANCES, NOTE_MAX_LENGTH, SKILL_RESULTS} from '@hde/shared';
import {ApiError} from '#src/http/errors.ts';
import {lessonId} from '#src/http/lessonId.ts';
import {parseReason} from '#src/http/reason.ts';
import {requireAdmin, requireGuest} from '#src/http/signedIn.ts';

function isSkillResults(value: unknown): value is SkillResults {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((result) => SKILL_RESULTS.some((known) => known === result))
  );
}

/** Check requests' JSON bodies, which could hold anything. */
function parseSkillMark(body: unknown): SkillMark {
  const {result, early = false} = (body ?? {}) as Record<string, unknown>;
  const known = SKILL_RESULTS.find((value) => value === result) ?? null;

  if (known !== result || typeof early !== 'boolean') {
    throw new ApiError(400, 'invalid-request', 'Send pass, fail or null, and whether it is early.');
  }

  return {result: known, early};
}

function isNote(value: unknown): value is string {
  // Postgres text cannot hold a null character.
  return typeof value === 'string' && value.length <= NOTE_MAX_LENGTH && !value.includes('\0');
}

function parseNotes(value: unknown): LessonNotes {
  const {student, private: privateNote} = (value ?? {}) as Record<string, unknown>;

  if (!isNote(student) || !isNote(privateNote)) {
    throw new ApiError(400, 'invalid-request', `Send both notes, each up to ${NOTE_MAX_LENGTH} characters.`);
  }

  return {student, private: privateNote};
}

function parseNotesRequest(body: unknown): NotesRequest {
  const {notes, early = false} = (body ?? {}) as Record<string, unknown>;

  if (typeof early !== 'boolean') {
    throw new ApiError(400, 'invalid-request', 'Send the notes, and whether they are early.');
  }

  return {notes: parseNotes(notes), early};
}

function parseSignOff(body: unknown): LessonSignOff {
  const {results, notes, attendance, early = false} = (body ?? {}) as Record<string, unknown>;
  const known = ATTENDANCES.find((value) => value === attendance);

  if (!isSkillResults(results) || !known || typeof early !== 'boolean') {
    throw new ApiError(400, 'invalid-request', 'Send the skill results and how the lesson ended.');
  }

  return {results, notes: parseNotes(notes), attendance: known, early};
}

/** The signed-in student's own results. */
export function lessonRoutes(service: LessonService): Hono<SignedInEnv> {
  return new Hono<SignedInEnv>()
    .get('/results', async (c) => c.json(await service.studentResults(c.var.me.email)))
    .get('/bookings/:id/form', async (c) =>
      c.json(await service.studentForm(c.var.me.email, lessonId(c.req.param('id')))),
    );
}

/** Every student's lessons, for admins. */
export function adminLessonRoutes(service: LessonService): Hono<SignedInEnv> {
  return new Hono<SignedInEnv>().use(requireAdmin).route(
    '/',
    signOffRoutes(service, () => null),
  );
}

/** A demo guest's own lessons, as an instructor sees them. */
export function guestLessonRoutes(service: LessonService): Hono<SignedInEnv> {
  return new Hono<SignedInEnv>().use(requireGuest).route(
    '/',
    signOffRoutes(service, ({email}) => email),
  );
}

/**
 * Lessons to mark and sign off: all of them, or one instructor's (`?instructor=`). `studentFor` names the only
 * student whose lessons the account may use, or null if it may use everyone's.
 */
function signOffRoutes(service: LessonService, studentFor: (me: Me) => string | null): Hono<SignedInEnv> {
  return new Hono<SignedInEnv>()
    .get('/lessons', async (c) => c.json(await service.list(c.req.query('instructor') ?? null, studentFor(c.var.me))))
    .get('/lessons/:id', async (c) => c.json(await service.find(lessonId(c.req.param('id')), studentFor(c.var.me))))
    .get('/lessons/:id/form', async (c) =>
      c.json(await service.form(lessonId(c.req.param('id')), studentFor(c.var.me))),
    )
    .put('/lessons/:id/results/:skillId', async (c) => {
      const mark = parseSkillMark(await c.req.json().catch(() => null));
      await service.mark(lessonId(c.req.param('id')), c.req.param('skillId'), mark, studentFor(c.var.me));

      return c.json(mark);
    })
    .put('/lessons/:id/notes', async (c) => {
      const request = parseNotesRequest(await c.req.json().catch(() => null));
      await service.saveNotes(lessonId(c.req.param('id')), request, studentFor(c.var.me));

      return c.json(request.notes);
    })
    .put('/lessons/:id/cancel', async (c) => {
      const body = (await c.req.json().catch(() => null)) as {reason?: unknown} | null;
      const reason = parseReason(body?.reason);

      return c.json(await service.cancel(lessonId(c.req.param('id')), reason, studentFor(c.var.me)));
    })
    .put('/lessons/:id/sign-off', async (c) => {
      const signOff = parseSignOff(await c.req.json().catch(() => null));
      const {me} = c.var;

      return c.json(await service.signOff(lessonId(c.req.param('id')), signOff, me.email, studentFor(me)));
    });
}

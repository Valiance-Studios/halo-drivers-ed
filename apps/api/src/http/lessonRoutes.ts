import type {LessonSignOff, SkillMark, SkillResults} from '@hde/shared';
import type {SignedInEnv} from '#src/http/signedIn.ts';
import type {LessonService} from '#src/lessons/lessonService.ts';

import {Hono} from 'hono';
import {ATTENDANCES, SKILL_RESULTS} from '@hde/shared';
import {ApiError} from '#src/http/errors.ts';
import {lessonId} from '#src/http/lessonId.ts';
import {requireAdmin} from '#src/http/signedIn.ts';

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

function parseSignOff(body: unknown): LessonSignOff {
  const {results, attendance, early = false} = (body ?? {}) as Record<string, unknown>;
  const known = ATTENDANCES.find((value) => value === attendance);

  if (!isSkillResults(results) || !known || typeof early !== 'boolean') {
    throw new ApiError(400, 'invalid-request', 'Send the skill results and how the lesson ended.');
  }

  return {results, attendance: known, early};
}

/** The signed-in student's own results. */
export function lessonRoutes(service: LessonService): Hono<SignedInEnv> {
  return new Hono<SignedInEnv>().get('/bookings/:id/form', async (c) =>
    c.json(await service.studentForm(c.var.me.email, lessonId(c.req.param('id')))),
  );
}

/** Every student's lessons, for admins: all of them, or one instructor's (`?instructor=`). */
export function adminLessonRoutes(service: LessonService): Hono<SignedInEnv> {
  return new Hono<SignedInEnv>()
    .use(requireAdmin)
    .get('/lessons', async (c) => c.json(await service.list(c.req.query('instructor') ?? null)))
    .get('/lessons/:id', async (c) => c.json(await service.find(lessonId(c.req.param('id')))))
    .get('/lessons/:id/form', async (c) => c.json(await service.form(lessonId(c.req.param('id')))))
    .put('/lessons/:id/results/:skillId', async (c) => {
      const mark = parseSkillMark(await c.req.json().catch(() => null));
      await service.mark(lessonId(c.req.param('id')), c.req.param('skillId'), mark);

      return c.json(mark);
    })
    .put('/lessons/:id/sign-off', async (c) => {
      const signOff = parseSignOff(await c.req.json().catch(() => null));

      return c.json(await service.signOff(lessonId(c.req.param('id')), signOff, c.var.me.email));
    });
}

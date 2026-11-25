import type {TimeOffRequest} from '@hde/shared';
import type {SignedInEnv} from '#src/http/signedIn.ts';
import type {TimeOffService} from '#src/timeOff/timeOffService.ts';

import {Hono} from 'hono';
import {ApiError} from '#src/http/errors.ts';
import {isUuid} from '#src/http/lessonId.ts';
import {parseReason} from '#src/http/reason.ts';
import {requireAdmin} from '#src/http/signedIn.ts';
import {isDate} from '#src/timeOff/schoolDays.ts';

/** Checks a request's JSON body, which could hold anything. */
function parseTimeOff(body: unknown): TimeOffRequest {
  const {startsOn, endsOn, cancel = null} = (body ?? {}) as Record<string, unknown>;

  if (!isDate(startsOn) || !isDate(endsOn)) {
    throw new ApiError(400, 'invalid-request', 'Send the first and last days.');
  }

  if (cancel === null) {
    return {startsOn, endsOn, cancel};
  }

  const {lessonIds, reason} = cancel as Record<string, unknown>;

  if (!Array.isArray(lessonIds) || !lessonIds.every(isUuid)) {
    throw new ApiError(400, 'invalid-request', 'Send the lessons to cancel.');
  }

  return {startsOn, endsOn, cancel: {lessonIds, reason: parseReason(reason)}};
}

/** Instructors' time off, for admins. */
export function timeOffRoutes(service: TimeOffService): Hono<SignedInEnv> {
  return new Hono<SignedInEnv>()
    .use(requireAdmin)
    .get('/instructors/:slug/time-off', async (c) => c.json(await service.list(c.req.param('slug'))))
    .post('/instructors/:slug/time-off', async (c) => {
      const request = parseTimeOff(await c.req.json().catch(() => null));

      return c.json(await service.add(c.req.param('slug'), request));
    })
    .delete('/time-off/:id', async (c) => {
      const id = c.req.param('id');

      if (!isUuid(id)) {
        throw new ApiError(404, 'not-found', 'No such time off.');
      }

      await service.remove(id);

      return c.json({});
    });
}

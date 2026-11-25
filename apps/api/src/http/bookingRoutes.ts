import type {BookingRequest} from '@hde/shared';
import type {BookingService} from '#src/bookings/bookingService.ts';
import type {SignedInEnv} from '#src/http/signedIn.ts';

import {Hono} from 'hono';
import {DEMO_BOOKING_LIMIT} from '@hde/shared';
import {DEMO_LESSONS} from '#src/demo/demoHistory.ts';
import {ApiError} from '#src/http/errors.ts';
import {lessonId} from '#src/http/lessonId.ts';

/** A guest's lessons include the ones they start with. */
const GUEST_LESSON_LIMIT = DEMO_LESSONS.length + DEMO_BOOKING_LIMIT;

/** Checks a request's JSON body, which could hold anything. */
function parseBookingRequest(body: unknown): BookingRequest {
  const {vehicleSlug, instructorSlug, startsAt} = (body ?? {}) as Record<string, unknown>;

  if (
    typeof vehicleSlug !== 'string' ||
    typeof instructorSlug !== 'string' ||
    typeof startsAt !== 'string' ||
    Number.isNaN(Date.parse(startsAt))
  ) {
    throw new ApiError(400, 'invalid-request', 'Send a vehicle, an instructor and a start time.');
  }

  return {vehicleSlug, instructorSlug, startsAt};
}

/** The signed-in student's lessons, and the times they can book. */
export function bookingRoutes(service: BookingService): Hono<SignedInEnv> {
  return new Hono<SignedInEnv>()
    .get('/slots', async (c) => {
      const {vehicle = '', instructor = ''} = c.req.query();

      return c.json(await service.slots(c.var.me.email, vehicle, instructor));
    })
    .get('/bookings', async (c) => c.json(await service.list(c.var.me.email)))
    .post('/bookings', async (c) => {
      const request = parseBookingRequest(await c.req.json().catch(() => null));

      const {email, role} = c.var.me;

      return c.json(await service.book(email, request, role === 'guest' ? GUEST_LESSON_LIMIT : null), 201);
    })
    .post('/bookings/:id/cancel', async (c) => {
      return c.json(await service.cancel(c.var.me.email, lessonId(c.req.param('id'))));
    });
}

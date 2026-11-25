import type {Config} from '#src/config.ts';
import type {TokenVerifier} from '#src/auth/tokenVerifier.ts';
import type {BookingService} from '#src/bookings/bookingService.ts';
import type {RateLimits} from '#src/http/rateLimits.ts';
import type {SignedInEnv} from '#src/http/signedIn.ts';
import type {LessonService} from '#src/lessons/lessonService.ts';
import type {AllowlistRepository} from '#src/repositories/allowlistRepository.ts';
import type {CatalogRepository} from '#src/repositories/catalogRepository.ts';
import type {DemoRepository} from '#src/repositories/demoRepository.ts';

import {Hono} from 'hono';
import {bodyLimit} from 'hono/body-limit';
import {createMiddleware} from 'hono/factory';
import {APP_CHECK_HEADER} from '@hde/shared';
import {bookingRoutes} from '#src/http/bookingRoutes.ts';
import {clearExpiredDemos, demoRoutes} from '#src/http/demoRoutes.ts';
import {adminLessonRoutes, guestLessonRoutes, lessonRoutes} from '#src/http/lessonRoutes.ts';
import {ApiError} from '#src/http/errors.ts';
import {DEFAULT_RATE_LIMITS, rateLimit} from '#src/http/rateLimits.ts';

export interface AppDependencies {
  appCheck: Config['appCheck'];
  verifier: TokenVerifier;
  allowlist: AllowlistRepository;
  catalog: CatalogRepository;
  demo: DemoRepository;
  bookings: BookingService;
  lessons: LessonService;
  rateLimits?: RateLimits;
}

const BEARER_PREFIX = 'Bearer ';
/** Every body is small JSON; the largest is a sign-off's results. */
const MAX_BODY_BYTES = 16 * 1024;

/**
 * The HTTP API. Every route under /api except the health check needs a valid App Check token (unless
 * turned off for the emulators), a Firebase ID token, and an account on the allowlist or a demo session. Requests are limited in size
 * and, per account, in number.
 */
export function createApp({
  appCheck,
  verifier,
  allowlist,
  catalog,
  demo,
  bookings,
  lessons,
  rateLimits = DEFAULT_RATE_LIMITS,
}: AppDependencies): Hono {
  const limitBody = bodyLimit({
    maxSize: MAX_BODY_BYTES,
    onError: () => {
      throw new ApiError(413, 'request-too-large', 'This request is too large.');
    },
  });

  const requireIdentity = createMiddleware<SignedInEnv>(async (c, next) => {
    if (appCheck === 'required') {
      const appCheckToken = c.req.header(APP_CHECK_HEADER);

      try {
        await verifier.verifyAppCheckToken(appCheckToken ?? '');
      } catch {
        throw new ApiError(401, 'app-check-failed', 'This request did not come from the Halo Drivers Ed app.');
      }
    }

    const authorization = c.req.header('Authorization') ?? '';

    if (!authorization.startsWith(BEARER_PREFIX)) {
      throw new ApiError(401, 'unauthenticated', 'Sign in first.');
    }

    try {
      c.set('identity', await verifier.verifyIdToken(authorization.slice(BEARER_PREFIX.length)));
    } catch {
      throw new ApiError(401, 'unauthenticated', 'Your sign-in has expired or is invalid. Sign in again.');
    }

    await next();
  });

  const requireAllowed = createMiddleware<SignedInEnv>(async (c, next) => {
    const {uid, email, isAnonymous} = c.var.identity;

    if (isAnonymous) {
      const guest = await demo.findGuest(uid, new Date());

      if (!guest) {
        throw new ApiError(403, 'demo-ended', 'Your demo has ended. Start another from the login page.');
      }

      c.set('me', guest);
      await next();

      return;
    }

    const role = email ? await allowlist.findRole(email) : null;

    if (!email || !role) {
      throw new ApiError(403, 'not-allowed', 'This account is not authorized to use this app.');
    }

    c.set('me', {email: email.toLowerCase(), role, demoEndsAt: null});
    await next();
  });

  const signedIn = new Hono<SignedInEnv>()
    .use(requireIdentity)
    .use(rateLimit(rateLimits))
    .route('/', demoRoutes(demo))
    .use(requireAllowed)
    .on('GET', ['/slots', '/admin/lessons'], clearExpiredDemos(demo))
    .on('POST', '/bookings', clearExpiredDemos(demo))
    .get('/me', async (c) => {
      const {me, identity} = c.var;

      if (identity.displayName) {
        await allowlist.rememberName(me.email, identity.displayName);
      }

      return c.json(me);
    })
    .get('/vehicles', async (c) => c.json(await catalog.listVehicles()))
    .get('/instructors', async (c) => c.json(await catalog.listInstructors()))
    .get('/curriculum', async (c) => c.json(await catalog.listCurriculum()))
    .route('/', bookingRoutes(bookings))
    .route('/', lessonRoutes(lessons))
    .route('/admin', adminLessonRoutes(lessons))
    .route('/demo', guestLessonRoutes(lessons));

  const app = new Hono();

  app.use('/api/*', limitBody);
  app.get('/api/health', (c) => c.json({status: 'ok'}));
  app.route('/api', signedIn);

  app.notFound(() => {
    throw new ApiError(404, 'not-found', 'No such endpoint.');
  });

  app.onError((error, c) => {
    if (error instanceof ApiError) {
      return c.json(error.toBody(), error.status);
    }

    console.error(error);

    return c.json(new ApiError(500, 'internal', 'Something went wrong.').toBody(), 500);
  });

  return app;
}

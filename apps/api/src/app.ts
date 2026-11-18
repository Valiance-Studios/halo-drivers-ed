import type {Me} from '@hde/shared';
import type {Config} from '#src/config.ts';
import type {TokenVerifier} from '#src/auth/tokenVerifier.ts';
import type {AllowlistRepository} from '#src/repositories/allowlistRepository.ts';
import type {CatalogRepository} from '#src/repositories/catalogRepository.ts';

import {Hono} from 'hono';
import {createMiddleware} from 'hono/factory';
import {APP_CHECK_HEADER} from '@hde/shared';
import {ApiError} from '#src/http/errors.ts';

export interface AppDependencies {
  appCheck: Config['appCheck'];
  verifier: TokenVerifier;
  allowlist: AllowlistRepository;
  catalog: CatalogRepository;
}

interface SignedInEnv {
  Variables: {me: Me};
}

const BEARER_PREFIX = 'Bearer ';

/**
 * The HTTP API. Every route under /api except the health check needs a valid App Check token (unless
 * turned off for the emulators), a Firebase ID token, and an account on the allowlist.
 */
export function createApp({appCheck, verifier, allowlist, catalog}: AppDependencies): Hono {
  const requireSignedIn = createMiddleware<SignedInEnv>(async (c, next) => {
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

    let email: string | null;

    try {
      ({email} = await verifier.verifyIdToken(authorization.slice(BEARER_PREFIX.length)));
    } catch {
      throw new ApiError(401, 'unauthenticated', 'Your sign-in has expired or is invalid. Sign in again.');
    }

    const role = email ? await allowlist.findRole(email) : null;

    if (!email || !role) {
      throw new ApiError(403, 'not-allowed', 'This account is not authorized to use this app.');
    }

    c.set('me', {email: email.toLowerCase(), role});
    await next();
  });

  const signedIn = new Hono<SignedInEnv>()
    .use(requireSignedIn)
    .get('/me', (c) => c.json(c.var.me))
    .get('/vehicles', async (c) => c.json(await catalog.listVehicles()))
    .get('/instructors', async (c) => c.json(await catalog.listInstructors()));

  const app = new Hono();

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

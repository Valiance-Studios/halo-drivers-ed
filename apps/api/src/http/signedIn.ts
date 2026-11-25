import type {Me} from '@hde/shared';
import type {VerifiedUser} from '#src/auth/tokenVerifier.ts';

import {createMiddleware} from 'hono/factory';
import {ApiError} from '#src/http/errors.ts';

/** What `requireIdentity` (the identity) and `requireAllowed` (the rest) give the routes behind them. */
export interface SignedInEnv {
  Variables: {identity: VerifiedUser; me: Me};
}

/** For guests' own version of the admins' routes; goes after `requireAllowed`. */
export const requireGuest = createMiddleware<SignedInEnv>(async (c, next) => {
  if (c.var.me.role !== 'guest') {
    throw new ApiError(403, 'not-allowed', 'Only demo visitors can do this.');
  }

  await next();
});

/** For routes only admins may use; goes after `requireAllowed`. */
export const requireAdmin = createMiddleware<SignedInEnv>(async (c, next) => {
  if (c.var.me.role !== 'admin') {
    throw new ApiError(403, 'not-admin', 'Only admins can do this.');
  }

  await next();
});

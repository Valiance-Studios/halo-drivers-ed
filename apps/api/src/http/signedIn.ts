import type {Me} from '@hde/shared';

import {createMiddleware} from 'hono/factory';
import {ApiError} from '#src/http/errors.ts';

/** What `requireSignedIn` gives the routes behind it. */
export interface SignedInEnv {
  Variables: {me: Me; displayName: string | null};
}

/** For routes only admins may use; goes after `requireSignedIn`. */
export const requireAdmin = createMiddleware<SignedInEnv>(async (c, next) => {
  if (c.var.me.role !== 'admin') {
    throw new ApiError(403, 'not-admin', 'Only admins can do this.');
  }

  await next();
});

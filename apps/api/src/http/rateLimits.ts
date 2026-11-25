import type {RateLimit} from '#src/http/rateLimiter.ts';
import type {SignedInEnv} from '#src/http/signedIn.ts';

import {createMiddleware} from 'hono/factory';
import {ApiError} from '#src/http/errors.ts';
import {RateLimiter} from '#src/http/rateLimiter.ts';

export interface RateLimits {
  /** Every request, reads and writes. */
  requests: RateLimit;
  writes: RateLimit;
}

const MINUTE_MS = 60_000;

/** Well above ordinary use: an instructor's form saves each skill's mark as it is made. */
export const DEFAULT_RATE_LIMITS: RateLimits = {
  requests: {max: 240, windowMs: MINUTE_MS},
  writes: {max: 60, windowMs: MINUTE_MS},
};

const READ_METHODS = ['GET', 'HEAD'];

/**
 * Limits each account's requests. Goes after `requireIdentity`, and before the allowlist is read, so accounts
 * that are not allowed cannot load the database either.
 */
export function rateLimit(limits: RateLimits) {
  const requests = new RateLimiter(limits.requests);
  const writes = new RateLimiter(limits.writes);

  return createMiddleware<SignedInEnv>(async (c, next) => {
    const {uid} = c.var.identity;
    const isWrite = !READ_METHODS.includes(c.req.method);
    const waitSeconds = requests.hit(uid) ?? (isWrite ? writes.hit(uid) : null);

    if (waitSeconds !== null) {
      c.header('Retry-After', String(waitSeconds));
      throw new ApiError(429, 'rate-limited', 'Too many requests. Wait a minute, then try again.');
    }

    await next();
  });
}

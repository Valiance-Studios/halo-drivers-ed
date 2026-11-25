import type {SignedInEnv} from '#src/http/signedIn.ts';
import type {DemoRepository} from '#src/repositories/demoRepository.ts';

import {Hono} from 'hono';
import {createMiddleware} from 'hono/factory';
import {ApiError} from '#src/http/errors.ts';

const requireAnonymous = createMiddleware<SignedInEnv>(async (c, next) => {
  if (!c.var.identity.isAnonymous) {
    throw new ApiError(403, 'not-allowed', 'Only demo visitors can do this.');
  }

  await next();
});

/**
 * For routes that expired guests' lessons would affect, by taking up times or cluttering the schedule. This
 * stands in for a scheduled job.
 */
export function clearExpiredDemos(demo: DemoRepository) {
  return createMiddleware(async (_, next) => {
    await demo.clearExpired(new Date());
    await next();
  });
}

/** Starting and ending a demo. Anonymous accounts use these before they are allowed anything else. */
export function demoRoutes(demo: DemoRepository): Hono<SignedInEnv> {
  return new Hono<SignedInEnv>()
    .post('/demo-sessions', requireAnonymous, async (c) => {
      const now = new Date();
      const session = await demo.claim(c.var.identity.uid, now);

      // Afterwards, since a claim skips slots that are being cleared.
      await demo.clearExpired(now);

      return c.json(session);
    })
    .delete('/demo-sessions', requireAnonymous, async (c) => {
      await demo.release(c.var.identity.uid);

      return c.json({});
    });
}

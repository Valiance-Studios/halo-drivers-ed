import {describe, expect, it} from 'vite-plus/test';
import {RateLimiter} from '#src/http/rateLimiter.ts';

describe('RateLimiter', () => {
  it('counts each key on its own, says how long to wait, and starts again after the window', () => {
    let now = 1000;
    const limiter = new RateLimiter({max: 2, windowMs: 60_000}, () => now);

    expect([limiter.hit('a'), limiter.hit('a'), limiter.hit('a')]).toEqual([null, null, 60]);
    expect(limiter.hit('b')).toBeNull();

    now += 45_500;
    expect(limiter.hit('a')).toBe(15);

    now += 14_500;
    expect(limiter.hit('a')).toBeNull();
  });
});

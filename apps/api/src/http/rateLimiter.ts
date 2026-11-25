export interface RateLimit {
  max: number;
  windowMs: number;
}

/**
 * Counts each key's requests in fixed windows shared by every key, so starting a new window drops all the
 * counts and memory stays bounded. Held in memory, so each Cloud Run instance limits on its own.
 */
export class RateLimiter {
  private readonly limit: RateLimit;
  private readonly now: () => number;
  private readonly counts = new Map<string, number>();
  private windowEndsAt = 0;

  constructor(limit: RateLimit, now: () => number = Date.now) {
    this.limit = limit;
    this.now = now;
  }

  /** Counts a request. Returns the seconds to wait if it is over the limit, or null if it may go ahead. */
  hit(key: string): number | null {
    const now = this.now();

    if (now >= this.windowEndsAt) {
      this.counts.clear();
      this.windowEndsAt = now + this.limit.windowMs;
    }

    const count = this.counts.get(key) ?? 0;

    if (count >= this.limit.max) {
      return Math.ceil((this.windowEndsAt - now) / 1000);
    }

    this.counts.set(key, count + 1);

    return null;
  }
}

/** How many visitors can try the demo at once. Each has a row in `demo_slots`, so no race can exceed it. */
export const DEMO_SLOTS = 10;

export const DEMO_SESSION_MINUTES = 120;

/** How many lessons a guest may book, counting ones they cancel or sign off. Enough to complete a few courses. */
export const DEMO_BOOKING_LIMIT = 12;

/** Guests' made-up addresses end with this, as a database constraint makes sure. No real account's can. */
export const GUEST_EMAIL_DOMAIN = '@demo.invalid';

export function isGuestEmail(email: string): boolean {
  return email.endsWith(GUEST_EMAIL_DOMAIN);
}

/** The answer to `POST /api/demo-sessions`. Times are ISO 8601 in UTC. */
export type DemoSession = {claimed: true; endsAt: string} | {claimed: false; nextFreeAt: string | null};

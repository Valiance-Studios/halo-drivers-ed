/** What a signed-in account may do. Everyone can book lessons; admins also sign them off. */
export const ALLOWLIST_ROLES = ['admin', 'student'] as const;
export type AllowlistRole = (typeof ALLOWLIST_ROLES)[number];

/** Guests are demo visitors: students whose account and lessons are deleted after their session. */
export const ROLES = [...ALLOWLIST_ROLES, 'guest'] as const;
export type Role = (typeof ROLES)[number];

/** The signed-in account, as the API sees it (`GET /api/me`). */
export interface Me {
  email: string;
  role: Role;
  /** When a guest's demo ends (ISO 8601 in UTC); null for everyone else. */
  demoEndsAt: string | null;
}

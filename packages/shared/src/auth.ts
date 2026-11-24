/** What a signed-in account may do. Everyone can book lessons; admins also sign them off. */
export const ROLES = ['admin', 'student'] as const;
export type Role = (typeof ROLES)[number];

/** The signed-in account, as the API sees it (`GET /api/me`). */
export interface Me {
  email: string;
  role: Role;
}

/** What a signed-in account may do. Only admins exist for now; demo guests come with the demo slots. */
export const ROLES = ['admin'] as const;
export type Role = (typeof ROLES)[number];

/** The signed-in account, as the API sees it (`GET /api/me`). */
export interface Me {
  email: string;
  role: Role;
}

import type {AllowlistRole} from '@hde/shared';
import type {Database} from '#src/db/client.ts';

import {and, eq, ne, sql} from 'drizzle-orm';
import {ALLOWLIST_ROLES} from '@hde/shared';
import {allowedUsers} from '#src/db/schema.ts';

export interface AllowlistRepository {
  /** The account's role, or null if it may not sign in. Guests are never found by email. */
  findRole(email: string): Promise<AllowlistRole | null>;
  /** Remembers the account's name, for instructors to see. */
  rememberName(email: string, displayName: string): Promise<void>;
}

export class PostgresAllowlistRepository implements AllowlistRepository {
  private readonly db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  async findRole(email: string): Promise<AllowlistRole | null> {
    const [row] = await this.db
      .select({role: allowedUsers.role})
      .from(allowedUsers)
      .where(and(eq(allowedUsers.email, email.toLowerCase()), ne(allowedUsers.role, 'guest')));

    return ALLOWLIST_ROLES.find((role) => role === row?.role) ?? null;
  }

  async rememberName(email: string, displayName: string): Promise<void> {
    await this.db
      .update(allowedUsers)
      .set({displayName})
      .where(
        and(
          eq(allowedUsers.email, email.toLowerCase()),
          sql`${allowedUsers.displayName} is distinct from ${displayName}`,
        ),
      );
  }

  /** Adds the account, or changes its role. Used by `npm run db:allow` and the tests, not by the API. */
  async allow(email: string, role: AllowlistRole): Promise<void> {
    await this.db
      .insert(allowedUsers)
      .values({email: email.toLowerCase(), role})
      .onConflictDoUpdate({target: allowedUsers.email, set: {role}});
  }
}

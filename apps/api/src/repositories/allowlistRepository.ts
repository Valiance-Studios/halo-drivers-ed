import type {Role} from '@hde/shared';
import type {Database} from '#src/db/client.ts';

import {and, eq, sql} from 'drizzle-orm';
import {allowedUsers} from '#src/db/schema.ts';

export interface AllowlistRepository {
  /** The account's role, or null if it may not sign in. */
  findRole(email: string): Promise<Role | null>;
  /** Remembers the account's name, for instructors to see. */
  rememberName(email: string, displayName: string): Promise<void>;
}

export class PostgresAllowlistRepository implements AllowlistRepository {
  private readonly db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  async findRole(email: string): Promise<Role | null> {
    const [row] = await this.db
      .select({role: allowedUsers.role})
      .from(allowedUsers)
      .where(eq(allowedUsers.email, email.toLowerCase()));

    return row?.role ?? null;
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
  async allow(email: string, role: Role): Promise<void> {
    await this.db
      .insert(allowedUsers)
      .values({email: email.toLowerCase(), role})
      .onConflictDoUpdate({target: allowedUsers.email, set: {role}});
  }
}

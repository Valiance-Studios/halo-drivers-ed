import type {Role} from '@hde/shared';
import type {Database} from '#src/db/client.ts';

import {eq} from 'drizzle-orm';
import {allowedUsers} from '#src/db/schema.ts';

export interface AllowlistRepository {
  /** The account's role, or null if it may not sign in. */
  findRole(email: string): Promise<Role | null>;
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

  /** Adds the account, or changes its role. Used by `npm run db:allow` and the tests, not by the API. */
  async allow(email: string, role: Role): Promise<void> {
    await this.db
      .insert(allowedUsers)
      .values({email: email.toLowerCase(), role})
      .onConflictDoUpdate({target: allowedUsers.email, set: {role}});
  }
}

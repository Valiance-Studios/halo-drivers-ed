import type {SQL} from 'drizzle-orm';
import type {Database} from '#src/db/client.ts';

import {parseArgs} from 'node:util';
import {and, asc, eq, inArray, isNotNull, sql} from 'drizzle-orm';
import {allowedUsers, bookings, demoSlots, instructors, instructorTimeOff, skillResults} from '#src/db/schema.ts';

export type ClearTarget = {kind: 'all'} | {kind: 'student'; email: string} | {kind: 'instructor'; slug: string};

export interface ClearArgs {
  target: ClearTarget;
  /** The deployed database, rather than the local one. */
  deployed: boolean;
  /** Which database the caller says it is ("local" or "deployed"), to delete. Null only previews. */
  confirm: string | null;
}

/** How many rows of each kind are deleted, or would be. A lesson's notes are part of it. */
export interface ClearCounts {
  lessons: number;
  results: number;
  timeOff: number;
  demoSessions: number;
}

export const CLEAR_USAGE = `Usage:
  npm run db:clear -- all                  every lesson, result and note, all time off, and every demo session
  npm run db:clear -- student <email>      a student's lessons, results and notes
  npm run db:clear -- instructor <slug>    an instructor's time off, and lessons not signed off

Uses the local database, or the deployed one with --deployed. Only shows what would be deleted, unless you add
--confirm local or --confirm deployed, to match.`;

/** Null if the arguments are not understood. */
export function parseClearArgs(args: string[]): ClearArgs | null {
  let positionals: string[];
  let confirm: string | undefined;
  let deployed: boolean | undefined;

  try {
    ({
      positionals,
      values: {confirm, deployed},
    } = parseArgs({args, allowPositionals: true, options: {confirm: {type: 'string'}, deployed: {type: 'boolean'}}}));
  } catch {
    return null;
  }

  const target = parseTarget(positionals);

  return target && {target, deployed: deployed ?? false, confirm: confirm ?? null};
}

function parseTarget([kind, name, ...rest]: string[]): ClearTarget | null {
  if (rest.length > 0) {
    return null;
  }

  if (kind === 'all' && name === undefined) {
    return {kind};
  }

  if (kind === 'student' && name) {
    return {kind, email: name.toLowerCase()};
  }

  return kind === 'instructor' && name ? {kind, slug: name} : null;
}

type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

/** What to delete. A condition that is undefined deletes every row, and null deletes none. */
interface Scope {
  lessons: SQL | undefined;
  timeOff: SQL | undefined | null;
  demoSessions: boolean;
}

/** Counts what would be deleted, changing nothing. Throws if there is no such student or instructor. */
export async function previewClear(db: Database, target: ClearTarget): Promise<ClearCounts> {
  return db.transaction(
    async (tx) => {
      await checkExists(tx, target);

      return count(tx, scopeOf(target));
    },
    {accessMode: 'read only', isolationLevel: 'repeatable read'},
  );
}

/**
 * Deletes the target's data in one transaction, under the locks booking and sign-off take, so it is safe while the
 * API runs. The catalog, the curriculum and the allowlist stay.
 */
export async function clearData(db: Database, target: ClearTarget): Promise<ClearCounts> {
  return db.transaction(async (tx) => {
    await lock(tx, target);
    await checkExists(tx, target);
    const scope = scopeOf(target);
    const counts = await count(tx, scope);

    // Their results go with them.
    await tx.delete(bookings).where(scope.lessons);

    if (scope.timeOff !== null) {
      await tx.delete(instructorTimeOff).where(scope.timeOff);
    }

    if (scope.demoSessions) {
      await tx.update(demoSlots).set({uid: null, guestEmail: null, expiresAt: null});
      await tx.delete(allowedUsers).where(eq(allowedUsers.role, 'guest'));
    }

    return counts;
  });
}

function scopeOf(target: ClearTarget): Scope {
  switch (target.kind) {
    case 'all':
      return {lessons: undefined, timeOff: undefined, demoSessions: true};
    case 'student':
      return {lessons: eq(bookings.studentEmail, target.email), timeOff: null, demoSessions: false};
    case 'instructor':
      return {
        // Signed-off lessons stay: students' progress counts them.
        lessons: and(eq(bookings.instructorSlug, target.slug), inArray(bookings.status, ['booked', 'cancelled'])),
        timeOff: eq(instructorTimeOff.instructorSlug, target.slug),
        demoSessions: false,
      };
  }
}

/** Locks in the order the API does (demo slots, students, the instructor, lessons), so neither can deadlock. */
async function lock(tx: Transaction, target: ClearTarget): Promise<void> {
  switch (target.kind) {
    case 'all':
      for (const table of [demoSlots, allowedUsers, instructors, bookings, instructorTimeOff]) {
        await tx.execute(sql`lock table ${table} in exclusive mode`);
      }

      return;
    case 'student':
      await tx.select().from(allowedUsers).where(eq(allowedUsers.email, target.email)).for('update');

      return;
    case 'instructor':
      await tx.select().from(allowedUsers).orderBy(asc(allowedUsers.email)).for('update');
      await tx.select().from(instructors).where(eq(instructors.slug, target.slug)).for('update');
  }
}

async function checkExists(tx: Transaction, target: ClearTarget): Promise<void> {
  if (target.kind === 'student') {
    const {email} = target;

    if ((await tx.$count(allowedUsers, eq(allowedUsers.email, email))) === 0) {
      throw new Error(`No account is allowlisted as ${email}.`);
    }
  }

  if (target.kind === 'instructor') {
    const slugs = (await tx.select({slug: instructors.slug}).from(instructors).orderBy(asc(instructors.slug))).map(
      ({slug}) => slug,
    );

    if (!slugs.includes(target.slug)) {
      throw new Error(`No instructor is called ${target.slug}. The instructors are ${slugs.join(', ')}.`);
    }
  }
}

async function count(tx: Transaction, {lessons, timeOff, demoSessions}: Scope): Promise<ClearCounts> {
  const [results] = await tx
    .select({count: sql<number>`count(*)::int`})
    .from(skillResults)
    .innerJoin(bookings, eq(bookings.id, skillResults.bookingId))
    .where(lessons);

  return {
    lessons: await tx.$count(bookings, lessons),
    results: results?.count ?? 0,
    timeOff: timeOff === null ? 0 : await tx.$count(instructorTimeOff, timeOff),
    demoSessions: demoSessions ? await tx.$count(demoSlots, isNotNull(demoSlots.uid)) : 0,
  };
}

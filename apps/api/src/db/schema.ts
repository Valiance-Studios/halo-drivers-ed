import {sql} from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  time,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import {BOOKING_STATUSES, FACTIONS, ROLES, SKILL_RESULTS, VEHICLE_DOMAINS} from '@hde/shared';

/*
 * Column names are snake_case in the database and camelCase here (`casing: 'snake_case'` in both
 * drizzle.config.ts and the client). After changing this file, run `npm run db:generate`.
 */

export const factionEnum = pgEnum('faction', FACTIONS);
export const vehicleDomainEnum = pgEnum('vehicle_domain', VEHICLE_DOMAINS);
export const roleEnum = pgEnum('role', ROLES);
export const bookingStatusEnum = pgEnum('booking_status', BOOKING_STATUSES);
export const skillResultEnum = pgEnum('skill_result', SKILL_RESULTS);

export const vehicles = pgTable(
  'vehicles',
  {
    slug: text().primaryKey(),
    name: text().notNull(),
    faction: factionEnum().notNull(),
    domain: vehicleDomainEnum().notNull(),
    description: text().notNull(),
    lessonMinutes: integer().notNull(),
    lessonsRequired: integer().notNull(),
  },
  (table) => [
    // The target of instructor_vehicles' faction-matching foreign key.
    unique('vehicles_slug_faction_key').on(table.slug, table.faction),
    check('vehicles_lesson_minutes_positive', sql`${table.lessonMinutes} > 0`),
    check('vehicles_lessons_required_positive', sql`${table.lessonsRequired} > 0`),
  ],
);

/** Courses that must be completed before a vehicle's own course, e.g. the Warthog before the Scorpion. */
export const vehiclePrerequisites = pgTable(
  'vehicle_prerequisites',
  {
    vehicleSlug: text()
      .notNull()
      .references(() => vehicles.slug, {onDelete: 'cascade'}),
    prerequisiteSlug: text()
      .notNull()
      .references(() => vehicles.slug, {onDelete: 'cascade'}),
  },
  (table) => [
    primaryKey({columns: [table.vehicleSlug, table.prerequisiteSlug]}),
    check('vehicle_prerequisites_not_self', sql`${table.vehicleSlug} <> ${table.prerequisiteSlug}`),
  ],
);

export const instructors = pgTable(
  'instructors',
  {
    slug: text().primaryKey(),
    name: text().notNull(),
    title: text().notNull(),
    faction: factionEnum().notNull(),
    bio: text().notNull(),
  },
  (table) => [unique('instructors_slug_faction_key').on(table.slug, table.faction)],
);

/**
 * Which vehicles each instructor teaches. The faction column is part of both foreign keys, so the
 * database itself rejects a UNSC instructor teaching a Covenant vehicle and vice versa.
 */
export const instructorVehicles = pgTable(
  'instructor_vehicles',
  {
    instructorSlug: text().notNull(),
    vehicleSlug: text().notNull(),
    faction: factionEnum().notNull(),
  },
  (table) => [
    primaryKey({columns: [table.instructorSlug, table.vehicleSlug]}),
    foreignKey({
      name: 'instructor_vehicles_instructor_fkey',
      columns: [table.instructorSlug, table.faction],
      foreignColumns: [instructors.slug, instructors.faction],
    }).onDelete('cascade'),
    foreignKey({
      name: 'instructor_vehicles_vehicle_fkey',
      columns: [table.vehicleSlug, table.faction],
      foreignColumns: [vehicles.slug, vehicles.faction],
    }).onDelete('cascade'),
  ],
);

/**
 * The accounts allowed to sign in, and demo guests while their session lasts, whose made-up addresses are ones
 * no real account can have. Emails are stored lowercase, so lookups need no case folding.
 */
export const allowedUsers = pgTable(
  'allowed_users',
  {
    email: text().primaryKey(),
    /** From the Google account, kept up to date as the account signs in. */
    displayName: text(),
    role: roleEnum().notNull(),
    createdAt: timestamp({withTimezone: true}).notNull().defaultNow(),
  },
  (table) => [
    check('allowed_users_email_lowercase', sql`${table.email} = lower(${table.email})`),
    // As text, since a migration cannot use an enum value it adds in the same transaction.
    check('allowed_users_guest_email', sql`(${table.role}::text = 'guest') = (${table.email} like '%@demo.invalid')`),
  ],
);

/** One row for each visitor who can try the demo at once. A row whose session has expired is free to reuse. */
export const demoSlots = pgTable(
  'demo_slots',
  {
    id: integer().primaryKey(),
    /** The anonymous Firebase account in the slot. */
    uid: text().unique(),
    guestEmail: text()
      .unique()
      .references(() => allowedUsers.email),
    expiresAt: timestamp({withTimezone: true}),
  },
  (table) => [
    check('demo_slots_id_positive', sql`${table.id} > 0`),
    check('demo_slots_session', sql`num_nonnulls(${table.uid}, ${table.guestEmail}, ${table.expiresAt}) in (0, 3)`),
  ],
);

/** Each instructor's weekly hours, as wall-clock times in the school's time zone (see lessonSlots.ts). */
export const instructorAvailability = pgTable(
  'instructor_availability',
  {
    instructorSlug: text()
      .notNull()
      .references(() => instructors.slug, {onDelete: 'cascade'}),
    /** ISO weekday: 1 is Monday, 7 is Sunday. */
    weekday: integer().notNull(),
    startsAt: time({precision: 0}).notNull(),
    endsAt: time({precision: 0}).notNull(),
  },
  (table) => [
    primaryKey({columns: [table.instructorSlug, table.weekday, table.startsAt]}),
    check('instructor_availability_weekday', sql`${table.weekday} between 1 and 7`),
    check('instructor_availability_order', sql`${table.startsAt} < ${table.endsAt}`),
  ],
);

/** Each course's lessons. Ones dropped from the seed data stay, since bookings may refer to them. */
export const courseLessons = pgTable(
  'course_lessons',
  {
    vehicleSlug: text()
      .notNull()
      .references(() => vehicles.slug, {onDelete: 'cascade'}),
    number: integer().notNull(),
    title: text().notNull(),
  },
  (table) => [
    primaryKey({columns: [table.vehicleSlug, table.number]}),
    check('course_lessons_number_positive', sql`${table.number} > 0`),
  ],
);

/** The skills marked in each lesson. Ones dropped from the seed data are kept for past results, but not active. */
export const lessonSkills = pgTable(
  'lesson_skills',
  {
    vehicleSlug: text().notNull(),
    lessonNumber: integer().notNull(),
    id: text().notNull(),
    position: integer().notNull(),
    label: text().notNull(),
    active: boolean().notNull().default(true),
  },
  (table) => [
    primaryKey({columns: [table.vehicleSlug, table.lessonNumber, table.id]}),
    foreignKey({
      name: 'lesson_skills_lesson_fkey',
      columns: [table.vehicleSlug, table.lessonNumber],
      foreignColumns: [courseLessons.vehicleSlug, courseLessons.number],
    }).onDelete('cascade'),
  ],
);

/**
 * Lessons. The faction is part of both foreign keys, as in instructor_vehicles. It does not reference that
 * table, which the seed replaces. Exclusion constraints, which Drizzle cannot declare, are in the
 * booking_exclusions migration: a student, an instructor and a vehicle each have one lesson at a time.
 */
export const bookings = pgTable(
  'bookings',
  {
    id: uuid().primaryKey().defaultRandom(),
    studentEmail: text()
      .notNull()
      .references(() => allowedUsers.email, {onDelete: 'cascade'}),
    instructorSlug: text().notNull(),
    vehicleSlug: text().notNull(),
    faction: factionEnum().notNull(),
    startsAt: timestamp({withTimezone: true}).notNull(),
    endsAt: timestamp({withTimezone: true}).notNull(),
    status: bookingStatusEnum().notNull().default('booked'),
    lessonNumber: integer(),
    /** For the student to read, and only for instructors. Empty if there are none. */
    studentNote: text().notNull().default(''),
    privateNote: text().notNull().default(''),
    signedOffBy: text(),
    signedOffAt: timestamp({withTimezone: true}),
    createdAt: timestamp({withTimezone: true}).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      name: 'bookings_instructor_fkey',
      columns: [table.instructorSlug, table.faction],
      foreignColumns: [instructors.slug, instructors.faction],
    }),
    foreignKey({
      name: 'bookings_vehicle_fkey',
      columns: [table.vehicleSlug, table.faction],
      foreignColumns: [vehicles.slug, vehicles.faction],
    }),
    check(
      'bookings_note_length',
      sql`char_length(${table.studentNote}) <= 1000 and char_length(${table.privateNote}) <= 1000`,
    ),
    check('bookings_order', sql`${table.startsAt} < ${table.endsAt}`),
    // The target of skill_results' vehicle-matching foreign key.
    unique('bookings_id_vehicle_key').on(table.id, table.vehicleSlug),
    foreignKey({
      name: 'bookings_lesson_fkey',
      columns: [table.vehicleSlug, table.lessonNumber],
      foreignColumns: [courseLessons.vehicleSlug, courseLessons.number],
    }),
    // As text, since a migration cannot use an enum value it adds in the same transaction.
    check(
      'bookings_lesson_number',
      sql`(${table.status}::text in ('completed', 'repeat')) = (${table.lessonNumber} is not null)`,
    ),
    check(
      'bookings_signed_off',
      sql`(${table.status}::text in ('completed', 'repeat', 'missed')) = (${table.signedOffBy} is not null and ${table.signedOffAt} is not null)`,
    ),
    index('bookings_student_idx').on(table.studentEmail, table.startsAt),
  ],
);

/** How a student did on each skill in a lesson. The vehicle is in both foreign keys, so it must match. */
export const skillResults = pgTable(
  'skill_results',
  {
    bookingId: uuid().notNull(),
    vehicleSlug: text().notNull(),
    lessonNumber: integer().notNull(),
    skillId: text().notNull(),
    result: skillResultEnum().notNull(),
  },
  (table) => [
    primaryKey({columns: [table.bookingId, table.lessonNumber, table.skillId]}),
    foreignKey({
      name: 'skill_results_booking_fkey',
      columns: [table.bookingId, table.vehicleSlug],
      foreignColumns: [bookings.id, bookings.vehicleSlug],
    }).onDelete('cascade'),
    foreignKey({
      name: 'skill_results_skill_fkey',
      columns: [table.vehicleSlug, table.lessonNumber, table.skillId],
      foreignColumns: [lessonSkills.vehicleSlug, lessonSkills.lessonNumber, lessonSkills.id],
    }),
  ],
);

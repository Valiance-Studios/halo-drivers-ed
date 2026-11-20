import {sql} from 'drizzle-orm';
import {check, foreignKey, integer, pgEnum, pgTable, primaryKey, text, timestamp, unique} from 'drizzle-orm/pg-core';
import {FACTIONS, ROLES, VEHICLE_DOMAINS} from '@hde/shared';

/*
 * Column names are snake_case in the database and camelCase here (`casing: 'snake_case'` in both
 * drizzle.config.ts and the client). After changing this file, run `npm run db:generate`.
 */

export const factionEnum = pgEnum('faction', FACTIONS);
export const vehicleDomainEnum = pgEnum('vehicle_domain', VEHICLE_DOMAINS);
export const roleEnum = pgEnum('role', ROLES);

export const vehicles = pgTable('vehicles', {
  slug: text().primaryKey(),
  name: text().notNull(),
  faction: factionEnum().notNull(),
  domain: vehicleDomainEnum().notNull(),
  description: text().notNull(),
  lessonMinutes: integer().notNull(),
  lessonsRequired: integer().notNull(),
}, (table) => [
  // The target of instructor_vehicles' faction-matching foreign key.
  unique('vehicles_slug_faction_key').on(table.slug, table.faction),
  check('vehicles_lesson_minutes_positive', sql`${table.lessonMinutes} > 0`),
  check('vehicles_lessons_required_positive', sql`${table.lessonsRequired} > 0`),
]);

/** Courses that must be completed before a vehicle's own course, e.g. the Warthog before the Scorpion. */
export const vehiclePrerequisites = pgTable('vehicle_prerequisites', {
  vehicleSlug: text().notNull().references(() => vehicles.slug, {onDelete: 'cascade'}),
  prerequisiteSlug: text().notNull().references(() => vehicles.slug, {onDelete: 'cascade'}),
}, (table) => [
  primaryKey({columns: [table.vehicleSlug, table.prerequisiteSlug]}),
  check('vehicle_prerequisites_not_self', sql`${table.vehicleSlug} <> ${table.prerequisiteSlug}`),
]);

export const instructors = pgTable('instructors', {
  slug: text().primaryKey(),
  name: text().notNull(),
  title: text().notNull(),
  faction: factionEnum().notNull(),
  bio: text().notNull(),
}, (table) => [
  unique('instructors_slug_faction_key').on(table.slug, table.faction),
]);

/**
 * Which vehicles each instructor teaches. The faction column is part of both foreign keys, so the
 * database itself rejects a UNSC instructor teaching a Covenant vehicle and vice versa.
 */
export const instructorVehicles = pgTable('instructor_vehicles', {
  instructorSlug: text().notNull(),
  vehicleSlug: text().notNull(),
  faction: factionEnum().notNull(),
}, (table) => [
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
]);

/** The accounts allowed to sign in. Emails are stored lowercase, so lookups need no case folding. */
export const allowedUsers = pgTable('allowed_users', {
  email: text().primaryKey(),
  role: roleEnum().notNull(),
  createdAt: timestamp({withTimezone: true}).notNull().defaultNow(),
}, (table) => [
  check('allowed_users_email_lowercase', sql`${table.email} = lower(${table.email})`),
]);

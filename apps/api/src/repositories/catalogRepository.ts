import type {Instructor, Vehicle} from '@hde/shared';
import type {Database} from '#src/db/client.ts';

import {asc} from 'drizzle-orm';
import {instructors, instructorVehicles, vehiclePrerequisites, vehicles} from '#src/db/schema.ts';

export interface CatalogRepository {
  listVehicles(): Promise<Vehicle[]>;
  listInstructors(): Promise<Instructor[]>;
}

/** Groups `[key, value]` rows into lists of values per key. */
function groupBy<Row>(rows: Row[], key: (row: Row) => string, value: (row: Row) => string): Map<string, string[]> {
  const groups = new Map<string, string[]>();

  for (const row of rows) {
    const list = groups.get(key(row)) ?? [];
    list.push(value(row));
    groups.set(key(row), list);
  }

  return groups;
}

export class PostgresCatalogRepository implements CatalogRepository {
  private readonly db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  /** Vehicles by faction, then in course order: shorter courses, which tend to be prerequisites, first. */
  async listVehicles(): Promise<Vehicle[]> {
    const [rows, links] = await Promise.all([
      this.db.select().from(vehicles).orderBy(asc(vehicles.faction), asc(vehicles.lessonsRequired), asc(vehicles.name)),
      this.db.select().from(vehiclePrerequisites).orderBy(asc(vehiclePrerequisites.prerequisiteSlug)),
    ]);
    const prerequisites = groupBy(
      links,
      (link) => link.vehicleSlug,
      (link) => link.prerequisiteSlug,
    );

    return rows.map((row) => ({...row, prerequisites: prerequisites.get(row.slug) ?? []}));
  }

  async listInstructors(): Promise<Instructor[]> {
    const [rows, links] = await Promise.all([
      this.db.select().from(instructors).orderBy(asc(instructors.faction), asc(instructors.name)),
      this.db.select().from(instructorVehicles).orderBy(asc(instructorVehicles.vehicleSlug)),
    ]);
    const teaching = groupBy(
      links,
      (link) => link.instructorSlug,
      (link) => link.vehicleSlug,
    );

    return rows.map((row) => ({...row, vehicles: teaching.get(row.slug) ?? []}));
  }
}

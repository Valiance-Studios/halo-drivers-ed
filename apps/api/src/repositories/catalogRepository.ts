import type {CourseLesson, Instructor, Vehicle} from '@hde/shared';
import type {Database} from '#src/db/client.ts';

import {and, asc, eq} from 'drizzle-orm';
import {
  courseLessons,
  instructors,
  instructorVehicles,
  lessonSkills,
  vehiclePrerequisites,
  vehicles,
} from '#src/db/schema.ts';

export interface CatalogRepository {
  listVehicles(): Promise<Vehicle[]>;
  listInstructors(): Promise<Instructor[]>;
  /** Every course's lessons, in order, with the skills marked in each. */
  listCurriculum(): Promise<CourseLesson[]>;
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

  async listCurriculum(): Promise<CourseLesson[]> {
    const rows = await this.db
      .select({
        vehicleSlug: courseLessons.vehicleSlug,
        number: courseLessons.number,
        title: courseLessons.title,
        id: lessonSkills.id,
        label: lessonSkills.label,
      })
      .from(courseLessons)
      .innerJoin(
        lessonSkills,
        and(
          eq(lessonSkills.vehicleSlug, courseLessons.vehicleSlug),
          eq(lessonSkills.lessonNumber, courseLessons.number),
          eq(lessonSkills.active, true),
        ),
      )
      .orderBy(asc(courseLessons.vehicleSlug), asc(courseLessons.number), asc(lessonSkills.position));
    const lessons = new Map<string, CourseLesson>();

    for (const {id, label, ...lesson} of rows) {
      const key = `${lesson.vehicleSlug}/${lesson.number}`;
      const entry = lessons.get(key) ?? {...lesson, skills: []};
      entry.skills.push({id, label});
      lessons.set(key, entry);
    }

    return [...lessons.values()];
  }
}

import type {Instructor, Vehicle} from '@hde/shared';
import type {Database} from '#src/db/client.ts';

import {sql} from 'drizzle-orm';
import {instructors, instructorVehicles, vehiclePrerequisites, vehicles} from '#src/db/schema.ts';
import {INSTRUCTORS, VEHICLES} from '#src/db/catalogData.ts';

/** Takes the excluded (incoming) value of a column in an upsert. */
const excluded = (column: string) => sql.raw(`excluded.${column}`);

/**
 * Loads the course catalog, updating what is already there, in one transaction. Safe to repeat. Vehicles
 * and instructors that were removed from the data stay in the database.
 */
export async function seedCatalog(
  db: Database,
  catalog: {vehicles: Vehicle[]; instructors: Instructor[]} = {vehicles: VEHICLES, instructors: INSTRUCTORS},
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .insert(vehicles)
      .values(catalog.vehicles.map(({prerequisites: _prerequisites, ...vehicle}) => vehicle))
      .onConflictDoUpdate({
        target: vehicles.slug,
        set: {
          name: excluded('name'),
          faction: excluded('faction'),
          domain: excluded('domain'),
          description: excluded('description'),
          lessonMinutes: excluded('lesson_minutes'),
          lessonsRequired: excluded('lessons_required'),
        },
      });

    await tx
      .insert(instructors)
      .values(catalog.instructors.map(({vehicles: _vehicles, ...instructor}) => instructor))
      .onConflictDoUpdate({
        target: instructors.slug,
        set: {
          name: excluded('name'),
          title: excluded('title'),
          faction: excluded('faction'),
          bio: excluded('bio'),
        },
      });

    // The links are replaced outright, so removing one from the data removes it here too.
    await tx.delete(vehiclePrerequisites);
    await tx.delete(instructorVehicles);

    const prerequisites = catalog.vehicles.flatMap((vehicle) =>
      vehicle.prerequisites.map((prerequisiteSlug) => ({vehicleSlug: vehicle.slug, prerequisiteSlug})),
    );
    const teaching = catalog.instructors.flatMap((instructor) =>
      instructor.vehicles.map((vehicleSlug) => ({
        instructorSlug: instructor.slug,
        vehicleSlug,
        faction: instructor.faction,
      })),
    );

    if (prerequisites.length > 0) {
      await tx.insert(vehiclePrerequisites).values(prerequisites);
    }

    if (teaching.length > 0) {
      await tx.insert(instructorVehicles).values(teaching);
    }
  });
}

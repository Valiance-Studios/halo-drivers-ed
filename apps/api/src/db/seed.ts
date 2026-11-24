import type {CourseLesson, Instructor, Vehicle} from '@hde/shared';
import type {InstructorAvailability} from '#src/db/availabilityData.ts';
import type {Database} from '#src/db/client.ts';

import {sql} from 'drizzle-orm';
import {
  courseLessons,
  instructorAvailability,
  instructors,
  instructorVehicles,
  lessonSkills,
  vehiclePrerequisites,
  vehicles,
} from '#src/db/schema.ts';
import {AVAILABILITY} from '#src/db/availabilityData.ts';
import {CURRICULUM} from '#src/db/curriculumData.ts';
import {INSTRUCTORS, VEHICLES} from '#src/db/catalogData.ts';

/** Takes the excluded (incoming) value of a column in an upsert. */
const excluded = (column: string) => sql.raw(`excluded.${column}`);

/**
 * Loads the course catalog, updating what is already there, in one transaction. Safe to repeat. Vehicles
 * and instructors that were removed from the data stay in the database.
 */
export async function seedCatalog(
  db: Database,
  catalog: {
    vehicles: Vehicle[];
    instructors: Instructor[];
    availability: InstructorAvailability[];
    curriculum: CourseLesson[];
  } = {
    vehicles: VEHICLES,
    instructors: INSTRUCTORS,
    availability: AVAILABILITY,
    curriculum: CURRICULUM,
  },
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

    // The links and hours are replaced outright, so removing one from the data removes it here too.
    await tx.delete(vehiclePrerequisites);
    await tx.delete(instructorVehicles);
    await tx.delete(instructorAvailability);

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

    if (catalog.availability.length > 0) {
      await tx.insert(instructorAvailability).values(catalog.availability);
    }

    // Results refer to lessons and skills, so ones no longer in the data are kept, but no longer active.
    await tx.update(lessonSkills).set({active: false});

    const skills = catalog.curriculum.flatMap((lesson) =>
      lesson.skills.map((skill, position) => ({
        ...skill,
        position,
        vehicleSlug: lesson.vehicleSlug,
        lessonNumber: lesson.number,
      })),
    );

    if (skills.length > 0) {
      await tx
        .insert(courseLessons)
        .values(catalog.curriculum.map(({vehicleSlug, number, title}) => ({vehicleSlug, number, title})))
        .onConflictDoUpdate({
          target: [courseLessons.vehicleSlug, courseLessons.number],
          set: {title: excluded('title')},
        });
      await tx
        .insert(lessonSkills)
        .values(skills)
        .onConflictDoUpdate({
          target: [lessonSkills.vehicleSlug, lessonSkills.lessonNumber, lessonSkills.id],
          set: {position: excluded('position'), label: excluded('label'), active: sql`true`},
        });
    }
  });
}

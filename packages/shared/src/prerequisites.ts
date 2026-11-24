import type {Vehicle} from './catalog.ts';

/** The prerequisite courses a student still has to complete before booking a vehicle's course. */
export function missingPrerequisites(vehicle: Vehicle, completedSlugs: readonly string[]): string[] {
  return vehicle.prerequisites.filter((slug) => !completedSlugs.includes(slug));
}

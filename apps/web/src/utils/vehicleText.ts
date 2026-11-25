import type {Vehicle} from '@hde/shared';

/** A course's total time, e.g. "1.5 h". */
export function totalHours(vehicle: Vehicle): string {
  const hours = (vehicle.lessonsRequired * vehicle.lessonMinutes) / 60;

  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} h`;
}

/** How far through a course a student is, e.g. "2/4", or nothing if they have not started it. */
export function progressText(vehicle: Vehicle, lessonsCompleted: number | null): string {
  return lessonsCompleted === null ? '' : `${lessonsCompleted}/${vehicle.lessonsRequired}`;
}

export function domainName(vehicle: Vehicle): string {
  return vehicle.domain === 'air' ? 'Air' : 'Ground';
}

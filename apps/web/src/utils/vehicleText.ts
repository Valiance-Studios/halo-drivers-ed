import type {Vehicle} from '@hde/shared';

/** A course's total time, e.g. "1.5 h". */
export function totalHours(vehicle: Vehicle): string {
  const hours = (vehicle.lessonsRequired * vehicle.lessonMinutes) / 60;

  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} h`;
}

export function domainName(vehicle: Vehicle): string {
  return vehicle.domain === 'air' ? 'Air' : 'Ground';
}

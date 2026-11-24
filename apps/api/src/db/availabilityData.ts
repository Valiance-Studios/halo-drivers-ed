/** A weekly window, in the school's time zone. */
export interface AvailabilityWindow {
  /** ISO weekday: 1 is Monday, 7 is Sunday. */
  weekday: number;
  /** Wall-clock times, e.g. "09:00:00". */
  startsAt: string;
  endsAt: string;
}

export type InstructorAvailability = AvailabilityWindow & {instructorSlug: string};

function weekly(
  instructorSlug: string,
  weekdays: number[],
  startsAt: string,
  endsAt: string,
): InstructorAvailability[] {
  return weekdays.map((weekday) => ({instructorSlug, weekday, startsAt, endsAt}));
}

/** When each seeded instructor teaches. */
export const AVAILABILITY: InstructorAvailability[] = [
  ...weekly('master-chief', [1, 2, 3, 4, 5], '08:00:00', '14:00:00'),
  ...weekly('sergeant-johnson', [2, 4, 6], '06:00:00', '16:00:00'),
  ...weekly('miranda-keyes', [1, 3, 5], '09:00:00', '17:00:00'),
  ...weekly('arbiter', [1, 2, 4, 5, 6], '12:00:00', '20:00:00'),
  ...weekly('rtas-vadum', [2, 3, 5, 7], '10:00:00', '18:00:00'),
  ...weekly('prophet-of-truth', [3, 7], '10:00:00', '17:00:00'),
];

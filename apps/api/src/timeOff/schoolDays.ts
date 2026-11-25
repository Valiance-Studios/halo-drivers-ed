import type {Period} from '#src/bookings/lessonSlots.ts';

import {SCHOOL_TIME_ZONE} from '#src/bookings/lessonSlots.ts';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Whether this is a real date such as "2026-06-08". */
export function isDate(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE.test(value)) {
    return false;
  }

  try {
    return Temporal.PlainDate.from(value, {overflow: 'reject'}).toString() === value;
  } catch {
    return false;
  }
}

/** The date at the school. */
export function schoolDate(at: Date): string {
  return Temporal.Instant.fromEpochMilliseconds(at.getTime())
    .toZonedDateTimeISO(SCHOOL_TIME_ZONE)
    .toPlainDate()
    .toString();
}

/** From the start of the first day to the end of the last, at the school. */
export function daysPeriod(startsOn: string, endsOn: string): Period {
  const midnight = (date: Temporal.PlainDate) => new Date(date.toZonedDateTime(SCHOOL_TIME_ZONE).epochMilliseconds);

  return {
    startsAt: midnight(Temporal.PlainDate.from(startsOn)),
    endsAt: midnight(Temporal.PlainDate.from(endsOn).add({days: 1})),
  };
}

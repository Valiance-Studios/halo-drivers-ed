/** Lesson times, in the viewer's own language and time zone. */

const DAY = new Intl.DateTimeFormat(undefined, {weekday: 'long', month: 'long', day: 'numeric'});
const TIME = new Intl.DateTimeFormat(undefined, {hour: 'numeric', minute: '2-digit'});
const TIME_WITH_ZONE = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
  timeZoneName: 'short',
});

export function lessonDay(iso: string): string {
  return DAY.format(new Date(iso));
}

export function lessonTime(iso: string): string {
  return TIME.format(new Date(iso));
}

export function lessonDayAndTime(iso: string): string {
  return `${lessonDay(iso)}, ${TIME_WITH_ZONE.format(new Date(iso))}`;
}

/** The viewer's time zone, e.g. "America/New York". */
export function timeZoneName(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone.replaceAll('_', ' ');
}

/** Whole days, e.g. "Jun 8, 2026 to Jun 12, 2026". Dates are like "2026-06-08", and not in any time zone. */
export function daysText({startsOn, endsOn}: {startsOn: string; endsOn: string}): string {
  const text = (date: string) =>
    new Date(`${date}T00:00:00Z`).toLocaleDateString([], {dateStyle: 'medium', timeZone: 'UTC'});

  return startsOn === endsOn ? text(startsOn) : `${text(startsOn)} to ${text(endsOn)}`;
}

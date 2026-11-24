import type {AvailabilityWindow} from '#src/db/availabilityData.ts';

/** Instructors' weekly hours are in this time zone, so they stay put when daylight saving changes. */
export const SCHOOL_TIME_ZONE = 'America/New_York';

/** Lessons can start this often within an instructor's hours. The starts are alternatives, so they can overlap. */
const SLOT_STEP_MINUTES = 30;

export interface Period {
  startsAt: Date;
  endsAt: Date;
}

export interface SlotQuery {
  windows: AvailabilityWindow[];
  lessonMinutes: number;
  /** Lessons start after `from` and no later than `until`. */
  from: Date;
  until: Date;
  /** Lessons already booked that would clash. */
  busy: Period[];
}

function overlaps(a: Period, b: Period): boolean {
  return a.startsAt < b.endsAt && b.startsAt < a.endsAt;
}

function toDate(time: Temporal.ZonedDateTime): Date {
  return new Date(time.epochMilliseconds);
}

/** Every time a lesson could take without clashing with a booked one, soonest first. */
export function findSlots({windows, lessonMinutes, from, until, busy}: SlotQuery): Period[] {
  const toDay = (date: Date) =>
    Temporal.Instant.fromEpochMilliseconds(date.getTime()).toZonedDateTimeISO(SCHOOL_TIME_ZONE).toPlainDate();
  const lastDay = toDay(until);
  const slots: Period[] = [];

  for (let day = toDay(from); Temporal.PlainDate.compare(day, lastDay) <= 0; day = day.add({days: 1})) {
    for (const window of windows.filter(({weekday}) => weekday === day.dayOfWeek)) {
      const at = (plainTime: string) => day.toZonedDateTime({timeZone: SCHOOL_TIME_ZONE, plainTime});
      const closes = toDate(at(window.endsAt));

      for (let start = at(window.startsAt); ; start = start.add({minutes: SLOT_STEP_MINUTES})) {
        const slot: Period = {startsAt: toDate(start), endsAt: toDate(start.add({minutes: lessonMinutes}))};

        if (slot.endsAt > closes) {
          break;
        }

        if (slot.startsAt > from && slot.startsAt <= until && !busy.some((period) => overlaps(period, slot))) {
          slots.push(slot);
        }
      }
    }
  }

  return slots.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

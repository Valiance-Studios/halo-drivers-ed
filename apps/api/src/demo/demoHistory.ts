import type {Period} from '#src/bookings/lessonSlots.ts';
import type {AvailabilityWindow} from '#src/db/availabilityData.ts';

import {findSlots} from '#src/bookings/lessonSlots.ts';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Guests' past lessons are all with this instructor, who teaches both courses. */
export const DEMO_INSTRUCTOR = 'master-chief';

export interface DemoLesson {
  vehicleSlug: string;
  lessonNumber: number;
  status: 'completed' | 'repeat';
}

/** The Mongoose course, which unlocks the Warthog, and a first Warthog lesson to repeat. */
export const DEMO_LESSONS: DemoLesson[] = [
  {vehicleSlug: 'mongoose', lessonNumber: 1, status: 'completed'},
  {vehicleSlug: 'mongoose', lessonNumber: 2, status: 'completed'},
  {vehicleSlug: 'warthog', lessonNumber: 1, status: 'repeat'},
];

/** When a slot's guest had their past lessons: each slot has its own week, so guests never clash. */
export function historyPeriod(slot: number, now: Date): {from: Date; until: Date} {
  return {
    from: new Date(now.getTime() - 7 * (slot + 1) * DAY_MS),
    // A day short of the next slot's week, so a lesson cannot run into it.
    until: new Date(now.getTime() - (7 * slot + 1) * DAY_MS),
  };
}

/** A time in the instructor's hours for each lesson, in order and on different days. Fewer if there is no room. */
export function findHistoryTimes(
  lessonMinutes: number[],
  period: {from: Date; until: Date},
  windows: AvailabilityWindow[],
  busy: Period[],
): Period[] {
  const times: Period[] = [];
  let {from} = period;

  for (const minutes of lessonMinutes) {
    const [time] = findSlots({windows, lessonMinutes: minutes, from, until: period.until, busy});

    if (!time) {
      break;
    }

    times.push(time);
    from = new Date(time.startsAt.getTime() + DAY_MS / 2);
  }

  return times;
}

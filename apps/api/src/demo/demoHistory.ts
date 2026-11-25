import type {LessonNotes} from '@hde/shared';
import type {Period} from '#src/bookings/lessonSlots.ts';
import type {InstructorAvailability} from '#src/db/availabilityData.ts';

import {findSlots} from '#src/bookings/lessonSlots.ts';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
/** Between the starts of a guest's past lessons with an instructor, which leaves room for two on a weekday. */
const SPACING_MS = 3 * HOUR_MS;

export interface DemoLesson {
  instructorSlug: string;
  vehicleSlug: string;
  lessonNumber: number;
  status: 'completed' | 'repeat';
  notes?: LessonNotes;
}

/**
 * The Mongoose course, and the Warthog's four lessons, the last of which has to be repeated: completing it unlocks
 * the Scorpion and the Hornet. Also the first of the Ghost's two: completing the other unlocks the Banshee and the
 * Wraith.
 */
export const DEMO_LESSONS: DemoLesson[] = [
  {instructorSlug: 'master-chief', vehicleSlug: 'mongoose', lessonNumber: 1, status: 'completed'},
  {instructorSlug: 'master-chief', vehicleSlug: 'mongoose', lessonNumber: 2, status: 'completed'},
  {instructorSlug: 'master-chief', vehicleSlug: 'warthog', lessonNumber: 1, status: 'completed'},
  {instructorSlug: 'master-chief', vehicleSlug: 'warthog', lessonNumber: 2, status: 'completed'},
  {instructorSlug: 'master-chief', vehicleSlug: 'warthog', lessonNumber: 3, status: 'completed'},
  {
    instructorSlug: 'master-chief',
    vehicleSlug: 'warthog',
    lessonNumber: 4,
    status: 'repeat',
    notes: {
      student: 'Well recovered, and no one hurt in the ambush. Next time, park under cover before you shut down.',
      private: 'Ready to finish the course. Rushes the shutdown, so leave time for it.',
    },
  },
  {instructorSlug: 'arbiter', vehicleSlug: 'ghost', lessonNumber: 1, status: 'completed'},
];

/** When a slot's guest had their past lessons: each slot has its own week, so guests never clash. */
export function historyPeriod(slot: number, now: Date): {from: Date; until: Date} {
  return {
    from: new Date(now.getTime() - 7 * (slot + 1) * DAY_MS),
    // A day short of the next slot's week, so a lesson cannot run into it.
    until: new Date(now.getTime() - (7 * slot + 1) * DAY_MS),
  };
}

/** A lesson to find a time for. */
export interface HistoryLesson {
  instructorSlug: string;
  lessonMinutes: number;
}

/**
 * A time for each lesson, in its instructor's hours and clear of the others. Each instructor's are in order. Fewer if
 * there is no room.
 */
export function findHistoryTimes(
  lessons: HistoryLesson[],
  period: {from: Date; until: Date},
  availability: InstructorAvailability[],
  busy: Period[],
): Period[] {
  const times: Period[] = [];
  const nextFrom = new Map<string, Date>();

  for (const {instructorSlug, lessonMinutes} of lessons) {
    const [time] = findSlots({
      windows: availability.filter((window) => window.instructorSlug === instructorSlug),
      lessonMinutes,
      from: nextFrom.get(instructorSlug) ?? period.from,
      until: period.until,
      busy: [...busy, ...times],
    });

    if (!time) {
      break;
    }

    times.push(time);
    nextFrom.set(instructorSlug, new Date(time.startsAt.getTime() + SPACING_MS));
  }

  return times;
}

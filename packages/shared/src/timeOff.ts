import type {AdminLesson} from './bookings.ts';

/** The longest a reason for cancelling a lesson can be. */
export const REASON_MAX_LENGTH = 500;

/** Days an instructor is away, both included, in the school's time zone. Dates are like "2026-06-08". */
export interface TimeOff {
  id: string;
  startsOn: string;
  endsOn: string;
}

/** The body of `POST /api/admin/instructors/:slug/time-off`. */
export interface TimeOffRequest {
  startsOn: string;
  endsOn: string;
  /** The lessons booked in that time, to cancel. Null to find out whether there are any. */
  cancel: {lessonIds: string[]; reason: string} | null;
}

/** Time off is not saved while lessons that were not cancelled are booked in it. */
export type TimeOffAnswer = {saved: true; timeOff: TimeOff} | {saved: false; lessons: AdminLesson[]};

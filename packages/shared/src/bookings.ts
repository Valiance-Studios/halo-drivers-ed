import type {Vehicle} from './catalog.ts';

/**
 * A lesson is booked, unless it is cancelled, until its instructor signs it off: completed (every skill passed),
 * to repeat (some were not) or missed.
 */
export const BOOKING_STATUSES = ['booked', 'completed', 'missed', 'cancelled', 'repeat'] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

/** One lesson a student has booked. Times are ISO 8601 in UTC. */
export interface Booking {
  id: string;
  vehicleSlug: string;
  instructorSlug: string;
  startsAt: string;
  endsAt: string;
  status: BookingStatus;
  /** Which of the course's lessons this was; null until it is signed off as attended. */
  lessonNumber: number | null;
  /** Why the instructor cancelled it; null unless they did. */
  cancelReason: string | null;
  /** When it was last signed off; null until then. */
  signedOffAt: string | null;
}

/** A lesson as admins see it, with its student. */
export interface AdminLesson extends Booking {
  studentEmail: string;
  /** From the student's Google account; null until they sign in. */
  studentName: string | null;
}

/** The body of `POST /api/bookings`. */
export interface BookingRequest {
  vehicleSlug: string;
  instructorSlug: string;
  startsAt: string;
}

/** The body of `POST /api/bookings/:id/reschedule`: the lesson's new time, and who teaches it then. */
export type RescheduleRequest = Omit<BookingRequest, 'vehicleSlug'>;

/** A time a lesson can be booked, from `GET /api/slots`, or moved to, from `GET /api/bookings/:id/slots`. */
export interface LessonSlot {
  startsAt: string;
  endsAt: string;
}

/** How far ahead lessons can be booked. */
export const BOOKING_WINDOW_DAYS = 14;

/** Lessons can be cancelled or rescheduled until this long before they start. */
export const CANCELLATION_NOTICE_HOURS = 24;

/** Whether a lesson starts late enough to still be cancelled or rescheduled. */
export function hasCancellationNotice(startsAt: string, now: Date): boolean {
  return new Date(startsAt).getTime() - now.getTime() >= CANCELLATION_NOTICE_HOURS * 60 * 60 * 1000;
}

/** Whether a student can still cancel or reschedule a lesson. */
export function canChange(booking: Booking, now: Date): boolean {
  return booking.status === 'booked' && hasCancellationNotice(booking.startsAt, now);
}

/** How many more lessons of a course a student may book. Cancelled, missed and repeated lessons do not count. */
export function lessonsLeft(vehicle: Vehicle, bookings: readonly Booking[]): number {
  const used = bookings.filter(
    ({vehicleSlug, status}) => vehicleSlug === vehicle.slug && (status === 'booked' || status === 'completed'),
  ).length;

  return Math.max(0, vehicle.lessonsRequired - used);
}

/** How many of a course's lessons the student has completed, or null if they have not attended one yet. */
export function lessonsCompleted(vehicle: Vehicle, bookings: readonly Booking[]): number | null {
  const attended = bookings.filter(
    ({vehicleSlug, status}) => vehicleSlug === vehicle.slug && (status === 'completed' || status === 'repeat'),
  );

  return attended.length > 0 ? attended.filter(({status}) => status === 'completed').length : null;
}

/** The lesson of a course the student has to repeat before going on to the next, or null if there is none. */
export function repeatDue(vehicle: Vehicle, bookings: readonly Booking[]): number | null {
  const own = bookings.filter(({vehicleSlug}) => vehicleSlug === vehicle.slug);
  const completed = own.filter(({status}) => status === 'completed').map(({lessonNumber}) => lessonNumber);

  return (
    own.find(({status, lessonNumber}) => status === 'repeat' && !completed.includes(lessonNumber))?.lessonNumber ?? null
  );
}

/** Whether a lesson of the course is booked and not signed off. While one has to be repeated, this must be it. */
export function hasLessonBooked(vehicle: Vehicle, bookings: readonly Booking[]): boolean {
  return bookings.some(({vehicleSlug, status}) => vehicleSlug === vehicle.slug && status === 'booked');
}

/** How a student finished a course, for its certificate. */
export interface CourseCompletion {
  /** Who taught the final lesson. */
  instructorSlug: string;
  /** When the final lesson ended, or was signed off if that was earlier. */
  completedAt: string;
}

/** How the student completed a course, or null if they have not. */
export function courseCompletion(vehicle: Vehicle, bookings: readonly Booking[]): CourseCompletion | null {
  if (!completedCourses([vehicle], bookings).includes(vehicle.slug)) {
    return null;
  }

  // By number, since an early sign-off can leave the final lesson's time before another's.
  const [final] = bookings
    .filter(({vehicleSlug, status}) => vehicleSlug === vehicle.slug && status === 'completed')
    .sort((a, b) => (b.lessonNumber ?? 0) - (a.lessonNumber ?? 0));

  if (!final) {
    return null;
  }

  const {instructorSlug, endsAt, signedOffAt} = final;

  return {instructorSlug, completedAt: signedOffAt !== null && signedOffAt < endsAt ? signedOffAt : endsAt};
}

/** Slugs of the courses whose required lessons are all completed. */
export function completedCourses(vehicles: readonly Vehicle[], bookings: readonly Booking[]): string[] {
  return vehicles
    .filter(
      ({slug, lessonsRequired}) =>
        bookings.filter(({vehicleSlug, status}) => vehicleSlug === slug && status === 'completed').length >=
        lessonsRequired,
    )
    .map(({slug}) => slug);
}

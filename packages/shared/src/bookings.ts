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

/** A time a lesson can be booked, from `GET /api/slots`. */
export interface LessonSlot {
  startsAt: string;
  endsAt: string;
}

/** How far ahead lessons can be booked. */
export const BOOKING_WINDOW_DAYS = 14;

/** Lessons can be cancelled until this long before they start. */
export const CANCELLATION_NOTICE_HOURS = 24;

/** Whether a lesson starts late enough to still be cancelled. */
export function hasCancellationNotice(startsAt: string, now: Date): boolean {
  return new Date(startsAt).getTime() - now.getTime() >= CANCELLATION_NOTICE_HOURS * 60 * 60 * 1000;
}

export function canCancel(booking: Booking, now: Date): boolean {
  return booking.status === 'booked' && hasCancellationNotice(booking.startsAt, now);
}

/** How many more lessons of a course a student may book. Cancelled, missed and repeated lessons do not count. */
export function lessonsLeft(vehicle: Vehicle, bookings: readonly Booking[]): number {
  const used = bookings.filter(
    ({vehicleSlug, status}) => vehicleSlug === vehicle.slug && (status === 'booked' || status === 'completed'),
  ).length;

  return Math.max(0, vehicle.lessonsRequired - used);
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

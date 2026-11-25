import type {Booking, BookingRequest, Instructor, LessonSlot, Vehicle} from '@hde/shared';
import type {Period} from '#src/bookings/lessonSlots.ts';
import type {BookingRepository} from '#src/repositories/bookingRepository.ts';
import type {CatalogRepository} from '#src/repositories/catalogRepository.ts';

import {
  BOOKING_WINDOW_DAYS,
  canCancel,
  CANCELLATION_NOTICE_HOURS,
  completedCourses,
  lessonsLeft,
  missingPrerequisites,
} from '@hde/shared';
import {findSlots} from '#src/bookings/lessonSlots.ts';
import {ApiError} from '#src/http/errors.ts';

interface Course {
  vehicle: Vehicle;
  instructor: Instructor;
  vehicles: Vehicle[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** The rules for booking and cancelling lessons. */
export class BookingService {
  private readonly bookings: BookingRepository;
  private readonly catalog: CatalogRepository;
  private readonly now: () => Date;

  constructor(bookings: BookingRepository, catalog: CatalogRepository, now: () => Date = () => new Date()) {
    this.bookings = bookings;
    this.catalog = catalog;
    this.now = now;
  }

  list(email: string): Promise<Booking[]> {
    return this.bookings.listForStudent(email);
  }

  async slots(email: string, vehicleSlug: string, instructorSlug: string): Promise<LessonSlot[]> {
    const course = await this.findCourse(vehicleSlug, instructorSlug);
    const slots = await this.freeSlots(email, course);

    return slots.map(({startsAt, endsAt}) => ({startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString()}));
  }

  /** `limit` caps how many lessons the student can ever book, counting cancelled ones but not signed-off ones. */
  async book(email: string, request: BookingRequest, limit: number | null = null): Promise<Booking> {
    const course = await this.findCourse(request.vehicleSlug, request.instructorSlug);
    const startsAt = new Date(request.startsAt).getTime();
    const slot = (await this.freeSlots(email, course)).find((free) => free.startsAt.getTime() === startsAt);

    if (!slot) {
      throw slotUnavailable();
    }

    const {vehicle, instructor, vehicles} = course;
    const booking = await this.bookings.create(
      {
        studentEmail: email,
        vehicleSlug: vehicle.slug,
        instructorSlug: instructor.slug,
        faction: vehicle.faction,
        ...slot,
      },
      (existing) => {
        const booked = existing.filter(({status}) => status === 'booked' || status === 'cancelled').length;

        if (limit !== null && booked >= limit) {
          throw new ApiError(409, 'demo-limit', `You can book ${limit} lessons in the demo, counting cancelled ones.`);
        }

        if (missingPrerequisites(vehicle, completedCourses(vehicles, existing)).length > 0) {
          throw new ApiError(409, 'course-locked', 'Complete the courses this one requires first.');
        }

        if (lessonsLeft(vehicle, existing) === 0) {
          throw new ApiError(409, 'no-lessons-left', 'You have already booked every lesson in this course.');
        }
      },
    );

    if (!booking) {
      throw slotUnavailable();
    }

    return booking;
  }

  async cancel(email: string, id: string): Promise<Booking> {
    const booking = await this.bookings.cancel(email, id, (existing) => {
      if (!canCancel(existing, this.now())) {
        throw new ApiError(
          409,
          'too-late-to-cancel',
          `Lessons can be cancelled until ${CANCELLATION_NOTICE_HOURS} hours before they start.`,
        );
      }
    });

    if (!booking) {
      throw new ApiError(404, 'not-found', 'No such lesson.');
    }

    return booking;
  }

  /** The vehicle and an instructor who teaches it. */
  private async findCourse(vehicleSlug: string, instructorSlug: string): Promise<Course> {
    const [vehicles, instructors] = await Promise.all([this.catalog.listVehicles(), this.catalog.listInstructors()]);
    const vehicle = vehicles.find(({slug}) => slug === vehicleSlug);
    const instructor = instructors.find(({slug}) => slug === instructorSlug);

    if (!vehicle || !instructor?.vehicles.includes(vehicle.slug)) {
      throw new ApiError(400, 'invalid-request', 'That instructor does not teach that course.');
    }

    return {vehicle, instructor, vehicles};
  }

  private async freeSlots(email: string, {vehicle, instructor}: Course): Promise<Period[]> {
    const from = this.now();
    const until = new Date(from.getTime() + BOOKING_WINDOW_DAYS * DAY_MS);
    const [windows, busy] = await Promise.all([
      this.bookings.listAvailability(instructor.slug),
      this.bookings.listBusy({studentEmail: email, instructorSlug: instructor.slug, vehicleSlug: vehicle.slug}, from),
    ]);

    return findSlots({windows, lessonMinutes: vehicle.lessonMinutes, from, until, busy});
  }
}

function slotUnavailable(): ApiError {
  return new ApiError(409, 'slot-unavailable', 'That time is no longer available. Choose another.');
}

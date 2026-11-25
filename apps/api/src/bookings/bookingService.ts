import type {Booking, BookingRequest, Instructor, LessonSlot, RescheduleRequest, Vehicle} from '@hde/shared';
import type {Period} from '#src/bookings/lessonSlots.ts';
import type {BookingRepository} from '#src/repositories/bookingRepository.ts';
import type {CatalogRepository} from '#src/repositories/catalogRepository.ts';

import {
  BOOKING_WINDOW_DAYS,
  canChange,
  CANCELLATION_NOTICE_HOURS,
  completedCourses,
  hasLessonBooked,
  lessonsLeft,
  missingPrerequisites,
  repeatDue,
} from '@hde/shared';
import {findSlots} from '#src/bookings/lessonSlots.ts';
import {daysPeriod, schoolDate} from '#src/timeOff/schoolDays.ts';
import {ApiError} from '#src/http/errors.ts';
import {lessonNotFound} from '#src/http/lessonId.ts';

interface Course {
  vehicle: Vehicle;
  instructor: Instructor;
  vehicles: Vehicle[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** The rules for booking, rescheduling and cancelling lessons. */
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

    return toLessonSlots(await this.freeSlots(email, course));
  }

  /** `limit` caps how many lessons the student can ever have, whatever became of them. */
  async book(email: string, request: BookingRequest, limit: number | null = null): Promise<Booking> {
    const course = await this.findCourse(request.vehicleSlug, request.instructorSlug);
    const slot = findSlot(await this.freeSlots(email, course), request.startsAt);
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
        if (limit !== null && existing.length >= limit) {
          throw new ApiError(
            409,
            'demo-limit',
            'You have booked every lesson the demo allows, counting cancelled ones.',
          );
        }

        if (missingPrerequisites(vehicle, completedCourses(vehicles, existing)).length > 0) {
          throw new ApiError(409, 'course-locked', 'Complete the courses this one requires first.');
        }

        const repeat = repeatDue(vehicle, existing);

        if (repeat !== null && hasLessonBooked(vehicle, existing)) {
          throw new ApiError(409, 'repeat-due', `Complete lesson ${repeat} before booking the next one.`);
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

  /** The times the student's lesson can be moved to, with the same or another instructor. */
  async rescheduleSlots(email: string, id: string, instructorSlug: string): Promise<LessonSlot[]> {
    const booking = await this.findChangeable(email, id);
    const course = await this.findCourse(booking.vehicleSlug, instructorSlug);

    return toLessonSlots(await this.freeSlots(email, course, booking));
  }

  /** Moves a lesson, which keeps its old time unless it gets the new one. */
  async reschedule(email: string, id: string, request: RescheduleRequest): Promise<Booking> {
    const booking = await this.findChangeable(email, id);
    const course = await this.findCourse(booking.vehicleSlug, request.instructorSlug);
    const slot = findSlot(await this.freeSlots(email, course, booking), request.startsAt);
    const moved = await this.bookings.reschedule(
      email,
      id,
      {instructorSlug: course.instructor.slug, ...slot},
      // Again, since it may have changed meanwhile.
      (existing) => this.checkChangeable(existing),
    );

    if (!moved) {
      throw slotUnavailable();
    }

    return moved;
  }

  async cancel(email: string, id: string): Promise<Booking> {
    const booking = await this.bookings.cancel(email, id, (existing) => {
      if (!canChange(existing, this.now())) {
        throw new ApiError(
          409,
          'too-late-to-cancel',
          `Lessons can be cancelled until ${CANCELLATION_NOTICE_HOURS} hours before they start.`,
        );
      }
    });

    if (!booking) {
      throw lessonNotFound();
    }

    return booking;
  }

  /** The student's own lesson, if they can still reschedule it. */
  private async findChangeable(email: string, id: string): Promise<Booking> {
    const booking = (await this.bookings.listForStudent(email)).find((own) => own.id === id);

    return this.checkChangeable(booking ?? null);
  }

  private checkChangeable(booking: Booking | null): Booking {
    if (!booking) {
      throw lessonNotFound();
    }

    if (!canChange(booking, this.now())) {
      throw new ApiError(
        409,
        'too-late-to-reschedule',
        `Booked lessons can be rescheduled until ${CANCELLATION_NOTICE_HOURS} hours before they start.`,
      );
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

  /** When rescheduling `moving`, its own time does not count as busy, but keeping it is not offered. */
  private async freeSlots(
    email: string,
    {vehicle, instructor}: Course,
    moving: Booking | null = null,
  ): Promise<Period[]> {
    const from = this.now();
    const until = new Date(from.getTime() + BOOKING_WINDOW_DAYS * DAY_MS);
    const [windows, timeOff, busy] = await Promise.all([
      this.bookings.listAvailability(instructor.slug),
      this.bookings.listTimeOff(instructor.slug, schoolDate(from)),
      this.bookings.listBusy(
        {studentEmail: email, instructorSlug: instructor.slug, vehicleSlug: vehicle.slug},
        from,
        moving?.id ?? null,
      ),
    ]);

    const away = timeOff.map(({startsOn, endsOn}) => daysPeriod(startsOn, endsOn));

    const slots = findSlots({windows, lessonMinutes: vehicle.lessonMinutes, from, until, busy: [...busy, ...away]});

    return moving?.instructorSlug === instructor.slug
      ? slots.filter(({startsAt}) => startsAt.toISOString() !== moving.startsAt)
      : slots;
  }
}

function toLessonSlots(slots: Period[]): LessonSlot[] {
  return slots.map(({startsAt, endsAt}) => ({startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString()}));
}

function findSlot(slots: Period[], startsAt: string): Period {
  const time = new Date(startsAt).getTime();
  const slot = slots.find((free) => free.startsAt.getTime() === time);

  if (!slot) {
    throw slotUnavailable();
  }

  return slot;
}

function slotUnavailable(): ApiError {
  return new ApiError(409, 'slot-unavailable', 'That time is no longer available. Choose another.');
}

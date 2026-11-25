import type {AttendedLesson, CourseCompletion, Vehicle} from '@hde/shared';

import {defineStore} from 'pinia';
import {
  completedCourses,
  courseCompletion,
  hasLessonBooked,
  lessonsCompleted,
  lessonsLeft,
  missingPrerequisites,
  repeatDue,
} from '@hde/shared';
import {useBookingsStore} from '@/stores/bookings';
import {useCatalogStore} from '@/stores/catalog';

/** The signed-in student's progress, and which courses it lets them book. The API enforces the same rules. */
export const useProgressStore = defineStore('progress', {
  getters: {
    /** Slugs of the vehicles whose courses the student has completed. */
    completedSlugs(): string[] {
      return completedCourses(useCatalogStore().vehicles, useBookingsStore().bookings);
    },
    /** The courses still to complete before this one; none means it is unlocked. */
    missingFor(): (vehicle: Vehicle) => string[] {
      return (vehicle) => missingPrerequisites(vehicle, this.completedSlugs);
    },
    /** How a course was completed; null if it is not. */
    completion(): (vehicle: Vehicle) => CourseCompletion | null {
      return (vehicle) => courseCompletion(vehicle, useBookingsStore().bookings);
    },
    /** How many of a course's lessons are completed; null before the first one is attended. */
    lessonsCompleted(): (vehicle: Vehicle) => number | null {
      return (vehicle) => lessonsCompleted(vehicle, useBookingsStore().bookings);
    },
    /** The lesson to repeat before going on, if any. */
    repeatDue(): (vehicle: Vehicle) => number | null {
      return (vehicle) => repeatDue(vehicle, useBookingsStore().bookings);
    },
    /** The student's results in a course, soonest first. */
    resultsIn(): (vehicle: Vehicle) => AttendedLesson[] {
      return ({slug}) => useBookingsStore().results.filter(({vehicleSlug}) => vehicleSlug === slug);
    },
    /** The lesson of a started course the student takes next; null once it is completed. */
    nextLesson(): (vehicle: Vehicle) => number | null {
      return (vehicle) => {
        const completed = this.lessonsCompleted(vehicle);

        return completed === null || completed >= vehicle.lessonsRequired ? null : completed + 1;
      };
    },
    hasLessonBooked(): (vehicle: Vehicle) => boolean {
      return (vehicle) => hasLessonBooked(vehicle, useBookingsStore().bookings);
    },
    /** How many more of a course's lessons can be booked. */
    lessonsLeft(): (vehicle: Vehicle) => number {
      return (vehicle) => lessonsLeft(vehicle, useBookingsStore().bookings);
    },
  },
});

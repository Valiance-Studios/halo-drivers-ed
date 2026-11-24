import type {Vehicle} from '@hde/shared';

import {defineStore} from 'pinia';
import {completedCourses, lessonsLeft, missingPrerequisites} from '@hde/shared';
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
    /** How many more of a course's lessons can be booked. */
    lessonsLeft(): (vehicle: Vehicle) => number {
      return (vehicle) => lessonsLeft(vehicle, useBookingsStore().bookings);
    },
  },
});

import type {Vehicle} from '@hde/shared';

import {defineStore} from 'pinia';
import {missingPrerequisites} from '@hde/shared';

export interface ProgressState {
  /** Slugs of the vehicles whose courses the student has completed. Always empty until the API has bookings. */
  completedSlugs: string[];
}

/** The signed-in student's progress, and which courses it lets them book. */
export const useProgressStore = defineStore('progress', {
  state: (): ProgressState => ({
    completedSlugs: [],
  }),
  getters: {
    /** The courses still to complete before this one; none means it can be booked. */
    missingFor:
      (state) =>
      (vehicle: Vehicle): string[] =>
        missingPrerequisites(vehicle, state.completedSlugs),
  },
});

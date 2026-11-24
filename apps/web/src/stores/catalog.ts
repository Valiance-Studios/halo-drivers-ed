import type {CourseLesson, Faction, Instructor, Vehicle} from '@hde/shared';

import {defineStore} from 'pinia';
import {api} from '@/services/api';

export interface CatalogState {
  vehicles: Vehicle[];
  instructors: Instructor[];
  curriculum: CourseLesson[];
  loading: boolean;
  errorMessage: string | null;
}

/** The course catalog: vehicles and the instructors who teach them. It rarely changes, so it loads once. */
export const useCatalogStore = defineStore('catalog', {
  state: (): CatalogState => ({
    vehicles: [],
    instructors: [],
    curriculum: [],
    loading: false,
    errorMessage: null,
  }),
  getters: {
    vehiclesOf:
      (state) =>
      (faction: Faction): Vehicle[] =>
        state.vehicles.filter((vehicle) => vehicle.faction === faction),
    instructorsOf:
      (state) =>
      (faction: Faction): Instructor[] =>
        state.instructors.filter((instructor) => instructor.faction === faction),
    /** A course's lessons, in order. */
    lessonsOf:
      (state) =>
      (vehicleSlug: string): CourseLesson[] =>
        state.curriculum.filter((lesson) => lesson.vehicleSlug === vehicleSlug),
    vehicleName:
      (state) =>
      (slug: string): string =>
        state.vehicles.find((vehicle) => vehicle.slug === slug)?.name ?? slug,
    instructorName:
      (state) =>
      (slug: string): string =>
        state.instructors.find((instructor) => instructor.slug === slug)?.name ?? slug,
    /** The instructors who teach a vehicle. */
    instructorsFor:
      (state) =>
      (vehicleSlug: string): Instructor[] =>
        state.instructors.filter((instructor) => instructor.vehicles.includes(vehicleSlug)),
  },
  actions: {
    async load(): Promise<void> {
      if (this.loading || this.vehicles.length > 0) {
        return;
      }

      this.loading = true;
      this.errorMessage = null;

      try {
        [this.vehicles, this.instructors, this.curriculum] = await Promise.all([
          api.listVehicles(),
          api.listInstructors(),
          api.listCurriculum(),
        ]);
      } catch (error) {
        this.errorMessage = `Could not load the courses: ${error instanceof Error ? error.message : 'unknown error'}`;
      } finally {
        this.loading = false;
      }
    },
  },
});

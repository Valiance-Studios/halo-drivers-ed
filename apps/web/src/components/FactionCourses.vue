<template>
  <div class="faction-courses">
    <VehicleRoute
      v-if="vehicle"
      :vehicles="vehicles"
      :faction="faction"
      :selected="vehicle.slug"
      @select="select"
    />
    <VehicleDetail
      v-if="vehicle"
      ref="detail"
      :vehicle="vehicle"
      :prerequisite-names="vehicle.prerequisites.map(catalogStore.vehicleName)"
      :instructors="catalogStore.instructorsFor(vehicle.slug)"
      :completed="progressStore.completedSlugs.includes(vehicle.slug)"
      :missing-names="progressStore.missingFor(vehicle).map(catalogStore.vehicleName)"
      :lessons-left="progressStore.lessonsLeft(vehicle)"
      :lessons-completed="progressStore.lessonsCompleted(vehicle)"
      :repeat-lesson="progressStore.repeatDue(vehicle)"
      :has-lesson-booked="progressStore.hasLessonBooked(vehicle)"
      :notice="notice"
      @book="openBooking"
    />
    <BookingDialog
      v-if="vehicle && booking"
      :vehicle="vehicle"
      :instructors="catalogStore.instructorsFor(vehicle.slug)"
      @close="booking = false"
      @saved="onBooked"
    />
    <LessonPlan
      v-if="vehicle"
      :key="vehicle.slug"
      :lessons="catalogStore.lessonsOf(vehicle.slug)"
      :results="progressStore.resultsIn(vehicle)"
      :next-lesson="progressStore.nextLesson(vehicle)"
    />
    <h2 class="faction-courses__heading">Instructors</h2>
    <InstructorList :instructors="catalogStore.instructorsOf(faction)" />
  </div>
</template>

<script lang="ts">
import type {PropType} from 'vue';
import type {Booking, Faction, Vehicle} from '@hde/shared';

import {defineComponent} from 'vue';
import {mapStores} from 'pinia';
import {useCatalogStore} from '@/stores/catalog';
import {useProgressStore} from '@/stores/progress';
import {lessonDayAndTime} from '@/utils/lessonTime';
import BookingDialog from '@/components/BookingDialog.vue';
import InstructorList from '@/components/InstructorList.vue';
import LessonPlan from '@/components/LessonPlan.vue';
import VehicleDetail from '@/components/VehicleDetail.vue';
import VehicleRoute from '@/components/VehicleRoute.vue';

/** One faction's route map, the selected vehicle's course, and the instructors. */
export default defineComponent({
  name: 'FactionCourses',
  components: {BookingDialog, InstructorList, LessonPlan, VehicleDetail, VehicleRoute},
  props: {
    faction: {type: String as PropType<Faction>, required: true},
  },
  data() {
    return {selectedSlug: null as string | null, notice: '', booking: false};
  },
  computed: {
    ...mapStores(useCatalogStore, useProgressStore),
    vehicles(): Vehicle[] {
      return this.catalogStore.vehiclesOf(this.faction);
    },
    /** The selected vehicle, or the first until one is chosen. */
    vehicle(): Vehicle | undefined {
      return this.vehicles.find(({slug}) => slug === this.selectedSlug) ?? this.vehicles[0];
    },
  },
  methods: {
    openBooking() {
      this.notice = '';
      this.booking = true;
    },
    onBooked({instructorSlug, startsAt}: Booking) {
      this.booking = false;
      this.notice = `Booked with ${this.catalogStore.instructorName(instructorSlug)}: ${lessonDayAndTime(startsAt)}.`;
    },
    /** Selects a vehicle and brings its course into view, which is off screen on a phone. */
    async select(slug: string) {
      this.selectedSlug = slug;
      this.notice = '';
      await this.$nextTick();
      const detail = this.$refs.detail as InstanceType<typeof VehicleDetail> | undefined;
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      (detail?.$el as HTMLElement | undefined)?.scrollIntoView({
        block: 'nearest',
        behavior: reduceMotion ? 'auto' : 'smooth',
      });
    },
  },
});
</script>

<style lang="scss" scoped>
.faction-courses {
  padding-top: 1.375rem;

  &__heading {
    margin: 2.75rem 0 1.125rem;
    font-size: 1.6875rem;
  }
}
</style>

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
      :missing-names="progressStore.missingFor(vehicle).map(catalogStore.vehicleName)"
      :notice="notice"
      @book="book"
    />
    <h2 class="faction-courses__heading">Instructors</h2>
    <InstructorList :instructors="catalogStore.instructorsOf(faction)" />
  </div>
</template>

<script lang="ts">
import type {PropType} from 'vue';
import type {Faction, Vehicle} from '@hde/shared';

import {defineComponent} from 'vue';
import {mapStores} from 'pinia';
import {useCatalogStore} from '@/stores/catalog';
import {useProgressStore} from '@/stores/progress';
import InstructorList from '@/components/InstructorList.vue';
import VehicleDetail from '@/components/VehicleDetail.vue';
import VehicleRoute from '@/components/VehicleRoute.vue';

/** One faction's route map, the selected vehicle's course, and the instructors. */
export default defineComponent({
  name: 'FactionCourses',
  components: {InstructorList, VehicleDetail, VehicleRoute},
  props: {
    faction: {type: String as PropType<Faction>, required: true},
  },
  data() {
    return {selectedSlug: null as string | null, notice: ''};
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
    /** Stands in for the booking flow, which is not built yet. */
    book() {
      this.notice = 'Booking is not available yet.';
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

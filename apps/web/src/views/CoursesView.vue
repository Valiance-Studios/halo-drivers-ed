<template>
  <section class="courses">
    <h1 class="courses__heading">
      Courses
    </h1>
    <Message
      v-if="catalogStore.errorMessage"
      severity="error"
    >
      {{ catalogStore.errorMessage }}
    </Message>
    <ProgressSpinner
      v-else-if="catalogStore.loading"
      class="courses__spinner"
      aria-label="Loading courses"
    />
    <Tabs
      v-else
      v-model:value="faction"
    >
      <TabList>
        <Tab
          v-for="option in factions"
          :key="option"
          :value="option"
        >
          {{ factionNames[option] }}
        </Tab>
      </TabList>
      <TabPanels>
        <TabPanel
          v-for="option in factions"
          :key="option"
          :value="option"
        >
          <h2 class="courses__subheading">
            Vehicles
          </h2>
          <div class="courses__grid">
            <VehicleCard
              v-for="vehicle in catalogStore.vehiclesOf(option)"
              :key="vehicle.slug"
              :vehicle="vehicle"
              :prerequisite-names="vehicle.prerequisites.map(catalogStore.vehicleName)"
              :instructors="catalogStore.instructorsFor(vehicle.slug)"
            />
          </div>
          <h2 class="courses__subheading">
            Instructors
          </h2>
          <InstructorList :instructors="catalogStore.instructorsOf(option)" />
        </TabPanel>
      </TabPanels>
    </Tabs>
  </section>
</template>

<script lang="ts">
import type {Faction} from '@hde/shared';

import {defineComponent} from 'vue';
import {mapStores} from 'pinia';
import {FACTION_NAMES, FACTIONS} from '@hde/shared';
import {useCatalogStore} from '@/stores/catalog';
import InstructorList from '@/components/InstructorList.vue';
import VehicleCard from '@/components/VehicleCard.vue';

/** Every course, by faction: the vehicles, what each requires, and the instructors. */
export default defineComponent({
  name: 'CoursesView',
  components: {InstructorList, VehicleCard},
  data() {
    return {
      faction: 'unsc' as Faction,
      factions: FACTIONS,
      factionNames: FACTION_NAMES,
    };
  },
  computed: {
    ...mapStores(useCatalogStore),
  },
  mounted() {
    void this.catalogStore.load();
  },
});
</script>

<style lang="scss" scoped>
.courses {
  &__heading {
    margin-top: 0.5rem;
  }

  &__subheading {
    font-size: 1.125rem;
  }

  &__spinner {
    display: block;
    margin: 3rem auto;
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr));
    gap: 1rem;
  }
}
</style>

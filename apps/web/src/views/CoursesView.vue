<template>
  <section class="courses">
    <h1 class="courses__heading">Courses</h1>
    <p class="courses__lead">Each course opens the next one along its route.</p>
    <Message
      v-if="catalogStore.errorMessage"
      severity="error"
    >
      {{ catalogStore.errorMessage }}
    </Message>
    <Message
      v-else-if="bookingsStore.errorMessage"
      severity="error"
    >
      {{ bookingsStore.errorMessage }}
    </Message>
    <ProgressSpinner
      v-else-if="catalogStore.loading || !bookingsStore.loaded"
      class="courses__spinner"
      aria-label="Loading courses"
    />
    <Tabs
      v-else
      v-model:value="faction"
      lazy
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
          <FactionCourses :faction="option" />
        </TabPanel>
      </TabPanels>
    </Tabs>
  </section>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {mapStores} from 'pinia';
import {FACTION_NAMES, FACTIONS} from '@hde/shared';
import {useBookingsStore} from '@/stores/bookings';
import {useCatalogStore} from '@/stores/catalog';
import {useThemeStore} from '@/stores/theme';
import FactionCourses from '@/components/FactionCourses.vue';

/** Every course, by faction: starts on the theme's faction, then keeps the chosen tab. */
export default defineComponent({
  name: 'CoursesView',
  components: {FactionCourses},
  data() {
    return {
      faction: useThemeStore().faction,
      factions: FACTIONS,
      factionNames: FACTION_NAMES,
    };
  },
  computed: {
    ...mapStores(useBookingsStore, useCatalogStore),
  },
  mounted() {
    void this.catalogStore.load();
    void this.bookingsStore.load();
  },
});
</script>

<style lang="scss" scoped>
.courses {
  &__heading {
    margin: 0.75rem 0 0;
    font-size: clamp(2.375rem, 4vw, 2.875rem);
  }

  &__lead {
    margin: 0.375rem 0 1rem;
    color: var(--app-muted);
  }

  :deep(.p-tab) {
    font-size: 1.0625rem;
  }

  &__spinner {
    display: block;
    margin: 3rem auto;
  }
}
</style>

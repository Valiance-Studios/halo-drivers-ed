<template>
  <section class="lessons">
    <h1 class="lessons__heading">My lessons</h1>
    <Message
      v-if="errorMessage"
      severity="error"
    >
      {{ errorMessage }}
    </Message>
    <ProgressSpinner
      v-if="!ready && !errorMessage"
      class="lessons__spinner"
      aria-label="Loading lessons"
    />
    <template v-else-if="ready">
      <h2 class="lessons__subheading">Upcoming</h2>
      <LessonList
        v-if="upcoming.length > 0"
        :lessons="upcoming"
        :now="now"
        :cancelling-id="cancellingId"
        @cancel="cancel"
      />
      <p v-else>
        You have no lessons booked.
        <RouterLink :to="{name: 'courses'}">Choose a course</RouterLink>
        to book one.
      </p>
      <template v-if="past.length > 0">
        <h2 class="lessons__subheading">Past and cancelled</h2>
        <LessonList
          :lessons="past"
          :now="now"
        />
      </template>
    </template>
  </section>
</template>

<script lang="ts">
import type {Booking} from '@hde/shared';

import {defineComponent} from 'vue';
import {mapStores} from 'pinia';
import {useBookingsStore} from '@/stores/bookings';
import {useCatalogStore} from '@/stores/catalog';
import LessonList from '@/components/LessonList.vue';

/** The student's lessons: what is coming up, and the rest. */
export default defineComponent({
  name: 'LessonsView',
  components: {LessonList},
  data() {
    return {now: new Date(), cancellingId: '', cancelError: ''};
  },
  computed: {
    ...mapStores(useBookingsStore, useCatalogStore),
    ready(): boolean {
      return this.bookingsStore.loaded && !this.catalogStore.loading;
    },
    errorMessage(): string | null {
      return this.cancelError || this.bookingsStore.errorMessage || this.catalogStore.errorMessage;
    },
    upcoming(): Booking[] {
      return this.bookingsStore.bookings.filter((booking) => this.isUpcoming(booking));
    },
    /** Latest first. */
    past(): Booking[] {
      return this.bookingsStore.bookings.filter((booking) => !this.isUpcoming(booking)).reverse();
    },
  },
  mounted() {
    void this.catalogStore.load();
    void this.bookingsStore.load();
  },
  methods: {
    isUpcoming({status, endsAt}: Booking): boolean {
      return status === 'booked' && new Date(endsAt) > this.now;
    },
    async cancel(id: string) {
      this.cancellingId = id;
      this.cancelError = '';

      try {
        await this.bookingsStore.cancel(id);
      } catch (error) {
        this.cancelError = error instanceof Error ? error.message : 'Could not cancel the lesson.';
      } finally {
        this.cancellingId = '';
        this.now = new Date();
      }
    },
  },
});
</script>

<style lang="scss" scoped>
.lessons {
  a {
    color: var(--app-primary);
  }

  &__heading {
    margin: 0.75rem 0 0;
    font-size: clamp(2.375rem, 4vw, 2.875rem);
  }

  &__subheading {
    margin: 1.75rem 0 1rem;
    font-size: 1.6875rem;
  }

  &__spinner {
    display: block;
    margin: 3rem auto;
  }
}
</style>

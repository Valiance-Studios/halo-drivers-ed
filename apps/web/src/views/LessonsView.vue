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
      >
        <template #actions="{lesson}">
          <Button
            v-if="canCancel(lesson, now)"
            label="Cancel lesson"
            severity="secondary"
            outlined
            :loading="cancellingId === lesson.id"
            @click="cancel(lesson.id)"
          />
          <span
            v-else
            class="lessons__muted"
          >
            Too late to cancel
          </span>
        </template>
      </LessonList>
      <p v-else>
        You have no lessons booked.
        <RouterLink :to="{name: 'courses'}">Choose a course</RouterLink>
        to book one.
      </p>
      <template v-if="past.length > 0">
        <h2 class="lessons__subheading">Past and cancelled</h2>
        <LessonList :lessons="past">
          <template #actions="{lesson}">
            <Button
              v-if="lesson.lessonNumber !== null"
              label="See results"
              severity="secondary"
              outlined
              @click="resultsId = lesson.id"
            />
            <span
              v-else-if="lesson.status === 'booked'"
              class="lessons__muted"
            >
              Awaiting the instructor
            </span>
          </template>
        </LessonList>
      </template>
      <LessonResults
        v-if="resultsId"
        :lesson-id="resultsId"
        @close="resultsId = ''"
      />
    </template>
  </section>
</template>

<script lang="ts">
import type {Booking} from '@hde/shared';

import {defineComponent} from 'vue';
import {mapStores} from 'pinia';
import {canCancel} from '@hde/shared';
import {useBookingsStore} from '@/stores/bookings';
import {useCatalogStore} from '@/stores/catalog';
import LessonList from '@/components/LessonList.vue';
import LessonResults from '@/components/LessonResults.vue';

/** The student's lessons: what is coming up, and the rest. */
export default defineComponent({
  name: 'LessonsView',
  components: {LessonList, LessonResults},
  data() {
    return {now: new Date(), cancellingId: '', cancelError: '', resultsId: ''};
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
    canCancel,
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

  &__muted {
    color: var(--app-muted);
  }

  &__spinner {
    display: block;
    margin: 3rem auto;
  }
}
</style>

<template>
  <ul class="lesson-list">
    <li
      v-for="lesson in lessons"
      :key="lesson.id"
      class="lesson-list__item"
    >
      <SubjectArt
        class="lesson-list__art"
        kind="vehicles"
        :slug="lesson.vehicleSlug"
      />
      <div class="lesson-list__text">
        <h3 class="lesson-list__name">
          {{ catalogStore.vehicleName(lesson.vehicleSlug) }}
        </h3>
        <p class="lesson-list__line">
          {{ lessonDayAndTime(lesson.startsAt) }}
        </p>
        <p class="lesson-list__line lesson-list__line--muted">
          With {{ catalogStore.instructorName(lesson.instructorSlug) }}
        </p>
      </div>
      <span class="lesson-list__status">{{ statusNames[lesson.status] }}</span>
      <template v-if="lesson.status === 'booked'">
        <Button
          v-if="canCancel(lesson, now)"
          label="Cancel lesson"
          severity="secondary"
          outlined
          :loading="cancellingId === lesson.id"
          @click="$emit('cancel', lesson.id)"
        />
        <p
          v-else
          class="lesson-list__line lesson-list__line--muted"
        >
          {{ new Date(lesson.startsAt) > now ? 'Too late to cancel' : 'Awaiting the instructor' }}
        </p>
      </template>
    </li>
  </ul>
</template>

<script lang="ts">
import type {PropType} from 'vue';
import type {Booking, BookingStatus} from '@hde/shared';

import {defineComponent} from 'vue';
import {mapStores} from 'pinia';
import {canCancel} from '@hde/shared';
import {useCatalogStore} from '@/stores/catalog';
import {lessonDayAndTime} from '@/utils/lessonTime';
import SubjectArt from '@/components/SubjectArt.vue';

const STATUS_NAMES: Record<BookingStatus, string> = {
  booked: 'Booked',
  completed: 'Completed',
  missed: 'Missed',
  cancelled: 'Cancelled',
};

/** A student's lessons, which they can cancel with enough notice. */
export default defineComponent({
  name: 'LessonList',
  components: {SubjectArt},
  props: {
    lessons: {type: Array as PropType<Booking[]>, required: true},
    now: {type: Date, required: true},
    cancellingId: {type: String, default: ''},
  },
  emits: {
    cancel: (id: string) => id.length > 0,
  },
  data() {
    return {statusNames: STATUS_NAMES};
  },
  computed: {
    ...mapStores(useCatalogStore),
  },
  methods: {canCancel, lessonDayAndTime},
});
</script>

<style lang="scss" scoped>
.lesson-list {
  display: grid;
  gap: 1rem;
  margin: 0;
  padding: 0;
  list-style: none;

  &__item {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem 1.5rem;
    align-items: center;
    padding: 1.125rem 1.5rem;
    background: var(--app-surface);
    border: 2px solid var(--app-line);
    border-radius: var(--app-panel-radius);
  }

  &__art {
    width: 9rem;
    aspect-ratio: 2;
  }

  &__text {
    flex: 1 1 15rem;
  }

  &__name {
    margin: 0;
    font-size: 1.375rem;
  }

  &__line {
    margin: 0;

    &--muted {
      color: var(--app-muted);
    }
  }

  &__status {
    color: var(--app-accent-text);
    font-weight: 700;
  }
}
</style>

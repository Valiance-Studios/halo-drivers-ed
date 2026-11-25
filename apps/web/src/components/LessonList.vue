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
          With {{ catalogStore.instructorName(lesson.instructorSlug)
          }}<template v-if="'studentEmail' in lesson">, for {{ lesson.studentName ?? lesson.studentEmail }}</template>
        </p>
        <p
          v-if="lesson.cancelReason"
          class="lesson-list__line lesson-list__line--reason"
        >
          Reason: {{ lesson.cancelReason }}
        </p>
      </div>
      <span class="lesson-list__status">{{
        lesson.cancelReason ? 'Cancelled by the instructor' : statusNames[lesson.status]
      }}</span>
      <slot
        name="actions"
        :lesson="lesson"
      />
    </li>
  </ul>
</template>

<script lang="ts">
import type {PropType} from 'vue';
import type {AdminLesson, Booking} from '@hde/shared';

import {defineComponent} from 'vue';
import {mapStores} from 'pinia';
import {useCatalogStore} from '@/stores/catalog';
import {STATUS_NAMES} from '@/utils/lessonStatus';
import {lessonDayAndTime} from '@/utils/lessonTime';
import SubjectArt from '@/components/SubjectArt.vue';

/** Lessons, with whatever actions the page gives each one. */
export default defineComponent({
  name: 'LessonList',
  components: {SubjectArt},
  props: {
    lessons: {type: Array as PropType<(Booking | AdminLesson)[]>, required: true},
  },
  data() {
    return {statusNames: STATUS_NAMES};
  },
  computed: {
    ...mapStores(useCatalogStore),
  },
  methods: {lessonDayAndTime},
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

.lesson-list__line--reason {
  white-space: pre-line;
  overflow-wrap: anywhere;
}
</style>

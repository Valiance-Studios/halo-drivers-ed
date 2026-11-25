<template>
  <section class="lesson-history">
    <h2 class="lesson-history__heading">Earlier lessons in this course</h2>
    <p v-if="lessons.length === 0">This is the student's first lesson in the course.</p>
    <details
      v-for="past in lessons"
      :key="past.id"
      class="lesson-history__lesson"
    >
      <summary class="lesson-history__title">
        {{ past.lesson ? `Lesson ${past.lesson.number}: ${past.lesson.title}` : 'Lesson' }}
        <span class="lesson-history__meta">
          {{ statusNames[past.status] }}, {{ lessonDayAndTime(past.startsAt) }}, with
          {{ catalogStore.instructorName(past.instructorSlug) }}
        </span>
      </summary>
      <ul
        v-if="past.lesson"
        class="lesson-history__skills"
      >
        <li
          v-for="skill in past.lesson.skills"
          :key="skill.id"
        >
          {{ skill.label }}: <strong>{{ resultName(past.results[skill.id]) }}</strong>
        </li>
      </ul>
      <p
        v-if="past.notes.student"
        class="lesson-history__note"
      >
        <strong>Note for the student:</strong> {{ past.notes.student }}
      </p>
      <p
        v-if="past.notes.private"
        class="lesson-history__note"
      >
        <strong>Private note:</strong> {{ past.notes.private }}
      </p>
    </details>
  </section>
</template>

<script lang="ts">
import type {PropType} from 'vue';
import type {PastLesson} from '@hde/shared';

import {defineComponent} from 'vue';
import {mapStores} from 'pinia';
import {useCatalogStore} from '@/stores/catalog';
import {STATUS_NAMES} from '@/utils/lessonStatus';
import {lessonDayAndTime} from '@/utils/lessonTime';
import {resultName} from '@/utils/skillResult';

/** For instructors: how the student's earlier lessons in a course went. */
export default defineComponent({
  name: 'LessonHistory',
  props: {
    lessons: {type: Array as PropType<PastLesson[]>, required: true},
  },
  data() {
    return {statusNames: STATUS_NAMES};
  },
  computed: {
    ...mapStores(useCatalogStore),
  },
  methods: {lessonDayAndTime, resultName},
});
</script>

<style lang="scss" scoped>
.lesson-history {
  margin: 2rem 0 1.5rem;

  &__heading {
    margin: 0 0 0.75rem;
    font-size: 1.6875rem;
  }

  &__lesson {
    border-top: 1px solid var(--app-line);

    &:last-child {
      border-bottom: 1px solid var(--app-line);
    }
  }

  &__title {
    padding: 0.75rem 0.25rem;
    cursor: pointer;
    font-weight: 700;

    &:focus-visible {
      outline: 3px solid var(--app-accent);
    }
  }

  &__meta {
    display: block;
    padding-left: 1.125rem;
    color: var(--app-muted);
    font-weight: 400;
  }

  &__skills {
    margin: 0 0 0.75rem;
    padding-left: 2.25rem;
  }

  &__note {
    margin: 0 0 0.75rem;
    padding-left: 1.25rem;
    white-space: pre-line;
    overflow-wrap: anywhere;
  }
}
</style>

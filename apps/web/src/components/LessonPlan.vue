<template>
  <section class="lesson-plan">
    <h2 class="lesson-plan__heading">Lesson plan</h2>
    <details
      v-for="lesson in lessons"
      :key="lesson.number"
      class="lesson-plan__lesson"
    >
      <summary class="lesson-plan__title">Lesson {{ lesson.number }}: {{ lesson.title }}</summary>
      <ul class="lesson-plan__skills">
        <li
          v-for="skill in lesson.skills"
          :key="skill.id"
        >
          {{ skill.label }}
        </li>
      </ul>
    </details>
  </section>
</template>

<script lang="ts">
import type {PropType} from 'vue';
import type {CourseLesson} from '@hde/shared';

import {defineComponent} from 'vue';

/** A course's lessons and the skills marked in each. */
export default defineComponent({
  name: 'LessonPlan',
  props: {
    lessons: {type: Array as PropType<CourseLesson[]>, required: true},
  },
});
</script>

<style lang="scss" scoped>
.lesson-plan {
  &__heading {
    margin: 2.75rem 0 1.125rem;
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

  &__skills {
    margin: 0 0 1rem;
    padding-left: 2.25rem;
  }
}
</style>

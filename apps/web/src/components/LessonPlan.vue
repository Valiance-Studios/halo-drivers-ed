<template>
  <section class="lesson-plan">
    <h2 class="lesson-plan__heading">Lesson plan</h2>
    <details
      v-for="lesson in lessons"
      :key="lesson.number"
      class="lesson-plan__lesson"
    >
      <summary class="lesson-plan__title">
        Lesson {{ lesson.number }}: {{ lesson.title }}
        <span
          v-if="stateOf(lesson)"
          class="lesson-plan__state"
        >
          {{ stateOf(lesson) }}
        </span>
      </summary>
      <ul class="lesson-plan__skills">
        <li
          v-for="skill in lesson.skills"
          :key="skill.id"
        >
          {{ skill.label
          }}<template v-if="attemptAt(lesson)"
            >: <strong>{{ resultName(attemptAt(lesson)?.results[skill.id]) }}</strong></template
          >
        </li>
      </ul>
    </details>
  </section>
</template>

<script lang="ts">
import type {PropType} from 'vue';
import type {AttendedLesson, CourseLesson} from '@hde/shared';

import {defineComponent} from 'vue';
import {STATUS_NAMES} from '@/utils/lessonStatus';
import {resultName} from '@/utils/skillResult';

/** A course's lessons and the skills marked in each, with how the student is doing. */
export default defineComponent({
  name: 'LessonPlan',
  props: {
    lessons: {type: Array as PropType<CourseLesson[]>, required: true},
    /** The student's results in this course, soonest first. */
    results: {type: Array as PropType<AttendedLesson[]>, required: true},
    /** The lesson they take next; null if they have not started the course, or have finished it. */
    nextLesson: {type: Number as PropType<number | null>, default: null},
  },
  methods: {
    resultName,
    /** The latest attempt, which includes the skills passed in earlier ones. */
    attemptAt({number}: CourseLesson): AttendedLesson | undefined {
      return this.results.filter(({lessonNumber}) => lessonNumber === number).at(-1);
    },
    stateOf(lesson: CourseLesson): string {
      const attempt = this.attemptAt(lesson);

      if (attempt) {
        return STATUS_NAMES[attempt.status];
      }

      return lesson.number === this.nextLesson ? 'Next' : '';
    },
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

  &__state {
    margin-left: 0.75rem;
    color: var(--app-muted);
    font-weight: 400;
  }

  &__skills {
    margin: 0 0 1rem;
    padding-left: 2.25rem;
  }
}
</style>

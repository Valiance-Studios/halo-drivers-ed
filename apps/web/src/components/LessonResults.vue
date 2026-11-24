<template>
  <Dialog
    :visible="true"
    :header="form ? `Lesson ${form.lesson.number}: ${form.lesson.title}` : 'Results'"
    modal
    :draggable="false"
    :style="{width: 'min(38rem, calc(100vw - 2rem))'}"
    @update:visible="$emit('close')"
  >
    <Message
      v-if="errorMessage"
      severity="error"
    >
      {{ errorMessage }}
    </Message>
    <ProgressSpinner
      v-else-if="!form"
      aria-label="Loading results"
    />
    <ul
      v-else
      class="lesson-results"
    >
      <li
        v-for="skill in form.lesson.skills"
        :key="skill.id"
        class="lesson-results__skill"
      >
        <span>{{ skill.label }}</span>
        <strong>{{ resultName(form.results[skill.id]) }}</strong>
      </li>
    </ul>
  </Dialog>
</template>

<script lang="ts">
import type {LessonForm, SkillResult} from '@hde/shared';

import {defineComponent} from 'vue';
import {api} from '@/services/api';

/** A student's results in one of their lessons. */
export default defineComponent({
  name: 'LessonResults',
  props: {
    lessonId: {type: String, required: true},
  },
  emits: {
    close: () => true,
  },
  data() {
    return {form: null as LessonForm | null, errorMessage: ''};
  },
  async mounted() {
    try {
      this.form = await api.getResults(this.lessonId);
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Could not load the results.';
    }
  },
  methods: {
    resultName(result: SkillResult | undefined): string {
      if (!result) {
        return 'Not marked';
      }

      return result === 'pass' ? 'Passed' : 'Needs practice';
    },
  },
});
</script>

<style lang="scss" scoped>
.lesson-results {
  margin: 0;
  padding: 0;
  list-style: none;

  &__skill {
    display: flex;
    gap: 1.5rem;
    justify-content: space-between;
    padding: 0.625rem 0;
    border-top: 1px solid var(--app-line);

    strong {
      flex: none;
    }
  }
}
</style>

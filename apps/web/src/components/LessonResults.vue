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
    <template v-else>
      <ul class="lesson-results">
        <li
          v-for="skill in form.lesson.skills"
          :key="skill.id"
          class="lesson-results__skill"
        >
          <span>{{ skill.label }}</span>
          <strong>{{ resultName(form.results[skill.id]) }}</strong>
        </li>
      </ul>
      <p
        v-if="form.studentNote"
        class="lesson-results__note"
      >
        <strong>From your instructor:</strong> {{ form.studentNote }}
      </p>
    </template>
  </Dialog>
</template>

<script lang="ts">
import type {LessonForm} from '@hde/shared';

import {defineComponent} from 'vue';
import {api} from '@/services/api';
import {resultName} from '@/utils/skillResult';

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
  methods: {resultName},
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

.lesson-results__note {
  margin: 1rem 0 0;
  white-space: pre-line;
  overflow-wrap: anywhere;
}
</style>

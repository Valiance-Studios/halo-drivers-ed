<template>
  <section class="lesson-notes">
    <h2 class="lesson-notes__heading">Notes</h2>
    <label
      v-for="field in fields"
      :key="field.key"
      class="lesson-notes__field"
    >
      <span class="lesson-notes__label">{{ field.label }}</span>
      <span class="lesson-notes__hint">{{ field.hint }}</span>
      <textarea
        class="lesson-notes__input"
        rows="3"
        :value="modelValue[field.key]"
        :maxlength="maxLength"
        :disabled="disabled"
        @input="update(field.key, $event)"
      />
    </label>
  </section>
</template>

<script lang="ts">
import type {PropType} from 'vue';
import type {LessonNotes} from '@hde/shared';

import {defineComponent} from 'vue';
import {NOTE_MAX_LENGTH} from '@hde/shared';

const FIELDS: {key: keyof LessonNotes; label: string; hint: string}[] = [
  {key: 'student', label: 'Note for the student', hint: 'They read it with their results once you sign off.'},
  {key: 'private', label: 'Private note', hint: 'Only instructors see it, in this and later lessons.'},
];

/** An instructor's notes on a lesson. */
export default defineComponent({
  name: 'LessonNotes',
  props: {
    modelValue: {type: Object as PropType<LessonNotes>, required: true},
    disabled: {type: Boolean, default: false},
  },
  emits: {
    'update:modelValue': (notes: LessonNotes) => typeof notes.student === 'string',
  },
  data() {
    return {fields: FIELDS, maxLength: NOTE_MAX_LENGTH};
  },
  methods: {
    update(key: keyof LessonNotes, event: Event) {
      this.$emit('update:modelValue', {...this.modelValue, [key]: (event.target as HTMLTextAreaElement).value});
    },
  },
});
</script>

<style lang="scss" scoped>
.lesson-notes {
  margin: 1.5rem 0;

  &__heading {
    margin: 0 0 0.75rem;
    font-size: 1.6875rem;
  }

  &__field {
    display: block;
    margin-bottom: 1rem;
  }

  &__label {
    display: block;
    font-weight: 700;
  }

  &__hint {
    display: block;
    color: var(--app-muted);
  }

  &__input {
    width: 100%;
    margin-top: 0.375rem;
    padding: 0.625rem 0.75rem;
    background: var(--app-surface);
    border: 2px solid var(--app-line);
    border-radius: var(--app-control-radius);
    color: var(--app-text);
    font: inherit;
    resize: vertical;

    &:focus-visible {
      outline: 3px solid var(--app-accent);
    }

    &:disabled {
      opacity: 0.7;
    }
  }
}
</style>

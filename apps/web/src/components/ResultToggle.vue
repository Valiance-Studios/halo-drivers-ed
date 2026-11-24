<template>
  <div
    class="result-toggle"
    role="group"
    :aria-label="`${label}: result`"
  >
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      class="result-toggle__option"
      :class="{[`result-toggle__option--${option.value}`]: modelValue === option.value}"
      :aria-pressed="modelValue === option.value"
      :disabled="disabled"
      @click="$emit('update:modelValue', modelValue === option.value ? null : option.value)"
    >
      <i
        v-if="modelValue === option.value"
        :class="option.icon"
        aria-hidden="true"
      />
      {{ option.name }}
    </button>
  </div>
</template>

<script lang="ts">
import type {PropType} from 'vue';
import type {SkillResult} from '@hde/shared';

import {defineComponent} from 'vue';

const OPTIONS: {value: SkillResult; name: string; icon: string}[] = [
  {value: 'pass', name: 'Pass', icon: 'pi pi-check'},
  {value: 'fail', name: 'Fail', icon: 'pi pi-times'},
];

/** Pass, fail, or not marked yet; choosing the same one again clears it. */
export default defineComponent({
  name: 'ResultToggle',
  props: {
    modelValue: {type: String as PropType<SkillResult | null>, default: null},
    label: {type: String, required: true},
    disabled: {type: Boolean, default: false},
  },
  emits: {
    'update:modelValue': (value: SkillResult | null) => value === null || value === 'pass' || value === 'fail',
  },
  data() {
    return {options: OPTIONS};
  },
});
</script>

<style lang="scss" scoped>
.result-toggle {
  display: inline-flex;
  gap: 0.5rem;

  &__option {
    min-width: 5rem;
    min-height: 2.75rem;
    padding: 0 0.875rem;
    background: var(--app-bg);
    border: 2px solid var(--app-line);
    border-radius: var(--app-control-radius);
    color: var(--app-text);
    cursor: pointer;
    font-size: 1rem;

    &:focus-visible {
      outline: 3px solid var(--app-accent);
      outline-offset: 2px;
    }

    &:disabled {
      cursor: not-allowed;
    }

    &--pass {
      background: #1f6b3a;
      border-color: #1f6b3a;
      color: #fff;
    }

    &--fail {
      background: #a32020;
      border-color: #a32020;
      color: #fff;
    }
  }
}
</style>

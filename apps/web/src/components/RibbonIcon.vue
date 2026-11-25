<template>
  <svg
    class="ribbon-icon"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path
      class="ribbon-icon__tails"
      d="M8 13.5 5.5 22.5 9.4 20.8 11.6 24 13 15zM16 13.5 18.5 22.5 14.6 20.8 12.4 24 11 15z"
    />
    <path
      fill-rule="evenodd"
      d="M12 .5a8 8 0 1 1 0 16 8 8 0 0 1 0-16zM12 4 10.7 7 7.5 7.3 9.9 9.4 9.2 12.5 12 10.9 14.8 12.5 14.1 9.4 16.5 7.3 13.3 7z"
    />
  </svg>
</template>

<script lang="ts">
import {defineComponent} from 'vue';

/** A rosette, for a completed course. Decorative: say what it means in text. */
export default defineComponent({name: 'RibbonIcon'});
</script>

<style lang="scss" scoped>
.ribbon-icon {
  width: 1.25em;
  height: 1.25em;
  fill: currentcolor;
  flex: none;

  &__tails {
    opacity: 0.65;
  }
}
</style>

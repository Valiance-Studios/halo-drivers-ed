<template>
  <svg
    class="faction-emblem"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path :d="path" />
  </svg>
</template>

<script lang="ts">
import type {PropType} from 'vue';
import type {Faction} from '@hde/shared';

import {defineComponent} from 'vue';

/** Original marks, not the official logos: a star over winged chevrons, and three hooked blades. */
const PATHS: Record<Faction, string> = {
  unsc:
    'M12 1.5l1.6 3.4 3.7.4-2.8 2.5.8 3.7-3.3-1.9-3.3 1.9.8-3.7-2.8-2.5 3.7-.4z' +
    'M1.5 8.5L12 17.5 22.5 8.5V12L12 21 1.5 12zM4.5 17L12 23l7.5-6v-2L12 21l-7.5-6z',
  covenant:
    'M12 1.5C6.5 4 4 8.2 4.8 13.2 6.4 9.4 8.6 7.4 12 6.4c3.4 1 5.6 3 7.2 6.8C20 8.2 17.5 4 12 1.5z' +
    'M12 9c-2 2.2-2.6 5-1.6 8L12 22.5 13.6 17c1-3 .4-5.8-1.6-8z' +
    'M3 14.5c.4 3.8 2.6 6.6 6.6 8-2-2.6-3.4-5-3.4-9zM21 14.5c-.4 3.8-2.6 6.6-6.6 8 2-2.6 3.4-5 3.4-9z',
};

export default defineComponent({
  name: 'FactionEmblem',
  props: {
    faction: {type: String as PropType<Faction>, required: true},
  },
  computed: {
    path(): string {
      return PATHS[this.faction];
    },
  },
});
</script>

<style lang="scss" scoped>
.faction-emblem {
  display: block;
  width: 1.75rem;
  height: 1.75rem;
  fill: currentcolor;
}
</style>

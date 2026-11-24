<template>
  <Button
    :aria-label="label"
    :title="label"
    severity="secondary"
    text
    rounded
    @click="themeStore.toggleFaction()"
  >
    <template #icon>
      <FactionEmblem :faction="themeStore.otherFaction" />
    </template>
  </Button>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {mapStores} from 'pinia';
import {FACTION_NAMES} from '@hde/shared';
import {useThemeStore} from '@/stores/theme';
import FactionEmblem from '@/components/FactionEmblem.vue';

/** Switches between the UNSC and Covenant themes and remembers the choice. Shows the one it switches to. */
export default defineComponent({
  name: 'FactionToggle',
  components: {FactionEmblem},
  computed: {
    ...mapStores(useThemeStore),
    label(): string {
      return `Switch to ${FACTION_NAMES[this.themeStore.otherFaction]} theme`;
    },
  },
});
</script>

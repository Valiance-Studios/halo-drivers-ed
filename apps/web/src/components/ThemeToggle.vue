<template>
  <Button
    :icon="themeStore.isDark ? 'pi pi-sun' : 'pi pi-moon'"
    :aria-label="label"
    :title="label"
    severity="secondary"
    text
    rounded
    @click="themeStore.toggle()"
  />
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {mapStores} from 'pinia';
import {useThemeStore} from '@/stores/theme';

/** Switches between the light and dark themes and remembers the choice. */
export default defineComponent({
  name: 'ThemeToggle',
  computed: {
    ...mapStores(useThemeStore),
    label(): string {
      return this.themeStore.isDark ? 'Switch to light mode' : 'Switch to dark mode';
    },
  },
});
</script>

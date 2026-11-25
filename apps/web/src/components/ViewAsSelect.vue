<template>
  <Select
    v-model="viewAsStore.instructorSlug"
    class="view-as-select"
    :options="options"
    option-label="name"
    option-value="slug"
    aria-label="View as"
    placeholder="Everyone"
  />
</template>

<script lang="ts">
import type {ViewAsOption} from '@/stores/viewAs';

import {defineComponent} from 'vue';
import {mapStores} from 'pinia';
import {useCatalogStore} from '@/stores/catalog';
import {useViewAsStore} from '@/stores/viewAs';

/** For signing off: whose schedule to look at. */
export default defineComponent({
  name: 'ViewAsSelect',
  computed: {
    ...mapStores(useCatalogStore, useViewAsStore),
    options(): ViewAsOption[] {
      return [
        {slug: null, name: 'Everyone'},
        ...this.catalogStore.instructors.map(({slug, name}) => ({slug, name: `View as ${name}`})),
      ];
    },
  },
  mounted() {
    void this.catalogStore.load();
  },
});
</script>

<style lang="scss" scoped>
.view-as-select {
  width: 15rem;
  max-width: 100%;
}
</style>

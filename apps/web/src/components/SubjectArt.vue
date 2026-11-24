<template>
  <img
    v-if="url"
    class="subject-art"
    :src="url"
    :alt="alt"
  />
</template>

<script lang="ts">
import type {PropType} from 'vue';
import type {ArtworkKind} from '@/utils/artwork';

import {defineComponent} from 'vue';
import {artworkUrl} from '@/utils/artwork';

/** A vehicle's or instructor's picture, if there is one. Decorative unless given `alt`. */
export default defineComponent({
  name: 'SubjectArt',
  props: {
    kind: {type: String as PropType<ArtworkKind>, required: true},
    slug: {type: String, required: true},
    alt: {type: String, default: ''},
  },
  computed: {
    url(): string | null {
      return artworkUrl(this.kind, this.slug);
    },
  },
});
</script>

<style lang="scss" scoped>
.subject-art {
  display: block;
  background: var(--app-bg);
  border-radius: var(--app-control-radius);
  object-fit: contain;
}
</style>

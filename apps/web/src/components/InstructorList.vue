<template>
  <ul class="instructor-list">
    <li
      v-for="instructor in instructors"
      :key="instructor.slug"
      class="instructor-list__item"
    >
      <SubjectArt
        class="instructor-list__portrait"
        kind="instructors"
        :slug="instructor.slug"
      />
      <div>
        <h3 class="instructor-list__name">
          {{ instructor.name }}
        </h3>
        <p class="instructor-list__title">
          {{ instructor.title }}
        </p>
        <p class="instructor-list__bio">
          {{ instructor.bio }}
        </p>
      </div>
    </li>
  </ul>
</template>

<script lang="ts">
import type {PropType} from 'vue';
import type {Instructor} from '@hde/shared';

import {defineComponent} from 'vue';
import SubjectArt from '@/components/SubjectArt.vue';

/** A faction's instructors, with their pictures, titles and bios. */
export default defineComponent({
  name: 'InstructorList',
  components: {SubjectArt},
  props: {
    instructors: {type: Array as PropType<Instructor[]>, required: true},
  },
});
</script>

<style lang="scss" scoped>
.instructor-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(21rem, 100%), 1fr));
  gap: 1.75rem 2.25rem;
  margin: 0;
  padding: 0;
  list-style: none;

  &__item {
    display: flex;
    gap: 1rem;
    align-items: flex-start;
  }

  &__portrait {
    flex: none;
    width: 7.5rem;
    aspect-ratio: 6 / 7;
    border-radius: var(--app-panel-radius);

    @media (max-width: 52rem) {
      width: 6rem;
    }
  }

  &__name {
    margin: 0;
    font-size: 1.3125rem;
  }

  &__title {
    margin: 0;
    color: var(--app-accent-text);
  }

  &__bio {
    margin: 0.25rem 0 0;
    color: var(--app-muted);
  }
}
</style>

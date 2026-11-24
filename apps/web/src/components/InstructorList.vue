<template>
  <ul class="instructor-list">
    <li
      v-for="instructor in instructors"
      :key="instructor.slug"
      class="instructor-list__item"
    >
      <Avatar
        :label="initials(instructor.name)"
        shape="circle"
        size="large"
      />
      <div>
        <p class="instructor-list__name">
          {{ instructor.name }}
        </p>
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

/** A faction's instructors, with their titles and bios. */
export default defineComponent({
  name: 'InstructorList',
  props: {
    instructors: {type: Array as PropType<Instructor[]>, required: true},
  },
  methods: {
    initials(name: string): string {
      return name
        .replace(/^The /, '')
        .split(/\s+/)
        .map((word) => word[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
    },
  },
});
</script>

<style lang="scss" scoped>
.instructor-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr));
  gap: 1rem;
  margin: 0;
  padding: 0;
  list-style: none;

  &__item {
    display: flex;
    gap: 0.75rem;
    align-items: flex-start;
  }

  &__name {
    margin: 0;
    font-weight: 600;
  }

  &__title {
    margin: 0;
    color: var(--p-primary-color);
    font-size: 0.875rem;
  }

  &__bio {
    margin: 0.25rem 0 0;
    color: var(--p-text-muted-color);
    font-size: 0.875rem;
  }
}
</style>

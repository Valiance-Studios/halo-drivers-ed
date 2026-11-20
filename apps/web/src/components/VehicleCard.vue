<template>
  <Card class="vehicle-card">
    <template #title>
      <div class="vehicle-card__heading">
        <h3 class="vehicle-card__name">
          {{ vehicle.name }}
        </h3>
        <Tag
          :value="vehicle.domain === 'air' ? 'Air' : 'Ground'"
          :icon="vehicle.domain === 'air' ? 'pi pi-send' : 'pi pi-car'"
          severity="secondary"
        />
      </div>
    </template>
    <template #content>
      <p class="vehicle-card__description">
        {{ vehicle.description }}
      </p>
      <dl class="vehicle-card__facts">
        <dt>Course</dt>
        <dd>{{ vehicle.lessonsRequired }} lessons × {{ vehicle.lessonMinutes }} min ({{ totalHours }})</dd>
        <dt>Requires</dt>
        <dd>{{ prerequisiteNames.length > 0 ? prerequisiteNames.join(', ') : 'None' }}</dd>
        <dt>Instructors</dt>
        <dd>{{ instructorNames.join(', ') }}</dd>
      </dl>
    </template>
  </Card>
</template>

<script lang="ts">
import type {PropType} from 'vue';
import type {Instructor, Vehicle} from '@hde/shared';

import {defineComponent} from 'vue';

/** One vehicle's course: what it covers, how long it takes and who teaches it. */
export default defineComponent({
  name: 'VehicleCard',
  props: {
    vehicle: {type: Object as PropType<Vehicle>, required: true},
    prerequisiteNames: {type: Array as PropType<string[]>, required: true},
    instructors: {type: Array as PropType<Instructor[]>, required: true},
  },
  computed: {
    totalHours(): string {
      const hours = (this.vehicle.lessonsRequired * this.vehicle.lessonMinutes) / 60;

      return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} h total`;
    },
    instructorNames(): string[] {
      return this.instructors.map((instructor) => instructor.name);
    },
  },
});
</script>

<style lang="scss" scoped>
.vehicle-card {
  height: 100%;

  &__heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  &__name {
    margin: 0;
    font-size: 1.25rem;
  }

  &__description {
    margin-top: 0;
    color: var(--p-text-muted-color);
  }

  &__facts {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 0.25rem 0.75rem;
    margin: 0;

    dt {
      font-weight: 600;
    }

    dd {
      margin: 0;
    }
  }
}
</style>

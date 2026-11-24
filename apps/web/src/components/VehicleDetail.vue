<template>
  <section
    class="vehicle-detail"
    aria-live="polite"
  >
    <SubjectArt
      class="vehicle-detail__art"
      kind="vehicles"
      :slug="vehicle.slug"
      :alt="vehicle.name"
    />
    <div>
      <h2 class="vehicle-detail__name">
        {{ vehicle.name }}
      </h2>
      <p class="vehicle-detail__description">
        {{ vehicle.description }}
      </p>
      <Button
        class="vehicle-detail__book"
        :label="`Book ${vehicle.name} course`"
        :icon="isLocked ? 'pi pi-lock' : 'pi pi-calendar'"
        :severity="isLocked ? 'secondary' : undefined"
        :disabled="isLocked"
        :aria-describedby="isLocked ? 'vehicle-detail-locked' : undefined"
        @click="$emit('book', vehicle.slug)"
      />
      <p
        v-if="isLocked"
        id="vehicle-detail-locked"
        class="vehicle-detail__locked"
      >
        Complete {{ missingNames.join(' and ') }} first.
      </p>
      <Message
        v-if="notice"
        class="vehicle-detail__notice"
        severity="info"
      >
        {{ notice }}
      </Message>
    </div>
    <dl class="vehicle-detail__facts">
      <dt>Course</dt>
      <dd>{{ vehicle.lessonsRequired }} lessons, {{ vehicle.lessonMinutes }} min each</dd>
      <dt>Total time</dt>
      <dd>{{ totalHours(vehicle) }}</dd>
      <dt>Requires</dt>
      <dd>{{ prerequisiteNames.length > 0 ? prerequisiteNames.join(', ') : 'None' }}</dd>
      <dt>Instructors</dt>
      <dd>{{ instructorNames.join(', ') }}</dd>
    </dl>
  </section>
</template>

<script lang="ts">
import type {PropType} from 'vue';
import type {Instructor, Vehicle} from '@hde/shared';

import {defineComponent} from 'vue';
import {totalHours} from '@/utils/vehicleText';
import SubjectArt from '@/components/SubjectArt.vue';

/** One vehicle's course: what it covers, how long it takes, who teaches it, and booking it. */
export default defineComponent({
  name: 'VehicleDetail',
  components: {SubjectArt},
  props: {
    vehicle: {type: Object as PropType<Vehicle>, required: true},
    prerequisiteNames: {type: Array as PropType<string[]>, required: true},
    instructors: {type: Array as PropType<Instructor[]>, required: true},
    /** The courses still to complete before this one can be booked. */
    missingNames: {type: Array as PropType<string[]>, required: true},
    /** A message about booking, shown under the button. */
    notice: {type: String, default: ''},
  },
  emits: {
    book: (slug: string) => slug.length > 0,
  },
  computed: {
    isLocked(): boolean {
      return this.missingNames.length > 0;
    },
    instructorNames(): string[] {
      return this.instructors.map((instructor) => instructor.name);
    },
  },
  methods: {totalHours},
});
</script>

<style lang="scss" scoped>
.vehicle-detail {
  display: grid;
  grid-template-columns: 18.75rem minmax(0, 1.1fr) minmax(0, 1fr);
  gap: 1.5rem 2.25rem;
  align-items: center;
  margin-top: 1.625rem;
  padding: 1.875rem 2.125rem;
  background: var(--app-surface);
  border: 2px solid var(--app-line);
  border-radius: var(--app-panel-radius);

  // The facts go below the description when three columns would be cramped.
  @media (max-width: 70rem) {
    grid-template-columns: 18.75rem minmax(0, 1fr);
  }

  @media (max-width: 52rem) {
    grid-template-columns: minmax(0, 1fr);
    padding: 1.625rem 1.5rem;
  }

  &__art {
    width: 100%;
    aspect-ratio: 2;
    padding: 0.875rem;
  }

  &__name {
    margin: 0;
    font-size: 2.25rem;
  }

  &__description {
    max-width: 52ch;
    margin: 0.625rem 0 0;
    font-size: 1.1875rem;
  }

  &__book {
    min-height: 2.75rem;
    margin-top: 1.125rem;
    border-radius: var(--app-control-radius);

    &.p-button:disabled {
      background: #8a8a8a;
      border-color: #8a8a8a;
      color: #1c1c1c;
      cursor: not-allowed;
      opacity: 1;
      pointer-events: auto;
    }
  }

  &__locked {
    margin: 0.5rem 0 0;
    color: var(--app-muted);
  }

  &__notice {
    margin-top: 0.75rem;
  }

  &__facts {
    display: grid;
    grid-template-columns: max-content minmax(0, 1fr);
    gap: 0.5rem 1.375rem;
    margin: 0;

    @media (max-width: 70rem) {
      grid-column: 1 / -1;
    }

    dt {
      color: var(--app-muted);
    }

    dd {
      margin: 0;
      font-weight: 700;
    }
  }
}
</style>

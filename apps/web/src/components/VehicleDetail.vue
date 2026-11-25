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
      <p
        v-if="completed"
        class="vehicle-detail__completed"
      >
        <span class="vehicle-detail__status">
          <RibbonIcon />
          Course Completed
        </span>
        <RouterLink :to="{name: 'certificate', params: {vehicleSlug: vehicle.slug}}">View Certificate</RouterLink>
      </p>
      <Button
        v-else
        class="vehicle-detail__book"
        :label="bookLabel"
        :icon="isLocked ? 'pi pi-lock' : 'pi pi-calendar'"
        :severity="reason ? 'secondary' : undefined"
        :disabled="Boolean(reason)"
        :aria-describedby="reason ? 'vehicle-detail-reason' : undefined"
        @click="$emit('book', vehicle.slug)"
      />
      <p
        v-if="reason"
        id="vehicle-detail-reason"
        class="vehicle-detail__reason"
      >
        {{ reason }}
      </p>
      <p
        v-else-if="repeatLesson !== null"
        class="vehicle-detail__reason"
      >
        Lesson {{ repeatLesson }} needs repeating before you go on to the next one.
      </p>
      <Message
        v-if="notice"
        class="vehicle-detail__notice"
        severity="success"
      >
        {{ notice }}
      </Message>
    </div>
    <dl class="vehicle-detail__facts">
      <dt>Course</dt>
      <dd>{{ vehicle.lessonsRequired }} lessons, {{ vehicle.lessonMinutes }} min each</dd>
      <template v-if="progress">
        <dt>Completed</dt>
        <dd>{{ progress }}</dd>
      </template>
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
import {progressText, totalHours} from '@/utils/vehicleText';
import RibbonIcon from '@/components/RibbonIcon.vue';
import SubjectArt from '@/components/SubjectArt.vue';

/** One vehicle's course: what it covers, how long it takes, who teaches it, and booking it. */
export default defineComponent({
  name: 'VehicleDetail',
  components: {RibbonIcon, SubjectArt},
  props: {
    vehicle: {type: Object as PropType<Vehicle>, required: true},
    prerequisiteNames: {type: Array as PropType<string[]>, required: true},
    instructors: {type: Array as PropType<Instructor[]>, required: true},
    /** Whether every lesson of the course is completed. */
    completed: {type: Boolean, required: true},
    /** The courses still to complete before this one can be booked. */
    missingNames: {type: Array as PropType<string[]>, required: true},
    /** How many more of the course's lessons can be booked. */
    lessonsLeft: {type: Number, required: true},
    /** How many of the course's lessons are completed; null before the student starts it. */
    lessonsCompleted: {type: Number as PropType<number | null>, default: null},
    /** The lesson to repeat before going on, if any. */
    repeatLesson: {type: Number as PropType<number | null>, default: null},
    /** Whether a lesson of the course is already booked. */
    hasLessonBooked: {type: Boolean, required: true},
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
    bookLabel(): string {
      return this.repeatLesson !== null && !this.reason
        ? `Repeat ${this.vehicle.name} lesson ${this.repeatLesson}`
        : `Book ${this.vehicle.name} lesson`;
    },
    progress(): string {
      return progressText(this.vehicle, this.lessonsCompleted);
    },
    /** Why the course cannot be booked, or nothing if it can. */
    reason(): string {
      if (this.completed) {
        return '';
      }

      if (this.isLocked) {
        return `Complete ${this.missingNames.join(' and ')} first.`;
      }

      if (this.repeatLesson !== null && this.hasLessonBooked) {
        return `Lesson ${this.repeatLesson} needs repeating and is booked. You can book the next one once it is completed.`;
      }

      return this.lessonsLeft === 0 ? 'You have booked every lesson in this course.' : '';
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

  &__completed {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1.5rem;
    align-items: center;
    margin: 1.125rem 0 0;

    a {
      color: var(--app-primary);
    }
  }

  &__status {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    color: var(--app-accent-text);
    font-weight: 700;
  }

  &__reason {
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

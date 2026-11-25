<template>
  <Dialog
    :visible="true"
    :header="header"
    modal
    :draggable="false"
    class="booking-dialog"
    :style="{width: 'min(34rem, calc(100vw - 2rem))'}"
    @update:visible="$emit('close')"
  >
    <p
      v-if="lesson"
      class="booking-dialog__note"
    >
      Now {{ lessonDayAndTime(lesson.startsAt) }}. It keeps this time until you choose another.
    </p>
    <label
      class="booking-dialog__label"
      for="booking-instructor"
    >
      Instructor
    </label>
    <Select
      v-model="instructorSlug"
      class="booking-dialog__select"
      input-id="booking-instructor"
      :options="instructors"
      option-label="name"
      option-value="slug"
      @change="loadSlots"
    />
    <p class="booking-dialog__note">
      {{ vehicle.lessonMinutes }} minutes. Times are in your time zone ({{ timeZoneName() }}).
    </p>
    <Message
      v-if="errorMessage"
      severity="error"
    >
      {{ errorMessage }}
    </Message>
    <ProgressSpinner
      v-if="loading"
      class="booking-dialog__spinner"
      aria-label="Loading times"
    />
    <template v-else-if="days.length > 0">
      <label
        class="booking-dialog__label"
        for="booking-day"
      >
        Day
      </label>
      <Select
        v-model="day"
        class="booking-dialog__select"
        input-id="booking-day"
        :options="days"
        @change="startsAt = null"
      />
      <div
        class="booking-dialog__times"
        role="group"
        aria-label="Time"
      >
        <Button
          v-for="slot in daySlots"
          :key="slot.startsAt"
          :label="lessonTime(slot.startsAt)"
          :outlined="slot.startsAt !== startsAt"
          :aria-pressed="slot.startsAt === startsAt"
          @click="startsAt = slot.startsAt"
        />
      </div>
      <p
        v-if="isFinal"
        class="booking-dialog__note"
      >
        This lesson starts within {{ noticeHours }} hours, so it cannot be cancelled or rescheduled.
      </p>
    </template>
    <p v-else-if="!errorMessage">
      {{ instructorName }} has no free times in the next {{ windowDays }} days. Try another instructor or check back
      later.
    </p>
    <template #footer>
      <Button
        label="Close"
        severity="secondary"
        text
        @click="$emit('close')"
      />
      <Button
        :label="lesson ? 'Reschedule lesson' : 'Book lesson'"
        :disabled="!startsAt"
        :loading="saving"
        @click="save"
      />
    </template>
  </Dialog>
</template>

<script lang="ts">
import type {PropType} from 'vue';
import type {Booking, Instructor, LessonSlot, Vehicle} from '@hde/shared';

import {defineComponent} from 'vue';
import {mapStores} from 'pinia';
import {BOOKING_WINDOW_DAYS, CANCELLATION_NOTICE_HOURS, hasCancellationNotice} from '@hde/shared';
import {api} from '@/services/api';
import {useBookingsStore} from '@/stores/bookings';
import {lessonDay, lessonDayAndTime, lessonTime, timeZoneName} from '@/utils/lessonTime';

/** Books one lesson, or reschedules one: an instructor, a day and a time. */
export default defineComponent({
  name: 'BookingDialog',
  props: {
    vehicle: {type: Object as PropType<Vehicle>, required: true},
    instructors: {type: Array as PropType<Instructor[]>, required: true},
    /** The lesson to reschedule; null books a new one. */
    lesson: {type: Object as PropType<Booking | null>, default: null},
  },
  emits: {
    close: () => true,
    saved: (booking: Booking) => booking.id.length > 0,
  },
  data() {
    return {
      instructorSlug: this.lesson?.instructorSlug ?? this.instructors[0]?.slug ?? '',
      slots: [] as LessonSlot[],
      day: null as string | null,
      startsAt: null as string | null,
      loading: false,
      saving: false,
      errorMessage: '',
      windowDays: BOOKING_WINDOW_DAYS,
      noticeHours: CANCELLATION_NOTICE_HOURS,
    };
  },
  computed: {
    ...mapStores(useBookingsStore),
    header(): string {
      return this.lesson ? `Reschedule your ${this.vehicle.name} lesson` : `Book a ${this.vehicle.name} lesson`;
    },
    instructorName(): string {
      return this.instructors.find(({slug}) => slug === this.instructorSlug)?.name ?? '';
    },
    /** Whether the chosen time is too soon to cancel or reschedule. */
    isFinal(): boolean {
      return this.startsAt !== null && !hasCancellationNotice(this.startsAt, new Date());
    },
    days(): string[] {
      return [...new Set(this.slots.map((slot) => lessonDay(slot.startsAt)))];
    },
    daySlots(): LessonSlot[] {
      return this.slots.filter((slot) => lessonDay(slot.startsAt) === this.day);
    },
  },
  mounted() {
    void this.loadSlots();
  },
  methods: {
    lessonDayAndTime,
    lessonTime,
    timeZoneName,
    async loadSlots() {
      this.errorMessage = '';
      await this.refreshSlots();
    },
    /** Loads the times without clearing an error, so it can be shown beside the new times. */
    async refreshSlots() {
      const instructorSlug = this.instructorSlug;
      this.loading = true;
      this.startsAt = null;
      this.slots = [];

      try {
        const slots = await (this.lesson
          ? api.listRescheduleSlots(this.lesson.id, instructorSlug)
          : api.listSlots(this.vehicle.slug, instructorSlug));

        // Another instructor may have been chosen meanwhile.
        if (instructorSlug === this.instructorSlug) {
          this.slots = slots;
          this.day = this.days[0] ?? null;
          this.loading = false;
        }
      } catch (error) {
        if (instructorSlug === this.instructorSlug) {
          this.errorMessage = error instanceof Error ? error.message : 'Could not load the times.';
          this.loading = false;
        }
      }
    },
    async save() {
      if (!this.startsAt) {
        return;
      }

      this.saving = true;
      this.errorMessage = '';

      try {
        const time = {instructorSlug: this.instructorSlug, startsAt: this.startsAt};
        const booking = await (this.lesson
          ? this.bookingsStore.reschedule(this.lesson.id, time)
          : this.bookingsStore.book({vehicleSlug: this.vehicle.slug, ...time}));
        this.$emit('saved', booking);
      } catch (error) {
        this.errorMessage = error instanceof Error ? error.message : 'Could not save the lesson.';
        await this.refreshSlots();
      } finally {
        this.saving = false;
      }
    },
  },
});
</script>

<style lang="scss" scoped>
.booking-dialog {
  &__label {
    display: block;
    margin: 0.75rem 0 0.25rem;
    font-weight: 700;
  }

  &__select {
    width: 100%;
  }

  &__note {
    margin: 0.5rem 0 0.75rem;
    color: var(--app-muted);
  }

  &__spinner {
    display: block;
    margin: 1.5rem auto;
  }

  &__times {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(6.5rem, 1fr));
    gap: 0.5rem;
    margin-top: 1rem;

    .p-button {
      min-height: 2.75rem;
    }
  }
}
</style>

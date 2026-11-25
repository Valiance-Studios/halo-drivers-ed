<template>
  <section class="time-off">
    <h2 class="time-off__heading">Time off for {{ catalogStore.instructorName(instructorSlug) }}</h2>
    <Message
      v-if="errorMessage"
      severity="error"
    >
      {{ errorMessage }}
    </Message>
    <ul
      v-if="timeOff.length > 0"
      class="time-off__list"
    >
      <li
        v-for="item in timeOff"
        :key="item.id"
        class="time-off__item"
      >
        <span>{{ daysText(item) }}</span>
        <Button
          label="Remove"
          severity="secondary"
          outlined
          :aria-label="`Remove ${daysText(item)}`"
          :disabled="saving"
          @click="remove(item.id)"
        />
      </li>
    </ul>
    <p v-else>None planned.</p>
    <form
      class="time-off__form"
      @submit.prevent="add(null)"
    >
      <label class="time-off__field">
        First day
        <input
          v-model="startsOn"
          class="time-off__input"
          type="date"
          required
          @change="conflicts = []"
        />
      </label>
      <label class="time-off__field">
        Last day
        <input
          v-model="endsOn"
          class="time-off__input"
          type="date"
          required
          :min="startsOn"
          @change="conflicts = []"
        />
      </label>
      <Button
        type="submit"
        label="Add time off"
        :loading="saving && conflicts.length === 0"
        :disabled="conflicts.length > 0"
      />
    </form>
    <p class="time-off__note">Whole days, in the school's time zone (Eastern).</p>
    <form
      v-if="conflicts.length > 0"
      class="time-off__conflicts"
      @submit.prevent="cancelAndAdd"
    >
      <p role="alert">
        <strong>Not added yet.</strong> These lessons are booked in that time. Cancel them to add it, or choose other
        days.
      </p>
      <LessonList :lessons="conflicts" />
      <label
        class="time-off__label"
        for="time-off-reason"
      >
        Reason for cancelling. The students see this.
      </label>
      <textarea
        id="time-off-reason"
        v-model="reason"
        class="time-off__input time-off__input--wide"
        rows="2"
        :maxlength="reasonMaxLength"
      />
      <div class="time-off__actions">
        <Button
          type="submit"
          :label="`Cancel ${conflicts.length === 1 ? 'this lesson' : `these ${conflicts.length} lessons`} and add time off`"
          severity="danger"
          :disabled="!reason.trim()"
          :loading="saving"
        />
        <Button
          label="Keep them"
          severity="secondary"
          text
          :disabled="saving"
          @click="conflicts = []"
        />
      </div>
    </form>
  </section>
</template>

<script lang="ts">
import type {AdminLesson, TimeOff, TimeOffRequest} from '@hde/shared';

import {defineComponent} from 'vue';
import {mapStores} from 'pinia';
import {REASON_MAX_LENGTH} from '@hde/shared';
import {api} from '@/services/api';
import {useCatalogStore} from '@/stores/catalog';
import {daysText} from '@/utils/lessonTime';
import LessonList from '@/components/LessonList.vue';

/** For admins: the days an instructor is away. Give it a key, so that each instructor has their own. */
export default defineComponent({
  name: 'TimeOffPanel',
  components: {LessonList},
  props: {
    instructorSlug: {type: String, required: true},
  },
  emits: {
    /** Lessons were cancelled. */
    cancelled: () => true,
  },
  data() {
    return {
      timeOff: [] as TimeOff[],
      startsOn: '',
      endsOn: '',
      /** Lessons booked in the chosen days, which have to be cancelled first. */
      conflicts: [] as AdminLesson[],
      reason: '',
      reasonMaxLength: REASON_MAX_LENGTH,
      saving: false,
      errorMessage: '',
    };
  },
  computed: {
    ...mapStores(useCatalogStore),
  },
  async mounted() {
    await this.run(this.load);
  },
  methods: {
    daysText,
    async load() {
      this.timeOff = await api.listTimeOff(this.instructorSlug);
    },
    async run(action: () => Promise<void>) {
      this.saving = true;
      this.errorMessage = '';

      try {
        await action();
      } catch (error) {
        this.errorMessage = error instanceof Error ? error.message : 'Something went wrong.';
      } finally {
        this.saving = false;
      }
    },
    async add(cancel: TimeOffRequest['cancel']) {
      await this.run(async () => {
        const {startsOn, endsOn} = this;
        const answer = await api.addTimeOff(this.instructorSlug, {startsOn, endsOn, cancel});

        if (!answer.saved) {
          this.conflicts = answer.lessons;

          return;
        }

        this.conflicts = [];
        this.startsOn = '';
        this.endsOn = '';
        this.reason = '';

        if (cancel) {
          this.$emit('cancelled');
        }

        await this.load();
      });
    },
    async cancelAndAdd() {
      await this.add({lessonIds: this.conflicts.map(({id}) => id), reason: this.reason});
    },
    async remove(id: string) {
      await this.run(async () => {
        await api.removeTimeOff(id);
        await this.load();
      });
    },
  },
});
</script>

<style lang="scss" scoped>
.time-off {
  margin-top: 1.75rem;
  padding: 1.25rem 1.75rem;
  background: var(--app-surface);
  border: 2px solid var(--app-line);
  border-radius: var(--app-panel-radius);

  &__heading {
    margin: 0 0 0.75rem;
    font-size: 1.6875rem;
  }

  &__list {
    margin: 0 0 1rem;
    padding: 0;
    list-style: none;
  }

  &__item {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1rem;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0;
    border-bottom: 1px solid var(--app-line);
  }

  &__form,
  &__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    align-items: flex-end;
  }

  &__actions {
    margin-top: 0.75rem;
  }

  &__field {
    font-weight: 700;
  }

  &__label {
    display: block;
    margin-top: 1rem;
    font-weight: 700;
  }

  &__input {
    display: block;
    min-height: 2.75rem;
    margin-top: 0.25rem;
    padding: 0.5rem 0.75rem;
    background: var(--app-bg);
    border: 2px solid var(--app-line);
    border-radius: var(--app-control-radius);
    color: var(--app-text);
    font: inherit;

    &--wide {
      width: 100%;
    }
  }

  &__note {
    margin: 0.5rem 0 0;
    color: var(--app-muted);
  }

  &__conflicts {
    margin-top: 1rem;
  }
}
</style>

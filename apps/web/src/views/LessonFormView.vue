<template>
  <section class="lesson-form">
    <RouterLink
      class="lesson-form__back"
      :to="{name: 'schedule'}"
    >
      Back to the schedule
    </RouterLink>
    <Message
      v-if="errorMessage"
      severity="error"
    >
      {{ errorMessage }}
    </Message>
    <ProgressSpinner
      v-if="loading"
      class="lesson-form__spinner"
      aria-label="Loading the form"
    />
    <template v-else-if="form && lesson">
      <h1 class="lesson-form__heading">
        {{ catalogStore.vehicleName(lesson.vehicleSlug) }}, lesson {{ form.lesson.number }}: {{ form.lesson.title }}
      </h1>
      <p class="lesson-form__line">
        <strong>{{ lesson.studentName ?? lesson.studentEmail }}</strong>
        <template v-if="lesson.studentName"> ({{ lesson.studentEmail }})</template>
        with {{ catalogStore.instructorName(lesson.instructorSlug) }},
        {{ lessonDayAndTime(lesson.startsAt) }}
      </p>
      <p class="lesson-form__line">
        <strong>{{ statusNames[lesson.status] }}</strong>
        <template v-if="isSignedOff">. To correct it, change the form and sign it off again.</template>
      </p>
      <label
        v-if="!hasEnded"
        class="lesson-form__early"
      >
        <input
          v-model="early"
          type="checkbox"
          :disabled="saving || !isSaved"
        />
        Mark and sign off early, before the lesson has finished
      </label>
      <ul class="lesson-form__skills">
        <li
          v-for="skill in form.lesson.skills"
          :key="skill.id"
          class="lesson-form__skill"
        >
          <span>
            {{ skill.label }}
            <span
              v-if="form.passedBefore.includes(skill.id)"
              class="lesson-form__note"
            >
              Passed in an earlier lesson
            </span>
          </span>
          <ResultToggle
            :model-value="results[skill.id] ?? null"
            :label="skill.label"
            :disabled="saving || !canMark || form.passedBefore.includes(skill.id)"
            @update:model-value="mark(skill.id, $event)"
          />
          <p
            v-if="markStates[skill.id] === 'failed'"
            class="lesson-form__failed"
            role="alert"
          >
            <span>Not saved</span>
            <Button
              label="Retry"
              severity="secondary"
              outlined
              :aria-label="`Retry saving ${skill.label}`"
              @click="retry(skill.id)"
            />
          </p>
        </li>
      </ul>
      <p
        class="lesson-form__line lesson-form__note"
        role="status"
      >
        {{ saveStatus }}
      </p>
      <p class="lesson-form__line">
        {{ summary }}
      </p>
      <div class="lesson-form__actions">
        <Button
          label="Sign off lesson"
          :disabled="!canSignOff || !isMarked || !isSaved"
          :loading="saving"
          @click="signOff('attended')"
        />
        <Button
          label="Student missed it"
          severity="secondary"
          outlined
          :disabled="!canSignOff || !isSaved || saving"
          @click="signOff('missed')"
        />
      </div>
      <Message
        v-if="notice"
        severity="success"
      >
        {{ notice }}
      </Message>
    </template>
  </section>
</template>

<script lang="ts">
import type {AdminLesson, Attendance, LessonForm, SkillResult, SkillResults} from '@hde/shared';
import type {MarkState} from '@/utils/markSaver';

import {defineComponent, markRaw} from 'vue';
import {mapStores} from 'pinia';
import {allMarked, allPassed} from '@hde/shared';
import {api} from '@/services/api';
import {useAuthStore} from '@/stores/auth';
import {useCatalogStore} from '@/stores/catalog';
import {STATUS_NAMES} from '@/utils/lessonStatus';
import {lessonDayAndTime} from '@/utils/lessonTime';
import {MarkSaver} from '@/utils/markSaver';
import ResultToggle from '@/components/ResultToggle.vue';

/** How often to check whether the lesson has started or ended. */
const CLOCK_MS = 15_000;
const UNSAVED_MESSAGE = 'Some marks are not saved. Leave and lose them?';

/**
 * An instructor's form for one lesson. Each mark saves as it is made, until the lesson is signed off; corrections
 * after that are only saved by signing it off again.
 */
export default defineComponent({
  name: 'LessonFormView',
  components: {ResultToggle},
  async beforeRouteLeave(): Promise<boolean> {
    await this.saver?.settled();

    // A signed-out account can no longer save, so there is nothing to stay for.
    return this.isSaved || !this.authStore.isAllowed || window.confirm(UNSAVED_MESSAGE);
  },
  props: {
    id: {type: String, required: true},
  },
  data() {
    return {
      lesson: null as AdminLesson | null,
      form: null as LessonForm | null,
      results: {} as SkillResults,
      markStates: {} as Record<string, MarkState>,
      saver: null as MarkSaver | null,
      clock: undefined as number | undefined,
      loading: true,
      saving: false,
      errorMessage: '',
      notice: '',
      hasMarked: false,
      /** Overrides waiting for the lesson to start and end. */
      early: false,
      now: new Date(),
      statusNames: STATUS_NAMES,
    };
  },
  computed: {
    ...mapStores(useAuthStore, useCatalogStore),
    isSignedOff(): boolean {
      return this.lesson !== null && this.lesson.status !== 'booked';
    },
    hasStarted(): boolean {
      return this.lesson !== null && new Date(this.lesson.startsAt) <= this.now;
    },
    canMark(): boolean {
      return this.hasStarted || this.early;
    },
    canSignOff(): boolean {
      return this.hasEnded || this.early;
    },
    isSaved(): boolean {
      return Object.keys(this.markStates).length === 0;
    },
    saveStatus(): string {
      const states = Object.values(this.markStates);

      if (states.includes('failed')) {
        return 'Some marks are not saved.';
      }

      if (states.includes('saving')) {
        return 'Saving…';
      }

      return this.hasMarked ? 'All changes saved.' : '';
    },
    hasEnded(): boolean {
      return this.lesson !== null && new Date(this.lesson.endsAt) <= this.now;
    },
    isMarked(): boolean {
      return this.form !== null && allMarked(this.form.lesson, this.results);
    },
    /** What signing the lesson off would do, or what it still needs. */
    summary(): string {
      if (!this.form) {
        return '';
      }

      if (!this.canMark) {
        return 'Skills can be marked once the lesson starts, and it can be signed off once it ends.';
      }

      if (!this.canSignOff) {
        return 'The lesson can be signed off once it ends.';
      }

      if (!this.isMarked) {
        const left = this.form.lesson.skills.filter(({id}) => !this.results[id]).length;

        return `${left} of ${this.form.lesson.skills.length} skills left to mark.`;
      }

      return allPassed(this.form.lesson, this.results)
        ? 'Every skill is passed, so signing off completes the lesson.'
        : 'Some skills are not passed, so signing off means the student repeats the lesson.';
    },
  },
  created() {
    const save = (skillId: string, result: SkillResult | null) =>
      api.markSkill(this.id, skillId, {result, early: this.early});
    this.saver = markRaw(new MarkSaver(save, (skillId, state) => this.setMarkState(skillId, state)));
  },
  mounted() {
    void this.catalogStore.load();
    void this.load();
    this.clock = window.setInterval(() => {
      this.now = new Date();
    }, CLOCK_MS);
    window.addEventListener('beforeunload', this.warnBeforeUnload);
  },
  beforeUnmount() {
    window.clearInterval(this.clock);
    window.removeEventListener('beforeunload', this.warnBeforeUnload);
  },
  methods: {
    lessonDayAndTime,
    async load() {
      this.loading = true;

      try {
        await this.refresh();
      } catch (error) {
        this.errorMessage = error instanceof Error ? error.message : 'Could not load the form.';
      } finally {
        this.loading = false;
      }
    },
    async refresh() {
      [this.lesson, this.form] = await Promise.all([api.getLesson(this.id), api.getLessonForm(this.id)]);
      this.results = {...this.form.results};
      this.now = new Date();
    },
    mark(skillId: string, result: SkillResult | null) {
      const {[skillId]: _previous, ...others} = this.results;
      this.results = result ? {...others, [skillId]: result} : others;
      this.notice = '';

      if (!this.isSignedOff) {
        this.hasMarked = true;
        this.saver?.mark(skillId, result);
      }
    },
    retry(skillId: string) {
      this.saver?.mark(skillId, this.results[skillId] ?? null);
    },
    setMarkState(skillId: string, state: MarkState | null) {
      const {[skillId]: _previous, ...others} = this.markStates;
      this.markStates = state ? {...others, [skillId]: state} : others;
    },
    warnBeforeUnload(event: BeforeUnloadEvent) {
      if (!this.isSaved) {
        event.preventDefault();
      }
    },
    async signOff(attendance: Attendance) {
      this.saving = true;
      this.errorMessage = '';
      this.notice = '';

      try {
        const {status} = await api.signOffLesson(this.id, {results: this.results, attendance, early: this.early});
        await this.refresh();
        this.hasMarked = false;
        this.notice = `Signed off: ${STATUS_NAMES[status].toLowerCase()}.`;
      } catch (error) {
        this.errorMessage = error instanceof Error ? error.message : 'Could not sign the lesson off.';
      } finally {
        this.saving = false;
      }
    },
  },
});
</script>

<style lang="scss" scoped>
.lesson-form {
  &__back {
    display: inline-block;
    margin: 0.75rem 0;
    color: var(--app-primary);
  }

  &__heading {
    margin: 0 0 0.75rem;
    font-size: clamp(1.875rem, 4vw, 2.5rem);
  }

  &__line {
    margin: 0.25rem 0;
  }

  &__skills {
    margin: 1.5rem 0;
    padding: 0.5rem 1.75rem;
    background: var(--app-surface);
    border: 2px solid var(--app-line);
    border-radius: var(--app-panel-radius);
    list-style: none;
  }

  &__skill {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1.5rem;
    align-items: center;
    justify-content: space-between;
    padding: 0.875rem 0;

    & + & {
      border-top: 1px solid var(--app-line);
    }

    > span {
      flex: 1 1 18rem;
    }
  }

  &__early {
    display: inline-flex;
    gap: 0.625rem;
    align-items: center;
    min-height: 2.75rem;
    cursor: pointer;

    input {
      width: 1.25rem;
      height: 1.25rem;
      accent-color: var(--app-primary);
    }
  }

  &__note {
    display: block;
    color: var(--app-muted);
  }

  &__failed {
    display: flex;
    flex-basis: 100%;
    gap: 0.75rem;
    align-items: center;
    justify-content: flex-end;
    margin: 0;
    font-weight: 700;
  }

  &__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin: 1rem 0;
  }

  &__spinner {
    display: block;
    margin: 3rem auto;
  }
}
</style>

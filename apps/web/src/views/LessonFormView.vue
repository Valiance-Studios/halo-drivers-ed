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
        <template v-if="lesson.studentName && !isGuest"> ({{ lesson.studentEmail }})</template>
        with {{ catalogStore.instructorName(lesson.instructorSlug) }},
        {{ lessonDayAndTime(lesson.startsAt) }}
      </p>
      <p class="lesson-form__line">
        <strong>{{ statusNames[lesson.status] }}</strong>
        <template v-if="lesson.cancelReason"> by the instructor: {{ lesson.cancelReason }}</template>
        <template v-else-if="isSignedOff">. To correct it, change the form and sign it off again.</template>
      </p>
      <label
        v-if="!hasEnded && !isCancelled"
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
      <LessonNotes
        :model-value="notes"
        :disabled="saving || !canMark"
        @update:model-value="editNotes"
      />
      <p
        v-if="markStates[notesKey] === 'failed'"
        class="lesson-form__failed"
        role="alert"
      >
        <span>Notes not saved</span>
        <Button
          label="Retry"
          severity="secondary"
          outlined
          aria-label="Retry saving the notes"
          @click="saveNotes"
        />
      </p>
      <p
        class="lesson-form__line lesson-form__note"
        role="status"
      >
        {{ saveStatus }}
      </p>
      <p class="lesson-form__line">
        {{ summary }}
      </p>
      <div
        v-if="!isCancelled"
        class="lesson-form__actions"
      >
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
        <Button
          v-if="!isSignedOff && !cancelling"
          label="Cancel lesson"
          severity="danger"
          outlined
          :disabled="!isSaved || saving"
          @click="cancelling = true"
        />
      </div>
      <form
        v-if="cancelling"
        class="lesson-form__cancel"
        @submit.prevent="cancel"
      >
        <label
          class="lesson-form__label"
          for="lesson-form-reason"
        >
          Why is the instructor cancelling it? The student sees this.
        </label>
        <textarea
          id="lesson-form-reason"
          v-model="reason"
          class="lesson-form__reason"
          rows="2"
          :maxlength="reasonMaxLength"
        />
        <div class="lesson-form__actions">
          <Button
            type="submit"
            label="Cancel this lesson"
            severity="danger"
            :disabled="!reason.trim() || !isSaved"
            :loading="saving"
          />
          <Button
            label="Keep it"
            severity="secondary"
            text
            :disabled="saving"
            @click="cancelling = false"
          />
        </div>
      </form>
      <Message
        v-if="notice"
        severity="success"
      >
        {{ notice }}
      </Message>
      <LessonHistory :lessons="form.history" />
    </template>
  </section>
</template>

<script lang="ts">
import type {
  AdminLesson,
  Attendance,
  InstructorForm,
  LessonNotes as Notes,
  SignOffScope,
  SkillResult,
  SkillResults,
} from '@hde/shared';
import type {MarkState} from '@/utils/markSaver';

import {defineComponent, markRaw} from 'vue';
import {mapStores} from 'pinia';
import {allMarked, allPassed, isGuestEmail, REASON_MAX_LENGTH} from '@hde/shared';
import {api} from '@/services/api';
import {useAuthStore} from '@/stores/auth';
import {useCatalogStore} from '@/stores/catalog';
import {STATUS_NAMES} from '@/utils/lessonStatus';
import {lessonDayAndTime} from '@/utils/lessonTime';
import {MarkSaver} from '@/utils/markSaver';
import LessonHistory from '@/components/LessonHistory.vue';
import LessonNotes from '@/components/LessonNotes.vue';
import ResultToggle from '@/components/ResultToggle.vue';

/** How often to check whether the lesson has started or ended. */
const CLOCK_MS = 15_000;
/** How long typing must pause before the notes are saved. */
const NOTES_DELAY_MS = 800;
/** The notes' place in `markStates`, next to the skills' ids. */
const NOTES_KEY = '$notes';
const UNSAVED_MESSAGE = 'Some changes are not saved. Leave and lose them?';

/**
 * An instructor's form for one lesson. Each mark saves as it is made, until the lesson is signed off; corrections
 * after that are only saved by signing it off again.
 */
export default defineComponent({
  name: 'LessonFormView',
  components: {LessonHistory, LessonNotes, ResultToggle},
  async beforeRouteLeave(): Promise<boolean> {
    this.flushNotes();
    await Promise.all([this.saver?.settled(), this.notesSaver?.settled()]);

    // A signed-out account can no longer save, so there is nothing to stay for.
    return this.isSaved || !this.authStore.isAllowed || window.confirm(UNSAVED_MESSAGE);
  },
  props: {
    id: {type: String, required: true},
  },
  data() {
    return {
      lesson: null as AdminLesson | null,
      form: null as InstructorForm | null,
      results: {} as SkillResults,
      markStates: {} as Record<string, MarkState>,
      saver: null as MarkSaver<SkillResult | null> | null,
      notes: {student: '', private: ''} as Notes,
      notesSaver: null as MarkSaver<Notes> | null,
      notesTimer: undefined as number | undefined,
      notesKey: NOTES_KEY,
      clock: undefined as number | undefined,
      loading: true,
      saving: false,
      errorMessage: '',
      notice: '',
      hasMarked: false,
      /** Whether the reason for cancelling is being asked for. */
      cancelling: false,
      reason: '',
      reasonMaxLength: REASON_MAX_LENGTH,
      /** Overrides waiting for the lesson to start and end. */
      early: false,
      now: new Date(),
      statusNames: STATUS_NAMES,
    };
  },
  computed: {
    ...mapStores(useAuthStore, useCatalogStore),
    /** The route is only for accounts that have one; signing out leaves the page. */
    scope(): SignOffScope {
      return this.authStore.signOffScope ?? 'admin';
    },
    /** Guests' addresses are made up, so there is no use showing them. */
    isGuest(): boolean {
      return this.lesson !== null && isGuestEmail(this.lesson.studentEmail);
    },
    isCancelled(): boolean {
      return this.lesson?.status === 'cancelled';
    },
    isSignedOff(): boolean {
      return this.lesson !== null && this.lesson.status !== 'booked';
    },
    hasStarted(): boolean {
      return this.lesson !== null && new Date(this.lesson.startsAt) <= this.now;
    },
    canMark(): boolean {
      return !this.isCancelled && (this.hasStarted || this.early);
    },
    canSignOff(): boolean {
      return !this.isCancelled && (this.hasEnded || this.early);
    },
    isSaved(): boolean {
      return Object.keys(this.markStates).length === 0;
    },
    saveStatus(): string {
      const states = Object.values(this.markStates);

      if (states.includes('failed')) {
        return 'Some changes are not saved.';
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
      if (!this.form || this.isCancelled) {
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
      api.markSkill(this.scope, this.id, skillId, {result, early: this.early});
    this.saver = markRaw(new MarkSaver(save, (skillId, state) => this.setMarkState(skillId, state)));
    this.notesSaver = markRaw(
      new MarkSaver(
        (_, notes: Notes) => api.saveNotes(this.scope, this.id, {notes, early: this.early}),
        (key, state) => this.setNotesState(key, state),
      ),
    );
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
    window.clearTimeout(this.notesTimer);
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
      [this.lesson, this.form] = await Promise.all([
        api.getLesson(this.scope, this.id),
        api.getLessonForm(this.scope, this.id),
      ]);
      this.results = {...this.form.results};
      this.notes = {student: this.form.studentNote, private: this.form.privateNote};
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
    /** Saves once typing pauses, but counts as unsaved from the first key. */
    editNotes(notes: Notes) {
      this.notes = notes;
      this.notice = '';

      if (!this.isSignedOff) {
        this.hasMarked = true;
        this.setMarkState(NOTES_KEY, 'saving');
        window.clearTimeout(this.notesTimer);
        this.notesTimer = window.setTimeout(this.saveNotes, NOTES_DELAY_MS);
      }
    },
    saveNotes() {
      this.notesTimer = undefined;
      this.notesSaver?.mark(NOTES_KEY, this.notes);
    },
    /** Saves notes still waiting for a pause in typing. */
    flushNotes() {
      if (this.notesTimer !== undefined) {
        window.clearTimeout(this.notesTimer);
        this.saveNotes();
      }
    },
    /** An earlier save finishing does not make newer, waiting text saved. */
    setNotesState(key: string, state: MarkState | null) {
      if (this.notesTimer === undefined) {
        this.setMarkState(key, state);
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
    async cancel() {
      this.saving = true;
      this.errorMessage = '';
      this.notice = '';

      try {
        await api.cancelLesson(this.scope, this.id, this.reason);
        await this.refresh();
        this.cancelling = false;
        this.hasMarked = false;
      } catch (error) {
        this.errorMessage = error instanceof Error ? error.message : 'Could not cancel the lesson.';
      } finally {
        this.saving = false;
      }
    },
    async signOff(attendance: Attendance) {
      this.saving = true;
      this.errorMessage = '';
      this.notice = '';

      try {
        const {status} = await api.signOffLesson(this.scope, this.id, {
          results: this.results,
          notes: this.notes,
          attendance,
          early: this.early,
        });
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

  &__cancel {
    margin: 1rem 0;
  }

  &__label {
    display: block;
    font-weight: 700;
  }

  &__reason {
    width: 100%;
    margin-top: 0.375rem;
    padding: 0.625rem 0.75rem;
    background: var(--app-surface);
    border: 2px solid var(--app-line);
    border-radius: var(--app-control-radius);
    color: var(--app-text);
    font: inherit;
  }

  &__spinner {
    display: block;
    margin: 3rem auto;
  }
}
</style>

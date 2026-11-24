<template>
  <section class="schedule">
    <div class="schedule__top">
      <h1 class="schedule__heading">Schedule</h1>
      <ViewAsSelect />
    </div>
    <Message
      v-if="errorMessage || catalogStore.errorMessage"
      severity="error"
    >
      {{ errorMessage || catalogStore.errorMessage }}
    </Message>
    <ProgressSpinner
      v-else-if="loading || catalogStore.loading"
      class="schedule__spinner"
      aria-label="Loading the schedule"
    />
    <template v-else>
      <template
        v-for="group in groups"
        :key="group.title"
      >
        <h2 class="schedule__subheading">
          {{ group.title }}
        </h2>
        <LessonList
          v-if="group.lessons.length > 0"
          :lessons="group.lessons"
        >
          <template #actions="{lesson}">
            <Button
              v-if="new Date(lesson.startsAt) <= now"
              as="router-link"
              :to="{name: 'lesson-form', params: {id: lesson.id}}"
              :label="lesson.status === 'booked' ? 'Open form' : 'View form'"
              :outlined="lesson.status !== 'booked'"
            />
          </template>
        </LessonList>
        <p v-else>
          {{ group.empty }}
        </p>
      </template>
    </template>
  </section>
</template>

<script lang="ts">
import type {AdminLesson} from '@hde/shared';

import {defineComponent} from 'vue';
import {mapStores} from 'pinia';
import {api} from '@/services/api';
import {useCatalogStore} from '@/stores/catalog';
import {useViewAsStore} from '@/stores/viewAs';
import LessonList from '@/components/LessonList.vue';
import ViewAsSelect from '@/components/ViewAsSelect.vue';

interface LessonGroup {
  title: string;
  lessons: AdminLesson[];
  empty: string;
}

/** For admins: an instructor's lessons, or everyone's, by what they need. */
export default defineComponent({
  name: 'ScheduleView',
  components: {LessonList, ViewAsSelect},
  data() {
    return {lessons: [] as AdminLesson[], loading: true, errorMessage: '', now: new Date()};
  },
  computed: {
    ...mapStores(useCatalogStore, useViewAsStore),
    groups(): LessonGroup[] {
      const started = (lesson: AdminLesson) => new Date(lesson.startsAt) <= this.now;
      const booked = this.lessons.filter(({status}) => status === 'booked');

      return [
        {title: 'To sign off', lessons: booked.filter(started), empty: 'Nothing is waiting to be signed off.'},
        {
          title: 'Upcoming',
          lessons: booked.filter((lesson) => !started(lesson)),
          empty: 'No lessons are booked.',
        },
        {
          title: 'Signed off',
          lessons: this.lessons.filter(({status}) => status !== 'booked').reverse(),
          empty: 'No lessons have been signed off.',
        },
      ];
    },
  },
  watch: {
    'viewAsStore.instructorSlug'() {
      void this.load();
    },
  },
  mounted() {
    void this.catalogStore.load();
    void this.load();
  },
  methods: {
    async load() {
      const {instructorSlug} = this.viewAsStore;
      this.loading = true;
      this.errorMessage = '';

      try {
        const lessons = await api.listLessons(instructorSlug);

        // Another instructor may have been chosen meanwhile.
        if (instructorSlug === this.viewAsStore.instructorSlug) {
          this.lessons = lessons;
          this.now = new Date();
        }
      } catch (error) {
        this.errorMessage = error instanceof Error ? error.message : 'Could not load the schedule.';
      } finally {
        if (instructorSlug === this.viewAsStore.instructorSlug) {
          this.loading = false;
        }
      }
    },
  },
});
</script>

<style lang="scss" scoped>
.schedule {
  &__top {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    align-items: center;
    justify-content: space-between;
    margin-top: 0.75rem;
  }

  &__heading {
    margin: 0;
    font-size: clamp(2.375rem, 4vw, 2.875rem);
  }

  &__subheading {
    margin: 1.75rem 0 1rem;
    font-size: 1.6875rem;
  }

  &__spinner {
    display: block;
    margin: 3rem auto;
  }
}
</style>

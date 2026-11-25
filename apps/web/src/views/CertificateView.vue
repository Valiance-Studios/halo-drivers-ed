<template>
  <section class="certificate-view">
    <div class="certificate-view__actions">
      <Button
        as="router-link"
        :to="{name: 'courses'}"
        label="Back to courses"
        icon="pi pi-arrow-left"
        severity="secondary"
        text
      />
      <Button
        v-if="vehicle && completion"
        label="Print or save as PDF"
        icon="pi pi-print"
        @click="print"
      />
    </div>
    <Message
      v-if="errorMessage"
      severity="error"
    >
      {{ errorMessage }}
    </Message>
    <ProgressSpinner
      v-else-if="!ready"
      class="certificate-view__spinner"
      aria-label="Loading the certificate"
    />
    <CourseCertificate
      v-else-if="vehicle && completion"
      :vehicle="vehicle"
      :student-name="authStore.user?.displayName ?? ''"
      :instructor-name="catalogStore.instructorName(completion.instructorSlug)"
      :completed-at="completion.completedAt"
    />
    <p v-else>
      {{ vehicle ? `Complete the ${vehicle.name} course to earn its certificate.` : 'There is no such course.' }}
    </p>
  </section>
</template>

<script lang="ts">
import type {CourseCompletion, Vehicle} from '@hde/shared';

import {defineComponent} from 'vue';
import {mapStores} from 'pinia';
import {useAuthStore} from '@/stores/auth';
import {useBookingsStore} from '@/stores/bookings';
import {useCatalogStore} from '@/stores/catalog';
import {useProgressStore} from '@/stores/progress';
import CourseCertificate from '@/components/CourseCertificate.vue';

/** The signed-in student's own certificate for a course, to view or print. */
export default defineComponent({
  name: 'CertificateView',
  components: {CourseCertificate},
  props: {
    vehicleSlug: {type: String, required: true},
  },
  computed: {
    ...mapStores(useAuthStore, useBookingsStore, useCatalogStore, useProgressStore),
    ready(): boolean {
      return this.bookingsStore.loaded && this.catalogStore.vehicles.length > 0;
    },
    errorMessage(): string | null {
      return this.bookingsStore.errorMessage || this.catalogStore.errorMessage;
    },
    vehicle(): Vehicle | undefined {
      return this.catalogStore.vehicles.find(({slug}) => slug === this.vehicleSlug);
    },
    completion(): CourseCompletion | null {
      return this.vehicle ? this.progressStore.completion(this.vehicle) : null;
    },
  },
  mounted() {
    void this.catalogStore.load();
    void this.bookingsStore.load();
  },
  methods: {
    print() {
      window.print();
    },
  },
});
</script>

<style lang="scss" scoped>
.certificate-view {
  &__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    justify-content: space-between;
    margin: 0.75rem 0 1.25rem;

    @media print {
      display: none;
    }
  }

  &__spinner {
    display: block;
    margin: 3rem auto;
  }
}
</style>

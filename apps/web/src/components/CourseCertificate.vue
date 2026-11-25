<template>
  <article
    class="certificate"
    :class="themeClass"
  >
    <div class="certificate__frame">
      <FactionEmblem
        class="certificate__emblem"
        :faction="vehicle.faction"
      />
      <p class="certificate__school">Halo Drivers Ed</p>
      <h1 class="certificate__title">Certificate of Completion</h1>
      <p class="certificate__line">This certifies that</p>
      <p class="certificate__name">
        {{ studentName }}
      </p>
      <p class="certificate__line">
        has completed {{ vehicle.lessonsRequired }} {{ factionName }} driving lessons ({{ totalHours(vehicle) }}) and is
        licensed to drive the
      </p>
      <p class="certificate__vehicle">
        {{ vehicle.name }}
      </p>
      <SubjectArt
        class="certificate__art"
        kind="vehicles"
        :slug="vehicle.slug"
      />
      <dl class="certificate__facts">
        <div class="certificate__fact">
          <dt>Completed</dt>
          <dd>{{ longDate(completedAt) }}</dd>
        </div>
        <div class="certificate__fact">
          <dt>Final instructor</dt>
          <dd>{{ instructorName }}</dd>
        </div>
      </dl>
    </div>
  </article>
</template>

<script lang="ts">
import type {PropType} from 'vue';
import type {Vehicle} from '@hde/shared';

import {defineComponent} from 'vue';
import {FACTION_NAMES} from '@hde/shared';
import {factionClass} from '@/stores/theme';
import {longDate} from '@/utils/lessonTime';
import {totalHours} from '@/utils/vehicleText';
import FactionEmblem from '@/components/FactionEmblem.vue';
import SubjectArt from '@/components/SubjectArt.vue';

/** A completed course's certificate, in its faction's light colors whatever the app's theme, to look as it prints. */
export default defineComponent({
  name: 'CourseCertificate',
  components: {FactionEmblem, SubjectArt},
  props: {
    vehicle: {type: Object as PropType<Vehicle>, required: true},
    studentName: {type: String, required: true},
    instructorName: {type: String, required: true},
    /** ISO 8601. */
    completedAt: {type: String, required: true},
  },
  computed: {
    themeClass(): string {
      return factionClass(this.vehicle.faction);
    },
    factionName(): string {
      return FACTION_NAMES[this.vehicle.faction];
    },
  },
  methods: {longDate, totalHours},
});
</script>

<style lang="scss" scoped>
.certificate {
  max-width: 60rem;
  margin: 0 auto;
  padding: 0.75rem;
  background: var(--app-surface);
  border: 4px solid var(--app-primary);
  border-radius: var(--app-panel-radius);
  color: var(--app-text);
  color-scheme: light;
  font-family: var(--app-font-body);
  print-color-adjust: exact;

  &__frame {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: clamp(1.25rem, 4vw, 2.5rem);
    border: 1px solid var(--app-accent);
    border-radius: var(--app-panel-radius);
    text-align: center;
  }

  &__emblem {
    width: 3.5rem;
    height: 3.5rem;
    color: var(--app-primary);
  }

  &__school {
    margin: 0.5rem 0 0;
    color: var(--app-accent-text);
    font-weight: 700;
  }

  &__title {
    margin: 0.25rem 0 1.25rem;
    font-size: clamp(2rem, 5vw, 3rem);
  }

  &__line {
    max-width: 40ch;
    margin: 0;
    color: var(--app-muted);
  }

  &__name,
  &__vehicle {
    max-width: 100%;
    margin: 0.375rem 0 0.75rem;
    font-family: var(--app-font-display);
    font-size: clamp(1.75rem, 4vw, 2.5rem);
    font-weight: var(--app-display-weight);
    line-height: 1.15;
    overflow-wrap: anywhere;
  }

  &__name {
    padding: 0 1.5rem 0.25rem;
    border-bottom: 2px solid var(--app-line);
  }

  &__vehicle {
    color: var(--app-primary);
  }

  &__art {
    width: min(16rem, 100%);
    aspect-ratio: 2;
    padding: 0.5rem;
  }

  &__facts {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 1rem 4rem;
    margin: 1.5rem 0 0;
  }

  &__fact {
    dt {
      color: var(--app-muted);
    }

    dd {
      margin: 0;
      font-weight: 700;
    }
  }

  @media print {
    page: certificate;
    max-width: none;
    break-inside: avoid;
  }
}
</style>

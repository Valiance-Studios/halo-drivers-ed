<template>
  <div
    class="vehicle-route"
    :style="{'--rows': layout.rows}"
  >
    <svg
      class="vehicle-route__lines"
      :viewBox="viewBox"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        class="road road--base"
        :d="layout.path"
      />
      <path
        class="road road--lane"
        :d="layout.path"
      />
    </svg>
    <button
      v-for="{vehicle, x, y} in layout.stops"
      :key="vehicle.slug"
      type="button"
      class="vehicle-route__stop"
      :class="{
        'vehicle-route__stop--selected': vehicle.slug === selected,
        'vehicle-route__stop--locked': isLocked(vehicle),
      }"
      :style="{'--x': `${x * 100}%`, '--y': `${y * 100}%`, '--columns': columns}"
      :aria-pressed="vehicle.slug === selected"
      @click="$emit('select', vehicle.slug)"
    >
      <SubjectArt
        class="vehicle-route__art"
        kind="vehicles"
        :slug="vehicle.slug"
      />
      <span
        v-if="isLocked(vehicle)"
        class="vehicle-route__lock"
      >
        <i
          class="pi pi-lock"
          aria-hidden="true"
        />
      </span>
      <span class="vehicle-route__name">{{ vehicle.name }}</span>
      <span class="vehicle-route__meta">
        <span>{{ domainName(vehicle) }}</span>
        <span
          v-if="progress(vehicle)"
          class="vehicle-route__progress"
        >
          <RibbonIcon v-if="isCompleted(vehicle)" />
          {{ progress(vehicle) }}<span class="visually-hidden"> lessons completed</span>
        </span>
        <span>{{ totalHours(vehicle) }}</span>
      </span>
      <span class="vehicle-route__after">{{ afterText(vehicle) }}</span>
      <span
        v-if="isLocked(vehicle)"
        class="visually-hidden"
      >
        Locked
      </span>
    </button>
  </div>
</template>

<script lang="ts">
import type {PropType} from 'vue';
import type {Faction, Vehicle} from '@hde/shared';
import type {RouteLayout} from '@/utils/routeLayout';

import {defineComponent} from 'vue';
import {mapStores} from 'pinia';
import {useCatalogStore} from '@/stores/catalog';
import {useProgressStore} from '@/stores/progress';
import {layoutRoute, ROUTE_HEIGHT, ROUTE_WIDTH} from '@/utils/routeLayout';
import {domainName, progressText, totalHours} from '@/utils/vehicleText';
import RibbonIcon from '@/components/RibbonIcon.vue';
import SubjectArt from '@/components/SubjectArt.vue';

/** A faction's vehicles, joined by their prerequisites. Locked ones can still be selected. On narrow screens, a list. */
export default defineComponent({
  name: 'VehicleRoute',
  components: {RibbonIcon, SubjectArt},
  props: {
    vehicles: {type: Array as PropType<Vehicle[]>, required: true},
    faction: {type: String as PropType<Faction>, required: true},
    selected: {type: String, required: true},
  },
  emits: {
    select: (slug: string) => slug.length > 0,
  },
  data() {
    return {viewBox: `0 0 ${ROUTE_WIDTH} ${ROUTE_HEIGHT}`};
  },
  computed: {
    ...mapStores(useCatalogStore, useProgressStore),
    layout(): RouteLayout {
      return layoutRoute(this.vehicles, this.faction);
    },
    columns(): number {
      return new Set(this.layout.stops.map(({x}) => x)).size;
    },
  },
  methods: {
    domainName,
    totalHours,
    isLocked(vehicle: Vehicle): boolean {
      return this.progressStore.missingFor(vehicle).length > 0;
    },
    isCompleted({slug}: Vehicle): boolean {
      return this.progressStore.completedSlugs.includes(slug);
    },
    progress(vehicle: Vehicle): string {
      return progressText(vehicle, this.progressStore.lessonsCompleted(vehicle));
    },
    afterText(vehicle: Vehicle): string {
      return vehicle.prerequisites.length > 0
        ? `After ${vehicle.prerequisites.map(this.catalogStore.vehicleName).join(', ')}`
        : 'Start here';
    },
  },
});
</script>

<style lang="scss" scoped>
.vehicle-route {
  position: relative;
  height: calc(var(--rows) * 13.5rem);

  &__lines {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }

  &__stop {
    position: absolute;
    top: var(--y);
    left: var(--x);
    width: min(14.25rem, 84% / var(--columns));
    padding: 0.875rem 1.125rem;
    background: var(--app-surface);
    border: 2px solid var(--app-line);
    border-radius: var(--app-node-radius);
    color: var(--app-text);
    cursor: pointer;
    font-size: inherit;
    line-height: inherit;
    text-align: left;
    transform: translate(-50%, -50%);

    &:hover {
      border-color: var(--app-primary);
    }

    &:focus-visible {
      outline: 3px solid var(--app-accent);
      outline-offset: 3px;
    }

    &--selected {
      background: var(--app-primary);
      border-color: var(--app-primary);
      box-shadow: var(--app-node-selected-shadow);
      color: var(--app-on-primary);
    }
  }

  &__art {
    width: 100%;
    height: 4.5rem;
    margin-bottom: 0.625rem;
  }

  &__stop--locked &__art {
    filter: grayscale(1);
    opacity: 0.6;
  }

  &__lock {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    display: grid;
    place-items: center;
    width: 2rem;
    height: 2rem;
    background: var(--app-text);
    border-radius: 50%;
    color: var(--app-bg);
  }

  &__name {
    display: block;
    font-family: var(--app-font-display);
    font-size: 1.5rem;
    font-weight: var(--app-display-weight);
    line-height: 1.1;
  }

  &__meta {
    display: flex;
    justify-content: space-between;
    margin-top: 0.5rem;
  }

  &__progress {
    display: inline-flex;
    gap: 0.25rem;
    align-items: center;
  }

  &__after {
    display: none;
  }

  &__stop:not(&__stop--selected) &__meta,
  &__stop:not(&__stop--selected) &__after {
    color: var(--app-muted);
  }

  @media (max-width: 52rem) {
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
    height: auto;

    &__lines {
      display: none;
    }

    &__stop {
      position: relative;
      top: auto;
      left: auto;
      width: 100%;
      transform: none;
    }

    &__after {
      display: block;
    }
  }
}
</style>

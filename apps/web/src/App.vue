<template>
  <div class="app">
    <header class="app__header">
      <div class="app__bar">
        <RouterLink
          class="app__title"
          :to="{name: 'courses'}"
        >
          <svg
            class="app__mark"
            viewBox="0 0 32 32"
            aria-hidden="true"
          >
            <circle
              cx="16"
              cy="16"
              r="12"
            />
            <circle
              cx="16"
              cy="16"
              r="3"
            />
            <path d="M5 14h8M19 14h8M16 19v8" />
          </svg>
          Halo Drivers Ed
        </RouterLink>
        <div class="app__actions">
          <FactionToggle />
          <ThemeToggle />
          <template v-if="authStore.isAllowed">
            <span class="app__user">{{ authStore.user?.displayName }}</span>
            <Button
              label="Sign out"
              icon="pi pi-sign-out"
              severity="secondary"
              text
              @click="signOut"
            />
          </template>
        </div>
      </div>
    </header>
    <main class="app__main">
      <RouterView />
    </main>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {mapStores} from 'pinia';
import {useAuthStore} from '@/stores/auth';
import FactionToggle from '@/components/FactionToggle.vue';
import ThemeToggle from '@/components/ThemeToggle.vue';

export default defineComponent({
  name: 'App',
  components: {FactionToggle, ThemeToggle},
  computed: {
    ...mapStores(useAuthStore),
  },
  watch: {
    'authStore.isAllowed'(isAllowed: boolean) {
      if (!isAllowed && !this.$route.meta.public) {
        void this.$router.push({name: 'login'});
      }
    },
  },
  methods: {
    async signOut() {
      await this.authStore.signOut();
    },
  },
});
</script>

<style lang="scss" scoped>
.app {
  min-height: 100vh;

  &__header {
    background: var(--app-header);
    border-bottom: var(--app-header-edge);
    border-radius: var(--app-header-radius);
    color: #fff;

    // The header is a solid color in every theme, so its buttons are white.
    :deep(.p-button) {
      min-width: 2.75rem;
      min-height: 2.75rem;
      color: #fff;

      &.p-button-icon-only {
        background: rgb(255 255 255 / 14%);
      }

      &:hover {
        background: rgb(255 255 255 / 24%);
        color: #fff;
      }

      &:focus-visible {
        outline-color: #fff;
      }
    }
  }

  &__bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem 1rem;
    max-width: var(--app-max-width);
    margin: 0 auto;
    padding: 0.625rem var(--app-gutter);
  }

  &__title {
    display: flex;
    gap: 0.75rem;
    align-items: center;
    color: inherit;
    font-family: var(--app-font-display);
    font-size: 1.4375rem;
    font-weight: var(--app-display-weight);
    text-decoration: none;

    &:focus-visible {
      outline: 2px solid #fff;
      outline-offset: 4px;
    }
  }

  &__mark {
    width: 2.125rem;
    height: 2.125rem;
    fill: none;
    stroke: currentcolor;
    stroke-width: 3;
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  &__user {
    @media (max-width: 52rem) {
      display: none;
    }
  }

  &__main {
    max-width: var(--app-max-width);
    margin: 0 auto;
    padding: var(--app-gutter) var(--app-gutter) 3rem;
  }
}
</style>

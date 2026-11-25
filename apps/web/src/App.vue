<template>
  <div class="app">
    <header
      ref="header"
      class="app__header"
      @keydown.esc="closeMenu"
    >
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
        <nav
          v-if="authStore.isAllowed"
          id="app-menu"
          ref="menu"
          class="app__nav"
          :class="{'app__nav--open': menuOpen}"
          aria-label="Main"
        >
          <RouterLink
            class="app__link"
            :to="{name: 'courses'}"
          >
            Courses
          </RouterLink>
          <RouterLink
            class="app__link"
            :to="{name: 'lessons'}"
          >
            My lessons
          </RouterLink>
          <RouterLink
            v-if="authStore.signOffScope"
            class="app__link"
            :to="{name: 'schedule'}"
          >
            Schedule
          </RouterLink>
          <div class="app__menu-account">
            <span>{{ authStore.user?.displayName }}</span>
            <Button
              label="Sign out"
              icon="pi pi-sign-out"
              severity="secondary"
              text
              @click="signOut"
            />
          </div>
        </nav>
        <div class="app__actions">
          <FactionToggle />
          <ThemeToggle />
          <template v-if="authStore.isAllowed">
            <span class="app__user">{{ authStore.user?.displayName }}</span>
            <Button
              class="app__sign-out"
              label="Sign out"
              icon="pi pi-sign-out"
              severity="secondary"
              text
              @click="signOut"
            />
            <Button
              ref="menuButton"
              class="app__menu-button"
              :icon="menuOpen ? 'pi pi-times' : 'pi pi-bars'"
              severity="secondary"
              text
              rounded
              aria-label="Menu"
              aria-controls="app-menu"
              :aria-expanded="menuOpen"
              @click="toggleMenu"
            />
          </template>
        </div>
      </div>
    </header>
    <main class="app__main">
      <Message
        v-if="demoNotice"
        class="app__notice"
        severity="info"
      >
        {{ demoNotice }}
      </Message>
      <RouterView />
    </main>
    <footer class="app__footer">
      A non-commercial fan project, not affiliated with or endorsed by Microsoft. Halo and its characters belong to
      Microsoft.
    </footer>
  </div>
</template>

<script lang="ts">
import type {ComponentPublicInstance} from 'vue';

import {defineComponent} from 'vue';
import {mapStores} from 'pinia';
import {useAuthStore} from '@/stores/auth';
import {useBookingsStore} from '@/stores/bookings';
import {useViewAsStore} from '@/stores/viewAs';
import FactionToggle from '@/components/FactionToggle.vue';
import ThemeToggle from '@/components/ThemeToggle.vue';

export default defineComponent({
  name: 'App',
  components: {FactionToggle, ThemeToggle},
  data() {
    /** Whether the narrow screens' menu is open. */
    return {menuOpen: false};
  },
  computed: {
    ...mapStores(useAuthStore, useBookingsStore, useViewAsStore),
    demoNotice(): string {
      const endsAt = this.authStore.user?.demoEndsAt;

      return endsAt
        ? `You are trying the demo until ${new Date(endsAt).toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'})}. You cannot return to it after that, or after signing out.`
        : '';
    },
  },
  watch: {
    /** Forgets one account's lessons and view before another signs in. */
    'authStore.user.uid'() {
      this.bookingsStore.$reset();
      this.viewAsStore.$reset();
    },
    '$route'() {
      this.menuOpen = false;
    },
    'authStore.isAllowed'(isAllowed: boolean) {
      if (!isAllowed && !this.$route.meta.public) {
        void this.$router.push({name: 'login'});
      }
    },
  },
  mounted() {
    document.addEventListener('pointerdown', this.closeMenuOutside);
  },
  beforeUnmount() {
    document.removeEventListener('pointerdown', this.closeMenuOutside);
  },
  methods: {
    /** Opening moves the focus into the menu, which comes before its button. */
    async toggleMenu() {
      this.menuOpen = !this.menuOpen;

      if (this.menuOpen) {
        await this.$nextTick();
        (this.$refs.menu as HTMLElement | undefined)?.querySelector('a')?.focus();
      }
    },
    closeMenu() {
      if (this.menuOpen) {
        this.menuOpen = false;
        (this.$refs.menuButton as ComponentPublicInstance | undefined)?.$el.focus();
      }
    },
    closeMenuOutside({target}: PointerEvent) {
      if (!(this.$refs.header as HTMLElement).contains(target as Node)) {
        this.menuOpen = false;
      }
    },
    async signOut() {
      this.menuOpen = false;
      await this.authStore.signOut();
    },
  },
});
</script>

<style lang="scss" scoped>
.app {
  display: flex;
  flex-direction: column;
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

      &:not(:disabled):hover {
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

  &__nav {
    display: flex;
    gap: 1.25rem;
    margin-right: auto;
    margin-left: 1rem;

    @media (max-width: 52rem) {
      display: none;
      flex-direction: column;
      gap: 0;
      order: 1;
      width: 100%;
      margin: 0;

      &--open {
        display: flex;
      }
    }
  }

  &__link {
    padding: 0.5rem 0;
    border-bottom: 3px solid transparent;
    color: inherit;
    text-decoration: none;

    @media (max-width: 52rem) {
      padding: 0.625rem 0.75rem;
      border-bottom: 0;
      border-left: 3px solid transparent;
    }

    &:hover,
    &.router-link-active {
      border-color: currentcolor;
    }

    &:focus-visible {
      outline: 2px solid #fff;
      outline-offset: 2px;
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

  &__user,
  &__sign-out {
    @media (max-width: 52rem) {
      display: none;
    }
  }

  &__menu-account,
  &__menu-button {
    display: none;
  }

  &__menu-account {
    align-items: center;
    justify-content: space-between;
    margin-top: 0.5rem;
    padding: 0.5rem 0 0 0.75rem;
    border-top: 1px solid rgb(255 255 255 / 30%);
    overflow-wrap: anywhere;

    :deep(.p-button) {
      flex: none;
    }
  }

  @media (max-width: 52rem) {
    &__menu-account {
      display: flex;
    }

    &__menu-button {
      display: inline-flex;
    }

    &__title {
      gap: 0.5rem;
      font-size: 1.25rem;
      white-space: nowrap;
    }

    &__mark {
      width: 1.75rem;
      height: 1.75rem;
    }
  }

  // Keeps the app bar on one line on the smallest phones.
  @media (max-width: 23.5rem) {
    &__bar {
      column-gap: 0.5rem;
    }

    &__actions {
      gap: 0.125rem;
    }

    &__title {
      font-size: 1.0625rem;
    }

    &__mark {
      display: none;
    }
  }

  @media print {
    &__header,
    &__footer,
    &__notice {
      display: none;
    }
  }

  &__footer {
    padding: 1rem var(--app-gutter);
    border-top: 1px solid var(--app-line);
    color: var(--app-muted);
    font-size: 0.875rem;
    text-align: center;
  }

  &__main {
    flex: 1;
    width: 100%;
    max-width: var(--app-max-width);
    margin: 0 auto;
    padding: var(--app-gutter) var(--app-gutter) 3rem;

    @media print {
      max-width: none;
      padding: 0;
    }
  }
}
</style>

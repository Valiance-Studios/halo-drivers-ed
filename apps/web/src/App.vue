<template>
  <div class="app">
    <header class="app__header">
      <RouterLink
        class="app__title"
        :to="{name: 'courses'}"
      >
        Halo Drivers Ed
      </RouterLink>
      <div class="app__actions">
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
import ThemeToggle from '@/components/ThemeToggle.vue';

export default defineComponent({
  name: 'App',
  components: {ThemeToggle},
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
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.5rem var(--app-gutter);
    border-bottom: 1px solid var(--p-content-border-color);
  }

  &__title {
    color: var(--p-primary-color);
    font-size: 1.25rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-decoration: none;
    text-transform: uppercase;
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  &__user {
    @media (max-width: 40rem) {
      display: none;
    }
  }

  &__main {
    max-width: var(--app-max-width);
    margin: 0 auto;
    padding: var(--app-gutter);
  }
}
</style>

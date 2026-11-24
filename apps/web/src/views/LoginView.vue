<template>
  <section class="login">
    <div>
      <h1 class="login__heading">Driving lessons for both sides of the war</h1>
      <svg
        class="login__road"
        viewBox="0 0 600 200"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          class="road road--base"
          :d="road"
        />
        <path
          class="road road--lane"
          :d="road"
        />
      </svg>
      <SubjectArt
        class="login__art"
        kind="vehicles"
        :slug="heroSlug"
      />
    </div>
    <Card class="login__card">
      <template #title>
        <h2 class="login__title">Sign in</h2>
      </template>
      <template #subtitle> Use your approved Google account to see courses and instructors. </template>
      <template #content>
        <Message
          v-if="authStore.errorMessage"
          class="login__error"
          severity="error"
        >
          {{ authStore.errorMessage }}
        </Message>
        <Button
          class="login__button"
          label="Sign in with Google"
          icon="pi pi-google"
          :loading="signingIn"
          @click="signIn"
        />
      </template>
    </Card>
  </section>
</template>

<script lang="ts">
import type {Faction} from '@hde/shared';

import {defineComponent} from 'vue';
import {mapStores} from 'pinia';
import {useAuthStore} from '@/stores/auth';
import {useThemeStore} from '@/stores/theme';
import SubjectArt from '@/components/SubjectArt.vue';

/** Each theme's forked road, in the login page's 600 by 200 drawing. */
const ROADS: Record<Faction, string> = {
  unsc: 'M0 100H220L300 40H600M220 100L300 160H600',
  covenant: 'M0 100C240 100 220 30 360 30C460 30 500 70 600 50M0 100C240 100 220 170 360 170C460 170 500 130 600 150',
};

/** The vehicle each theme shows on the login page. */
const HERO_VEHICLES: Record<Faction, string> = {unsc: 'warthog', covenant: 'ghost'};

export default defineComponent({
  name: 'LoginView',
  components: {SubjectArt},
  data() {
    return {
      signingIn: false,
    };
  },
  computed: {
    ...mapStores(useAuthStore, useThemeStore),
    road(): string {
      return ROADS[this.themeStore.faction];
    },
    heroSlug(): string {
      return HERO_VEHICLES[this.themeStore.faction];
    },
  },
  methods: {
    async signIn() {
      this.signingIn = true;

      try {
        await this.authStore.signIn();
      } finally {
        this.signingIn = false;
      }

      if (this.authStore.isAllowed) {
        const redirect = this.$route.query.redirect;
        await this.$router.push(typeof redirect === 'string' ? redirect : {name: 'courses'});
      }
    },
  },
});
</script>

<style lang="scss" scoped>
.login {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
  gap: 2.5rem 4.5rem;
  align-items: center;
  padding-top: 3rem;

  @media (max-width: 52rem) {
    grid-template-columns: minmax(0, 1fr);
    padding-top: 1rem;
  }

  &__heading {
    margin: 0;
    font-size: clamp(2.5rem, 5vw, 3.875rem);
  }

  &__road {
    display: block;
    width: 100%;
    height: 6.875rem;
    margin-top: 1.75rem;
  }

  &__art {
    width: 100%;
    height: 13rem;
    margin-top: 1.125rem;
    background: transparent;
  }

  &__card {
    padding: 1.25rem;
    border: 2px solid var(--app-line);
    border-radius: var(--app-panel-radius);
    box-shadow: none;
  }

  &__title {
    margin: 0;
    font-size: 2rem;
  }

  &__error {
    margin-bottom: 1rem;
  }

  &__button {
    margin-top: 1rem;
    width: 100%;
    min-height: 3.375rem;
    border-radius: var(--app-control-radius);
  }
}
</style>

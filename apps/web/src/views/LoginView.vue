<template>
  <section class="login">
    <Card class="login__card">
      <template #title>
        <h1 class="login__heading">
          Sign in
        </h1>
      </template>
      <template #subtitle>
        Driving lessons for UNSC and Covenant vehicles
      </template>
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
import {defineComponent} from 'vue';
import {mapStores} from 'pinia';
import {useAuthStore} from '@/stores/auth';

export default defineComponent({
  name: 'LoginView',
  data() {
    return {
      signingIn: false,
    };
  },
  computed: {
    ...mapStores(useAuthStore),
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
  display: flex;
  justify-content: center;
  padding-top: 10vh;

  &__card {
    width: 100%;
    max-width: 28rem;
  }

  &__heading {
    margin: 0;
    font-size: 1.5rem;
  }

  &__error {
    margin-bottom: 1rem;
  }

  &__button {
    width: 100%;
  }
}
</style>

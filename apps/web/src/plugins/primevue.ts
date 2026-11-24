import type {Plugin} from 'vue';

import PrimeVue from 'primevue/config';
import Aura from '@primeuix/themes/aura';
import {definePreset} from '@primeuix/themes';

/** The class on <html> that switches PrimeVue to its dark scheme (see stores/theme.ts). */
export const DARK_MODE_CLASS = 'app-dark';

/** Aura with a teal primary color. A placeholder until the pages get their designed look. */
const HaloPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '{teal.50}',
      100: '{teal.100}',
      200: '{teal.200}',
      300: '{teal.300}',
      400: '{teal.400}',
      500: '{teal.500}',
      600: '{teal.600}',
      700: '{teal.700}',
      800: '{teal.800}',
      900: '{teal.900}',
      950: '{teal.950}',
    },
  },
});

export const primeVue: [Plugin, unknown] = [
  PrimeVue,
  {
    theme: {
      preset: HaloPreset,
      options: {darkModeSelector: `.${DARK_MODE_CLASS}`},
    },
  },
];

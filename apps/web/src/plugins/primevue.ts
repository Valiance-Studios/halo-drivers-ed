import type {Plugin} from 'vue';

import PrimeVue from 'primevue/config';
import Aura from '@primeuix/themes/aura';
import {definePreset} from '@primeuix/themes';

/** The class on <html> that switches PrimeVue to its dark scheme (see stores/theme.ts). */
export const DARK_MODE_CLASS = 'app-dark';

/** PrimeVue takes its colors from the app's tokens (styles/themes.scss), so changing theme needs no new preset. */
const COLORS = {
  primary: {
    color: 'var(--app-primary)',
    contrastColor: 'var(--app-on-primary)',
    hoverColor: 'color-mix(in srgb, var(--app-primary) 88%, var(--app-text))',
    activeColor: 'color-mix(in srgb, var(--app-primary) 78%, var(--app-text))',
  },
  content: {
    background: 'var(--app-surface)',
    borderColor: 'var(--app-line)',
    color: 'var(--app-text)',
  },
  text: {
    color: 'var(--app-text)',
    hoverColor: 'var(--app-text)',
    mutedColor: 'var(--app-muted)',
    hoverMutedColor: 'var(--app-text)',
  },
};

const HaloPreset = definePreset(Aura, {
  semantic: {
    colorScheme: {light: COLORS, dark: COLORS},
  },
  components: {
    dialog: {
      root: {background: 'var(--app-surface)', borderColor: 'var(--app-line)', color: 'var(--app-text)'},
    },
    select: {
      root: {background: 'var(--app-bg)', borderColor: 'var(--app-line)', color: 'var(--app-text)'},
      overlay: {background: 'var(--app-surface)', borderColor: 'var(--app-line)', color: 'var(--app-text)'},
      option: {
        color: 'var(--app-text)',
        focusBackground: 'var(--app-bg)',
        focusColor: 'var(--app-text)',
        selectedBackground: 'var(--app-primary)',
        selectedColor: 'var(--app-on-primary)',
        selectedFocusBackground: 'var(--app-primary)',
        selectedFocusColor: 'var(--app-on-primary)',
      },
    },
    tabs: {
      tablist: {background: 'transparent'},
      tab: {activeColor: 'var(--app-text)'},
      tabpanel: {background: 'transparent', padding: '0'},
      activeBar: {background: 'var(--app-accent)', height: '4px'},
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

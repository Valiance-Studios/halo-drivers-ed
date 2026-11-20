import type {ThemeName} from '@/utils/themePreference';

import {defineStore} from 'pinia';
import {DARK_MODE_CLASS} from '@/plugins/primevue';
import {loadThemePreference, saveThemePreference} from '@/utils/themePreference';

const DARK_QUERY = '(prefers-color-scheme: dark)';

export interface ThemeState {
  /** The user's choice, or null to follow the system setting. */
  preference: ThemeName | null;
  systemPrefersDark: boolean;
}

export const useThemeStore = defineStore('theme', {
  state: (): ThemeState => ({
    preference: null,
    systemPrefersDark: false,
  }),
  getters: {
    isDark(state): boolean {
      return state.preference ? state.preference === 'dark' : state.systemPrefersDark;
    },
  },
  actions: {
    /** Applies the remembered choice (or the system setting) and follows system changes from then on. */
    init(): void {
      const query = window.matchMedia(DARK_QUERY);
      this.preference = loadThemePreference();
      this.systemPrefersDark = query.matches;
      query.addEventListener('change', (event) => {
        this.systemPrefersDark = event.matches;
        this.apply();
      });
      this.apply();
    },
    toggle(): void {
      this.preference = this.isDark ? 'light' : 'dark';
      saveThemePreference(this.preference);
      this.apply();
    },
    apply(): void {
      document.documentElement.classList.toggle(DARK_MODE_CLASS, this.isDark);
    },
  },
});

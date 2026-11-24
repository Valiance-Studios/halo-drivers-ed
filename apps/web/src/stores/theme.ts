import type {Faction} from '@hde/shared';
import type {ColorMode} from '@/utils/themePreference';

import {defineStore} from 'pinia';
import {FACTIONS} from '@hde/shared';
import {DARK_MODE_CLASS} from '@/plugins/primevue';
import {loadColorMode, loadThemeFaction, saveColorMode, saveThemeFaction} from '@/utils/themePreference';

const DARK_QUERY = '(prefers-color-scheme: dark)';

export interface ThemeState {
  /** The user's light or dark choice, or null to follow the system setting. */
  preference: ColorMode | null;
  systemPrefersDark: boolean;
  /** Whose look the app wears. Separate from which faction's courses are showing. */
  faction: Faction;
}

/** The class on <html> that selects a faction's tokens (see styles/themes.scss). */
export function factionClass(faction: Faction): string {
  return `theme-${faction}`;
}

export const useThemeStore = defineStore('theme', {
  state: (): ThemeState => ({
    preference: null,
    systemPrefersDark: false,
    faction: 'unsc',
  }),
  getters: {
    isDark(state): boolean {
      return state.preference ? state.preference === 'dark' : state.systemPrefersDark;
    },
    otherFaction(state): Faction {
      return state.faction === 'unsc' ? 'covenant' : 'unsc';
    },
  },
  actions: {
    /** Applies the remembered choices (or the defaults) and follows system changes from then on. */
    init(): void {
      const query = window.matchMedia(DARK_QUERY);
      this.preference = loadColorMode();
      this.faction = loadThemeFaction() ?? 'unsc';
      this.systemPrefersDark = query.matches;
      query.addEventListener('change', (event) => {
        this.systemPrefersDark = event.matches;
        this.apply();
      });
      this.apply();
    },
    toggle(): void {
      this.preference = this.isDark ? 'light' : 'dark';
      saveColorMode(this.preference);
      this.apply();
    },
    toggleFaction(): void {
      this.faction = this.otherFaction;
      saveThemeFaction(this.faction);
      this.apply();
    },
    apply(): void {
      const {classList} = document.documentElement;
      classList.toggle(DARK_MODE_CLASS, this.isDark);

      for (const faction of FACTIONS) {
        classList.toggle(factionClass(faction), faction === this.faction);
      }
    },
  },
});

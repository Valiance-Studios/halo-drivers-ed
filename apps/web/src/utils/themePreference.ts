/** The user's light/dark choice, remembered in this browser. Without one, the app follows the system setting. */

export type ThemeName = 'light' | 'dark';

const STORAGE_KEY = 'theme';

function isThemeName(value: unknown): value is ThemeName {
  return value === 'light' || value === 'dark';
}

export function loadThemePreference(): ThemeName | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);

    return isThemeName(value) ? value : null;
  } catch {
    // Storage can be unavailable, e.g. in some private browsing modes.
    return null;
  }
}

export function saveThemePreference(theme: ThemeName): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Not remembering the choice is fine; the toggle still works for this visit.
  }
}

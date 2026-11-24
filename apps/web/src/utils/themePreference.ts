import type {Faction} from '@hde/shared';

import {FACTIONS} from '@hde/shared';

/*
 * The user's theme choices, remembered in this browser: light or dark (without a choice, the app follows the
 * system setting) and which faction's look the app wears.
 */

export const COLOR_MODES = ['light', 'dark'] as const;
export type ColorMode = (typeof COLOR_MODES)[number];

const COLOR_MODE_KEY = 'theme';
const FACTION_KEY = 'theme-faction';

function load<T extends string>(key: string, allowed: readonly T[]): T | null {
  try {
    const value = localStorage.getItem(key);

    return allowed.find((option) => option === value) ?? null;
  } catch {
    // Storage can be unavailable, e.g. in some private browsing modes.
    return null;
  }
}

function save(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Not remembering the choice is fine; the toggle still works for this visit.
  }
}

export function loadColorMode(): ColorMode | null {
  return load(COLOR_MODE_KEY, COLOR_MODES);
}

export function saveColorMode(mode: ColorMode): void {
  save(COLOR_MODE_KEY, mode);
}

export function loadThemeFaction(): Faction | null {
  return load(FACTION_KEY, FACTIONS);
}

export function saveThemeFaction(faction: Faction): void {
  save(FACTION_KEY, faction);
}

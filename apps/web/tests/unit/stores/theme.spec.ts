import {beforeEach, describe, expect, it, vi} from 'vite-plus/test';
import {createPinia, setActivePinia} from 'pinia';
import {useThemeStore} from '@/stores/theme';

const {classList} = document.documentElement;

describe('theme store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    document.documentElement.className = '';
    vi.stubGlobal('matchMedia', () => ({matches: true, addEventListener: vi.fn()}));
  });

  it('starts with the UNSC look in the system color mode', () => {
    useThemeStore().init();

    expect([...classList].sort()).toEqual(['app-dark', 'theme-unsc']);
  });

  it('switches faction and color mode separately, and remembers both', () => {
    const store = useThemeStore();
    store.init();
    store.toggleFaction();
    store.toggle();
    expect([...classList]).toEqual(['theme-covenant']);

    setActivePinia(createPinia());
    document.documentElement.className = '';
    useThemeStore().init();
    expect([...classList]).toEqual(['theme-covenant']);
  });

  it('ignores unknown remembered values', () => {
    localStorage.setItem('theme', 'sepia');
    localStorage.setItem('theme-faction', 'flood');
    useThemeStore().init();

    expect([...classList].sort()).toEqual(['app-dark', 'theme-unsc']);
  });
});

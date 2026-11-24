import type {Vehicle} from '@hde/shared';

import {beforeEach, describe, expect, it} from 'vite-plus/test';
import {createPinia, setActivePinia} from 'pinia';
import {useProgressStore} from '@/stores/progress';

const vehicle = (...prerequisites: string[]): Vehicle => ({
  slug: 'pelican',
  name: 'Pelican',
  faction: 'unsc',
  domain: 'air',
  description: '',
  lessonMinutes: 60,
  lessonsRequired: 2,
  prerequisites,
});

describe('progress store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('opens courses without prerequisites to a new student', () => {
    expect(useProgressStore().missingFor(vehicle())).toEqual([]);
  });

  it('locks a course until every prerequisite is complete', () => {
    const store = useProgressStore();
    expect(store.missingFor(vehicle('warthog', 'hornet'))).toEqual(['warthog', 'hornet']);

    store.completedSlugs = ['warthog'];
    expect(store.missingFor(vehicle('warthog', 'hornet'))).toEqual(['hornet']);

    store.completedSlugs = ['warthog', 'hornet'];
    expect(store.missingFor(vehicle('warthog', 'hornet'))).toEqual([]);
  });
});

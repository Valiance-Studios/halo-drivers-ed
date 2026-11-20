import type {Instructor, Vehicle} from '@hde/shared';

import {beforeEach, describe, expect, it, vi} from 'vitest';
import {createPinia, setActivePinia} from 'pinia';
import {useCatalogStore} from '@/stores/catalog';

const mocks = vi.hoisted(() => ({listVehicles: vi.fn(), listInstructors: vi.fn()}));

vi.mock('@/services/api', () => ({api: mocks}));

const vehicle = (slug: string, faction: Vehicle['faction']): Vehicle => ({
  slug, name: slug.toUpperCase(), faction, domain: 'ground', description: '', lessonMinutes: 60, lessonsRequired: 2, prerequisites: [],
});
const VEHICLES = [vehicle('warthog', 'unsc'), vehicle('ghost', 'covenant')];
const INSTRUCTORS: Instructor[] = [{slug: 'arbiter', name: 'The Arbiter', title: 'Arbiter', faction: 'covenant', bio: '', vehicles: ['ghost']}];

describe('catalog store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    mocks.listVehicles.mockResolvedValue(VEHICLES);
    mocks.listInstructors.mockResolvedValue(INSTRUCTORS);
  });

  it('loads once and groups by faction', async () => {
    const store = useCatalogStore();
    await store.load();
    await store.load();

    expect(mocks.listVehicles).toHaveBeenCalledTimes(1);
    expect(store.vehiclesOf('covenant').map((item) => item.slug)).toEqual(['ghost']);
    expect(store.instructorsFor('ghost').map((item) => item.slug)).toEqual(['arbiter']);
    expect(store.vehicleName('warthog')).toBe('WARTHOG');
  });

  it('reports a failed load', async () => {
    mocks.listVehicles.mockRejectedValue(new Error('Offline'));
    const store = useCatalogStore();
    await store.load();

    expect(store.errorMessage).toBe('Could not load the courses: Offline');
    expect(store.loading).toBe(false);
  });
});

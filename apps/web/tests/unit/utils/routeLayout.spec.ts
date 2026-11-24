import type {Vehicle} from '@hde/shared';

import {describe, expect, it} from 'vite-plus/test';
import {layoutRoute} from '@/utils/routeLayout';

const vehicle = (slug: string, ...prerequisites: string[]): Vehicle => ({
  slug,
  name: slug,
  faction: 'unsc',
  domain: 'ground',
  description: '',
  lessonMinutes: 60,
  lessonsRequired: 2,
  prerequisites,
});

const VEHICLES = [vehicle('a'), vehicle('b', 'a'), vehicle('c', 'b'), vehicle('d', 'b')];

describe('layoutRoute', () => {
  it('places each vehicle after its prerequisite, with a row per branch', () => {
    const {stops, rows} = layoutRoute(VEHICLES, 'unsc');

    expect(rows).toBe(2);
    expect(stops.map((stop) => [stop.vehicle.slug, stop.x.toFixed(2), stop.y])).toEqual([
      ['a', '0.17', 0.5],
      ['b', '0.50', 0.5],
      ['c', '0.83', 0.25],
      ['d', '0.83', 0.75],
    ]);
  });

  it('draws a line per prerequisite: angled for the UNSC, curved for the Covenant', () => {
    const unsc = layoutRoute(VEHICLES, 'unsc').path;
    const covenant = layoutRoute(VEHICLES, 'covenant').path;

    expect(unsc.match(/M/g)).toHaveLength(3);
    expect(unsc).toContain('L');
    expect(covenant.match(/C/g)).toHaveLength(3);
    expect(covenant).not.toContain('L');
  });

  it('draws every prerequisite of a vehicle with several', () => {
    const {path} = layoutRoute([vehicle('a'), vehicle('b'), vehicle('c', 'a', 'b')], 'unsc');

    expect(path.match(/M/g)).toHaveLength(2);
  });

  it('handles no vehicles', () => {
    expect(layoutRoute([], 'unsc')).toEqual({stops: [], path: '', rows: 0});
  });
});

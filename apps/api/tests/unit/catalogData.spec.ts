import {describe, expect, it} from 'vite-plus/test';
import {INSTRUCTORS, VEHICLES} from '#src/db/catalogData.ts';

const vehiclesBySlug = new Map(VEHICLES.map((vehicle) => [vehicle.slug, vehicle]));

describe('catalog data', () => {
  it('has unique slugs', () => {
    expect(vehiclesBySlug.size).toBe(VEHICLES.length);
    expect(new Set(INSTRUCTORS.map((instructor) => instructor.slug)).size).toBe(INSTRUCTORS.length);
  });

  it('only requires vehicles of the same faction', () => {
    for (const vehicle of VEHICLES) {
      for (const slug of vehicle.prerequisites) {
        expect(vehiclesBySlug.get(slug)?.faction, `${vehicle.slug} requires ${slug}`).toBe(vehicle.faction);
      }
    }
  });

  it('has every vehicle taught by at least one instructor of its faction', () => {
    for (const vehicle of VEHICLES) {
      const teachers = INSTRUCTORS.filter((instructor) => instructor.vehicles.includes(vehicle.slug));

      expect(teachers.length, vehicle.slug).toBeGreaterThan(0);
      expect(
        teachers.every((instructor) => instructor.faction === vehicle.faction),
        vehicle.slug,
      ).toBe(true);
    }
  });
});

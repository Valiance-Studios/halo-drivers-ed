import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import {connect} from '#src/db/client.ts';
import {instructorVehicles, vehiclePrerequisites} from '#src/db/schema.ts';
import {seedCatalog} from '#src/db/seed.ts';
import {INSTRUCTORS, VEHICLES} from '#src/db/catalogData.ts';
import {PostgresAllowlistRepository} from '#src/repositories/allowlistRepository.ts';
import {PostgresCatalogRepository} from '#src/repositories/catalogRepository.ts';
import {TEST_DATABASE_URL} from './database.ts';

const {db, close} = connect(TEST_DATABASE_URL, 2);
const catalog = new PostgresCatalogRepository(db);

/** The Postgres error behind a failed Drizzle query, which wraps it in `cause`. */
async function databaseError(query: Promise<unknown>): Promise<{code?: string; constraint?: string}> {
  const error = await query.then(() => null, (failure: unknown) => failure as {cause?: object});

  return (error?.cause ?? error ?? {}) as {code?: string; constraint?: string};
}

beforeAll(async () => {
  await seedCatalog(db);
});

afterAll(async () => {
  await close();
});

describe('catalog', () => {
  it('lists every seeded vehicle with its prerequisites', async () => {
    const vehicles = await catalog.listVehicles();

    expect(vehicles).toHaveLength(VEHICLES.length);
    expect(vehicles.find((vehicle) => vehicle.slug === 'scorpion')).toMatchObject({faction: 'unsc', prerequisites: ['warthog']});
  });

  it('lists every seeded instructor with the vehicles they teach', async () => {
    const instructors = await catalog.listInstructors();

    expect(instructors).toHaveLength(INSTRUCTORS.length);
    expect(instructors.find((instructor) => instructor.slug === 'prophet-of-truth')?.vehicles).toEqual(['scarab']);
  });

  it('can be seeded again without duplicating anything', async () => {
    await seedCatalog(db);

    expect(await catalog.listVehicles()).toHaveLength(VEHICLES.length);
  });

  it('rejects an instructor teaching another faction\'s vehicle', async () => {
    const error = await databaseError(db.insert(instructorVehicles).values({instructorSlug: 'arbiter', vehicleSlug: 'warthog', faction: 'covenant'}));

    expect(error.constraint).toBe('instructor_vehicles_vehicle_fkey');
  });

  it('rejects a vehicle that requires itself', async () => {
    const error = await databaseError(db.insert(vehiclePrerequisites).values({vehicleSlug: 'ghost', prerequisiteSlug: 'ghost'}));

    expect(error.constraint).toBe('vehicle_prerequisites_not_self');
  });
});

describe('allowlist', () => {
  const allowlist = new PostgresAllowlistRepository(db);

  it('finds an allowed account by email, whatever its case', async () => {
    await allowlist.allow('Cadet@Example.com', 'admin');

    expect(await allowlist.findRole('CADET@example.com')).toBe('admin');
    expect(await allowlist.findRole('stranger@example.com')).toBeNull();
  });
});

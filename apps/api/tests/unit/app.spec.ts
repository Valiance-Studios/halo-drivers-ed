import type {Booking, Instructor, Role, Vehicle} from '@hde/shared';
import type {AppDependencies} from '#src/app.ts';
import type {TokenVerifier} from '#src/auth/tokenVerifier.ts';
import type {BookingRepository} from '#src/repositories/bookingRepository.ts';

import {describe, expect, it, vi} from 'vite-plus/test';
import {createApp} from '#src/app.ts';
import {BookingService} from '#src/bookings/bookingService.ts';

const VEHICLE: Vehicle = {
  slug: 'warthog',
  name: 'Warthog',
  faction: 'unsc',
  domain: 'ground',
  description: '',
  lessonMinutes: 60,
  lessonsRequired: 4,
  prerequisites: ['mongoose'],
};
const INSTRUCTOR: Instructor = {
  slug: 'sergeant-johnson',
  name: 'Sergeant Johnson',
  title: 'Sergeant Major',
  faction: 'unsc',
  bio: '',
  vehicles: ['warthog'],
};

const BOOKING: Booking = {
  id: '0b0e7c1e-3f0a-4c55-9f5e-0d1f6f0a7c11',
  vehicleSlug: 'warthog',
  instructorSlug: 'sergeant-johnson',
  startsAt: '2026-06-09T12:00:00.000Z',
  endsAt: '2026-06-09T13:00:00.000Z',
  status: 'booked',
};

/** Holds one lesson, which belongs to pat@example.com. */
const bookingRepository: BookingRepository = {
  listForStudent: async (email) => (email === 'pat@example.com' ? [BOOKING] : []),
  listAvailability: async () => [],
  listBusy: async () => [],
  create: async () => null,
  cancel: async () => null,
};
const catalog = {listVehicles: async () => [VEHICLE], listInstructors: async () => [INSTRUCTOR]};

/** Accepts the ID token "valid-<email>" and the App Check token "app". */
const verifier: TokenVerifier = {
  async verifyIdToken(token) {
    if (!token.startsWith('valid-')) {
      throw new Error('bad token');
    }

    return {uid: 'uid', email: token.slice('valid-'.length)};
  },
  async verifyAppCheckToken(token) {
    if (token !== 'app') {
      throw new Error('bad App Check token');
    }
  },
};

function makeApp(overrides: Partial<AppDependencies> = {}) {
  const roles: Record<string, Role> = {'pat@example.com': 'admin'};

  return createApp({
    appCheck: 'required',
    verifier,
    allowlist: {findRole: vi.fn(async (email: string) => roles[email.toLowerCase()] ?? null)},
    catalog,
    bookings: new BookingService(bookingRepository, catalog),
    ...overrides,
  });
}

function get(app: ReturnType<typeof makeApp>, path: string, headers: Record<string, string> = {}) {
  return app.request(path, {headers});
}

const SIGNED_IN = {'Authorization': 'Bearer valid-Pat@Example.com', 'X-Firebase-AppCheck': 'app'};

describe('API', () => {
  it('answers the health check without any tokens', async () => {
    const response = await get(makeApp(), '/api/health');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({status: 'ok'});
  });

  it('returns the signed-in account with its email lowercased', async () => {
    const response = await get(makeApp(), '/api/me', SIGNED_IN);

    expect(await response.json()).toEqual({email: 'pat@example.com', role: 'admin'});
  });

  it('serves the catalog to allowlisted accounts', async () => {
    const app = makeApp();

    expect(await (await get(app, '/api/vehicles', SIGNED_IN)).json()).toEqual([VEHICLE]);
    expect(await (await get(app, '/api/instructors', SIGNED_IN)).json()).toEqual([INSTRUCTOR]);
  });

  it('rejects a request without a valid App Check token', async () => {
    const response = await get(makeApp(), '/api/vehicles', {...SIGNED_IN, 'X-Firebase-AppCheck': 'forged'});

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({error: {code: 'app-check-failed'}});
  });

  it('skips App Check when it is off', async () => {
    const response = await get(makeApp({appCheck: 'off'}), '/api/me', {Authorization: SIGNED_IN.Authorization});

    expect(response.status).toBe(200);
  });

  it('rejects a missing or invalid ID token', async () => {
    const app = makeApp();

    expect((await get(app, '/api/me', {'X-Firebase-AppCheck': 'app'})).status).toBe(401);
    expect((await get(app, '/api/me', {'Authorization': 'Bearer expired', 'X-Firebase-AppCheck': 'app'})).status).toBe(
      401,
    );
  });

  it('rejects accounts that are not on the allowlist', async () => {
    const response = await get(makeApp(), '/api/vehicles', {
      ...SIGNED_IN,
      Authorization: 'Bearer valid-stranger@example.com',
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({error: {code: 'not-allowed'}});
  });

  it("lists the signed-in student's lessons", async () => {
    expect(await (await get(makeApp(), '/api/bookings', SIGNED_IN)).json()).toEqual([BOOKING]);
  });

  it.each(['/api/bookings', '/api/slots'])('needs a signed-in account for %s', async (path) => {
    expect((await get(makeApp(), path, {'X-Firebase-AppCheck': 'app'})).status).toBe(401);
  });

  it.each(['not json', '{}', '{"vehicleSlug":"warthog","instructorSlug":"sergeant-johnson","startsAt":"soon"}'])(
    'rejects the booking request %s',
    async (body) => {
      const response = await makeApp().request('/api/bookings', {method: 'POST', headers: SIGNED_IN, body});

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({error: {code: 'invalid-request'}});
    },
  );

  it.each(['not-a-uuid', BOOKING.id])('answers cancelling an unknown lesson (%s) with a 404', async (id) => {
    const response = await makeApp().request(`/api/bookings/${id}/cancel`, {method: 'POST', headers: SIGNED_IN});

    expect(response.status).toBe(404);
  });

  it('answers unknown endpoints with a JSON 404', async () => {
    const response = await get(makeApp(), '/api/nope', SIGNED_IN);

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({error: {code: 'not-found'}});
  });

  it('hides the details of unexpected errors', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const app = makeApp({
      catalog: {
        listVehicles: async () => Promise.reject(new Error('connection refused')),
        listInstructors: async () => [],
      },
    });
    const response = await get(app, '/api/vehicles', SIGNED_IN);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({error: {code: 'internal', message: 'Something went wrong.'}});
  });
});

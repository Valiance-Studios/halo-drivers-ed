import type {Instructor, Role, Vehicle} from '@hde/shared';
import type {AppDependencies} from '#src/app.ts';
import type {TokenVerifier} from '#src/auth/tokenVerifier.ts';

import {describe, expect, it, vi} from 'vite-plus/test';
import {createApp} from '#src/app.ts';

const VEHICLE: Vehicle = {
  slug: 'warthog', name: 'Warthog', faction: 'unsc', domain: 'ground', description: '', lessonMinutes: 60, lessonsRequired: 4, prerequisites: ['mongoose'],
};
const INSTRUCTOR: Instructor = {slug: 'sergeant-johnson', name: 'Sergeant Johnson', title: 'Sergeant Major', faction: 'unsc', bio: '', vehicles: ['warthog']};

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
    catalog: {listVehicles: async () => [VEHICLE], listInstructors: async () => [INSTRUCTOR]},
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
    expect((await get(app, '/api/me', {'Authorization': 'Bearer expired', 'X-Firebase-AppCheck': 'app'})).status).toBe(401);
  });

  it('rejects accounts that are not on the allowlist', async () => {
    const response = await get(makeApp(), '/api/vehicles', {...SIGNED_IN, Authorization: 'Bearer valid-stranger@example.com'});

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({error: {code: 'not-allowed'}});
  });

  it('answers unknown endpoints with a JSON 404', async () => {
    const response = await get(makeApp(), '/api/nope', SIGNED_IN);

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({error: {code: 'not-found'}});
  });

  it('hides the details of unexpected errors', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const app = makeApp({catalog: {listVehicles: async () => Promise.reject(new Error('connection refused')), listInstructors: async () => []}});
    const response = await get(app, '/api/vehicles', SIGNED_IN);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({error: {code: 'internal', message: 'Something went wrong.'}});
  });
});

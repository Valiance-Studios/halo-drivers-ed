import type {TokenSource} from '@/services/apiClient';

import {describe, expect, it, vi} from 'vite-plus/test';
import {ApiClient, ApiRequestError} from '@/services/apiClient';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}});
}

const tokens: TokenSource = {idToken: async () => 'id-token', appCheckToken: async () => 'app-check-token'};

describe('ApiClient', () => {
  it('sends the ID and App Check tokens', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, {email: 'pat@example.com', role: 'admin'}));
    const me = await new ApiClient(tokens, '/api', fetchImpl).getMe();

    expect(me).toEqual({email: 'pat@example.com', role: 'admin'});
    expect(fetchImpl).toHaveBeenCalledWith('/api/me', {
      headers: {
        'Accept': 'application/json',
        'Authorization': 'Bearer id-token',
        'X-Firebase-AppCheck': 'app-check-token',
      },
    });
  });

  it('leaves out tokens it does not have', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, []));
    await new ApiClient({idToken: async () => null, appCheckToken: async () => null}, '/api', fetchImpl).listVehicles();

    expect(fetchImpl).toHaveBeenCalledWith('/api/vehicles', {headers: {Accept: 'application/json'}});
  });

  it('turns an API error into an ApiRequestError with its code', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(403, {error: {code: 'not-allowed', message: 'Nope.'}}));
    const error = await new ApiClient(tokens, '/api', fetchImpl).getMe().catch((failure: unknown) => failure);

    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error).toMatchObject({status: 403, code: 'not-allowed', message: 'Nope.'});
  });

  it('reports a failure without an API error body', async () => {
    const fetchImpl = vi.fn(async () => new Response('Bad Gateway', {status: 502}));
    const error = await new ApiClient(tokens, '/api', fetchImpl).getMe().catch((failure: unknown) => failure);

    expect(error).toMatchObject({status: 502, code: null});
  });
});

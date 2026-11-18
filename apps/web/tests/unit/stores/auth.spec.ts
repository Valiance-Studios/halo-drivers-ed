import type {User} from 'firebase/auth';

import {beforeEach, describe, expect, it, vi} from 'vitest';
import {createPinia, setActivePinia} from 'pinia';
import {ApiRequestError} from '@/services/apiClient';
import {NOT_ALLOWED_MESSAGE, useAuthStore} from '@/stores/auth';

const mocks = vi.hoisted(() => ({
  getMe: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChanged: vi.fn(),
}));

vi.mock('@/plugins/firebase', () => ({auth: {}, firebaseTokens: {}}));
vi.mock('@/services/api', () => ({api: {getMe: mocks.getMe}}));
vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: vi.fn(),
  onAuthStateChanged: mocks.onAuthStateChanged,
  signInWithPopup: vi.fn(),
  signOut: mocks.signOut,
}));

const firebaseUser = {uid: 'u1', email: 'pat@example.com', displayName: 'Pat'} as User;
const notAllowed = new ApiRequestError(403, 'not-allowed', 'This account is not authorized to use this app.');

describe('auth store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('accepts accounts the API allows, with their role', async () => {
    mocks.getMe.mockResolvedValue({email: 'pat@example.com', role: 'admin'});
    const store = useAuthStore();
    await store.applyUser(firebaseUser);

    expect(store.isAllowed).toBe(true);
    expect(store.user).toEqual({uid: 'u1', email: 'pat@example.com', displayName: 'Pat', role: 'admin'});
  });

  it('signs out accounts that are not on the allowlist', async () => {
    mocks.getMe.mockRejectedValue(notAllowed);
    const store = useAuthStore();
    await store.applyUser(firebaseUser);

    expect(store.isAllowed).toBe(false);
    expect(store.errorMessage).toBe(NOT_ALLOWED_MESSAGE);
    expect(mocks.signOut).toHaveBeenCalledTimes(1);
  });

  it('reports a failed check without signing out or hanging initialization', async () => {
    mocks.getMe.mockRejectedValue(new Error('Failed to fetch'));
    mocks.onAuthStateChanged.mockImplementation((_auth, callback: (user: User | null) => void) => {
      callback(firebaseUser);
    });
    const store = useAuthStore();
    await store.init();

    expect(store.isAllowed).toBe(false);
    expect(store.errorMessage).toBe('Could not verify access: Failed to fetch');
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it('shares one check between the sign-in and the auth listener', async () => {
    mocks.getMe.mockRejectedValue(notAllowed);
    const store = useAuthStore();
    await Promise.all([store.applyUser(firebaseUser), store.applyUser(firebaseUser)]);

    expect(mocks.getMe).toHaveBeenCalledTimes(1);
    expect(mocks.signOut).toHaveBeenCalledTimes(1);
  });

  it('checks again after a failed check, so a retry can succeed', async () => {
    mocks.getMe.mockRejectedValueOnce(new Error('Offline.'));
    mocks.getMe.mockResolvedValueOnce({email: 'pat@example.com', role: 'admin'});
    const store = useAuthStore();
    await store.applyUser(firebaseUser);
    await store.applyUser(firebaseUser);

    expect(mocks.getMe).toHaveBeenCalledTimes(2);
    expect(store.isAllowed).toBe(true);
    expect(store.errorMessage).toBeNull();
  });
});

import type {User} from 'firebase/auth';

import {beforeEach, describe, expect, it, vi} from 'vite-plus/test';
import {createPinia, setActivePinia} from 'pinia';
import {ApiRequestError} from '@/services/apiClient';
import {NOT_ALLOWED_MESSAGE, useAuthStore} from '@/stores/auth';

const mocks = vi.hoisted(() => ({
  getMe: vi.fn(),
  startDemo: vi.fn(),
  endDemo: vi.fn(),
  signInAnonymously: vi.fn(),
  deleteUser: vi.fn(),
  auth: {currentUser: null as User | null},
  signOut: vi.fn(),
  onAuthStateChanged: vi.fn(),
}));

vi.mock('@/plugins/firebase', () => ({auth: mocks.auth, firebaseTokens: {}}));
vi.mock('@/services/api', () => ({
  api: {getMe: mocks.getMe, startDemo: mocks.startDemo, endDemo: mocks.endDemo},
}));
vi.mock('firebase/auth', () => ({
  deleteUser: mocks.deleteUser,
  GoogleAuthProvider: vi.fn(),
  onAuthStateChanged: mocks.onAuthStateChanged,
  signInAnonymously: mocks.signInAnonymously,
  signInWithPopup: vi.fn(),
  signOut: mocks.signOut,
}));

const firebaseUser = {uid: 'u1', email: 'pat@example.com', displayName: 'Pat'} as User;
const guestUser = {uid: 'g1', email: null, displayName: null, isAnonymous: true} as User;
const notAllowed = new ApiRequestError(403, 'not-allowed', 'This account is not authorized to use this app.');

describe('auth store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    mocks.auth.currentUser = null;
    mocks.deleteUser.mockResolvedValue(undefined);
  });

  it('accepts accounts the API allows, with their role', async () => {
    mocks.getMe.mockResolvedValue({email: 'pat@example.com', role: 'admin', demoEndsAt: null});
    const store = useAuthStore();
    await store.applyUser(firebaseUser);

    expect(store.isAllowed).toBe(true);
    expect(store.user).toEqual({
      uid: 'u1',
      email: 'pat@example.com',
      displayName: 'Pat',
      role: 'admin',
      demoEndsAt: null,
    });
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
    mocks.getMe.mockResolvedValueOnce({email: 'pat@example.com', role: 'admin', demoEndsAt: null});
    const store = useAuthStore();
    await store.applyUser(firebaseUser);
    await store.applyUser(firebaseUser);

    expect(mocks.getMe).toHaveBeenCalledTimes(2);
    expect(store.isAllowed).toBe(true);
    expect(store.errorMessage).toBeNull();
  });

  describe('demo', () => {
    beforeEach(() => {
      mocks.signInAnonymously.mockResolvedValue({user: guestUser});
      mocks.endDemo.mockResolvedValue(undefined);
      mocks.startDemo.mockResolvedValue({claimed: true, endsAt: '2026-06-09T12:00:00.000Z'});
      mocks.getMe.mockResolvedValue({
        email: 'guest-1@demo.invalid',
        role: 'guest',
        demoEndsAt: '2026-06-09T12:00:00.000Z',
      });
    });

    it('claims a place, then frees it and deletes the account on signing out', async () => {
      const store = useAuthStore();
      await store.startDemo();

      expect(store.isAllowed).toBe(true);
      expect(store.user).toMatchObject({displayName: 'Demo guest', role: 'guest'});

      mocks.auth.currentUser = guestUser;
      await store.signOut();
      expect(mocks.endDemo).toHaveBeenCalledTimes(1);
      expect(mocks.deleteUser).toHaveBeenCalledWith(guestUser);
      expect(mocks.signOut).not.toHaveBeenCalled();
    });

    it('signs out when Firebase refuses to delete the account', async () => {
      mocks.deleteUser.mockRejectedValue(new Error('auth/requires-recent-login'));
      mocks.auth.currentUser = guestUser;
      await useAuthStore().signOut();

      expect(mocks.signOut).toHaveBeenCalledTimes(1);
    });

    it('says when the next place frees up', async () => {
      mocks.startDemo.mockResolvedValue({claimed: false, nextFreeAt: '2026-06-09T12:00:00.000Z'});
      const store = useAuthStore();
      await store.startDemo();

      expect(store.isAllowed).toBe(false);
      expect(store.errorMessage).toMatch(/^Every demo place is taken\. The next place frees up at \d/);
      expect(mocks.deleteUser).toHaveBeenCalledTimes(1);
    });

    it('does not start another when a page is reloaded after the demo ended', async () => {
      mocks.getMe.mockRejectedValue(new ApiRequestError(403, 'demo-ended', 'Your demo has ended.'));
      const store = useAuthStore();
      await store.applyUser(guestUser);

      expect(mocks.startDemo).not.toHaveBeenCalled();
      expect(store.errorMessage).toBe('Your demo has ended.');
      expect(mocks.deleteUser).toHaveBeenCalledTimes(1);
    });
  });
});

import type {User} from 'firebase/auth';
import type {Role} from '@hde/shared';

import {defineStore} from 'pinia';
import {GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut as signOutFirebase} from 'firebase/auth';
import {auth} from '@/plugins/firebase';
import {api} from '@/services/api';
import {ApiRequestError} from '@/services/apiClient';

export interface AuthUser {
  uid: string;
  email: string;
  displayName: string;
  role: Role;
}

export interface AuthState {
  user: AuthUser | null;
  isAllowed: boolean;
  errorMessage: string | null;
}

export const NOT_ALLOWED_MESSAGE = 'This Google account is not authorized to use this app.';

let initialization: Promise<void> | null = null;

interface PendingAccessCheck {
  uid: string;
  result: Promise<void>;
}

/**
 * The access check in progress. Firebase reports a sign-in to both the popup's caller and the auth
 * listener, so they share one check: one `GET /api/me` and, for a denied account, one sign-out.
 * Only kept while running, so a later attempt always checks again.
 */
let pendingAccessCheck: PendingAccessCheck | null = null;

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    user: null,
    isAllowed: false,
    errorMessage: null,
  }),
  getters: {
    isAdmin: (state): boolean => state.user?.role === 'admin',
  },
  actions: {
    /** Resolves once the initial auth state is known; safe to call repeatedly. */
    init(): Promise<void> {
      initialization ??= new Promise((resolve) => {
        onAuthStateChanged(auth, async (firebaseUser) => {
          try {
            await this.applyUser(firebaseUser);
          } finally {
            resolve();
          }
        });
      });

      return initialization;
    },
    async applyUser(firebaseUser: User | null): Promise<void> {
      if (!firebaseUser) {
        this.user = null;
        this.isAllowed = false;

        return;
      }

      if (pendingAccessCheck?.uid !== firebaseUser.uid) {
        const check: PendingAccessCheck = {
          uid: firebaseUser.uid,
          result: this.checkAccess(firebaseUser).finally(() => {
            if (pendingAccessCheck === check) {
              pendingAccessCheck = null;
            }
          }),
        };
        pendingAccessCheck = check;
      }

      await pendingAccessCheck.result;
    },
    /** Asks the API, which holds the allowlist, whether this account may use the app. */
    async checkAccess(firebaseUser: User): Promise<void> {
      let role: Role;

      try {
        ({role} = await api.getMe());
      } catch (error) {
        this.user = null;
        this.isAllowed = false;

        if (error instanceof ApiRequestError && error.code === 'not-allowed') {
          this.errorMessage = NOT_ALLOWED_MESSAGE;
          await signOutFirebase(auth);

          return;
        }

        // Stay signed in so a retry can succeed once the problem (e.g. being offline) is resolved.
        this.errorMessage = `Could not verify access: ${error instanceof Error ? error.message : 'unknown error'}`;

        return;
      }

      const email = firebaseUser.email ?? '';
      this.user = {uid: firebaseUser.uid, email, displayName: firebaseUser.displayName ?? email, role};
      this.isAllowed = true;
      this.errorMessage = null;
    },
    async signIn(): Promise<void> {
      this.errorMessage = null;

      try {
        const credential = await signInWithPopup(auth, new GoogleAuthProvider());
        await this.applyUser(credential.user);
      } catch (error) {
        this.errorMessage = error instanceof Error ? error.message : 'Sign-in failed.';
      }
    },
    async signOut(): Promise<void> {
      await signOutFirebase(auth);
      this.user = null;
      this.isAllowed = false;
    },
  },
});

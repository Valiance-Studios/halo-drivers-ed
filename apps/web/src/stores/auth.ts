import type {User} from 'firebase/auth';
import type {Me} from '@hde/shared';

import {defineStore} from 'pinia';
import {
  deleteUser,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInAnonymously,
  signInWithPopup,
  signOut as signOutFirebase,
} from 'firebase/auth';
import {auth} from '@/plugins/firebase';
import {api} from '@/services/api';
import {ApiRequestError} from '@/services/apiClient';

export interface AuthUser {
  uid: string;
  email: string;
  displayName: string;
  role: Me['role'];
  /** When a guest's demo ends; null for everyone else. */
  demoEndsAt: string | null;
}

export interface AuthState {
  user: AuthUser | null;
  isAllowed: boolean;
  errorMessage: string | null;
}

export const NOT_ALLOWED_MESSAGE = 'This Google account is not authorized to use this app.';

/** Whether the visitor asked for a demo, rather than reloading the page after theirs ended. */
let demoRequested = false;

/** Why a demo could not start. */
export function demoFullMessage(nextFreeAt: string | null): string {
  const when = nextFreeAt
    ? ` The next place frees up at ${new Date(nextFreeAt).toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'})}.`
    : '';

  return `Every demo place is taken.${when}`;
}

/**
 * Signs a demo visitor out by deleting their anonymous account, which is of no more use. Firebase can refuse (if
 * they signed in a while ago, say), so then it only signs them out.
 */
async function discardGuest(firebaseUser: User): Promise<void> {
  try {
    await deleteUser(firebaseUser);
  } catch {
    await signOutFirebase(auth);
  }
}

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
      let me: Me;

      try {
        if (firebaseUser.isAnonymous && demoRequested) {
          const session = await api.startDemo();

          if (!session.claimed) {
            this.errorMessage = demoFullMessage(session.nextFreeAt);
            await discardGuest(firebaseUser);

            return;
          }
        }

        me = await api.getMe();
      } catch (error) {
        this.user = null;
        this.isAllowed = false;

        if (error instanceof ApiRequestError && error.code === 'not-allowed') {
          this.errorMessage = NOT_ALLOWED_MESSAGE;
          await signOutFirebase(auth);

          return;
        }

        if (error instanceof ApiRequestError && error.code === 'demo-ended') {
          this.errorMessage = error.message;
          await discardGuest(firebaseUser);

          return;
        }

        // Stay signed in so a retry can succeed once the problem (e.g. being offline) is resolved.
        this.errorMessage = `Could not verify access: ${error instanceof Error ? error.message : 'unknown error'}`;

        return;
      }

      const {email, role, demoEndsAt} = me;
      const displayName = role === 'guest' ? 'Demo guest' : (firebaseUser.displayName ?? email);
      this.user = {uid: firebaseUser.uid, email, displayName, role, demoEndsAt};
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
    /** Signs in as a guest, if there is a demo place free. */
    async startDemo(): Promise<void> {
      this.errorMessage = null;
      demoRequested = true;

      try {
        const credential = await signInAnonymously(auth);
        await this.applyUser(credential.user);
      } catch (error) {
        this.errorMessage = error instanceof Error ? error.message : 'Could not start the demo.';
      } finally {
        demoRequested = false;
      }
    },
    async signOut(): Promise<void> {
      if (this.user?.role === 'guest') {
        // Frees the place for someone else. If it fails, the place frees up when the session ends.
        await api.endDemo().catch(() => {});
      }

      if (auth.currentUser?.isAnonymous) {
        await discardGuest(auth.currentUser);
      } else {
        await signOutFirebase(auth);
      }

      this.user = null;
      this.isAllowed = false;
    },
  },
});

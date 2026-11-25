import type {DecodedIdToken} from 'firebase-admin/auth';

import {initializeApp} from 'firebase-admin/app';
import {getAppCheck} from 'firebase-admin/app-check';
import {getAuth} from 'firebase-admin/auth';

export interface VerifiedUser {
  uid: string;
  /** Null for accounts without a verified one, such as anonymous ones. */
  email: string | null;
  /** Whether this is an anonymous account, as demo visitors use. */
  isAnonymous: boolean;
  /** The account's name, if it has one. */
  displayName: string | null;
}

/** Checks the tokens a request carries. An interface, so the HTTP layer can be tested without Firebase. */
export interface TokenVerifier {
  /** Resolves to the signed-in account, or rejects if the Firebase ID token is invalid or expired. */
  verifyIdToken(token: string): Promise<VerifiedUser>;
  /** Rejects unless the App Check token was issued to one of this project's apps. */
  verifyAppCheckToken(token: string): Promise<void>;
}

const MAX_NAME_LENGTH = 100;

/** What the app uses of a valid ID token. */
export function toVerifiedUser(token: DecodedIdToken): VerifiedUser {
  const {uid, email, email_verified: emailVerified, name, firebase} = token;

  // The name comes from the account's owner, so its type and length are not taken on trust.
  const ownName: unknown = name;
  const displayName = typeof ownName === 'string' ? ownName.trim().slice(0, MAX_NAME_LENGTH) || null : null;

  // Anyone could register an allowlisted address, so one whose owner has not proved it counts as none.
  return {
    uid,
    email: emailVerified === true ? (email ?? null) : null,
    isAnonymous: firebase.sign_in_provider === 'anonymous',
    displayName,
  };
}

/**
 * Verifies tokens with the Firebase Admin SDK. Both checks use Google's public keys, so the service
 * account needs no Firebase roles. With FIREBASE_AUTH_EMULATOR_HOST set, ID tokens come from the emulator.
 */
export function createFirebaseTokenVerifier(projectId: string): TokenVerifier {
  const app = initializeApp({projectId});
  const auth = getAuth(app);
  const appCheck = getAppCheck(app);

  return {
    async verifyIdToken(token) {
      return toVerifiedUser(await auth.verifyIdToken(token));
    },
    async verifyAppCheckToken(token) {
      await appCheck.verifyToken(token);
    },
  };
}

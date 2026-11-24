import {initializeApp} from 'firebase-admin/app';
import {getAppCheck} from 'firebase-admin/app-check';
import {getAuth} from 'firebase-admin/auth';

export interface VerifiedUser {
  uid: string;
  /** Null for accounts without one, such as the anonymous demo guests to come. */
  email: string | null;
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
      const decoded = await auth.verifyIdToken(token);

      // The name comes from the account's owner, so its type and length are not taken on trust.
      const name: unknown = decoded.name;
      const displayName = typeof name === 'string' ? name.trim().slice(0, MAX_NAME_LENGTH) || null : null;

      return {uid: decoded.uid, email: decoded.email ?? null, displayName};
    },
    async verifyAppCheckToken(token) {
      await appCheck.verifyToken(token);
    },
  };
}

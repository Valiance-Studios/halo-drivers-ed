import type {AppCheck} from 'firebase/app-check';
import type {TokenSource} from '@/services/apiClient';

import {initializeApp} from 'firebase/app';
import {getToken} from 'firebase/app-check';
import {connectAuthEmulator, getAuth} from 'firebase/auth';
import {activateAppCheck} from '@/plugins/appCheck';

const env = import.meta.env;
const useEmulators = env.VITE_USE_FIREBASE_EMULATORS === 'true';

const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID,
});

// Before Auth exists, so every request it makes carries an App Check token. The emulators do not enforce
// App Check (and the local API turns it off), so local development and the E2E tests run without it.
const appCheck: AppCheck | null = useEmulators
  ? null
  : activateAppCheck(app, {siteKey: env.VITE_APPCHECK_SITE_KEY, debugToken: env.VITE_APPCHECK_DEBUG_TOKEN});

export const auth = getAuth(app);

if (useEmulators) {
  // Use localhost (same site as the dev server) so the emulator's popup and iframe share storage.
  connectAuthEmulator(auth, 'http://localhost:9099', {disableWarnings: true});
}

/** The tokens the API checks on every request: the signed-in user's ID token and an App Check token. */
export const firebaseTokens: TokenSource = {
  async idToken() {
    return auth.currentUser ? auth.currentUser.getIdToken() : null;
  },
  async appCheckToken() {
    return appCheck ? (await getToken(appCheck)).token : null;
  },
};

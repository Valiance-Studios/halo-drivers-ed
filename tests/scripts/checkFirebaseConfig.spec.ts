import {describe, expect, it} from 'vite-plus/test';
import {findConfigProblems} from '../../scripts/check-firebase-config.ts';

const COMPLETE = {
  VITE_FIREBASE_API_KEY: 'key',
  VITE_FIREBASE_AUTH_DOMAIN: 'vs-halo-drivers-ed-dev.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID: 'vs-halo-drivers-ed-dev',
  VITE_FIREBASE_APP_ID: 'app',
  VITE_APPCHECK_SITE_KEY: 'site-key',
};

describe('findConfigProblems', () => {
  it('accepts a complete config', () => {
    expect(findConfigProblems(COMPLETE, 'staging')).toEqual([]);
  });

  it('requires the App Check site key', () => {
    expect(findConfigProblems({...COMPLETE, VITE_APPCHECK_SITE_KEY: ''}, 'staging')[0]).toContain('VITE_APPCHECK_SITE_KEY');
  });

  it('refuses an emulator build', () => {
    expect(findConfigProblems({...COMPLETE, VITE_USE_FIREBASE_EMULATORS: 'true'}, 'staging')).toHaveLength(1);
  });

  it('refuses a build with an App Check debug token', () => {
    expect(findConfigProblems({...COMPLETE, VITE_APPCHECK_DEBUG_TOKEN: 'token'}, 'staging')[0]).toContain('debug token');
  });
});

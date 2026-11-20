import {describe, expect, it} from 'vitest';
import {loadConfig} from '#src/config.ts';

const LOCAL = {DATABASE_URL: 'postgres://localhost/db', FIREBASE_PROJECT_ID: 'demo-x'};

describe('loadConfig', () => {
  it('requires App Check unless told otherwise', () => {
    expect(loadConfig(LOCAL)).toEqual({port: 8080, databaseUrl: LOCAL.DATABASE_URL, firebaseProjectId: 'demo-x', appCheck: 'required'});
  });

  it('allows App Check to be turned off locally', () => {
    expect(loadConfig({...LOCAL, APP_CHECK: 'off', PORT: '8081'})).toMatchObject({appCheck: 'off', port: 8081});
  });

  it('rejects an unknown App Check setting', () => {
    expect(() => loadConfig({...LOCAL, APP_CHECK: 'maybe'})).toThrow('APP_CHECK');
  });

  it('requires the database URL and project', () => {
    expect(() => loadConfig({FIREBASE_PROJECT_ID: 'demo-x'})).toThrow('DATABASE_URL');
    expect(() => loadConfig({DATABASE_URL: LOCAL.DATABASE_URL})).toThrow('FIREBASE_PROJECT_ID');
  });

  it('refuses to run on Cloud Run without App Check', () => {
    expect(() => loadConfig({...LOCAL, K_SERVICE: 'hde-api', APP_CHECK: 'off'})).toThrow('Cloud Run');
  });

  it('refuses to trust the Auth emulator on Cloud Run', () => {
    expect(() => loadConfig({...LOCAL, K_SERVICE: 'hde-api', FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099'})).toThrow('emulator');
  });
});

import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vite-plus/test';
import {loadEnv} from 'vite-plus';

interface HostingConfig {
  hosting: {headers: {regex: string; headers: {key: string; value: string}[]}[]};
}

const root = new URL('../../', import.meta.url);
const config = JSON.parse(readFileSync(new URL('firebase.json', root), 'utf8')) as HostingConfig;
const [rule] = config.hosting.headers;

describe('hosting headers', () => {
  it.each(['/', '/index.html', '/login', '/lessons/1/form', '/assets/index_a__b.js', '/_', '/_x'])(
    'cover %s',
    (path) => {
      expect(path).toMatch(new RegExp(rule?.regex ?? ''));
    },
  );

  // The app frames Firebase's sign-in page from the firebaseapp.com domain, which serves the same site.
  it.each(['/__/auth/iframe', '/__/auth/handler'])('leave out %s', (path) => {
    expect(path).not.toMatch(new RegExp(rule?.regex ?? ''));
  });

  it("allow the staging project's sign-in frame", () => {
    const authDomain = loadEnv('staging', new URL('apps/web', root).pathname, 'VITE_').VITE_FIREBASE_AUTH_DOMAIN;
    const policy = rule?.headers.find(({key}) => key === 'Content-Security-Policy')?.value;

    expect(policy).toMatch(new RegExp(`frame-src [^;]*https://${authDomain}[ ;]`));
  });
});

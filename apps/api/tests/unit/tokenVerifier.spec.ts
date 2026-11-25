import type {DecodedIdToken} from 'firebase-admin/auth';

import {describe, expect, it} from 'vite-plus/test';
import {toVerifiedUser} from '#src/auth/tokenVerifier.ts';

function token(claims: Partial<DecodedIdToken>): DecodedIdToken {
  const firebase = {identities: {}, sign_in_provider: 'google.com'};

  return {
    uid: 'uid',
    email: 'pat@example.com',
    email_verified: true,
    name: 'Pat',
    firebase,
    ...claims,
  } as DecodedIdToken;
}

describe('toVerifiedUser', () => {
  it('keeps a verified email', () => {
    expect(toVerifiedUser(token({}))).toEqual({
      uid: 'uid',
      email: 'pat@example.com',
      isAnonymous: false,
      displayName: 'Pat',
    });
  });

  it.each([false, undefined])('treats an email as none when email_verified is %s', (emailVerified) => {
    expect(toVerifiedUser(token({email_verified: emailVerified})).email).toBeNull();
  });

  it('recognizes anonymous accounts', () => {
    const firebase = {identities: {}, sign_in_provider: 'anonymous'};

    expect(toVerifiedUser(token({firebase})).isAnonymous).toBe(true);
  });

  it('does not trust the type or length of the name', () => {
    expect(toVerifiedUser(token({name: 7})).displayName).toBeNull();
    expect(toVerifiedUser(token({name: ` ${'x'.repeat(200)}`})).displayName).toHaveLength(100);
  });
});

/**
 * Admin access to the local Auth emulator, for seeding and tests.
 *
 * Each instance works on one emulator project (see `scripts/emulator-config.ts`), so seeding and tests
 * target the same project as the app.
 */
import type {EmulatorConfig} from './emulator-config.ts';

import {ports} from './emulator-config.ts';

export interface EmulatorAccount {
  email: string;
  displayName: string;
}

/** The emulators accept "owner" as an admin token. */
const ADMIN_HEADERS = {'Authorization': 'Bearer owner', 'Content-Type': 'application/json'};
const AUTH_URL = `http://127.0.0.1:${ports.auth}`;

async function request(url: string, init: RequestInit, action: string): Promise<unknown> {
  const response = await fetch(url, init);

  if (!response.ok) {
    throw new Error(`Could not ${action}: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

export class EmulatorAdmin {
  private readonly config: EmulatorConfig;

  constructor(config: EmulatorConfig) {
    this.config = config;
  }

  /** Deletes every Auth account in this project. */
  async reset(): Promise<void> {
    await request(
      `${AUTH_URL}/emulator/v1/projects/${this.config.projectId}/accounts`,
      {method: 'DELETE'},
      'clear Auth',
    );
  }

  /**
   * Creates a verified Google account in the Auth emulator, the way its sign-in popup does, so the popup
   * then offers it under "Choose an account". Signing in again with the same email reuses the account.
   *
   * Like the app's own sign-ins, this goes to the project the emulators were started with, whatever
   * project the caller names; so it fails if that is not this project rather than seed the wrong one.
   */
  async createGoogleAccount(account: EmulatorAccount): Promise<void> {
    // The Auth emulator accepts an unsigned ID token: just the claims, as JSON.
    const idToken = JSON.stringify({
      sub: account.email,
      email: account.email,
      email_verified: true,
      name: account.displayName,
    });
    const body = {
      requestUri: 'http://localhost',
      postBody: new URLSearchParams({id_token: idToken, providerId: 'google.com'}).toString(),
      returnSecureToken: true,
    };

    await request(
      `${AUTH_URL}/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${this.config.apiKey}`,
      {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(body),
      },
      `create ${account.email}`,
    );

    if (!(await this.hasAccount(account.email))) {
      throw new Error(
        `${account.email} was created outside project "${this.config.projectId}": the emulators are running as another project.`,
      );
    }
  }

  private async hasAccount(email: string): Promise<boolean> {
    const url = `${AUTH_URL}/identitytoolkit.googleapis.com/v1/projects/${this.config.projectId}/accounts:lookup`;
    const result = (await request(
      url,
      {method: 'POST', headers: ADMIN_HEADERS, body: JSON.stringify({email: [email]})},
      `look up ${email}`,
    )) as {users?: unknown[]};

    return (result.users?.length ?? 0) > 0;
  }
}

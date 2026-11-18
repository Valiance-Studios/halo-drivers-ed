/** The API's settings, read from the environment. */
export interface Config {
  port: number;
  databaseUrl: string;
  /** The Firebase project whose ID and App Check tokens the API accepts. */
  firebaseProjectId: string;
  /** Whether requests must carry a valid App Check token. Only the emulators run without one. */
  appCheck: 'required' | 'off';
}

type Env = Record<string, string | undefined>;

function required(env: Env, name: string): string {
  const value = env[name];

  if (!value) {
    throw new Error(`${name} is not set.`);
  }

  return value;
}

export function loadConfig(env: Env = process.env): Config {
  const appCheck = env.APP_CHECK ?? 'required';

  if (appCheck !== 'required' && appCheck !== 'off') {
    throw new Error(`APP_CHECK must be "required" or "off", not "${appCheck}".`);
  }

  // Cloud Run sets K_SERVICE. A deployed API must never skip App Check or trust the Auth emulator, whose
  // tokens are unsigned: either would let anyone call it.
  if (env.K_SERVICE) {
    if (appCheck === 'off') {
      throw new Error('APP_CHECK=off is only for local development; refusing to start on Cloud Run.');
    }

    if (env.FIREBASE_AUTH_EMULATOR_HOST) {
      throw new Error('FIREBASE_AUTH_EMULATOR_HOST is set; refusing to trust emulator tokens on Cloud Run.');
    }
  }

  return {
    port: Number(env.PORT ?? 8080),
    databaseUrl: required(env, 'DATABASE_URL'),
    firebaseProjectId: required(env, 'FIREBASE_PROJECT_ID'),
    appCheck,
  };
}

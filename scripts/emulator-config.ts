/**
 * The Firebase emulator settings shared by the scripts and the E2E tests.
 *
 * The project and API key come from `apps/web/.env.development`, the env file of Vite's development mode,
 * which configures the app for the emulators. Its `demo-` project is used by local development and by the
 * E2E tests, which start their own emulators. The ports come from `firebase.json`. The real project stays
 * the default in `.firebaserc`, so the scripts pass the project id to the Firebase CLI explicitly.
 */
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {loadEnv} from 'vite-plus';

export interface EmulatorConfig {
  projectId: string;
  apiKey: string;
}

function loadEmulatorConfig(): EmulatorConfig {
  const env = loadEnv('development', fileURLToPath(new URL('../apps/web', import.meta.url)), 'VITE_');
  const projectId = env.VITE_FIREBASE_PROJECT_ID ?? '';

  // The `demo-` prefix is what keeps the emulators from ever reaching real Firebase resources.
  if (!projectId.startsWith('demo-')) {
    throw new Error(`Refusing to use project "${projectId}" with the emulators: the project id in apps/web/.env.development must start with "demo-".`);
  }

  return {projectId, apiKey: env.VITE_FIREBASE_API_KEY ?? ''};
}

export const emulatorConfig = loadEmulatorConfig();

interface EmulatorsConfig {
  auth: {port: number};
  [emulator: string]: unknown;
}

const emulators = (JSON.parse(readFileSync(new URL('../firebase.json', import.meta.url), 'utf8')) as {emulators: EmulatorsConfig}).emulators;

export const ports = {auth: emulators.auth.port};

/** Every port declared in firebase.json's `emulators` section. */
export function configuredPorts(): number[] {
  return Object.values(emulators)
    .map((emulator) => (emulator as {port?: unknown} | null)?.port)
    .filter((port): port is number => typeof port === 'number');
}

/** The variable that points Firebase SDKs (such as the API's) at the emulator, as `emulators:exec` sets it. */
export const emulatorHostEnv = {
  FIREBASE_AUTH_EMULATOR_HOST: `127.0.0.1:${ports.auth}`,
};

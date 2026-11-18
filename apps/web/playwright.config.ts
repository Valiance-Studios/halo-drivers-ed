import {fileURLToPath} from 'node:url';
import {defineConfig, devices} from '@playwright/test';
import {E2E_DATABASE_URL} from './e2e/database.ts';

const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const APP_PORT = 5174;
const API_PORT = 8082;
const APP_URL = `http://localhost:${APP_PORT}`;

/*
 * Every server is the run's own, on its own port, never one already running: a dev server started with
 * `npm run dev:staging` talks to the real Firebase project, and globalSetup resets the emulator's accounts.
 * Postgres itself must be running (`npm run db:up`; a service container on CI).
 */
export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/globalSetup.ts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  // On CI: annotations on the PR, plus an HTML report (with traces) uploaded when the job fails.
  reporter: process.env.CI ? [['github'], ['html', {open: 'never'}]] : 'list',
  use: {
    baseURL: APP_URL,
    trace: 'on-first-retry',
  },
  projects: [
    {name: 'chromium', use: {...devices['Desktop Chrome']}},
  ],
  webServer: [
    {
      command: 'node scripts/with-emulators.ts --keep-running --only auth',
      cwd: REPO_ROOT,
      url: 'http://127.0.0.1:4000',
      reuseExistingServer: false,
      timeout: 60_000,
      gracefulShutdown: {signal: 'SIGTERM', timeout: 10_000},
    },
    {
      // Recreates the E2E database, then serves the API against it and the emulator.
      command: 'npm run db:reset && npm run dev',
      cwd: `${REPO_ROOT}/apps/api`,
      env: {DATABASE_URL: E2E_DATABASE_URL, PORT: String(API_PORT)},
      url: `http://127.0.0.1:${API_PORT}/api/health`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      // Vite's development mode (.env.development: the emulators), proxying /api to the API above.
      command: `npx vite --port ${APP_PORT} --strictPort`,
      cwd: `${REPO_ROOT}/apps/web`,
      env: {HDE_API_URL: `http://localhost:${API_PORT}`},
      url: APP_URL,
      reuseExistingServer: false,
    },
  ],
});

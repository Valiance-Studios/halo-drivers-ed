import {defineConfig} from 'vite-plus';

/**
 * The API's database tests, against the local Postgres (`npm run db:up`) in their own database, which
 * each run recreates (apps/api/tests/db/setup.ts).
 */
export default defineConfig({
  test: {
    name: 'api-db',
    root: 'apps/api',
    environment: 'node',
    include: ['tests/db/**/*.spec.ts'],
    globalSetup: ['tests/db/setup.ts'],
    // The tests share one database.
    fileParallelism: false,
  },
});

import {defineConfig} from 'vitest/config';

// Unit tests only; they need no database or emulators. `npm run test:db` and `npm run test:e2e` cover the rest.
export default defineConfig({
  test: {
    projects: [
      'apps/web/vitest.config.ts',
      {test: {name: 'api', root: 'apps/api', environment: 'node', include: ['tests/unit/**/*.spec.ts']}},
      {test: {name: 'scripts', environment: 'node', include: ['tests/scripts/**/*.spec.ts']}},
    ],
  },
});

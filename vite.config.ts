import {defineConfig} from 'vite-plus';

// The formatter, linter and unit tests for the whole repository. The web app's dev server and build are
// configured in apps/web/vite.config.ts.
export default defineConfig({
  fmt: {
    printWidth: 120,
    singleQuote: true,
    bracketSpacing: false,
    quoteProps: 'consistent',
    singleAttributePerLine: true,
    sortPackageJson: false,
    ignorePatterns: [
      // Generated
      'apps/api/drizzle/**',
      'apps/web/src/components.d.ts',
      // Written by hand, with unpadded tables.
      '**/*.md',
    ],
  },
  lint: {
    // Vue's rules come from ESLint (eslint.config.js), which can also lint templates.
    plugins: ['eslint', 'oxc', 'typescript', 'unicorn'],
    categories: {correctness: 'error'},
    jsPlugins: [{name: 'vite-plus', specifier: 'vite-plus/oxlint-plugin'}],
    // vue-tsc type-checks (`npm run type-check`), since it understands Vue components.
    options: {typeAware: true},
    ignorePatterns: ['apps/web/src/components.d.ts'],
    rules: {
      'vite-plus/prefer-vite-plus-imports': 'error',
      // Destructuring a property out on purpose (`{omitted: _omitted, ...rest}`) is not a mistake.
      'no-unused-vars': ['error', {argsIgnorePattern: '^_', varsIgnorePattern: '^_'}],
      // The rest of typescript-eslint's recommended rules, which are not in Oxlint's correctness category.
      'no-array-constructor': 'error',
      'no-empty': 'error',
      'prefer-const': 'error',
      'typescript/ban-ts-comment': 'error',
      'typescript/no-empty-object-type': 'error',
      'typescript/no-explicit-any': 'error',
      'typescript/no-namespace': 'error',
      'typescript/no-require-imports': 'error',
      'typescript/no-unnecessary-type-constraint': 'error',
      'typescript/no-unsafe-function-type': 'error',
    },
  },
  // Unit tests only; they need no database or emulators. `npm run test:db` and `npm run test:e2e` cover the rest.
  test: {
    projects: [
      'apps/web/vite.config.ts',
      {test: {name: 'api', root: 'apps/api', environment: 'node', include: ['tests/unit/**/*.spec.ts']}},
      {test: {name: 'scripts', environment: 'node', include: ['tests/scripts/**/*.spec.ts']}},
    ],
  },
});

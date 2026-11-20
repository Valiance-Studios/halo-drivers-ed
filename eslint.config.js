import globals from 'globals';
import tseslint from 'typescript-eslint';
import pluginVue from 'eslint-plugin-vue';
import {defineConfig} from 'eslint/config';
import stylistic from '@stylistic/eslint-plugin';

const stylisticOptions = {
  semi: true,
  quotes: 'single',
  braceStyle: '1tbs',
  arrowParens: true,
};

export default defineConfig([
  // Ignored paths
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/playwright-report/**',
      '**/test-results/**',
      'apps/web/src/components.d.ts',
    ],
  },

  // All source files (JS, TS, Vue)
  {
    files: ['**/*.{js,ts,vue}'],
    extends: [tseslint.configs.recommended],
    plugins: {
      '@stylistic': stylistic,
    },
    rules: {
      ...stylistic.configs.customize(stylisticOptions).rules,
      '@stylistic/object-curly-spacing': ['error', 'never'],
      // Destructuring a property out on purpose (`{omitted: _omitted, ...rest}`) is not a mistake.
      '@typescript-eslint/no-unused-vars': ['error', {argsIgnorePattern: '^_', varsIgnorePattern: '^_'}],
    },
  },

  // Vue single-file components
  {
    files: ['**/*.vue'],
    extends: [pluginVue.configs['flat/recommended']],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: ['.vue'],
        sourceType: 'module',
      },
    },
    rules: {
      // Mirror the script-side stylistic rules inside template expressions.
      'vue/object-curly-spacing': ['error', 'never'],
      'vue/brace-style': ['error', '1tbs'],
    },
  },

  // Web app TypeScript (browser)
  {
    files: ['apps/web/src/**/*.ts', 'apps/web/env.d.ts'],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },

  // The API, tooling config files and scripts (Node)
  {
    files: ['apps/api/**/*.ts', '**/*.config.{js,ts}', 'scripts/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },

  // Unit and database tests (Vitest)
  {
    files: ['**/tests/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.vitest,
        ...globals.node,
      },
    },
  },

  // E2E tests (Playwright, Node)
  {
    files: ['apps/web/e2e/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
]);

import pluginVue from 'eslint-plugin-vue';
import {defineConfig, globalIgnores} from 'eslint/config';
import tseslint from 'typescript-eslint';

// Vue components only, for the template rules Oxlint lacks. Oxlint (vite.config.ts) lints everything else,
// and Oxfmt formats.
export default defineConfig([
  globalIgnores(['**/dist/**', '**/coverage/**', '**/playwright-report/**', '**/test-results/**']),
  {
    files: ['**/*.vue'],
    extends: [pluginVue.configs['flat/recommended']],
    // Formatting rules off: Oxfmt formats.
    rules: pluginVue.configs['no-layout-rules'].rules,
    languageOptions: {
      parserOptions: {parser: tseslint.parser},
    },
  },
]);

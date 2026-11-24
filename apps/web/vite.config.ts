import {defineConfig, loadEnv} from 'vite-plus';
import vue from '@vitejs/plugin-vue';
import components from 'unplugin-vue-components/vite';
import {PrimeVueResolver} from '@primevue/auto-import-resolver';

/**
 * Where the dev server sends `/api`: `HDE_API_URL` from the shell (the E2E tests' own API) or from the mode's
 * env file (staging: the deployed API through Hosting's rewrite), else the local API (`npm run dev:api`).
 */
function apiTarget(mode: string): string {
  return process.env.HDE_API_URL ?? loadEnv(mode, import.meta.dirname, 'HDE_').HDE_API_URL ?? 'http://localhost:8081';
}

export default defineConfig(({mode}) => ({
  plugins: [
    vue(),
    // Registers the PrimeVue components templates use, so only those are bundled. The app's own
    // components are imported explicitly (`dirs: []`).
    components({dirs: [], resolvers: [PrimeVueResolver()], dts: 'src/components.d.ts'}),
  ],
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    proxy: {
      // `changeOrigin` sends the target's Host header, which Firebase Hosting needs to find the site.
      '/api': {target: apiTarget(mode), changeOrigin: true},
    },
  },
  optimizeDeps: {
    // The resolver adds PrimeVue imports as views first use them, so on a cold start the optimizer kept
    // discovering new ones and re-bundling, and a page could load two copies of Vue ("reading 'ce'").
    // PrimeVue ships ESM, so serve it as is.
    exclude: ['primevue'],
  },
  test: {
    name: 'web',
    root: import.meta.dirname,
    include: ['tests/unit/**/*.spec.ts'],
    environment: 'jsdom',
  },
  build: {
    rolldownOptions: {
      output: {
        // Libraries in their own chunks, which stay cached across deploys that only change app code.
        advancedChunks: {
          groups: [
            {name: 'firebase', test: /node_modules[\\/](@firebase|firebase)[\\/]/},
            {name: 'primevue', test: /node_modules[\\/](primevue|@primevue|@primeuix)[\\/]/},
            {name: 'vue', test: /node_modules[\\/](@vue|vue|vue-router|pinia)[\\/]/},
          ],
        },
      },
    },
  },
}));

import {defineConfig, mergeConfig} from 'vitest/config';
import viteConfig from './vite.config.ts';

export default mergeConfig(viteConfig, defineConfig({
  test: {
    name: 'web',
    root: import.meta.dirname,
    include: ['tests/unit/**/*.spec.ts'],
    environment: 'jsdom',
  },
}));

import { defineConfig } from 'vitest/config';

// Separate from vite.config.ts on purpose: the iwsdkDev plugin manages a dev
// server + browser and must not run during unit tests.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'apps/**/src/**/*.test.ts'],
    environment: 'node',
  },
});

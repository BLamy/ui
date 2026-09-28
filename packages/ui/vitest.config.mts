import { defineConfig } from 'vitest/config';

// Unit tests for @brett_lamy/ui (kept separate from vite.config.mts so the lib build plugins don't load).
export default defineConfig({
  root: import.meta.dirname,
  oxc: { jsx: { runtime: 'automatic' } },
  test: {
    name: 'ui',
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});

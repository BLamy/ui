import { defineConfig } from 'vitest/config';
import { aliases } from '../../tools/alias.mjs';

// Unit tests for @brett_lamy/ui (kept separate from vite.config.mts so the lib build plugins don't load).
export default defineConfig({
  root: import.meta.dirname,
  resolve: { alias: aliases },
  oxc: { jsx: { runtime: 'automatic' } },
  test: {
    name: 'ui',
    environment: 'node',
    // Blocks keep their pure logic testable here too (registry/blocks/<slug>/*.test.ts): the aliases are the same.
    include: ['src/**/*.test.{ts,tsx}', '../../registry/blocks/*/*.test.{ts,tsx}'],
  },
});

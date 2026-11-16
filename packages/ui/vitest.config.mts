import { defineConfig } from 'vitest/config';
import { aliases, docstreamAliases } from '../../tools/alias.mjs';

// Unit tests for @brett_lamy/ui (kept separate from vite.config.mts so the lib build plugins don't load).
export default defineConfig({
  root: import.meta.dirname,
  // The library's own docstream entries, which its modules import by the package's name (`@brett_lamy/ui/docstream/…`).
  resolve: { alias: [...docstreamAliases, ...aliases] },
  oxc: { jsx: { runtime: 'automatic' } },
  test: {
    name: 'ui',
    environment: 'node',
    // Blocks keep their pure logic testable here too (registry/blocks/<slug>/*.test.ts): the aliases are the same.
    include: ['src/**/*.test.{ts,tsx}', '../../registry/blocks/*/*.test.{ts,tsx}'],
    // docstream's and the editor's suites keep the setup their own packages had (it applies to their files only).
    setupFiles: ['./test/docstream-setup.ts'],
  },
});

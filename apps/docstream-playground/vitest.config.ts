import { defineConfig } from 'vitest/config';
import { aliases, docstreamAliases } from '../../tools/alias.mjs';

// The docs' own checks (docs.test.ts), which ran with docstream's suite when this was its demo. Plain Node: the site's Vite config
// stands in for node:fs in the browser, which a test reading the docs from disk can't have.
export default defineConfig({
  root: import.meta.dirname,
  resolve: { alias: [...docstreamAliases, ...aliases] },
  oxc: { jsx: { runtime: 'automatic' } },
  test: { environment: 'node', include: ['docs.test.ts'] },
});

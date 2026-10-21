import { defineConfig } from 'vitest/config';

// The site's own checks (the library manifest against the code); the docs' pages are exercised by tools/e2e.
export default defineConfig({
  test: { include: ['src/**/*.test.{ts,tsx}'], environment: 'node' },
});

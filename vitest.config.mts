import { defineConfig } from 'vitest/config';

// Root `vitest` runs each package's unit suite once. Only dedicated vitest.config.* files are projects:
// matching vite.config.* too (or `**`, which also matches this file) ran every suite two or three times.
export default defineConfig({
  test: {
    projects: ['{packages,apps}/*/vitest.config.{mjs,js,ts,mts}'],
  },
});

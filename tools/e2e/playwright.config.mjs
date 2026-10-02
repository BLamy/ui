import { defineConfig } from '@playwright/test';

/* Behavior tests: taps, swipes, right-clicks and keys against the docs app's full-screen demos (`?demo=<page>/<example>`),
   driven with real pointer input — a synthetic event skips pointer capture and press handling, which is exactly where
   gesture bugs hide. The docs dev server starts itself (or is reused locally). Run with `pnpm e2e`. */
const PORT = 4421;

export default defineConfig({
  testDir: '.',
  testMatch: '*.e2e.mjs',
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  outputDir: './.results',
  use: { baseURL: `http://localhost:${PORT}`, viewport: { width: 1000, height: 720 }, trace: 'retain-on-failure' },
  webServer: {
    command: `pnpm dev:docs --port ${PORT} --strictPort`,
    cwd: '../..',
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});

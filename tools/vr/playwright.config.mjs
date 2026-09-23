import { defineConfig } from '@playwright/test';

/* Visual regression for every Storybook story. Baselines are local (gitignored): take them on a clean
   checkout with `pnpm vr:update`, then run `pnpm vr` after a change. Needs Storybook on :6006. */
export default defineConfig({
  testDir: '.',
  testMatch: 'stories.vr.mjs',
  snapshotPathTemplate: '{testDir}/__baseline__/{arg}{ext}',
  fullyParallel: true,
  workers: 6,
  retries: 1,
  reporter: [['list'], ['json', { outputFile: 'results.json' }]],
  outputDir: './.results',
  use: { viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1 },
  expect: { toHaveScreenshot: { maxDiffPixels: 0, threshold: 0.1, animations: 'disabled', caret: 'hide' } },
});

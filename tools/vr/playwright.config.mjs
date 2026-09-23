import { defineConfig } from '@playwright/test';

/* Visual regression for every Storybook story. Baselines are local (gitignored): take them on a clean
   checkout with `pnpm vr:update`, then run `pnpm vr` after a change. Needs Storybook on :6006. */
export default defineConfig({
  testDir: '.',
  // `--project stories` needs Storybook on :6006; `--project docs` needs the docs dev server on :4417.
  projects: [{ name: 'stories', testMatch: 'stories.vr.mjs' }, { name: 'docs', testMatch: 'docs.vr.mjs' }],
  snapshotPathTemplate: '{testDir}/__baseline__/{arg}{ext}',
  fullyParallel: true,
  workers: 6,
  retries: 1,
  reporter: [['list'], ['json', { outputFile: 'results.json' }]],
  outputDir: './.results',
  use: { viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1 },
  expect: { toHaveScreenshot: { maxDiffPixels: 0, threshold: 0.1, animations: 'disabled', caret: 'hide' } },
});

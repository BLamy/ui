import { defineConfig } from '@playwright/test';

/** Tests whose screens show SyntaxHighlighting (story ids / docs page ids). */
const GPU = /syntaxhighlighting|syntax-highlighting|github-clone--(file-view|files-changed)/;
const GPU_USE = { channel: 'chromium', launchOptions: { args: ['--enable-unsafe-webgpu'] } };

/* Visual regression for every Storybook story. Baselines are local (gitignored): take them on a clean
   checkout with `pnpm vr:update`, then run `pnpm vr` after a change. Needs Storybook on :6006. */
export default defineConfig({
  testDir: '.',
  // `--project stories` needs Storybook on :6006; `--project docs` needs the docs dev server on :4417.
  // SyntaxHighlighting lexes on WebGPU (gpu-lexer). Playwright's default headless shell has no WebGPU adapter,
  // so screens that show highlighted code run in full Chromium (`channel: 'chromium'`, new headless), which gets
  // the Metal adapter on macOS (--enable-unsafe-webgpu turns on SwiftShader where there is no GPU). Everything
  // else stays on the headless shell its baselines were taken with — the two render SVG/text slightly differently.
  projects: [
    { name: 'stories', testMatch: 'stories.vr.mjs', grepInvert: GPU },
    { name: 'stories-gpu', testMatch: 'stories.vr.mjs', grep: GPU, use: GPU_USE },
    { name: 'docs', testMatch: 'docs.vr.mjs', grepInvert: GPU },
    { name: 'docs-gpu', testMatch: 'docs.vr.mjs', grep: GPU, use: GPU_USE },
  ],
  snapshotPathTemplate: '{testDir}/__baseline__/{arg}{ext}',
  fullyParallel: true,
  workers: 6,
  retries: 1,
  reporter: [['list'], ['json', { outputFile: 'results.json' }]],
  outputDir: './.results',
  use: { viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1 },
  expect: { toHaveScreenshot: { maxDiffPixels: 0, threshold: 0.1, animations: 'disabled', caret: 'hide' } },
});

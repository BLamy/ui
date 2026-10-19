// Renders assets/icon.svg to the 1024px assets/icon.png the build turns into an .icns.
// Uses the workspace's Playwright Chromium: `node tools/worktree-atlas-desktop/render-icon.mjs`.
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const svg = readFileSync(path.join(root, 'assets/icon.svg'), 'utf8');
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1024, height: 1024 } });
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block}</style>${svg}`);
  await page.screenshot({ path: path.join(root, 'assets/icon.png'), omitBackground: true });
  console.log('Wrote assets/icon.png');
} finally {
  await browser.close();
}

import { test, expect } from '@playwright/test';
import { trackGoogleFonts } from './font-readiness.mjs';

const BASE = process.env.SB_URL || 'http://localhost:6006';
const index = await (await fetch(`${BASE}/index.json`)).json();
const stories = Object.values(index.entries).filter((e) => e.type === 'story');

for (const s of stories) {
  test(s.id, async ({ page }) => {
    const fontsReady = trackGoogleFonts(page);
    // Deterministic frames: no network map tiles, no motion.
    await page.route(/arcgisonline|openstreetmap|tile\./, (route) => route.abort());
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`${BASE}/iframe.html?id=${s.id}&viewMode=story`, { waitUntil: 'load' });
    await page.locator('#storybook-root > *').first().waitFor({ timeout: 15000 });
    if (s.id.startsWith('organisms-sqlconsole--'))
      await expect(page.locator('body')).toHaveAttribute('data-pglite-ready', 'true', { timeout: 30000 });
    await page.evaluate(() => document.fonts.ready);
    // Let entrance transitions, measured layouts, and seeded streams settle.
    await page.waitForTimeout(2500);
    // CodeEditor in the page shows plain text until the GPU lexer answers (data-highlighter="pending").
    await expect(page.locator('[data-highlighter="pending"]')).toHaveCount(0, { timeout: 30000 });
    // …and in the -gpu projects it must really be the GPU, not the no-WebGPU fallback.
    if (test.info().project.name.endsWith('-gpu') && !s.id.includes('fallback'))
      await expect(page.locator('[data-highlighter="fallback"]')).toHaveCount(0);
    if (s.id.startsWith('molecules-fontpicker--')) await fontsReady();
    await expect(page).toHaveScreenshot(`${s.id}.png`, { timeout: 10000 });
  });
}

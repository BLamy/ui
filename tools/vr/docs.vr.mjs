import { test, expect } from '@playwright/test';

/* Every docs page, full length, opened from the sidebar; then the Blocks gallery. */
const BASE = process.env.DOCS_URL || 'http://localhost:4417';
const { NAV } = await import('../../apps/docs/src/content.ts').catch(() => ({ NAV: null }));
const pages = NAV ? NAV.flatMap((s) => s.pages) : [];

for (const id of pages) {
  test(`docs-${id}`, async ({ page }) => {
    await page.route(/arcgisonline|openstreetmap|tile\./, (route) => route.abort());
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto(BASE, { waitUntil: 'load' });
    await page.locator('.dk-nav').first().waitFor();
    await page.locator(`.dk-nav[data-page="${id}"]`).first().click();
    // Grow the viewport to the page's full height so the inner scroller shows everything.
    await page.waitForTimeout(1500);
    const h = await page.evaluate(() => document.getElementById('bldocs-scroll')?.scrollHeight ?? 900);
    await page.setViewportSize({ width: 1400, height: Math.min(h, 16000) });
    await page.waitForTimeout(1500);
    await expect(page.locator('[data-highlighter="pending"]')).toHaveCount(0, { timeout: 30000 });
    if (test.info().project.name.endsWith('-gpu'))
      await expect(page.locator('[data-highlighter="fallback"]:not([data-engine="fallback"])')).toHaveCount(0);
    await expect(page).toHaveScreenshot(`docs-${id}.png`, { timeout: 15000 });
  });
}

/* Blocks: every registry block's card with its live preview (lazy page.tsx), full length, light and dark. */
for (const theme of ['light', 'dark']) {
  const name = `docs-blocks${theme === 'dark' ? '-dark' : ''}`;
  test(name, async ({ page }) => {
    await page.route(/arcgisonline|openstreetmap|tile\./, (route) => route.abort());
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto(`${BASE}/?theme=${theme}#/blocks`, { waitUntil: 'load' });
    await page.locator('.dk-block').first().waitFor();
    const h = await page.evaluate(() => document.getElementById('bldocs-scroll')?.scrollHeight ?? 900);
    await page.setViewportSize({ width: 1400, height: Math.min(h, 16000) });
    // Each preview lazy-loads once it is near the viewport; wait until no card is still loading.
    await expect(page.locator('.dk-block-frame .dk-block-loading')).toHaveCount(0, { timeout: 20000 });
    await page.waitForTimeout(2500);
    await expect(page).toHaveScreenshot(`${name}.png`, { timeout: 15000 });
  });
}

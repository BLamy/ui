import { test, expect } from '@playwright/test';

/* Every docs page, full length. The docs shell has no URLs, so pages are opened from the sidebar. */
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
    await expect(page).toHaveScreenshot(`docs-${id}.png`, { timeout: 15000 });
  });
}

import { test, expect } from '@playwright/test';

const BASE = process.env.SB_URL || 'http://localhost:6006';
const index = await (await fetch(`${BASE}/index.json`)).json();
const stories = Object.values(index.entries).filter((e) => e.type === 'story');

for (const s of stories) {
  test(s.id, async ({ page }) => {
    // Deterministic frames: no network map tiles, no motion.
    await page.route(/arcgisonline|openstreetmap|tile\./, (route) => route.abort());
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`${BASE}/iframe.html?id=${s.id}&viewMode=story`, { waitUntil: 'load' });
    await page.locator('#storybook-root > *').first().waitFor({ timeout: 15000 });
    await page.evaluate(() => document.fonts.ready);
    // Let entrance transitions, measured layouts, and seeded streams settle.
    await page.waitForTimeout(2500);
    await expect(page).toHaveScreenshot(`${s.id}.png`, { timeout: 10000 });
  });
}

import { test, expect } from '@playwright/test';

const BASE = process.env.SB_URL || 'http://localhost:6006';
const index = await (await fetch(`${BASE}/index.json`)).json();
const stories = Object.values(index.entries).filter((e) => e.type === 'story');

for (const s of stories) {
  test(s.id, async ({ page }) => {
    await page.goto(`${BASE}/iframe.html?id=${s.id}&viewMode=story`, { waitUntil: 'load' });
    await page.locator('#storybook-root > *').first().waitFor({ timeout: 15000 });
    await page.evaluate(() => document.fonts.ready);
    // Let entrance transitions, measured layouts, and seeded streams settle.
    await page.waitForTimeout(2500);
    await expect(page).toHaveScreenshot(`${s.id}.png`, { timeout: 10000 });
  });
}

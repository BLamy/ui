import { expect } from '@playwright/test';

/** CSS requests happen before their @font-face rules join document.fonts. Observe both phases. */
export function trackGoogleFonts(page) {
  const pending = new Set();
  page.on('request', (request) => {
    if (/^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(request.url())) pending.add(request);
  });
  page.on('requestfinished', (request) => pending.delete(request));
  page.on('requestfailed', (request) => pending.delete(request));
  return async () => {
    await expect.poll(() => pending.size, { timeout: 30000 }).toBe(0);
    await page.evaluate(async () => {
      await document.fonts.ready;
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    // A failed family remains dimmed. Do not accept that as a completed visual fixture.
    await expect(page.locator('[data-slot="command-list"] .opacity-45')).toHaveCount(0, { timeout: 30000 });
  };
}

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { trackGoogleFonts } from './font-readiness.mjs';
import { waitForPgliteExamples } from './pglite-readiness.mjs';

/* Every docs page, full length (DocsSite scrolls inside .ds-site-scroll); then the Blocks gallery. */
const BASE = process.env.DOCS_URL || 'http://localhost:4417';
const NAV = JSON.parse(readFileSync(new URL('../../apps/docs/pages/nav.json', import.meta.url), 'utf8'));
const pages = NAV.sections.flatMap((s) => s.pages.map((p) => p.id));
const blocks = readdirSync(new URL('../../registry/blocks/', import.meta.url), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .flatMap((entry) => {
    const file = new URL(`../../registry/blocks/${entry.name}/meta.json`, import.meta.url);
    if (!existsSync(file)) return [];
    const meta = JSON.parse(readFileSync(file, 'utf8'));
    return meta.files?.includes('page.tsx') ? [{ name: meta.name, title: meta.title }] : [];
  });

for (const id of pages) {
  test(`docs-${id}`, async ({ page }) => {
    if (id === 'open-code') test.setTimeout(90000);
    const fontsReady = trackGoogleFonts(page);
    await page.route(/arcgisonline|openstreetmap|tile\./, (route) => route.abort());
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto(`${BASE}/#/${id}`, { waitUntil: 'load' });
    await page.locator('.ds-site-article').first().waitFor();
    if (id === 'open-code') {
      await expect(page.getByRole('region', { name: 'Vibecoder', exact: true })).toHaveAttribute('data-state', 'running', { timeout: 60000 });
      await expect(page.getByRole('button', { name: 'Test browser tools', exact: true })).toBeEnabled();
      await expect(page.getByText('Browser MCP · ready', { exact: true })).toBeVisible({ timeout: 30000 });
      await expect(page.getByRole('button', { name: 'Port 3000', exact: true })).toBeVisible();
      // The idle hint is chosen by the terminal. Compare a real, unsubmitted prompt instead.
      const input = page.getByRole('textbox', { name: 'Terminal input', exact: true });
      await input.pressSequentially('Describe this starter app');
      await expect(page.locator('.xterm-rows')).toContainText('Describe this starter app');
      await page.getByRole('heading', { name: 'OpenCode', exact: true }).click();
      await expect(input).not.toBeFocused();
    }
    // Grow the viewport to the page's full height so the inner scroller shows everything.
    await page.waitForTimeout(1500);
    const h = await page.evaluate(() => document.querySelector('.ds-site-scroll')?.scrollHeight ?? 900);
    await page.setViewportSize({ width: 1400, height: Math.min(h, 16000) });
    await page.waitForTimeout(1500);
    if (id === 'pglite') {
      await waitForPgliteExamples(page);
      const readyHeight = await page.evaluate(() => document.querySelector('.ds-site-scroll')?.scrollHeight ?? 900);
      await page.setViewportSize({ width: 1400, height: Math.min(readyHeight, 16000) });
    }
    await expect(page.locator('[data-highlighter="pending"]')).toHaveCount(0, { timeout: 30000 });
    if (test.info().project.name.endsWith('-gpu'))
      await expect(page.locator('[data-highlighter="fallback"]:not([data-engine="fallback"])')).toHaveCount(0);
    if (id === 'font-picker') {
      // The enlarged viewport mounts more font rows. Their CSS fetch precedes document.fonts.ready.
      await expect(page.locator('[data-docstream-demo]')).toHaveCount(4);
      // FontList is a UI SDK Command: its rows are in the command list.
      await expect(page.locator('[data-slot="command-list"]').first()).toBeVisible();
      await fontsReady();
    }
    if (id === 'docstream' || id === 'markdown-editor') {
      const timings = page.locator('.docs-pele-time');
      await expect(timings).toHaveCount(3);
      for (const timing of await timings.all()) await expect(timing).toHaveText(/^\d+(?:\.\d+)? ms$/);
      // Measured render costs vary with load. Keep the diagram and validate each timing above.
      await page.addStyleTag({ content: '.docs-pele-time { visibility: hidden !important; }' });
    }
    await expect(page).toHaveScreenshot(`docs-${id}.png`, { timeout: 15000 });
  });
}

/* The Blocks overview lists the catalog. Each block's own page mounts its live preview. */
for (const theme of ['light', 'dark']) {
  const name = `docs-blocks${theme === 'dark' ? '-dark' : ''}`;
  test(name, async ({ page }) => {
    await page.route(/arcgisonline|openstreetmap|tile\./, (route) => route.abort());
    await page.emulateMedia({ reducedMotion: 'reduce' });
    // Keep the same display clock when moving from the overview to a live block page.
    await page.clock.setFixedTime(new Date('2026-09-28T09:41:00'));
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto(`${BASE}/?theme=${theme}#/blocks`, { waitUntil: 'load' });
    const article = page.locator('.ds-site-article').first();
    await expect(article.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();
    await expect(article.locator('a[href*="/#/blocks/"]')).toHaveCount(blocks.length);
    for (const block of blocks) {
      await expect(article.locator(`a[href$="/#/blocks/${block.name}"]`)).toHaveText(block.title);
    }
    await expect(article.locator('[data-docstream-demo]')).toHaveCount(0);
    const h = await page.evaluate(() => document.querySelector('.ds-site-scroll')?.scrollHeight ?? 900);
    await page.setViewportSize({ width: 1400, height: Math.min(h, 16000) });
    await page.waitForTimeout(2500);
    await expect(page).toHaveScreenshot(`${name}.png`, { timeout: 15000 });
    await page.goto(`${BASE}/?theme=${theme}#/blocks/delivery-tracking`, { waitUntil: 'load' });
    await expect(page.locator('[data-docstream-demo]')).toHaveCount(1);
    await expect(page.locator('[data-slot="delivery-tracking-demo"]')).toBeVisible();
  });
}

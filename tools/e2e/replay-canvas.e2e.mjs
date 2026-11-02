import { test, expect } from '@playwright/test';
import { openDemo } from './helpers.mjs';

/* The Replay Canvas block: four rrweb sessions of Tandem folded into one map. Frames are the recordings paused (a layer
   cropped to its panel), the outline and segues select, and a recording added from a file joins the same map. */
test.use({ viewport: { width: 1500, height: 940 } });

test.beforeEach(async ({ page }) => {
  await openDemo(page, 'blocks/replay-canvas', '[data-rc-frame]');
});

test('maps the recordings into pages, layers and segues', async ({ page }) => {
  await expect(page.locator('[data-slot=replay-canvas]')).toContainText('4 recordings → 3 pages · 9 layers');
  await expect(page.locator('[data-rc-frame]')).toHaveCount(18);
  // Every frame's player comes up.
  await expect(page.locator('[data-replay-stage]')).toHaveCount(18, { timeout: 20_000 });
});

test('draws a layer cropped to its panel, beside its states', async ({ page }) => {
  await page.getByRole('button', { name: /^New project\s*dialog/ }).click();
  const inspector = page.locator('[data-slot=replay-canvas-inspector]');
  await expect(inspector).toContainText('New project');
  await expect(inspector).toContainText('Click “Create project” → New project · Give the project a name.');
  // The dialog's frame is the dialog (420px wide), not the 1280×800 page behind it.
  const frame = page.locator('[data-rc-frame$="/open"]').filter({ has: page.locator('[data-replay-stage]') });
  await expect.poll(async () => {
    const sizes = await frame.evaluateAll((els) => els.map((el) => el.style.width));
    return sizes.includes('420px');
  }, { timeout: 15_000 }).toBe(true);
  // And the recording plays from that moment.
  await expect(inspector.locator('[data-slot=replay-preview]')).toBeVisible();
});

test('selects a segue from its label and shows where it was seen', async ({ page }) => {
  await page.getByRole('button', { name: /^\/projects\/:id/ }).first().click();
  await page.locator('div[data-rc-segue]', { hasText: 'Add task' }).first().click();
  const inspector = page.locator('[data-slot=replay-canvas-inspector]');
  await expect(inspector).toContainText('Click “Add task”');
  await expect(inspector).toContainText('seen 2× in 2 recordings');
});

test('hides the arrows but keeps their dots; a dot draws its arrow', async ({ page }) => {
  const arrows = page.locator('path[data-rc-segue]');
  const dots = page.locator('circle[data-rc-segue]');
  await expect(dots.first()).toBeAttached();
  const n = await dots.count();
  await expect(arrows).toHaveCount(n);
  await page.getByRole('button', { name: /^Hide arrows/ }).click();
  await expect(arrows).toHaveCount(0);
  await expect(dots).toHaveCount(n);
  const id = await dots.first().getAttribute('data-rc-segue');
  await dots.first().click({ force: true });
  await expect(page.locator('[data-slot=replay-canvas-inspector]')).toContainText('Segue');
  await expect(arrows).toHaveCount(1);
  await expect(arrows.first()).toHaveAttribute('data-rc-segue', id);
  await page.getByRole('button', { name: 'Show arrows' }).click();
  await expect(arrows).toHaveCount(n);
});

test('folds a recording added from a file into the same map', async ({ page }) => {
  // The first sample recording again, as a dropped file: everything it shows is already on the map, so the map
  // doesn't grow, but what it confirms is counted.
  const { SAMPLE_RECORDINGS } = await import('../../registry/blocks/replay-canvas/recordings.ts');
  const events = SAMPLE_RECORDINGS[0].events;
  await page.locator('[data-slot=replay-canvas-sidebar] input[type=file]').setInputFiles({
    name: 'again.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(events)),
  });
  await expect(page.locator('[data-slot=replay-canvas]')).toContainText('5 recordings → 3 pages · 9 layers');
  await page.locator('[data-slot=checkbox]', { hasText: 'again' }).click();
  await expect(page.locator('[data-slot=replay-canvas]')).toContainText('4 recordings → 3 pages · 9 layers');
});

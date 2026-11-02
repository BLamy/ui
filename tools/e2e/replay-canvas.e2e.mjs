import { test, expect } from '@playwright/test';
import { openDemo } from './helpers.mjs';

/* The Replay Canvas block: four rrweb sessions of Tandem folded into one map. Frames are the recordings paused (a layer
   cropped to its panel, a page to its content, an update to the part it changed, the shared header on its own), the
   outline and segues select, journeys can be followed, and a recording added from a file joins the same map. */
test.use({ viewport: { width: 1500, height: 940 } });

test.beforeEach(async ({ page }) => {
  await openDemo(page, 'blocks/replay-canvas', '[data-rc-frame]');
});

test('maps the recordings into pages, layers and segues', async ({ page }) => {
  await expect(page.locator('[data-slot=replay-canvas]')).toContainText('4 recordings → 3 pages · 9 layers · 1 shared');
  await expect(page.locator('[data-rc-frame]')).toHaveCount(19);
  // Every frame's player comes up.
  await expect(page.locator('[data-replay-stage]')).toHaveCount(19, { timeout: 20_000 });
});

test('draws shared chrome once, and an update as just the part it changed', async ({ page }) => {
  // The header every page has is a frame of its own; "Projects" in it leads to the Projects page.
  await page.getByRole('button', { name: /^Header\s*shared/ }).click();
  const inspector = page.locator('[data-slot=replay-canvas-inspector]');
  await expect(inspector).toContainText('Shared chrome');
  await expect(inspector).toContainText('Click “Projects” → Projects · Tandem');
  // Toggling "Email digests" is the switch's row, not another 1280×800 screen.
  const part = page.locator('[data-rc-frame$="Email digests"]').or(page.locator('[data-rc-frame*="switch"]'));
  await expect.poll(async () => part.first().evaluate((el) => parseFloat(el.style.height)), { timeout: 15_000 }).toBeLessThan(200);
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
  // One arrow per segue; a dot per journey that took it.
  const arrows = page.locator('path[data-rc-segue]');
  const dots = page.locator('circle[data-rc-segue]');
  await expect(dots.first()).toBeAttached();
  const n = await arrows.count();
  const d = await dots.count();
  expect(n).toBeGreaterThan(0);
  expect(d).toBeGreaterThanOrEqual(n);
  await page.getByRole('button', { name: /^Hide arrows/ }).click();
  await expect(arrows).toHaveCount(0);
  await expect(dots).toHaveCount(d);
  // A dot draws its segue, and the rest of that journey's path.
  const dot = dots.first();
  const id = await dot.getAttribute('data-rc-segue');
  await dot.click({ force: true });
  await expect(page.locator('[data-slot=replay-canvas-inspector]')).toContainText('Segue');
  await expect(arrows.and(page.locator(`[data-rc-segue="${id}"]`))).not.toHaveCount(0);
  expect(await arrows.count()).toBeGreaterThan(1);
  await page.getByRole('button', { name: 'Show arrows' }).click();
  await expect(arrows).toHaveCount(n);
});

test('follows a journey: its steps numbered, the rest faded', async ({ page }) => {
  await page.getByRole('button', { name: /^Follow Delete Beacon/ }).click();
  await expect(page.getByRole('button', { name: /^Stop following Delete Beacon/ }).first()).toBeVisible();
  const steps = page.locator('[data-rc-step]');
  await expect(steps).toHaveCount(8);
  await expect(steps.first()).toHaveText('1');
  // Pressing empty board stops following.
  const box = await page.locator('[data-slot=canvas]').boundingBox();
  await page.mouse.click(box.x + 20, box.y + box.height - 20);
  await expect(steps).toHaveCount(0);
});

test('previews a frame and a recording in hover cards', async ({ page }) => {
  const frame = page.locator('[data-rc-frame^="page-"]').first();
  await frame.hover({ force: true });
  const card = page.locator('[data-slot=hover-card]');
  await expect(card).toContainText(/Seen \d+× in \d+ recording/);
  await page.mouse.move(5, 5);
  await expect(card).toHaveCount(0);
  await page.locator('[data-slot=replay-canvas-sidebar] [data-slot=hover-card-trigger]').first().hover();
  await expect(card).toContainText(/\d+ pages? · \d+ layers? · \d+ segues?/);
});

test('the minimap outlines the view and moves it when pressed', async ({ page }) => {
  const map = page.locator('[data-slot=canvas-minimap]');
  await expect(map.locator('rect')).toHaveCount(20); // 19 frames and the view
  const board = page.locator('[data-slot=canvas-board]');
  const before = await board.evaluate((el) => el.style.transform);
  const box = await map.boundingBox();
  await page.mouse.click(box.x + 8, box.y + 8);
  await expect.poll(() => board.evaluate((el) => el.style.transform)).not.toBe(before);
  await page.getByRole('button', { name: 'Hide minimap' }).click();
  await expect(map).toHaveCount(0);
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

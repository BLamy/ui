import { test, expect } from '@playwright/test';
import { openDemo, settled, drag } from './helpers.mjs';

/* Canvas, through its docs demo: three cards you can move, resize and rotate on a pannable, zoomable surface. */
test.beforeEach(async ({ page }) => {
  await openDemo(page, 'canvas/cards', '[data-slot=canvas]');
});

const card = (page, id) => page.locator(`[data-card=${id}]`);
const box = async (page, id) => {
  const b = await card(page, id).boundingBox();
  return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) };
};
const mid = (b) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
const canvasBox = (page) => page.locator('[data-slot=canvas]').boundingBox();

test('scrolling pans the view', async ({ page }) => {
  const before = await box(page, 'c');
  const c = await canvasBox(page);
  await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2);
  await page.mouse.wheel(30, 100);
  await settled(page, () => box(page, 'c'));
  const after = await box(page, 'c');
  expect(before.y - after.y).toBe(100);
  expect(before.x - after.x).toBe(30);
  expect(after.w).toBe(before.w);
});

test('ctrl-scroll zooms about the pointer, which stays on the same board point', async ({ page }) => {
  const c = await canvasBox(page);
  const b0 = await box(page, 'a');
  // Zoom in on the center of card A.
  const at = { x: b0.x + b0.w / 2, y: b0.y + b0.h / 2 };
  await page.mouse.move(at.x, at.y);
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, -100);
  await page.keyboard.up('Control');
  await settled(page, () => box(page, 'a'));
  const b1 = await box(page, 'a');
  expect(b1.w).toBeGreaterThan(b0.w * 1.3);
  // The point under the pointer did not move: card A's center is still there.
  expect(Math.abs(b1.x + b1.w / 2 - at.x)).toBeLessThan(2);
  expect(Math.abs(b1.y + b1.h / 2 - at.y)).toBeLessThan(2);
  expect(c.width).toBeGreaterThan(0);
});

test('holding Space and dragging pans; releasing it goes back to selecting', async ({ page }) => {
  const c = await canvasBox(page);
  const before = await box(page, 'c');
  const a0 = await box(page, 'a');
  await page.locator('[data-slot=canvas]').focus();
  await page.keyboard.down('Space');
  // Start on card C: with Space held this drags the view, it does not move the card.
  await drag(page, mid(before), 60);
  await page.keyboard.up('Space');
  await settled(page, () => box(page, 'c'));
  const after = await box(page, 'c');
  expect(after.x - before.x).toBe(60);
  // The whole view moved: card A went with it, so no card was dragged on its own.
  const a = await box(page, 'a');
  expect(a.x).toBe(a0.x + 60);
  expect(c.width).toBeGreaterThan(0);
});

test('dragging a card moves it by the pointer distance at 100%', async ({ page }) => {
  const before = await box(page, 'a');
  await drag(page, mid(before), 80, { steps: 10 });
  const after = await box(page, 'a');
  expect(after.x - before.x).toBeGreaterThanOrEqual(74); // a snap guide may pull it a few px
  expect(after.x - before.x).toBeLessThanOrEqual(86);
  expect(after.w).toBe(before.w);
});

test('a drag moves a card by the pointer distance in board units when zoomed in', async ({ page }) => {
  const c = await canvasBox(page);
  await page.mouse.move(c.x + 20, c.y + 20);
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, -100);
  await page.keyboard.up('Control');
  await settled(page, () => box(page, 'a'));
  const zoomed = await box(page, 'a');
  const z = zoomed.w / 160;
  // Use a drag whose snapping can't interfere: straight down by 60 screen px.
  await page.mouse.move(zoomed.x + zoomed.w / 2, zoomed.y + zoomed.h / 2);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) { await page.mouse.move(zoomed.x + zoomed.w / 2, zoomed.y + zoomed.h / 2 + 6 * i); await page.waitForTimeout(12); }
  await page.mouse.up();
  const after = await box(page, 'a');
  // The card follows the pointer on screen (within a snap), and the card's size is still z × 160.
  expect(Math.abs(after.y - zoomed.y - 60)).toBeLessThan(12 * z);
  expect(Math.abs(after.w - zoomed.w)).toBeLessThanOrEqual(1);
});

test('dragging a corner handle resizes the selected card', async ({ page }) => {
  const a = await box(page, 'a');
  await page.mouse.click(a.x + a.w / 2, a.y + a.h / 2); // select A
  const se = await page.locator('[data-handle=se]').boundingBox();
  const grip = { x: se.x + se.width / 2, y: se.y + se.height / 2 };
  await drag(page, grip, 50, { steps: 10 });
  const after = await box(page, 'a');
  expect(after.w).toBeGreaterThan(a.w + 40);
  expect(after.x).toBe(a.x); // the opposite corner stays put
  expect(after.y).toBe(a.y);
});

test('the rotate handle turns the selected card', async ({ page }) => {
  const a = await box(page, 'a');
  await page.mouse.click(a.x + a.w / 2, a.y + a.h / 2);
  const rot = await page.locator('[data-handle=rot]').boundingBox();
  const from = { x: rot.x + rot.width / 2, y: rot.y + rot.height / 2 };
  const cx = a.x + a.w / 2, cy = a.y + a.h / 2;
  // Drag the handle from straight above the card to straight to its right: a quarter turn clockwise.
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(cx + 120, cy, { steps: 12 });
  await page.mouse.up();
  const transform = await card(page, 'a').evaluate((el) => el.style.transform);
  expect(transform).toMatch(/rotate\(9[0-9](\.\d+)?deg\)|rotate\(90deg\)/);
});

test('⌘1 returns to 100% zoom', async ({ page }) => {
  const c = await canvasBox(page);
  const before = await box(page, 'a');
  await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2);
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, -120);
  await page.keyboard.up('Control');
  await settled(page, () => box(page, 'a'));
  expect((await box(page, 'a')).w).toBeGreaterThan(before.w * 1.3);
  await page.locator('[data-slot=canvas]').focus();
  await page.keyboard.press('Control+1');
  await settled(page, () => box(page, 'a'));
  expect((await box(page, 'a')).w).toBe(before.w);
});

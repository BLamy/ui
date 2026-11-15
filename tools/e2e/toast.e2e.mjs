import { test, expect } from '@playwright/test';
import { openDemo, settled } from './helpers.mjs';

/* Toast, through its docs demo (banners at the top of a frame): they pile up, the newest in front and the rest peeking
   out behind, and spread into a list on hover or focus. */
test.beforeEach(async ({ page }) => {
  await openDemo(page, 'toast/banners', 'button');
});

const layers = (page) => page.locator('[data-slot=toast]');
const stack = (page) => page.locator('[data-slot=toast-region]');
const front = (page) => page.locator('[data-slot=toast][data-front]');
/** The pile at rest: its transitions (springs whose tails sit under half a pixel for a while) have finished, then
    two reads agree. The banners measure 65.5px, so a read mid-tail rounds the other way. */
const still = async (page) => {
  await expect.poll(() => stack(page).evaluate((el) => el.getAnimations({ subtree: true }).length)).toBe(0);
  await settled(page, () => read(page));
};
const send = async (page, n) => {
  for (let i = 0; i < n; i++) await page.getByRole('button', { name: 'Banner', exact: true }).click();
};
/** Each layer's box and visible state, newest (front) first. */
const read = (page) => layers(page).evaluateAll((els) =>
  els
    .sort((a, b) => Number(a.style.getPropertyValue('--toast-index')) - Number(b.style.getPropertyValue('--toast-index')))
    .map((el) => {
      const r = el.getBoundingClientRect();
      return { top: Math.round(r.top), height: Math.round(r.height), width: Math.round(r.width), behind: !el.hasAttribute('data-front') && !el.hasAttribute('data-expanded'), textOpacity: Number(getComputedStyle(el.firstElementChild).opacity) };
    }));

test('banners pile up: the newest in front, the ones behind peek out smaller with their content hidden', async ({ page }) => {
  await send(page, 3);
  await expect(layers(page)).toHaveCount(3);
  await still(page);
  const [front, mid, back] = await read(page);
  // Placed from the top edge, each one further in sits PEEK (14px) lower, and narrower.
  expect(mid.top - front.top).toBeGreaterThan(8);
  expect(mid.top - front.top).toBeLessThan(20);
  expect(back.top - mid.top).toBeGreaterThan(8);
  expect(front.width).toBeGreaterThan(mid.width);
  expect(mid.width).toBeGreaterThan(back.width);
  // Clipped to the front card's height (then scaled 95% / 90%); only the front shows its content.
  expect(Math.abs(mid.height - front.height * 0.95)).toBeLessThan(1.5);
  expect(Math.abs(back.height - front.height * 0.9)).toBeLessThan(1.5);
  expect(front.textOpacity).toBe(1);
  expect(mid.textOpacity).toBe(0);
  expect(back.textOpacity).toBe(0);
  // The pile is as tall as the front card plus two peeks.
  const pile = await stack(page).boundingBox();
  expect(Math.abs(pile.height - (front.height + 28))).toBeLessThan(3);
});

test('hovering the pile spreads it into a list, and leaving puts it back', async ({ page }) => {
  await send(page, 3);
  await still(page);
  const piled = await read(page);
  const box = await stack(page).boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + 20);
  await expect(stack(page)).toHaveAttribute('data-expanded', '');
  await still(page);
  const spread = await read(page);
  // Full size, a 10px gap between cards, every card readable.
  for (const c of spread) { expect(c.width).toBe(spread[0].width); expect(c.textOpacity).toBe(1); }
  expect(spread[1].top - (spread[0].top + spread[0].height)).toBeGreaterThanOrEqual(8);
  expect(spread[1].top - (spread[0].top + spread[0].height)).toBeLessThanOrEqual(12);
  expect(spread[2].top).toBeGreaterThan(piled[2].top + 10);
  // The gap between two cards is still "on the stack": moving through it does not collapse the list.
  await page.mouse.move(box.x + box.width / 2, spread[0].top + spread[0].height + 4);
  await expect(stack(page)).toHaveAttribute('data-expanded', '');
  await page.mouse.move(2, 2);
  await expect(stack(page)).not.toHaveAttribute('data-expanded');
  await still(page);
  expect(await read(page)).toEqual(piled);
});

test('moving keyboard focus into the pile spreads it', async ({ page }) => {
  await send(page, 3);
  await still(page);
  await front(page).getByRole('button', { name: /close|dismiss/i }).focus();
  await expect(stack(page)).toHaveAttribute('data-expanded', '');
});

test('closing the front card promotes the next one', async ({ page }) => {
  await send(page, 3);
  await still(page);
  await page.mouse.move(2, 2);
  await front(page).getByRole('button', { name: /close|dismiss/i }).click();
  await expect(layers(page)).toHaveCount(2);
  // Focus was on the closed card's button, so it moves on to the card that took its place (UI SDK's focus
  // recovery), and focus inside the region keeps the pile spread. Once focus leaves, it piles up again.
  await expect(front(page)).toBeFocused();
  await expect(stack(page)).toHaveAttribute('data-expanded', '');
  await page.mouse.move(2, 2);
  await page.evaluate(() => document.activeElement?.blur());
  await expect(stack(page)).not.toHaveAttribute('data-expanded');
  await still(page);
  const [first, second] = await read(page);
  expect(first.textOpacity).toBe(1);
  expect(second.textOpacity).toBe(0);
});

test('swiping a card toward the edge dismisses it', async ({ page }) => {
  await send(page, 2);
  await still(page);
  // The region sits at the top center, so a card is swiped away upward.
  const card = await front(page).boundingBox();
  const x = card.x + 40;
  const y = card.y + card.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 14; i++) {
    await page.mouse.move(x, y - (120 * i) / 14);
    await page.waitForTimeout(12);
  }
  await page.mouse.up();
  await expect(layers(page)).toHaveCount(1);
});

test('a single banner is a plain card, not a pile', async ({ page }) => {
  await send(page, 1);
  await still(page);
  const [only] = await read(page);
  const pile = await stack(page).boundingBox();
  expect(only.textOpacity).toBe(1);
  expect(Math.abs(pile.height - only.height)).toBeLessThan(2);
});

test('banners expire on their own', async ({ page }) => {
  await page.getByRole('button', { name: 'Error' }).click();
  await expect(layers(page)).toHaveCount(1);
  await expect(layers(page)).toHaveCount(0, { timeout: 9000 });
});

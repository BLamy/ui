import { test, expect } from '@playwright/test';
import { openDemo, settled, drag, center } from './helpers.mjs';

/* Toast, through its docs demo (banners at the top of a frame): they pile up like Sonner's — the newest in front, the
   rest peeking out behind — and spread into a list on hover or focus. */
test.beforeEach(async ({ page }) => {
  await openDemo(page, 'toast/banners', 'button');
});

const layers = (page) => page.locator('[data-slot=toast-layer]');
const stack = (page) => page.locator('[data-slot=toast-stack]');
const send = async (page, n) => {
  for (let i = 0; i < n; i++) await page.getByRole('button', { name: 'Banner', exact: true }).click();
};
/** Each layer's box and visible state, newest (front) first. */
const read = (page) => layers(page).evaluateAll((els) =>
  els
    .sort((a, b) => Number(a.dataset.index) - Number(b.dataset.index))
    .map((el) => {
      const r = el.getBoundingClientRect();
      const card = el.querySelector('[data-slot=toast]');
      return { top: Math.round(r.top), height: Math.round(r.height), width: Math.round(r.width), behind: card.dataset.behind === 'true', textOpacity: Number(getComputedStyle(card.firstElementChild).opacity) };
    }));

test('banners pile up: the newest in front, the ones behind peek out smaller with their content hidden', async ({ page }) => {
  await send(page, 3);
  await expect(layers(page)).toHaveCount(3);
  await settled(page, () => read(page));
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
  await settled(page, () => read(page));
  const piled = await read(page);
  const box = await stack(page).boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + 20);
  await expect(stack(page)).toHaveAttribute('data-expanded', 'true');
  await settled(page, () => read(page));
  const spread = await read(page);
  // Full size, a 10px gap between cards, every card readable.
  for (const c of spread) { expect(c.width).toBe(spread[0].width); expect(c.textOpacity).toBe(1); }
  expect(spread[1].top - (spread[0].top + spread[0].height)).toBeGreaterThanOrEqual(8);
  expect(spread[1].top - (spread[0].top + spread[0].height)).toBeLessThanOrEqual(12);
  expect(spread[2].top).toBeGreaterThan(piled[2].top + 10);
  // The gap between two cards is still "on the stack": moving through it does not collapse the list.
  await page.mouse.move(box.x + box.width / 2, spread[0].top + spread[0].height + 4);
  await expect(stack(page)).toHaveAttribute('data-expanded', 'true');
  await page.mouse.move(2, 2);
  await expect(stack(page)).not.toHaveAttribute('data-expanded', 'true');
  await settled(page, () => read(page));
  expect(await read(page)).toEqual(piled);
});

test('moving keyboard focus into the pile spreads it', async ({ page }) => {
  await send(page, 3);
  await settled(page, () => read(page));
  await page.locator('[data-slot=toast-layer][data-index="0"]').getByRole('button', { name: /close|dismiss/i }).focus();
  await expect(stack(page)).toHaveAttribute('data-expanded', 'true');
});

test('closing the front card promotes the next one', async ({ page }) => {
  await send(page, 3);
  await settled(page, () => read(page));
  await page.mouse.move(2, 2);
  await page.locator('[data-slot=toast-layer][data-index="0"]').getByRole('button', { name: /close|dismiss/i }).click();
  await expect(layers(page)).toHaveCount(2);
  await page.mouse.move(2, 2);
  await settled(page, () => read(page));
  const [front, back] = await read(page);
  expect(front.textOpacity).toBe(1);
  expect(back.textOpacity).toBe(0);
});

test('swiping a card sideways dismisses it', async ({ page }) => {
  await send(page, 2);
  await settled(page, () => read(page));
  const card = await page.locator('[data-slot=toast-layer][data-index="0"] [data-slot=toast]').boundingBox();
  await drag(page, { x: card.x + 40, y: card.y + card.height / 2 }, 220);
  await expect(layers(page)).toHaveCount(1);
});

test('a single banner is a plain card, not a pile', async ({ page }) => {
  await send(page, 1);
  await settled(page, () => read(page));
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

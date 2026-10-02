import { test, expect } from '@playwright/test';
import { center, drag, openDemo, settled } from './helpers.mjs';

/* SideDrawer's compact push (a phone-width host): the drawer slides in like a NavigationStack screen. */
const PANEL = '[data-slot=side-drawer-panel]';

test.beforeEach(async ({ page }) => {
  await openDemo(page, 'side-drawer/compact-push', '[data-slot=side-drawer]');
});

const panel = (page) => page.locator(PANEL);
const hostBox = (page) => page.locator('[data-slot=side-drawer]').boundingBox();
const isOpen = async (page) => (await panel(page).getAttribute('aria-hidden')) !== 'true' && !(await panel(page).evaluate((e) => e.hasAttribute('inert')));

async function open(page) {
  await page.getByRole('button', { name: /^\s*3\s*$|message/i }).first().click();
  await expect.poll(() => isOpen(page)).toBe(true);
  await settled(page, async () => Math.round((await panel(page).boundingBox()).x));
}

test('the push opens over the page and the back button sits in the bar', async ({ page }) => {
  await open(page);
  await expect(page.locator('[data-slot=side-drawer-bar] button')).toBeVisible();
});

test('a tap on the back chevron closes it on the first try', async ({ page }) => {
  await open(page);
  const chev = await page.locator('[data-slot=side-drawer-bar] button svg').first().boundingBox();
  // Inside the edge-swipe zone (the panel's left 36px): the zone must not swallow the tap.
  expect(chev.x - (await hostBox(page)).x).toBeLessThan(36);
  await page.mouse.click(...Object.values(center(chev)));
  await expect.poll(() => isOpen(page)).toBe(false);
});

test('a long swipe from the left edge closes it', async ({ page }) => {
  await open(page);
  const h = await hostBox(page);
  await drag(page, { x: h.x + 10, y: h.y + h.height * 0.7 }, h.width * 0.7);
  await expect.poll(() => isOpen(page)).toBe(false);
});

test('a short swipe springs back and leaves it open', async ({ page }) => {
  await open(page);
  const h = await hostBox(page);
  await drag(page, { x: h.x + 10, y: h.y + h.height * 0.7 }, 40);
  await settled(page, async () => Math.round((await panel(page).boundingBox()).x));
  expect(await isOpen(page)).toBe(true);
  expect(Math.abs((await panel(page).boundingBox()).x - h.x)).toBeLessThan(1);
});

test('a short swipe that starts on the back button and ends over it does not press it', async ({ page }) => {
  await open(page);
  const chev = center(await page.locator('[data-slot=side-drawer-bar] button svg').first().boundingBox());
  await drag(page, chev, 24);
  await settled(page, async () => Math.round((await panel(page).boundingBox()).x));
  expect(await isOpen(page)).toBe(true);
});

test('Escape closes it', async ({ page }) => {
  await open(page);
  await page.keyboard.press('Escape');
  await expect.poll(() => isOpen(page)).toBe(false);
});

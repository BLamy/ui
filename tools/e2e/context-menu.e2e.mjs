import { test, expect } from '@playwright/test';
import { openDemo } from './helpers.mjs';

/* ContextMenu, through its docs demo: three photo tiles, each its own area with a menu. */
test.beforeEach(async ({ page }) => {
  await openDemo(page, 'context-menu/actions', '[data-slot=context-menu]');
});

const tile = (page, name) => page.getByRole('button', { name: new RegExp(name) });
const menu = (page, name) => page.getByRole('menu', { name: `${name} actions` });
const status = (page) => page.locator('[data-slot=context-menu]').first().locator('xpath=ancestor::div[2]').locator('p');

test.describe('mouse', () => {
  test('a right-click opens the menu at the pointer, below and to its right', async ({ page }) => {
    const box = await tile(page, 'Porto').boundingBox();
    const at = { x: box.x + 30, y: box.y + 40 };
    await page.mouse.click(at.x, at.y, { button: 'right' });
    await expect(menu(page, 'Porto')).toBeVisible();
    const m = await menu(page, 'Porto').boundingBox();
    expect(Math.abs(m.x - at.x)).toBeLessThan(6);
    expect(m.y).toBeGreaterThanOrEqual(at.y);
    expect(m.y - at.y).toBeLessThan(30);
    await expect(page.getByRole('menuitem')).toHaveText([/Copy/, /Favorite/, /Delete/]);
  });

  test('choosing a row runs it and closes the menu', async ({ page }) => {
    await tile(page, 'Lisbon').click({ button: 'right' });
    await page.getByRole('menuitem', { name: /Copy/ }).click();
    await expect(menu(page, 'Lisbon')).toHaveCount(0);
    await expect(page.getByText('copy · Lisbon')).toBeVisible();
  });

  test('a stateful row flips its label', async ({ page }) => {
    await tile(page, 'Sintra').click({ button: 'right' });
    await page.getByRole('menuitem', { name: /Favorite/ }).click();
    await expect(tile(page, 'Sintra')).toContainText('★');
    await tile(page, 'Sintra').click({ button: 'right' });
    await expect(page.getByRole('menuitem', { name: /Remove favorite/ })).toBeVisible();
  });

  test('Escape closes it without choosing', async ({ page }) => {
    await tile(page, 'Lisbon').click({ button: 'right' });
    await expect(menu(page, 'Lisbon')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(menu(page, 'Lisbon')).toHaveCount(0);
    await expect(page.getByText('Nothing chosen yet')).toBeVisible();
  });

  test('a click outside closes it', async ({ page }) => {
    await tile(page, 'Lisbon').click({ button: 'right' });
    await expect(menu(page, 'Lisbon')).toBeVisible();
    await page.mouse.click(10, 10);
    await expect(menu(page, 'Lisbon')).toHaveCount(0);
  });

  test('a second right-click while it is open moves the menu to the new spot', async ({ page }) => {
    const a = await tile(page, 'Lisbon').boundingBox();
    const b = await tile(page, 'Sintra').boundingBox();
    await page.mouse.click(a.x + 20, a.y + 20, { button: 'right' });
    await expect(menu(page, 'Lisbon')).toBeVisible();
    await page.mouse.click(b.x + 20, b.y + 20, { button: 'right' });
    await expect(menu(page, 'Sintra')).toBeVisible();
    await expect(menu(page, 'Lisbon')).toHaveCount(0);
    const m = await menu(page, 'Sintra').boundingBox();
    expect(Math.abs(m.x - (b.x + 20))).toBeLessThan(6);
  });

  test('a normal click on a control inside the area still works', async ({ page }) => {
    let clicks = 0;
    await page.exposeFunction('__count', () => { clicks++; });
    await page.evaluate(() => document.querySelector('[data-slot=context-menu] button').addEventListener('click', () => window.__count()));
    await tile(page, 'Lisbon').click();
    expect(clicks).toBe(1);
    await expect(menu(page, 'Lisbon')).toHaveCount(0);
  });
});

test.describe('keyboard', () => {
  for (const [name, press] of [['the menu key', 'ContextMenu'], ['Shift+F10', 'Shift+F10']]) {
    test(`${name} opens it at the focused control, and Escape returns focus there`, async ({ page }) => {
      await tile(page, 'Porto').focus();
      await page.keyboard.press(press);
      await expect(menu(page, 'Porto')).toBeVisible();
      const t = await tile(page, 'Porto').boundingBox();
      const m = await menu(page, 'Porto').boundingBox();
      expect(m.y).toBeGreaterThanOrEqual(t.y + t.height - 2);
      await page.keyboard.press('Escape');
      await expect(menu(page, 'Porto')).toHaveCount(0);
      await expect(tile(page, 'Porto')).toBeFocused();
    });
  }

  test('arrows move through the rows and Enter chooses', async ({ page }) => {
    await tile(page, 'Lisbon').focus();
    await page.keyboard.press('ContextMenu');
    await expect(menu(page, 'Lisbon')).toBeVisible();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(page.getByText(/star · Lisbon|copy · Lisbon|delete · Lisbon/)).toBeVisible();
    await expect(tile(page, 'Lisbon')).toBeFocused();
  });
});

test.describe('touch', () => {
  test.use({ hasTouch: true });

  /** A finger on the page via CDP: down at (x, y), then `fn` (waits and moves), then up. */
  async function touch(page, at, fn) {
    const cdp = await page.context().newCDPSession(page);
    const pt = (x, y) => [{ x, y, id: 1 }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(at.x, at.y) });
    await fn(async (x, y) => cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(x, y) }));
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }

  test('a long press opens it and lifting the finger does not press the tile', async ({ page }) => {
    await page.evaluate(() => { window.__clicks = 0; document.querySelector('[data-slot=context-menu] button').addEventListener('click', () => { window.__clicks++; }); });
    const box = await tile(page, 'Lisbon').boundingBox();
    await touch(page, { x: box.x + 30, y: box.y + 30 }, () => page.waitForTimeout(700));
    await expect(menu(page, 'Lisbon')).toBeVisible();
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => window.__clicks)).toBe(0);
    await expect(menu(page, 'Lisbon')).toBeVisible();
  });

  test('a quick tap activates the tile and opens nothing', async ({ page }) => {
    await tile(page, 'Lisbon').tap();
    await page.waitForTimeout(700);
    await expect(menu(page, 'Lisbon')).toHaveCount(0);
  });

  test('a press that moves is a scroll, not a long press', async ({ page }) => {
    const box = await tile(page, 'Lisbon').boundingBox();
    await touch(page, { x: box.x + 30, y: box.y + 30 }, async (move) => {
      await move(box.x + 30, box.y + 60);
      await page.waitForTimeout(700);
    });
    await expect(menu(page, 'Lisbon')).toHaveCount(0);
  });
});

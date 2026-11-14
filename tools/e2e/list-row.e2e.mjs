import { test, expect } from '@playwright/test';
import { openDemo } from './helpers.mjs';

/* ListRow's swipe actions from the keyboard, in a real browser: happy-dom has no layout and focuses any element,
   so it can't tell which strip a key measured or whether focus really came back to the row. */
const ROW = '[data-slot=list-row]';

test.beforeEach(async ({ page }) => {
  await openDemo(page, 'lists/swipe-actions', ROW);
});

const row = (page) => page.locator(ROW).first();
const swipe = (page) => row(page).evaluate((el) => ({
  side: el.getAttribute('data-swipe'),
  x: Math.round(parseFloat(el.style.getPropertyValue('--swipe-x'))),
}));
const focused = (page) => page.evaluate(() => document.activeElement?.getAttribute('aria-label')
  ?? (document.activeElement?.hasAttribute('data-list-row-focus') ? 'row' : document.activeElement?.tagName));

test('Left opens the trailing actions, Escape closes them and the row keeps focus, Right opens the leading ones', async ({ page }) => {
  await row(page).locator('[data-list-row-focus]').focus();
  await page.keyboard.press('ArrowLeft');
  await expect.poll(() => swipe(page)).toMatchObject({ side: 'end' });
  expect((await swipe(page)).x).toBeLessThan(-100);
  // DOM order follows the screen, so the leftmost button of the trailing strip takes focus.
  await expect.poll(() => focused(page)).toBe('More');
  await page.keyboard.press('Escape');
  await expect.poll(() => swipe(page)).toEqual({ side: null, x: 0 });
  await expect.poll(() => focused(page)).toBe('row');
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => swipe(page)).toMatchObject({ side: 'start' });
  expect((await swipe(page)).x).toBeGreaterThan(50);
  await expect.poll(() => focused(page)).toMatch(/^(Read|Unread)$/);
});

test('in the open trailing strip, Right walks its buttons and Left back toward the row closes it', async ({ page }) => {
  await row(page).locator('[data-list-row-focus]').focus();
  await page.keyboard.press('ArrowLeft');
  await expect.poll(() => focused(page)).toBe('More');
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => focused(page)).toMatch(/^(Flag|Unflag)$/);
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => focused(page)).toBe('Trash');
  // The screen edge: it stays on the outermost button.
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => focused(page)).toBe('Trash');
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowLeft');
  await expect.poll(() => swipe(page)).toEqual({ side: null, x: 0 });
  await expect.poll(() => focused(page)).toBe('row');
});

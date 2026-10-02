import { test, expect } from '@playwright/test';
import { center, openDemo } from './helpers.mjs';

/* The react-aria hooks pages, through their docs demos (`?demo=aria-<page>/<example>`), driven with real input:
   mouse, touch and pen through CDP, the keyboard, the OS clipboard, native drag and drop. The docs app renders demos
   in StrictMode, so every test also proves the hooks survive a double mount. */

const MOD = 'ControlOrMeta';

/** Dispatches a pointer of `pointerType` pen over a point through CDP (Playwright has no pen API). */
async function pen(cdp, type, { x, y }) {
  await cdp.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1, pointerType: 'pen' });
}

test.describe('usePress, useHover', () => {
  test.beforeEach(async ({ page }) => {
    await openDemo(page, 'aria-press/pressable', 'button');
  });
  const button = (page) => page.getByRole('button', { name: /Press me/ });
  const events = (page) => page.getByRole('list', { name: 'Press events' }).locator('li');
  const flag = (page, name) => page.locator('dl > div', { hasText: name }).locator('dd');
  const lastPointer = (page) => page.locator('[aria-label="Pointer type of the last press"] [data-active]');

  test('a mouse press runs pressstart, pressend, press in that order', async ({ page }) => {
    await button(page).click();
    await expect(events(page)).toHaveText(['press · mouse', 'pressend · mouse', 'pressstart · mouse']);
    await expect(lastPointer(page)).toHaveText('mouse');
  });

  test('Enter and Space press from the keyboard and report the key', async ({ page }) => {
    await button(page).focus();
    await page.keyboard.press('Enter');
    await expect(events(page).first()).toHaveText('press · keyboard · Enter');
    await page.keyboard.press('Space');
    await expect(events(page).first()).toHaveText('press · keyboard · Space');
    await expect(lastPointer(page)).toHaveText('keyboard');
  });

  test('a programmatic click is a virtual press', async ({ page }) => {
    await button(page).evaluate((b) => b.click());
    await expect(events(page).first()).toHaveText('press · virtual');
    await expect(lastPointer(page)).toHaveText('virtual');
  });

  test('moving off while pressed ends the press; releasing off the button does not fire press', async ({ page }) => {
    const c = center(await button(page).boundingBox());
    await page.mouse.move(c.x, c.y);
    await page.mouse.down();
    await expect(flag(page, 'isPressed')).toHaveText('true');
    await page.mouse.move(c.x + 300, c.y + 200, { steps: 5 });
    await expect(flag(page, 'isPressed')).toHaveText('false');
    await page.mouse.move(c.x, c.y, { steps: 8 });
    await expect(flag(page, 'isPressed')).toHaveText('true'); // coming back over restarts the press
    await page.mouse.move(c.x + 300, c.y + 200, { steps: 5 });
    await page.mouse.up();
    await expect(events(page).first()).toHaveText('pressend · mouse');
    await expect(page.getByRole('button', { name: 'Press me (0)' })).toBeVisible();
  });

  test('hover follows the mouse', async ({ page }) => {
    const c = center(await button(page).boundingBox());
    await page.mouse.move(c.x, c.y);
    await expect(flag(page, 'isHovered')).toHaveText('true');
    await page.mouse.move(5, 5);
    await expect(flag(page, 'isHovered')).toHaveText('false');
  });

  test('a pen press reports pen', async ({ page, context }) => {
    const cdp = await context.newCDPSession(page);
    const c = center(await button(page).boundingBox());
    await pen(cdp, 'mousePressed', c);
    await expect(events(page).first()).toHaveText('pressstart · pen');
    await pen(cdp, 'mouseReleased', c);
    await expect(events(page).first()).toHaveText('press · pen');
    await expect(lastPointer(page)).toHaveText('pen');
  });

  test.describe('touch', () => {
    test.use({ hasTouch: true });
    test('a tap reports touch and does not leave the button hovered', async ({ page }) => {
      const c = center(await button(page).boundingBox());
      await page.touchscreen.tap(c.x, c.y);
      await expect(events(page).first()).toHaveText('press · touch');
      await expect(lastPointer(page)).toHaveText('touch');
      await expect(flag(page, 'isHovered')).toHaveText('false');
    });
  });
});

test.describe('useLongPress', () => {
  test.beforeEach(async ({ page }) => {
    await openDemo(page, 'aria-press/long-press', 'button');
  });
  const hold = (page) => page.getByRole('button', { name: 'Hold to archive' });
  const status = (page) => page.getByRole('status');

  test('holding past the threshold fires once and the release is not also a tap', async ({ page }) => {
    const c = center(await hold(page).boundingBox());
    await page.mouse.move(c.x, c.y);
    await page.mouse.down();
    await page.waitForTimeout(300);
    await expect(status(page)).toHaveText('Holding…');
    await expect(page.getByText('Archived: 0')).toBeVisible();
    await expect(status(page)).toHaveText('Archived by a long press', { timeout: 1500 });
    await page.mouse.up();
    await expect(status(page)).toHaveText('Archived by a long press');
    await expect(page.getByText('Archived: 1')).toBeVisible();
  });

  test('releasing before the threshold is a tap, not a long press', async ({ page }) => {
    const c = center(await hold(page).boundingBox());
    await page.mouse.move(c.x, c.y);
    await page.mouse.down();
    await page.waitForTimeout(250);
    await page.mouse.up();
    await expect(status(page)).toHaveText('Tap (mouse)');
    await page.waitForTimeout(700);
    await expect(page.getByText('Archived: 0')).toBeVisible();
  });

  test('sliding off the button cancels the hold', async ({ page }) => {
    const c = center(await hold(page).boundingBox());
    await page.mouse.move(c.x, c.y);
    await page.mouse.down();
    await page.mouse.move(c.x + 400, c.y + 200, { steps: 4 });
    await page.waitForTimeout(900);
    await expect(status(page)).toHaveText('Hold cancelled');
    await page.mouse.up();
    await expect(page.getByText('Archived: 0')).toBeVisible();
  });

  test('keyboard and pen holds do not long press', async ({ page, context }) => {
    await hold(page).focus();
    await page.keyboard.down('Enter');
    await page.waitForTimeout(900);
    await expect(page.getByText('Archived: 0')).toBeVisible();
    await page.keyboard.up('Enter');
    const cdp = await context.newCDPSession(page);
    const c = center(await hold(page).boundingBox());
    await pen(cdp, 'mousePressed', c);
    await page.waitForTimeout(900);
    await pen(cdp, 'mouseReleased', c);
    await expect(page.getByText('Archived: 0')).toBeVisible();
  });

  test('the accessibility description is attached to the button', async ({ page }) => {
    const id = await hold(page).getAttribute('aria-describedby');
    expect(await page.locator(`[id="${id}"]`).textContent()).toBe('Hold to archive');
  });

  test.describe('touch', () => {
    test.use({ hasTouch: true });
    test('a touch hold fires the long press', async ({ page, context }) => {
      const cdp = await context.newCDPSession(page);
      const c = center(await hold(page).boundingBox());
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [c] });
      await expect(status(page)).toHaveText('Archived by a long press', { timeout: 2000 });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await expect(page.getByText('Archived: 1')).toBeVisible();
    });
  });
});

test.describe('useMove', () => {
  test.beforeEach(async ({ page }) => {
    await openDemo(page, 'aria-press/move-handle', '[role=separator]');
  });
  const handle = (page) => page.getByRole('separator', { name: 'Resize sidebar' });
  const now = async (page) => Number(await handle(page).getAttribute('aria-valuenow'));

  test('dragging with the mouse moves the handle by the pointer distance', async ({ page }) => {
    const start = await now(page);
    const c = center(await handle(page).boundingBox());
    await page.mouse.move(c.x, c.y);
    await page.mouse.down();
    await page.mouse.move(c.x + 60, c.y, { steps: 6 });
    await page.mouse.up();
    expect(await now(page)).toBe(start + 60);
    await expect(page.getByText(/^end · mouse/)).toBeVisible();
  });

  test('the arrow keys step by 10, Shift by 40, and Home and End jump to the limits', async ({ page }) => {
    const start = await now(page);
    await handle(page).focus();
    await page.keyboard.press('ArrowRight');
    expect(await now(page)).toBe(start + 10);
    await page.keyboard.press('Shift+ArrowRight');
    expect(await now(page)).toBe(start + 50);
    await page.keyboard.press('ArrowLeft');
    expect(await now(page)).toBe(start + 40);
    await expect(page.getByText(/keyboard/).first()).toBeVisible();
    await page.keyboard.press('End');
    expect(await now(page)).toBe(360);
    await page.keyboard.press('Home');
    expect(await now(page)).toBe(120);
  });

  test('a drag past the limit does not remember the overshoot', async ({ page }) => {
    const c = center(await handle(page).boundingBox());
    await page.mouse.move(c.x, c.y);
    await page.mouse.down();
    await page.mouse.move(c.x + 400, c.y, { steps: 10 }); // the limit is 160 px away
    await page.mouse.move(c.x + 150, c.y, { steps: 10 }); // back inside the limit by 10 px of travel
    await page.mouse.up();
    expect(await now(page)).toBeLessThan(360);
  });

  test.describe('touch', () => {
    test.use({ hasTouch: true });
    test('a touch drag moves it', async ({ page, context }) => {
      const cdp = await context.newCDPSession(page);
      const start = await now(page);
      const c = center(await handle(page).boundingBox());
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [c] });
      for (let i = 1; i <= 5; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: c.x + i * 10, y: c.y }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      expect(await now(page)).toBeGreaterThan(start);
      await expect(page.getByText(/^end · touch/)).toBeVisible();
    });
  });
});

test.describe('useKeyboard shortcuts', () => {
  test.beforeEach(async ({ page }) => {
    await openDemo(page, 'aria-press/shortcuts', 'textarea');
  });
  const row = (page, name) => page.locator('dl > div', { hasText: name }).locator('dd');

  test('a matched shortcut is handled and stops there; the browser default is prevented', async ({ page }) => {
    await page.getByRole('textbox').focus();
    await page.keyboard.press(`${MOD}+s`);
    await expect(row(page, 'Handled by useKeyboard')).toHaveText('Mod+S saved the note');
    await expect(row(page, 'Last save')).toHaveText('Edit me, then press Mod+S.');
    await expect(row(page, 'Reached the parent')).toHaveText('none yet');
  });

  test('keys that match no shortcut carry on to the parent', async ({ page }) => {
    await page.getByRole('textbox').focus();
    await page.keyboard.press('a');
    await expect(row(page, 'Reached the parent')).toHaveText('a');
  });

  test('a handler that returns false lets the key through', async ({ page }) => {
    const box = page.getByRole('textbox');
    await box.fill('');
    await box.focus();
    await page.keyboard.press('Escape');
    await expect(row(page, 'Reached the parent')).toHaveText('Escape');
    await expect(row(page, 'Handled by useKeyboard')).toHaveText('none yet');
  });

  test('extra modifiers do not match', async ({ page }) => {
    await page.getByRole('textbox').focus();
    await page.keyboard.press(`${MOD}+Shift+s`);
    await expect(row(page, 'Handled by useKeyboard')).toHaveText('none yet');
  });
});

test.describe('useContextMenu', () => {
  test.beforeEach(async ({ page }) => {
    await openDemo(page, 'aria-press/context-menu', '[aria-label="Context menu area"]');
  });
  const area = (page) => page.getByRole('group', { name: 'Context menu area' });

  test('a right-click reports the position inside the element', async ({ page }) => {
    const b = await area(page).boundingBox();
    await page.mouse.click(b.x + 50, b.y + 30, { button: 'right' });
    await expect(page.getByRole('status')).toHaveText('x 50, y 30 (request 1)');
  });

  // Headless Chromium does not turn Shift+F10 or the menu key into a `contextmenu` event (that is the OS / browser
  // shell's job), so the keyboard route is checked by dispatching the event a real browser sends for it.
  test('a contextmenu event on the focused element (what Shift+F10 sends) reports its position', async ({ page }) => {
    await area(page).focus();
    await area(page).evaluate((el) => {
      const r = el.getBoundingClientRect();
      el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.x + 20, clientY: r.y + 10 }));
    });
    await expect(page.getByRole('status')).toHaveText('x 20, y 10 (request 1)');
  });
});

test.describe('focus: ring, visible, within', () => {
  test.beforeEach(async ({ page }) => {
    await openDemo(page, 'aria-focus/focus-states', 'input');
  });
  const on = (page) => page.locator('[aria-label="Focus state"] [data-on]');

  test('before any interaction the page counts as keyboard modality', async ({ page }) => {
    await expect(on(page)).toHaveText(['useFocusVisible()']);
  });

  test('a mouse click focuses the button but does not make focus visible', async ({ page }) => {
    await page.getByRole('button', { name: 'Button', exact: true }).click();
    await expect(on(page)).toHaveText(['button isFocused', 'group focus-within']);
    await expect(page.getByRole('button', { name: 'Button', exact: true })).not.toHaveAttribute('data-focus-visible', /.*/);
  });

  test('Tab makes focus visible, on the button and for focus-within', async ({ page }) => {
    await page.getByRole('textbox').focus();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Button', exact: true })).toBeFocused();
    await expect(on(page)).toHaveText(['button isFocused', 'button isFocusVisible', 'group focus-within', 'useFocusVisible()']);
    await expect(page.getByRole('button', { name: 'Button', exact: true })).toHaveAttribute('data-focus-visible', 'true');
  });

  test('clicking a text field: the browser says :focus-visible, react-aria says it is not', async ({ page }) => {
    await page.getByRole('textbox').click();
    await expect(on(page)).toHaveText(['input :focus-visible (CSS)', 'group focus-within']);
  });

  test('FocusRing with `within` adds its class when a child has keyboard focus', async ({ page }) => {
    const wrapper = page.getByText('FocusRing within').locator('xpath=..');
    await expect(wrapper).not.toHaveClass(/ring-\[3px\]/);
    await page.getByRole('button', { name: 'Button', exact: true }).focus();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Inner' })).toBeFocused();
    await expect(wrapper).toHaveClass(/ring-\[3px\]/);
    await page.mouse.click(5, 5);
    await expect(wrapper).not.toHaveClass(/ring-\[3px\]/);
  });
});

test.describe('FocusScope', () => {
  test.beforeEach(async ({ page }) => {
    await openDemo(page, 'aria-focus/focus-scope', 'button');
  });
  const trigger = (page) => page.getByRole('button', { name: 'React', exact: true });
  const panel = (page) => page.getByRole('dialog', { name: 'Add a reaction' });

  test('autoFocus moves focus into the panel when it opens', async ({ page }) => {
    await trigger(page).click();
    await expect(panel(page)).toBeVisible();
    await expect(panel(page).getByRole('button', { name: 'Like' })).toBeFocused();
  });

  test('contain: Tab and Shift+Tab wrap inside the panel', async ({ page }) => {
    await trigger(page).click();
    const inside = async () => page.evaluate(() => !!document.activeElement?.closest('[role=dialog]'));
    for (let i = 0; i < 9; i++) {
      await page.keyboard.press('Tab');
      expect(await inside()).toBe(true);
    }
    for (let i = 0; i < 9; i++) {
      await page.keyboard.press('Shift+Tab');
      expect(await inside()).toBe(true);
    }
  });

  test('useFocusManager: the arrow keys move between the reactions and wrap', async ({ page }) => {
    await trigger(page).click();
    await page.keyboard.press('ArrowRight');
    await expect(panel(page).getByRole('button', { name: 'Love' })).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(panel(page).getByRole('button', { name: 'Like' })).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(panel(page).getByRole('button', { name: 'Laugh' })).toBeFocused();
  });

  test('restoreFocus: Escape closes it and focus returns to the trigger', async ({ page }) => {
    await trigger(page).focus();
    await page.keyboard.press('Enter');
    await expect(panel(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(panel(page)).toHaveCount(0);
    await expect(trigger(page)).toBeFocused();
  });

  test('restoreFocus also works for the Close button', async ({ page }) => {
    await trigger(page).click();
    await panel(page).getByRole('button', { name: 'Close' }).click();
    await expect(panel(page)).toHaveCount(0);
    await expect(trigger(page)).toBeFocused();
  });
});

test.describe('useLandmark', () => {
  test.beforeEach(async ({ page }) => {
    await openDemo(page, 'aria-landmark/regions', '[role=main]');
  });
  const region = (page, name) => page.getByRole(name === 'Site header' ? 'banner' : name === 'Primary' ? 'navigation' : name === 'Messages' ? 'main' : 'complementary', { name });
  const inRegion = (page) => page.evaluate(() => document.activeElement?.closest('[role]')?.getAttribute('aria-label'));

  test('the hook sets the role and label on the element', async ({ page }) => {
    await expect(region(page, 'Primary')).toBeVisible();
    await expect(region(page, 'Messages')).toBeVisible();
  });

  test('F6 moves to the next region in document order, Shift+F6 to the previous', async ({ page }) => {
    await page.getByRole('button', { name: 'Account' }).focus();
    await page.keyboard.press('F6');
    expect(await inRegion(page)).toBe('Primary');
    await page.keyboard.press('F6');
    expect(await inRegion(page)).toBe('Messages');
    await page.keyboard.press('Shift+F6');
    expect(await inRegion(page)).toBe('Primary');
  });

  test('F6 wraps from the last region to the first', async ({ page }) => {
    await page.getByRole('button', { name: 'Share' }).focus();
    await page.keyboard.press('F6');
    expect(await inRegion(page)).toBe('Site header');
  });

  test('Alt+F6 goes to the main region', async ({ page }) => {
    await page.getByRole('button', { name: 'Share' }).focus();
    await page.keyboard.press('Alt+F6');
    expect(await inRegion(page)).toBe('Messages');
  });

  test('coming back to a region restores the element that had focus there', async ({ page }) => {
    await page.getByRole('button', { name: 'Archive' }).focus();
    await page.keyboard.press('F6'); // to Details
    await page.keyboard.press('Shift+F6'); // back to Messages
    await expect(page.getByRole('button', { name: 'Archive' })).toBeFocused();
  });

  test('the first F6 from outside every landmark lands on the first one', async ({ page }) => {
    await page.mouse.click(5, 5);
    await page.keyboard.press('F6');
    expect(await inRegion(page)).toBe('Site header');
  });
});

test.describe('I18nProvider and the locale hooks', () => {
  test.beforeEach(async ({ page }) => {
    await openDemo(page, 'aria-utilities/locale', '[aria-label=Locale]');
  });
  const row = (page, name) => page.locator('dl > div', { hasText: name }).locator('dd').first();

  test('the formatters follow the provider locale', async ({ page }) => {
    await expect(row(page, 'useNumberFormatter')).toHaveText('€1,234.50');
    await page.getByRole('button', { name: 'de-DE' }).click();
    await expect(row(page, 'useNumberFormatter')).toHaveText('1.234,50 €');
    await expect(row(page, 'useDateFormatter')).toHaveText('9. März 2026');
    await expect(row(page, 'useLocale')).toHaveText('de-DE · ltr');
  });

  test('an RTL locale flips the direction', async ({ page }) => {
    await page.getByRole('button', { name: 'ar-EG' }).click();
    await expect(row(page, 'useLocale')).toHaveText('ar-EG · rtl');
    await expect(page.locator('dl[dir=rtl]')).toHaveCount(1);
  });

  test('useFilter with base sensitivity ignores case and accents; useCollator sorts them together', async ({ page }) => {
    await expect(page.locator('[aria-live=polite]')).toHaveText('Élodie, Émile, Zoë, Zoe'); // typing "e" matches É and ë too
    await page.getByRole('textbox').fill('ang');
    await expect(page.locator('[aria-live=polite]')).toHaveText('Ångström');
  });
});

/** A native mouse drag (Chromium dispatches the real drag events). The press is a few pixels off the element's
 *  center on purpose: react-aria reads a press within half a pixel of the center as an assistive-technology click. */
async function mouseDrag(page, from, to) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 5, from.y + 5, { steps: 3 });
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.waitForTimeout(150);
  await page.mouse.up();
}
const offCenter = (b, dx = 10, dy = 8) => ({ x: b.x + dx, y: b.y + dy });
/** Everything react-aria's live announcer (two `role=log` regions) has said so far. */
const announcements = (page) => page.evaluate(() => [...document.querySelectorAll('[role=log]')].map((n) => n.textContent).join(' '));
const expectAnnounced = (page, text) => expect.poll(() => announcements(page)).toContain(text);

test.describe('useDrag and useDrop', () => {
  test.beforeEach(async ({ page }) => {
    await openDemo(page, 'aria-drag-drop/drag-text', '[aria-label=Basket]');
  });
  const chip = (page, name) => page.getByRole('button', { name, exact: true });
  const basket = (page) => page.getByRole('button', { name: 'Basket' });

  test('dragging a chip onto the basket drops it, and the dataTransfer carries every format', async ({ page }) => {
    await page.evaluate(() => {
      window.__types = [];
      document.addEventListener('dragover', (e) => window.__types.push([...e.dataTransfer.types]), true);
    });
    await mouseDrag(page, offCenter(await chip(page, 'Pear').boundingBox()), center(await basket(page).boundingBox()));
    await expect(basket(page)).toContainText('Pear');
    const types = await page.evaluate(() => window.__types.at(-1));
    expect(types).toEqual(expect.arrayContaining(['text/plain', 'application/x-bl-fruit', 'application/vnd.react-aria.items+json']));
  });

  test('the drop target is marked while a valid drag is over it', async ({ page }) => {
    const from = offCenter(await chip(page, 'Apple').boundingBox());
    const to = center(await basket(page).boundingBox());
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + 5, from.y + 5, { steps: 3 });
    await page.mouse.move(to.x, to.y, { steps: 12 });
    await expect(basket(page)).toHaveAttribute('data-drop-target', 'true');
    await expect(chip(page, 'Apple')).toHaveAttribute('data-dragging', 'true');
    await page.mouse.up();
    await expect(basket(page)).not.toHaveAttribute('data-drop-target', /.*/);
    await expect(chip(page, 'Apple')).not.toHaveAttribute('data-dragging', /.*/);
  });

  test('releasing somewhere that is not a drop target drops nothing', async ({ page }) => {
    await mouseDrag(page, offCenter(await chip(page, 'Plum').boundingBox()), { x: 700, y: 60 });
    await expect(basket(page)).toContainText('Drop fruit here');
    await expect(chip(page, 'Plum')).not.toHaveAttribute('data-dragging', /.*/);
  });

  test('keyboard: Enter on a chip starts the drag and moves focus to the target; Enter drops', async ({ page }) => {
    await chip(page, 'Plum').focus();
    await page.keyboard.press('Enter');
    await expect(basket(page)).toBeFocused();
    await expectAnnounced(page, 'Started dragging. Press Tab to navigate to a drop target, then press Enter to drop, or press Escape to cancel.');
    await page.keyboard.press('Enter');
    await expect(basket(page)).toContainText('Plum');
    await expectAnnounced(page, 'Drop complete.');
  });

  test('keyboard: Escape cancels the drag', async ({ page }) => {
    await chip(page, 'Apple').focus();
    await page.keyboard.press('Enter');
    await expect(basket(page)).toBeFocused();
    await page.keyboard.press('Escape');
    await expectAnnounced(page, 'Drop canceled.');
    await expect(basket(page)).toContainText('Drop fruit here');
    await expect(chip(page, 'Apple')).toBeFocused();
  });

  test('the draggable describes how to start a drag', async ({ page }) => {
    await chip(page, 'Pear').focus();
    await page.keyboard.press('ArrowRight'); // a key press makes the modality keyboard
    const text = await chip(page, 'Pear').evaluate((e) => document.getElementById(e.getAttribute('aria-describedby'))?.textContent);
    expect(text).toBe('Press Enter to start dragging.');
  });

  test('a press exactly on the center of the draggable is read as an assistive-technology click, so no native drag starts', async ({ page }) => {
    await mouseDrag(page, center(await chip(page, 'Pear').boundingBox()), center(await basket(page).boundingBox()));
    await expect(basket(page)).toContainText('Drop fruit here');
  });
});

test.describe('DropZone', () => {
  test.beforeEach(async ({ page }) => {
    await openDemo(page, 'aria-drag-drop/drop-zone', '[data-rac]');
  });
  const list = (page) => page.getByRole('list', { name: 'Dropped items' });

  test('dropping text lists it with its formats', async ({ page }) => {
    const zone = page.locator('[data-rac].grid').first();
    await zone.evaluate((el) => {
      const dt = new DataTransfer();
      dt.setData('text/plain', 'dragged words');
      dt.setData('text/html', '<b>dragged words</b>');
      const at = el.getBoundingClientRect();
      const init = { bubbles: true, cancelable: true, dataTransfer: dt, clientX: at.x + 20, clientY: at.y + 20 };
      el.dispatchEvent(new DragEvent('dragenter', init));
      el.dispatchEvent(new DragEvent('dragover', init));
      el.dispatchEvent(new DragEvent('drop', init));
    });
    await expect(list(page)).toContainText('dragged words');
    await expect(list(page)).toContainText('text · text/plain, text/html');
  });

  test('the drop target state shows while a drag is over it', async ({ page }) => {
    const zone = page.locator('[data-rac].grid').first();
    await zone.evaluate((el) => {
      const dt = new DataTransfer();
      dt.setData('text/plain', 'x');
      const at = el.getBoundingClientRect();
      const init = { bubbles: true, cancelable: true, dataTransfer: dt, clientX: at.x + 20, clientY: at.y + 20 };
      el.dispatchEvent(new DragEvent('dragenter', init));
      el.dispatchEvent(new DragEvent('dragover', init));
    });
    await expect(zone).toHaveAttribute('data-drop-target', 'true');
  });

  test('Choose files (FileTrigger) lists the picked files', async ({ page }) => {
    await page.locator('input[type=file]').setInputFiles([
      { name: 'a.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') },
      { name: 'b.png', mimeType: 'image/png', buffer: Buffer.from([1, 2, 3]) },
    ]);
    await expect(list(page)).toContainText('a.txt');
    await expect(list(page)).toContainText('file · text/plain · 5 bytes');
    await expect(list(page)).toContainText('b.png');
  });

  test('keyboard: the zone has a (visually hidden) button a keyboard drag can land on', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Drop files or text here/ })).toHaveCount(1);
  });
});

test.describe('useDragAndDrop: reorder', () => {
  test.beforeEach(async ({ page }) => {
    await openDemo(page, 'aria-drag-drop/reorder', '[role=listbox]');
  });
  const opt = (page, name) => page.getByRole('option', { name });
  const order = (page) => page.getByText(/^Order:/);

  test('mouse: dragging a row above the first moves it to the top', async ({ page }) => {
    const dreams = await opt(page, 'Dreams').boundingBox();
    const gold = await opt(page, 'Golden Hour').boundingBox();
    await mouseDrag(page, { x: dreams.x + 100, y: dreams.y + dreams.height / 2 }, { x: gold.x + 100, y: gold.y + 4 });
    await expect(order(page)).toHaveText('Order: Dreams › Golden Hour › Nightcall › Midnight City › Heat Waves');
  });

  test('keyboard: Enter, ArrowDown to a position, Enter moves the row and announces the position', async ({ page }) => {
    await opt(page, 'Nightcall').focus();
    await page.keyboard.press('Enter');
    await expectAnnounced(page, 'Insert between Nightcall and Midnight City');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    // Later positions are not added to the live region: focus lands on a drop indicator whose accessible name says it.
    await expect.poll(() => page.evaluate(() => document.activeElement?.getAttribute('aria-label'))).toBe('Insert between Heat Waves and Dreams');
    await page.keyboard.press('Enter');
    await expect(order(page)).toHaveText('Order: Golden Hour › Midnight City › Heat Waves › Nightcall › Dreams');
    await expectAnnounced(page, 'Drop complete.');
  });

  test('keyboard: Escape cancels and leaves the order alone', async ({ page }) => {
    await opt(page, 'Nightcall').focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Escape');
    await expect(order(page)).toHaveText('Order: Golden Hour › Nightcall › Midnight City › Heat Waves › Dreams');
    await expectAnnounced(page, 'Drop canceled.');
  });

  test('each row describes how to start a drag', async ({ page }) => {
    await opt(page, 'Nightcall').focus();
    await page.keyboard.press('ArrowRight'); // keyboard modality
    const text = await opt(page, 'Nightcall').evaluate((e) => document.getElementById(e.getAttribute('aria-describedby'))?.textContent);
    expect(text).toContain('start dragging');
  });
});

test.describe('useDragAndDrop: move between lists', () => {
  test.beforeEach(async ({ page }) => {
    await openDemo(page, 'aria-drag-drop/move-between', '[role=listbox]');
  });
  const titles = (page) => page.getByRole('heading');

  test('mouse: a task dragged into the other list leaves its source (a move)', async ({ page }) => {
    const task = await page.getByRole('option', { name: 'Review the PR' }).boundingBox();
    const done = await page.getByRole('option', { name: 'Plan the release' }).boundingBox();
    await mouseDrag(page, { x: task.x + 100, y: task.y + task.height / 2 }, { x: done.x + 100, y: done.y + done.height - 4 });
    await expect(titles(page)).toHaveText(['To do (2)', 'Done (2)']);
    await expect(page.getByRole('region', { name: 'Done' }).getByRole('option')).toHaveText(['Plan the release', 'Review the PR']);
  });

  test('keyboard: Enter, Tab to the other list, Enter', async ({ page }) => {
    await page.getByRole('option', { name: 'Ship it' }).focus();
    await page.keyboard.press('Enter');
    await expectAnnounced(page, 'Insert after Ship it');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await expect(titles(page)).toHaveText(['To do (2)', 'Done (2)']);
    await expectAnnounced(page, 'Drop complete.');
  });

  test('an empty list accepts a root drop', async ({ page }) => {
    // Empty the Done list first by moving its only task back.
    const done = await page.getByRole('option', { name: 'Plan the release' }).boundingBox();
    const todo = await page.getByRole('option', { name: 'Write the docs' }).boundingBox();
    await mouseDrag(page, { x: done.x + 100, y: done.y + done.height / 2 }, { x: todo.x + 100, y: todo.y + 4 });
    await expect(titles(page)).toHaveText(['To do (4)', 'Done (0)']);
    await expect(page.getByText('Drop tasks here')).toBeVisible();
    const empty = await page.getByText('Drop tasks here').boundingBox();
    const task = await page.getByRole('option', { name: 'Ship it' }).boundingBox();
    await mouseDrag(page, { x: task.x + 100, y: task.y + task.height / 2 }, center(empty));
    await expect(titles(page)).toHaveText(['To do (3)', 'Done (1)']);
  });
});

test.describe('useClipboard', () => {
  test.use({ permissions: ['clipboard-read', 'clipboard-write'] });
  const readText = (page) => page.evaluate(() => navigator.clipboard.readText());
  const readTypes = (page) => page.evaluate(async () => (await navigator.clipboard.read()).flatMap((i) => i.types));
  const readHtml = (page) =>
    page.evaluate(async () => {
      const item = (await navigator.clipboard.read())[0];
      return item.types.includes('text/html') ? (await item.getType('text/html')).text() : null;
    });

  test.describe('copy and cut', () => {
    test.beforeEach(async ({ page }) => {
      await openDemo(page, 'aria-clipboard/copy-cut', '[role=group]');
      await page.evaluate(() => navigator.clipboard.writeText('untouched'));
    });
    const snippet = (page, name) => page.getByRole('group', { name: `${name} snippet` });

    test('Mod+C on a focused snippet copies text/plain and text/html, and shows the HUD', async ({ page }) => {
      await snippet(page, 'Install').focus();
      await page.keyboard.press(`${MOD}+c`);
      expect(await readText(page)).toBe('pnpm add @brett_lamy/ui');
      expect(await readTypes(page)).toEqual(expect.arrayContaining(['text/plain', 'text/html']));
      expect(await readHtml(page)).toContain('<pre><code>pnpm add @brett_lamy/ui</code></pre>');
      await expect(page.getByText('Copied “Install”')).toBeVisible();
    });

    test('Mod+X copies and then calls onCut, which removes the row', async ({ page }) => {
      await snippet(page, 'Import').focus();
      await page.keyboard.press(`${MOD}+x`);
      expect(await readText(page)).toBe("import { Button } from '@/components/ui/button'");
      await expect(snippet(page, 'Import')).toHaveCount(0);
      await expect(page.getByText('Cut “Import”')).toBeVisible();
    });

    test('nothing happens when the element is not focused', async ({ page }) => {
      await page.mouse.click(5, 5);
      await page.keyboard.press(`${MOD}+c`);
      expect(await readText(page)).toBe('untouched');
    });

    test('a focused snippet only answers for itself', async ({ page }) => {
      await snippet(page, 'Theme').focus();
      await page.keyboard.press(`${MOD}+c`);
      expect(await readText(page)).toBe('<ThemeScope appearance="dark">…</ThemeScope>');
    });

    test('the Copy button writes through the async Clipboard API', async ({ page }) => {
      await page.getByRole('button', { name: 'Copy' }).first().click();
      // The async Clipboard API resolves after the click returns: wait for the write to land.
      await expect.poll(() => readText(page)).toBe('pnpm add @brett_lamy/ui');
      expect(await readHtml(page)).toContain('<code>pnpm add');
    });

    test('a native copy event on the focused snippet carries the three formats, custom type included', async ({ page }) => {
      await snippet(page, 'Install').focus();
      const out = await page.evaluate(() => {
        const dt = new DataTransfer();
        document.activeElement.dispatchEvent(new ClipboardEvent('copy', { clipboardData: dt, bubbles: true, cancelable: true }));
        return { types: [...dt.types], custom: dt.getData('application/vnd.react-aria.items+json') };
      });
      expect(out.types).toEqual(expect.arrayContaining(['text/plain', 'text/html', 'application/x-bl-snippet', 'application/vnd.react-aria.items+json']));
      expect(JSON.parse(out.custom)[0]['application/x-bl-snippet']).toContain('"action":"copy"');
    });
  });

  test('custom types survive a real copy and paste in the browser, but the async API only lists the standard two', async ({ page }) => {
    await openDemo(page, 'aria-clipboard/copy-cut', '[role=group]');
    await page.getByRole('group', { name: 'Install snippet' }).focus();
    await page.keyboard.press(`${MOD}+c`);
    expect(await page.evaluate(async () => (await navigator.clipboard.read())[0].types)).toEqual(['text/plain', 'text/html']);
    await openDemo(page, 'aria-clipboard/paste-inspector', '[role=group]');
    await page.getByRole('group', { name: 'Paste target' }).focus();
    await page.keyboard.press(`${MOD}+v`);
    await expect(page.getByRole('status', { name: 'Pasted items' })).toContainText('text · text/plain, text/html, application/x-bl-snippet');
  });

  test.describe('paste', () => {
    test.beforeEach(async ({ page }) => {
      await openDemo(page, 'aria-clipboard/paste-inspector', '[role=group]');
    });
    const target = (page) => page.getByRole('group', { name: 'Paste target' });
    const pasted = (page) => page.getByRole('status', { name: 'Pasted items' });

    test('Mod+V on the focused target reads the clipboard text', async ({ page }) => {
      await page.evaluate(() => navigator.clipboard.writeText('hello from the clipboard'));
      await target(page).focus();
      await page.keyboard.press(`${MOD}+v`);
      await expect(pasted(page)).toContainText('text · text/plain');
      await expect(pasted(page)).toContainText('hello from the clipboard');
    });

    test('a paste while the target is not focused is ignored', async ({ page }) => {
      await page.evaluate(() => navigator.clipboard.writeText('nope'));
      await page.mouse.click(5, 5);
      await page.keyboard.press(`${MOD}+v`);
      await expect(pasted(page)).toContainText('Nothing pasted yet.');
    });

    test('text arrives as ONE item that lists every format it carries', async ({ page }) => {
      await target(page).focus();
      await page.evaluate(() => {
        const dt = new DataTransfer();
        dt.setData('text/plain', 'plain words');
        dt.setData('text/html', '<b>plain words</b>');
        document.activeElement.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
      });
      await expect(pasted(page).locator('> div')).toHaveCount(1);
      await expect(pasted(page)).toContainText('text · text/plain, text/html');
    });

    test('a copied image arrives as a file item with a name, a type and bytes', async ({ page }) => {
      // A real image on the system clipboard (written through the async API), pasted with the real shortcut.
      await page.evaluate(async () => {
        const c = document.createElement('canvas');
        c.width = c.height = 4;
        c.getContext('2d').fillRect(0, 0, 4, 4);
        const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      });
      await target(page).focus();
      await page.keyboard.press(`${MOD}+v`);
      await expect(pasted(page)).toContainText('file · image/png');
      await expect(pasted(page)).toContainText('image.png');
      await expect(page.getByRole('img', { name: 'Pasted image.png' })).toBeVisible();
    });

    test('a copy made with the async API pastes back as text and html', async ({ page }) => {
      await page.evaluate(() =>
        navigator.clipboard.write([new ClipboardItem({ 'text/plain': new Blob(['x'], { type: 'text/plain' }), 'text/html': new Blob(['<i>x</i>'], { type: 'text/html' }) })]),
      );
      await target(page).focus();
      await page.keyboard.press(`${MOD}+v`);
      await expect(pasted(page)).toContainText('text · text/plain, text/html');
    });
  });
});

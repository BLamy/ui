import { test, expect } from '@playwright/test';
import { center, drag, openDemo } from './helpers.mjs';

/* The behaviors pages, through their docs demos (`?demo=behaviors-<page>/<example>`), driven with real input: the
   keyboard, the mouse, and touch through CDP. Each demo is a primitive built from UI SDK's behaviors (or the kit's own,
   in packages/ui/src/lib), so these prove the behaviors work in a browser, not only in happy-dom. The docs app renders
   demos in StrictMode, so every test also proves they survive a double mount. */

const MOD = 'ControlOrMeta';

/** A touch drag through CDP: down at `from`, `steps` moves to `to`, then up. */
async function touchDrag(page, from, to, { steps = 12, hold = 0 } = {}) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [from] });
  for (let i = 1; i <= steps; i++) {
    const point = { x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point] });
    await page.waitForTimeout(16);
  }
  if (hold) await page.waitForTimeout(hold);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

/** A mouse drag between two points, in small steps (so pointer capture and drag thresholds are exercised). */
async function mouseDrag(page, from, to, { steps = 16 } = {}) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(from.x + ((to.x - from.x) * i) / steps, from.y + ((to.y - from.y) * i) / steps);
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
}

test.describe('roving focus, typeahead, focus recovery (task list)', () => {
  test.beforeEach(async ({ page }) => {
    await openDemo(page, 'behaviors-focus/task-list', '[role="listitem"]');
  });
  const tasks = (page) => page.getByRole('list', { name: 'Tasks' }).getByRole('listitem');
  // A list item takes no name from its content: find it by its text.
  const task = (page, text) => tasks(page).filter({ hasText: text });

  test('one tab stop; arrows, Home and End move focus', async ({ page }) => {
    await expect(tasks(page).first()).toHaveAttribute('tabindex', '0');
    await expect(tasks(page).nth(1)).toHaveAttribute('tabindex', '-1');
    await tasks(page).first().focus();
    await page.keyboard.press('ArrowDown');
    await expect(tasks(page).nth(1)).toBeFocused();
    await expect(tasks(page).nth(1)).toHaveAttribute('tabindex', '0');
    await expect(tasks(page).first()).toHaveAttribute('tabindex', '-1');
    await page.keyboard.press('End');
    await expect(tasks(page).last()).toBeFocused();
    await page.keyboard.press('Home');
    await expect(tasks(page).first()).toBeFocused();
  });

  test('typing a letter cycles through the tasks that start with it', async ({ page }) => {
    await tasks(page).first().focus();
    await page.keyboard.press('r');
    await expect(task(page, 'Review the design')).toBeFocused();
    await page.waitForTimeout(1100); // past the typeahead's timeout, so the next R is a new search
    await page.keyboard.press('r');
    await expect(task(page, 'Rename the repo')).toBeFocused();
  });

  test('removing the focused task moves focus to the one that took its place', async ({ page }) => {
    await tasks(page).first().focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Delete');
    await expect(tasks(page)).toHaveCount(5);
    await expect(task(page, 'Plan the offsite')).toBeFocused();
    await page.keyboard.press('End');
    await page.keyboard.press('Backspace');
    await expect(task(page, 'Rename the repo')).toBeFocused();
  });
});

test.describe('grid focus (seat map)', () => {
  test('arrows move by row and column, and Tab leaves the grid', async ({ page }) => {
    await openDemo(page, 'behaviors-focus/seat-grid', '[role="grid"]');
    const grid = page.getByRole('grid');
    const first = grid.locator('[tabindex="0"]').first();
    await first.focus();
    const name = async () => page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.textContent);
    const start = await name();
    await page.keyboard.press('ArrowRight');
    const right = await name();
    expect(right).not.toBe(start);
    await page.keyboard.press('ArrowDown');
    expect(await name()).not.toBe(right);
    expect(await grid.locator('[tabindex="0"]').count()).toBe(1);
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('[role="grid"]'))).toBe(false);
  });
});

test.describe('selection (file list)', () => {
  test.beforeEach(async ({ page }) => {
    await openDemo(page, 'behaviors-selection/file-list', '[role="option"]');
  });
  const file = (page, name) => page.getByRole('option', { name });
  const status = (page) => page.locator('[aria-live="polite"]');

  test('click chooses, Command/Control-click toggles, Shift-click extends', async ({ page }) => {
    await file(page, 'notes.md').click();
    await expect(file(page, 'notes.md')).toHaveAttribute('aria-selected', 'true');
    await expect(status(page)).toHaveText('1 selected (item-press): notes.md');
    await file(page, 'photo.jpg').click({ modifiers: [MOD] });
    await expect(status(page)).toHaveText('2 selected (item-press): notes.md, photo.jpg');
    await file(page, 'budget.xlsx').click();
    await file(page, 'draft.docx').click({ modifiers: ['Shift'] });
    await expect(page.getByRole('option', { selected: true })).toHaveText(['budget.xlsx', 'photo.jpg', 'slides.key', 'draft.docx']);
  });

  test('Shift+arrows extend from the anchor, Space toggles, Command/Control+A selects all', async ({ page }) => {
    await file(page, 'notes.md').click();
    await page.keyboard.press('Shift+ArrowDown');
    await page.keyboard.press('Shift+ArrowDown');
    await expect(page.getByRole('option', { selected: true })).toHaveText(['notes.md', 'budget.xlsx', 'photo.jpg']);
    await expect(file(page, 'photo.jpg')).toBeFocused();
    await expect(status(page)).toContainText('(list-navigation)');
    await page.keyboard.press('Space');
    await expect(file(page, 'photo.jpg')).toHaveAttribute('aria-selected', 'false');
    await page.keyboard.press(`${MOD}+a`);
    await expect(page.getByRole('option', { selected: true })).toHaveCount(6);
    await page.keyboard.press(`${MOD}+a`);
    await expect(page.getByRole('option', { selected: true })).toHaveCount(0);
  });
});

test.describe('reorder (sortable)', () => {
  test.beforeEach(async ({ page }) => {
    await openDemo(page, 'behaviors-drag-drop/sortable', '[role="option"]');
  });
  const items = (page) => page.getByRole('listbox', { name: 'Favorite seasons' }).getByRole('option');
  const status = (page) => page.locator('[aria-live="polite"]').last();

  test('Space picks up, the arrows move, Space drops', async ({ page }) => {
    await items(page).first().focus();
    await page.keyboard.press('Space');
    await expect(items(page).first()).toHaveAttribute('data-grabbed', '');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Space');
    await expect(items(page)).toHaveText(['1Summer', '2Autumn', '3Spring', '4Winter']);
    await expect(status(page)).toContainText('Summer, Autumn, Spring, Winter');
    await expect(page.getByRole('option', { name: /Spring/ })).toBeFocused();
  });

  test('Escape cancels a keyboard move', async ({ page }) => {
    await items(page).first().focus();
    await page.keyboard.press('Space');
    await page.keyboard.press('End');
    await page.keyboard.press('Escape');
    await expect(items(page)).toHaveText(['1Spring', '2Summer', '3Autumn', '4Winter']);
    await expect(page.locator('[data-grabbed]')).toHaveCount(0);
  });

  test('dragging a row with the mouse drops it where it is let go', async ({ page }) => {
    const from = center(await items(page).first().boundingBox());
    const to = center(await items(page).nth(2).boundingBox());
    await mouseDrag(page, from, { x: from.x, y: to.y + 6 });
    await expect(items(page)).toHaveText(['1Summer', '2Autumn', '3Spring', '4Winter']);
    await expect(status(page)).toContainText('Summer, Autumn, Spring, Winter');
  });
});

test.describe('transfer (two lists)', () => {
  test.beforeEach(async ({ page }) => {
    await openDemo(page, 'behaviors-drag-drop/transfer', '[role="option"]');
  });
  const list = (page, name) => page.getByRole('listbox', { name }).getByRole('option');
  const status = (page) => page.locator('[aria-live="polite"]');

  test('the keyboard moves an item into the other list', async ({ page }) => {
    await list(page, 'Closet').first().focus();
    await page.keyboard.press('Space');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Space');
    await expect(list(page, 'Closet')).toHaveText(['Boots', 'Scarf']);
    await expect(list(page, 'Bag')).toContainText(['Jacket']);
    await expect(status(page)).toContainText('Jacket');
  });

  test('a mouse drag moves an item into the other list', async ({ page }) => {
    const from = center(await list(page, 'Closet').nth(1).boundingBox());
    const to = center(await page.getByRole('listbox', { name: 'Bag' }).boundingBox());
    await mouseDrag(page, from, to, { steps: 20 });
    await expect(list(page, 'Closet')).toHaveText(['Jacket', 'Scarf']);
    await expect(list(page, 'Bag')).toContainText(['Boots']);
    await expect(page.locator('[data-dragging]')).toHaveCount(0);
  });
});

test.describe('resize (eight handles)', () => {
  test.beforeEach(async ({ page }) => {
    await openDemo(page, 'behaviors-dragging/resize', '[aria-label="Frame"]');
  });
  const status = (page) => page.locator('[aria-live="polite"]');

  test('dragging the right handle widens the box, snapped to the step', async ({ page }) => {
    const handle = page.getByRole('button', { name: 'Resize right' });
    const before = await page.getByRole('group', { name: 'Frame' }).boundingBox();
    await drag(page, center(await handle.boundingBox()), 41);
    await expect(status(page)).toHaveText(/^176 × 96 at 92, 48 \(/);
    const after = await page.getByRole('group', { name: 'Frame' }).boundingBox();
    expect(Math.round(after.width - before.width)).toBe(40);
  });

  test('the arrows move a handle by one step, Shift by ten; bounds hold', async ({ page }) => {
    const handle = page.getByRole('button', { name: 'Resize bottom', exact: true });
    await handle.focus();
    await page.keyboard.press('ArrowDown');
    await expect(status(page)).toHaveText(/^136 × 100 at 92, 48/);
    await page.keyboard.press('Shift+ArrowDown');
    await page.keyboard.press('Shift+ArrowDown');
    await expect(status(page)).toHaveText(/^136 × 144 at 92, 48/); // bottom bound is 192
  });

  test('Escape cancels a drag under way', async ({ page }) => {
    const handle = page.getByRole('button', { name: 'Resize right' });
    await drag(page, center(await handle.boundingBox()), 40, { release: false });
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await expect(status(page)).toHaveText('136 × 96 at 92, 48');
  });
});

test.describe('popups (createPopup with the popover preset)', () => {
  test.beforeEach(async ({ page }) => {
    await openDemo(page, 'behaviors-popups/invite-popover', 'button');
  });
  const trigger = (page) => page.getByRole('button', { name: 'Invite' });
  const popup = (page) => page.getByRole('dialog', { name: 'Invite people' });
  const log = (page) => page.locator('[aria-live="polite"]');

  test('opens beside the trigger, moves focus in, and Escape returns it', async ({ page }) => {
    await trigger(page).click();
    await expect(popup(page)).toBeVisible();
    await expect(trigger(page)).toHaveAttribute('aria-expanded', 'true');
    await expect(log(page)).toHaveText(/^Opened · /);
    const t = await trigger(page).boundingBox();
    const p = await popup(page).boundingBox();
    expect(p.y).toBeGreaterThanOrEqual(t.y + t.height); // below, with the offset
    expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(popup(page)).toBeHidden();
    await expect(log(page)).toHaveText('Closed · escape-key');
    await expect(trigger(page)).toBeFocused();
  });

  test('a press outside closes it; Done closes it', async ({ page }) => {
    await trigger(page).click();
    await expect(popup(page)).toBeVisible();
    await page.mouse.click(10, 10);
    await expect(popup(page)).toBeHidden();
    await expect(log(page)).toHaveText('Closed · outside-press');
    await trigger(page).click();
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(popup(page)).toBeHidden();
    await expect(log(page)).toHaveText(/^Closed · /);
  });
});

test.describe('layer hosts', () => {
  test.beforeEach(async ({ page }) => {
    await openDemo(page, 'behaviors-layer-hosts/contained-dialog', '[data-layer-host]');
  });
  const frame = (page, name) => page.locator('[data-layer-host]').filter({ hasText: name }).first();

  test('a dialog stays inside its host, and only that host is inert', async ({ page }) => {
    const left = frame(page, 'Left');
    const right = frame(page, 'Right');
    await left.getByRole('button', { name: 'Rename…' }).click();
    const dialog = page.getByRole('dialog', { name: 'Rename Left' });
    await expect(dialog).toBeVisible();
    const host = await left.boundingBox();
    const box = await dialog.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(host.x - 1);
    expect(box.y).toBeGreaterThanOrEqual(host.y - 1);
    expect(box.x + box.width).toBeLessThanOrEqual(host.x + host.width + 1);
    expect(box.y + box.height).toBeLessThanOrEqual(host.y + host.height + 1);
    // The dialog renders inside the host, not the top layer or the body.
    expect(await dialog.evaluate((el) => !!el.closest('[data-layer-host]'))).toBe(true);
    // The other frame, outside the host, stays usable: its own dialog opens while the first is open.
    await right.getByRole('button', { name: 'Rename…' }).click();
    await expect(page.getByRole('dialog', { name: 'Rename Right' })).toBeVisible();
    await expect(dialog).toBeVisible();
  });

  test('Escape closes only the focused host’s dialog', async ({ page }) => {
    const left = frame(page, 'Left');
    const right = frame(page, 'Right');
    await left.getByRole('button', { name: 'Rename…' }).click();
    await right.getByRole('button', { name: 'Rename…' }).click();
    await expect(page.getByRole('dialog', { name: 'Rename Right' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Rename Right' })).toBeHidden();
    await expect(page.getByRole('dialog', { name: 'Rename Left' })).toBeVisible();
    await expect(right.getByText(/^Closed by /)).toHaveText('Closed by escape-key');
    await expect(left.getByText('Open', { exact: true })).toBeVisible();
  });
});

test.describe('page stack (nav stack)', () => {
  test.beforeEach(async ({ page }) => {
    await openDemo(page, 'behaviors-kit/nav-stack', '[aria-label="Settings"]');
  });
  const log = (page) => page.locator('[aria-live="polite"]');
  const heading = (page, name) => page.getByRole('heading', { name, exact: true });

  test('push moves focus to the new page; Back and Escape pop and return focus', async ({ page }) => {
    await page.getByRole('button', { name: 'Wi-Fi' }).click();
    await expect(log(page)).toHaveText('root › wifi · trigger-press');
    await expect(heading(page, 'Wi-Fi')).toBeFocused();
    await page.getByRole('button', { name: 'Other network…' }).click();
    await expect(log(page)).toHaveText('root › wifi › other · trigger-press');
    await expect(heading(page, 'Other network')).toBeFocused();
    // The covered pages are inert.
    expect(await page.getByRole('button', { name: 'Notifications' }).evaluate((el) => !!el.closest('[inert]'))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(log(page)).toHaveText(/^root › wifi · /);
    await expect(page.getByRole('button', { name: 'Other network…' })).toBeFocused();
    await page.getByRole('button', { name: 'Settings' }).click();
    await expect(log(page)).toHaveText('root · trigger-press');
    await expect(page.getByRole('button', { name: 'Wi-Fi' })).toBeFocused();
  });

  test.describe('touch', () => {
    test.use({ hasTouch: true });
    test('a swipe from the left edge pops; a short one springs back', async ({ page }) => {
      await page.getByRole('button', { name: 'Wi-Fi' }).click();
      await expect(heading(page, 'Wi-Fi')).toBeVisible();
      const box = await page.locator('[aria-label="Settings"]').first().boundingBox();
      const y = box.y + box.height / 2;
      await touchDrag(page, { x: box.x + 6, y }, { x: box.x + 40, y });
      await page.waitForTimeout(400);
      await expect(log(page)).toHaveText('root › wifi · trigger-press');
      await touchDrag(page, { x: box.x + 6, y }, { x: box.x + box.width * 0.8, y });
      await expect(log(page)).toHaveText(/^root · /);
      await expect(page.getByRole('button', { name: 'Wi-Fi' })).toBeVisible();
    });
  });
});

test.describe('pull to refresh', () => {
  test.use({ hasTouch: true });
  test('a pull past the threshold refreshes; a mouse uses the button', async ({ page }) => {
    await openDemo(page, 'behaviors-kit/pull-to-refresh', '[aria-label="Messages"]');
    const list = page.locator('[aria-label="Messages"]');
    await expect(list.getByText(/ · /)).toHaveCount(3);
    const box = await list.boundingBox();
    const x = box.x + box.width / 2;
    await touchDrag(page, { x, y: box.y + 20 }, { x, y: box.y + 260 }, { steps: 20 });
    await expect(list).toHaveAttribute('aria-busy', 'true');
    await expect(list.getByText(/ · /)).toHaveCount(4, { timeout: 5000 });
    await expect(list).not.toHaveAttribute('data-pending', /.*/);
    // A short pull doesn't.
    await touchDrag(page, { x, y: box.y + 20 }, { x, y: box.y + 40 }, { steps: 4 });
    await page.waitForTimeout(1200);
    await expect(list.getByText(/ · /)).toHaveCount(4);
    await page.getByRole('button', { name: 'Refresh' }).click();
    await expect(list.getByText(/ · /)).toHaveCount(5, { timeout: 5000 });
  });
});

test.describe('size classes', () => {
  test('the frame names its own width, and Share follows it', async ({ page }) => {
    await openDemo(page, 'behaviors-kit/size-class', '[data-size-class]');
    const frame = page.locator('[data-size-class]').first();
    await expect(frame).toHaveAttribute('data-size-class', 'compact');
    await expect(page.getByRole('navigation', { name: 'Mailboxes' })).toBeHidden();
    await page.getByRole('slider').fill('500');
    await expect(frame).toHaveAttribute('data-size-class', 'medium');
    await expect(page.getByRole('navigation', { name: 'Mailboxes' })).toBeVisible();
    await page.getByRole('slider').fill('700');
    await expect(frame).toHaveAttribute('data-size-class', 'regular');
    await expect(page.getByRole('complementary', { name: 'Details' })).toBeVisible();
    // Regular: a popover beside the trigger, inside the frame.
    await page.getByRole('button', { name: 'Share' }).click();
    const popup = page.getByRole('dialog', { name: 'Share' });
    await expect(popup).toBeVisible();
    expect(await popup.evaluate((el) => !!el.closest('[data-size-class]'))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(popup).toBeHidden();
    // Compact: a sheet inside the frame, across its width.
    await page.getByRole('slider').fill('320');
    await expect(frame).toHaveAttribute('data-size-class', 'compact');
    await page.getByRole('button', { name: 'Share' }).click();
    await expect(popup).toBeVisible();
    const f = await frame.boundingBox();
    const s = await popup.boundingBox();
    expect(s.x).toBeGreaterThanOrEqual(f.x - 1);
    expect(s.x + s.width).toBeLessThanOrEqual(f.x + f.width + 1);
    expect(s.width).toBeGreaterThan(f.width * 0.8);
  });
});

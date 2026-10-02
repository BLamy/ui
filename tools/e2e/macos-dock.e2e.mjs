import { test, expect } from '@playwright/test';
import { openDemo, settled } from './helpers.mjs';

/* The macOS block's Dock: right-click for Magnification and Hiding; a hidden Dock slides up from the bottom edge. */
test.beforeEach(async ({ page }) => {
  await page.route(/arcgisonline|openstreetmap|tile\./, (route) => route.abort());
  await openDemo(page, 'blocks/macos', '[data-slot=macos-dock]');
});

const dock = (page) => page.locator('[data-slot=macos-dock]');
const item = (page, name) => page.getByRole('menuitem', { name });
const vh = (page) => page.viewportSize().height;
const top = async (page) => Math.round((await dock(page).boundingBox()).y);
const hiddenOffscreen = async (page) => (await top(page)) >= (await vh(page)) - 1;
const shownOnscreen = async (page) => (await top(page)) < (await vh(page)) - 40;
const restTop = (page) => settled(page, () => top(page));

async function menu(page, target = dock(page).getByRole('button', { name: 'Open Mail' })) {
  await target.click({ button: 'right' });
  await expect(page.getByRole('menu')).toBeVisible();
}

test('right-click opens a menu with both preferences, above the Dock', async ({ page }) => {
  await menu(page);
  await expect(item(page, 'Turn Magnification Off')).toBeVisible();
  await expect(item(page, 'Turn Hiding On')).toBeVisible();
  const m = await page.getByRole('menu').boundingBox();
  expect(m.y + m.height).toBeLessThanOrEqual((await dock(page).boundingBox()).y);
});

test('the menu opens where the click landed', async ({ page }) => {
  const mail = dock(page).getByRole('button', { name: 'Open Mail' });
  const last = dock(page).getByRole('button', { name: 'Open Loop QA' });
  await menu(page, mail);
  const a = (await page.getByRole('menu').boundingBox()).x;
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toHaveCount(0);
  await menu(page, last);
  const b = (await page.getByRole('menu').boundingBox()).x;
  expect(b).toBeGreaterThan(a + 200);
});

test('the menu key opens it from a focused icon, and Escape hands focus back', async ({ page }) => {
  const mail = dock(page).getByRole('button', { name: 'Open Mail' });
  await mail.focus();
  await page.keyboard.press('ContextMenu');
  await expect(page.getByRole('menu')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(mail).toBeFocused();
});

test('Escape closes the menu without changing anything', async ({ page }) => {
  await menu(page);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toHaveCount(0);
  await menu(page);
  await expect(item(page, 'Turn Magnification Off')).toBeVisible();
});

test.describe('magnification', () => {
  const lifted = async (page) => {
    const mail = dock(page).getByRole('button', { name: 'Open Mail' });
    await mail.hover();
    await page.waitForTimeout(500);
    return mail.evaluate((e) => { const r = e.getBoundingClientRect(); return r.width > e.offsetWidth + 1 ? 'scaled' : 'flat'; });
  };

  test('icons grow under the pointer, and stop when it is turned off', async ({ page }) => {
    expect(await lifted(page)).toBe('scaled');
    await menu(page);
    await item(page, 'Turn Magnification Off').click();
    await expect(page.getByRole('menu')).toHaveCount(0);
    expect(await lifted(page)).toBe('flat');
    await menu(page);
    await expect(item(page, 'Turn Magnification On')).toBeVisible();
    await item(page, 'Turn Magnification On').click();
    expect(await lifted(page)).toBe('scaled');
  });
});

test.describe('hiding', () => {
  async function hide(page) {
    await menu(page);
    await item(page, 'Turn Hiding On').click();
    await expect(page.getByRole('menu')).toHaveCount(0);
    // The pointer is still where the menu was; let the browser notice it left the Dock's area.
    await page.mouse.move(120, 200);
    await expect.poll(() => hiddenOffscreen(page)).toBe(true);
  }

  test('Turn Hiding On slides the Dock off the bottom of the screen', async ({ page }) => {
    expect(await shownOnscreen(page)).toBe(true);
    await hide(page);
  });

  test('it hides even when the pointer never moves after choosing Turn Hiding On', async ({ page }) => {
    // The pointer is on the menu when it closes; the menu is gone, so the browser never reports the pointer leaving.
    await menu(page);
    await item(page, 'Turn Hiding On').click();
    await expect.poll(() => hiddenOffscreen(page)).toBe(true);
  });

  test('a hidden Dock slides up at the bottom edge and away again', async ({ page }) => {
    await hide(page);
    const { width, height } = page.viewportSize();
    await page.mouse.move(width / 2, height - 3);
    await expect.poll(() => shownOnscreen(page)).toBe(true);
    await restTop(page);
    await page.mouse.move(width / 2, 200);
    await expect.poll(() => hiddenOffscreen(page)).toBe(true);
  });

  test('a revealed Dock stays while the pointer is on it and opens apps', async ({ page }) => {
    await hide(page);
    const { width, height } = page.viewportSize();
    await page.mouse.move(width / 2, height - 3);
    await expect.poll(() => shownOnscreen(page)).toBe(true);
    await restTop(page);
    await dock(page).getByRole('button', { name: 'Open Notes' }).click();
    await expect(page.locator('[data-slot=macos-windows] > *')).toHaveCount(1);
  });

  test('the Dock comes up for keyboard focus too', async ({ page }) => {
    await hide(page);
    await page.keyboard.press('Tab'); // from the page into the Dock's buttons, wherever the first tab stop is
    for (let i = 0; i < 40 && (await hiddenOffscreen(page)); i++) await page.keyboard.press('Tab');
    await expect.poll(() => shownOnscreen(page)).toBe(true);
  });

  test('windows take the Dock’s room back while it is hidden, and give it up when it returns', async ({ page }) => {
    await dock(page).getByRole('button', { name: 'Open Notes' }).click();
    const zoom = page.getByRole('button', { name: 'Zoom Notes' });
    await zoom.click();
    const win = page.locator('[data-slot=macos-windows] > *').first();
    const bottom = async () => { await page.waitForTimeout(900); const b = await win.boundingBox(); return Math.round(b.y + b.height); };
    const withDock = await bottom();
    expect(withDock).toBeLessThan(await vh(page) - 60);
    await hide(page);
    expect(await bottom()).toBe(await vh(page));
    // Turn it back off: the Dock returns and the window gives its room up again.
    const { width, height } = page.viewportSize();
    await page.mouse.move(width / 2, height - 3);
    await expect.poll(() => shownOnscreen(page)).toBe(true);
    await menu(page);
    await item(page, 'Turn Hiding Off').click();
    expect(await bottom()).toBe(withDock);
  });
});

/* The macOS desktop beyond the Dock: per-icon menus, ⌥Tab, edge snapping and (opt-in) persistence. */
test.describe('desktop', () => {
  const windows = (page) => page.locator('[data-slot=macos-windows] > [data-slot=macos-window]');
  const openApp = (page, name) => page.getByRole('button', { name: new RegExp(`^(Open|Show) ${name}$`) }).click();
  const front = (page) => page.locator('[data-slot=macos-window][data-front]').getAttribute('data-app');
  /** A window opens with a pop-in: wait for its title bar to hold still before measuring or dragging it. */
  const settledBar = async (page) => {
    const bar = page.locator('[data-slot=macos-titlebar]').first();
    await settled(page, async () => { const b = await bar.boundingBox(); return b && [Math.round(b.x), Math.round(b.y), Math.round(b.width)]; });
    return bar.boundingBox();
  };

  test('an icon has its own menu: Open, Quit while running, and the dock preferences', async ({ page }) => {
    const mail = dock(page).getByRole('button', { name: /Mail$/ });
    await mail.click({ button: 'right' });
    await expect(page.getByRole('menu', { name: 'Mail dock menu' })).toBeVisible();
    await expect(page.getByRole('menuitem')).toHaveText(['Open', 'Turn Magnification Off', 'Turn Hiding On']);
    await page.keyboard.press('Escape');
    await mail.click();
    await expect(windows(page)).toHaveCount(1);
    await mail.click({ button: 'right' });
    await expect(page.getByRole('menuitem')).toHaveText(['Show', 'Quit', 'Turn Magnification Off', 'Turn Hiding On']);
    await page.getByRole('menuitem', { name: 'Quit' }).click();
    await expect(windows(page)).toHaveCount(0);
  });

  test('right-clicking the gap beside the icons still gets the dock preferences alone', async ({ page }) => {
    const box = await dock(page).boundingBox();
    // The dock's left padding, left of the first icon.
    await page.mouse.click(box.x + 3, box.y + box.height / 2, { button: 'right' });
    await expect(page.getByRole('menu')).toBeVisible();
    await expect(page.getByRole('menuitem')).toHaveText(['Turn Magnification Off', 'Turn Hiding On']);
  });

  test('⌥Tab brings back the window behind the front one, cycling between two', async ({ page }) => {
    await openApp(page, 'Mail');
    await openApp(page, 'Notes');
    await expect.poll(() => front(page)).toBe('notes');
    await page.keyboard.press('Alt+Tab');
    await expect.poll(() => front(page)).toBe('mail');
    await page.keyboard.press('Alt+Tab');
    await expect.poll(() => front(page)).toBe('notes');
  });

  test('dragging a title bar to the left edge shows a preview and snaps to the left half', async ({ page }) => {
    await openApp(page, 'Notes');
    const win = page.locator('[data-slot=macos-window]').first();
    const bar = await settledBar(page);
    const layer = await page.locator('[data-slot=macos-windows]').boundingBox();
    await page.mouse.move(bar.x + 200, bar.y + 10);
    await page.mouse.down();
    await page.mouse.move(layer.x + 4, bar.y + 40, { steps: 10 });
    await expect(page.locator('[data-slot=macos-snap-preview]')).toBeVisible();
    await page.mouse.up();
    await expect(page.locator('[data-slot=macos-snap-preview]')).toHaveCount(0);
    await expect.poll(async () => { const b = await win.boundingBox(); return Math.round(b.x - layer.x); }).toBe(0);
    const b = await win.boundingBox();
    expect(Math.abs(b.width - layer.width / 2)).toBeLessThan(2);
  });

  test('dragging to the right edge snaps to the right half; mid-screen does not snap', async ({ page }) => {
    await openApp(page, 'Notes');
    const win = page.locator('[data-slot=macos-window]').first();
    const bar = await settledBar(page);
    const layer = await page.locator('[data-slot=macos-windows]').boundingBox();
    // A drag that ends mid-screen leaves it where it was dropped.
    await page.mouse.move(bar.x + 200, bar.y + 10);
    await page.mouse.down();
    await page.mouse.move(bar.x + 260, bar.y + 40, { steps: 6 });
    await expect(page.locator('[data-slot=macos-snap-preview]')).toHaveCount(0);
    await page.mouse.up();
    const moved = await win.boundingBox();
    expect(moved.width).toBeGreaterThan(layer.width / 2 + 10);
    // Then to the right edge.
    const bar2 = await settledBar(page);
    await page.mouse.move(bar2.x + 200, bar2.y + 10);
    await page.mouse.down();
    await page.mouse.move(layer.x + layer.width - 3, bar2.y + 40, { steps: 10 });
    await page.mouse.up();
    await expect.poll(async () => { const b = await win.boundingBox(); return Math.round(b.x + b.width - (layer.x + layer.width)); }).toBe(0);
  });

  test('dragging to the top edge zooms the window', async ({ page }) => {
    await openApp(page, 'Notes');
    const win = page.locator('[data-slot=macos-window]').first();
    const bar = await settledBar(page);
    const layer = await page.locator('[data-slot=macos-windows]').boundingBox();
    await page.mouse.move(bar.x + 200, bar.y + 10);
    await page.mouse.down();
    await page.mouse.move(bar.x + 200, layer.y + 2, { steps: 10 });
    await page.mouse.up();
    await expect(page.getByRole('button', { name: 'Exit full size Notes' })).toBeVisible();
  });
});

test.describe('persistence (opt-in)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?demo=macos/persistent&theme=light', { waitUntil: 'load' });
    await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('bl-macos-demo')).forEach((k) => localStorage.removeItem(k)));
    await page.reload({ waitUntil: 'load' });
    await page.locator('[data-slot=macos-dock]').waitFor();
  });
  const windows = (page) => page.locator('[data-slot=macos-windows] > [data-slot=macos-window]');

  test('windows, their order and the Dock preferences come back after a reload', async ({ page }) => {
    await dock(page).getByRole('button', { name: /Open Mail$/ }).click();
    await dock(page).getByRole('button', { name: /Open Notes$/ }).click();
    await expect(windows(page)).toHaveCount(2);
    await page.getByRole('button', { name: 'Zoom Notes' }).click();
    await menu(page, dock(page).getByRole('button', { name: 'Alfred' }));
    await item(page, 'Turn Magnification Off').click();
    await expect(page.getByRole('menu')).toHaveCount(0);
    await page.waitForTimeout(300);
    await page.reload({ waitUntil: 'load' });
    await page.locator('[data-slot=macos-dock]').waitFor();
    await expect(windows(page)).toHaveCount(2);
    await expect(page.getByRole('button', { name: 'Exit full size Notes' })).toBeVisible();
    expect(await page.locator('[data-slot=macos-window][data-front]').getAttribute('data-app')).toBe('notes');
    await menu(page, dock(page).getByRole('button', { name: 'Alfred' }));
    await expect(item(page, 'Turn Magnification On')).toBeVisible();
  });

  test('a stored layout that is not valid is ignored', async ({ page }) => {
    await page.evaluate(() => localStorage.setItem('bl-macos-demo:desktop', JSON.stringify({ v: 1, z: 3, windows: [{ app: 'nonexistent', x: 1, y: 1, w: 1, h: 1, z: 1, minimized: false, zoomed: false }] })));
    await page.reload({ waitUntil: 'load' });
    await page.locator('[data-slot=macos-dock]').waitFor();
    await expect(windows(page)).toHaveCount(0);
  });

  test('corrupt storage does not break the desktop', async ({ page }) => {
    await page.evaluate(() => { localStorage.setItem('bl-macos-demo:desktop', '{not json'); localStorage.setItem('bl-macos-demo:dock', '"x"'); });
    await page.reload({ waitUntil: 'load' });
    await expect(dock(page)).toBeVisible();
    await dock(page).getByRole('button', { name: /Open Mail$/ }).click();
    await expect(windows(page)).toHaveCount(1);
  });
});

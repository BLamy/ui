import { test, expect } from '@playwright/test';
import { center, openDemo } from './helpers.mjs';

/* The Interface Builder block: picking on the storyboard. MainTabs shows the Garden scene in place (a TabView's tab,
   through GardenNav's NavigationStack), so its rows are Garden's and are selected, moved and edited right there. */
test.use({ viewport: { width: 1400, height: 900 } });

test.beforeEach(async ({ page }) => {
  await openDemo(page, 'blocks/interface-builder', '[data-ib-scene-frame=main]');
  await frame(page, 'main', 640);
});

/** Zooms and pans until a scene's frame is about `height` px tall in the middle of the canvas. */
async function frame(page, id, height) {
  const el = page.locator(`[data-ib-scene=${id}]`);
  for (let i = 0; i < 8; i++) {
    const b = await el.boundingBox();
    const k = height / b.height;
    if (Math.abs(k - 1) < 0.06) break;
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, -Math.log(k) / 0.009);
    await page.keyboard.up('Control');
    await page.waitForTimeout(120);
  }
  const b = await el.boundingBox();
  const c = await page.locator('[data-slot=canvas]').boundingBox();
  await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2);
  await page.mouse.wheel(b.x + b.width / 2 - (c.x + c.width / 2), b.y + b.height / 2 - (c.y + c.height / 2));
  await page.waitForTimeout(200);
}

const inMain = (page, id) => page.locator(`[data-ib-scene-frame=main] [data-ib-node="${id}"]`).first();
/** The selection's name tag (over the instance that was picked). */
const nameTag = (page) => page.locator('[data-slot=canvas-board] div.bg-primary.whitespace-nowrap').first();

test('a click selects what’s drawn under the pointer, inside a scene shown in place', async ({ page }) => {
  await page.mouse.click(...Object.values(center(await inMain(page, 'plant-row').boundingBox())));
  await expect(nameTag(page)).toContainText('Garden ›');
  await expect(nameTag(page)).toContainText('Plant Cell');
});

test('⌘-click replaces the selection; ⇧-click adds to it', async ({ page }) => {
  const row = center(await inMain(page, 'plant-row').boundingBox());
  const add = center(await inMain(page, 'add-plant').boundingBox());
  await page.mouse.click(row.x, row.y);
  await page.keyboard.down('Meta');
  await page.mouse.click(add.x, add.y);
  await page.keyboard.up('Meta');
  await expect(nameTag(page)).toContainText('Add Button');
  await page.keyboard.down('Shift');
  await page.mouse.click(row.x, row.y);
  await page.keyboard.up('Shift');
  // Two nodes: no name tag, both outlined.
  await expect(nameTag(page)).toHaveCount(0);
  expect(await page.locator('[data-slot=canvas-frame]').count()).toBeGreaterThan(2);
});

test('the tab bar picks its TabView, not the row drawn behind it', async ({ page }) => {
  const tab = page.locator('[data-ib-scene-frame=main] [role=tab]').first();
  await page.mouse.click(...Object.values(center(await tab.boundingBox())));
  await expect(nameTag(page)).toContainText('TabView');
});

test('Esc walks out to what shows the scene: the stack, the tab’s scene, the TabView', async ({ page }) => {
  await page.mouse.click(...Object.values(center(await inMain(page, 'plant-row').boundingBox())));
  const seen = [];
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('Escape');
    seen.push(await nameTag(page).textContent());
  }
  expect(seen.some((t) => t?.includes('NavigationStack'))).toBe(true);
  expect(seen.some((t) => t?.includes('<GardenNav />'))).toBe(true);
  expect(seen.at(-1)).toContain('TabView');
});

test('right-click lists everything under the pointer; choosing one selects it', async ({ page }) => {
  await page.mouse.click(...Object.values(center(await inMain(page, 'plant-row').boundingBox())), { button: 'right' });
  const items = page.locator('[data-slot=dropdown-menu-item]');
  await expect(items.first()).toContainText('Plant Cell');
  await expect(items.filter({ hasText: 'TabView' })).toHaveCount(1);
  await items.filter({ hasText: 'ListSection' }).click();
  await expect(nameTag(page)).toContainText('ListSection');
});

test('a double-click edits a text where it is; Return keeps it everywhere the scene is shown', async ({ page }) => {
  const title = inMain(page, 'today-title');
  await page.mouse.dblclick(...Object.values(center(await title.boundingBox())));
  await expect(page.locator('[data-ib-scene-frame=main] [contenteditable]')).toHaveCount(1);
  await page.keyboard.type('Due today');
  await page.keyboard.press('Enter');
  await expect(page.locator('[contenteditable]')).toHaveCount(0);
  await expect(page.locator('[data-ib-scene-frame=garden] [data-ib-node=today-title]')).toHaveText('Due today');
  await expect(title).toHaveText('Due today');
  await page.keyboard.press('Meta+z');
  await expect(page.locator('[data-ib-scene-frame=garden] [data-ib-node=today-title]')).toHaveText('Today');
});

test('pressing inside the selection drags the selection', async ({ page }) => {
  const title = center(await inMain(page, 'today-title').boundingBox());
  await page.mouse.click(title.x, title.y);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await expect(nameTag(page)).toContainText('Card');
  const list = await inMain(page, 'plant-list').boundingBox();
  await page.mouse.move(title.x, title.y);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) {
    await page.mouse.move(title.x, title.y + (list.y + list.height + 14 - title.y) * (i / 12));
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
  const order = await page.evaluate(() => {
    const r = document.querySelector('[data-ib-scene-frame=garden] [data-ib-node=garden-root]');
    return [...r.querySelectorAll('[data-ib-node]')].filter((c) => c.parentElement.closest('[data-ib-node]') === r).map((c) => c.dataset.ibNode);
  });
  expect(order.at(-1)).toBe('today-card');
});

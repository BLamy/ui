import { test, expect } from '@playwright/test';
import { openDemo } from './helpers.mjs';

/* Diagram, through its docs demos, with real input. */

const zoomOf = (page) => page.locator('[data-slot=diagram-layer]').evaluate((el) => Number(el.style.getPropertyValue('--diagram-z')));
const strokeOf = (page, selector) => page.locator(selector).first().evaluate((el) => parseFloat(getComputedStyle(el).strokeWidth));

/** ⌘-scrolls until the zoom's at or just past `target`, from either side. */
async function zoomTo(page, target) {
  const c = await page.locator('[data-slot=canvas]').boundingBox();
  await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2);
  await page.keyboard.down('Control');
  const out = (await zoomOf(page)) > target;
  for (let i = 0; i < 80; i++) {
    const z = await zoomOf(page);
    if (out ? z <= target : z >= target) break;
    await page.mouse.wheel(0, out ? 50 : -50);
    await expect.poll(() => zoomOf(page)).not.toBe(z);
  }
  await page.keyboard.up('Control');
}

test.describe('drawing', () => {
  test.beforeEach(async ({ page }) => {
    await openDemo(page, 'diagram/machine', '[data-slot=diagram-node]');
  });

  test('draws the machine: 40 nodes, 43 edges, 2 dividers, 36 labels', async ({ page }) => {
    await expect(page.locator('[data-slot=diagram-node]')).toHaveCount(40);
    await expect(page.locator('[data-slot=diagram-edge]')).toHaveCount(43);
    await expect(page.locator('[data-slot=diagram-divider]')).toHaveCount(2);
    await expect(page.locator('[data-slot=diagram-edge-label]')).toHaveCount(36);
  });

  for (const target of [0.02, 4]) {
    test(`lines keep their thickness at ${target}`, async ({ page }) => {
      const before = await zoomOf(page);
      expect(await strokeOf(page, '[data-slot=diagram-edge]') * before).toBeCloseTo(1.25, 1);
      await zoomTo(page, target);
      const z = await zoomOf(page);
      expect(z).toBeCloseTo(target, 2);
      expect(await strokeOf(page, '[data-slot=diagram-edge]') * z).toBeCloseTo(1.25, 1);
      expect(await strokeOf(page, '[data-slot=diagram-divider]') * z).toBeCloseTo(1, 1);
    });
  }

  test('text hides as the board gets too small to read it, and comes back', async ({ page }) => {
    const node = page.locator('[data-node="upload.worker.streaming"] [data-slot=diagram-node-label]');
    const edge = page.locator('[data-slot=diagram-edge-label]').first();
    await zoomTo(page, 1);
    await expect(node).toBeVisible();
    await expect(edge).toBeVisible();
    await zoomTo(page, 0.3);
    await expect(node).toBeVisible();
    await expect(edge).toBeHidden();
    await zoomTo(page, 0.1);
    await expect(node).toBeHidden();
    await expect(edge).toBeHidden();
    await zoomTo(page, 0.5);
    await expect(node).toBeVisible();
    await expect(edge).toBeVisible();
  });

  test('the arrowhead keeps its size on screen from 100% up, and shrinks with the board below', async ({ page }) => {
    const scale = () => page.locator('marker path').first().evaluate((el) => getComputedStyle(el).transform);
    await zoomTo(page, 4);
    expect(await scale()).toBe('matrix(1, 0, 0, 1, 0, 0)');
    await zoomTo(page, 0.1);
    expect(await scale()).toBe('matrix(0.4, 0, 0, 0.4, 0, 0)');
  });

  test('the minimap moves the same camera', async ({ page }) => {
    await expect(page.locator('[data-slot=canvas-minimap] rect').first()).toBeVisible();
    await zoomTo(page, 1);
    const map = await page.locator('[data-slot=canvas-minimap]').boundingBox();
    const before = await page.locator('[data-slot=canvas-board]').getAttribute('style');
    await page.mouse.click(map.x + map.width * 0.8, map.y + map.height / 2);
    await expect.poll(() => page.locator('[data-slot=canvas-board]').getAttribute('style')).not.toBe(before);
  });
});

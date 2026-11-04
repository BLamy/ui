import { readdirSync, readFileSync } from 'node:fs';
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

test.describe('text', () => {
  /** How far each node's words sit from its edges, in board units. */
  const margins = (scope) => scope.evaluate((root) => {
    const z = Number(root.querySelector('[data-slot=diagram-layer]').style.getPropertyValue('--diagram-z'));
    const out = [];
    for (const node of root.querySelectorAll('[data-slot=diagram-node]')) {
      if (!['node', 'final'].includes(node.dataset.kind)) continue;
      const box = node.getBoundingClientRect();
      for (const el of node.querySelectorAll('[data-slot=diagram-node-label], [data-slot=diagram-node-detail]')) {
        if (!el.textContent) continue;
        const range = document.createRange();
        range.selectNodeContents(el);
        const r = range.getBoundingClientRect();
        out.push({
          node: node.dataset.node, kind: node.dataset.kind, text: el.textContent, w: box.width / z,
          left: (r.left - box.left) / z, right: (box.right - r.right) / z, top: (r.top - box.top) / z, bottom: (box.bottom - r.bottom) / z,
        });
      }
    }
    return out;
  });
  /** A node's padding is 12 across, and a final state's inner line takes up 6 of that. Down, it's what's left of 8. */
  const clear = (list) => {
    for (const m of list) {
      const across = m.kind === 'final' ? 7 : 9;
      expect.soft(Math.min(m.left, m.right), `${m.text}: across`).toBeGreaterThanOrEqual(across);
      expect.soft(Math.min(m.top, m.bottom), `${m.text}: down`).toBeGreaterThanOrEqual(3);
    }
    expect(list.length).toBeGreaterThan(0);
  };
  const nodeWidth = (scope, id) => scope.locator(`[data-node="${id}"]`).evaluate((el) => parseFloat(el.style.width));
  /** What a node's width should be: its words, measured here and now, as wide as they want to be, plus padding and border. */
  const widthOfWords = (scope, id, slot) => scope.locator(`[data-node="${id}"] [data-slot=${slot}]`).evaluate((el) => {
    const probe = el.cloneNode(true);
    probe.style.cssText = 'position:absolute;width:max-content;max-width:none;visibility:hidden';
    el.parentElement.append(probe);
    const exact = parseFloat(getComputedStyle(probe).width);
    probe.remove();
    return Math.ceil(exact) + 12 * 2 + 2;
  });

  for (const theme of ['light', 'dark']) {
    test(`no text touches a node's edge in the 33-state machine, in ${theme}`, async ({ page }) => {
      await page.goto(`/?demo=diagram/machine&theme=${theme}`, { waitUntil: 'load' });
      await page.locator('[data-slot=diagram-node]').first().waitFor({ timeout: 30_000 });
      await expect.poll(() => nodeWidth(page, 'upload.worker.streaming')).toBeGreaterThan(60);
      const list = await margins(page.locator('[data-slot=diagram]'));
      // 25 states have words: 15 ordinary ones (7 with a second line) and 10 final ones.
      expect(list.filter((m) => m.kind === 'final')).toHaveLength(10);
      clear(list);
    });
  }

  test('long names, names with no spaces and CJK all stay inside their nodes', async ({ page }) => {
    await openDemo(page, 'diagram/sized-text', '[data-slot=diagram-node]');
    const plain = page.locator('[data-demo=plain] [data-slot=diagram]');
    await expect.poll(() => nodeWidth(plain, 'long')).toBeGreaterThan(100);
    const list = await margins(plain);
    expect(list.map((m) => m.node)).toEqual(expect.arrayContaining(['long', 'nospaces', 'cjk', 'cjklong', 'final', 'emoji']));
    clear(list);
    // Long words wrap rather than making the node as long as they are.
    expect(await nodeWidth(plain, 'nospaces')).toBeLessThan(260);
    expect(await nodeWidth(plain, 'long')).toBeLessThan(260);
    // And they wrap the way they were measured: the words fill the height the node was given, no more.
    const fits = await plain.locator('[data-node=nospaces] [data-slot=diagram-node-label]').evaluate((el) => el.scrollHeight <= el.parentElement.clientHeight);
    expect(fits).toBe(true);
  });

  test('measures in the font the diagram is in, from a ThemeScope', async ({ page }) => {
    await openDemo(page, 'diagram/sized-text', '[data-slot=diagram-node]');
    const plain = page.locator('[data-demo=plain] [data-slot=diagram]');
    const serif = page.locator('[data-demo=serif] [data-slot=diagram]');
    await expect.poll(() => nodeWidth(serif, 'detail')).toBeGreaterThan(100);
    const family = (scope) => scope.locator('[data-node=detail] [data-slot=diagram-node-label]').evaluate((el) => getComputedStyle(el).fontFamily);
    expect(await family(serif)).toContain('Georgia');
    expect(await family(plain)).not.toContain('Georgia');
    expect(await nodeWidth(serif, 'detail')).not.toBe(await nodeWidth(plain, 'detail'));
    clear(await margins(serif));
  });

  test('measures again when the words change', async ({ page }) => {
    await openDemo(page, 'diagram/sized-text', '[data-slot=diagram-node]');
    const plain = page.locator('[data-demo=plain] [data-slot=diagram]');
    await expect.poll(() => nodeWidth(plain, 'long')).toBeGreaterThan(100);
    const before = await nodeWidth(plain, 'short');
    await page.getByRole('button', { name: 'Rename the first node' }).click();
    await expect.poll(() => nodeWidth(plain, 'short')).toBeGreaterThan(before + 60);
    // Measured, and not just estimated, which would get it about right.
    expect(await nodeWidth(plain, 'short')).toBe(await widthOfWords(plain, 'short', 'diagram-node-label'));
    clear(await margins(plain));
  });

  test('a font that arrives late causes a new measure', async ({ page }) => {
    const pnpm = new URL('../../node_modules/.pnpm/', import.meta.url);
    const katex = readdirSync(pnpm).find((d) => d.startsWith('katex@'));
    const font = readFileSync(new URL(`${katex}/node_modules/katex/dist/fonts/KaTeX_SansSerif-Bold.woff2`, pnpm));
    let release;
    const released = new Promise((r) => { release = r; });
    await page.route('**/late-font.woff2', async (route) => {
      await released;
      await route.fulfill({ body: font, contentType: 'font/woff2' });
    });
    await openDemo(page, 'diagram/sized-text', '[data-slot=diagram-node]');
    const plain = page.locator('[data-demo=plain] [data-slot=diagram]');
    await expect.poll(() => nodeWidth(plain, 'detail')).toBeGreaterThan(100);
    const before = await nodeWidth(plain, 'detail');
    // The diagram's font changes to one that hasn't arrived: the browser falls back, and nothing's wrong yet.
    await page.addStyleTag({ content: `
      @font-face { font-family: 'Late'; src: url('/late-font.woff2') format('woff2'); font-display: swap; }
      [data-demo=plain] [data-slot=diagram] { font-family: 'Late', sans-serif; }
    ` });
    await plain.locator('[data-node=detail] [data-slot=diagram-node-label]').evaluate((el) => document.fonts.load(`12px Late`, el.textContent).catch(() => null) && null);
    await expect.poll(() => page.evaluate(() => document.fonts.status)).toBe('loading');
    expect(await nodeWidth(plain, 'detail')).toBe(before);
    // Measure while it's still loading, so what's remembered for this font is really the fallback's.
    await page.getByRole('button', { name: 'Rename the first node' }).click();
    await expect.poll(() => nodeWidth(plain, 'short')).toBeGreaterThan(100);
    release();
    await expect.poll(() => page.evaluate(() => document.fonts.status), { timeout: 10_000 }).toBe('loaded');
    // What the words measure now, in the font that came. It has to differ, or this shows nothing.
    const fresh = await widthOfWords(plain, 'detail', 'diagram-node-detail');
    expect(fresh).not.toBe(before);
    // The node follows it, without anything else having happened.
    await expect.poll(() => nodeWidth(plain, 'detail'), { timeout: 10_000 }).toBe(fresh);
    clear(await margins(plain));
  });
});

import { readdirSync, readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { openDemo } from './helpers.mjs';

/* Diagram, through its docs demos, with real input. */

const zoomOf = (page) => page.locator('[data-slot=diagram-layer]').evaluate((el) => Number(el.style.getPropertyValue('--diagram-z')));
const strokeOf = (page, selector) => page.locator(selector).first().evaluate((el) => parseFloat(getComputedStyle(el).strokeWidth));

/** ⌘-scrolls to `target`. One wheel event zooms by e^(-delta * 0.009), and at most 50 of delta counts. */
async function zoomTo(page, target) {
  const c = await page.locator('[data-slot=canvas]').boundingBox();
  await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2);
  await page.keyboard.down('Control');
  for (let i = 0; i < 80; i++) {
    const z = await zoomOf(page);
    if (Math.abs(z - target) < target * 0.002) break;
    await page.mouse.wheel(0, Math.max(-50, Math.min(50, -Math.log(target / z) / 0.009)));
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

test.describe('editing', () => {
  const open = async (page, query = '') => {
    await page.goto(`/?demo=diagram/editing&theme=light${query}`, { waitUntil: 'load' });
    await page.locator('[data-slot=diagram-node]').first().waitFor({ timeout: 30_000 });
  };
  const nodeBox = async (page, id) => {
    const b = await page.locator(`[data-node="${id}"]`).boundingBox();
    return { x: b.x + b.width / 2, y: b.y + b.height / 2, left: b.x, top: b.y, w: b.width, h: b.height };
  };
  const board = (page, id) => page.locator(`[data-node="${id}"]`).evaluate((el) => ({ x: parseFloat(el.style.left), y: parseFloat(el.style.top) }));
  const selected = (page) => page.locator('[data-demo-selection]').getAttribute('data-demo-selection');
  const changes = (page) => page.locator('[data-demo-changes]').getAttribute('data-demo-changes');
  const route = (page, id) => page.locator(`[data-slot=diagram-edge][data-edge="${id}"]`).getAttribute('d');
  /** A real drag, in steps. `release` says whether to let go. */
  const dragBy = async (page, from, dx, dy, { steps = 10, release = true, modifier } = {}) => {
    await page.mouse.move(from.x, from.y);
    if (modifier) await page.keyboard.down(modifier);
    await page.mouse.down();
    for (let i = 1; i <= steps; i++) {
      await page.mouse.move(from.x + (dx * i) / steps, from.y + (dy * i) / steps);
      await page.waitForTimeout(8);
    }
    if (release) await page.mouse.up();
    if (modifier) await page.keyboard.up(modifier);
  };
  /** A place on the canvas with no node or line near it, and room for a marquee. */
  const blank = (page) => page.evaluate(() => {
    const c = document.querySelector('[data-slot=canvas]').getBoundingClientRect();
    const boxes = [...document.querySelectorAll('[data-slot=diagram-node], [data-slot=diagram-edge], [data-slot=diagram-edge-label]')].map((el) => el.getBoundingClientRect());
    const room = 70;
    for (let y = c.top + 12; y < c.bottom - room; y += 16) for (let x = c.left + 12; x < c.right - room; x += 16) {
      if (!boxes.some((b) => x + room > b.left - 8 && x - 8 < b.right && y + room > b.top - 8 && y - 8 < b.bottom)) return { x, y };
    }
    return { x: c.right - 12, y: c.bottom - 12 };
  });

  test('a press selects, the modifier adds, and a press on nothing clears', async ({ page }) => {
    await open(page);
    const a = await nodeBox(page, 'a'), b = await nodeBox(page, 'b');
    await page.mouse.click(a.x, a.y);
    expect(await selected(page)).toBe('a');
    await expect(page.locator('[data-node=a]')).toHaveAttribute('data-selected', 'true');
    await page.keyboard.down('Shift');
    await page.mouse.click(b.x, b.y);
    await page.keyboard.up('Shift');
    expect(await selected(page)).toBe('a b');
    const space = await blank(page);
    await page.mouse.click(space.x, space.y);
    expect(await selected(page)).toBe('');
    await expect(page.locator('[data-node=a]')).not.toHaveAttribute('data-selected');
  });

  test('a press on an edge, or its label, selects the edge', async ({ page }) => {
    await open(page);
    const line = await page.locator('[data-slot=diagram-edge][data-edge=bc]').boundingBox();
    await page.mouse.click(line.x + line.width / 2, line.y + line.height / 2);
    expect(await selected(page)).toBe('bc');
    await expect(page.locator('[data-slot=diagram-edge][data-edge=bc]')).toHaveAttribute('data-selected', 'true');
    const label = await page.locator('[data-slot=diagram-edge-label][data-edge=ab]').boundingBox();
    await page.mouse.click(label.x + label.width / 2, label.y + label.height / 2);
    expect(await selected(page)).toBe('ab');
  });

  test('dragging a node moves it by exactly as far, and its edges follow', async ({ page }) => {
    await open(page);
    const before = await nodeBox(page, 'far');
    const was = await board(page, 'far');
    await dragBy(page, before, 83, 47);
    expect(await board(page, 'far')).toEqual({ x: was.x + 83, y: was.y + 47 });
    expect(await changes(page)).toBe('move');
    const line0 = await route(page, 'ab');
    // ⌘ stops it snapping to anything on the way, so it goes exactly this far.
    await dragBy(page, await nodeBox(page, 'a'), 0, 60, { modifier: 'Meta' });
    const line1 = await route(page, 'ab');
    expect(line1).not.toBe(line0);
    // It leaves from the node's new place, and still arrives where it did.
    expect(line1.startsWith('M150 138')).toBe(true);
    expect(line1.endsWith('240 78')).toBe(true);
  });

  test('an edge with no route of its own follows too', async ({ page }) => {
    await open(page);
    const line0 = await route(page, 'kk');
    await dragBy(page, await nodeBox(page, 'kid2'), 30, 20);
    expect(await route(page, 'kk')).not.toBe(line0);
  });

  test('dragging a compound takes its children, and a child drags its compound’s walls out', async ({ page }) => {
    await open(page);
    const kid = await board(page, 'kid1');
    const box = await nodeBox(page, 'box');
    await dragBy(page, { x: box.left + 10, y: box.top + 10 }, 40, 30);
    expect(await board(page, 'kid1')).toEqual({ x: kid.x + 40, y: kid.y + 30 });
    const wallBefore = await page.locator('[data-node=box]').evaluate((el) => parseFloat(el.style.width));
    const kid2 = await nodeBox(page, 'kid2');
    await dragBy(page, kid2, 90, 0);
    expect(await page.locator('[data-node=box]').evaluate((el) => parseFloat(el.style.width))).toBeGreaterThan(wallBefore);
  });

  test('shows a guide while lining up with something', async ({ page }) => {
    await open(page);
    const c = await nodeBox(page, 'c');
    await dragBy(page, c, 40, -90, { release: false, steps: 20 });
    await expect(page.locator('[data-slot=canvas-guide]').first()).toBeVisible();
    await page.mouse.up();
    await expect(page.locator('[data-slot=canvas-guide]')).toHaveCount(0);
  });

  test('a marquee selects what it touches, and its line stays thin at any zoom', async ({ page }) => {
    await open(page);
    const a = await nodeBox(page, 'a');
    await dragBy(page, { x: a.left - 15, y: a.top - 15 }, 180, 80, { release: false });
    expect(await selected(page)).toContain('a');
    const marquee = page.locator('[data-slot=canvas-marquee]');
    await expect(marquee).toBeVisible();
    await page.mouse.up();
    await expect(marquee).toHaveCount(0);
    expect(await selected(page)).toContain('a');
    for (const target of [0.5, 2.5]) {
      await zoomTo(page, target);
      await dragBy(page, await blank(page), 60, 60, { release: false });
      const onScreen = await marquee.evaluate((el) => {
        const z = Number(document.querySelector('[data-slot=diagram-layer]').style.getPropertyValue('--diagram-z'));
        const s = getComputedStyle(el);
        // However it's drawn, border or inset shadow: its thickness in board units, times the zoom.
        const border = parseFloat(s.borderTopWidth) || 0;
        const shadow = /inset/.test(s.boxShadow) ? parseFloat(s.boxShadow.match(/(-?[\d.]+)px (-?[\d.]+)px (-?[\d.]+)px (-?[\d.]+)px/)[4]) : 0;
        return (border + shadow) * z;
      });
      expect(onScreen).toBeCloseTo(1, 1);
      await page.mouse.up();
    }
  });

  test('a selected node’s ring is the same thickness at any zoom', async ({ page }) => {
    await open(page);
    const a = await nodeBox(page, 'a');
    await page.mouse.click(a.x, a.y);
    const ring = () => page.locator('[data-node=a]').evaluate((el) => {
      const z = Number(document.querySelector('[data-slot=diagram-layer]').style.getPropertyValue('--diagram-z'));
      const spreads = [...getComputedStyle(el).boxShadow.matchAll(/(-?[\d.]+)px (-?[\d.]+)px (-?[\d.]+)px (-?[\d.]+)px/g)].map((m) => parseFloat(m[4]));
      return Math.max(...spreads) * z;
    });
    expect(await ring()).toBeCloseTo(3.6, 1);
    await zoomTo(page, 3.5);
    expect(await ring()).toBeCloseTo(3.6, 1);
    await zoomTo(page, 0.3);
    expect(await ring()).toBeCloseTo(3.6, 1);
  });

  test('undo and redo come through the same change event, a whole drag at a time', async ({ page }) => {
    await open(page);
    const was = await board(page, 'far');
    await dragBy(page, await nodeBox(page, 'far'), 70, 30, { steps: 12 });
    expect(await changes(page)).toBe('move');
    const moved = await board(page, 'far');
    await page.keyboard.press('ControlOrMeta+z');
    expect(await board(page, 'far')).toEqual(was);
    expect(await changes(page)).toBe('move undo');
    await page.keyboard.press('ControlOrMeta+Shift+z');
    expect(await board(page, 'far')).toEqual(moved);
    expect(await changes(page)).toBe('move undo redo');
    // Nothing further to redo, and undoing past the start does nothing.
    await page.keyboard.press('ControlOrMeta+Shift+z');
    expect(await changes(page)).toBe('move undo redo');
    await page.keyboard.press('ControlOrMeta+z');
    await page.keyboard.press('ControlOrMeta+z');
    expect(await changes(page)).toBe('move undo redo undo');
    // A new change clears what could be redone.
    await dragBy(page, await nodeBox(page, 'far'), 10, 60);
    await page.keyboard.press('ControlOrMeta+Shift+z');
    expect(await changes(page)).toBe('move undo redo undo move');
  });

  test('delete takes what’s selected and its edges, and undo brings them back', async ({ page }) => {
    await open(page);
    const c = await nodeBox(page, 'c');
    await page.mouse.click(c.x, c.y);
    await page.keyboard.press('Delete');
    await expect(page.locator('[data-node=c]')).toHaveCount(0);
    await expect(page.locator('[data-slot=diagram-edge][data-edge=bc]')).toHaveCount(0);
    await expect(page.locator('[data-slot=diagram-edge][data-edge=loop]')).toHaveCount(0);
    expect(await selected(page)).toBe('');
    expect(await changes(page)).toBe('delete');
    await page.keyboard.press('ControlOrMeta+z');
    await expect(page.locator('[data-node=c]')).toHaveCount(1);
    await expect(page.locator('[data-slot=diagram-edge][data-edge=bc]')).toHaveCount(1);
  });

  test('⌘A selects everything, and Escape lets go', async ({ page }) => {
    await open(page);
    const a = await nodeBox(page, 'a');
    await page.mouse.click(a.x, a.y);
    await page.keyboard.press('ControlOrMeta+a');
    expect((await selected(page)).split(' ').length).toBe(7 + 5);
    await page.keyboard.press('Escape');
    expect(await selected(page)).toBe('');
  });

  test('deleting what’s being dragged drops the drag, and there’s nothing left to move', async ({ page }) => {
    await open(page);
    await dragBy(page, await nodeBox(page, 'far'), 70, 30, { release: false });
    await page.keyboard.press('Delete');
    await expect(page.locator('[data-node=far]')).toHaveCount(0);
    await page.mouse.move(300, 300);
    await page.mouse.up();
    expect(await changes(page)).toBe('delete');
    await page.keyboard.press('ControlOrMeta+z');
    // It comes back where it was, not where the drag had got to.
    await expect(page.locator('[data-node=far]')).toHaveCount(1);
    expect(await board(page, 'far')).toEqual({ x: 40, y: 300 });
  });

  test('dragging out of the window and letting go lands it', async ({ page }) => {
    await open(page);
    const far = await nodeBox(page, 'far');
    await page.mouse.move(far.x, far.y);
    await page.mouse.down();
    await page.mouse.move(far.x, far.y + 100, { steps: 4 });
    await page.mouse.move(-40, -40, { steps: 4 });
    await page.mouse.up();
    const at = await board(page, 'far');
    expect(at.x).toBeLessThan(40);
    expect(await changes(page)).toBe('move');
    // And the next press starts fresh: nothing's still attached to the pointer.
    await page.mouse.move(500, 300);
    expect(await board(page, 'far')).toEqual(at);
  });

  test('a controlled parent can refuse: it goes back, and there’s nothing to undo', async ({ page }) => {
    await open(page);
    await page.locator('[data-slot=switch], [role=switch]').first().click();
    const was = await board(page, 'far');
    const far = await nodeBox(page, 'far');
    await dragBy(page, far, 70, 30, { release: false });
    // While dragging it shows the drag.
    expect((await board(page, 'far')).x).toBe(was.x + 70);
    await page.mouse.up();
    // It asked, and was told no.
    expect(await changes(page)).toBe('move');
    expect(await board(page, 'far')).toEqual(was);
    await page.keyboard.press('ControlOrMeta+z');
    expect(await changes(page)).toBe('move');
    expect(await board(page, 'far')).toEqual(was);
    // Delete is refused the same way.
    await page.mouse.click(far.x, far.y);
    await page.keyboard.press('Delete');
    expect(await changes(page)).toBe('move delete');
    await expect(page.locator('[data-node=far]')).toHaveCount(1);
    // And when the parent gives in, it works, and only what happened can be undone.
    await page.locator('[data-slot=switch], [role=switch]').first().click();
    const far2 = await nodeBox(page, 'far');
    await dragBy(page, far2, 25, 0);
    expect((await board(page, 'far')).x).toBe(was.x + 25);
    await page.keyboard.press('ControlOrMeta+z');
    expect(await board(page, 'far')).toEqual(was);
  });

  test('left to itself, it keeps its own data, with the same undo', async ({ page }) => {
    await open(page, '&uncontrolled');
    const was = await board(page, 'far');
    await dragBy(page, await nodeBox(page, 'far'), 70, 10);
    expect(await board(page, 'far')).toEqual({ x: was.x + 70, y: was.y + 10 });
    await page.keyboard.press('ControlOrMeta+z');
    expect(await board(page, 'far')).toEqual(was);
    await page.keyboard.press('ControlOrMeta+Shift+z');
    expect(await board(page, 'far')).toEqual({ x: was.x + 70, y: was.y + 10 });
    expect(await changes(page)).toBe('move undo redo');
  });

  test('holding Space in the middle of a drag drops it cleanly', async ({ page }) => {
    await open(page);
    const was = await board(page, 'far');
    await dragBy(page, await nodeBox(page, 'far'), 70, 30, { release: false });
    expect((await board(page, 'far')).x).toBe(was.x + 70);
    await page.keyboard.down('Space');
    expect(await board(page, 'far')).toEqual(was);
    await page.keyboard.up('Space');
    await page.mouse.move(500, 300);
    await page.mouse.up();
    expect(await board(page, 'far')).toEqual(was);
    expect(await changes(page)).toBe('');
  });

  test('a pinch in the middle of a drag drops it cleanly', async ({ browser }) => {
    const context = await browser.newContext({ hasTouch: true, viewport: { width: 1000, height: 720 }, baseURL: test.info().project.use.baseURL });
    const page = await context.newPage();
    await open(page);
    const cdp = await context.newCDPSession(page);
    const was = await board(page, 'far');
    const far = await nodeBox(page, 'far');
    const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
    await touch('touchStart', [{ x: far.x, y: far.y, id: 1 }]);
    await touch('touchMove', [{ x: far.x + 30, y: far.y, id: 1 }]);
    await touch('touchMove', [{ x: far.x + 70, y: far.y, id: 1 }]);
    await expect.poll(async () => (await board(page, 'far')).x).toBe(was.x + 70);
    // A second finger comes down, and it's a pinch.
    await touch('touchStart', [{ x: far.x + 70, y: far.y, id: 1 }, { x: far.x + 200, y: far.y, id: 2 }]);
    await expect.poll(() => board(page, 'far')).toEqual(was);
    await touch('touchMove', [{ x: far.x + 40, y: far.y, id: 1 }, { x: far.x + 220, y: far.y, id: 2 }]);
    await touch('touchEnd', []);
    expect(await board(page, 'far')).toEqual(was);
    expect(await changes(page)).toBe('');
    await context.close();
  });

  test('a camera that’s fitting stops at the first press, so the view holds still under a drag', async ({ page }) => {
    await open(page, '&fit');
    const style = () => page.locator('[data-slot=canvas-board]').getAttribute('style');
    const before = await style();
    // Out past everything else, which grows what there is to fit.
    await dragBy(page, await nodeBox(page, 'far'), 500, 150, { release: false });
    expect((await board(page, 'far')).x).toBeGreaterThan(300);
    expect(await style()).toBe(before);
    await page.mouse.up();
    expect(await style()).toBe(before);
  });
});

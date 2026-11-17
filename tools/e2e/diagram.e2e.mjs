import { readdirSync, readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { openDemo } from './helpers.mjs';

/* Diagram, through its docs demos, with real input. */

/** The camera's zoom, from the transform on the board. */
const realZoom = (page) => page.locator('[data-slot=canvas-board]').evaluate((el) => Number(/scale\(([^)]+)\)/.exec(el.style.transform)[1]));
const zoomOf = realZoom;
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
      const thickness = async (selector) => (await strokeOf(page, selector)) * (await realZoom(page));
      // The lines' zoom moves in steps of about 9%, so they're within about 4.5% of this.
      expect(Math.abs((await thickness('[data-slot=diagram-edge]')) - 1.25)).toBeLessThan(0.07);
      await zoomTo(page, target);
      expect(await realZoom(page)).toBeCloseTo(target, 2);
      expect(Math.abs((await thickness('[data-slot=diagram-edge]')) - 1.25)).toBeLessThan(0.07);
      expect(Math.abs((await thickness('[data-slot=diagram-divider]')) - 1)).toBeLessThan(0.06);
    });
  }

  test('text hides as the board gets too small to read it, and comes back', async ({ page }) => {
    const node = page.locator('[data-node="upload.worker.streaming"] [data-slot=diagram-node-title]');
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
    const z = Number(/scale\(([^)]+)\)/.exec(root.querySelector('[data-slot=canvas-board]').style.transform)[1]);
    const out = [];
    for (const node of root.querySelectorAll('[data-slot=diagram-node]')) {
      if (node.dataset.kind !== 'node') continue;
      const box = node.getBoundingClientRect();
      for (const el of node.querySelectorAll('[data-slot=diagram-node-title], [data-slot=diagram-node-description]')) {
        if (!el.textContent) continue;
        const range = document.createRange();
        range.selectNodeContents(el);
        const r = range.getBoundingClientRect();
        out.push({
          node: node.dataset.node, double: node.dataset.variant === 'double', text: el.textContent, w: box.width / z,
          left: (r.left - box.left) / z, right: (box.right - r.right) / z, top: (r.top - box.top) / z, bottom: (box.bottom - r.bottom) / z,
        });
      }
    }
    return out;
  });
  /** A card's padding is 10 across, and a double border's inner line takes up some of that. Down, its header keeps 6. */
  const clear = (list) => {
    for (const m of list) {
      const across = m.double ? 7 : 9;
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
    // A card's header and body both keep 10 either side, inside a 1 px border.
    return Math.ceil(exact) + 10 * 2 + 2;
  });

  for (const theme of ['light', 'dark']) {
    test(`no text touches a node's edge in the 33-state machine, in ${theme}`, async ({ page }) => {
      await page.goto(`/?demo=diagram/machine&theme=${theme}`, { waitUntil: 'load' });
      await page.locator('[data-slot=diagram-node]').first().waitFor({ timeout: 30_000 });
      await expect.poll(() => nodeWidth(page, 'upload.worker.streaming')).toBeGreaterThan(60);
      const list = await margins(page.locator('[data-slot=diagram]'));
      // 25 states have words: 15 ordinary ones (7 with a second line) and 10 final ones, drawn with a double border.
      expect(list.filter((m) => m.double)).toHaveLength(10);
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
    const fits = await plain.locator('[data-node=nospaces] [data-slot=diagram-node-title]').evaluate((el) => el.scrollHeight <= el.parentElement.clientHeight);
    expect(fits).toBe(true);
  });

  test('measures in the font the diagram is in, from a ThemeScope', async ({ page }) => {
    await openDemo(page, 'diagram/sized-text', '[data-slot=diagram-node]');
    const plain = page.locator('[data-demo=plain] [data-slot=diagram]');
    const serif = page.locator('[data-demo=serif] [data-slot=diagram]');
    await expect.poll(() => nodeWidth(serif, 'detail')).toBeGreaterThan(100);
    const family = (scope) => scope.locator('[data-node=detail] [data-slot=diagram-node-title]').evaluate((el) => getComputedStyle(el).fontFamily);
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
    expect(await nodeWidth(plain, 'short')).toBe(await widthOfWords(plain, 'short', 'diagram-node-title'));
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
    await plain.locator('[data-node=detail] [data-slot=diagram-node-title]').evaluate((el) => document.fonts.load(`12px Late`, el.textContent).catch(() => null) && null);
    await expect.poll(() => page.evaluate(() => document.fonts.status)).toBe('loading');
    expect(await nodeWidth(plain, 'detail')).toBe(before);
    // Measure while it's still loading, so what's remembered for this font is really the fallback's.
    await page.getByRole('button', { name: 'Rename the first node' }).click();
    await expect.poll(() => nodeWidth(plain, 'short')).toBeGreaterThan(100);
    release();
    await expect.poll(() => page.evaluate(() => document.fonts.status), { timeout: 10_000 }).toBe('loaded');
    // What the words measure now, in the font that came. It has to differ, or this shows nothing.
    const fresh = await widthOfWords(plain, 'detail', 'diagram-node-description');
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
    await expect(page.locator('[data-node=a]')).toHaveAttribute('data-selected', '');
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
    await expect(page.locator('[data-slot=diagram-edge][data-edge=bc]')).toHaveAttribute('data-selected', '');
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
        const z = Number(/scale\(([^)]+)\)/.exec(document.querySelector('[data-slot=canvas-board]').style.transform)[1]);
        const s = getComputedStyle(el);
        // However it's drawn, border or inset shadow: its thickness in board units, times the zoom.
        const border = parseFloat(s.borderTopWidth) || 0;
        const shadow = /inset/.test(s.boxShadow) ? parseFloat(s.boxShadow.match(/(-?[\d.]+)px (-?[\d.]+)px (-?[\d.]+)px (-?[\d.]+)px/)[4]) : 0;
        return (border + shadow) * z;
      });
      // Past 100% it's exact. Under 100% it's a border, as it always was, so that no baseline moves, and Chrome floors a border to
      // a whole pixel: 0.5 to 1 px on screen. That's in E8-T41.
      if (target > 1) expect(onScreen).toBeCloseTo(1, 1);
      else { expect(onScreen).toBeGreaterThan(0.45); expect(onScreen).toBeLessThan(1.05); }
      await page.mouse.up();
    }
  });

  test('a selected node’s line is the same thickness at any zoom', async ({ page }) => {
    await open(page);
    const a = await nodeBox(page, 'a');
    await page.mouse.click(a.x, a.y);
    const ring = () => page.locator('[data-slot=diagram-ring][data-ring-of=a]').evaluate((el) => {
      const z = Number(/scale\(([^)]+)\)/.exec(document.querySelector('[data-slot=canvas-board]').style.transform)[1]);
      const spreads = [...getComputedStyle(el).boxShadow.matchAll(/(-?[\d.]+)px (-?[\d.]+)px (-?[\d.]+)px (-?[\d.]+)px/g)].map((m) => parseFloat(m[4]));
      return Math.max(...spreads) * z;
    });
    // Selected is a 1.5 px line on its edge, with no gap (focus is the ring past a gap).
    const near = async () => expect(Math.abs((await ring()) - 1.5)).toBeLessThan(0.2);
    await near();
    await zoomTo(page, 3.5);
    await near();
    await zoomTo(page, 0.3);
    await near();
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

test.describe('the keyboard', () => {
  const open = async (page, query = '') => {
    await page.goto(`/?demo=diagram/editing&theme=light${query}`, { waitUntil: 'load' });
    await page.locator('[data-slot=diagram-node]').first().waitFor({ timeout: 30_000 });
    await page.locator('[data-slot=canvas]').focus();
  };
  /** What has focus, as `node:a`, `edge:ab`, `canvas`, or something outside. */
  const focused = (page) => page.evaluate(() => {
    const el = document.activeElement;
    if (el?.dataset.slot === 'diagram-node') return `node:${el.dataset.node}`;
    if (el?.dataset.slot === 'diagram-edge') return `edge:${el.dataset.edge}`;
    return el?.dataset.slot === 'canvas' ? 'canvas' : `other:${el?.tagName}`;
  });
  const press = async (page, ...keys) => { for (const k of keys) await page.keyboard.press(k); };

  test('the diagram is one tab stop: every node and edge can be reached, and Tab leaves', async ({ page }) => {
    await page.goto('/?demo=diagram/editing&theme=light', { waitUntil: 'load' });
    await page.locator('[data-slot=diagram-node]').first().waitFor({ timeout: 30_000 });
    await page.keyboard.press('Tab');
    await expect.poll(() => focused(page)).toBe('canvas');
    // Nothing on the board is in the tab order: the board is one stop, and the toolbar over it the next.
    const tabbable = await page.locator('[data-slot=canvas] [tabindex="0"]').count();
    expect(tabbable).toBe(0);
    expect(await page.locator('[data-slot=diagram-overlay] [data-slot=toolbar] [tabindex="0"]').count()).toBe(1);
    await press(page, 'Home');
    expect(await focused(page)).toBe('node:a');
    const seen = new Set();
    for (let i = 0; i < 12; i++) { seen.add(await focused(page)); await press(page, 'PageDown'); }
    expect(seen.size).toBe(7 + 5);
    expect(await focused(page)).toBe('node:a');
    // Tab goes on out, so it isn't a trap.
    await press(page, 'Tab');
    expect(await focused(page)).toMatch(/^other:/);
    await page.keyboard.press('Shift+Tab');
    expect(await focused(page)).toBe('canvas');
  });

  test('arrows go between neighbours and along edges, and into and out of what holds things', async ({ page }) => {
    await open(page);
    await press(page, 'Home');
    await press(page, 'ArrowRight');
    expect(await focused(page)).toBe('node:b');
    await press(page, 'ArrowDown');
    expect(await focused(page)).toBe('node:c');
    await press(page, 'ArrowUp');
    expect(await focused(page)).toBe('node:b');
    // From a node onto its edges, along them, and off the other end.
    await press(page, ']');
    expect(await focused(page)).toBe('edge:bc');
    await press(page, ']');
    expect(await focused(page)).toBe('edge:bk');
    await press(page, 'ArrowRight');
    expect(await focused(page)).toBe('node:kid1');
    await press(page, 'Alt+ArrowUp');
    expect(await focused(page)).toBe('node:box');
    await press(page, 'Alt+ArrowDown');
    expect(await focused(page)).toBe('node:kid1');
    await press(page, '[');
    expect(await focused(page)).toBe('edge:bk');
    await press(page, 'ArrowLeft');
    expect(await focused(page)).toBe('node:b');
  });

  test('a disconnected node can be reached, and left', async ({ page }) => {
    await open(page);
    await press(page, 'Home', 'ArrowDown');
    expect(await focused(page)).toBe('node:far');
    await press(page, 'ArrowUp');
    expect(await focused(page)).toBe('node:a');
  });

  test('Enter opens what’s focused, and selects it; Shift+Enter adds to the selection', async ({ page }) => {
    await open(page);
    const selected = () => page.locator('[data-demo-selection]').getAttribute('data-demo-selection');
    await press(page, 'Home', 'Enter');
    await expect(page.locator('[data-demo-activated]')).toHaveAttribute('data-demo-activated', 'a');
    expect(await selected()).toBe('a');
    await expect(page.locator('[data-node=a]')).toHaveAttribute('aria-pressed', 'true');
    await press(page, 'ArrowRight', 'Shift+Enter');
    expect(await selected()).toBe('a b');
    await expect(page.locator('[data-demo-activated]')).toHaveAttribute('data-demo-activated', 'a');
    await press(page, 'Shift+Enter');
    expect(await selected()).toBe('a');
    await press(page, ']', 'Enter');
    await expect(page.locator('[data-demo-activated]')).toHaveAttribute('data-demo-activated', 'bc');
    await expect(page.locator('[data-slot=diagram-edge][data-edge=bc]')).toHaveAttribute('aria-pressed', 'true');
    await press(page, 'Escape');
    expect(await selected()).toBe('');
    // A second Escape goes back up to the canvas.
    await press(page, 'Escape');
    expect(await focused(page)).toBe('canvas');
  });

  test('labels say what it is and what it connects to', async ({ page }) => {
    await open(page);
    await expect(page.locator('[data-node=b]')).toHaveAttribute('aria-label', 'Triage, node. 2 going out: done to Archive, open to Read. 1 coming in: sort from Inbox.');
    await expect(page.locator('[data-node=kid2]')).toHaveAttribute('aria-label', 'Reply, node, in Review. 1 coming in: from Read.');
    await expect(page.locator('[data-node=far]')).toHaveAttribute('aria-label', 'Elsewhere, node. Not connected to anything.');
    await expect(page.locator('[data-slot=diagram-edge][data-edge=ab]')).toHaveAttribute('aria-label', 'sort, edge from Inbox to Triage.');
    await expect(page.locator('[data-slot=diagram-edge][data-edge=loop]')).toHaveAttribute('aria-label', 'again, edge from Archive back to itself.');
    // An accessibility tree sees them by those names.
    await expect(page.getByRole('button', { name: 'sort, edge from Inbox to Triage.' })).toHaveCount(1);
    await expect(page.getByRole('button', { name: /^Inbox, node\./ })).toHaveCount(1);
  });

  test('the view follows the focus', async ({ page }) => {
    await open(page);
    await zoomTo(page, 3);
    await page.locator('[data-slot=canvas]').focus();
    const inView = (id) => page.evaluate((nodeId) => {
      const c = document.querySelector('[data-slot=canvas]').getBoundingClientRect();
      const r = document.querySelector(`[data-node="${nodeId}"]`).getBoundingClientRect();
      return r.left >= c.left && r.right <= c.right && r.top >= c.top && r.bottom <= c.bottom;
    }, id);
    for (const [key, id] of [['Home', 'a'], ['ArrowRight', 'b'], ['ArrowDown', 'c'], ['End', 'far']]) {
      await press(page, key);
      expect(await focused(page)).toBe(`node:${id}`);
      expect(await inView(id), id).toBe(true);
    }
    // ⌘ and an arrow moves the view on its own.
    const before = await page.locator('[data-slot=canvas-board]').getAttribute('style');
    await press(page, 'ControlOrMeta+ArrowLeft');
    expect(await page.locator('[data-slot=canvas-board]').getAttribute('style')).not.toBe(before);
  });

  test('what the keys go to gets a ring, and a press clears it', async ({ page }) => {
    await open(page);
    const ring = page.locator('[data-slot=diagram-ring][data-focused]');
    await expect(ring).toHaveCount(0);
    await press(page, 'Home');
    await expect(ring).toHaveAttribute('data-ring-of', 'a');
    await press(page, 'ArrowRight');
    await expect(ring).toHaveAttribute('data-ring-of', 'b');
    const c = await page.locator('[data-slot=canvas]').boundingBox();
    await page.mouse.click(c.x + c.width - 10, c.y + c.height - 10);
    await expect(ring).toHaveCount(0);
    await press(page, 'ArrowRight');
    await expect(ring).toHaveCount(1);
    await page.keyboard.press('Tab');
    await expect(ring).toHaveCount(0);
  });

  test('shift and an arrow nudges, with undo', async ({ page }) => {
    await open(page);
    const at = () => page.locator('[data-node=far]').evaluate((el) => [parseFloat(el.style.left), parseFloat(el.style.top)]);
    await press(page, 'End');
    expect(await focused(page)).toBe('node:far');
    const was = await at();
    await press(page, 'Shift+ArrowRight', 'Shift+ArrowRight', 'Shift+ArrowDown', 'Shift+Alt+ArrowLeft');
    expect(await at()).toEqual([was[0] + 15, was[1] + 8]);
    expect(await focused(page)).toBe('node:far');
    await press(page, 'ControlOrMeta+z');
    expect(await at()).toEqual([was[0] + 16, was[1] + 8]);
    await expect(page.locator('[data-demo-changes]')).toHaveAttribute('data-demo-changes', 'move move move move undo');
  });

  test('deleting what’s focused leaves focus nearby, and an empty diagram leaves it on the canvas', async ({ page }) => {
    await open(page);
    await press(page, 'Home', 'ArrowRight');
    expect(await focused(page)).toBe('node:b');
    await press(page, 'Delete');
    await expect(page.locator('[data-node=b]')).toHaveCount(0);
    await expect.poll(() => focused(page)).toMatch(/^node:/);
    // And the keys carry on from there.
    const from = await focused(page);
    await press(page, 'PageDown');
    expect(await focused(page)).not.toBe(from);
    // A deleted edge leaves focus on a node too.
    await press(page, 'ControlOrMeta+z');
    await press(page, 'Home', 'ArrowRight', ']');
    expect(await focused(page)).toBe('edge:bc');
    await press(page, 'Delete');
    await expect(page.locator('[data-slot=diagram-edge][data-edge=bc]')).toHaveCount(0);
    await expect.poll(() => focused(page)).toMatch(/^node:/);
    // With nothing left, focus doesn't fall out of the diagram.
    await press(page, 'ControlOrMeta+a', 'Delete');
    await expect(page.locator('[data-slot=diagram-node]')).toHaveCount(0);
    await expect.poll(() => focused(page)).toBe('canvas');
    await press(page, 'ArrowRight', 'Home', 'PageDown', 'Enter');
    expect(await focused(page)).toBe('canvas');
  });

  test('a controlled parent that refuses a delete keeps focus where it was', async ({ page }) => {
    await open(page);
    await page.locator('[data-slot=switch]').click();
    await page.locator('[data-slot=canvas]').focus();
    await press(page, 'Home', 'Delete');
    await expect(page.locator('[data-demo-changes]')).toHaveAttribute('data-demo-changes', 'delete');
    expect(await focused(page)).toBe('node:a');
  });

  test('keys that edit do nothing to a diagram that can’t be edited, even one holding its own data', async ({ page }) => {
    await open(page, '&uncontrolled&readonly');
    await press(page, 'Home', 'Delete', 'Shift+ArrowRight');
    await expect(page.locator('[data-node=a]')).toHaveCount(1);
    expect(await page.locator('[data-node=a]').evaluate((el) => el.style.left)).toBe('40px');
    await expect(page.locator('[data-demo-changes]')).toHaveAttribute('data-demo-changes', '');
  });

  test('a read-only diagram is reached the same way, selects, and changes nothing', async ({ page }) => {
    await page.goto('/?demo=diagram/machine&theme=light', { waitUntil: 'load' });
    await page.locator('[data-slot=diagram-node]').first().waitFor({ timeout: 30_000 });
    await page.locator('[data-slot=canvas]').focus();
    // `upload` is the machine's root, the background: the first thing to reach is its initial marker.
    await press(page, 'Home');
    expect(await focused(page)).toBe('node:upload.__initial');
    await press(page, 'PageDown');
    expect(await focused(page)).toBe('node:upload.worker');
    await press(page, 'Alt+ArrowDown');
    expect(await focused(page)).toMatch(/^node:upload\.worker\./);
    // Read-only means select and read: Enter selects what has focus, and Delete takes nothing away.
    const before = await focused(page);
    const id = before.slice('node:'.length);
    await expect(page.locator(`[data-node="${id}"]`)).toHaveAttribute('aria-pressed', 'false');
    await press(page, 'Enter');
    await expect(page.locator(`[data-node="${id}"]`)).toHaveAttribute('aria-pressed', 'true');
    await press(page, 'Delete', 'ControlOrMeta+a');
    expect(await focused(page)).toBe(before);
    await expect(page.locator('[data-slot=diagram-node]')).toHaveCount(40);
  });
});

test.describe('connecting', () => {
  const open = async (page) => {
    await page.goto('/?demo=diagram/connecting&theme=light', { waitUntil: 'load' });
    await page.locator('[data-slot=diagram-node]').first().waitFor({ timeout: 30_000 });
  };
  const port = async (page, node, name) => {
    const b = await page.locator(`[data-slot=diagram-port][data-port-of="${node}"][data-port="${name}"]`).boundingBox();
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  };
  const center = async (page, id) => {
    const b = await page.locator(`[data-slot=diagram-node][data-node="${id}"]`).boundingBox();
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  };
  const edges = (page) => page.locator('[data-demo-edges]').getAttribute('data-demo-edges');
  const changes = (page) => page.locator('[data-demo-changes]').getAttribute('data-demo-changes');
  const pressAt = async (page, at) => { await page.mouse.move(at.x, at.y); await page.mouse.down(); };
  const moveTo = async (page, at) => { await page.mouse.move(at.x, at.y, { steps: 6 }); };
  const FIRST = 'worker.sql>d1.in';

  test('a drag from a port to a port connects them', async ({ page }) => {
    await open(page);
    await pressAt(page, await port(page, 'worker', 'files'));
    await moveTo(page, await port(page, 'r2', 'in'));
    const preview = page.locator('[data-slot=diagram-connection]');
    await expect(preview).toHaveAttribute('data-valid', 'true');
    await page.mouse.up();
    await expect(preview).toHaveCount(0);
    expect(await edges(page)).toBe(`${FIRST} worker.files>r2.in`);
    expect(await changes(page)).toBe('connect');
    await expect(page.locator('[data-slot=diagram-edge]')).toHaveCount(2);
  });

  test('it snaps to the nearest port in reach, and lets go of it out of reach', async ({ page }) => {
    await open(page);
    const to = await port(page, 'r2', 'in');
    await pressAt(page, await port(page, 'worker', 'files'));
    const target = page.locator('[data-slot=diagram-connection-target]');
    // Way off: nothing's offered.
    await moveTo(page, { x: to.x - 90, y: to.y + 30 });
    await expect(target).toHaveCount(0);
    // Within 24 px on screen: it snaps, and lands if let go.
    await moveTo(page, { x: to.x - 15, y: to.y + 10 });
    await expect(target).toHaveCount(1);
    await page.mouse.up();
    expect(await edges(page)).toBe(`${FIRST} worker.files>r2.in`);
  });

  test('let go over nothing, and nothing happens', async ({ page }) => {
    await open(page);
    const from = await port(page, 'worker', 'files');
    await pressAt(page, from);
    await moveTo(page, { x: from.x + 40, y: from.y + 60 });
    await expect(page.locator('[data-slot=diagram-connection]')).toHaveAttribute('data-valid', 'true');
    await page.mouse.up();
    expect(await edges(page)).toBe(FIRST);
    expect(await changes(page)).toBe('');
    await expect(page.locator('[data-slot=diagram-connection]')).toHaveCount(0);
  });

  test('an invalid target says so while dragging, and refuses on release', async ({ page }) => {
    await open(page);
    await pressAt(page, await port(page, 'worker', 'files'));
    // Files, into something that takes SQL.
    await moveTo(page, await port(page, 'd1', 'in'));
    await expect(page.locator('[data-slot=diagram-connection]')).toHaveAttribute('data-valid', 'false');
    await expect(page.locator('[data-slot=diagram-connection-target]')).toHaveAttribute('data-valid', 'false');
    await expect(page.locator('[data-slot=diagram-status]')).toHaveText('Can’t connect: BUCKET carries files, and queries takes sql.');
    await expect(page.locator('[data-slot=diagram-status]')).toBeVisible();
    await page.mouse.up();
    expect(await edges(page)).toBe(FIRST);
    expect(await changes(page)).toBe('');
    await expect(page.locator('[data-slot=diagram-status]')).toHaveText('');
    // And nothing can start from a port that only takes things in, in that it's refused wherever it goes.
    await pressAt(page, await port(page, 'd1', 'in'));
    await moveTo(page, await port(page, 'r2', 'in'));
    await expect(page.locator('[data-slot=diagram-connection]')).toHaveAttribute('data-valid', 'false');
    await page.mouse.up();
    expect(await edges(page)).toBe(FIRST);
  });

  test('connecting what’s connected already is refused', async ({ page }) => {
    await open(page);
    await pressAt(page, await port(page, 'worker', 'sql'));
    await moveTo(page, await port(page, 'd1', 'in'));
    await expect(page.locator('[data-slot=diagram-status]')).toHaveText('Can’t connect: Those are already connected.');
    await page.mouse.up();
    expect(await edges(page)).toBe(FIRST);
  });

  test('a port under another node can be reached', async ({ page }) => {
    await open(page);
    await pressAt(page, await port(page, 'worker', 'files'));
    await moveTo(page, await port(page, 'covered', 'in'));
    await page.mouse.up();
    expect(await edges(page)).toBe(`${FIRST} worker.files>covered.in`);
  });

  test('a node with no ports gets one on each side once selected, and can connect to itself', async ({ page }) => {
    await open(page);
    await expect(page.locator('[data-slot=diagram-port][data-port-of=plain]')).toHaveCount(0);
    const plain = await center(page, 'plain');
    await page.mouse.click(plain.x, plain.y);
    await expect(page.locator('[data-slot=diagram-port][data-port-of=plain]')).toHaveCount(4);
    const right = await page.locator('[data-slot=diagram-port][data-port-of=plain][data-side=right]').boundingBox();
    await pressAt(page, { x: right.x + right.width / 2, y: right.y + right.height / 2 });
    await moveTo(page, await center(page, 'other'));
    await page.mouse.up();
    expect(await edges(page)).toBe(`${FIRST} plain>other`);
    // To itself: a self-loop, with an arrowhead pointing back in.
    await page.mouse.click(plain.x, plain.y);
    const top = await page.locator('[data-slot=diagram-port][data-port-of=plain][data-side=top]').boundingBox();
    await pressAt(page, { x: top.x + top.width / 2, y: top.y + top.height / 2 });
    await moveTo(page, { x: plain.x + 10, y: plain.y + 5 });
    await page.mouse.up();
    expect(await edges(page)).toBe(`${FIRST} plain>other plain>plain`);
    await expect(page.locator('[data-slot=diagram-edge]')).toHaveCount(3);
  });

  test('a port can’t connect to itself', async ({ page }) => {
    await open(page);
    const p = await port(page, 'worker', 'files');
    await pressAt(page, p);
    await moveTo(page, { x: p.x + 40, y: p.y });
    await moveTo(page, p);
    await expect(page.locator('[data-slot=diagram-status]')).toHaveText('Can’t connect: A port can’t connect to itself.');
    await page.mouse.up();
    expect(await edges(page)).toBe(FIRST);
  });

  test('an edge’s end can be moved to another port, with undo, and an invalid one is refused', async ({ page }) => {
    await open(page);
    // Add one going to R2, then select it by its line.
    await pressAt(page, await port(page, 'worker', 'files'));
    await moveTo(page, await port(page, 'r2', 'in'));
    await page.mouse.up();
    const line = await page.locator('[data-slot=diagram-edge]').nth(1).evaluate((el) => {
      const r = el.getBoundingClientRect();
      const p = el.getPointAtLength(el.getTotalLength() / 2);
      const m = el.getScreenCTM();
      return { x: p.x * m.a + m.e, y: p.y * m.d + m.f, r: r.width };
    });
    await page.mouse.click(line.x, line.y);
    await expect(page.locator('[data-slot=diagram-edge-end]')).toHaveCount(2);
    const end = await page.locator('[data-slot=diagram-edge-end][data-end=to]').boundingBox();
    // Onto something that only takes SQL: no.
    await pressAt(page, { x: end.x + end.width / 2, y: end.y + end.height / 2 });
    await moveTo(page, await port(page, 'd1', 'in'));
    await expect(page.locator('[data-slot=diagram-connection]')).toHaveAttribute('data-valid', 'false');
    await page.mouse.up();
    expect(await edges(page)).toBe(`${FIRST} worker.files>r2.in`);
    // Onto a node: yes.
    const end2 = await page.locator('[data-slot=diagram-edge-end][data-end=to]').boundingBox();
    await pressAt(page, { x: end2.x + end2.width / 2, y: end2.y + end2.height / 2 });
    await moveTo(page, await center(page, 'other'));
    await page.mouse.up();
    expect(await edges(page)).toBe(`${FIRST} worker.files>other`);
    expect(await changes(page)).toBe('connect reconnect');
    await page.keyboard.press('ControlOrMeta+z');
    expect(await edges(page)).toBe(`${FIRST} worker.files>r2.in`);
    // Its start moves too.
    const again = await page.locator('[data-slot=diagram-edge-end][data-end=from]').boundingBox();
    await pressAt(page, { x: again.x + again.width / 2, y: again.y + again.height / 2 });
    await moveTo(page, await center(page, 'plain'));
    await page.mouse.up();
    expect(await edges(page)).toBe(`${FIRST} plain>r2.in`);
  });

  test('connecting by keyboard', async ({ page }) => {
    await open(page);
    const status = page.locator('[data-slot=diagram-status]');
    await page.locator('[data-slot=canvas]').focus();
    await page.keyboard.press('Home');
    await page.keyboard.press('c');
    await expect(status).toContainText('Connecting from Worker');
    // Enter with nothing chosen says so.
    await page.keyboard.press('Enter');
    await expect(status).toHaveText('Choose what to connect to first.');
    // The next port out, and across to D1: SQL's taken, and files don't go there.
    await page.keyboard.press('p');
    await expect(status).toHaveText('From files.');
    await page.keyboard.press('ArrowRight');
    await expect(status).toContainText('To ');
    await page.keyboard.press('p');
    await expect(page.locator('[data-slot=diagram-connection]')).toHaveCount(1);
    // Down to R2, whose only port takes files.
    const name = await status.textContent();
    if (name.includes('D1')) {
      await expect(status).toContainText('Can’t connect');
      await page.keyboard.press('Enter');
      expect(await edges(page)).toBe(FIRST);
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('p');
    }
    await expect(status).toContainText('To R2, in. Enter connects.');
    await page.keyboard.press('Enter');
    expect(await edges(page)).toBe(`${FIRST} worker.files>r2.in`);
    await expect(status).toContainText('Connected Worker to R2');
    await expect(page.locator('[data-slot=diagram-connection]')).toHaveCount(0);
    // Escape cancels, and focus stays.
    await page.keyboard.press('c');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('Escape');
    expect(await edges(page)).toBe(`${FIRST} worker.files>r2.in`);
    await expect(page.locator('[data-slot=diagram-connection]')).toHaveCount(0);
  });

  test('moving an edge’s end by keyboard', async ({ page }) => {
    await open(page);
    await page.locator('[data-slot=canvas]').focus();
    await page.keyboard.press('Home');
    await page.keyboard.press(']');
    await expect.poll(() => page.evaluate(() => document.activeElement?.dataset.edge)).toBe('first');
    await page.keyboard.press('c');
    await expect(page.locator('[data-slot=diagram-status]')).toContainText('Moving this edge’s end');
    // From the edge, across to whatever's that way, and in.
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await expect.poll(() => edges(page)).not.toBe(FIRST);
    expect(await changes(page)).toBe('reconnect');
  });

  test('it works zoomed right out, where every port’s under the pointer', async ({ page }) => {
    await open(page);
    await zoomTo(page, 0.02);
    await pressAt(page, await port(page, 'worker', 'files'));
    await moveTo(page, await port(page, 'r2', 'in'));
    await page.mouse.up();
    // At 0.02 the two are a few px apart: it lands on the nearest port, and that it doesn't throw or go elsewhere is the point.
    expect((await edges(page)).split(' ').length).toBeLessThanOrEqual(2);
    expect(await edges(page)).toContain(FIRST);
    await expect(page.locator('[data-slot=diagram-connection]')).toHaveCount(0);
    // That far out, a port's dot shrinks with the board rather than crowding its node (a phone's fitted view of a big system).
    expect(await page.locator('[data-slot=diagram-port]').first().evaluate((el) => el.getBoundingClientRect().width)).toBeLessThan(1);
    // At 100% it's its full 10 px on screen.
    await zoomTo(page, 1);
    expect(await page.locator('[data-slot=diagram-port]').first().evaluate((el) => el.getBoundingClientRect().width)).toBeCloseTo(10, 0);
  });

  test('it works at a phone-size window', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 720 }, baseURL: test.info().project.use.baseURL });
    const page = await context.newPage();
    await open(page);
    await pressAt(page, await port(page, 'worker', 'files'));
    await moveTo(page, await port(page, 'r2', 'in'));
    await page.mouse.up();
    expect(await edges(page)).toBe(`${FIRST} worker.files>r2.in`);
    // What it says when it's refused fits on the screen.
    await pressAt(page, await port(page, 'worker', 'files'));
    await moveTo(page, await port(page, 'd1', 'in'));
    const box = await page.locator('[data-slot=diagram-status]').boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
    await page.mouse.up();
    await context.close();
  });

  test('Space drops a connection in progress', async ({ page }) => {
    await open(page);
    await pressAt(page, await port(page, 'worker', 'files'));
    await moveTo(page, await port(page, 'r2', 'in'));
    await page.keyboard.down('Space');
    await expect(page.locator('[data-slot=diagram-connection]')).toHaveCount(0);
    await page.keyboard.up('Space');
    await page.mouse.up();
    expect(await edges(page)).toBe(FIRST);
  });

  test('moving a node takes its ports and edges with it', async ({ page }) => {
    await open(page);
    const p0 = await port(page, 'd1', 'in');
    const c = await center(page, 'd1');
    const line0 = await page.locator('[data-slot=diagram-edge][data-edge=first]').getAttribute('d');
    await page.mouse.move(c.x, c.y);
    await page.mouse.down();
    await page.mouse.move(c.x + 70, c.y - 25, { steps: 6 });
    await page.mouse.up();
    const p1 = await port(page, 'd1', 'in');
    expect(p1.x).toBeGreaterThan(p0.x + 40);
    expect(await page.locator('[data-slot=diagram-edge][data-edge=first]').getAttribute('d')).not.toBe(line0);
  });
});

test.describe('large', () => {
  test.setTimeout(240_000);
  const open = async (page, n, query = '') => {
    await page.goto(`/?demo=diagram/large&theme=light&n=${n}${query}`, { waitUntil: 'load' });
    await page.locator('[data-demo-status=ready]').waitFor({ timeout: 200_000 });
    await page.locator('[data-slot=diagram-node]').first().waitFor({ timeout: 60_000 });
  };
  /** Every node that should be on screen right now, by the data, and whether it's in the DOM. */
  const onScreen = (page) => page.evaluate(() => {
    const canvas = document.querySelector('[data-slot=canvas]').getBoundingClientRect();
    const c = window.__diagramLarge.viewport();
    const view = { x: -c.x / c.zoom, y: -c.y / c.zoom, w: canvas.width / c.zoom, h: canvas.height / c.zoom };
    const hit = (n) => n.x < view.x + view.w && n.x + n.w > view.x && n.y < view.y + view.h && n.y + n.h > view.y;
    const should = window.__diagramLarge.nodes().filter(hit).map((n) => n.id);
    const drawn = new Set([...document.querySelectorAll('[data-slot=diagram-node]')].map((el) => el.dataset.node));
    return { should: should.length, missing: should.filter((id) => !drawn.has(id)), drawn: drawn.size, total: window.__diagramLarge.nodes().length };
  });
  const jump = (page, x, y, z = 1) => page.evaluate(({ x, y, z }) => {
    const b = window.__diagramLarge.bounds();
    window.__diagramLarge.setViewport({ zoom: z, x: -(b.x + b.w * x) * z, y: -(b.y + b.h * y) * z });
    return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }, { x, y, z });

  /** Puts a leaf in the middle of the view: the graph has gaps, so a place on the board might have nothing there. */
  const toNode = (page) => page.evaluate(() => {
    const nodes = window.__diagramLarge.nodes().filter((n) => !n.kind);
    const n = nodes[nodes.length >> 1];
    const c = document.querySelector('[data-slot=canvas]').getBoundingClientRect();
    window.__diagramLarge.setViewport({ zoom: 1, x: c.width / 2 - n.x, y: c.height / 2 - n.y });
    return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });

  test('panning fast past what’s drawn: it’s there by the next frame, every time', async ({ page }) => {
    await open(page, 500);
    await jump(page, 0.2, 0.2);
    const first = await onScreen(page);
    expect(first.drawn).toBeLessThan(first.total / 2);
    // Across the whole board, in big jumps, with no time for anything to catch up.
    for (const [x, y] of [[0.9, 0.1], [0.1, 0.9], [0.8, 0.8], [0.05, 0.05], [0.5, 0.5], [0.95, 0.5], [0.3, 0.7]]) {
      await jump(page, x, y);
      const now = await onScreen(page);
      expect(now.missing, `at ${x}, ${y}`).toEqual([]);
    }
  });

  test('a real scroll a long way keeps up too', async ({ page }) => {
    await open(page, 500);
    await jump(page, 0.2, 0.2);
    const c = await page.locator('[data-slot=canvas]').boundingBox();
    await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2);
    for (let i = 0; i < 12; i++) {
      await page.mouse.wheel(900, 300);
      const now = await onScreen(page);
      expect(now.missing).toEqual([]);
    }
  });

  test('select all with most of it out of view stays quick, and draws no more than it did', async ({ page }) => {
    await open(page, 2000, '&editable');
    await toNode(page);
    const before = await page.locator('[data-slot=diagram-node]').count();
    expect(before).toBeGreaterThan(0);
    expect(before).toBeLessThan(400);
    await page.locator('[data-slot=canvas]').focus();
    const ms = await page.evaluate(async () => {
      const t0 = performance.now();
      document.querySelector('[data-slot=canvas]').dispatchEvent(new KeyboardEvent('keydown', { key: 'a', metaKey: true, ctrlKey: true, bubbles: true }));
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      return performance.now() - t0;
    });
    console.log(`select all of 2,000, drawing ${before}: ${Math.round(ms)} ms to the next frames`);
    expect(await page.locator('[data-slot=diagram-node]').count()).toBe(before);
    await expect(page.locator('[data-slot=diagram-node][data-selected]').first()).toBeVisible();
    expect(ms).toBeLessThan(1000);
    // And it's all selected, in or out of view: deleting takes the lot, and undo brings it back.
    await page.keyboard.press('Delete');
    await expect(page.locator('[data-slot=diagram-node]')).toHaveCount(0);
    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(() => page.locator('[data-slot=diagram-node]').count()).toBeGreaterThan(0);
  });

  test('what’s focused stays drawn, wherever it’s gone', async ({ page }) => {
    await open(page, 500, '&editable');
    await jump(page, 0.2, 0.2);
    await page.locator('[data-slot=canvas]').focus();
    // Over to the far end, which isn't drawn until focus gets there.
    await page.keyboard.press('End');
    const id = await page.evaluate(() => document.activeElement?.dataset.node);
    const last = await page.evaluate(() => window.__diagramLarge.nodes().at(-1).id);
    expect(id).toBe(last);
    // Pan well away, and it's still in the DOM, with focus.
    for (let i = 0; i < 40; i++) await page.keyboard.press('ControlOrMeta+ArrowLeft');
    expect(await page.evaluate(() => document.activeElement?.dataset.node)).toBe(last);
    const away = await onScreen(page);
    expect(away.drawn).toBeLessThan(away.total);
    // And every step through the graph lands on something that's there.
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('PageUp');
      expect(await page.evaluate(() => document.activeElement?.dataset.slot)).toMatch(/diagram-(node|edge)/);
    }
  });

  test('a minimap with 2,000 marks draws them all, and still moves the view', async ({ page }) => {
    await open(page, 2000, '&minimap');
    await toNode(page);
    const marks = await page.locator('[data-slot=canvas-minimap] rect').count();
    expect(marks).toBeGreaterThan(1900);
    const map = await page.locator('[data-slot=canvas-minimap]').boundingBox();
    const before = await page.locator('[data-slot=canvas-board]').getAttribute('style');
    await page.mouse.click(map.x + 30, map.y + 30);
    await expect.poll(() => page.locator('[data-slot=canvas-board]').getAttribute('style')).not.toBe(before);
    expect((await onScreen(page)).missing).toEqual([]);
  });
});

test.describe('in a tab that starts hidden', () => {
  test('it measures, lays out and fits when it’s shown', async ({ page }) => {
    await page.goto('/?demo=diagram/hidden&theme=light', { waitUntil: 'load' });
    await page.getByRole('button', { name: 'Show the tab' }).waitFor({ timeout: 30_000 });
    await page.waitForTimeout(800);
    await page.getByRole('button', { name: 'Show the tab' }).click();
    const sized = page.locator('[data-demo=sized]'), laid = page.locator('[data-demo=laid]');
    const width = (scope, id) => scope.locator(`[data-node="${id}"]`).evaluate((el) => parseFloat(el.style.width));
    const natural = (scope, id) => scope.locator(`[data-node="${id}"] [data-slot=diagram-node-title]`).evaluate((el) => {
      const probe = el.cloneNode(true);
      probe.style.cssText = 'position:absolute;width:max-content;max-width:none;visibility:hidden';
      el.parentElement.append(probe);
      const w = parseFloat(getComputedStyle(probe).width);
      probe.remove();
      return Math.ceil(w) + 22;
    });
    // Measured, with the size of the words, and not left at what it got while hidden.
    await expect.poll(async () => (await width(sized, 'one')) === (await natural(sized, 'one'))).toBe(true);
    await expect.poll(async () => laid.locator('[data-node=one]').count()).toBe(1);
    await expect.poll(async () => (await width(laid, 'one')) === (await natural(laid, 'one'))).toBe(true);
    // Fitted to the size it turned out to be: both nodes are inside the canvas.
    for (const scope of [sized, laid]) {
      const inside = await scope.evaluate((root) => {
        const c = root.querySelector('[data-slot=canvas]').getBoundingClientRect();
        return [...root.querySelectorAll('[data-slot=diagram-node]')].every((el) => {
          const r = el.getBoundingClientRect();
          return r.left >= c.left && r.right <= c.right && r.top >= c.top && r.bottom <= c.bottom;
        });
      });
      expect(inside).toBe(true);
    }
    // And it doesn't lose anything when it's hidden and shown again.
    await page.getByRole('button', { name: 'Hide the tab' }).click();
    await page.getByRole('button', { name: 'Show the tab' }).click();
    await expect.poll(async () => (await width(sized, 'one')) === (await natural(sized, 'one'))).toBe(true);
  });
});

test.describe('StateDiagram', () => {
  test('draws all of the spike’s machine, in a worker, with nothing touching its nodes’ edges', async ({ page }) => {
    await page.goto('/?demo=state-diagram/machine&theme=light', { waitUntil: 'load' });
    await expect.poll(() => page.locator('[data-slot=diagram-node]').count(), { timeout: 30_000 }).toBe(33);
    await expect(page.locator('[data-slot=diagram-edge]')).toHaveCount(36);
    await expect(page.locator('[data-slot=diagram-edge-label]')).toHaveCount(36);
    await expect(page.locator('[data-slot=diagram-divider]')).toHaveCount(2);
    // The statechart look, on Diagram's generic looks: where a state starts is its entry marker.
    await expect(page.locator('[data-node="upload.worker.authenticating"] [data-slot=diagram-entry]')).toHaveCount(1);
    await expect(page.locator('[data-slot=diagram-entry]')).toHaveCount(7);
    await expect(page.locator('[data-node="upload.done"] [data-slot=diagram-node-icon]')).toHaveCount(1);
    await expect(page.locator('[data-node="upload.done"]')).toHaveAttribute('data-variant', 'double');
    await expect(page.locator('[data-node="upload.processing"]')).toHaveAttribute('data-kind', 'group');
    await expect(page.locator('[data-node="upload.processing"]')).toHaveAttribute('data-variant', 'dashed');
    await expect(page.locator('[data-node="upload.done"]')).toHaveAttribute('aria-label', /^done, final state/);
    // In a machine's words, with what it connects to.
    await expect(page.locator('[data-node="upload.worker.streaming"]')).toHaveAttribute('aria-label', /^streaming, state, in worker\./);
    // A label is the event, and under it its guard and actions as chips; a state's card has what it invokes.
    for (const [title, chip] of [['always', 'if withinQuota'], ['after IDLE_TIMEOUT', null], ['after BACKOFF', 'if retriesLeft'], ['always', 'if isClean'], ['after BACKOFF', 'bumpRetry']]) {
      const label = page.locator('[data-slot=diagram-edge-label]', { has: page.locator('[data-slot=diagram-edge-label-title]', { hasText: title }) });
      await expect(chip ? label.filter({ has: page.locator('[data-slot=diagram-item]', { hasText: chip }) }).first() : label.first()).toHaveCount(1);
    }
    await expect(page.locator('[data-node="upload.worker.authenticating"] [data-slot=diagram-item]', { hasText: 'verifyToken' })).toHaveCount(1);
  });

  test('draws the Audio Player as XState’s visualizer does: context, entry actions as chips, pills and cards, loops', async ({ page }) => {
    await page.goto('/?demo=state-diagram/audio-player&simulate=0&theme=light', { waitUntil: 'load' });
    await expect.poll(() => page.locator('[data-slot=diagram-node]').count(), { timeout: 30_000 }).toBe(7);
    const root = page.locator('[data-node="Audio Player"]');
    await expect(root.locator('[data-slot=diagram-node-title]').first()).toHaveText('Audio Player');
    await expect(root.locator('[data-slot=diagram-section-title]').first()).toHaveText('Context');
    for (const key of ['audioRef', 'currentTime', 'trackSource', 'audioContext']) await expect(root.locator('[data-slot=diagram-item]', { hasText: key })).toHaveCount(1);
    await expect(page.locator('[data-node="Audio Player.Active.Paused"] [data-slot=diagram-item]')).toHaveText(/onPause/);
    await expect(page.locator('[data-node="Audio Player.Active.Paused"] [data-slot=diagram-entry]')).toHaveCount(1);
    await expect(page.locator('[data-node="Audio Player.Error"] [data-slot=diagram-node-icon]')).toHaveCount(1);
    // An event alone is a pill; one with actions a card.
    const label = (title) => page.locator('[data-slot=diagram-edge-label]', { has: page.locator('[data-slot=diagram-edge-label-title]', { hasText: new RegExp(`^${title}$`) }) });
    for (const pill of ['loaded', 'play', 'pause', 'end']) await expect(label(pill)).toHaveAttribute('data-shape', 'pill');
    for (const card of ['loading', 'init-error', 'error', 'time']) await expect(label(card)).toHaveAttribute('data-shape', 'card');
    await expect(label('restart')).toHaveCount(2);
    // Playing's own: restart and time leave it and come back to it.
    for (const id of ['Audio Player.Active.Playing:restart->Audio Player.Active.Playing', 'Audio Player.Active.Playing:time->Audio Player.Active.Playing']) {
      await expect(page.locator(`[data-slot=diagram-edge][data-edge="${id}"]`)).toHaveCount(1);
    }
  });

  test('sends from the board: what it can take now is a label to press, and the context is shown as it runs', async ({ page }) => {
    await page.goto('/?demo=state-diagram/audio-player&theme=light', { waitUntil: 'load' });
    const label = (event) => page.locator('[data-slot=diagram-edge-label]').filter({ has: page.locator('[data-slot=diagram-edge-label-title]', { hasText: new RegExp(`^${event}$`) }) });
    const send = (event) => label(event).and(page.locator('[data-pressable]'));
    await expect(send('loading')).toBeVisible({ timeout: 30_000 });
    await expect(send('init-error')).toBeVisible();
    await expect(send('loaded')).toHaveCount(0);
    // Not by color alone: a play badge on its corner, and its edge says so to a screen reader.
    await expect(send('loading').locator('[data-part=press]')).toHaveCount(1);
    await expect(page.locator('[data-slot=diagram-edge][data-edge="Audio Player.Init:loading->Audio Player.Loading"]')).toHaveAttribute('aria-label', /It can be sent now/);
    await send('loading').click();
    await expect(send('loaded')).toBeVisible();
    await expect(send('loading')).toHaveCount(0);
    await expect(page.locator('[data-node="Audio Player.Loading"]')).toHaveAttribute('aria-current', 'true');
    await send('loaded').click();
    await expect(page.locator('[data-node="Audio Player.Active.Paused"]')).toHaveAttribute('aria-current', 'true');
    // Where the label is is the core's: pressing it where it's drawn sends, wherever the board's been moved to.
    await send('play').scrollIntoViewIfNeeded();
    await send('play').click();
    await expect(page.locator('[data-node="Audio Player.Active.Playing"]')).toHaveAttribute('aria-current', 'true');
    // The panel has the context, as it is.
    await page.locator('[data-diagram-frame-trigger]').click();
    await expect(page.locator('[data-slot=simulation-context] [data-key=currentTime] dd')).toHaveText('0');
  });

  test('a config works, and one XState won’t have shows what it said, not a blank', async ({ page }) => {
    await page.goto('/?demo=state-diagram/config&theme=light', { waitUntil: 'load' });
    await expect.poll(() => page.locator('[data-slot=diagram-node]').count(), { timeout: 30_000 }).toBeGreaterThan(3);
    await expect(page.locator('[data-slot=diagram-error]')).toHaveCount(0);
    await page.getByRole('button', { name: 'One XState won’t have' }).click();
    const error = page.locator('[data-slot=diagram-error]');
    await expect(error).toBeVisible();
    await expect(error).toContainText('nowhere');
    await expect(error).toHaveAttribute('role', 'alert');
    await expect(page.locator('[data-slot=diagram-node]')).toHaveCount(0);
    // And it recovers.
    await page.getByRole('button', { name: 'A good one' }).click();
    await expect(error).toHaveCount(0);
    await expect.poll(() => page.locator('[data-slot=diagram-node]').count()).toBeGreaterThan(3);
  });
});

test.describe('StateDiagram simulates', () => {
  const lit = (page) => page.locator('[data-slot=diagram-current]').evaluateAll((els) => els.map((el) => el.getAttribute('data-current-of')).sort());
  const offered = (page) => page.locator('[data-action=send]').evaluateAll((els) => els.map((el) => el.getAttribute('data-event')).sort());
  const event = (page, name) => page.locator(`[data-action=send][data-event="${name}"]`);
  const finish = (page, name) => page.locator('[data-action=finish]').filter({ hasText: name });
  const log = (page) => page.locator('[data-slot=simulation-log-entry] .font-semibold').allTextContents();
  const now = (page) => page.locator('[data-slot=simulation-now]');
  const awkward = async (page, name) => {
    await page.goto('/?demo=state-diagram/simulate-awkward&theme=light', { waitUntil: 'load' });
    await page.getByRole('radio', { name }).click();
    await expect(page.locator('[data-slot=simulation-panel]')).toBeVisible({ timeout: 30_000 });
  };

  test('runs the spike’s whole machine with the buttons, lit at each step, with parallel regions lit together', async ({ page }) => {
    await page.goto('/?demo=state-diagram/simulate&theme=light', { waitUntil: 'load' });
    await expect(page.locator('[data-slot=simulation-panel]')).toBeVisible({ timeout: 30_000 });
    await expect.poll(() => page.locator('[data-slot=diagram-node]').count(), { timeout: 30_000 }).toBe(33);
    await expect(now(page)).toHaveText('authenticating');
    expect(await lit(page)).toEqual(['upload.worker', 'upload.worker.authenticating']);
    // What's lit says so to a screen reader too, and what isn't doesn't.
    await expect(page.locator('[aria-current=true]')).toHaveCount(2);
    await expect(page.locator('[data-node="upload.worker.authenticating"]')).toHaveAttribute('aria-current', 'true');
    await expect(page.locator('[data-node="upload.worker.streaming"]')).not.toHaveAttribute('aria-current', 'true');
    // Through checkingQuota's always, on its own, with both edges lit.
    await finish(page, 'verifyToken: done').click();
    await expect(now(page)).toHaveText('streaming');
    await expect(page.locator('[data-slot=diagram-edge][data-current]')).toHaveCount(2);
    await expect(page.locator('[data-edge="upload.worker.checkingQuota:always->upload.worker.streaming"][data-slot=diagram-edge]')).toHaveAttribute('data-current', '');
    expect(await offered(page)).toEqual(['CANCEL', 'CHUNK', 'EOF', 'HEARTBEAT'].sort());
    await event(page, 'CHUNK').click();
    await expect(page.locator('[data-slot=diagram-edge][data-current]')).toHaveCount(1);
    await event(page, 'EOF').click();
    await expect(now(page)).toHaveText('committing');
    await finish(page, 'putObject: done').click();
    await expect(now(page)).toHaveText('waiting');
    await event(page, 'R2_EVENT').click();
    await finish(page, 'pullMessage: done').click();
    await expect(now(page)).toHaveText('scanning, resizing, inserting');
    expect(await lit(page)).toEqual([
      'upload.processing', 'upload.processing.metadata', 'upload.processing.metadata.inserting', 'upload.processing.scan', 'upload.processing.scan.scanning', 'upload.processing.thumbnails', 'upload.processing.thumbnails.resizing',
    ].sort());
    // Each lit where its node is.
    for (const id of ['upload.processing.scan.scanning', 'upload.processing.metadata']) {
      const [a, b] = await Promise.all([page.locator(`[data-current-of="${id}"]`).boundingBox(), page.locator(`[data-node="${id}"]`).boundingBox()]);
      expect(a).toEqual(b);
    }
    await finish(page, 'scanObject: done').click();
    await finish(page, 'makeThumbnails: done').click();
    await finish(page, 'insertRow: done').click();
    await expect(now(page)).toHaveText('broadcasting');
    await finish(page, 'broadcast: done').click();
    await expect(now(page)).toHaveText('done (finished)');
    expect(await offered(page)).toEqual([]);
    await expect(page.locator('[data-action=finish]')).toHaveCount(0);
    expect(await log(page)).toEqual(['Started', 'verifyToken: done', 'CHUNK', 'EOF', 'putObject: done', 'R2_EVENT', 'pullMessage: done', 'scanObject: done', 'makeThumbnails: done', 'insertRow: done', 'broadcast: done']);
    // In order for a screen reader, with the newest at the top to look at.
    const entries = page.locator('[data-slot=simulation-log-entry]');
    expect((await entries.last().boundingBox()).y).toBeLessThan((await entries.first().boundingBox()).y);
    // Reset starts over, with nothing left of the run.
    await page.locator('[data-action=reset]').click();
    await expect(now(page)).toHaveText('authenticating');
    expect(await log(page)).toEqual(['Started']);
    await expect(page.locator('[data-slot=diagram-edge][data-current]')).toHaveCount(0);
  });

  test('only offers what it can take, as its guards answer', async ({ page }) => {
    await page.goto('/?demo=state-diagram/simulate&theme=light', { waitUntil: 'load' });
    await expect(page.locator('[data-slot=simulation-panel]')).toBeVisible({ timeout: 30_000 });
    expect(await offered(page)).toEqual(['CANCEL']);
    // withinQuota says no, so the always goes the other way, to rejected.
    await page.locator('[data-guard=withinQuota] [data-slot=switch]').click();
    await finish(page, 'verifyToken: done').click();
    await expect(now(page)).toHaveText('rejected (finished)');
    await expect(page.locator('[data-current-of="upload.rejected"]')).toHaveCount(1);
    // The answer lasts through a Reset, to try the other way again.
    await page.locator('[data-action=reset]').click();
    await expect(page.getByRole('switch', { name: 'withinQuota answers yes' })).not.toBeChecked();
  });

  test('steps through timers, and runs them', async ({ page }) => {
    await page.goto('/?demo=state-diagram/simulate&theme=light', { waitUntil: 'load' });
    await expect(page.locator('[data-slot=simulation-panel]')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('[data-action=next-timer]')).toBeDisabled();
    await finish(page, 'verifyToken: done').click();
    const time = page.locator('[data-slot=simulation-time]');
    await expect(time).toHaveText('0 ms, next at 30,000 ms');
    // Nothing moves on its own.
    await page.waitForTimeout(250);
    await expect(time).toHaveText('0 ms, next at 30,000 ms');
    await expect(now(page)).toHaveText('streaming');
    await page.locator('[data-action=next-timer]').click();
    await expect(now(page)).toHaveText('rejected (finished)');
    await expect(time).toHaveText('30,000 ms, nothing waiting');
    expect((await log(page)).at(-1)).toBe('after IDLE_TIMEOUT');
    await expect(page.locator('[data-slot=simulation-log-entry]').last()).toContainText('at 30,000 ms, in rejected');

    // Running: time goes by as it does, until it's paused.
    await page.locator('[data-action=reset]').click();
    await finish(page, 'verifyToken: done').click();
    await page.locator('[data-action=run]').click();
    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
    await expect.poll(async () => parseInt((await time.textContent()).replace(',', ''), 10), { timeout: 5_000 }).toBeGreaterThan(150);
    await page.getByRole('button', { name: 'Pause' }).click();
    await expect(page.getByRole('button', { name: 'Run' })).toBeVisible();
    const paused = await time.textContent();
    await page.waitForTimeout(300);
    await expect(time).toHaveText(paused);

    await awkward(page, 'One with a short timer');
    await expect(now(page)).toHaveText('green');
    await page.locator('[data-action=run]').click();
    await expect(now(page)).toHaveText('red', { timeout: 5_000 });
    // Each at the time it was due, however often the page got to look.
    await expect(page.locator('[data-slot=simulation-log-entry]')).toHaveText(['Started at 0 ms, in green', 'after 400 ms at 400 ms, in amber', 'after 400 ms at 800 ms, in red']);
    // With nothing left to wait for, it stops on its own.
    await expect(page.locator('[data-action=run]')).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Run' })).toBeVisible();
    const after = await page.locator('[data-slot=simulation-time]').textContent();
    await page.waitForTimeout(250);
    await expect(page.locator('[data-slot=simulation-time]')).toHaveText(after);
    // And pausing means it.
    await event(page, 'RESET').click();
    await expect(now(page)).toHaveText('green');
    await page.locator('[data-action=run]').click();
    await page.locator('[data-action=run]').click();
    await expect(page.getByRole('button', { name: 'Run' })).toBeVisible();
    await page.waitForTimeout(600);
    await expect(now(page)).toHaveText('green');
  });

  test('an invoke with nothing behind it waits, and you say how it finished', async ({ page }) => {
    await awkward(page, 'An invoke with nothing behind it');
    await event(page, 'LOAD').click();
    await expect(now(page)).toHaveText('loading');
    await expect(page.locator('[data-slot=simulation-error]')).toHaveCount(0);
    await expect(page.locator('[data-action=finish]')).toHaveCount(2);
    await finish(page, 'fetchThings: error').click();
    await expect(now(page)).toHaveText('failed');
    await event(page, 'LOAD').click();
    await finish(page, 'fetchThings: done').click();
    await expect(now(page)).toHaveText('loaded (finished)');
  });

  test('a machine that never settles is stopped, and says so, and the page goes on', async ({ page }) => {
    await awkward(page, 'One that never settles');
    await event(page, 'GO').click();
    const error = page.locator('[data-slot=simulation-error]');
    await expect(error).toContainText('never settles');
    await expect(error).toHaveAttribute('role', 'alert');
    expect(await offered(page)).toEqual([]);
    // Nothing thrown at the page, and it still answers.
    await page.locator('[data-action=reset]').click();
    await expect(error).toHaveCount(0);
    await expect(now(page)).toHaveText('still');

    await awkward(page, 'One that goes round on timers');
    await page.locator('[data-action=next-timer]').click();
    await expect(now(page)).toHaveText('off');
    await page.locator('[data-action=run]').click();
    await expect(page.locator('[data-slot=simulation-error]')).toContainText('never settles', { timeout: 10_000 });
    await expect(page.locator('[data-action=run]')).toBeDisabled();
  });

  test('nothing moves with reduced motion, and it all still works', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/?demo=state-diagram/simulate&theme=light', { waitUntil: 'load' });
    await expect(page.locator('[data-slot=simulation-panel]')).toBeVisible({ timeout: 30_000 });
    await expect.poll(() => page.locator('[data-slot=diagram-node]').count(), { timeout: 30_000 }).toBe(33);
    const moving = () => page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running' && a.effect?.getTiming().duration > 0).map((a) => a.animationName ?? a.transitionProperty ?? a.constructor.name));
    await finish(page, 'verifyToken: done').click();
    await expect(now(page)).toHaveText('streaming');
    expect(await moving()).toEqual([]);
    await event(page, 'EOF').click();
    await expect(now(page)).toHaveText('committing');
    expect(await moving()).toEqual([]);
  });

  test('the phone: the panel is a page pushed over the board, with the bar saying where it is', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 780 });
    await page.goto('/?demo=state-diagram/simulate&theme=light', { waitUntil: 'load' });
    const bar = page.locator('[data-slot=diagram-frame-bar]');
    await expect(bar).toBeVisible({ timeout: 30_000 });
    await expect(bar).toContainText('authenticating');
    await expect.poll(() => page.locator('[data-slot=diagram-current]').count(), { timeout: 30_000 }).toBe(2);
    // It isn't in the way until it's asked for.
    await expect(page.locator('[data-slot=simulation-panel]')).toHaveCount(0);
    await page.locator('[data-diagram-frame-trigger]').click();
    const pushed = page.locator('[data-slot=adaptive-pane-page]');
    await expect(pushed).toBeVisible();
    await expect(page.locator('[data-slot=adaptive-pane]')).toHaveAttribute('data-presentation', 'push');
    // It fills the window and no more, and scrolls inside itself.
    // Once it has slid in.
    await expect.poll(async () => { const b = await pushed.boundingBox(); return b.x + b.width; }).toBeLessThanOrEqual(390.5);
    const box = await pushed.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    // The board under it is inert while it's pushed.
    await finish(page, 'verifyToken: done').click();
    await expect(now(page)).toHaveText('streaming');
    // Back goes to the board, which has moved on, and the bar says where it is now; focus goes back to its button.
    await page.getByRole('button', { name: 'Back to Board' }).click();
    await expect(page.locator('[data-slot=simulation-panel]')).toBeHidden();
    await expect(bar).toContainText('streaming');
    await expect(page.locator('[data-current-of="upload.worker.streaming"]')).toHaveCount(1);
    await expect(page.locator('[data-diagram-frame-trigger]')).toBeFocused();
  });

  test('a tablet: a drawer that leaves the board in sight and in reach', async ({ page }) => {
    await page.setViewportSize({ width: 640, height: 780 });
    await page.goto('/?demo=state-diagram/simulate&theme=light', { waitUntil: 'load' });
    await page.locator('[data-diagram-frame-trigger]').click({ timeout: 30_000 });
    await expect(page.locator('[data-slot=adaptive-pane]')).toHaveAttribute('data-presentation', 'drawer');
    await expect(page.locator('[data-slot=simulation-panel]')).toBeVisible();
    // Opening it took focus into it.
    await expect(page.locator('[data-slot=drawer-content]')).toBeFocused();
    // Non-modal: the board still takes the keys and presses while it's open, once it's laid out.
    await expect.poll(() => page.locator('[data-slot=diagram-node]').count(), { timeout: 30_000 }).toBe(33);
    await page.locator('[data-slot=canvas]').focus();
    await page.keyboard.press('Home');
    await expect(page.locator('[data-slot=diagram-ring][data-focused]')).toHaveCount(1);
    await expect(page.locator('[data-slot=simulation-panel]')).toBeVisible();
  });

  test('the panel can go away and come back, and the keys work it', async ({ page }) => {
    await page.goto('/?demo=state-diagram/simulate&theme=light', { waitUntil: 'load' });
    await expect(page.locator('[data-slot=simulation-panel]')).toBeVisible({ timeout: 30_000 });
    await page.locator('[data-slot=adaptive-pane]').getByRole('button', { name: 'Close Simulation' }).click();
    const open = page.locator('[data-diagram-frame-trigger]');
    await expect(open).toBeVisible();
    // A closed column stays mounted, hidden, so a run in it keeps going.
    await expect(page.locator('[data-slot=adaptive-pane]')).toBeHidden();
    await expect(page.locator('[data-slot=adaptive-pane]')).toHaveAttribute('data-closed', '');
    await open.click();
    await expect(page.locator('[data-slot=simulation-panel]')).toBeVisible();
    await expect(open).toHaveCount(0);
    // Focus goes with it, each way, and never into something hidden.
    await expect(page.locator('[data-slot=diagram-frame-panel-body]')).toBeFocused();
    await page.getByRole('button', { name: 'Close Simulation' }).press('Enter');
    await expect(open).toBeFocused();
    await expect(page.locator('[data-slot=adaptive-pane]')).toBeHidden();
    await expect(page.locator('[data-slot=adaptive-pane]')).toHaveAttribute('data-closed', '');
    await open.press('Enter');
    await expect(page.locator('[data-slot=diagram-frame-panel-body]')).toBeFocused();
    // The run goes on through that.
    const done = finish(page, 'verifyToken: done');
    await done.focus();
    await page.keyboard.press('Enter');
    await expect(now(page)).toHaveText('streaming');
  });
});

test.describe('StateDiagram without xstate', () => {
  test('says what to install, when it can’t be loaded', async ({ page }) => {
    // xstate is an optional peer: an app that hasn't installed it gets this.
    await page.route(/\/deps\/xstate/, (route) => route.abort());
    await page.goto('/?demo=state-diagram/config&theme=light', { waitUntil: 'load' });
    const error = page.locator('[data-slot=diagram-error]');
    await expect(error).toBeVisible({ timeout: 30_000 });
    await expect(error).toHaveText('This needs xstate, an optional peer of @brett_lamy/ui: npm install xstate');
    await expect(error).toHaveAttribute('role', 'alert');
    await expect(page.locator('[data-slot=edit-panel],[data-slot=simulation-panel]')).toHaveCount(0);
  });
});

test.describe('StateDiagram edits', () => {
  const node = (page, id) => page.locator(`[data-slot=diagram-node][data-node="${id}"]`);
  const edge = (page, id) => page.locator(`[data-slot=diagram-edge][data-edge="${id}"]`);
  /** A refusal of something done on the board, or by a button, at the top of the panel. */
  const refusal = (page) => page.locator('[data-slot=edit-refusal]');
  const field = (page, slot) => page.locator(`input[data-field=${slot.replace('edit-', '')}]`);
  /** A field's refusal: its FieldError, under it. */
  const fieldError = (page, slot) => page.locator('[data-slot=field]', { has: field(page, slot) });
  const open = async (page, demo = 'state-diagram/edit') => {
    await page.goto(`/?demo=${demo}&theme=light`, { waitUntil: 'load' });
    await expect(page.locator('[data-slot=edit-panel]')).toBeVisible({ timeout: 30_000 });
    await expect.poll(() => page.locator('[data-slot=diagram-node]').count(), { timeout: 30_000 }).toBeGreaterThan(3);
  };
  /** Presses on it. A container can have something over its middle, so a press goes just inside its corner. */
  /** Where it is once it's stopped moving (a layout can land again as fonts do). */
  const still = async (page, id) => {
    let was = JSON.stringify(await node(page, id).boundingBox());
    for (let i = 0; i < 20; i++) {
      await page.waitForTimeout(100);
      const now = JSON.stringify(await node(page, id).boundingBox());
      if (now === was) break;
      was = now;
    }
    return JSON.parse(was);
  };
  const select = async (page, id) => {
    // A board opens at a readable size, from its top: what's further down is brought into view as the browser would (the
    // pane scrolls, and that pans).
    await node(page, id).scrollIntoViewIfNeeded();
    const b = await still(page, id);
    await page.mouse.click(b.x + Math.min(b.width / 2, 12), b.y + Math.min(b.height / 2, 12));
    await expect(node(page, id)).toHaveAttribute('data-selected', '');
  };
  /** Layers over the board don't take a press, so it goes where the pointer would. */
  const pressOn = async (page, id) => {
    await node(page, id).scrollIntoViewIfNeeded();
    const b = await still(page, id);
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  };
  const rename = async (page, name) => {
    await field(page, 'edit-name').fill(name);
    await field(page, 'edit-name').press('Enter');
  };
  /** A real drag from the dot on one side of a selected state to the middle of another. */
  const connect = async (page, from, to) => {
    await select(page, from);
    const dot = await page.locator(`[data-slot=diagram-port][data-port-of="${from}"][data-side=right]`).boundingBox();
    const b = await node(page, to).boundingBox();
    await page.mouse.move(dot.x + dot.width / 2, dot.y + dot.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });
    await page.mouse.up();
  };
  const graph = (page) => page.evaluate(() => ({
    nodes: [...document.querySelectorAll('[data-slot=diagram-node]')].map((n) => `${n.getAttribute('data-node')}:${n.getAttribute('data-kind')}`).sort(),
    edges: [...document.querySelectorAll('[data-slot=diagram-edge]')].map((n) => n.getAttribute('data-edge')).sort(),
    labels: [...document.querySelectorAll('[data-slot=diagram-edge-label]')].map((n) => n.textContent).sort(),
  }));
  const run = (page, name) => page.getByRole('tab', { name }).click({ force: true });

  test('edits a state’s entry actions in the panel, and a pressed chip opens its field', async ({ page }) => {
    await open(page);
    await select(page, 'door.open');
    await page.locator('[data-slot=edit-panel] [data-action=add-entry]').click();
    await expect(node(page, 'door.open').locator('[data-slot=diagram-item]', { hasText: 'action' })).toHaveCount(1);
    await page.locator('[data-field="entry:0"]').fill('openLatch');
    await page.locator('[data-field="entry:0"]').press('Enter');
    const chip = node(page, 'door.open').locator('[data-slot=diagram-item]', { hasText: 'openLatch' });
    await expect(chip).toHaveCount(1);
    // Pressing the chip, from another state, selects its state and opens it in the panel.
    await select(page, 'door.closed');
    const b = await chip.boundingBox();
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    await expect(node(page, 'door.open')).toHaveAttribute('data-selected', '');
    await expect(page.locator('[data-field="entry:0"]')).toBeFocused();
    await page.locator('[data-slot=edit-panel] [data-actions=entry] [data-action=remove]').click();
    await expect(chip).toHaveCount(0);
    await page.locator('[data-state-diagram] [data-action=undo]').click();
    await expect(chip).toHaveCount(1);
  });

  test('adds a state, names it, connects it with a real drag, and takes it all back', async ({ page }) => {
    await open(page);
    const before = await graph(page);
    await expect(page.locator('[data-state-diagram] [data-action=undo]')).toBeDisabled();
    await page.locator('[data-slot=edit-panel] [data-action=add-state]').click();
    await expect(node(page, 'door.state')).toHaveAttribute('data-selected', '');
    await expect(field(page, 'edit-name')).toHaveValue('state');
    await rename(page, 'broken');
    await expect(node(page, 'door.broken')).toHaveAttribute('data-selected', '');
    await expect(node(page, 'door.state')).toHaveCount(0);
    await expect(field(page, 'edit-name')).toHaveValue('broken');

    await connect(page, 'door.broken', 'door.closed');
    const made = edge(page, 'door.broken:EVENT->door.closed');
    await expect(made).toHaveCount(1);
    await expect(made).toHaveAttribute('data-selected', '');
    await expect(field(page, 'edit-event')).toHaveValue('EVENT');
    await field(page, 'edit-event').fill('REPAIR');
    await field(page, 'edit-event').press('Enter');
    await expect(edge(page, 'door.broken:REPAIR->door.closed')).toHaveAttribute('data-selected', '');
    await field(page, 'edit-guard').fill('canRepair');
    await field(page, 'edit-guard').press('Enter');
    await expect(page.locator('[data-slot=diagram-edge-label]', { hasText: 'REPAIR' }).filter({ has: page.locator('[data-slot=diagram-item]', { hasText: 'if canRepair' }) })).toHaveCount(1);
    // That name's new, with nothing behind it.
    await expect(page.locator('[data-slot=edit-missing] [data-kind=guards]')).toContainText('canRepair');
    await expect(page.locator('[data-slot=edit-missing] [data-kind=actors]')).toContainText('alarm');
    await field(page, 'edit-guard').fill('');
    await field(page, 'edit-guard').press('Enter');
    await expect(page.locator('[data-slot=diagram-edge-label]', { hasText: 'canRepair' })).toHaveCount(0);
    await expect(page.locator('[data-slot=edit-missing] [data-kind=guards]')).not.toContainText('canRepair');
    // The same two states can be connected again, and again, each under a name of its own.
    await connect(page, 'door.broken', 'door.closed');
    await expect(edge(page, 'door.broken:EVENT->door.closed')).toHaveCount(1);
    await expect(edge(page, 'door.broken:REPAIR->door.closed')).toHaveCount(1);
    await connect(page, 'door.broken', 'door.closed');
    await expect(edge(page, 'door.broken:EVENT2->door.closed')).toHaveAttribute('data-selected', '');

    // Back through all of it, one at a time.
    for (let i = 0; i < 8; i++) await page.locator('[data-state-diagram] [data-action=undo]').click();
    await expect(page.locator('[data-state-diagram] [data-action=undo]')).toBeDisabled();
    await expect.poll(() => graph(page)).toEqual(before);
    // And forward again.
    for (let i = 0; i < 8; i++) await page.locator('[data-state-diagram] [data-action=redo]').click();
    await expect(page.locator('[data-state-diagram] [data-action=redo]')).toBeDisabled();
    await expect(edge(page, 'door.broken:EVENT->door.closed')).toHaveCount(1);
    await expect(edge(page, 'door.broken:EVENT2->door.closed')).toHaveCount(1);
    await expect(edge(page, 'door.broken:REPAIR->door.closed')).toHaveCount(1);
  });

  test('renaming one that’s targeted from elsewhere keeps what goes to it', async ({ page }) => {
    await open(page);
    await select(page, 'door.closed');
    await rename(page, 'shut');
    await expect(node(page, 'door.shut')).toHaveAttribute('data-selected', '');
    for (const id of ['door.open:CLOSE->door.shut', 'door.locked:UNLOCK->door.shut', 'door.shut:OPEN->door.open', 'door.shut:LOCK->door.locked']) await expect(edge(page, id)).toHaveCount(1);
    // It's still where it starts.
    await expect(node(page, 'door.shut').locator('[data-slot=diagram-entry]')).toHaveCount(1);
    await expect(page.locator('[data-slot=edit-panel] [data-action=make-start]')).toBeDisabled();
    await expect(page.locator('[data-slot=edit-refusal]')).toHaveCount(0);
  });

  test('refuses what XState won’t have, says why, and changes nothing', async ({ page }) => {
    await open(page);
    const before = await graph(page);
    // Where a compound starts.
    await select(page, 'door.closed');
    await page.locator('[data-slot=edit-panel] [data-action=delete]').click();
    await expect(refusal(page)).toContainText('closed');
    await expect(refusal(page)).toHaveAttribute('role', 'alert');
    expect(await graph(page)).toEqual(before);
    await expect(page.locator('[data-state-diagram] [data-action=undo]')).toBeDisabled();
    // A name that's taken, said under the field, which is invalid, and goes back to what it was.
    await rename(page, 'open');
    await expect(fieldError(page, 'edit-name')).toContainText('already a state called “open”');
    await expect(field(page, 'edit-name')).toHaveAttribute('aria-invalid', 'true');
    await expect(field(page, 'edit-name')).toHaveValue('closed');
    expect(await graph(page)).toEqual(before);
    // A name that wouldn't work in a target.
    await rename(page, 'a.b');
    await expect(fieldError(page, 'edit-name')).toContainText('dot');
    // The Delete key says the same, from the board.
    await pressOn(page, 'door.open');
    await pressOn(page, 'door.closed');
    await page.keyboard.press('Delete');
    await expect(refusal(page)).toContainText('closed');
    expect(await graph(page)).toEqual(before);
    // Starting somewhere else lets it go, and clears what was said.
    await select(page, 'door.open');
    await page.locator('[data-slot=edit-panel] [data-action=make-start]').click();
    await expect(refusal(page)).toHaveCount(0);
    await expect(node(page, 'door.open').locator('[data-slot=diagram-entry]')).toHaveCount(1);
    await select(page, 'door.closed');
    await page.locator('[data-slot=edit-panel] [data-action=delete]').click();
    await expect(node(page, 'door.closed')).toHaveCount(0);
    await expect(edge(page, 'door.open:CLOSE->door.closed')).toHaveCount(0);
  });

  test('saved as JSON and loaded, it’s the same graph and the same run', async ({ page }) => {
    await open(page);
    await page.locator('[data-slot=edit-panel] [data-action=add-state]').click();
    await rename(page, 'broken');
    await connect(page, 'door.broken', 'door.closed');
    await connect(page, 'door.closed', 'door.broken');
    await expect(edge(page, 'door.closed:EVENT->door.broken')).toHaveCount(1);
    await select(page, 'door.open');
    await rename(page, 'ajar');
    await expect(node(page, 'door.ajar')).toHaveCount(1);
    const walk = async () => {
      await run(page, 'Run');
      await page.locator('[data-action=reset]').click();
      await page.locator('[data-action=send][data-event=EVENT]').click();
      await expect(page.locator('[data-slot=simulation-now]')).toHaveText('broken');
      await page.locator('[data-action=send][data-event=EVENT]').click();
      await expect(page.locator('[data-slot=simulation-now]')).toHaveText('closed');
      await page.locator('[data-action=send][data-event=OPEN]').click();
      await expect(page.locator('[data-slot=simulation-now]')).toHaveText('ajar');
      await page.locator('[data-action=next-timer]').click();
      await expect(page.locator('[data-slot=simulation-now]')).toHaveText('closed');
      const log = await page.locator('[data-slot=simulation-log-entry]').allTextContents();
      await run(page, 'Edit');
      return log;
    };
    const graphBefore = await graph(page);
    const runBefore = await walk();
    expect(runBefore).toHaveLength(5);
    await page.getByRole('button', { name: 'Save as JSON' }).click();
    const saved = await page.getByRole('textbox', { name: 'The config, as JSON' }).inputValue();
    expect(JSON.parse(saved).states.ajar.on.CLOSE).toBe('closed');
    expect(JSON.parse(saved).initial).toBe('closed');
    // Start from somewhere else altogether, so that loading really does something.
    await page.getByRole('button', { name: 'Start again' }).click();
    await expect(node(page, 'door.broken')).toHaveCount(0);
    // That's from outside, even though it's been seen before, so it can't be undone from here.
    await expect(page.locator('[data-state-diagram] [data-action=undo]')).toBeDisabled();
    await page.getByRole('button', { name: 'Load it' }).click();
    await expect(node(page, 'door.broken')).toHaveCount(1);
    await expect.poll(() => graph(page)).toEqual(graphBefore);
    expect(await walk()).toEqual(runBefore);
    // There's nothing to undo from something that's only been loaded.
    await expect(page.locator('[data-state-diagram] [data-action=undo]')).toBeDisabled();
    // And what XState won't have, from outside, says so.
    for (const bad of [{ id: 'x', initial: 'nope', states: { a: {} } }, { id: 'x', initial: 'a', states: { a: { on: { GO: 'nope' } } } }]) {
      await page.getByRole('textbox', { name: 'The config, as JSON' }).fill(JSON.stringify(bad));
      await page.getByRole('button', { name: 'Load it' }).click();
      await expect(page.locator('[data-slot=diagram-error]')).toContainText('nope');
    }
    // And something else again brings it back.
    await page.getByRole('button', { name: 'Start again' }).click();
    await expect(page.locator('[data-slot=diagram-error]')).toHaveCount(0);
    await expect(node(page, 'door.closed')).toHaveCount(1);
  });

  test('editing while it’s running starts it over on the new machine, with the guards as they were', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await open(page);
    await run(page, 'Run');
    await page.locator('[data-action=send][data-event=OPEN]').click();
    await expect(page.locator('[data-slot=simulation-now]')).toHaveText('open');
    await expect(page.locator('[data-current-of="door.open"]')).toHaveCount(1);
    await page.locator('[data-guard=hasKey] [data-slot=switch]').click();
    // A refused edit doesn't touch it.
    await run(page, 'Edit');
    await select(page, 'door.closed');
    await page.locator('[data-slot=edit-panel] [data-action=delete]').click();
    await expect(refusal(page)).toBeVisible();
    await run(page, 'Run');
    await expect(page.locator('[data-slot=simulation-now]')).toHaveText('open');
    await expect(page.locator('[data-slot=simulation-log-entry]')).not.toHaveCount(1);
    // Renaming what it's in, while the clock's running.
    await page.locator('[data-action=run]').click();
    await run(page, 'Edit');
    await select(page, 'door.open');
    await rename(page, 'ajar');
    await run(page, 'Run');
    await expect(page.locator('[data-slot=simulation-now]')).toHaveText('closed');
    await expect(page.locator('[data-slot=simulation-log-entry]')).toHaveCount(1);
    await expect(page.locator('[data-current-of="door.closed"]')).toHaveCount(1);
    await expect(page.locator('[data-current-of="door.open"]')).toHaveCount(0);
    // The clock isn't running on its own.
    await expect(page.getByRole('button', { name: 'Run', exact: true })).toBeVisible();
    // The guard's as it was.
    await expect(page.locator('[data-guard=hasKey] input')).not.toBeChecked();
    expect(await page.locator('[data-action=send]').evaluateAll((els) => els.map((el) => el.getAttribute('data-event')))).toEqual(['OPEN']);
    // It runs what's there now.
    await page.locator('[data-action=send][data-event=OPEN]').click();
    await expect(page.locator('[data-slot=simulation-now]')).toHaveText('ajar');
    await expect(page.locator('[data-current-of="door.ajar"]')).toHaveCount(1);
    // Taking away what it's in.
    await run(page, 'Edit');
    await select(page, 'door.ajar');
    await page.locator('[data-slot=edit-panel] [data-action=delete]').click();
    await run(page, 'Run');
    await expect(page.locator('[data-slot=simulation-now]')).toHaveText('closed');
    expect(errors).toEqual([]);
  });

  test('nothing moves when it’s dragged, as positions are the layout’s, and the keys work', async ({ page }) => {
    await open(page);
    const before = await node(page, 'door.closed').boundingBox();
    await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
    await page.mouse.down();
    await page.mouse.move(before.x + 60, before.y + 60, { steps: 6 });
    // Not while it's being dragged, either, which would only look as if it could.
    expect(await node(page, 'door.closed').boundingBox()).toEqual(before);
    await page.mouse.up();
    expect(await node(page, 'door.closed').boundingBox()).toEqual(before);
    await expect(page.locator('[data-state-diagram] [data-action=undo]')).toBeDisabled();

    // Select with a press, and let the keys do the rest. ⇧ with an arrow doesn't move it (where it is on the board, which
    // the view following the keys doesn't change).
    await select(page, 'door.jammed');
    const place = () => node(page, 'door.jammed').evaluate((el) => `${el.style.left},${el.style.top}`);
    const jammed = await place();
    await page.locator('[data-slot=canvas]').focus();
    await page.keyboard.press('Home');
    await page.keyboard.press('Shift+ArrowRight');
    await page.keyboard.press('Shift+ArrowDown');
    expect(await place()).toEqual(jammed);
    await expect(page.locator('[data-state-diagram] [data-action=undo]')).toBeDisabled();
    await select(page, 'door.jammed');
    await page.keyboard.press('Delete');
    await expect(node(page, 'door.jammed')).toHaveCount(0);
    await expect(page.locator('[data-state-diagram] [data-action=undo]')).toBeEnabled();
    // ⌘Z from the board undoes it, and ⌘⇧Z does it again.
    await page.keyboard.press('ControlOrMeta+z');
    await expect(node(page, 'door.jammed')).toHaveCount(1);
    await page.keyboard.press('ControlOrMeta+Shift+z');
    await expect(node(page, 'door.jammed')).toHaveCount(0);
    await page.keyboard.press('ControlOrMeta+z');
    await expect(node(page, 'door.jammed')).toHaveCount(1);
    // In a field, it's for the field.
    await select(page, 'door.jammed');
    await page.locator('[data-slot=edit-panel] [data-action=add-state]').click();
    await expect(field(page, 'edit-name')).toHaveValue('state');
    await field(page, 'edit-name').fill('typed');
    await field(page, 'edit-name').press('ControlOrMeta+z');
    await expect(node(page, 'door.state')).toHaveCount(1);
    await field(page, 'edit-name').press('Escape');
    await expect(field(page, 'edit-name')).toHaveValue('state');
    // C connects by keyboard, as on any Diagram.
    const status = page.locator('[data-slot=diagram-status]');
    await page.locator('[data-slot=canvas]').focus();
    await page.keyboard.press('End');
    await page.keyboard.press('c');
    await expect(status).toContainText('Connecting from');
    // Whichever way a neighbour is, as the layout has it.
    for (const key of ['ArrowUp', 'ArrowLeft', 'ArrowRight', 'ArrowDown']) {
      await page.keyboard.press(key);
      if ((await status.textContent()).includes('To ')) break;
    }
    await expect(status).toContainText('To ');
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await graph(page)).edges.filter((e) => e.includes(':EVENT->')).length).toBe(1);
    await expect(refusal(page)).toHaveCount(0);
  });

  test('dragging an end of a transition moves that end, and only if it can', async ({ page }) => {
    await open(page);
    /** Presses on an edge's label, which is the same as pressing on the edge. */
    const pressLabel = async (text) => {
      const b = await page.locator('[data-slot=diagram-edge-label]', { hasText: text }).boundingBox();
      await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    };
    const dragEnd = async (end, to) => {
      const dot = await page.locator(`[data-slot=diagram-edge-end][data-end=${end}]`).boundingBox();
      const b = await node(page, to).boundingBox();
      await page.mouse.move(dot.x + dot.width / 2, dot.y + dot.height / 2);
      await page.mouse.down();
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });
      await page.mouse.up();
    };
    // Where it goes.
    await pressLabel('CLOSE');
    await expect(edge(page, 'door.open:CLOSE->door.closed')).toHaveAttribute('data-selected', '');
    await dragEnd('to', 'door.jammed');
    await expect(edge(page, 'door.open:CLOSE->door.jammed')).toHaveCount(1);
    await expect(edge(page, 'door.open:CLOSE->door.closed')).toHaveCount(0);
    // Where it comes from.
    await pressLabel('UNLOCK');
    await expect(edge(page, 'door.locked:UNLOCK->door.closed')).toHaveAttribute('data-selected', '');
    await dragEnd('from', 'door.open');
    await expect(edge(page, 'door.open:UNLOCK->door.closed')).toHaveCount(1);
    await expect(edge(page, 'door.locked:UNLOCK->door.closed')).toHaveCount(0);
    // A timer can go somewhere else, but it goes with its state.
    await pressLabel('after 5,000 ms');
    const timer = 'door.open:xstate.after.5000.door.open->door.closed';
    await expect(edge(page, timer)).toHaveAttribute('data-selected', '');
    await dragEnd('from', 'door.locked');
    await expect(refusal(page)).toContainText('goes with what its state does');
    await expect(edge(page, timer)).toHaveCount(1);
    // And it all undoes.
    await page.locator('[data-state-diagram] [data-action=undo]').click();
    await expect(edge(page, 'door.locked:UNLOCK->door.closed')).toHaveCount(1);
    await page.locator('[data-state-diagram] [data-action=undo]').click();
    await expect(edge(page, 'door.open:CLOSE->door.closed')).toHaveCount(1);
    await expect(page.locator('[data-state-diagram] [data-action=undo]')).toBeDisabled();
  });

  test('a clock that was running doesn’t carry on into the next run', async ({ page }) => {
    await open(page);
    // Starting where there's a timer, so that there's something for it to run to.
    await select(page, 'door.open');
    await page.locator('[data-slot=edit-panel] [data-action=make-start]').click();
    await run(page, 'Run');
    await expect(page.locator('[data-slot=simulation-now]')).toHaveText('open');
    await page.locator('[data-action=run]').click();
    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
    await run(page, 'Edit');
    await select(page, 'door.jammed');
    await rename(page, 'stuck');
    await expect(node(page, 'door.stuck')).toHaveCount(1);
    await run(page, 'Run');
    await expect(page.locator('[data-slot=simulation-log-entry]')).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Run', exact: true })).toBeVisible();
    const time = page.locator('[data-slot=simulation-time]');
    await expect(time).toHaveText('0 ms, next at 5,000 ms');
    await page.waitForTimeout(300);
    await expect(time).toHaveText('0 ms, next at 5,000 ms');
  });

  test('with both on, focus goes to whichever’s showing', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: 'Close State machine' }).click();
    await page.locator('[data-diagram-frame-trigger]').click();
    await expect(page.locator('[data-slot=diagram-frame-panel-body]')).toBeFocused();
    await run(page, 'Run');
    await page.getByRole('button', { name: 'Close State machine' }).click();
    await page.locator('[data-diagram-frame-trigger]').click();
    await expect(page.locator('[data-slot=diagram-frame-panel-body]')).toBeFocused();
    // With nothing selected, the panel has its hint.
    await run(page, 'Edit');
    await expect(page.locator('[data-slot=edit-hint]')).toBeVisible();
  });

  test('the phone: select on the board, then edit it in the pushed panel', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 780 });
    await page.goto('/?demo=state-diagram/edit&theme=light', { waitUntil: 'load' });
    const opener = page.locator('[data-diagram-frame-trigger]');
    await expect(opener).toBeVisible({ timeout: 30_000 });
    await expect.poll(() => page.locator('[data-slot=diagram-node]').count(), { timeout: 30_000 }).toBeGreaterThan(3);
    await select(page, 'door.open');
    // The bar says where the run is, and the run goes on while you edit.
    await expect(page.locator('[data-slot=diagram-frame-bar]')).toContainText('In closed');
    await opener.click();
    await expect(page.locator('[data-slot=adaptive-pane]')).toHaveAttribute('data-presentation', 'push');
    await page.getByRole('tab', { name: 'Edit' }).click();
    await expect(page.locator('[data-slot=edit-panel]')).toBeVisible();
    // What was selected on the board is what the panel edits.
    await expect(field(page, 'edit-name')).toHaveValue('open');
    await rename(page, 'ajar');
    await page.getByRole('button', { name: 'Back to Board' }).click();
    await expect(node(page, 'door.ajar')).toHaveCount(1);
    await expect(edge(page, 'door.closed:OPEN->door.ajar')).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });

  test('a machine’s own implementations count, and code in a config is pointed out', async ({ page }) => {
    await page.setViewportSize({ width: 2000, height: 900 });
    await open(page, 'state-diagram/edit-machine');
    // It has all of its own, so nothing's listed, and neither is its code, as it isn't in the config.
    await expect(page.locator('[data-slot=edit-missing]')).toHaveCount(0);
    await expect(page.locator('[data-slot=edit-inline]')).toHaveCount(0);
    await select(page, 'upload.worker.streaming');
    await rename(page, 'receiving');
    await expect(node(page, 'upload.worker.receiving')).toHaveCount(1);
    await expect(page.locator('[data-slot=edit-missing]')).toHaveCount(0);
    // Closed and opened, focus goes to the panel, and back.
    await page.getByRole('button', { name: 'Close Edit' }).click();
    await expect(page.locator('[data-diagram-frame-trigger]')).toBeFocused();
    await page.locator('[data-diagram-frame-trigger]').press('Enter');
    await expect(page.locator('[data-slot=diagram-frame-panel-body]')).toBeFocused();
    // A press on the middle of its line.
    const line = edge(page, 'upload.worker.receiving:EOF->upload.worker.committing');
    const at = await line.evaluate((el) => {
      const p = el.getPointAtLength(el.getTotalLength() / 2);
      const m = el.getScreenCTM();
      return { x: m.a * p.x + m.e, y: m.d * p.y + m.f };
    });
    await page.mouse.click(at.x, at.y);
    await expect(line).toHaveAttribute('data-selected', '');
    await expect(field(page, 'edit-guard')).toBeVisible();
    await field(page, 'edit-guard').fill('hasEnoughBytes');
    await field(page, 'edit-guard').press('Enter');
    await expect(page.locator('[data-slot=edit-missing] [data-kind=guards]')).toHaveText('guards: hasEnoughBytes');
    await page.getByRole('button', { name: 'With code in it' }).click();
    await expect(page.locator('[data-slot=edit-inline]')).toContainText('states.a.entry');
  });
});

test.describe('the anatomy: a statechart and a system from the generic parts', () => {
  test.use({ viewport: { width: 800, height: 1000 } });
  const open = async (page, demo) => {
    await page.goto(`/?demo=diagram/${demo}&theme=light`, { waitUntil: 'load' });
    await expect(page.locator('[data-demo-status]')).toHaveAttribute('data-demo-status', 'ready', { timeout: 60_000 });
    await page.locator('[data-slot=diagram-edge-label]').first().waitFor();
  };

  test('ten states fit 800 × 1000 at a readable size, top to bottom, with routes that run through their labels', async ({ page }) => {
    await open(page, 'statechart-like');
    const zoom = await page.locator('[data-slot=canvas-board]').evaluate((el) => Number(/scale\(([^)]+)\)/.exec(el.style.transform)[1]));
    // Whole, at no less than a diagram opens at (87.5%, where a chip's 12 px are about 11).
    expect(zoom).toBeGreaterThanOrEqual(0.875);
    expect(zoom).toBeLessThanOrEqual(1);
    const seen = await page.evaluate(() => {
      const box = (el) => el.getBoundingClientRect();
      const node = (id) => box(document.querySelector(`[data-slot=diagram-node][data-node="${id}"]`));
      // Each label's middle is on its edge's path: the line runs into it and out of it.
      const throughLabels = [...document.querySelectorAll('[data-slot=diagram-edge-label]')].map((label) => {
        const path = document.querySelector(`[data-slot=diagram-edge][data-edge="${label.dataset.edge}"]`);
        const r = box(label), len = path.getTotalLength(), m = path.getScreenCTM();
        let inside = false;
        for (let at = 0; at <= len && !inside; at += 2) {
          const p = path.getPointAtLength(at).matrixTransform(m);
          inside = p.x > r.left + 2 && p.x < r.right - 2 && p.y > r.top + 2 && p.y < r.bottom - 2;
        }
        return { edge: label.dataset.edge, shape: label.dataset.shape, inside };
      });
      return { init: node('init'), loading: node('loading'), paused: node('paused'), playing: node('playing'), throughLabels, chips: document.querySelectorAll('[data-slot=diagram-item]').length };
    });
    // Top to bottom, the entry state first.
    expect(seen.init.top).toBeLessThan(seen.loading.top);
    expect(seen.paused.top).toBeLessThan(seen.playing.top);
    for (const l of seen.throughLabels) expect(l.inside, `${l.edge} runs through its label`).toBe(true);
    expect(seen.throughLabels.filter((l) => l.shape === 'pill').map((l) => l.edge).sort()).toEqual(['loading-active', 'paused-playing', 'playing-end', 'playing-paused']);
    // Context (4), two entry actions, and the chips of six labels.
    expect(seen.chips).toBe(4 + 2 + 6);
    // The text is the kit's small text, 12 px chips and 13 px titles, at no less than 87.5% (rows of 15 px, 13 on screen).
    const sizes = await page.evaluate(() => [...document.querySelectorAll('[data-slot=diagram-node-title], [data-slot=diagram-item]')].map((el) => el.getBoundingClientRect().height));
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(13);
    await expect(page.locator('[data-slot=diagram-entry]')).toHaveCount(2);
    // The first fit leaves room for the toolbar at the foot.
    const machine = await page.locator('[data-slot=diagram-node][data-node=player]').boundingBox();
    const tools = await page.getByRole('toolbar', { name: 'Diagram tools' }).boundingBox();
    expect(machine.y + machine.height).toBeLessThanOrEqual(tools.y);
  });

  test('a chip is pressed by pointer and by keyboard', async ({ page }) => {
    await open(page, 'statechart-like');
    await page.locator('[data-slot=diagram-item][data-item=onPause]').click();
    await expect(page.getByRole('status').filter({ hasText: 'Pressed onPause on paused' })).toHaveCount(1);
    // The press left the keys on Paused, the card it selected: Alt+↓ goes into its items.
    await page.getByRole('application', { name: 'Audio Player board' }).focus();
    await page.keyboard.press('Alt+ArrowDown');
    await expect(page.locator('[data-slot=diagram-item][data-focused]')).toHaveCount(1);
    await page.keyboard.press('Enter');
    await expect(page.getByRole('status').filter({ hasText: /^Pressed / })).toHaveCount(1);
  });

  test('a system: containers hold their cards under their sections, and nothing overlaps', async ({ page }) => {
    await open(page, 'system-like');
    const boxes = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-slot=diagram-node]')].map((el) => {
      const r = el.getBoundingClientRect();
      return [el.dataset.node, { x: r.left, y: r.top, r: r.right, b: r.bottom }];
    })));
    const sections = await page.locator('[data-node=consumer] > [data-slot=diagram-node-body] [data-slot=diagram-sections]').boundingBox();
    expect(boxes.room.y).toBeGreaterThan(sections.y + sections.height);
    expect(boxes.room.x).toBeGreaterThan(boxes.consumer.x);
    expect(boxes.room.b).toBeLessThan(boxes.consumer.b);
    const leaves = ['api', 'files', 'jobs', 'db'];
    for (const a of leaves) for (const b of leaves) {
      if (a >= b) continue;
      const p = boxes[a], q = boxes[b];
      expect(p.r <= q.x || q.r <= p.x || p.b <= q.y || q.b <= p.y, `${a} and ${b}`).toBe(true);
    }
  });
});

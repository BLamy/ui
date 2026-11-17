import { readdirSync, readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';

/* ELK, in a worker, through the docs demo. What a layout mustn't do is block the page's main thread, so that's what's
   measured: the Long Tasks API's tasks (50 ms or more of the main thread, by the browser's own clock), not the gaps
   between frames, which a machine running other browsers stretches when it takes the renderer off the CPU. A real block
   (60 ms of work put in the layout's path) fails it; the frame gaps are printed beside it. */

/** Keeps track of workers, and of the gap between every two animation frames. */
const INSTRUMENT = () => {
  const Real = window.Worker;
  window.__workers = [];
  window.Worker = class extends Real {
    constructor(...args) {
      super(...args);
      this.record = { url: String(args[0]), terminated: false, answeredAt: 0, asked: 0 };
      window.__workers.push(this.record);
      this.addEventListener('message', () => { this.record.answeredAt = performance.now(); });
    }
    postMessage(...args) {
      this.record.asked++;
      super.postMessage(...args);
    }
    terminate() {
      this.record.terminated = true;
      super.terminate();
    }
  };
  window.__longTasks = [];
  try {
    new PerformanceObserver((list) => { for (const e of list.getEntries()) window.__longTasks.push([e.startTime, e.duration]); }).observe({ type: 'longtask', buffered: true });
  } catch { /* no Long Tasks API: the frame gaps still print */ }
  window.__gaps = [];
  let last = performance.now();
  const tick = () => {
    const now = performance.now();
    window.__gaps.push([last, now - last]);
    last = now;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};

const status = (page) => page.locator('[data-demo-status]');
const open = async (page, n = 100) => {
  await page.addInitScript(INSTRUMENT);
  await page.goto(`/?demo=diagram/layout&theme=light&n=${n}`, { waitUntil: 'load' });
  await expect(status(page)).toHaveAttribute('data-demo-status', 'ready', { timeout: 60_000 });
};
const workers = (page) => page.evaluate(() => window.__workers);
/** How many layouts ELK's been asked for. */
const asked = async (page) => (await workers(page)).reduce((sum, w) => sum + w.asked, 0);
/** Presses the button for 2,000, and waits until ELK really has it, past measuring. */
async function start2000(page) {
  const before = await asked(page);
  await page.getByRole('button', { name: '2000' }).click();
  await expect.poll(() => asked(page), { timeout: 30_000 }).toBeGreaterThan(before);
}

test('lays out in a worker, in the order it was asked', async ({ page }) => {
  await open(page);
  await expect(status(page)).toHaveAttribute('data-demo-engine', 'worker');
  const list = await workers(page);
  // React's dev mode mounts effects twice, so the first may have been stopped. There's one live one.
  expect(list.filter((w) => !w.terminated)).toHaveLength(1);
  expect(list[0].url).toContain('layout-worker');
  await expect(page.locator('[data-slot=diagram-node]').first()).toBeVisible();
  const placed = await page.locator('[data-slot=diagram-node]').evaluateAll((els) => els.filter((e) => e.style.left !== '0px' || e.style.top !== '0px').length);
  expect(placed).toBeGreaterThan(90);
  const lines = await page.locator('[data-slot=diagram-edge]').count();
  expect(lines).toBeGreaterThan(100);
});

test('2,000 nodes lay out without stopping the page', async ({ page }, info) => {
  test.setTimeout(240_000);
  await open(page);
  // The page doing nothing, for comparison.
  await page.waitForTimeout(1500);
  const idleFrom = await page.evaluate(() => performance.now());
  await page.waitForTimeout(1500);
  const pressed = await page.evaluate(() => performance.now());
  const before = (await workers(page)).length;
  await page.getByRole('button', { name: '2000' }).click();
  await expect(status(page)).toContainText('2000 nodes', { timeout: 200_000 });
  await page.waitForTimeout(300);
  const seen = await page.evaluate(({ idleFrom, pressed }) => {
    const answered = Math.max(...window.__workers.map((w) => w.answeredAt));
    const inRange = (a, b) => window.__gaps.filter(([at]) => at >= a && at < b).map(([, g]) => g).sort((x, y) => x - y);
    const summary = (g) => ({ frames: g.length, median: Math.round(g[g.length >> 1] * 10) / 10, p95: Math.round(g[Math.floor(g.length * 0.95)] * 10) / 10, max: Math.round(g.at(-1) * 10) / 10, over34: g.filter((x) => x > 34).length });
    return {
      idle: summary(inRange(idleFrom, pressed)),
      // From the press to ELK's answer: what the page has to go on doing while it lays out.
      layingOut: summary(inRange(pressed, answered)),
      ms: Math.round(answered - pressed),
      // From the answer to the next frame or two: drawing 2,000 nodes, which is React's and not ELK's.
      drawing: Math.round(Math.max(...inRange(answered, answered + 3000), 0)),
      // The longest gaps while it laid out: how far in they started, of how long, and how long they lasted.
      longest: window.__gaps.filter(([at]) => at >= pressed && at < answered).sort((x, y) => y[1] - x[1]).slice(0, 3).map(([at, g]) => [Math.round(at - pressed), Math.round(g)]),
      // The main thread's long tasks while it laid out (from the press to ELK's answer), and when the page was idle.
      blocked: window.__longTasks.filter(([at]) => at >= pressed && at < answered).map(([at, d]) => [Math.round(at - pressed), Math.round(d)]),
      blockedIdle: window.__longTasks.filter(([at]) => at >= idleFrom && at < pressed).map(([, d]) => Math.round(d)),
    };
  }, { idleFrom, pressed });
  const text = await status(page).textContent();
  console.log(`layout of 2,000: ${text}. Frame gaps, ms: ${JSON.stringify(seen)}`);
  info.annotations.push({ type: 'frames', description: JSON.stringify(seen) });
  expect(await status(page).getAttribute('data-demo-engine')).toBe('worker');
  expect((await workers(page)).length).toBe(before);
  // At least one frame in every stretch of ELK's work, so this really did run while the page went on.
  expect(seen.layingOut.frames).toBeGreaterThan(seen.ms / 200);
  // Nothing held the main thread for a long task (50 ms, the browser's own line) while ELK worked.
  expect(seen.blocked, 'long tasks while laying out: [ms after the press, ms long]').toEqual([]);
});

test('a layout started while another is running stops the first', async ({ page }) => {
  test.setTimeout(240_000);
  await open(page);
  const before = (await workers(page)).filter((w) => !w.terminated).length;
  await start2000(page);
  await page.getByRole('button', { name: '500' }).click();
  // It's the answer to the second that's shown, and the first worker's gone rather than left to finish.
  await expect(status(page)).toHaveAttribute('data-demo-status', 'ready', { timeout: 60_000 });
  await expect(page.locator('[data-slot=diagram-node]').first()).toBeVisible();
  await expect.poll(() => page.locator('[data-slot=diagram]').evaluate((el) => el.querySelectorAll('[data-slot=diagram-node]').length)).toBeLessThan(800);
  const list = await workers(page);
  expect(list.filter((w) => !w.terminated)).toHaveLength(before);
  expect(list.filter((w) => w.terminated).length).toBeGreaterThanOrEqual(1);
});

test('unmounting during a layout stops the worker', async ({ page }) => {
  test.setTimeout(240_000);
  await open(page);
  await start2000(page);
  await page.getByRole('button', { name: 'Remove it' }).click();
  await expect(status(page)).toHaveCount(0);
  await expect.poll(async () => (await workers(page)).filter((w) => !w.terminated).length).toBe(0);
  // And it comes back from nothing.
  await page.getByRole('button', { name: 'Bring it back' }).click();
  await expect(status(page)).toHaveAttribute('data-demo-status', 'ready', { timeout: 200_000 });
});

test('unmounting with no layout running stops the worker too', async ({ page }) => {
  await open(page);
  // It's kept between layouts, as starting one means loading ELK again.
  expect((await workers(page)).filter((w) => !w.terminated)).toHaveLength(1);
  await page.getByRole('button', { name: 'Remove it' }).click();
  await expect(status(page)).toHaveCount(0);
  await expect.poll(async () => (await workers(page)).filter((w) => !w.terminated).length).toBe(0);
});

test('a cycle through a compound lays out in the browser too', async ({ page }) => {
  await open(page);
  // The generated graph has edges that cross compounds in both directions, and self-loops: nothing failed, and each drew.
  await expect(status(page)).not.toHaveAttribute('data-demo-status', 'error');
  const empties = await page.locator('[data-slot=diagram-edge]').evaluateAll((els) => els.filter((e) => !e.getAttribute('d')).length);
  expect(empties).toBe(0);
});

test.describe('fonts', () => {
  const pnpm = new URL('../../node_modules/.pnpm/', import.meta.url);
  const katex = readdirSync(pnpm).find((d) => d.startsWith('katex@'));
  const font = readFileSync(new URL(`${katex}/node_modules/katex/dist/fonts/KaTeX_Typewriter-Regular.woff2`, pnpm));
  /** Where the routes run. A node's words here are short enough to sit at its least size, but every label's size counts. */
  const routes = (page) => page.locator('[data-slot=diagram-edge]').evaluateAll((els) => els.map((e) => e.getAttribute('d')).join());
  const route = async (page) => {
    let release;
    const released = new Promise((r) => { release = r; });
    await page.route('**/late-font.woff2', async (r) => {
      await released;
      await r.fulfill({ body: font, contentType: 'font/woff2' });
    });
    return release;
  };

  test('a font that arrives late lays the graph out again', async ({ page }) => {
    const release = await route(page);
    await open(page);
    const before = await routes(page);
    const layouts = await asked(page);
    await page.addStyleTag({ content: `
      @font-face { font-family: 'Late'; src: url('/late-font.woff2') format('woff2'); }
      [data-demo-host] { font-family: 'Late', monospace; letter-spacing: 3px; }
    ` });
    await expect.poll(() => page.evaluate(() => document.fonts.status)).toBe('loading');
    release();
    await expect.poll(() => routes(page), { timeout: 20_000 }).not.toBe(before);
    await expect(status(page)).toHaveAttribute('data-demo-status', 'ready');
    // It's a new layout, not just wider boxes where the old ones were.
    expect(await asked(page)).toBeGreaterThan(layouts);
  });

  test('a font that changes no sizes changes nothing', async ({ page }) => {
    const release = await route(page);
    await open(page);
    const layouts = await asked(page);
    const finished = page.evaluate(() => new Promise((resolve) => document.fonts.addEventListener('loadingdone', resolve, { once: true })).then(() => true));
    // Nothing in the diagram uses this one.
    await page.addStyleTag({ content: "@font-face { font-family: 'Unused'; src: url('/late-font.woff2') format('woff2'); }" });
    await page.evaluate(() => { document.fonts.load('12px Unused'); });
    await expect.poll(() => page.evaluate(() => document.fonts.status)).toBe('loading');
    release();
    await finished;
    await page.waitForTimeout(800);
    await expect(status(page)).toHaveAttribute('data-demo-status', 'ready');
    expect(await asked(page)).toBe(layouts);
  });
});

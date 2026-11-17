import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

/* The cloudflare-studio block, through its docs demo, with real input: the spike's file upload built from nothing by hand,
   kept through a reload, exported, and at a phone's width. Each test has a browser context of its own, so nothing's saved
   to begin with. */

const panel = (page) => page.locator('[data-slot=cloudflare-panel]');
const service = (page, id) => page.locator(`[data-slot=diagram-node][data-node="${id}"]`);
/** Every service's card: a node that isn't the system's box or an environment's. */
const services = (page) => page.locator('[data-slot=diagram-node]:not([data-node^="cloudflare:"])');
/** The catalog search: its combobox, by name (the Combobox also renders a hidden form input). */
const catalogSearch = (page) => page.getByRole('combobox', { name: 'Search Cloudflare’s services' });
/** What's to be pressed or dragged, in view: a board opens at a readable size, from its top, so what's far down or across
 *  may be past its edge, and then the board's Fit shows it all, as a person would. */
const inView = async (page, locator) => {
  const board = await locator.evaluate((el) => {
    const b = el.closest('[data-slot=canvas]')?.getBoundingClientRect(), r = el.getBoundingClientRect();
    // Nor under what floats over the board: its toolbar, a frame's bar.
    const over = [...(el.closest('[data-slot=diagram-frame-board], [data-slot=diagram]')?.querySelectorAll('[data-slot=diagram-overlay] [data-slot=toolbar], [data-slot=diagram-frame-bar]') ?? [])].map((o) => o.getBoundingClientRect());
    const under = over.some((o) => r.left < o.right && r.right > o.left && r.top < o.bottom && r.bottom > o.top);
    return !b || (!under && r.left >= b.left && r.right <= b.right && r.top >= b.top && r.bottom <= b.bottom - 60);
  });
  if (board) return;
  // Its own board's Fit, where a page has more than one.
  await locator.locator('xpath=ancestor::*[@data-slot="diagram"][1]').locator('[data-slot=diagram-overlay] [data-action=fit]').first().click();
  // A fit glides there: what's pressed next is where it ends up.
  await settle(page);
};
const port = async (page, node, name) => {
  await inView(page, page.locator(`[data-slot=diagram-port][data-port-of="${node}"][data-port="${name}"]`));
  const b = await page.locator(`[data-slot=diagram-port][data-port-of="${node}"][data-port="${name}"]`).boundingBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};
const open = async (page) => {
  await page.goto('/?demo=blocks/cloudflare-studio&theme=light', { waitUntil: 'load' });
  await page.locator('[data-slot=cloudflare-studio]').waitFor({ timeout: 30_000 });
};
/** Until nothing's moved for a while: what has no place is laid out by ELK, again after each change. */
const settle = async (page) => {
  const where = () => page.locator('[data-slot=diagram-node]').evaluateAll((els) => els.map((el) => { const r = el.getBoundingClientRect(); return `${r.x},${r.y}`; }).join(' '));
  let before = await where();
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(150);
    const now = await where();
    if (now === before) return;
    before = now;
  }
};
const connect = async (page, a, ap, b, bp) => {
  const lines = await page.locator('[data-slot=diagram-edge]').count();
  await settle(page);
  // Bringing the second into view can move the first: where each is is read once both are in view.
  await port(page, a, ap);
  const to = await port(page, b, bp), from = await port(page, a, ap);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator('[data-slot=diagram-edge]')).toHaveCount(lines + 1);
};
/** A press on a service's name, which nothing's drawn over. */
const press = async (page, id) => {
  await settle(page);
  await inView(page, service(page, id).locator('[data-slot=diagram-node-title]').first());
  const box = await service(page, id).locator('[data-slot=diagram-node-title]').first().boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
};
/** A new connection's selected, and this names it on env. */
const bind = async (page, name) => {
  const field = panel(page).locator('[data-field="binding-name"]');
  await field.fill(name);
  await field.press('Enter');
  await expect(field).toHaveValue(name);
};
const add = async (page, kind) => {
  const search = catalogSearch(page);
  await search.fill(kind.replace('-', ' '));
  await page.locator(`[role=option][data-kind="${kind}"]`).click();
};
const rename = async (page, id, name) => {
  await press(page, id);
  const field = panel(page).locator('[data-field="label"]');
  await field.fill(name);
  await field.press('Enter');
  await expect(service(page, id)).toContainText(name);
};
/** No two edges run along each other for more than a crossing: each route sampled every 2 px, and no stretch of one longer
 *  than 24 px within a pixel of another's. */
const sharedRuns = (page) => page.locator('[data-slot=diagram-edge]').evaluateAll((els) => {
  const lines = els.map((el) => {
    const n = el.getTotalLength(), pts = [];
    for (let t = 0; t <= n; t += 2) { const p = el.getPointAtLength(t); pts.push([p.x, p.y]); }
    return { id: el.getAttribute('data-edge'), pts };
  });
  const out = [];
  for (const a of lines) for (const b of lines) {
    if (a.id >= b.id) continue;
    let run = 0, longest = 0;
    for (const [x, y] of a.pts) {
      const near = b.pts.some(([u, v]) => Math.abs(u - x) < 1 && Math.abs(v - y) < 1);
      run = near ? run + 2 : 0;
      longest = Math.max(longest, run);
    }
    if (longest > 24) out.push(`${a.id} and ${b.id}: ${longest} px`);
  }
  return out;
});
/** Each label is on a run of its own edge's route: its route passes through the label, and no other route does. In board
 *  units (a label's place is its style; a route's points are the board's), so it holds at any zoom, words drawn or not. */
const labelsOnTheirOwn = (page) => page.evaluate(() => {
  const out = [];
  const paths = [...document.querySelectorAll('[data-slot=diagram-edge]')];
  for (const label of document.querySelectorAll('[data-slot=diagram-edge-label]')) {
    const st = label.style, r = { left: parseFloat(st.left), top: parseFloat(st.top), right: parseFloat(st.left) + parseFloat(st.width), bottom: parseFloat(st.top) + parseFloat(st.height) };
    const through = paths.filter((p) => {
      const n = p.getTotalLength();
      for (let t = 0; t <= n; t += 2) {
        const q = p.getPointAtLength(t);
        if (q.x > r.left + 2 && q.x < r.right - 2 && q.y > r.top + 2 && q.y < r.bottom - 2) return true;
      }
      return false;
    }).map((p) => p.getAttribute('data-edge'));
    if (through.length !== 1 || through[0] !== label.getAttribute('data-edge')) out.push(`${label.getAttribute('data-edge')}: ${through.join(', ') || 'no route'}`);
  }
  return out;
});
const saved = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('cloudflare-studio') ?? 'null'));
const files = (page) => page.locator('[data-slot=cloudflare-studio-file]').evaluateAll((els) => els.map((el) => el.getAttribute('data-path')));
const fileText = (page, path) => page.locator(`[data-slot=cloudflare-studio-file][data-path="${path}"] [data-slot=cloudflare-studio-file-text]`).textContent();

test('the example’s connections each have a lane of their own, and each label is on its own', async ({ page }) => {
  await open(page);
  await expect(services(page)).toHaveCount(6);
  await page.locator('[data-slot=diagram-overlay] [data-action=fit]').first().click();
  await settle(page);
  await expect(page.locator('[data-slot=diagram-edge]')).toHaveCount(5);
  expect(await sharedRuns(page)).toEqual([]);
  expect(await labelsOnTheirOwn(page)).toEqual([]);
  // Nothing selected, the panel's closed, with its button on the bar.
  await expect(panel(page)).toBeHidden();
  await expect(page.locator('[data-slot=diagram-frame-bar] [data-diagram-frame-trigger]')).toHaveText('Add a service');
});

/** Labels outside the system's box (round 10's F2: JOBS on the root's header, no line into it). */
const labelsInTheSystem = (page) => page.evaluate(() => {
  const root = document.querySelector('[data-slot=diagram-node][data-node="cloudflare:system"]');
  if (!root) return ['no system'];
  const box = (el) => ({ left: parseFloat(el.style.left), top: parseFloat(el.style.top), right: parseFloat(el.style.left) + parseFloat(el.style.width), bottom: parseFloat(el.style.top) + parseFloat(el.style.height) });
  const r = box(root);
  return [...document.querySelectorAll('[data-slot=diagram-edge-label]')].flatMap((label) => {
    const l = box(label);
    return l.left >= r.left && l.right <= r.right && l.top >= r.top && l.bottom <= r.bottom ? [] : [`${label.getAttribute('data-edge')} is outside the system`];
  });
});

test('round 10’s F2: three services added and a connection made, every label stays on its own line, in the system', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page);
  await expect(services(page)).toHaveCount(6);
  await settle(page);
  const labels = () => page.locator('[data-slot=diagram-edge-label]').evaluateAll((els) => Object.fromEntries(els.map((el) => [el.getAttribute('data-edge'), `${el.style.left},${el.style.top}`])));
  const before = await labels();
  // The bar's button opens the panel on the catalog's search.
  await page.locator('[data-slot=diagram-frame-bar] [data-diagram-frame-trigger]').click();
  for (const kind of ['kv', 'd1', 'workers']) await add(page, kind);
  await expect(services(page)).toHaveCount(9);
  await settle(page);
  expect(await labelsOnTheirOwn(page)).toEqual([]);
  expect(await labelsInTheSystem(page)).toEqual([]);
  // The three adds went to free room: every label that was there is where it was.
  const added = await labels();
  for (const [id, at] of Object.entries(before)) expect(added[id], `${id}'s label stays`).toBe(at);
  await connect(page, 'api', 'env', 'kv', 'binding:kv_namespaces');
  await settle(page);
  expect(await labelsOnTheirOwn(page)).toEqual([]);
  expect(await sharedRuns(page)).toEqual([]);
  expect(await labelsInTheSystem(page)).toEqual([]);
});

test('the file upload, from nothing, by hand, kept through a reload, and exported', async ({ page }) => {
  test.setTimeout(120_000);
  await open(page);
  // It opens with the example, and New starts from nothing.
  await expect(services(page)).toHaveCount(6);
  await page.locator('[data-action=new]').click();
  await expect(services(page)).toHaveCount(0);
  const name = page.locator('input[aria-label="System name"]');
  await name.fill('File upload');
  for (const kind of ['workers', 'r2', 'queues', 'workers', 'd1', 'durable-objects']) await add(page, kind);
  await expect(services(page)).toHaveCount(6);
  for (const [id, label] of [['workers', 'API'], ['r2', 'Files'], ['queues', 'Jobs'], ['workers-2', 'Consumer'], ['d1', 'Uploads'], ['durable-objects', 'Room']]) await rename(page, id, label);
  await connect(page, 'workers', 'env', 'r2', 'binding:r2_buckets');
  await bind(page, 'FILES');
  await connect(page, 'workers', 'env', 'queues', 'binding:queues');
  await bind(page, 'JOBS');
  await connect(page, 'queues', 'sends:queue-consumer', 'workers-2', 'on:queue');
  // Halfway, a reload carries on where it was.
  await expect.poll(async () => (await saved(page))?.name).toBe('File upload');
  await page.reload({ waitUntil: 'load' });
  await page.locator('[data-slot=cloudflare-studio]').waitFor();
  await expect(services(page)).toHaveCount(6);
  await expect(name).toHaveValue('File upload');
  await expect(page.locator('[data-slot=diagram-edge]')).toHaveCount(3);
  await expect(service(page, 'workers-2')).toContainText('Consumer');
  await connect(page, 'workers-2', 'env', 'd1', 'binding:d1_databases');
  await bind(page, 'DB');
  await connect(page, 'workers-2', 'env', 'durable-objects', 'binding:durable_objects');
  await bind(page, 'ROOM');
  await expect(page.locator('[data-slot=diagram-edge]')).toHaveCount(5);
  // Room gets a machine, and the consumer tells it a file's ready.
  await press(page, 'durable-objects');
  await panel(page).locator('[data-action=add-machine]').click();
  await expect(page.locator('[data-state-diagram]')).toBeVisible();
  await page.locator('[data-slot=diagram-frame-cover-back]').click();
  const toRoom = await page.locator('[data-slot=diagram-edge]').evaluateAll((els) => els.map((el) => el.getAttribute('data-edge')).find((id) => /^workers-2.*durable/.test(id)));
  const line = await page.locator(`[data-slot=diagram-edge][data-edge="${toRoom}"]`).evaluate((el) => { const p = el.getPointAtLength(el.getTotalLength() / 2), m = el.getScreenCTM(); return { x: m.a * p.x + m.e, y: m.d * p.y + m.f }; });
  await page.mouse.click(line.x, line.y);
  const events = panel(page).locator('[data-field="events"]');
  await events.fill('FILE_READY');
  await events.press('Enter');
  // Its new machine doesn't receive that yet, and it says so.
  await expect(panel(page).locator('[data-slot=cloudflare-issue][data-code=event-not-received]')).toContainText('FILE_READY');

  await page.locator('[data-action=export]').click();
  await expect.poll(() => files(page)).toEqual(['system.json', 'api/wrangler.jsonc', 'consumer/wrangler.jsonc', 'machines/durable-objects.js']);
  const api = await fileText(page, 'api/wrangler.jsonc');
  expect(api).toContain('"name": "api"');
  expect(api).toMatch(/"r2_buckets": \[\s*\{ "binding": "FILES", "bucket_name": "Files" \}/);
  expect(api).toMatch(/"queues": \{\s*"producers": \[\s*\{ "binding": "JOBS", "queue": "Jobs" \}/);
  const consumer = await fileText(page, 'consumer/wrangler.jsonc');
  expect(consumer).toMatch(/"consumers": \[\s*\{ "queue": "Jobs" \}/);
  expect(consumer).toContain('{ "binding": "DB", "database_name": "Uploads" }');
  expect(consumer).toContain('"name": "ROOM"');
  await expect(page.locator('[data-slot=cloudflare-studio-file][data-path="consumer/wrangler.jsonc"] [data-slot=cloudflare-studio-needs]')).toContainText('migration');
  const machine = await fileText(page, 'machines/durable-objects.js');
  expect(machine).toContain("import { createMachine } from 'xstate';");
  expect(machine).toMatch(/"FILE_READY": "queue consumer"/);
  // A download is the file, with its folder in its name.
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('[data-slot=cloudflare-studio-file][data-path="system.json"] [data-action=download]').click(),
  ]);
  expect(download.suggestedFilename()).toBe('system.json');
  const system = JSON.parse(await readFile(await download.path(), 'utf8'));
  expect(system.services.map((s) => s.label)).toEqual(['API', 'Files', 'Jobs', 'Consumer', 'Uploads', 'Room']);
  expect(system.edges).toHaveLength(5);
  expect(JSON.parse((await saved(page)).system)).toEqual(system);
  const [config] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('[data-slot=cloudflare-studio-file][data-path="api/wrangler.jsonc"] [data-action=download]').click(),
  ]);
  expect(config.suggestedFilename()).toBe('api-wrangler.jsonc');
  expect(await readFile(await config.path(), 'utf8')).toBe(api);
});

test('a file that isn’t a system changes nothing and says why, and one that is opens', async ({ page }) => {
  await open(page);
  const input = page.locator('[data-slot=cloudflare-studio] input[type=file]');
  await input.setInputFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{ not json') });
  await expect(page.locator('[data-slot=cloudflare-studio-notes]')).toBeVisible();
  await expect(services(page)).toHaveCount(6);
  const big = { services: Array.from({ length: 60 }, (_, i) => ({ id: `w${i}`, kind: 'workers', label: `Worker ${i}`, at: { x: (i % 10) * 300, y: Math.floor(i / 10) * 200 } })), edges: [] };
  await input.setInputFiles({ name: 'big.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(big)) });
  await expect(page.locator('input[aria-label="System name"]')).toHaveValue('big');
  // Too big for the screen: it's all there, if not all drawn, and it all exports.
  await expect.poll(async () => JSON.parse((await saved(page)).system).services.length).toBe(60);
  await page.locator('[data-action=export]').click();
  await expect.poll(async () => (await files(page)).length).toBe(61);
});

test.describe('at a phone’s width', () => {
  test.use({ viewport: { width: 390, height: 780 } });

  test('the inspector’s a tray, the board fits, and it’s the same system wider', async ({ page }) => {
    await open(page);
    await expect(services(page)).toHaveCount(6);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await page.locator('[data-diagram-frame-trigger]').click();
    await expect(page.locator('[data-slot=diagram-frame][data-presentation=push] [data-slot=cloudflare-panel]')).toBeVisible();
    // An edit in the pushed panel, then wider with it still open: the edit's still there, and the inspector's a column
    // beside the board.
    await catalogSearch(page).fill('kv');
    await page.locator('[role=option][data-kind="kv"]').click();
    await expect(services(page)).toHaveCount(7);
    await page.setViewportSize({ width: 1100, height: 780 });
    await expect(services(page)).toHaveCount(7);
    // What's added is selected, and with something selected the inspector's a column beside the board.
    await expect(page.locator('[data-slot=diagram-frame][data-presentation=column] [data-slot=cloudflare-panel]')).toBeVisible();
    await page.setViewportSize({ width: 390, height: 780 });
    await expect(services(page)).toHaveCount(7);
    await page.locator('[data-action=export]').click();
    await expect.poll(() => files(page)).toContain('machines/room.js');
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });
});

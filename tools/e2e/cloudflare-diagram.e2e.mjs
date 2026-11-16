import { test, expect } from '@playwright/test';

/* CloudflareDiagram, through its docs demos, with real input. Not run in the 6.0 integration wave (no Playwright there):
   updated to the 6.0 parts and attributes by reading, so run it before trusting it. */

const panel = (page) => page.locator('[data-slot=cloudflare-panel]');
const service = (page, id) => page.locator(`[data-slot=diagram-node][data-node="${id}"]`);
const port = async (page, node, name) => {
  const b = await page.locator(`[data-slot=diagram-port][data-port-of="${node}"][data-port="${name}"]`).boundingBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};
const edges = (page) => page.locator('[data-demo-edges]').getAttribute('data-demo-edges');
const open = async (page, demo) => {
  await page.goto(`/?demo=cloudflare-diagram/${demo}&theme=light`, { waitUntil: 'load' });
  await page.locator('[data-slot=cloudflare-service]').first().waitFor({ timeout: 30_000 });
};
/** A real drag from one port to another, stopping over it to see what it offers. */
const drag = async (page, from, to, whileOver) => {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  const seen = whileOver ? await whileOver() : null;
  await page.mouse.up();
  return seen;
};
const connect = async (page, a, ap, b, bp, whileOver) => drag(page, await port(page, a, ap), await port(page, b, bp), whileOver);
/** A press on the middle of an edge's line. */
const pressOnEdge = async (page, id) => {
  const at = await page.locator(`[data-slot=diagram-edge][data-edge="${id}"]`).evaluate((el) => {
    const p = el.getPointAtLength(el.getTotalLength() / 2);
    const m = el.getScreenCTM();
    return { x: m.a * p.x + m.e, y: m.d * p.y + m.f };
  });
  await page.mouse.click(at.x, at.y);
};

test.describe('connecting', () => {
  test.beforeEach(async ({ page }) => { await open(page, 'connect'); });

  test('a Worker to R2 offers R2’s real methods, and uses the ones you choose', async ({ page }) => {
    await connect(page, 'worker', 'env', 'r2', 'binding:r2_buckets', async () => expect(page.locator('[data-slot=diagram-connection]')).toHaveAttribute('data-valid', 'true'));
    await expect.poll(() => edges(page)).toBe('worker>r2:r2_buckets:R2_BUCKET');
    // It's selected, with what's on offer.
    const offered = panel(page).locator('[data-operation]');
    await expect(offered).toHaveCount(7);
    expect(await offered.evaluateAll((els) => els.map((el) => el.getAttribute('data-operation')))).toEqual(['createMultipartUpload', 'delete', 'get', 'head', 'list', 'put', 'resumeMultipartUpload']);
    await expect(panel(page).locator('[data-operation=put]')).toContainText('put(key, value, options)');
    await panel(page).getByRole('checkbox', { name: /^put\(/ }).click();
    await panel(page).getByRole('checkbox', { name: /^get\(/ }).click();
    await expect.poll(() => edges(page)).toBe('worker>r2:r2_buckets:R2_BUCKET:get+put');
    await expect(page.locator('[data-slot=diagram-edge-label]', { hasText: 'R2_BUCKET: get, put' })).toHaveCount(1);
    // It's named on env, and can be renamed, and not to what isn't a name.
    const name = page.locator('[data-field="binding-name"]');
    await expect(name).toHaveValue('R2_BUCKET');
    await name.fill('not a name');
    await name.press('Enter');
    await expect(page.locator('[data-slot=cloudflare-refusal]')).toContainText('can’t be a name on env');
    await expect(name).toHaveValue('R2_BUCKET');
    await name.fill('FILES');
    await name.press('Enter');
    await expect.poll(() => edges(page)).toBe('worker>r2:r2_buckets:FILES:get+put');
    await expect(page.locator('[data-slot=cloudflare-refusal]')).toHaveCount(0);
    // The route ends at the dots.
    const line = page.locator('[data-slot=diagram-edge][data-edge="worker-r2_buckets"]');
    const ends = await line.evaluate((el) => {
      const m = el.getScreenCTM(), a = el.getPointAtLength(0), b = el.getPointAtLength(el.getTotalLength());
      return [{ x: m.a * a.x + m.e, y: m.d * a.y + m.f }, { x: m.a * b.x + m.e, y: m.d * b.y + m.f }];
    });
    const from = await port(page, 'worker', 'env'), to = await port(page, 'r2', 'binding:r2_buckets');
    expect(Math.hypot(ends[0].x - from.x, ends[0].y - from.y)).toBeLessThan(2);
    expect(Math.hypot(ends[1].x - to.x, ends[1].y - to.y)).toBeLessThan(2);
  });

  test('only compatible ports connect, and the others say why', async ({ page }) => {
    const status = page.locator('[data-slot=diagram-status]');
    // What doesn't run code has nothing to bind with, so R2's events can't go to D1.
    await connect(page, 'r2', 'out:events', 'd1', 'binding:d1_databases', async () => {
      await expect(page.locator('[data-slot=diagram-connection]')).toHaveAttribute('data-valid', 'false');
      await expect(status).toContainText('through a Queue');
    });
    expect(await edges(page)).toBe('');
    // A binding can't call a handler.
    await connect(page, 'worker', 'env', 'consumer', 'on:queue', async () => {
      await expect(page.locator('[data-slot=diagram-connection]')).toHaveAttribute('data-valid', 'false');
      await expect(status).toContainText('Something has to send it there');
    });
    expect(await edges(page)).toBe('');
    // A Queue's messages go to a queue handler, and nowhere else.
    await connect(page, 'queue', 'sends:queue-consumer', 'consumer', 'on:fetch', async () => {
      await expect(status).toContainText('queue handler');
    });
    expect(await edges(page)).toBe('');
    await connect(page, 'queue', 'sends:queue-consumer', 'consumer', 'on:queue');
    await expect.poll(() => edges(page)).toBe('queue>consumer:queue-consumer');
    // R2's events do go to a Queue, and it offers what they are.
    await connect(page, 'r2', 'out:events', 'queue', 'events');
    await expect.poll(() => edges(page)).toContain('r2>queue:events');
    await expect(panel(page).locator('[data-operation=object-create]')).toHaveCount(1);
    await expect(panel(page).locator('[data-operation="cf.r2.bucket.created"]')).toHaveCount(1);
  });

  test('two of the same binding type, each with a name of its own', async ({ page }) => {
    await connect(page, 'worker', 'env', 'r2', 'binding:r2_buckets');
    await expect.poll(() => edges(page)).toBe('worker>r2:r2_buckets:R2_BUCKET');
    await connect(page, 'worker', 'env', 'r2', 'binding:r2_buckets');
    await expect.poll(() => edges(page)).toBe('worker>r2:r2_buckets:R2_BUCKET worker>r2:r2_buckets:R2_BUCKET_2');
    // A name that's taken is refused.
    const name = page.locator('[data-field="binding-name"]');
    await expect(name).toHaveValue('R2_BUCKET_2');
    await name.fill('R2_BUCKET');
    await name.press('Enter');
    await expect(page.locator('[data-slot=cloudflare-refusal]')).toContainText('already a binding');
    expect(await edges(page)).toBe('worker>r2:r2_buckets:R2_BUCKET worker>r2:r2_buckets:R2_BUCKET_2');
    // Another Worker can use the same name for its own.
    await connect(page, 'consumer', 'env', 'r2', 'binding:r2_buckets');
    await expect.poll(() => edges(page)).toContain('consumer>r2:r2_buckets:R2_BUCKET');
  });

  // Every service here has a place, so both bindings' routes come from the same two ports, and they're one line.
  test('connections on one line can each be pressed, on the line and on their labels', async ({ page }) => {
    for (let i = 0; i < 3; i++) await connect(page, 'worker', 'env', 'r2', 'binding:r2_buckets');
    await expect.poll(() => edges(page)).toBe('worker>r2:r2_buckets:R2_BUCKET worker>r2:r2_buckets:R2_BUCKET_2 worker>r2:r2_buckets:R2_BUCKET_3');
    const lines = page.locator('[data-slot=diagram-edge]');
    expect(new Set(await lines.evaluateAll((els) => els.map((el) => el.getAttribute('d')))).size).toBe(1);
    const name = page.locator('[data-field="binding-name"]');
    const selectedEdges = () => page.locator('[data-slot=diagram-edge][data-selected=true]').evaluateAll((els) => els.map((el) => el.getAttribute('data-edge')));
    // Pressing the same place on the line goes to each in turn, and back round.
    const ids = await lines.evaluateAll((els) => els.map((el) => el.getAttribute('data-edge')));
    const seen = [];
    for (let i = 0; i < 4; i++) {
      await pressOnEdge(page, ids[0]);
      await expect(name).toHaveCount(1);
      seen.push(await name.inputValue());
      expect(await selectedEdges()).toHaveLength(1);
    }
    expect(new Set(seen.slice(0, 3)).size).toBe(3);
    expect(seen[3]).toBe(seen[0]);
    // Each label selects its own.
    for (const binding of ['R2_BUCKET', 'R2_BUCKET_2', 'R2_BUCKET_3']) {
      const label = await page.locator('[data-slot=diagram-edge-label]', { hasText: new RegExp(`^${binding}$`) }).boundingBox();
      await page.mouse.click(label.x + label.width / 2, label.y + label.height / 2);
      await expect(name).toHaveValue(binding);
    }
    // Moving a service with one selected, they're still one line after, and a press still goes from one to the next.
    const r2 = await service(page, 'r2').boundingBox();
    await page.mouse.move(r2.x + 60, r2.y + 14);
    await page.mouse.down();
    await page.mouse.move(r2.x + 120, r2.y + 74, { steps: 8 });
    await page.mouse.up();
    await pressOnEdge(page, ids[0]);
    await expect(name).toHaveCount(1);
    const first = await name.inputValue();
    await pressOnEdge(page, ids[0]);
    await expect(name).not.toHaveValue(first);
    expect(new Set(await lines.evaluateAll((els) => els.map((el) => el.getAttribute('d')))).size).toBe(1);
  });

  test('a service with no binding, like a dashboard feature, is there, and can’t be connected', async ({ page }) => {
    const dlp = service(page, 'dlp');
    const b = await dlp.boundingBox();
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    await expect(panel(page).locator('[data-slot=cloudflare-no-ports]')).toContainText('no binding');
    await expect(panel(page).locator('[data-slot=cloudflare-description]')).toContainText('Scan your web traffic');
    await expect(page.locator('[data-slot=diagram-port][data-port-of=dlp]')).toHaveCount(0);
    // A Worker can't reach it, and says so.
    const from = await port(page, 'worker', 'env');
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    const again = await dlp.boundingBox();
    await page.mouse.move(again.x + again.width / 2, again.y + again.height / 2, { steps: 8 });
    await page.mouse.up();
    expect(await edges(page)).toBe('');
    // And nothing can be started from it.
    await page.mouse.move(again.x + 2, again.y + again.height / 2);
    await page.mouse.down();
    await page.mouse.move(again.x - 100, again.y, { steps: 4 });
    await expect(page.locator('[data-slot=diagram-connection]')).toHaveCount(0);
    await page.mouse.up();
  });

  test('moving a service keeps its place, its connections follow, and it all undoes', async ({ page }) => {
    await connect(page, 'worker', 'env', 'r2', 'binding:r2_buckets');
    await expect.poll(() => edges(page)).toContain('worker>r2');
    const before = await service(page, 'r2').boundingBox();
    await page.mouse.move(before.x + 60, before.y + 14);
    await page.mouse.down();
    await page.mouse.move(before.x + 160, before.y + 94, { steps: 8 });
    await page.mouse.up();
    await expect.poll(async () => (await service(page, 'r2').boundingBox()).x).toBeGreaterThan(before.x + 50);
    const moved = await service(page, 'r2').boundingBox();
    const to = await port(page, 'r2', 'binding:r2_buckets');
    expect(to.x).toBeCloseTo(moved.x, 0);
    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(async () => (await service(page, 'r2').boundingBox()).x).toBeLessThan(moved.x);
    // Deleting takes what's connected to it, and undoes too.
    const r2 = await service(page, 'r2').boundingBox();
    await page.mouse.click(r2.x + 60, r2.y + 14);
    await page.keyboard.press('Delete');
    await expect(service(page, 'r2')).toHaveCount(0);
    expect(await edges(page)).toBe('');
    await page.keyboard.press('ControlOrMeta+z');
    await expect(service(page, 'r2')).toHaveCount(1);
    await expect.poll(() => edges(page)).toContain('worker>r2');
  });

  test('the panel does what the keys do', async ({ page }) => {
    await connect(page, 'worker', 'env', 'd1', 'binding:d1_databases');
    await expect.poll(() => edges(page)).toContain('worker>d1');
    await panel(page).locator('[data-action=delete]').click();
    await expect.poll(() => edges(page)).toBe('');
    const r2 = await service(page, 'r2').boundingBox();
    await page.mouse.click(r2.x + 60, r2.y + 14);
    const label = page.locator('[data-field="label"]');
    await label.fill('Uploads');
    await label.press('Enter');
    await expect(service(page, 'r2').locator('[data-slot=cloudflare-service-name]')).toHaveText('Uploads');
    await panel(page).locator('[data-action=delete]').click();
    await expect(service(page, 'r2')).toHaveCount(0);
    // Undo goes back through what the panel did, too, one at a time.
    await page.locator('[data-action=undo]').click();
    await expect(service(page, 'r2').locator('[data-slot=cloudflare-service-name]')).toHaveText('Uploads');
    await page.locator('[data-action=undo]').click();
    await expect(service(page, 'r2').locator('[data-slot=cloudflare-service-name]')).toHaveText('R2');
    await page.locator('[data-action=redo]').click();
    await expect(service(page, 'r2').locator('[data-slot=cloudflare-service-name]')).toHaveText('Uploads');
  });
});

test.describe('drawing', () => {
  test('a whole system, laid out, with its connections on the right ports', async ({ page }) => {
    await open(page, 'upload');
    await expect(page.locator('[data-slot=cloudflare-service]')).toHaveCount(6);
    await expect(page.locator('[data-slot=diagram-edge]')).toHaveCount(6);
    await expect(service(page, 'api').locator('[data-slot=cloudflare-service-name]')).toHaveText('API');
    await expect(page.locator('[data-slot=diagram-edge-label]', { hasText: 'FILES: put, get' })).toHaveCount(1);
    await pressOnEdge(page, 'api-files');
    await expect(panel(page).locator('[data-operation]')).toHaveCount(7);
    await expect(panel(page).locator('[data-slot=cloudflare-binding-name]')).toContainText('FILES');
    // Read-only, so it says and doesn't offer.
    await expect(panel(page).locator('input')).toHaveCount(0);
    await expect(panel(page).locator('[data-action=delete]')).toHaveCount(0);
    await expect(panel(page).locator('[data-slot=cloudflare-attribution]')).toContainText('CC-BY-4.0');
    // A service says what it is, with a link to Cloudflare's own page.
    const box = await service(page, 'files').boundingBox();
    await page.mouse.click(box.x + 60, box.y + 14);
    await expect(panel(page).locator('[data-slot=cloudflare-docs-link]')).toHaveAttribute('href', 'https://developers.cloudflare.com/r2/');
    await expect(panel(page).locator('[data-slot=cloudflare-reached-by]')).toContainText('R2 Bucket');
  });

  test('every service in the catalog can be placed', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto('/?demo=cloudflare-diagram/every-service&theme=light', { waitUntil: 'load' });
    await expect.poll(() => page.locator('[data-slot=cloudflare-service]').count(), { timeout: 60_000 }).toBe(101);
    expect(await page.locator('[data-slot=cloudflare-service][data-kind=flagship]').count()).toBe(1);
    expect(errors).toEqual([]);
    // Nothing's connected, so they're in rows, and not in one long column you can't read at all.
    const boxes = await page.locator('[data-slot=diagram-node]').evaluateAll((els) => els.map((el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, r: r.right, b: r.bottom }; }));
    const wide = Math.max(...boxes.map((b) => b.r)) - Math.min(...boxes.map((b) => b.x));
    const high = Math.max(...boxes.map((b) => b.b)) - Math.min(...boxes.map((b) => b.y));
    expect(wide / high).toBeGreaterThan(0.8);
  });

  test('there’s no artwork: only the library’s icons', async ({ page }) => {
    await open(page, 'upload');
    const images = await page.locator('[data-cloudflare-diagram] img, [data-cloudflare-diagram] image').count();
    expect(images).toBe(0);
  });
});

test.describe('only to read', () => {
  test('it says what things are, and offers no way to change them', async ({ page }) => {
    await open(page, 'upload');
    const none = async () => {
      for (const what of ['[data-action=delete]', '[data-action=undo]', '[data-action=redo]', '[data-field]', '[data-slot=cloudflare-search]']) await expect(page.locator(what)).toHaveCount(0);
    };
    await none();
    const box = await service(page, 'files').boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + 10);
    await expect(panel(page).locator('[data-slot=cloudflare-description]')).toBeVisible();
    await none();
    // Nothing to drag from, and pressing Delete doesn't do anything.
    await page.keyboard.press('Delete');
    await expect(service(page, 'files')).toHaveCount(1);
    await pressOnEdge(page, 'api-files');
    await expect(panel(page).locator('[data-operation]').first()).toBeVisible();
    await expect(panel(page).locator('input')).toHaveCount(0);
    await expect(panel(page).locator('[data-slot=cloudflare-binding-name]')).toContainText('FILES');
    await none();
  });

  test('a machine opens to read and run, and not to change', async ({ page }) => {
    await open(page, 'upload');
    const box = await service(page, 'room').boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + 10);
    await expect(panel(page).locator('[data-action=remove-machine]')).toHaveCount(0);
    await panel(page).locator('[data-action=open-machine]').click();
    await expect(page.locator('[data-slot=state-diagram] [data-slot=diagram-node][data-node="room.empty"]')).toHaveCount(1);
    await expect(page.locator('[data-slot=edit-add-state]')).toHaveCount(0);
    await expect(page.locator('[data-slot=simulation-event]').first()).toBeVisible();
    await page.locator('[data-action=machine-back]').click();
    await expect(panel(page).locator('[data-action=open-machine]')).toBeFocused();
    // Nothing that doesn't have one offers one.
    const api = await service(page, 'api').boundingBox();
    await page.mouse.click(api.x + api.width / 2, api.y + 10);
    await expect(panel(page).locator('[data-action=add-machine]')).toHaveCount(0);
  });
});

test.describe('a system', () => {
  const json = async (page) => JSON.parse(await page.locator('[data-demo-json]').inputValue());
  const press = async (page, id) => {
    const box = await service(page, id).boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + 10);
  };
  const issues = (page) => panel(page).locator('[data-slot=cloudflare-issue]');
  const issueCodes = (page) => issues(page).evaluateAll((els) => els.map((el) => el.getAttribute('data-code')));
  test.beforeEach(async ({ page }) => { await open(page, 'system'); });

  test('a search of the catalog adds a service', async ({ page }) => {
    const search = page.locator('[data-slot=cloudflare-search] input');
    await search.fill('zzzzzz');
    await expect(page.getByText('Nothing matches')).toBeVisible();
    await search.fill('kv');
    const first = page.getByRole('option').first();
    await expect(first).toContainText('KV');
    await first.click();
    await expect(service(page, 'kv')).toHaveCount(1);
    await expect.poll(async () => (await json(page)).services.map((s) => s.kind)).toContain('kv');
    // It's selected, and there's room to add another straight away.
    await expect(panel(page).locator('[data-slot=cloudflare-description]')).toBeVisible();
    await expect(search).toBeFocused();
    await expect(search).toHaveValue('');
    // Enter takes the first, and a second of a kind has an id of its own.
    await search.fill('kv');
    await search.press('Enter');
    await expect(service(page, 'kv-2')).toHaveCount(1);
    // The results are there to get to by keyboard, and to choose from.
    await search.fill('queues');
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('[role=option][data-highlighted]').first()).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(service(page, 'queues')).toHaveCount(1);
    for (const gone of ['queues', 'kv-2', 'kv']) {
      await page.locator('[data-action=undo]').click();
      await expect(service(page, gone)).toHaveCount(0);
    }
  });

  test('what’s added comes into view, wherever the board had been moved to', async ({ page }) => {
    const board = await page.locator('[data-slot=canvas]').first().boundingBox();
    // Away from where it'll go, by dragging the view with the space key held.
    await page.keyboard.down('Space');
    await page.mouse.move(board.x + 200, board.y + 200);
    await page.mouse.down();
    await page.mouse.move(board.x + board.width - 20, board.y + 200, { steps: 6 });
    await page.mouse.up();
    await page.keyboard.up('Space');
    const search = page.locator('[data-slot=cloudflare-search] input');
    await search.fill('d1');
    await search.press('Enter');
    await expect(service(page, 'd1')).toHaveCount(1);
    await expect.poll(async () => {
      const b = await service(page, 'd1').boundingBox();
      return b.x >= board.x && b.x + b.width <= board.x + board.width && b.y >= board.y && b.y + b.height <= board.y + board.height;
    }).toBe(true);
  });

  test('a connection has to be real, or it says why not, and what crosses it has to be received', async ({ page }) => {
    await expect(issues(page)).toHaveCount(0);
    await pressOnEdge(page, 'tell-room');
    const field = page.locator('[data-field="events"]');
    await expect(field).toHaveValue('FILE_READY');
    await expect(panel(page).locator('[data-slot=cloudflare-receivable]')).toContainText('FILE_READY, VIEWER_JOINED, VIEWER_LEFT');
    await field.fill('FILE_READY, NOT_THIS');
    await field.press('Enter');
    await expect.poll(() => issueCodes(page)).toEqual(['event-not-received']);
    await expect(issues(page).first()).toContainText('Consumer sends NOT_THIS to Room, whose machine doesn’t receive it.');
    await expect(panel(page).locator('[data-slot=cloudflare-event-problem]')).toContainText('NOT_THIS');
    const line = page.locator('[data-slot=diagram-edge][data-edge=tell-room]');
    await expect(line).toHaveAttribute('data-kind', 'problem');
    // It looks wrong, and in more than its color: selected, it's the selection's, so that's looked at with it let go, below.
    expect((await json(page)).edges.find((e) => e.id === 'tell-room').events).toEqual(['FILE_READY', 'NOT_THIS']);
    await press(page, 'api');
    const look = () => line.evaluate((el) => { const c = getComputedStyle(el); return { dashed: c.strokeDasharray !== 'none', marker: el.getAttribute('marker-end'), stroke: c.stroke }; });
    const wrong = await look();
    expect(wrong.dashed).toBe(true);
    expect(wrong.marker).toMatch(/-problem\)$/);
    const plain = await page.locator('[data-slot=diagram-edge][data-edge=upload]').evaluate((el) => getComputedStyle(el).stroke);
    expect(wrong.stroke).not.toBe(plain);
    // It gets you to what it's about.
    await expect(panel(page).locator('[data-slot=cloudflare-events]')).toHaveCount(0);
    await issues(page).first().locator('[data-action=show-issue]').click();
    await expect(field).toHaveValue('FILE_READY, NOT_THIS');
    await field.fill('');
    await field.press('Enter');
    await expect(issues(page)).toHaveCount(0);
    await expect(page.locator('[data-slot=diagram-edge][data-edge=tell-room]')).toHaveAttribute('data-kind', 'event');
    expect((await json(page)).edges.find((e) => e.id === 'tell-room').events).toBeUndefined();
    // Through what has no machine, to the first that has: a Queue, then a consumer, then Room.
    await pressOnEdge(page, 'enqueue');
    await panel(page).locator('[data-field="events"]').fill('NOPE');
    await panel(page).locator('[data-field="events"]').press('Enter');
    await expect(issues(page).first()).toHaveText(/API sends NOPE to Room, whose machine doesn’t receive it\./);
    await panel(page).locator('[data-field="events"]').fill('VIEWER_JOINED');
    await panel(page).locator('[data-field="events"]').press('Enter');
    await expect(issues(page)).toHaveCount(0);
    // And with nothing past it at all, it could be fine, or not finished yet.
    await pressOnEdge(page, 'upload');
    await panel(page).locator('[data-field="events"]').fill('HELLO');
    await panel(page).locator('[data-field="events"]').press('Enter');
    await expect(issues(page).first()).toContainText('no machine past there');
    await expect(issues(page).first()).toHaveAttribute('data-severity', 'warning');
    await expect(page.locator('[data-slot=diagram-edge][data-edge=upload]')).toHaveAttribute('data-kind', 'event');
  });

  test('a machine that sends to a service that’s been deleted says so, and undoing brings it back', async ({ page }) => {
    await press(page, 'room');
    await panel(page).locator('[data-action=delete]').click();
    await expect(service(page, 'room')).toHaveCount(0);
    await expect(issues(page)).toHaveCount(1);
    await expect(issues(page).first()).toContainText('Consumer sends to room, which isn’t in this system. It carries FILE_READY.');
    await expect(page.locator('[data-slot=diagram-edge][data-edge=tell-room]')).toHaveCount(0);
    expect((await json(page)).edges.map((e) => e.id)).toContain('tell-room');
    // Moving something else leaves it there, as it isn't the board's to lose.
    const box = await service(page, 'api').boundingBox();
    await page.mouse.move(box.x + 40, box.y + 12);
    await page.mouse.down();
    await page.mouse.move(box.x + 40, box.y + 50, { steps: 4 });
    await page.mouse.up();
    await expect.poll(async () => (await json(page)).services.find((s) => s.id === 'api').at.y).toBeGreaterThan(40);
    expect((await json(page)).edges.map((e) => e.id)).toContain('tell-room');
    await page.locator('[data-action=undo]').click();
    await page.locator('[data-action=undo]').click();
    await expect(service(page, 'room')).toHaveCount(1);
    await expect(issues(page)).toHaveCount(0);
    await expect(page.locator('[data-slot=diagram-edge][data-edge=tell-room]')).toHaveCount(1);
    // With the Delete key, it's the same, and it can be let go.
    await press(page, 'room');
    await page.keyboard.press('Delete');
    await expect(issues(page)).toHaveCount(1);
    await panel(page).locator('[data-action=remove-edge]').click();
    await expect(issues(page)).toHaveCount(0);
    expect((await json(page)).edges.map((e) => e.id)).not.toContain('tell-room');
    // One that carries nothing just goes.
    await press(page, 'files');
    await page.keyboard.press('Delete');
    await expect(issues(page)).toHaveCount(0);
    expect((await json(page)).edges.map((e) => e.id)).not.toContain('upload');
  });

  test('a machine opens in a StateDiagram, and what’s done to it there is checked out here', async ({ page }) => {
    await expect(service(page, 'room').locator('[data-part=machine]')).toHaveText('machine');
    await expect(service(page, 'api').locator('[data-part=machine]')).toHaveCount(0);
    await press(page, 'room');
    await expect(panel(page).locator('[data-slot=cloudflare-machine-receives]')).toHaveText('Receives: FILE_READY, VIEWER_JOINED, VIEWER_LEFT');
    await panel(page).locator('[data-action=open-machine]').click();
    await expect(page.locator('[data-slot=state-diagram]')).toBeVisible();
    await expect(page.locator('[data-slot=state-diagram] [data-slot=diagram-node][data-node="room.empty"]')).toHaveCount(1);
    await expect(page.locator('[data-action=machine-back]')).toBeFocused();
    await expect(page.locator('[data-slot=cloudflare-machine-bar]')).toContainText('Room’s machine');
    // The board and its panel are out of reach underneath, and as they were.
    await expect(page.locator('[data-cloudflare-diagram] > [inert] [data-slot=diagram-node][data-node=room]')).toHaveCount(1);
    await expect(page.locator('[data-cloudflare-diagram] > [inert] [data-action=open-machine]')).toHaveCount(1);
    // Renaming the event that's sent there means nothing receives it now.
    await page.locator('[data-slot=state-diagram] [data-slot=diagram-edge-label]', { hasText: 'FILE_READY' }).first().waitFor();
    const line = page.locator('[data-slot=state-diagram] [data-slot=diagram-edge][data-edge*="FILE_READY"]');
    await pressOnEdge(page, await line.getAttribute('data-edge'));
    const name = page.locator('[data-slot=edit-event] input');
    await name.fill('RENAMED');
    await name.press('Enter');
    await expect.poll(async () => JSON.stringify((await json(page)).services.find((s) => s.id === 'room').machine)).toContain('RENAMED');
    await page.locator('[data-action=machine-back]').click();
    await expect(page.locator('[data-slot=state-diagram]')).toHaveCount(0);
    await expect(panel(page).locator('[data-action=open-machine]')).toBeFocused();
    await expect.poll(() => issueCodes(page)).toEqual(['event-not-received']);
    await expect(panel(page).locator('[data-slot=cloudflare-machine-receives]')).toContainText('RENAMED');
    // It's one history.
    await page.locator('[data-action=undo]').click();
    await expect(issues(page)).toHaveCount(0);
    await expect(panel(page).locator('[data-slot=cloudflare-machine-receives]')).toContainText('FILE_READY');
  });

  test('a service can be given a machine, and only something that runs code', async ({ page }) => {
    await press(page, 'files');
    await expect(panel(page).locator('[data-action=add-machine]')).toHaveCount(0);
    await press(page, 'consumer');
    await panel(page).locator('[data-action=add-machine]').click();
    await expect(page.locator('[data-slot=state-diagram] [data-slot=diagram-node][data-node="consumer.idle"]')).toHaveCount(1);
    await page.locator('[data-action=machine-back]').click();
    await expect(service(page, 'consumer').locator('[data-part=machine]')).toHaveCount(1);
    await panel(page).locator('[data-action=remove-machine]').click();
    await expect(service(page, 'consumer').locator('[data-part=machine]')).toHaveCount(0);
    // Without its machine there, Room still has its own.
    await expect(issues(page)).toHaveCount(0);
  });

  test('it saves and loads as JSON', async ({ page }) => {
    const before = await page.locator('[data-demo-json]').inputValue();
    await page.locator('[data-demo-load]').click();
    await expect(page.locator('[data-demo-load-issues]')).toHaveCount(0);
    expect(await page.locator('[data-demo-json]').inputValue()).toBe(before);
    await expect(service(page, 'room')).toHaveCount(1);
    // Changed in the text, it changes on the board.
    const next = JSON.parse(before);
    next.services.find((s) => s.id === 'api').label = 'Front door';
    await page.locator('[data-demo-json]').fill(JSON.stringify(next));
    await page.locator('[data-demo-load]').click();
    await expect(service(page, 'api').locator('[data-slot=cloudflare-service-name]')).toHaveText('Front door');
  });

  test('what’s undone is only what was done here, and something loaded starts over', async ({ page }) => {
    await press(page, 'jobs');
    await panel(page).locator('[data-action=delete]').click();
    await expect(page.locator('[data-action=undo]')).toBeEnabled();
    await page.locator('[data-demo-load]').click();
    await expect(page.locator('[data-action=undo]')).toBeDisabled();
  });

  test('a hand-edited file with something wrong in it says what, and doesn’t break anything', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    const load = async (text) => {
      await page.locator('[data-demo-json]').fill(text);
      await page.locator('[data-demo-load]').click();
    };
    const loaded = () => page.locator('[data-demo-load-issues] li').evaluateAll((els) => els.map((el) => el.getAttribute('data-code')));
    // Not JSON, or not a system: nothing changes.
    await load('{ "services": [');
    await expect.poll(loaded).toEqual(['json']);
    await expect(service(page, 'room')).toHaveCount(1);
    await load('[1, 2]');
    await expect.poll(loaded).toEqual(['shape']);
    await expect(service(page, 'room')).toHaveCount(1);
    // Partly right: what's usable is drawn, and everything else is said.
    await load(JSON.stringify({
      services: [
        { id: 'a', kind: 'workers', at: { x: 0, y: 0 } },
        { id: 'a', kind: 'r2' },
        { kind: 'r2' },
        'nope',
        { id: 'b', kind: 'r2', at: { x: 'left', y: 3 }, extra: true },
        { id: 'c', kind: 'not-a-real-thing', machine: 'nope', at: { x: 0, y: 300 } },
        { id: 'broken', kind: 'workers', machine: { initial: 'nowhere', states: { a: {} } }, at: { x: 700, y: 0 } },
      ],
      edges: [{ from: 'a', to: 'b', via: 'made_up' }, { from: 'a', to: 'b', via: 'r2_buckets', binding: 'has spaces', operations: ['teleport'] }, { from: 'a', to: 'ghost', via: 'r2_buckets', binding: 'G', events: ['HELLO'] }, { from: 'a', to: 'ghost2', via: 'r2_buckets', binding: 'H' }, { from: 'a' }],
      version: 2,
    }));
    await expect.poll(async () => (await loaded()).length).toBeGreaterThan(5);
    expect(await loaded()).toEqual(expect.arrayContaining(['service-duplicate', 'service-shape', 'service-field', 'unknown-field', 'edge-shape']));
    await expect(service(page, 'a')).toHaveCount(1);
    await expect(service(page, 'b')).toHaveCount(1);
    await expect(service(page, 'room')).toHaveCount(0);
    await expect.poll(() => issueCodes(page)).toEqual(expect.arrayContaining(['unknown-kind', 'edge-not-real', 'operation', 'binding-name', 'edge-end', 'machine']));
    await expect(page.locator('[data-slot=diagram-edge][data-edge=a-made_up]')).toHaveAttribute('data-kind', 'problem');
    // What's wrong with a service gets you to it too, and it's drawn as wrong.
    await panel(page).locator('[data-slot=cloudflare-issue][data-code=machine] [data-action=show-issue]').click();
    await expect(service(page, 'broken').locator('[data-slot=cloudflare-service]')).toHaveAttribute('data-problem', 'true');
    await expect(service(page, 'a').locator('[data-slot=cloudflare-service]')).not.toHaveAttribute('data-problem', 'true');
    // A machine that won't draw says why, on the service, and when it's opened.
    await expect(panel(page).locator('[data-slot=cloudflare-machine-problem]')).toContainText('nowhere');
    await panel(page).locator('[data-action=open-machine]').click();
    await expect(page.locator('[data-slot=state-diagram]')).toContainText('nowhere');
    await page.locator('[data-action=machine-back]').click();
    await expect(service(page, 'broken')).toHaveCount(1);
    // What can't be drawn isn't the board's to lose, carrying events or not.
    const before = await issues(page).filter({ hasText: 'ghost' }).count();
    expect(before).toBe(2);
    const box = await service(page, 'a').boundingBox();
    await page.mouse.move(box.x + 40, box.y + 12);
    await page.mouse.down();
    await page.mouse.move(box.x + 40, box.y + 60, { steps: 4 });
    await page.mouse.up();
    await expect.poll(async () => (await json(page)).services.find((s) => s.id === 'a').at.y).toBeGreaterThan(0);
    await expect(issues(page).filter({ hasText: 'ghost' })).toHaveCount(2);
    expect((await json(page)).edges.map((e) => e.to).filter((t) => t === 'ghost' || t === 'ghost2').sort()).toEqual(['ghost', 'ghost2']);
    expect(errors.filter((e) => !/Failed to load resource/.test(e))).toEqual([]);
  });

  test('a machine that’s nothing like one, in a hand-edited file, doesn’t break anything', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    const shapes = [
      { states: 3 },
      { initial: 'a', states: { a: 3 } },
      { on: 'x' },
      { initial: 'a', states: { a: { on: { GO: { target: 5 } } } } },
      { type: 'parallel', states: {} },
      { id: 5, initial: 'a', states: { a: {} } },
      { initial: 'a', states: { a: { invoke: { src: 7 } } } },
      { initial: 'a', states: { a: { after: { soon: 'a' } } } },
      { initial: 'a', states: { a: { always: 'nope' } } },
      { initial: ['a'], states: { a: {} } },
      {},
    ];
    for (const machine of shapes) {
      await page.locator('[data-demo-json]').fill(JSON.stringify({ services: [{ id: 'm', kind: 'workers', machine, at: { x: 0, y: 0 } }, { id: 'w', kind: 'workers', at: { x: 400, y: 0 } }], edges: [{ from: 'w', to: 'm', via: 'services', binding: 'M', events: ['GO'] }] }));
      await page.locator('[data-demo-load]').click();
      await expect(service(page, 'w')).toHaveCount(1);
      await press(page, 'm');
      await panel(page).locator('[data-action=open-machine]').click();
      await expect(page.locator('[data-slot=state-diagram]'), JSON.stringify(machine)).toBeVisible();
      await page.locator('[data-action=machine-back]').click();
      await expect(page.locator('[data-slot=state-diagram]'), JSON.stringify(machine)).toHaveCount(0);
      await expect(service(page, 'm'), JSON.stringify(machine)).toHaveCount(1);
    }
    expect(errors).toEqual([]);
  });

  test('a place that’s nowhere near anything is left out, and the rest can still be seen', async ({ page }) => {
    await page.locator('[data-demo-json]').fill(JSON.stringify({ services: [{ id: 'far', kind: 'r2', at: { x: 1e308, y: -1e308 } }, { id: 'near', kind: 'r2', at: { x: 0, y: 0 } }], edges: [] }));
    await page.locator('[data-demo-load]').click();
    await expect(page.locator('[data-demo-load-issues] li')).toContainText(['far: `at`']);
    const box = await service(page, 'near').boundingBox();
    expect(box.width).toBeGreaterThan(100);
  });

  test('two systems sharing a service are each their own', async ({ page }) => {
    await page.goto('/?demo=cloudflare-diagram/two-systems&theme=light', { waitUntil: 'load' });
    const side = (name) => page.locator(`[data-demo-side=${name}]`);
    await side('Site').locator('[data-slot=cloudflare-service]').first().waitFor({ timeout: 30_000 });
    await expect(page.locator('[data-demo-shared]')).toHaveAttribute('data-demo-shared', 'room:same');
    await expect(side('Site')).toHaveAttribute('data-demo-problems', '');
    await expect(side('Admin')).toHaveAttribute('data-demo-problems', '');
    // Changing its machine in one doesn't change the other's.
    const press2 = async (name, id) => {
      const node = side(name).locator(`[data-slot=diagram-node][data-node="${id}"]`);
      await side(name).scrollIntoViewIfNeeded();
      const box = await node.boundingBox();
      await page.mouse.click(box.x + box.width / 2, box.y + 10);
    };
    await press2('Admin', 'room');
    await side('Admin').locator('[data-action=open-machine]').click();
    await side('Admin').locator('[data-slot=edit-add-state]').click();
    await expect(page.locator('[data-demo-shared]')).toHaveAttribute('data-demo-shared', 'room:differs');
    await side('Admin').locator('[data-action=machine-back]').click();
    // Taking it out of one leaves the other, and only the one that lost it is wrong.
    await press2('Site', 'room');
    await side('Site').locator('[data-action=delete]').click();
    await expect(side('Site')).toHaveAttribute('data-demo-services', 'site');
    await expect(side('Admin')).toHaveAttribute('data-demo-services', 'admin room');
    await expect(side('Site')).toHaveAttribute('data-demo-problems', 'edge-end');
    await expect(side('Admin')).toHaveAttribute('data-demo-problems', '');
    await expect(side('Admin').locator('[data-slot=diagram-node][data-node=room]')).toHaveCount(1);
    await expect(page.locator('[data-demo-shared]')).toHaveAttribute('data-demo-shared', '');
    // Undoing's its own on each.
    await side('Site').locator('[data-action=undo]').click();
    await expect(side('Site')).toHaveAttribute('data-demo-services', 'site room');
    await expect(side('Site')).toHaveAttribute('data-demo-problems', '');
  });
});

test.describe('a system and wrangler.jsonc', () => {
  const config = (page) => page.locator('[data-demo-config]');
  const different = (page) => page.locator('[data-demo-differences]').getAttribute('data-demo-differences');
  test.beforeEach(async ({ page }) => { await open(page, 'wrangler'); });

  test('a config’s drawn, what changes is listed by name, and writing keeps its comments', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await expect(page.locator('[data-slot=cloudflare-service]')).toHaveCount(4);
    await expect(service(page, 'api').locator('[data-slot=cloudflare-service-name]')).toHaveText('api');
    await expect(service(page, 'r2:uploads').locator('[data-slot=cloudflare-service-name]')).toHaveText('uploads');
    await expect(page.locator('[data-slot=diagram-edge-label]', { hasText: 'FILES' })).toHaveCount(1);
    expect(await different(page)).toBe('');
    const before = await config(page).inputValue();
    // Nothing to write, and it's the same.
    await page.locator('[data-demo-write]').click();
    expect(await config(page).inputValue()).toBe(before);
    // Taken off the board, it's listed, and written.
    const box = await service(page, 'kv:abc123').boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + 10);
    await panel(page).locator('[data-action=delete]').click();
    await expect.poll(() => different(page)).toBe('removed:SESSIONS');
    await expect(page.locator('[data-demo-differences] li')).toHaveText('SESSIONS (KV Namespace) is in the config, and not in the system.');
    // Renamed on the board, the same.
    await pressOnEdge(page, 'api-r2_buckets-FILES');
    const name = page.locator('[data-field="binding-name"]');
    await name.fill('UPLOADS');
    await name.press('Enter');
    await expect.poll(() => different(page)).toBe('renamed:UPLOADS removed:SESSIONS');
    await page.locator('[data-demo-write]').click();
    await expect.poll(() => different(page)).toBe('');
    await expect(page.locator('[data-demo-differences] li')).toHaveText('The system and the file agree.');
    expect(await config(page).inputValue()).toBe(before.replace('"binding": "FILES"', '"binding": "UPLOADS"').replace('"kv_namespaces": [{ "binding": "SESSIONS", "id": "abc123" }]', '"kv_namespaces": []'));
    expect(errors).toEqual([]);
  });

  test('something new on the board goes in the file, and reading it back is the same', async ({ page }) => {
    const search = page.locator('[data-slot=cloudflare-search] input');
    await search.fill('d1');
    await search.press('Enter');
    await expect(service(page, 'd1')).toHaveCount(1);
    expect(await different(page)).toBe('');
    await connect(page, 'api', 'env', 'd1', 'binding:d1_databases');
    await expect.poll(() => different(page)).toBe('added:D1_DATABASE');
    await page.locator('[data-demo-write]').click();
    await expect.poll(() => different(page)).toBe('');
    await expect(config(page)).toHaveValue(/"d1_databases": \[\{ "binding": "D1_DATABASE" \}\]/);
    await expect(config(page)).toHaveValue(/\/\/ the big one/);
    await page.locator('[data-demo-read]').click();
    await expect.poll(() => different(page)).toBe('');
    await expect(page.locator('[data-slot=diagram-edge-label]', { hasText: 'D1_DATABASE' })).toHaveCount(1);
  });

  test('TOML’s refused by name, and what’s broken says where', async ({ page }) => {
    await config(page).fill('name = "w"\n[[r2_buckets]]\nbinding = "F"\n');
    await expect(page.locator('[data-demo-unreadable]')).toContainText('That’s TOML');
    await expect(page.locator('[data-demo-write]')).toBeDisabled();
    await expect(service(page, 'api')).toHaveCount(1);
    await config(page).fill('{ "name": "w",\n  "main" "x" }');
    await expect(page.locator('[data-demo-unreadable]')).toContainText('at line 2');
    await config(page).fill('{ "name": "api", "new_thing": [{ "binding": "NEW" }] }');
    await expect(page.locator('[data-demo-unreadable]')).toHaveCount(0);
  });
});

test.describe('a system, at a phone’s size', () => {
  test.use({ viewport: { width: 390, height: 900 } });

  test('the bar says if something’s wrong', async ({ page }) => {
    await open(page, 'system');
    await expect(page.locator('[data-slot=diagram-frame-bar]')).toContainText('5 services');
    await expect(page.locator('[data-slot=diagram-frame-bar]')).not.toContainText('problem');
    const next = await page.locator('[data-demo-json]').inputValue();
    await page.locator('[data-demo-json]').fill(next.replace('"FILE_READY"', '"NOT_RECEIVED"'));
    await page.locator('[data-demo-load]').click();
    await expect(page.locator('[data-slot=diagram-frame-bar]')).toContainText('5 services, 1 problem');
  });

  test('its machine opens over the board, from the tray, and comes back', async ({ page }) => {
    await open(page, 'system');
    // Select it on the board, then open the panel: at a phone's size it's a page pushed over the board.
    const box = await service(page, 'room').boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + 5);
    await page.locator('[data-slot=diagram-frame-trigger]').click();
    await expect(page.locator('[data-slot=diagram-frame][data-presentation=push] [data-slot=cloudflare-panel]')).toBeVisible();
    await page.locator('[data-action=open-machine]').click();
    await expect(page.locator('[data-slot=state-diagram]')).toBeVisible();
    await expect(page.locator('[data-action=machine-back]')).toBeFocused();
    // The board and the panel are inert under the cover.
    await expect(page.locator('[data-slot=diagram-frame-board]')).toHaveAttribute('inert', '');
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await page.locator('[data-action=machine-back]').click();
    await expect(page.locator('[data-slot=state-diagram]')).toHaveCount(0);
    await expect(page.locator('[data-action=open-machine]')).toBeFocused();
    await expect.poll(() => page.evaluate(() => document.activeElement?.tagName)).not.toBe('BODY');
  });
});

test.describe('at a phone’s size', () => {
  test.use({ viewport: { width: 390, height: 780 } });

  test('the panel’s a page pushed over the board, and connecting still works', async ({ page }) => {
    await open(page, 'connect');
    await expect(page.locator('[data-slot=diagram-frame]')).toHaveAttribute('data-presentation', 'push');
    await expect(page.locator('[data-slot=cloudflare-panel]')).not.toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await connect(page, 'worker', 'env', 'r2', 'binding:r2_buckets');
    await expect.poll(() => edges(page)).toContain('worker>r2');
    // The new connection's selected: the panel says what's on offer across it, and its back button returns to the board.
    await page.locator('[data-slot=diagram-frame-trigger]').click();
    await expect(page.locator('[data-slot=cloudflare-panel] [data-operation]')).toHaveCount(7);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await page.getByRole('button', { name: 'Board' }).click();
    await expect(page.locator('[data-slot=diagram-frame-trigger]')).toBeFocused();
  });
});

test.describe('a workerd config', () => {
  const nodesIn = (scope) => scope.locator('[data-slot=diagram-node]').evaluateAll((els) => els.map((el) => el.getAttribute('data-node')).sort());

  test('its services are drawn from the text, and what isn’t one of them is said', async ({ page }) => {
    await page.goto('/?demo=cloudflare-diagram/workerd&theme=light', { waitUntil: 'load' });
    await page.locator('[data-slot=cloudflare-service]').first().waitFor({ timeout: 30_000 });
    expect(await nodesIn(page)).toEqual(['broker', 'consumer', 'main', 'main.Order', 'queues:broker']);
    expect(await page.locator('[data-slot=diagram-edge]').count()).toBe(5);
    await expect(page.locator('[data-demo-notes]')).toContainText('do-storage is a disk service');
    // Broken, it says where, and draws nothing; put right, it's back.
    const text = page.locator('[data-demo-config]');
    const config = await text.inputValue();
    await text.fill(config.replace('(name = "main", worker = .main),', '(name = "main" worker = .main),'));
    await expect(page.locator('[data-demo-unreadable]')).toContainText('line 5');
    await expect(page.locator('[data-slot=cloudflare-service]')).toHaveCount(0);
    await text.fill(config);
    await expect(page.locator('[data-slot=cloudflare-service]')).toHaveCount(5);
  });

  test('a capnp fence and an embedded .capnp file draw themselves in the docs', async ({ page }) => {
    await page.goto('/#/cloudflare-diagram', { waitUntil: 'load' });
    const cards = page.locator('[data-docstream-capnp]');
    await expect(cards).toHaveCount(2, { timeout: 30_000 });
    await cards.nth(0).scrollIntoViewIfNeeded();
    await expect.poll(() => nodesIn(cards.nth(0)), { timeout: 30_000 }).toEqual(['kv:cache', 'main', 'main.Room']);
    await cards.nth(1).scrollIntoViewIfNeeded();
    await expect(cards.nth(1)).toHaveAttribute('aria-label', 'event-log.capnp');
    await expect.poll(() => nodesIn(cards.nth(1)), { timeout: 30_000 }).toEqual(['main', 'main.ProofAccount']);
    await expect(cards.nth(1).locator('[data-docstream-capnp-notes]')).toContainText('listens on 127.0.0.1:19610 for main');
    // The source is a press away, and back.
    await cards.nth(0).locator('.docs-capnp-toggle').click();
    await expect(cards.nth(0).locator('.docs-capnp-source')).toContainText('durableObjectNamespace');
    await cards.nth(0).locator('.docs-capnp-toggle').click();
    await expect.poll(() => nodesIn(cards.nth(0))).toEqual(['kv:cache', 'main', 'main.Room']);
  });
});

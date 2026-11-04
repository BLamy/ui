import { test, expect } from '@playwright/test';

/* CloudflareDiagram, through its docs demos, with real input. */

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
    const offered = panel(page).locator('[data-slot=cloudflare-operation]');
    await expect(offered).toHaveCount(7);
    expect(await offered.evaluateAll((els) => els.map((el) => el.getAttribute('data-operation')))).toEqual(['createMultipartUpload', 'delete', 'get', 'head', 'list', 'put', 'resumeMultipartUpload']);
    await expect(panel(page).locator('[data-operation=put]')).toContainText('put(key, value, options)');
    await panel(page).locator('[data-operation=put] [data-slot=checkbox], [data-operation=put] label').first().click();
    await panel(page).locator('[data-operation=get] [data-slot=checkbox], [data-operation=get] label').first().click();
    await expect.poll(() => edges(page)).toBe('worker>r2:r2_buckets:R2_BUCKET:get+put');
    await expect(page.locator('[data-slot=diagram-edge-label]', { hasText: 'R2_BUCKET: get, put' })).toHaveCount(1);
    // It's named on env, and can be renamed, and not to what isn't a name.
    const name = page.locator('[data-slot=cloudflare-binding-name] input');
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
    const name = page.locator('[data-slot=cloudflare-binding-name] input');
    await expect(name).toHaveValue('R2_BUCKET_2');
    await name.fill('R2_BUCKET');
    await name.press('Enter');
    await expect(page.locator('[data-slot=cloudflare-refusal]')).toContainText('already a binding');
    expect(await edges(page)).toBe('worker>r2:r2_buckets:R2_BUCKET worker>r2:r2_buckets:R2_BUCKET_2');
    // Another Worker can use the same name for its own.
    await connect(page, 'consumer', 'env', 'r2', 'binding:r2_buckets');
    await expect.poll(() => edges(page)).toContain('consumer>r2:r2_buckets:R2_BUCKET');
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
    await panel(page).locator('[data-slot=cloudflare-delete]').click();
    await expect.poll(() => edges(page)).toBe('');
    const r2 = await service(page, 'r2').boundingBox();
    await page.mouse.click(r2.x + 60, r2.y + 14);
    const label = page.locator('[data-slot=cloudflare-label] input');
    await label.fill('Uploads');
    await label.press('Enter');
    await expect(service(page, 'r2').locator('[data-slot=cloudflare-service-name]')).toHaveText('Uploads');
    await panel(page).locator('[data-slot=cloudflare-delete]').click();
    await expect(service(page, 'r2')).toHaveCount(0);
    // Undo goes back through what the panel did, too, one at a time.
    await panel(page).locator('[data-slot=cloudflare-undo]').click();
    await expect(service(page, 'r2').locator('[data-slot=cloudflare-service-name]')).toHaveText('Uploads');
    await panel(page).locator('[data-slot=cloudflare-undo]').click();
    await expect(service(page, 'r2').locator('[data-slot=cloudflare-service-name]')).toHaveText('R2');
    await panel(page).locator('[data-slot=cloudflare-redo]').click();
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
    await expect(panel(page).locator('[data-slot=cloudflare-operation]')).toHaveCount(7);
    await expect(panel(page).locator('[data-slot=cloudflare-binding-name]')).toContainText('FILES');
    // Read-only, so it says and doesn't offer.
    await expect(panel(page).locator('input')).toHaveCount(0);
    await expect(panel(page).locator('[data-slot=cloudflare-delete]')).toHaveCount(0);
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
    const images = await page.locator('[data-slot=cloudflare-diagram] img, [data-slot=cloudflare-diagram] image').count();
    expect(images).toBe(0);
  });
});

test.describe('only to read', () => {
  test('it says what things are, and offers no way to change them', async ({ page }) => {
    await open(page, 'upload');
    const none = async () => {
      for (const slot of ['cloudflare-delete', 'cloudflare-undo', 'cloudflare-redo', 'cloudflare-label']) await expect(page.locator(`[data-slot=${slot}]`)).toHaveCount(0);
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
    await expect(panel(page).locator('[data-slot=cloudflare-operation]').first()).toBeVisible();
    await expect(panel(page).locator('input')).toHaveCount(0);
    await expect(panel(page).locator('[data-slot=cloudflare-binding-name]')).toContainText('FILES');
    await none();
  });
});

test.describe('at a phone’s size', () => {
  test.use({ viewport: { width: 390, height: 780 } });

  test('the panel’s a tray under the board, and connecting still works', async ({ page }) => {
    await open(page, 'connect');
    await expect(page.locator('[data-slot=cloudflare-panel]')).toHaveCount(0);
    await page.locator('[data-slot=diagram-frame-open]').click();
    await expect(page.locator('[data-slot=credenza]')).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await connect(page, 'worker', 'env', 'r2', 'binding:r2_buckets');
    await expect.poll(() => edges(page)).toContain('worker>r2');
    await expect(page.locator('[data-slot=credenza] [data-slot=cloudflare-operation]')).toHaveCount(7);
    const sheet = await page.locator('[data-slot=credenza]').boundingBox();
    const node = await service(page, 'worker').boundingBox();
    expect(node.y).toBeLessThan(sheet.y);
  });
});

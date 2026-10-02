import { test, expect } from '@playwright/test';

/* The docs app's motion dev tools: `?motion=<speed>`, `?reduce=1`, and the ⌥M panel. Durations are measured with
   Date.now() — the tool patches performance.now(), so that clock would measure the slowed time, not the real one. */
const STACK = '[data-slot=navigation-stack]';

async function open(page, query) {
  await page.goto(`/?demo=navigation-stack/title-morph&theme=light${query}`, { waitUntil: 'load' });
  await page.locator(STACK).waitFor();
}

/** Pushes the first row and returns how long (real ms) the title flight and the screen slide took. */
async function pushDuration(page) {
  await page.evaluate(() => {
    window.__t = { click: 0, flightStart: 0, flightEnd: 0, flightSeen: false };
    const loop = () => {
      const f = document.querySelector('[data-slot=navigation-title-flight]');
      const now = Date.now();
      if (f && !window.__t.flightSeen) { window.__t.flightSeen = true; window.__t.flightStart = now; }
      if (!f && window.__t.flightSeen && !window.__t.flightEnd) window.__t.flightEnd = now;
      requestAnimationFrame(loop);
    };
    loop();
  });
  await page.locator(`${STACK} [data-slot=list-row]`, { hasText: 'Notifications' }).click();
  await expect.poll(() => page.evaluate(() => window.__t.flightEnd), { timeout: 20_000 }).toBeGreaterThan(0);
  return page.evaluate(() => ({ flight: window.__t.flightEnd - window.__t.flightStart }));
}

test('a slowed speed stretches the JS spring (the title flight) in real time', async ({ page }) => {
  await open(page, '');
  const normal = (await pushDuration(page)).flight;
  await open(page, '&motion=0.25');
  const slowed = (await pushDuration(page)).flight;
  expect(normal).toBeGreaterThan(100);
  // A quarter speed should take about four times as long; allow wide margins for frame timing.
  expect(slowed).toBeGreaterThan(normal * 2.5);
});

test('a slowed speed stretches CSS transitions too (the screen slide)', async ({ page }) => {
  const slide = async (query) => {
    await open(page, query);
    const row = page.locator(`${STACK} [data-slot=list-row]`, { hasText: 'Notifications' });
    const t0 = Date.now();
    await row.click();
    // Wait for the new screen to exist first (until then the last screen is the old one, already on the origin), then
    // for it to come to rest on the stack's origin.
    await expect.poll(() => page.locator(`${STACK} [data-slot=screen]`).count()).toBe(2);
    await expect.poll(async () => {
      const [s, st] = await Promise.all([page.locator(`${STACK} [data-slot=screen]`).last().boundingBox(), page.locator(STACK).boundingBox()]);
      return s && st ? Math.abs(s.x - st.x) < 1 : false;
    }, { timeout: 20_000 }).toBe(true);
    return Date.now() - t0;
  };
  const normal = await slide('');
  const slowed = await slide('&motion=0.25');
  // A spring's tail doesn't scale by a clean 4×; 1.6× is well clear of frame-timing noise and of an unslowed run.
  expect(slowed).toBeGreaterThan(normal * 1.6);
});

test('the speed can change mid-animation: it carries on from where it was and finishes at the new speed', async ({ page }) => {
  await open(page, '&motion=0.25');
  // A link that sets a speed opens the panel, so it can be changed right away.
  await expect(page.getByRole('group', { name: 'Motion tools' })).toBeVisible();
  const clock = () => page.evaluate(() => performance.now());
  await page.locator(`${STACK} [data-slot=list-row]`, { hasText: 'Notifications' }).click();
  await expect(page.locator('[data-slot=navigation-title-flight]')).toHaveCount(1);
  const before = await clock();
  const t0 = Date.now();
  await page.getByRole('button', { name: '1×', exact: true }).click();
  // At a quarter speed the flight would need ~2.5s more; at normal speed it is over almost at once.
  await expect(page.locator('[data-slot=navigation-title-flight]')).toHaveCount(0, { timeout: 5000 });
  expect(Date.now() - t0).toBeLessThan(1800);
  // The slowed clock never jumped backwards or ahead of real time when the speed changed.
  const after = await clock();
  expect(after).toBeGreaterThan(before);
  expect(after - before).toBeLessThan(Date.now() - t0 + 100);
});

test('?reduce=1 makes the kit see reduced motion: the title flight is skipped', async ({ page }) => {
  await open(page, '&reduce=1');
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
  await page.evaluate(() => {
    window.__flights = 0;
    new MutationObserver(() => { if (document.querySelector('[data-slot=navigation-title-flight]')) window.__flights++; })
      .observe(document.body, { childList: true, subtree: true });
  });
  await page.locator(`${STACK} [data-slot=list-row]`, { hasText: 'Notifications' }).click();
  await expect.poll(() => page.locator(`${STACK} [data-slot=screen]`).count()).toBe(2);
  await page.waitForTimeout(800);
  expect(await page.evaluate(() => window.__flights)).toBe(0);
});

test('without the flags the real answer comes through', async ({ page }) => {
  await open(page, '');
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(false);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
});

test('⌥M opens the panel; its Reduce box flips the answer live', async ({ page }) => {
  await open(page, '');
  await expect(page.locator('[data-slot=motion-tools]')).toHaveCount(0);
  await page.keyboard.press('Alt+KeyM');
  await expect(page.getByRole('group', { name: 'Motion tools' })).toBeVisible();
  await page.getByLabel('Reduce').check();
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
  await page.getByLabel('Reduce').uncheck();
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(false);
  await page.keyboard.press('Alt+KeyM');
  await expect(page.locator('[data-slot=motion-tools]')).toHaveCount(0);
});

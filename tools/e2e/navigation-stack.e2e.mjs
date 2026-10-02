import { test, expect } from '@playwright/test';
import { center, drag, openDemo, settled } from './helpers.mjs';

/* NavigationStack, through the Title morph demo: Settings → Notifications and Focus → Scheduled Summary. */
const STACK = '[data-slot=navigation-stack]';

test.beforeEach(async ({ page }) => {
  await openDemo(page, 'navigation-stack/title-morph', STACK);
});

const stack = (page) => page.locator(STACK);
const labels = (page) => page.$$eval(`${STACK} [data-slot=screen]`, (els) => els.map((e) => e.dataset.screenLabel));
const top = (page) => stack(page).locator('[data-slot=screen]').last();

/** The top screen's left edge relative to the stack, or null while it can't be measured (a leaving screen detaches). */
const topX = async (page) => {
  const [t, s] = await Promise.all([top(page).boundingBox({ timeout: 500 }).catch(() => null), stack(page).boundingBox()]);
  return t && s ? Math.round(t.x - s.x) : null;
};

/** A push or pop has finished: the flight layer is gone and the top screen is at rest on the stack's origin. */
async function rest(page) {
  await settled(page, async () => ({ flight: await page.locator('[data-slot=navigation-title-flight]').count(), x: await topX(page) }));
  await expect(page.locator('[data-slot=navigation-title-flight]')).toHaveCount(0);
  await expect.poll(() => topX(page)).toBe(0);
}

async function push(page, row) {
  await stack(page).locator('[data-slot=list-row]', { hasText: row }).click();
  await rest(page);
}

test.describe('back button', () => {
  test('a tap on the chevron pops on the first try', async ({ page }) => {
    // The chevron sits inside the edge-swipe zone (the stack's left 36px): that zone must not swallow the tap.
    await push(page, 'Notifications and Focus');
    expect(await labels(page)).toEqual(['Settings', 'Notifications and Focus']);
    const chev = await top(page).locator('button.bl-btn svg').boundingBox();
    expect(chev.x - (await stack(page).boundingBox()).x).toBeLessThan(36);
    await page.mouse.click(...Object.values(center(chev)));
    await expect.poll(() => labels(page)).toEqual(['Settings']);
  });

  test('a tap on the label pops', async ({ page }) => {
    await push(page, 'Notifications and Focus');
    await top(page).locator('button.bl-btn span').click();
    await expect.poll(() => labels(page)).toEqual(['Settings']);
  });

  test('pops two levels, one tap each', async ({ page }) => {
    await push(page, 'Notifications and Focus');
    await push(page, 'Scheduled Summary');
    expect(await labels(page)).toEqual(['Settings', 'Notifications and Focus', 'Scheduled Summary']);
    const chev = () => top(page).locator('button.bl-btn svg').boundingBox().then(center);
    await page.mouse.click(...Object.values(await chev()));
    await expect.poll(() => labels(page)).toEqual(['Settings', 'Notifications and Focus']);
    await rest(page);
    await page.mouse.click(...Object.values(await chev()));
    await expect.poll(() => labels(page)).toEqual(['Settings']);
  });
});

test.describe('edge swipe', () => {
  test('a long swipe from the left edge pops', async ({ page }) => {
    await push(page, 'Notifications and Focus');
    const s = await stack(page).boundingBox();
    await drag(page, { x: s.x + 10, y: s.y + s.height * 0.7 }, s.width * 0.7);
    await expect.poll(() => labels(page)).toEqual(['Settings']);
    await rest(page);
  });

  test('a short swipe springs back and does not pop', async ({ page }) => {
    await push(page, 'Notifications and Focus');
    const s = await stack(page).boundingBox();
    await drag(page, { x: s.x + 10, y: s.y + s.height * 0.7 }, 40);
    await rest(page);
    expect(await labels(page)).toEqual(['Settings', 'Notifications and Focus']);
  });

  test('a short swipe that starts on the back button and ends over it does not press it', async ({ page }) => {
    await push(page, 'Notifications and Focus');
    const chev = center(await top(page).locator('button.bl-btn svg').boundingBox());
    await drag(page, chev, 24);
    await rest(page);
    expect(await labels(page)).toEqual(['Settings', 'Notifications and Focus']);
  });

  test('a tap works again after a swipe', async ({ page }) => {
    await push(page, 'Notifications and Focus');
    const s = await stack(page).boundingBox();
    await drag(page, { x: s.x + 10, y: s.y + s.height * 0.7 }, 40);
    await rest(page);
    await top(page).locator('button.bl-btn span').click();
    await expect.poll(() => labels(page)).toEqual(['Settings']);
  });

  test('a vertical drag in the edge zone scrolls instead of swiping', async ({ page }) => {
    await push(page, 'Notifications and Focus');
    const s = await stack(page).boundingBox();
    await page.mouse.move(s.x + 10, s.y + s.height * 0.7);
    await page.mouse.down();
    await page.mouse.move(s.x + 12, s.y + s.height * 0.7 - 60, { steps: 6 });
    await page.mouse.up();
    await rest(page);
    expect(await labels(page)).toEqual(['Settings', 'Notifications and Focus']);
  });
});

test.describe('title morph', () => {
  /** Records the flight layer's copies (and the chevron copy) on every frame until `window.__stop` is set. */
  const record = (page) =>
    page.evaluate(() => {
      window.__frames = [];
      window.__stop = false;
      const loop = () => {
        const layer = document.querySelector('[data-slot=navigation-title-flight]');
        if (layer) {
          const kids = [...layer.children];
          const text = kids.filter((k) => k.textContent.trim());
          const chev = kids.find((k) => !k.textContent.trim());
          window.__frames.push({
            a: text[0] ? +text[0].style.opacity : null,
            b: text[1] ? +text[1].style.opacity : null,
            chevLeft: chev ? Math.round(chev.getBoundingClientRect().left * 10) / 10 : null,
            chevOpacity: chev ? +chev.style.opacity : null,
          });
        }
        if (!window.__stop) requestAnimationFrame(loop);
      };
      loop();
    });
  const frames = (page) => page.evaluate(() => { window.__stop = true; return window.__frames; });

  test('a nested title never blinks out: the two copies always cover the text', async ({ page }) => {
    await push(page, 'Notifications and Focus');
    await record(page);
    await push(page, 'Scheduled Summary');
    const f = (await frames(page)).filter((x) => x.a !== null && x.b !== null);
    expect(f.length).toBeGreaterThan(10);
    // Source and destination are the same size, so any half-faded pair of the same words would read as a blink.
    const dip = Math.min(...f.map((x) => 1 - (1 - x.a) * (1 - x.b)));
    expect(dip).toBeGreaterThan(0.98);
  });

  test('the new back chevron fades in where it rests instead of sweeping across the title', async ({ page }) => {
    await push(page, 'Notifications and Focus');
    await record(page);
    await push(page, 'Scheduled Summary');
    const f = (await frames(page)).filter((x) => x.chevLeft !== null);
    expect(f.length).toBeGreaterThan(10);
    expect(Math.max(...f.map((x) => x.chevLeft)) - Math.min(...f.map((x) => x.chevLeft))).toBeLessThan(1);
    expect(f[0].chevOpacity).toBeLessThan(0.1);
    expect(f.at(-1).chevOpacity).toBeGreaterThan(0.9);
  });

  test('a push and a pop leave nothing hidden behind', async ({ page }) => {
    await push(page, 'Notifications and Focus');
    await push(page, 'Scheduled Summary');
    await top(page).locator('button.bl-btn span').click();
    await rest(page);
    await top(page).locator('button.bl-btn span').click();
    await rest(page);
    const hidden = await page.$$eval(`${STACK} *`, (els) => els.filter((e) => e.style.visibility === 'hidden').length);
    expect(hidden).toBe(0);
    await expect(page.locator('[data-slot=navigation-title-flight]')).toHaveCount(0);
  });

  test('reduced motion skips the flight', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await record(page);
    await push(page, 'Notifications and Focus');
    expect((await frames(page)).length).toBe(0);
  });
});

test.describe('keyboard and focus', () => {
  const focusInfo = (page) => page.evaluate(() => {
    const a = document.activeElement;
    return { screen: a?.closest('[data-slot=screen]')?.dataset.screenLabel ?? null, label: a?.getAttribute('aria-label') ?? a?.textContent?.trim().slice(0, 30) ?? '' };
  });

  test('a covered screen is inert, so Tab never reaches it', async ({ page }) => {
    await push(page, 'Notifications and Focus');
    expect(await page.$eval(`${STACK} [data-slot=screen]`, (e) => e.hasAttribute('inert'))).toBe(true);
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab');
      const f = await focusInfo(page);
      if (f.screen) expect(f.screen).toBe('Notifications and Focus');
    }
  });

  test('a push moves focus into the new screen, and Escape pops it', async ({ page }) => {
    await push(page, 'Notifications and Focus');
    expect((await focusInfo(page)).screen).toBe('Notifications and Focus');
    await page.keyboard.press('Escape');
    await expect.poll(() => labels(page)).toEqual(['Settings']);
  });

  test('a pop hands focus back to the row that pushed', async ({ page }) => {
    // The row's press target is a button beneath its content.
    const rowButton = stack(page).locator('[data-slot=list-row]', { hasText: 'Notifications and Focus' }).locator('button');
    await rowButton.focus();
    await expect(rowButton).toBeFocused();
    await page.keyboard.press('Enter');
    await expect.poll(() => labels(page)).toEqual(['Settings', 'Notifications and Focus']);
    await rest(page);
    await page.keyboard.press('Escape');
    await expect.poll(() => labels(page)).toEqual(['Settings']);
    await rest(page);
    await expect(rowButton).toBeFocused();
  });
});

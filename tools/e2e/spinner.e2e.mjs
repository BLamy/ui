import { test, expect } from '@playwright/test';
import { openDemo } from './helpers.mjs';

/* Spinner, through its docs demos: the gallery of every animation and variant, and the playground. */
const spinners = (page) => page.locator('[data-slot=spinner]');
/** The first animated part of a spinner and what the browser says it is doing. */
const animation = (el) => el.evaluate((root) => {
  const part = [...root.querySelectorAll('*')].find((e) => getComputedStyle(e).animationName !== 'none');
  if (!part) return null;
  const cs = getComputedStyle(part);
  return { name: cs.animationName, duration: cs.animationDuration, state: cs.animationPlayState, delay: cs.animationDelay };
});

test.describe('gallery', () => {
  test.beforeEach(async ({ page }) => { await openDemo(page, 'spinner/gallery', '[data-slot=spinner]'); });

  test('shows the iOS spinner and all 60 loader variants', async ({ page }) => {
    await expect(spinners(page)).toHaveCount(61);
    for (const a of ['orbit', 'beacon', 'matrix', 'cells', 'register', 'bands', 'lift', 'steps', 'cradle', 'hourglass', 'balance', 'fanout', 'battery', 'bloom', 'sonar', 'gyro', 'coalesce', 'crystal', 'loop', 'relay']) {
      await expect(page.locator(`[data-slot=spinner][data-animation=${a}]`)).toHaveCount(3);
    }
  });

  test('every loader is really animating, with its own keyframes', async ({ page }) => {
    const loaders = page.locator('[data-slot=spinner]:not([data-animation=ios])');
    const n = await loaders.count();
    const names = new Set();
    for (let i = 0; i < n; i++) {
      // Loaders off screen pause themselves, so bring each one into view first.
      await loaders.nth(i).scrollIntoViewIfNeeded();
      await expect(loaders.nth(i)).not.toHaveAttribute('data-paused');
      const a = await animation(loaders.nth(i));
      expect(a, `loader ${i} animates`).not.toBeNull();
      expect(a.name).toMatch(/^bl-ld-/);
      expect(a.state).toBe('running');
      names.add(a.name);
    }
    // Twenty animations, several of which switch keyframes by variant.
    expect(names.size).toBeGreaterThanOrEqual(20);
  });

  test('loaders take the colour of the text around them', async ({ page }) => {
    const color = await spinners(page).nth(1).evaluate((root) => {
      const part = [...root.querySelectorAll('*')].find((e) => getComputedStyle(e).animationName !== 'none');
      return { text: getComputedStyle(root).color, part: getComputedStyle(part).backgroundColor };
    });
    expect(color.part).not.toBe('rgba(0, 0, 0, 0)');
  });
});

test.describe('playground', () => {
  test.beforeEach(async ({ page }) => { await openDemo(page, 'spinner/playground', '[data-slot=spinner]'); });
  const preview = (page) => page.locator('[data-slot=spinner]').first();
  const code = (page) => page.locator('pre');
  // Radios and the switch are visually hidden inputs under a label: click what a person clicks.
  const choose = (page, name) => page.getByText(name, { exact: true }).click();
  const pause = (page) => page.locator('[data-slot=switch]').click();

  test('picking an animation and a variant changes the preview and the code', async ({ page }) => {
    await expect(preview(page)).toHaveAttribute('data-animation', 'orbit');
    await choose(page, 'Matrix');
    await expect(preview(page)).toHaveAttribute('data-animation', 'matrix');
    await expect(code(page)).toContainText('animation="matrix"');
    await choose(page, 'ripple');
    await expect(preview(page).locator('[data-variant]')).toHaveAttribute('data-variant', 'ripple');
    await expect(code(page)).toContainText('variant="ripple"');
  });

  test('the variant list follows the animation, and ios has none', async ({ page }) => {
    await choose(page, 'Lift');
    await expect(page.getByRole('radio', { name: 'breathe' })).toBeVisible();
    await choose(page, 'iOS');
    await expect(page.getByRole('radio', { name: 'breathe' })).toHaveCount(0);
    await expect(preview(page)).toHaveAttribute('data-animation', 'ios');
  });

  test('speed scales the cycle length and pausing holds the animation', async ({ page }) => {
    const base = await animation(preview(page));
    expect(base.state).toBe('running');
    const baseMs = parseFloat(base.duration) * 1000;
    // Speed is a slider: Home / End / arrows from the keyboard.
    const speed = page.getByRole('slider', { name: 'Speed' });
    await speed.focus();
    await page.keyboard.press('End'); // 3×
    const fast = await animation(preview(page));
    expect(parseFloat(fast.duration) * 1000).toBeCloseTo(baseMs / 3, 0);
    await pause(page);
    await expect(preview(page)).toHaveAttribute('data-paused');
    expect((await animation(preview(page))).state).toBe('paused');
    await pause(page);
    expect((await animation(preview(page))).state).toBe('running');
  });

  test('size follows the slider', async ({ page }) => {
    const size = page.getByRole('slider', { name: 'Size' });
    await size.focus();
    await page.keyboard.press('End');
    const box = await preview(page).boundingBox();
    expect(Math.round(box.width)).toBe(160);
    await page.keyboard.press('Home');
    expect(Math.round((await preview(page).boundingBox()).width)).toBe(12);
  });

  test('the preview announces itself as status', async ({ page }) => {
    await expect(preview(page)).toHaveAttribute('role', 'status');
    await expect(preview(page)).toHaveAttribute('aria-label', 'Preview');
  });
});

test('reduced motion holds a still frame', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce', baseURL: test.info().project.use.baseURL, viewport: { width: 1000, height: 720 } });
  const page = await context.newPage();
  await openDemo(page, 'spinner/gallery', '[data-slot=spinner]');
  const loaders = page.locator('[data-slot=spinner]:not([data-animation=ios])');
  for (let i = 0; i < 3; i++) {
    const still = await loaders.nth(i).evaluate((root) => [...root.querySelectorAll('*')].every((e) => getComputedStyle(e).animationName === 'none'));
    expect(still, `loader ${i} is still`).toBe(true);
  }
  await context.close();
});

import { expect } from '@playwright/test';

/** Opens one docs demo full screen and waits for it to mount. */
export async function openDemo(page, src, selector) {
  await page.goto(`/?demo=${src}&theme=light`, { waitUntil: 'load' });
  await page.locator(selector).first().waitFor({ timeout: 30_000 });
}

/** Polls until `read()` is stable for two consecutive frames — a spring that has come to rest. */
export async function settled(page, read, { timeout = 5000 } = {}) {
  await expect
    .poll(
      async () => {
        const a = await read();
        await page.waitForTimeout(80);
        const b = await read();
        return JSON.stringify(a) === JSON.stringify(b);
      },
      { timeout },
    )
    .toBe(true);
}

/** A real mouse drag: down at (x, y), then `steps` evenly spaced moves by `dx`, then up. */
export async function drag(page, from, dx, { steps = 14, release = true } = {}) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(from.x + (dx * i) / steps, from.y);
    await page.waitForTimeout(12);
  }
  if (release) await page.mouse.up();
}

export const center = (box) => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 });

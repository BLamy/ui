import { test, expect } from '@playwright/test';
import { openDemo } from './helpers.mjs';

/* CronEditor with gpu-cron actually running on WebGPU (the unsupported path is in cron-editor.e2e.mjs). Playwright's
   default headless shell has no WebGPU adapter, so this file runs in full Chromium with the WebGPU flag, the same
   setup the visual tests use for gpu-lexer (a software adapter such as SwiftShader is enough). Where even that cannot
   create an adapter, every test here skips itself. The demos pin "now" (Friday 2 October 2026, 10:00 UTC) and the zone. */
test.use({ channel: 'chromium', launchOptions: { args: ['--enable-unsafe-webgpu'] } });

const ROOT = '[data-slot=cron-editor]';
const plain = (s) => s.replace(/[\u202f\u2009\u00a0]/g, ' ');

async function typeInto(field, text) {
  await field.click();
  await field.press('ControlOrMeta+a');
  await field.pressSequentially(text, { delay: 8 });
}
const box = (page) => page.getByRole('textbox', { name: 'Describe the schedule' });
/** The demo prints the editor's value under it. */
const value = (page) => page.locator('code').last();
const runs = async (page) => (await page.locator('[data-slot=cron-editor-next] li').allTextContents()).map(plain);
const SLOW = { timeout: 15_000 };

test.beforeEach(async ({ page }) => {
  await openDemo(page, 'cron-editor/basic', ROOT);
  const adapter = await page.evaluate(async () => !!navigator.gpu && !!(await navigator.gpu.requestAdapter().catch(() => null)));
  test.skip(!adapter, 'this Chromium cannot create a WebGPU adapter');
});

test('the box is the only input: no note, no expression field, no presets', async ({ page }) => {
  await expect(box(page)).toBeEnabled(SLOW);
  await expect(page.locator('[data-slot=cron-editor-note]')).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Cron expression' })).toHaveCount(0);
  await expect(page.locator('[data-slot=cron-editor-fields], [data-slot=cron-editor-presets]')).toHaveCount(0);
  await expect(page.locator('[data-slot=cron-editor-next]')).toBeVisible();
});

test('English becomes the value as you type, and the next runs follow', async ({ page }) => {
  await expect(box(page)).toBeEnabled(SLOW);
  await typeInto(box(page), 'every tuesday at 10pm');
  await expect(value(page)).toHaveText('0 22 * * 2', SLOW);
  await expect.poll(async () => (await runs(page))[0]).toBe('Tue, Oct 6, 2026, 10:00 PM');
  await typeInto(box(page), 'every weekday at 9am');
  await expect(value(page)).toHaveText('0 9 * * 1-5', SLOW);
  await expect.poll(async () => (await runs(page))[0]).toBe('Mon, Oct 5, 2026, 9:00 AM');
});

test('updates part-way through a sentence, before you finish typing', async ({ page }) => {
  await expect(box(page)).toBeEnabled(SLOW);
  await typeInto(box(page), 'every tues');
  await expect(value(page)).toHaveText(/^\S+ \S+ \* \* 2$/, SLOW);
});

test('gibberish still gets a valid expression (the runs are how you check it)', async ({ page }) => {
  await expect(box(page)).toBeEnabled(SLOW);
  await typeInto(box(page), 'purple monkey dishwasher');
  await expect.poll(async () => (await runs(page)).length, SLOW).toBe(5);
  await expect(value(page)).toHaveText(/^\S+( \S+){4}$/);
});

test('keeps only the newest answer while typing fast', async ({ page }) => {
  await expect(box(page)).toBeEnabled(SLOW);
  await box(page).click();
  await box(page).pressSequentially('every day at 8am', { delay: 15 });
  await box(page).press('ControlOrMeta+a');
  await box(page).pressSequentially('every 15 minutes', { delay: 15 });
  await expect(value(page)).toHaveText('*/15 * * * *', SLOW);
  await page.waitForTimeout(600); // a late answer for the old text must not replace it
  await expect(value(page)).toHaveText('*/15 * * * *');
});

test('useCronParse: the hook reports support, parses, and gives the machine-local times', async ({ page }) => {
  await openDemo(page, 'cron-editor/use-cron-parse', 'input');
  await expect(page.getByText('The model read it as */15 * * * *')).toBeVisible(SLOW);
});

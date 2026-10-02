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
const expression = (page) => page.getByRole('textbox', { name: 'Cron expression' });
const box = (page) => page.getByRole('textbox', { name: 'Describe the schedule' });
const understood = (page) => page.locator('[data-slot=cron-editor-understood]');
const runs = async (page) => (await page.locator('[data-slot=cron-editor-next] li').allTextContents()).map(plain);
const SLOW = { timeout: 15_000 };

test.beforeEach(async ({ page }) => {
  await openDemo(page, 'cron-editor/basic', ROOT);
  const adapter = await page.evaluate(async () => !!navigator.gpu && !!(await navigator.gpu.requestAdapter().catch(() => null)));
  test.skip(!adapter, 'this Chromium cannot create a WebGPU adapter');
});

test('offers the box once the model is loaded, and shows no note', async ({ page }) => {
  await expect(box(page)).toBeEnabled(SLOW);
  await expect(page.locator('[data-slot=cron-editor-note]')).toHaveCount(0);
});

test('turns English into an expression, shows it with the warning, and applies it only on request', async ({ page }) => {
  await expect(box(page)).toBeEnabled(SLOW);
  await typeInto(expression(page), '*/5 * * * *');
  await typeInto(box(page), 'every weekday at 9am');
  await expect(understood(page)).toBeVisible(SLOW);
  await expect(understood(page)).toContainText('What the model understood');
  await expect(understood(page).locator('code')).toHaveText('0 9 * * 1-5');
  await expect(page.locator('[data-slot=cron-editor-warning]')).toContainText('always gives an answer, even to text that is not a schedule');
  // Proposed, not applied: the expression field still holds what was typed there.
  await expect(expression(page)).toHaveValue('*/5 * * * *');

  await understood(page).getByRole('button', { name: 'Use this expression' }).click();
  await expect(expression(page)).toHaveValue('0 9 * * 1-5');
  await expect(understood(page).getByRole('button', { name: 'In use' })).toBeDisabled();
  await expect.poll(async () => (await runs(page))[0]).toBe('Mon, Oct 5, 2026, 9:00 AM');
});

test('gibberish still gets an answer, and the same warning', async ({ page }) => {
  await expect(box(page)).toBeEnabled(SLOW);
  await typeInto(box(page), 'purple monkey dishwasher');
  await expect(understood(page)).toBeVisible(SLOW);
  // Always a valid 5-field expression, never "could not parse".
  await expect(understood(page).locator('code')).toHaveText(/^\S+( \S+){4}$/);
  await expect(page.locator('[data-slot=cron-editor-warning]')).toBeVisible();
});

test('Enter applies the answer', async ({ page }) => {
  await expect(box(page)).toBeEnabled(SLOW);
  await typeInto(box(page), 'every 15 minutes');
  await expect(understood(page).locator('code')).toHaveText('*/15 * * * *', SLOW);
  await box(page).press('Enter');
  await expect(expression(page)).toHaveValue('*/15 * * * *');
});

test('keeps only the newest answer while typing fast', async ({ page }) => {
  await expect(box(page)).toBeEnabled(SLOW);
  await box(page).click();
  await box(page).pressSequentially('every day at 8am', { delay: 15 });
  await box(page).press('ControlOrMeta+a');
  await box(page).pressSequentially('every 15 minutes', { delay: 15 });
  await expect(understood(page).locator('code')).toHaveText('*/15 * * * *', SLOW);
  await page.waitForTimeout(600); // a late answer for the old text must not replace it
  await expect(understood(page).locator('code')).toHaveText('*/15 * * * *');
});

test('clearing the box removes the answer', async ({ page }) => {
  await expect(box(page)).toBeEnabled(SLOW);
  await typeInto(box(page), 'daily at noon');
  await expect(understood(page)).toBeVisible(SLOW);
  await box(page).press('ControlOrMeta+a');
  await box(page).press('Backspace');
  await expect(understood(page)).toHaveCount(0);
});

test('useCronParse: the hook reports support, parses, and gives the machine-local times', async ({ page }) => {
  await openDemo(page, 'cron-editor/use-cron-parse', 'input');
  await expect(page.getByText('The model read it as */15 * * * *')).toBeVisible(SLOW);
});

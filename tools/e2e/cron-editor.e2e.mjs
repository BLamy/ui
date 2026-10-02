import { test, expect } from '@playwright/test';
import { openDemo } from './helpers.mjs';

/* CronEditor (docs demos `cron-editor/*`). The local half (fields, validation, description, presets, next runs in a
   zone) is deterministic and tested with real typing, first with WebGPU hidden from the page (the path every browser
   without it takes), then, if this machine's Chromium can create a WebGPU adapter, with gpu-cron actually running.
   The demos pin "now" (Friday 2 October 2026, 10:00 UTC) and the zone. */
const ROOT = '[data-slot=cron-editor]';
const plain = (s) => s.replace(/[\u202f\u2009\u00a0]/g, ' ');

async function typeInto(field, text) {
  await field.click();
  await field.press('ControlOrMeta+a');
  if (text === '') await field.press('Backspace');
  else await field.pressSequentially(text, { delay: 8 });
}
const expression = (page) => page.getByRole('textbox', { name: 'Cron expression' });
const runs = async (page) => (await page.locator('[data-slot=cron-editor-next] li').allTextContents()).map(plain);
const cell = (page, name) => page.locator(`[data-field=${name}]`);

/** A browser with no WebGPU, as the page sees it. */
const hideWebGPU = (page) =>
  page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'gpu', { get: () => undefined, configurable: true });
  });

test.describe('without WebGPU', () => {
  test.beforeEach(async ({ page }) => {
    await hideWebGPU(page);
  });

  test('hides the plain-English box behind a note and never downloads gpu-cron', async ({ page }) => {
    const urls = [];
    page.on('request', (r) => urls.push(r.url()));
    await openDemo(page, 'cron-editor/basic', ROOT);
    const note = page.locator('[data-slot=cron-editor-note]');
    await expect(note).toBeVisible();
    await expect(note).toContainText('needs WebGPU');
    await expect(page.getByRole('textbox', { name: 'Describe the schedule' })).toHaveCount(0);
    await expect(expression(page)).toBeVisible();
    await page.waitForTimeout(400);
    expect(urls.filter((u) => /node_modules\/[^?]*gpu-cron/.test(u))).toEqual([]);
  });

  test('describes the default expression and lists its next runs', async ({ page }) => {
    await openDemo(page, 'cron-editor/basic', ROOT);
    await expect(page.locator('[data-slot=cron-editor-description]')).toHaveText('At 09:00 AM, Monday through Friday');
    await expect.poll(() => runs(page)).toEqual([
      'Mon, Oct 5, 2026, 9:00 AM',
      'Tue, Oct 6, 2026, 9:00 AM',
      'Wed, Oct 7, 2026, 9:00 AM',
      'Thu, Oct 8, 2026, 9:00 AM',
      'Fri, Oct 9, 2026, 9:00 AM',
    ]);
    await expect(page.locator('[data-slot=cron-editor-next]')).toContainText('Times in UTC.');
  });

  test('labels the five fields and checks each one as you type', async ({ page }) => {
    await openDemo(page, 'cron-editor/basic', ROOT);
    await expect(page.locator('[data-slot=cron-editor-fields] dt')).toHaveText(['minute', 'hour', 'day of month', 'month', 'day of week']);
    await typeInto(expression(page), '61 25 * 13 funday');
    await expect(expression(page)).toHaveAttribute('aria-invalid', 'true');
    for (const name of ['minute', 'hour', 'month', 'dayOfWeek']) await expect(cell(page, name)).toHaveAttribute('data-invalid', '');
    await expect(cell(page, 'dayOfMonth')).not.toHaveAttribute('data-invalid', '');
    const errors = page.locator('[data-slot=field-error]');
    await expect(errors).toContainText('Minute: 61 is out of range (0–59)');
    await expect(errors).toContainText('Hour: 25 is out of range (0–23)');
    await expect(errors).toContainText('Month: 13 is out of range (1–12)');
    await expect(page.locator('[data-slot=cron-editor-next]')).toContainText('Fix the expression to see when it runs.');
    await expect(page.locator('[data-slot=cron-editor-description]')).toHaveText('');

    await typeInto(expression(page), '*/20 8-18 * * mon-fri');
    await expect(errors).toHaveCount(0);
    await expect(page.locator('[data-slot=cron-editor-description]')).toContainText('Every 20 minutes');
    await expect(cell(page, 'hour').locator('dd')).toHaveText('8-18');
  });

  test('a short expression names what is missing', async ({ page }) => {
    await openDemo(page, 'cron-editor/basic', ROOT);
    await typeInto(expression(page), '0 9');
    await expect(page.locator('[data-slot=field-error]')).toContainText('Cron needs 5 fields; 2 given. Missing: day of month, month, day of week.');
    await expect(cell(page, 'dayOfMonth').locator('dd')).toHaveText('–');
  });

  test('outlines the field the caret is in, following the arrow keys', async ({ page }) => {
    await openDemo(page, 'cron-editor/basic', ROOT);
    const field = expression(page);
    await field.click();
    await field.press('Home');
    await expect(cell(page, 'minute')).toHaveAttribute('data-active', '');
    await field.press('ArrowRight');
    await field.press('ArrowRight'); // after "0 "
    await expect(cell(page, 'hour')).toHaveAttribute('data-active', '');
    await field.press('End');
    await expect(cell(page, 'dayOfWeek')).toHaveAttribute('data-active', '');
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-slot=cron-editor-fields] [data-active]')).toHaveCount(0);
  });

  test('presets set the expression, with the matching chip pressed', async ({ page }) => {
    await openDemo(page, 'cron-editor/basic', ROOT);
    const hourly = page.getByRole('button', { name: 'Hourly' });
    await expect(page.getByRole('button', { name: 'Weekdays at 9:00' })).toHaveAttribute('aria-pressed', 'true');
    await hourly.click();
    await expect(expression(page)).toHaveValue('0 * * * *');
    await expect(hourly).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'Weekdays at 9:00' })).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('code', { hasText: '0 * * * *' })).toBeVisible(); // the parent's value
    await expect.poll(() => runs(page)).toEqual([
      'Fri, Oct 2, 2026, 11:00 AM',
      'Fri, Oct 2, 2026, 12:00 PM',
      'Fri, Oct 2, 2026, 1:00 PM',
      'Fri, Oct 2, 2026, 2:00 PM',
      'Fri, Oct 2, 2026, 3:00 PM',
    ]);
  });

  test('keyboard: a preset is reachable and pressed with Space', async ({ page }) => {
    await openDemo(page, 'cron-editor/basic', ROOT);
    const daily = page.getByRole('button', { name: 'Daily at 9:00' });
    await daily.focus();
    await page.keyboard.press('Space');
    await expect(expression(page)).toHaveValue('0 9 * * *');
  });

  test('daylight saving: a 02:30 job moves to 03:30 on the day clocks jump', async ({ page }) => {
    await openDemo(page, 'cron-editor/daylight-saving', ROOT);
    await expect.poll(() => runs(page)).toEqual([
      'Sat, Mar 7, 2026, 2:30 AM',
      'Sun, Mar 8, 2026, 3:30 AM',
      'Mon, Mar 9, 2026, 2:30 AM',
      'Tue, Mar 10, 2026, 2:30 AM',
    ]);
    await expect(page.locator('[data-slot=cron-editor-next]')).toContainText('Times in America/New_York.');
    await page.getByRole('button', { name: 'Every 30 min, 01:00–03:59' }).click();
    await expect.poll(() => runs(page)).toEqual(['Sat, Mar 7, 2026, 1:00 AM', 'Sat, Mar 7, 2026, 1:30 AM', 'Sat, Mar 7, 2026, 2:00 AM', 'Sat, Mar 7, 2026, 2:30 AM']);
  });

  test('an expression that never matches a date says so', async ({ page }) => {
    await openDemo(page, 'cron-editor/basic', ROOT);
    await typeInto(expression(page), '0 0 30 2 *');
    await expect(page.locator('[data-slot=cron-editor-next]')).toContainText('never matches a real date');
  });

  test('raw-only demo: custom presets, names, and no note or box at all', async ({ page }) => {
    await openDemo(page, 'cron-editor/raw-only', ROOT);
    await expect(page.locator('[data-slot=cron-editor-note]')).toHaveCount(0);
    await expect(page.locator('[data-slot=cron-editor-natural]')).toHaveCount(0);
    // This demo labels the field "Schedule" and the plain variant drops the filled panels.
    await expect(page.getByRole('textbox', { name: 'Schedule' })).toHaveValue('*/15 9-17 * * mon-fri');
    await expect.poll(() => runs(page)).toEqual([
      'Fri, Oct 2, 2026, 10:15 AM',
      'Fri, Oct 2, 2026, 10:30 AM',
      'Fri, Oct 2, 2026, 10:45 AM',
      'Fri, Oct 2, 2026, 11:00 AM',
    ]);
    await page.getByRole('button', { name: 'Weekends at 10:00' }).click();
    await expect.poll(() => runs(page)).toEqual(['Sat, Oct 3, 2026, 10:00 AM', 'Sun, Oct 4, 2026, 10:00 AM', 'Sat, Oct 10, 2026, 10:00 AM', 'Sun, Oct 11, 2026, 10:00 AM']);
  });

  test('useCronParse says there is no WebGPU instead of offering a box', async ({ page }) => {
    await openDemo(page, 'cron-editor/use-cron-parse', 'p');
    await expect(page.getByText('This browser has no WebGPU')).toBeVisible();
    await expect(page.getByRole('textbox')).toHaveCount(0);
  });
});

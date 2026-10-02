import { test, expect } from '@playwright/test';
import { openDemo } from './helpers.mjs';

/* TimeInput (docs demos `time-input/*`): real typing into the field, the preview it produces, and the promise that it
   works without WebGPU and downloads gpu-time only once a TimeInput is on the page. The demos pin "now" (Wednesday
   9 September 2026, 12:00 in Dhaka) and the zone, and gpu-time runs on the CPU, so every answer is deterministic. */
const ROOT = '[data-slot=time-input]';
const PREVIEW = '[data-slot=time-input-preview]';

/** Replaces the field's text by typing, key by key. */
async function typeInto(field, text) {
  await field.click();
  await field.press('ControlOrMeta+a');
  if (text === '') await field.press('Backspace');
  else await field.pressSequentially(text, { delay: 8 });
}
const items = (page, slot) => page.locator(`[data-slot=${slot}] li`);
/** ICU puts a narrow no-break space before AM/PM and spaces around the en dash; compare on plain spaces. */
const plain = (s) => s.replace(/[\u202f\u2009\u00a0]/g, ' ');
const texts = async (locator) => (await locator.allTextContents()).map(plain);

test.describe('basic demo', () => {
  test.beforeEach(async ({ page }) => {
    await openDemo(page, 'time-input/basic', ROOT);
  });

  test('reads the default text on load and lists what it found', async ({ page }) => {
    await expect(page.locator(PREVIEW)).toBeVisible();
    await expect.poll(async () => texts(items(page, 'time-input-occurrences'))).toEqual([
      'Sat, Sep 12, 2026, 1:00 – 8:00 PM',
      'Sun, Sep 13, 2026, 1:00 – 8:00 PM',
      'Mon, Sep 14, 2026, 10:00 PM – Tue, Sep 15, 2026, 12:00 AM',
    ]);
    await expect(page.locator(PREVIEW)).toContainText('Times in Asia/Dhaka');
    await expect(page.getByRole('status')).toHaveText('3 dates found.');
  });

  test('typing replaces the preview with the new reading', async ({ page }) => {
    await typeInto(page.getByRole('textbox', { name: 'When' }), 'tomorrow at 3pm');
    await expect.poll(async () => texts(items(page, 'time-input-occurrences'))).toEqual(['Thu, Sep 10, 2026, 3:00 PM']);
    await expect(page.getByRole('status')).toHaveText('1 date found.');
  });

  test('highlights only the words it recognised', async ({ page }) => {
    await typeInto(page.getByRole('textbox', { name: 'When' }), 'meet me thurs 2-3pm ok');
    const marks = page.locator('[data-slot=time-input-recognized] mark');
    await expect(marks).toHaveText(['thurs 2-3pm']);
    await expect(page.locator('[data-slot=time-input-recognized]')).toHaveText('Recognized: meet me thurs 2-3pm ok');
  });

  test('says so when nothing is recognised, then recovers', async ({ page }) => {
    const field = page.getByRole('textbox', { name: 'When' });
    await typeInto(field, 'gibberish xyz');
    await expect(page.locator(PREVIEW)).toContainText('No date or time found in that text.');
    await expect(page.locator('[data-slot=time-input-occurrences]')).toHaveCount(0);
    await typeInto(field, 'noon');
    await expect.poll(async () => texts(items(page, 'time-input-occurrences'))).toEqual(['Wed, Sep 9, 2026, 12:00 PM']);
  });

  test('clearing the field removes the preview', async ({ page }) => {
    await typeInto(page.getByRole('textbox', { name: 'When' }), '');
    await expect(page.locator(PREVIEW)).toHaveCount(0);
    await expect(page.locator(ROOT)).not.toHaveAttribute('data-pending', /.*/);
  });

  test('is keyboard-reachable, labelled, and described by its preview', async ({ page }) => {
    const field = page.getByRole('textbox', { name: 'When' });
    for (let i = 0; i < 3 && !(await field.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press('Tab');
    await expect(field).toBeFocused();
    const describedBy = await field.getAttribute('aria-describedby');
    const previewId = await page.locator(PREVIEW).getAttribute('id');
    expect(describedBy.split(' ')).toContain(previewId);
  });

  test('keeps the old preview, dimmed, while a new one is being read, and never shows offsets of old text', async ({ page }) => {
    const field = page.getByRole('textbox', { name: 'When' });
    await field.click();
    await field.press('ControlOrMeta+a');
    // One key, then look at once (a single round trip): the 120 ms debounce has not fired yet.
    await field.press('t');
    const during = await page.evaluate(() => ({
      stale: document.querySelector('[data-slot=time-input-preview]')?.hasAttribute('data-stale'),
      pending: document.querySelector('[data-slot=time-input]')?.hasAttribute('data-pending'),
      recognized: document.querySelectorAll('[data-slot=time-input-recognized]').length,
    }));
    expect(during).toEqual({ stale: true, pending: true, recognized: 0 });
    await expect(page.locator(PREVIEW)).not.toHaveAttribute('data-stale', '');
  });
});

test.describe('other demos', () => {
  test('recurrence: a Repeats chip in words, the raw rule as its tooltip, the CPU backend', async ({ page }) => {
    await openDemo(page, 'time-input/recurrence', ROOT);
    const chip = page.locator('[data-slot=time-input-repeats] [data-slot=badge]');
    await expect(chip).toHaveText(/Repeats\s*Every weekday at 9:00\sAM/);
    await expect(chip).toHaveAttribute('title', 'RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,TU,WE,TH,FR');
    await expect.poll(async () => texts(items(page, 'time-input-occurrences'))).toEqual([
      'Thu, Sep 10, 2026, 9:00 AM',
      'Fri, Sep 11, 2026, 9:00 AM',
      'Mon, Sep 14, 2026, 9:00 AM',
      'Tue, Sep 15, 2026, 9:00 AM',
      'and more',
    ]);
    await expect(page.locator('[data-backend-label]')).toHaveText('CPU');
    await expect(page.locator(ROOT)).toHaveAttribute('data-backend', 'cpu');

    await typeInto(page.getByRole('textbox', { name: 'Repeats' }), 'every other tuesday');
    await expect(chip).toHaveText(/Every 2 weeks on Tuesday/);
  });

  test('date-order: the same text reads as March 4 or April 3', async ({ page }) => {
    await openDemo(page, 'time-input/date-order', ROOT);
    await expect.poll(async () => texts(page.locator('[data-slot=time-input-occurrences] li'))).toEqual(['Thu, Mar 4, 2027', 'Sat, Apr 3, 2027']);
  });

  test('controlled: the parent sees each keystroke and then the settled result', async ({ page }) => {
    await openDemo(page, 'time-input/controlled', ROOT);
    const start = page.locator('code');
    await expect(start).toHaveText('2026-09-10T15:00:00+06:00');
    await typeInto(page.getByRole('textbox', { name: 'Reminder' }), 'noon');
    await expect(page.getByRole('textbox', { name: 'Reminder' })).toHaveValue('noon');
    await expect(start).toHaveText('2026-09-09T12:00:00+06:00');
  });

  test('limits: shows the resolved date so a wrong reading is visible', async ({ page }) => {
    await openDemo(page, 'time-input/limits', ROOT);
    // Whatever the model reads, the preview lists a concrete date for each field.
    await expect(page.locator('[data-slot=time-input-occurrences]')).toHaveCount(2);
  });

  test('useTimeParse: your own UI on the hook', async ({ page }) => {
    await openDemo(page, 'time-input/use-time-parse', 'input');
    await expect(page.getByText(/Reminder set for/)).toContainText('Wed, Sep 9, 2026');
    await typeInto(page.getByRole('textbox', { name: 'Remind me' }), 'gibberish xyz');
    await expect(page.getByText('No date or time found.')).toBeVisible();
  });
});

test.describe('without WebGPU', () => {
  test.beforeEach(async ({ page }) => {
    // What a browser without WebGPU looks like to the page.
    await page.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, 'gpu', { get: () => undefined, configurable: true });
    });
  });

  test('parses and previews exactly the same', async ({ page }) => {
    expect(await page.evaluate(() => 'gpu' in navigator && !!navigator.gpu)).toBe(false);
    await openDemo(page, 'time-input/basic', ROOT);
    await expect.poll(async () => (await texts(items(page, 'time-input-occurrences'))).length).toBe(3);
    await typeInto(page.getByRole('textbox', { name: 'When' }), 'every weekday at 9am');
    await expect(page.locator('[data-slot=time-input-repeats]')).toContainText('Every weekday at 9:00');
    await expect(page.locator(ROOT)).toHaveAttribute('data-backend', 'cpu');
  });
});

test.describe('loading', () => {
  test('gpu-time is not downloaded by a page without a TimeInput, and is once one is mounted', async ({ page }) => {
    const urls = [];
    page.on('request', (r) => urls.push(r.url()));
    await openDemo(page, 'text-field/anatomy', '[data-slot=text-field]');
    await page.waitForTimeout(500);
    expect(urls.filter((u) => /node_modules\/[^?]*(gpu-time|gpu-cron|cronstrue)/.test(u))).toEqual([]);

    await openDemo(page, 'time-input/basic', ROOT);
    await expect(page.locator(PREVIEW)).toBeVisible();
    expect(urls.some((u) => /node_modules\/[^?]*gpu-time/.test(u))).toBe(true);
    expect(urls.some((u) => /node_modules\/[^?]*gpu-cron/.test(u))).toBe(false);
  });

  test('typing raises no page errors or console errors', async ({ page }) => {
    const problems = [];
    page.on('pageerror', (e) => problems.push(String(e)));
    page.on('console', (m) => m.type() === 'error' && problems.push(m.text()));
    await openDemo(page, 'time-input/basic', ROOT);
    await typeInto(page.getByRole('textbox', { name: 'When' }), 'every other tuesday at 5pm');
    await expect(page.locator('[data-slot=time-input-repeats]')).toBeVisible();
    expect(problems).toEqual([]);
  });
});

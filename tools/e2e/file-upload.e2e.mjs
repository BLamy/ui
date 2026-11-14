import { test, expect } from '@playwright/test';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDemo } from './helpers.mjs';

/* FileUpload against the docs examples (apps/docs/examples/file-upload/*): FileInput's hidden input, a real drop
   (a script-built DataTransfer through dragenter / dragover / drop), validation, progress, retry, remove,
   keyboard-only operation and paste. The examples talk to a mock `upload` with timers: no network. */
const ZONE = '[data-slot=file-input-dropzone]';
// Listed files are FileInputItems, rejected ones groups; both carry the row's id.
const ROW = '[data-file-id]';
const REMOVE = '[data-slot=file-input-item-remove]';
// UI SDK's polite live region.
const STATUS = '[data-ui-sdk-announcer=""]';
// 1×1 transparent PNG: a real image, so the thumbnail decodes.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

const file = (name, mimeType = 'text/plain', size = 8) => ({ name, mimeType, buffer: Buffer.alloc(size, 97) });
const input = (page) => page.locator('input[type=file]');
const row = (page, name) => page.locator(ROW).filter({ hasText: name });

/** A real drop: dragenter, dragover, then drop on the zone, carrying files in a DataTransfer. */
async function drag(page, specs, { release = true, zone = ZONE } = {}) {
  const dt = await page.evaluateHandle((list) => {
    const d = new DataTransfer();
    for (const s of list) d.items.add(new File([new Uint8Array(s.size ?? 8)], s.name, { type: s.type ?? 'text/plain' }));
    return d;
  }, specs);
  const target = page.locator(zone);
  await target.dispatchEvent('dragenter', { dataTransfer: dt });
  await target.dispatchEvent('dragover', { dataTransfer: dt });
  if (release) await target.dispatchEvent('drop', { dataTransfer: dt });
  return dt;
}

test.describe('basic', () => {
  test.beforeEach(async ({ page }) => {
    await openDemo(page, 'file-upload/basic', ZONE);
  });

  test('choosing files through the hidden input lists them and sends them', async ({ page }) => {
    await input(page).setInputFiles([file('notes.txt'), file('report.pdf', 'application/pdf', 2048)]);
    await expect(page.locator(ROW)).toHaveCount(2);
    await expect(row(page, 'report.pdf')).toContainText('2 kB');
    await expect(row(page, 'notes.txt')).toHaveAttribute('data-status', 'done', { timeout: 8000 });
    await expect(row(page, 'report.pdf')).toHaveAttribute('data-status', 'done', { timeout: 8000 });
    await expect(row(page, 'notes.txt')).toContainText('Uploaded');
  });

  test('dragging files over the zone shows the drop state, leaving clears it, dropping adds them', async ({ page }) => {
    const dt = await drag(page, [file('dropped.txt')], { release: false });
    await expect(page.locator(ZONE)).toHaveAttribute('data-dragging', '');
    await expect(page.locator(ZONE)).toContainText('Drop to add');
    await page.locator(ZONE).dispatchEvent('dragleave', { dataTransfer: dt });
    await expect(page.locator(ZONE)).not.toHaveAttribute('data-dragging');
    await drag(page, [file('dropped.txt'), file('second.txt')]);
    await expect(page.locator(ZONE)).not.toHaveAttribute('data-dragging');
    await expect(page.locator(ROW)).toHaveCount(2);
    await expect(row(page, 'dropped.txt')).toBeVisible();
  });

  test('a file reports real progress, then is done; the live region announces it once', async ({ page }) => {
    await input(page).setInputFiles(file('slow.txt'));
    const bar = row(page, 'slow.txt').getByRole('progressbar', { name: 'Uploading slow.txt' });
    await expect(bar).toBeVisible();
    await expect.poll(async () => Number(await bar.getAttribute('aria-valuenow'))).toBeGreaterThan(0);
    await expect(row(page, 'slow.txt')).toHaveAttribute('data-status', 'done', { timeout: 8000 });
    await expect(bar).toHaveCount(0);
    await expect(page.locator(STATUS)).toContainText('slow.txt uploaded');
  });

  test('a failed upload shows its reason with Retry, and Retry sends it again', async ({ page }) => {
    await input(page).setInputFiles(file('fail-me.txt'));
    const r = row(page, 'fail-me.txt');
    await expect(r).toHaveAttribute('data-status', 'error', { timeout: 8000 });
    await expect(r).toContainText('Upload failed');
    await expect(r).toContainText('Connection lost');
    await expect(page.locator(STATUS)).toContainText('fail-me.txt failed to upload');
    await r.getByRole('button', { name: 'Retry fail-me.txt' }).click();
    await expect(r).toHaveAttribute('data-status', 'done', { timeout: 8000 });
  });

  test('the list is one Tab stop: arrows move between rows, Delete removes the focused one and focus moves on', async ({ page }) => {
    await input(page).setInputFiles([file('one.txt'), file('two.txt'), file('three.txt')]);
    await expect(page.locator(ROW)).toHaveCount(3);
    await row(page, 'one.txt').focus();
    await page.keyboard.press('ArrowDown');
    await expect(row(page, 'two.txt')).toBeFocused();
    await page.keyboard.press('Delete');
    await expect(page.locator(ROW)).toHaveCount(2);
    await expect(page.locator(STATUS)).toContainText('two.txt removed');
    await expect(row(page, 'three.txt')).toBeFocused();
    await expect(row(page, 'three.txt').locator(REMOVE)).toHaveAttribute('tabindex', '-1');
  });

  test('cancelling an upload in flight removes it and it never completes', async ({ page }) => {
    await input(page).setInputFiles(file('cancel-me.txt'));
    await row(page, 'cancel-me.txt').getByRole('button', { name: 'Cancel upload of cancel-me.txt' }).click();
    await expect(page.locator(ROW)).toHaveCount(0);
    await page.waitForTimeout(1800);
    await expect(page.locator(ROW)).toHaveCount(0);
    await expect(page.locator(STATUS)).not.toContainText('uploaded');
  });

  test('keyboard only: Tab to the zone, Enter and Space open the chooser', async ({ page }) => {
    const browse = page.getByRole('button', { name: 'Browse files' });
    for (let i = 0; i < 4 && !(await browse.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press('Tab');
    await expect(browse).toBeFocused();
    for (const key of ['Enter', 'Space']) {
      const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.keyboard.press(key)]);
      expect(chooser.isMultiple()).toBe(true);
      await chooser.setFiles(file(`via-${key}.txt`));
      await expect(row(page, `via-${key}.txt`)).toBeVisible();
    }
  });

  test('the list is a labelled list of items', async ({ page }) => {
    await input(page).setInputFiles(file('a.txt'));
    await expect(page.getByRole('list', { name: 'Files' }).getByRole('listitem')).toHaveCount(1);
  });
});

test.describe('validation', () => {
  test.beforeEach(async ({ page }) => {
    await openDemo(page, 'file-upload/validation', ZONE);
  });

  test('files that break a rule stay in the list with the reason, and can be dismissed', async ({ page }) => {
    await input(page).setInputFiles([
      file('archive.zip', 'application/zip'),
      file('huge.png', 'image/png', 3 * 1024 * 1024),
      file('my photo.png', 'image/png'),
      file('ok.png', 'image/png'),
    ]);
    await expect(page.locator(`${ROW}[data-status=rejected]`)).toHaveCount(3);
    await expect(row(page, 'archive.zip')).toContainText('Unsupported file type');
    await expect(row(page, 'huge.png')).toContainText('Larger than the 2 MB limit');
    await expect(row(page, 'my photo.png')).toContainText('Rename it without spaces first.');
    await expect(row(page, 'archive.zip')).toContainText('Not added');
    await expect(row(page, 'ok.png')).toHaveAttribute('data-status', /uploading|done/);
    await expect(page.locator(STATUS)).toContainText('3 files rejected');
    await row(page, 'archive.zip').getByRole('button', { name: 'Dismiss archive.zip' }).click();
    await expect(page.locator(ROW)).toHaveCount(3);
  });

  test('more files than allowed are turned away past the limit', async ({ page }) => {
    await input(page).setInputFiles([file('1.png', 'image/png'), file('2.png', 'image/png'), file('3.png', 'image/png'), file('4.png', 'image/png')]);
    await expect(row(page, '4.png')).toContainText('Only 3 files are allowed');
    await expect(row(page, '3.png')).not.toHaveAttribute('data-status', 'rejected');
  });

  test('a drop is validated the same way', async ({ page }) => {
    await drag(page, [{ name: 'movie.mov', type: 'video/quicktime' }]);
    await expect(row(page, 'movie.mov')).toContainText('Unsupported file type');
  });
});

test.describe('images', () => {
  test('image files get a thumbnail whose object URL is revoked when the row is removed', async ({ page }) => {
    await openDemo(page, 'file-upload/images', ZONE);
    await input(page).first().setInputFiles({ name: 'dot.png', mimeType: 'image/png', buffer: PNG });
    const img = row(page, 'dot.png').locator('img');
    await expect(img).toHaveAttribute('src', /^blob:/);
    const src = await img.getAttribute('src');
    expect(await page.evaluate((u) => fetch(u).then(() => 'alive', () => 'revoked'), src)).toBe('alive');
    await row(page, 'dot.png').locator(REMOVE).click();
    await expect(page.locator(ROW)).toHaveCount(0);
    await expect.poll(() => page.evaluate((u) => fetch(u).then(() => 'alive', () => 'revoked'), src)).toBe('revoked');
  });
});

test.describe('controlled', () => {
  test('nothing is sent until the outside Submit button calls uploadAll', async ({ page }) => {
    await openDemo(page, 'file-upload/controlled', ZONE);
    await input(page).setInputFiles([file('a.txt'), file('b.txt')]);
    await expect(page.locator(ROW)).toHaveCount(2);
    await expect(row(page, 'a.txt')).toHaveAttribute('data-status', 'queued');
    await page.waitForTimeout(700);
    await expect(row(page, 'a.txt')).toHaveAttribute('data-status', 'queued');
    const submit = page.getByRole('button', { name: 'Submit 2 files' });
    await submit.click();
    await expect(row(page, 'a.txt')).toHaveAttribute('data-status', 'done', { timeout: 8000 });
    await expect(row(page, 'b.txt')).toHaveAttribute('data-status', 'done', { timeout: 8000 });
    await expect(page.locator('[data-slot=summary]')).toHaveText('2 of 2 sent');
  });
});

test.describe('paste', () => {
  test.beforeEach(async ({ page }) => {
    await openDemo(page, 'file-upload/paste', ZONE);
  });

  test('a paste event with an image, while the Browse button has focus, adds it', async ({ page }) => {
    await page.getByRole('button', { name: 'Browse files' }).focus();
    await page.evaluate(() => {
      const dt = new DataTransfer();
      dt.items.add(new File([new Uint8Array(16)], 'pasted.png', { type: 'image/png' }));
      document.activeElement.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    });
    await expect(row(page, 'pasted.png')).toBeVisible();
    await expect(page.locator(STATUS)).toContainText('1 file added');
  });

  test('a real clipboard image pasted with the keyboard is taken too', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium', 'clipboard permissions are Chromium-only');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.getByRole('button', { name: 'Browse files' }).focus();
    await page.evaluate(async (b64) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': new Blob([bytes], { type: 'image/png' }) })]);
    }, PNG.toString('base64'));
    await page.keyboard.press('ControlOrMeta+V');
    await expect(page.locator(ROW)).toHaveCount(1);
    await expect(page.locator(`${ROW} img`)).toHaveAttribute('src', /^blob:/);
  });

  test('without focus in the zone nothing is pasted in', async ({ page }) => {
    await page.locator('body').click({ position: { x: 2, y: 2 } });
    await page.evaluate(() => {
      const dt = new DataTransfer();
      dt.items.add(new File([new Uint8Array(16)], 'stray.png', { type: 'image/png' }));
      document.body.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    });
    await page.waitForTimeout(500);
    await expect(page.locator(ROW)).toHaveCount(0);
  });
});

/* The audit script only sees the empty states; these run axe on the busy ones (every row status, light and dark). */
const AXE = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
const RULES = { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } };
async function violations(page) {
  await page.addScriptTag({ content: AXE });
  return page.evaluate(async (rules) => (await window.axe.run(document, rules)).violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`), RULES);
}

test.describe('accessibility with rows on screen', () => {
  for (const theme of ['light', 'dark']) {
    test(`uploading, done, failed and rejected rows pass axe (${theme})`, async ({ page }) => {
      await page.goto(`/?demo=file-upload/validation&theme=${theme}`, { waitUntil: 'load' });
      await page.locator(ZONE).waitFor();
      await input(page).setInputFiles([file('a.png', 'image/png'), file('b.zip', 'application/zip'), file('c d.png', 'image/png')]);
      await expect(page.locator(`${ROW}[data-status=rejected]`)).toHaveCount(2);
      await expect(row(page, 'a.png').getByRole('progressbar')).toBeVisible();
      expect(await violations(page)).toEqual([]);
      await expect(row(page, 'a.png')).toHaveAttribute('data-status', 'done', { timeout: 8000 });
      expect(await violations(page)).toEqual([]);
      await page.goto(`/?demo=file-upload/basic&theme=${theme}`, { waitUntil: 'load' });
      await page.locator(ZONE).waitFor();
      await input(page).setInputFiles(file('fail-me.txt'));
      await expect(row(page, 'fail-me.txt')).toHaveAttribute('data-status', 'error', { timeout: 8000 });
      expect(await violations(page)).toEqual([]);
    });
  }
});

test.describe('folders', () => {
  // UI SDK skips system files in dropped folders but not in a picked one, so .DS_Store is listed here (see the
  // toast-files gaps note).
  test('a chosen folder is flattened into its files with relative paths', async ({ page }) => {
    await openDemo(page, 'file-upload/folder', ZONE);
    const root = mkdtempSync(join(tmpdir(), 'fu-'));
    const dir = join(root, 'photos');
    mkdirSync(join(dir, '2024'), { recursive: true });
    writeFileSync(join(dir, 'a.txt'), 'a');
    writeFileSync(join(dir, '.DS_Store'), 'x');
    writeFileSync(join(dir, '2024', 'b.txt'), 'b');
    await input(page).setInputFiles(dir);
    await expect(page.locator(ROW)).toHaveCount(3);
    await expect(page.locator(`${ROW} [title="photos/a.txt"]`)).toBeVisible();
    await expect(page.locator(`${ROW} [title="photos/2024/b.txt"]`)).toBeVisible();
    await expect(row(page, 'b.txt')).toContainText('photos/2024');
  });
});

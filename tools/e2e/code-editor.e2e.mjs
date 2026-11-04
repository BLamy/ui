import { test, expect } from '@playwright/test';
import { openHarness } from './helpers.mjs';

/* CodeEditor with real input in real Chromium: what the hidden textarea, the browser's events and an input method actually do. An
   input method is driven through the DevTools protocol, the only way to get real composition events. The harness in
   apps/docs/src/e2e-harness.tsx says what to edit, and exposes the text and the changes on `window.__editor`. */

const open = async (page, query = '') => {
  await page.goto(`/?harness=code-editor&theme=light${query ? `&${query}` : ''}`, { waitUntil: 'load' });
  await page.locator('[data-harness-ready]').waitFor({ timeout: 30_000 });
  await page.locator('[data-slot="code-editor-line"], [data-slot="code-editor-content"] .bl-syntax-line').first().waitFor({ timeout: 30_000 });
};
const input = (page) => page.locator('[data-slot="code-editor-input"]');
const value = (page) => page.evaluate(() => window.__editor.handle.current.getValue());
const selection = (page) => page.evaluate(() => window.__editor.handle.current.getSelection());
const setSelection = (page, anchor, focus = anchor) => page.evaluate(([a, f]) => window.__editor.handle.current.setSelection({ anchor: { line: a[0], column: a[1] }, focus: { line: f[0], column: f[1] } }), [anchor, focus]);
const focus = (page) => page.evaluate(() => window.__editor.handle.current.focus());
const changes = (page) => page.evaluate(() => window.__editor.changes.current);
const lineText = (page, line) => page.locator(`[data-slot="code-editor-line"][data-line="${line}"] [data-slot="code-editor-text"]`).textContent();
const mod = process.platform === 'darwin' ? 'Meta' : 'Control';

/** Puts the caret somewhere and gives the editor the focus. */
async function caretAt(page, line, column) {
  await setSelection(page, [line, column]);
  await focus(page);
  await expect(input(page)).toBeFocused();
}

test.describe('typing', () => {
  test('goes in at the caret, by clicking and by keys, with the focus on the real input', async ({ page }) => {
    await open(page);
    const box = await page.locator('[data-slot="code-editor-line"][data-line="1"] [data-slot="code-editor-text"]').boundingBox();
    await page.mouse.click(box.x + 2, box.y + box.height / 2);
    await expect(input(page)).toBeFocused();
    await page.keyboard.type('// hi\n');
    expect(await value(page)).toBe('// hi\nfunction greet(name) {\n  return `Hello, ${name}`;\n}\n\ngreet("world");');
    expect(await lineText(page, 1)).toBe('// hi');
    expect(await selection(page)).toEqual({ anchor: { line: 2, column: 0 }, focus: { line: 2, column: 0 } });
  });

  test('is a labelled multi-line textbox', async ({ page }) => {
    await open(page);
    const el = input(page);
    await expect(el).toHaveAttribute('role', 'textbox');
    await expect(el).toHaveAttribute('aria-multiline', 'true');
    await expect(el).toHaveAttribute('aria-readonly', 'false');
    await expect(el).toHaveAttribute('aria-label', 'the code');
    expect(await el.evaluate((n) => n.tagName)).toBe('TEXTAREA');
  });

  test('a read-only source has no input, and says it is a region', async ({ page }) => {
    await open(page, 'readOnly=1&windowed=1');
    await expect(input(page)).toHaveCount(0);
    await expect(page.locator('[data-slot="code-editor-content"]')).toHaveAttribute('role', 'region');
    const before = await value(page);
    await page.locator('[data-slot="code-editor-content"]').click();
    await page.keyboard.type('nothing');
    expect(await value(page)).toBe(before);
  });

  test('has a caret where the selection is, that blinks unless motion is reduced', async ({ page }) => {
    await open(page);
    await caretAt(page, 1, 3);
    const caret = page.locator('[data-slot="code-editor-caret"]');
    await expect(caret).toHaveCount(1);
    expect(await caret.evaluate((n) => getComputedStyle(n).animationName)).toBe('blCodeCaret');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    expect(await caret.evaluate((n) => getComputedStyle(n).animationName)).toBe('none');
    await page.locator('[data-testid="after"]').focus();
    await expect(caret).toHaveCount(0);
  });

  test('keeps the caret in view going sideways and down', async ({ page }) => {
    await open(page, 'doc=long');
    await caretAt(page, 2, 0);
    await page.keyboard.press('End');
    const root = page.locator('[data-slot="code-editor-content"]');
    await expect.poll(() => root.evaluate((n) => n.scrollLeft)).toBeGreaterThan(1000);
    await page.keyboard.type('!!!');
    const caret = await page.locator('[data-slot="code-editor-caret"]').boundingBox();
    const view = await root.boundingBox();
    expect(caret.x).toBeGreaterThan(view.x);
    expect(caret.x).toBeLessThan(view.x + view.width);
    await page.keyboard.press('Home');
    await page.keyboard.press('Home');
    await expect.poll(() => root.evaluate((n) => n.scrollLeft)).toBe(0);
  });
});

test.describe('an input method', () => {
  test('shows what is being composed in place, tells nobody, and commits it as one edit', async ({ page }) => {
    await open(page);
    await caretAt(page, 1, 8);
    const before = await value(page);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.imeSetComposition', { text: 'に', selectionStart: 1, selectionEnd: 1 });
    await expect.poll(() => lineText(page, 1)).toBe('functionに greet(name) {');
    await expect(page.locator('[data-slot="code-editor-composing"]')).toHaveCount(1);
    await cdp.send('Input.imeSetComposition', { text: 'にほん', selectionStart: 3, selectionEnd: 3 });
    await expect.poll(() => lineText(page, 1)).toBe('functionにほん greet(name) {');
    expect(await changes(page)).toEqual([]);
    await cdp.send('Input.insertText', { text: '日本' });
    await expect.poll(() => lineText(page, 1)).toBe('function日本 greet(name) {');
    await expect(page.locator('[data-slot="code-editor-composing"]')).toHaveCount(0);
    expect(await value(page)).toBe(before.replace('function', 'function日本'));
    const reported = await changes(page);
    expect(reported.length).toBe(1);
    expect(reported[0]).toMatchObject({ text: '日本', origin: 'composition', from: { line: 1, column: 8 } });
    // And it carries on as normal text, and goes back as one step.
    await page.keyboard.type('x');
    expect((await value(page)).startsWith('function日本x greet')).toBe(true);
    await page.keyboard.press(`${mod}+z`);
    await page.keyboard.press(`${mod}+z`);
    expect(await value(page)).toBe(before);
  });

  test('takes a dead key: the accent, then the letter it lands on', async ({ page }) => {
    await open(page, 'doc=empty');
    await caretAt(page, 1, 0);
    await page.keyboard.type('caf');
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.imeSetComposition', { text: '´', selectionStart: 1, selectionEnd: 1 });
    await expect.poll(() => lineText(page, 1)).toBe('caf´');
    await cdp.send('Input.imeSetComposition', { text: 'é', selectionStart: 1, selectionEnd: 1 });
    await cdp.send('Input.insertText', { text: 'é' });
    await expect.poll(() => value(page)).toBe('café');
  });

  test('replaces a selection when it starts, and puts it back if abandoned', async ({ page }) => {
    await open(page);
    await setSelection(page, [1, 0], [1, 8]);
    await focus(page);
    const before = await value(page);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.imeSetComposition', { text: 'ん', selectionStart: 1, selectionEnd: 1 });
    await expect.poll(() => lineText(page, 1)).toBe('ん greet(name) {');
    await cdp.send('Input.imeSetComposition', { text: '', selectionStart: 0, selectionEnd: 0 });
    await expect.poll(() => lineText(page, 1)).toBe('function greet(name) {');
    expect(await value(page)).toBe(before);
    expect(await changes(page)).toEqual([]);
  });
});

test.describe('paste, cut and copy', () => {
  test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

  test('paste goes in at the caret, replacing a selection, with its lines as lines', async ({ page }) => {
    await open(page);
    await page.evaluate(() => navigator.clipboard.writeText('one\r\ntwo\nthree'));
    await caretAt(page, 5, 0);
    await page.keyboard.press(`${mod}+v`);
    expect((await value(page)).endsWith('}\n\none\ntwo\nthreegreet("world");')).toBe(true);
    await expect.poll(async () => (await changes(page)).at(-1)?.origin).toBe('paste');
    await setSelection(page, [1, 0], [3, 1]);
    await page.keyboard.press(`${mod}+v`);
    expect((await value(page)).startsWith('one\ntwo\nthree\n\none')).toBe(true);
  });

  test('cut takes the selection, from the source, and copy leaves it', async ({ page }) => {
    await open(page);
    await setSelection(page, [2, 2], [2, 8]);
    await focus(page);
    await page.keyboard.press(`${mod}+c`);
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('return');
    expect((await value(page)).includes('return')).toBe(true);
    await page.keyboard.press(`${mod}+x`);
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('return');
    expect((await value(page)).includes('return')).toBe(false);
    expect((await changes(page)).at(-1).origin).toBe('cut');
  });

  test('copies the whole selection however little of it is on screen', async ({ page }) => {
    await open(page, 'doc=ninety');
    await focus(page);
    await page.keyboard.press(`${mod}+a`);
    await page.keyboard.press(`${mod}+c`);
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toBe(await value(page));
    expect(copied.split('\n').length).toBe(99);
  });

  test('a right click offers the input to the context menu, and it goes back after', async ({ page }) => {
    await open(page);
    await page.evaluate(() => {
      window.__menuOn = null;
      document.addEventListener('contextmenu', (e) => { window.__menuOn = e.target.tagName; }, true);
    });
    const box = await page.locator('[data-slot="code-editor-line"][data-line="2"] [data-slot="code-editor-text"]').boundingBox();
    await page.mouse.click(box.x + 30, box.y + 8, { button: 'right' });
    expect(await page.evaluate(() => window.__menuOn)).toBe('TEXTAREA');
    await expect.poll(() => input(page).evaluate((n) => n.style.pointerEvents)).toBe('');
    await page.keyboard.press('Escape');
  });
});

test.describe('undo and redo', () => {
  test('goes back a word at a time, and forward again', async ({ page }) => {
    await open(page, 'doc=empty');
    await caretAt(page, 1, 0);
    await page.keyboard.type('one two');
    expect(await value(page)).toBe('one two');
    await page.keyboard.press(`${mod}+z`);
    expect(await value(page)).toBe('one');
    await page.keyboard.press(`${mod}+z`);
    expect(await value(page)).toBe('');
    await page.keyboard.press(`${mod}+Shift+z`);
    expect(await value(page)).toBe('one');
    await page.keyboard.press(`${mod}+Shift+z`);
    expect(await value(page)).toBe('one two');
    expect((await changes(page)).at(-1).origin).toBe('redo');
  });

  test('moving the caret starts a new step, and undo puts the caret back', async ({ page }) => {
    await open(page, 'doc=empty');
    await caretAt(page, 1, 0);
    await page.keyboard.type('abc');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.type('X');
    expect(await value(page)).toBe('abXc');
    await page.keyboard.press(`${mod}+z`);
    expect(await value(page)).toBe('abc');
    expect(await selection(page)).toEqual({ anchor: { line: 1, column: 2 }, focus: { line: 1, column: 2 } });
  });

  test('puts back a deleted selection, selected', async ({ page }) => {
    await open(page);
    const before = await value(page);
    await setSelection(page, [1, 0], [3, 1]);
    await focus(page);
    await page.keyboard.press('Backspace');
    expect((await value(page)).startsWith('\n\ngreet')).toBe(true);
    await page.keyboard.press(`${mod}+z`);
    expect(await value(page)).toBe(before);
    expect(await selection(page)).toEqual({ anchor: { line: 1, column: 0 }, focus: { line: 3, column: 1 } });
  });
});

test.describe('keys', () => {
  test('Enter keeps the indent, and Tab uses the file\'s own', async ({ page }) => {
    await open(page);
    await caretAt(page, 2, 28);
    await page.keyboard.press('Enter');
    await page.keyboard.type('x');
    expect((await value(page)).split('\n')[2]).toBe('  x');
    await page.keyboard.press('Home');
    await page.keyboard.press('Home');
    await page.keyboard.press('Tab');
    expect((await value(page)).split('\n')[2]).toBe('    x');
    await page.keyboard.press('Shift+Tab');
    expect((await value(page)).split('\n')[2]).toBe('  x');
  });

  test('Tab indents selected lines with a tab in a file of tabs, and Shift+Tab takes it back', async ({ page }) => {
    await open(page, 'doc=tabs');
    const before = await value(page);
    await setSelection(page, [2, 1], [4, 1]);
    await focus(page);
    await page.keyboard.press('Tab');
    expect(await value(page)).toBe(['function f() {', '\t\tif (x) {', '\t\t\treturn 1;', '\t\t}', '}'].join('\n'));
    expect(await selection(page)).toEqual({ anchor: { line: 2, column: 0 }, focus: { line: 4, column: 3 } });
    await page.keyboard.press('Shift+Tab');
    expect(await value(page)).toBe(before);
  });

  test('Esc then Tab leaves the editor, both ways, so the keyboard is never trapped', async ({ page }) => {
    await open(page);
    await caretAt(page, 1, 0);
    const before = await value(page);
    await page.keyboard.press('Tab');
    expect(await value(page)).not.toBe(before);
    await expect(input(page)).toBeFocused();
    await page.keyboard.press('Escape');
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="after"]')).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(input(page)).toBeFocused();
    // It only lasts until the next key.
    await page.keyboard.press('Escape');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Tab');
    await expect(input(page)).toBeFocused();
    await page.keyboard.press('Escape');
    await page.keyboard.press('Shift+Tab');
    await expect(page.locator('[data-testid="before"]')).toBeFocused();
  });

  test('reaches the gutter buttons between the input and what comes after', async ({ page }) => {
    await open(page, 'gutters=1');
    await caretAt(page, 1, 0);
    await page.keyboard.press('Escape');
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-slot="code-editor-gutter-cell"][data-gutter="breakpoint"]').first()).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="after"]')).toBeFocused();
  });

  test('Backspace and Delete, by character, word and line', async ({ page }) => {
    await open(page, 'doc=empty');
    await caretAt(page, 1, 0);
    await page.keyboard.type('alpha beta gamma');
    await page.keyboard.press('Backspace');
    expect(await value(page)).toBe('alpha beta gamm');
    const word = process.platform === 'darwin' ? 'Alt' : 'Control';
    await page.keyboard.press(`${word}+Backspace`);
    expect(await value(page)).toBe('alpha beta ');
    await page.keyboard.press('Home');
    await page.keyboard.press('Home');
    await page.keyboard.press('Delete');
    expect(await value(page)).toBe('lpha beta ');
    await page.keyboard.press(`${word}+Delete`);
    expect(await value(page)).toBe(' beta ');
    if (process.platform === 'darwin') {
      await page.keyboard.press('Meta+Delete');
      expect(await value(page)).toBe('');
      await page.keyboard.type('more text');
      await page.keyboard.press('ArrowLeft');
      await page.keyboard.press('Meta+Backspace');
      expect(await value(page)).toBe('t');
    }
  });

  test('moves by word, line and page', async ({ page }) => {
    await open(page, 'doc=ninety');
    await caretAt(page, 1, 0);
    const word = process.platform === 'darwin' ? 'Alt' : 'Control';
    await page.keyboard.press(`${word}+ArrowRight`);
    expect((await selection(page)).focus).toEqual({ line: 1, column: 5 });
    await page.keyboard.press('End');
    expect((await selection(page)).focus.column).toBe('const line1 = 1;'.length);
    await page.keyboard.press('PageDown');
    const paged = (await selection(page)).focus.line;
    expect(paged).toBeGreaterThan(15);
    expect(paged).toBeLessThan(25);
    await page.keyboard.press('PageUp');
    expect((await selection(page)).focus.line).toBe(1);
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+ArrowDown' : 'Control+End');
    expect((await selection(page)).focus.line).toBe(99);
    await expect(page.locator('[data-slot="code-editor-line"][data-line="99"]')).toBeInViewport();
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+ArrowUp' : 'Control+Home');
    expect((await selection(page)).focus).toEqual({ line: 1, column: 0 });
  });
});

test.describe('selecting', () => {
  test('typing over a selection made with the keys', async ({ page }) => {
    await open(page);
    await caretAt(page, 1, 0);
    for (let i = 0; i < 8; i++) await page.keyboard.press('Shift+ArrowRight');
    await page.keyboard.type('const');
    expect((await value(page)).split('\n')[0]).toBe('const greet(name) {');
  });

  test('typing over a selection made with the mouse, across lines', async ({ page }) => {
    await open(page);
    const first = await page.locator('[data-slot="code-editor-line"][data-line="1"] [data-slot="code-editor-text"]').boundingBox();
    const third = await page.locator('[data-slot="code-editor-line"][data-line="3"] [data-slot="code-editor-text"]').boundingBox();
    await page.mouse.move(first.x + 1, first.y + 8);
    await page.mouse.down();
    await page.mouse.move(third.x + first.width, third.y + 8, { steps: 6 });
    await page.mouse.up();
    await expect(input(page)).toBeFocused();
    expect(await page.evaluate(() => window.__editor.handle.current.getSelectionText())).toBe('function greet(name) {\n  return `Hello, ${name}`;\n}');
    await page.keyboard.type('Z');
    expect(await value(page)).toBe('Z\n\ngreet("world");');
  });

  test('double click takes a word, and typing replaces it; an arrow leaves from its side', async ({ page }) => {
    await open(page);
    const line = await page.locator('[data-slot="code-editor-line"][data-line="5"] [data-slot="code-editor-text"]').boundingBox();
    await page.mouse.dblclick(line.x + 12, line.y + 8);
    expect(await page.evaluate(() => window.__editor.handle.current.getSelectionText())).toBe('greet');
    await page.keyboard.press('ArrowRight');
    expect((await selection(page)).focus).toEqual({ line: 5, column: 5 });
    // Soon after the last it would count as a third click.
    await page.waitForTimeout(500);
    await page.mouse.dblclick(line.x + 12, line.y + 8);
    await page.keyboard.type('hello');
    expect((await value(page)).endsWith('hello("world");')).toBe(true);
  });
});

test.describe('with wrapping on', () => {
  test('a line takes more rows as it grows, with the gutter only on the first', async ({ page }) => {
    await open(page, 'wrap=1&doc=small&gutters=1');
    await page.setViewportSize({ width: 500, height: 720 });
    await caretAt(page, 1, 22);
    const rowsOf = () => page.locator('[data-slot="code-editor-line"][data-line="1"]').count();
    expect(await rowsOf()).toBe(1);
    await page.keyboard.type(' and more text that runs on well past the width of the view, on and on');
    await expect.poll(rowsOf).toBeGreaterThan(1);
    await expect(page.locator('[data-slot="code-editor-gutter-row"][data-line="1"]')).toHaveCount(1);
    const caret = await page.locator('[data-slot="code-editor-caret"]').boundingBox();
    const view = await page.locator('[data-slot="code-editor-content"]').boundingBox();
    expect(caret.x + caret.width).toBeLessThanOrEqual(view.x + view.width);
    // It goes up a row, not a line, and back.
    const end = (await selection(page)).focus;
    await page.keyboard.press('ArrowUp');
    const up = (await selection(page)).focus;
    expect(up.line).toBe(1);
    expect(up.column).toBeLessThan(end.column);
    await page.keyboard.press('ArrowDown');
    expect((await selection(page)).focus).toEqual(end);
    // Lines below moved down with it.
    const second = await page.locator('[data-slot="code-editor-line"][data-line="2"]').boundingBox();
    const firstRow = await page.locator('[data-slot="code-editor-line"][data-line="1"]').first().boundingBox();
    expect(second.y).toBeGreaterThan(firstRow.y + 20);
  });

  test('a deleted line takes its rows with it', async ({ page }) => {
    await open(page, 'wrap=1&doc=long');
    const rows = await page.locator('[data-slot="code-editor-line"][data-line="2"]').count();
    expect(rows).toBeGreaterThan(3);
    await setSelection(page, [2, 0], [3, 0]);
    await focus(page);
    await page.keyboard.press('Backspace');
    await expect(page.locator('[data-slot="code-editor-line"][data-line="2"]')).toHaveCount(1);
    expect(await lineText(page, 2)).toBe('last line');
  });
});

test.describe('line counts changing', () => {
  test('gutters follow, and get wider when the numbers do', async ({ page }) => {
    await open(page, 'doc=ninety&gutters=1');
    await caretAt(page, 99, 0);
    const cell = page.locator('[data-slot="code-editor-gutter-cell"][data-gutter="line-number"]').last();
    const width = () => cell.evaluate((n) => n.getBoundingClientRect().width);
    const narrow = await width();
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-slot="code-editor-gutter-row"][data-line="100"]')).toHaveCount(1);
    await expect.poll(width).toBeGreaterThan(narrow);
    await page.keyboard.press('Backspace');
    await expect(page.locator('[data-slot="code-editor-gutter-row"][data-line="100"]')).toHaveCount(0);
    await expect.poll(width).toBe(narrow);
    // Up at the top: a new line pushes every row down, numbers and all.
    await caretAt(page, 3, 0);
    await page.keyboard.press('Enter');
    expect(await lineText(page, 4)).toBe('const line3 = 3;');
    await expect(page.locator('[data-slot="code-editor-gutter-row"][data-line="4"]')).toContainText('4');
    expect((await changes(page)).at(-1)).toMatchObject({ origin: 'newline', from: { line: 3, column: 0 }, to: { line: 3, column: 0 }, newTo: { line: 4, column: 0 } });
  });

  test('colors follow a comment opened and closed above', async ({ page }) => {
    await open(page);
    const tokens = (line) => page.locator(`[data-slot="code-editor-line"][data-line="${line}"] .bl-tok-comment`).count();
    await expect.poll(() => tokens(3)).toBe(0);
    await caretAt(page, 1, 0);
    await page.keyboard.type('/*');
    await expect.poll(() => tokens(3)).toBeGreaterThan(0);
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Backspace');
    await expect.poll(() => tokens(3)).toBe(0);
  });
});

test.describe('huge documents', () => {
  test('types at the end of half a million lines, without joining them', async ({ page }) => {
    await open(page, 'doc=many-lines');
    await focus(page);
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+ArrowDown' : 'Control+End');
    await expect(page.locator('[data-slot="code-editor-line"][data-line="500000"]')).toBeInViewport();
    await page.keyboard.type(' // the end');
    expect(await lineText(page, 500000)).toBe('const value499999 = compute(499999); // the end');
    await page.keyboard.press('Enter');
    await page.keyboard.type('one more');
    await expect(page.locator('[data-slot="code-editor-line"][data-line="500001"]')).toBeInViewport();
    expect(await lineText(page, 500001)).toBe('one more');
    await expect(page.locator('[data-slot="code-editor-gutter-row"][data-line="500001"]')).toContainText('500001');
    const recorded = await changes(page);
    expect(recorded.length).toBe(' // the end'.length + 1 + 'one more'.length);
    expect((await value(page)).endsWith('compute(499999); // the end\none more')).toBe(true);
    await page.keyboard.press(`${mod}+z`);
    await page.keyboard.press(`${mod}+z`);
    expect(await lineText(page, 500000)).toBe('const value499999 = compute(499999); // the end');
  });

  test('types in the middle of a megabyte line', async ({ page }) => {
    await open(page, 'doc=long-line');
    await page.evaluate(() => window.__editor.handle.current.scrollToLine(2, { column: 500_000, align: 'start' }));
    await caretAt(page, 2, 500_000);
    await page.keyboard.type('HELLO');
    const shown = await lineText(page, 2);
    expect(shown.length).toBeLessThan(2000);
    expect(shown).toContain('HELLO');
    const line = (await value(page)).split('\n')[1];
    expect(line.length).toBeGreaterThanOrEqual((1 << 20) + 5);
    expect(line.slice(500_000, 500_005)).toBe('HELLO');
    await page.keyboard.press(`${mod}+z`);
    expect((await value(page)).split('\n')[1].slice(500_000, 500_005)).not.toBe('HELLO');
  });
});

test.describe('huge edits', () => {
  test('selecting all of half a million lines, typing over it, and undoing it', async ({ page }) => {
    await open(page, 'doc=many-lines');
    const before = await value(page);
    await focus(page);
    await page.keyboard.press(`${mod}+a`);
    await page.keyboard.type('gone');
    expect(await value(page)).toBe('gone');
    await expect(page.locator('[data-slot="code-editor-line"]')).toHaveCount(1);
    await page.keyboard.press(`${mod}+z`);
    expect(await value(page)).toBe(before);
    // The selection is back, and the view goes to its moving end.
    await expect(page.locator('[data-slot="code-editor-gutter-row"][data-line="500000"]')).toBeVisible();
  });

  test('breaking a megabyte line in two, and joining it again', async ({ page }) => {
    await open(page, 'doc=long-line');
    const before = await value(page);
    await page.evaluate(() => window.__editor.handle.current.scrollToLine(2, { column: 500_000, align: 'start' }));
    await caretAt(page, 2, 500_000);
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-slot="code-editor-line"][data-line="4"]')).toHaveCount(1);
    expect((await value(page)).split('\n')[2].length).toBeGreaterThan(500_000);
    await page.keyboard.press('Backspace');
    expect(await value(page)).toBe(before);
  });

  test('pasting a hundred thousand lines, and getting the caret after them', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await open(page);
    const text = Array.from({ length: 100_000 }, (_, i) => `pasted ${i}`).join('\n');
    await page.evaluate((t) => navigator.clipboard.writeText(t), text);
    await caretAt(page, 1, 0);
    await page.keyboard.press(`${mod}+v`);
    expect((await selection(page)).focus).toEqual({ line: 100_000, column: 'pasted 99999'.length });
    await expect(page.locator('[data-slot="code-editor-gutter-row"][data-line="100000"]')).toBeVisible();
    expect(await lineText(page, 100000)).toBe('pasted 99999function greet(name) {');
    await page.keyboard.press(`${mod}+z`);
    expect((await value(page)).startsWith('function greet')).toBe(true);
  });
});

test.describe('its height', () => {
  test('follows its content with no height to fill, and adds a line when a line is added', async ({ page }) => {
    await open(page, 'auto=1');
    const frame = page.locator('[data-testid="frame"]');
    const before = (await frame.boundingBox()).height;
    expect(before).toBeLessThan(200);
    await caretAt(page, 5, 0);
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await frame.boundingBox()).height).toBe(before + 20);
    await expect(page.locator('[data-slot="code-editor-line"][data-line="6"]')).toBeInViewport();
  });

  test('stops following at a limit, and scrolls, so nothing is left blank', async ({ page }) => {
    await open(page, 'auto=1&doc=many-lines');
    const content = page.locator('[data-slot="code-editor-content"]');
    expect((await content.boundingBox()).height).toBe(8192);
    await page.evaluate(() => window.__editor.handle.current.scrollToLine(500_000));
    await expect(page.locator('[data-slot="code-editor-line"][data-line="500000"]')).toHaveCount(1);
  });
});

test.describe('the mouse', () => {
  test('a press on the gutter keeps the focus in the editor', async ({ page }) => {
    await open(page);
    await caretAt(page, 1, 0);
    const cell = await page.locator('[data-slot="code-editor-gutter-row"][data-line="3"]').boundingBox();
    await page.mouse.click(cell.x + 4, cell.y + 8);
    await expect(input(page)).toBeFocused();
    await page.keyboard.type('x');
    expect((await value(page)).startsWith('x')).toBe(true);
  });

  test('a press in a gutter button stays there, and it can do its job', async ({ page }) => {
    await open(page, 'gutters=1');
    await caretAt(page, 1, 0);
    const button = page.locator('[data-slot="code-editor-gutter-cell"][data-gutter="breakpoint"]').nth(2);
    await button.click();
    await expect(button).toBeFocused();
  });

  test('a press below the last line goes to the end of it', async ({ page }) => {
    await open(page);
    const view = await page.locator('[data-slot="code-editor-content"]').boundingBox();
    await page.mouse.click(view.x + 300, view.y + view.height - 10);
    await expect(input(page)).toBeFocused();
    expect((await selection(page)).focus).toEqual({ line: 5, column: 'greet("world");'.length });
  });

  test('a drag past the bottom scrolls, and selects as it goes', async ({ page }) => {
    await open(page, 'doc=ninety');
    const view = await page.locator('[data-slot="code-editor-content"]').boundingBox();
    await page.mouse.move(view.x + 100, view.y + 60);
    await page.mouse.down();
    await page.mouse.move(view.x + 100, view.y + view.height + 30, { steps: 4 });
    await expect.poll(() => page.locator('[data-slot="code-editor-content"]').evaluate((n) => n.scrollTop)).toBeGreaterThan(100);
    await page.mouse.up();
    const { anchor, focus: end } = await selection(page);
    expect(end.line).toBeGreaterThan(anchor.line + 10);
  });
});

test.describe('controlled', () => {
  test('takes back what it gave without parsing anything, and a new value keeps the caret where it means something', async ({ page }) => {
    await open(page, 'mode=controlled');
    await caretAt(page, 5, 0);
    await page.keyboard.type('ab');
    expect(await page.evaluate(() => window.__editor.value())).toBe(await value(page));
    expect(await page.evaluate(() => window.__editor.onChangeCalls.current)).toBe(2);
    // From outside: a line added above the caret, as a formatter might.
    await page.evaluate(() => window.__editor.setValue(`// new\n${window.__editor.value()}`));
    await expect.poll(() => value(page)).toContain('// new\nfunction');
    expect((await selection(page)).focus).toEqual({ line: 6, column: 2 });
    // A step in undo, like any other.
    await page.keyboard.press(`${mod}+z`);
    expect(await value(page)).not.toContain('// new');
  });

  test('takes back only what the host took: a host that changes the text wins', async ({ page }) => {
    await open(page, 'mode=upper&doc=empty');
    await caretAt(page, 1, 0);
    await page.keyboard.type('abc');
    await expect.poll(() => value(page)).toBe('ABC');
    expect((await selection(page)).focus).toEqual({ line: 1, column: 3 });
  });

  test('puts back an edit the host turned down, as an input does', async ({ page }) => {
    await open(page, 'mode=rejects');
    const before = await value(page);
    await caretAt(page, 1, 0);
    await page.keyboard.type('x');
    await expect.poll(() => value(page)).toBe(before);
    expect((await changes(page)).length).toBe(1);
    await page.keyboard.press(`${mod}+z`);
    expect(await value(page)).toBe(before);
  });
});

test.describe('in the page', () => {
  test('a read-only text is real text: the browser can find what is off screen', async ({ page }) => {
    await open(page, 'readOnly=1&doc=ninety');
    await expect(page.locator('.bl-syntax-line')).toHaveCount(99);
    const found = await page.evaluate(() => window.find('const line98'));
    expect(found).toBe(true);
    await expect(input(page)).toHaveCount(0);
  });

  test('its ref speaks the same language', async ({ page }) => {
    await open(page, 'readOnly=1&doc=small');
    await setSelection(page, [2, 2], [2, 8]);
    expect(await page.evaluate(() => window.__editor.handle.current.getSelectionText())).toBe('return');
    expect(await selection(page)).toEqual({ anchor: { line: 2, column: 2 }, focus: { line: 2, column: 8 } });
    expect((await value(page)).startsWith('function greet')).toBe(true);
    await page.evaluate(() => window.__editor.handle.current.selectAll());
    expect((await page.evaluate(() => window.__editor.handle.current.getSelectionText())).startsWith('function greet')).toBe(true);
  });
});

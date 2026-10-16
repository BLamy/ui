import { test, expect } from '@playwright/test';
import { openDemo } from './helpers.mjs';

test.use({ viewport: { width: 1280, height: 850 } });
const STACK = '[data-slot=split-view-supplementary] [data-slot=navigation-stack]';
const current = (page) => page.locator(`${STACK} > [data-slot=screen]:not([inert])`);
const row = (page, name) => current(page).locator('[data-slot=list-row]').filter({ hasText: name });
const editor = (page, name) => page.getByRole('textbox', { name: `${name} source`, exact: true });
const path = (page) => page.locator(`${STACK} > [data-slot=screen]:not([data-screen-ghost])`).evaluateAll((screens) => screens.filter((s) => !s.classList.contains('pointer-events-none')).map((s) => s.dataset.screenKey));
async function sourceMode(page) {
  await page.getByRole('radiogroup', { name: 'Note view', exact: true }).getByText('Source', { exact: true }).click();
}
const mac = (page) => page.getByRole('group', { name: 'On My Mac', exact: true });

/** Native browser file handles back picker doubles. Tests never access host/user files. */
async function seed(page, files, root = 'apple-notes') {
  await page.evaluate(async ({ files, root }) => {
    const store = await (await navigator.storage.getDirectory()).getDirectoryHandle(root, { create: true });
    for (const [path, body] of Object.entries(files)) {
      const parts = path.split('/'); const name = parts.pop(); let directory = store;
      for (const part of parts) directory = await directory.getDirectoryHandle(part, { create: true });
      if (body === null) { await directory.getDirectoryHandle(name, { create: true }); continue; }
      const handle = await directory.getFileHandle(name, { create: true });
      const stream = await handle.createWritable(); await stream.write(body); await stream.close();
    }
  }, { files, root });
}

async function read(page, path, root = 'apple-notes') {
  return page.evaluate(async ({ path, root }) => {
    let dir = await (await navigator.storage.getDirectory()).getDirectoryHandle(root);
    const parts = path.split('/'); const name = parts.pop();
    for (const part of parts) dir = await dir.getDirectoryHandle(part);
    return (await (await dir.getFileHandle(name)).getFile()).text();
  }, { path, root });
}

async function remove(page, path, root = 'apple-notes') {
  await page.evaluate(async ({ path, root }) => {
    let dir = await (await navigator.storage.getDirectory()).getDirectoryHandle(root);
    const parts = path.split('/'); const name = parts.pop();
    for (const part of parts) dir = await dir.getDirectoryHandle(part);
    await dir.removeEntry(name);
  }, { path, root });
}

async function action(page, name) {
  await current(page).getByRole('button', { name: 'Folder actions', exact: true }).click();
  await page.getByRole('menuitem', { name, exact: true }).click();
}
async function browserNotes(page) {
  await page.getByRole('group', { name: 'In This Browser', exact: true }).getByRole('button', { name: /^Notes / }).click();
  await expect(current(page)).toHaveAttribute('data-screen-key', 'folder:browser-notes');
}
async function addFolder(page, name) {
  await page.evaluate((name) => { window.__nextFolder = name; }, name);
  await page.getByRole('button', { name: 'Add Folder…', exact: true }).click();
  await expect(current(page)).toHaveAttribute('data-screen-label', name);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.showOpenFilePicker = async () => {
      const dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('local-fixtures');
      return [await dir.getFileHandle('linked.mdx')];
    };
    window.showDirectoryPicker = async () => (await navigator.storage.getDirectory()).getDirectoryHandle(window.__nextFolder ?? 'local-fixtures');
  });
  await openDemo(page, 'blocks/apple-notes', '[data-slot=split-view]');
  await expect(page.getByRole('group', { name: 'In This Browser', exact: true })).toBeVisible();
});

test('starts with no sample content or storage button strip, with the entire root list in NavigationStack', async ({ page }) => {
  await expect(current(page)).toHaveAttribute('data-screen-key', 'folders');
  await expect(current(page).getByRole('searchbox', { name: 'Search notes' })).toBeVisible();
  await expect(current(page).getByRole('button', { name: 'Choose Folder…' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add Folder…', exact: true })).toBeVisible();
  await expect(current(page).locator('[data-slot=list-row]')).toHaveCount(0);
  await expect(page.getByText(/Tokyo|Groceries|Example folders|iCloud|Tags/, { exact: false })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Import copy|Open folder|New file/ })).toHaveCount(0);
  await expect(page.getByRole('radiogroup', { name: 'View as' })).toHaveCount(1);
});

test('multiple Mac folders appear in the sidebar, remain independent and are remembered after reload', async ({ page }) => {
  await seed(page, { 'work.md': '# Work' }, 'Work');
  await seed(page, { 'journal.mdx': '# Journal\n\n<Card />' }, 'Journal');
  await addFolder(page, 'Work');
  await expect(mac(page).getByRole('button', { name: /^Work / })).toBeVisible();
  await expect(row(page, 'work.md')).toBeVisible();
  await addFolder(page, 'Journal');
  await expect(mac(page).getByRole('button', { name: /^Work / })).toBeVisible();
  await expect(mac(page).getByRole('button', { name: /^Journal / })).toBeVisible();
  await expect(mac(page).locator('[data-slot=split-view-item]')).toHaveCount(2);
  await expect(row(page, 'journal.mdx')).toBeVisible();
  await expect(row(page, 'work.md')).toHaveCount(0);
  await page.reload();
  await expect(mac(page).getByRole('button', { name: /^Work / })).toBeVisible();
  await expect(mac(page).getByRole('button', { name: /^Journal / })).toBeVisible();
  await expect(mac(page).locator('[data-slot=split-view-item]')).toHaveCount(2);
  await mac(page).getByRole('button', { name: /^Work / }).click();
  await expect(row(page, 'work.md')).toBeVisible();
  await page.getByRole('button', { name: 'All Folders', exact: true }).click();
  await expect(current(page).getByRole('button', { name: 'Open folder Work', exact: true })).toBeVisible();
  await expect(current(page).getByRole('button', { name: 'Open folder Journal', exact: true })).toBeVisible();
  await expect(current(page).locator('[data-slot=list-row]')).toHaveCount(0);
});

test('folders push the stack and file leaves only open the note', async ({ page }) => {
  await seed(page, { 'top.md': '# Top', 'Projects/Components/readme.mdx': '# Nested', 'Projects/Empty': null }, 'Work');
  await addFolder(page, 'Work');
  await expect(row(page, 'readme.mdx')).toHaveCount(0);
  const rootPath = await path(page);
  await row(page, 'top.md').click(); await sourceMode(page);
  await expect(editor(page, 'top.md')).toHaveValue('# Top');
  expect(await path(page)).toEqual(rootPath);
  await current(page).getByRole('button', { name: 'Open folder Projects', exact: true }).click();
  await expect(current(page).getByRole('button', { name: 'Open folder Empty', exact: true })).toBeVisible();
  await current(page).getByRole('button', { name: 'Open folder Components', exact: true }).click();
  await expect.poll(() => path(page)).toEqual(['folders', 'folder:Work', 'folder:Work/Projects', 'folder:Work/Projects/Components']);
  await row(page, 'readme.mdx').click(); await sourceMode(page);
  await expect(editor(page, 'readme.mdx')).toHaveValue('# Nested');
  expect(await path(page)).toEqual(['folders', 'folder:Work', 'folder:Work/Projects', 'folder:Work/Projects/Components']);
  await current(page).getByRole('button', { name: 'Projects', exact: true }).click();
  await expect(current(page)).toHaveAttribute('data-screen-label', 'Projects');
});

test('the top-right tree is also inside the stack and file selection never changes the folder path', async ({ page }) => {
  await seed(page, { 'nested/readme.mdx': '# Tree\n\n<Card />' }, 'Work');
  await addFolder(page, 'Work');
  await current(page).locator('label').filter({ has: page.getByRole('radio', { name: 'Tree view', exact: true }) }).click();
  const tree = current(page).getByRole('treegrid', { name: 'Folders and Markdown files' });
  await expect(tree).toBeVisible();
  const nested = tree.getByRole('row', { name: 'nested', exact: true });
  await nested.press('ArrowRight'); await nested.press('ArrowDown'); await page.keyboard.press('Enter'); await sourceMode(page);
  await expect(editor(page, 'readme.mdx')).toHaveValue('# Tree\n\n<Card />');
  expect(await path(page)).toEqual(['folders']);
  await current(page).locator('label').filter({ has: page.getByRole('radio', { name: 'List', exact: true }) }).click();
  await expect(current(page)).toHaveAttribute('data-screen-key', 'folder:Work');
  await expect(row(page, 'readme.mdx')).toHaveCount(0);
  await expect(current(page).getByRole('button', { name: 'Open folder nested', exact: true })).toBeVisible();
});

test('OPFS autosave preserves MDX source and survives reload without any seeded notes', async ({ page }) => {
  const source = '---\ntitle: "MDX example"\n---\n\nimport Card from "./Card";\n\nexport const count = 3;\n\n# Héllo\n\n<Card count={count}>**nested**  text</Card>\n';
  await seed(page, { 'example.mdx': source }); await browserNotes(page);
  await row(page, 'example.mdx').click(); await sourceMode(page);
  await expect(editor(page, 'example.mdx')).toHaveValue(source);
  const edited = `${source}\n<Chart data={[1, 2]} />\n`;
  await editor(page, 'example.mdx').fill(edited);
  await expect.poll(() => read(page, 'example.mdx')).toBe(edited);
  await expect(page.getByRole('status')).toHaveText('Saved · watching for changes');
  await page.reload(); await browserNotes(page); await row(page, 'example.mdx').click(); await sourceMode(page);
  await expect(editor(page, 'example.mdx')).toHaveValue(edited);
});

test('individual local files can be opened from folder actions, edited and watched without a folder push', async ({ page }) => {
  await seed(page, { 'linked.mdx': '# Original\n\n<Component />\n' }, 'local-fixtures');
  const before = await path(page);
  await action(page, 'Open File…'); await sourceMode(page);
  await expect(editor(page, 'linked.mdx')).toHaveValue('# Original\n\n<Component />\n');
  expect(await path(page)).toEqual(before);
  await seed(page, { 'linked.mdx': '# External\n\n<Updated />\n' }, 'local-fixtures');
  await expect(editor(page, 'linked.mdx')).toHaveValue('# External\n\n<Updated />\n');
  await editor(page, 'linked.mdx').fill('# Saved from Notes\n\n<Updated />\n');
  await editor(page, 'linked.mdx').press('ControlOrMeta+s');
  await expect.poll(() => read(page, 'linked.mdx', 'local-fixtures')).toBe('# Saved from Notes\n\n<Updated />\n');
});

test('folder watching includes nested Markdown additions, edits and deletions', async ({ page }) => {
  await seed(page, { 'nested/guide.MD': '# Guide', 'nested/ignored.txt': 'not a note' }, 'Work');
  await addFolder(page, 'Work');
  await current(page).getByRole('button', { name: 'Open folder nested', exact: true }).click();
  await row(page, 'guide.MD').click(); await sourceMode(page);
  await expect(current(page).getByText('ignored.txt')).toHaveCount(0);
  await seed(page, { 'nested/guide.MD': '# Changed outside', 'nested/new.mdx': '<Hello />' }, 'Work');
  await expect(editor(page, 'guide.MD')).toHaveValue('# Changed outside');
  await expect(row(page, 'new.mdx')).toBeVisible();
  await remove(page, 'nested/new.mdx', 'Work'); await expect(row(page, 'new.mdx')).toHaveCount(0);
});

test('conflicts keep unsaved edits and resolve with Keep my edits', async ({ page }) => {
  await seed(page, { 'conflict.md': '# Original' }); await browserNotes(page); await row(page, 'conflict.md').click(); await sourceMode(page);
  await editor(page, 'conflict.md').fill('# My draft'); await seed(page, { 'conflict.md': '# Other editor' });
  await expect(page.getByRole('button', { name: 'Keep my edits', exact: true })).toBeVisible();
  await expect(editor(page, 'conflict.md')).toHaveValue('# My draft');
  expect(await read(page, 'conflict.md')).toBe('# Other editor');
  await page.getByRole('button', { name: 'Keep my edits', exact: true }).click();
  await expect.poll(() => read(page, 'conflict.md')).toBe('# My draft');
});

test('Use disk version replaces only the unsaved buffer', async ({ page }) => {
  await seed(page, { 'conflict.md': '# Original' }); await browserNotes(page); await row(page, 'conflict.md').click(); await sourceMode(page);
  await editor(page, 'conflict.md').fill('# My draft'); await seed(page, { 'conflict.md': '# Other editor' });
  await page.getByRole('button', { name: 'Use disk version', exact: true }).click();
  await expect(editor(page, 'conflict.md')).toHaveValue('# Other editor');
  expect(await read(page, 'conflict.md')).toBe('# Other editor');
});

test('deleted local files retain unsaved edits and can be kept in Notes', async ({ page }) => {
  await seed(page, { 'linked.mdx': '# Original' }, 'local-fixtures'); await action(page, 'Open File…'); await sourceMode(page);
  await editor(page, 'linked.mdx').fill('# Still here\n\n<Component />'); await remove(page, 'linked.mdx', 'local-fixtures');
  await expect(page.getByRole('button', { name: 'Keep a copy in Notes', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Keep a copy in Notes', exact: true }).click(); await sourceMode(page);
  await expect(page.getByRole('textbox', { name: /linked recovered \d+\.mdx source/ })).toHaveValue('# Still here\n\n<Component />');
  expect(await path(page)).toEqual(['folders']);
});

test('new notes are created in the selected Mac folder and duplicate creation never overwrites', async ({ page }) => {
  await seed(page, { 'existing.md': '# Keep this' }, 'Work'); await addFolder(page, 'Work');
  const before = await path(page);
  await action(page, 'New Note…'); await page.getByRole('textbox', { name: 'File name', exact: true }).fill('new.mdx');
  await page.getByRole('button', { name: 'Create note', exact: true }).click(); await sourceMode(page);
  await editor(page, 'new.mdx').fill('export const draft = true;\n\n<Note />');
  await expect.poll(() => read(page, 'new.mdx', 'Work')).toBe('export const draft = true;\n\n<Note />');
  expect(await path(page)).toEqual(before);
  await action(page, 'New Note…'); await page.getByRole('textbox', { name: 'File name', exact: true }).fill('existing.md');
  await page.getByRole('button', { name: 'Create note', exact: true }).click(); await sourceMode(page);
  await expect(page.getByRole('alert')).toContainText('already exists');
  expect(await read(page, 'existing.md', 'Work')).toBe('# Keep this');
});

test('removing a folder from Notes preserves files on disk and other added folders', async ({ page }) => {
  await seed(page, { 'work.md': '# Keep Work' }, 'Work'); await seed(page, { 'journal.md': '# Keep Journal' }, 'Journal');
  await addFolder(page, 'Journal'); await addFolder(page, 'Work'); await action(page, 'Remove Folder from Notes');
  await expect(mac(page).getByRole('button', { name: /^Work / })).toHaveCount(0);
  await expect(mac(page).getByRole('button', { name: /^Journal / })).toBeVisible();
  expect(await read(page, 'work.md', 'Work')).toBe('# Keep Work');
  await page.reload();
  await expect(mac(page).getByRole('button', { name: /^Work / })).toHaveCount(0);
  await expect(mac(page).getByRole('button', { name: /^Journal / })).toBeVisible();
});

test('browsers without local pickers can create personal notes with no storage management buttons', async ({ page }) => {
  await page.addInitScript(() => { window.showOpenFilePicker = undefined; window.showDirectoryPicker = undefined; });
  await page.reload();
  await expect(page.getByRole('button', { name: 'Add Folder…', exact: true })).toBeDisabled();
  await action(page, 'New Note…'); await page.getByRole('textbox', { name: 'File name', exact: true }).fill('personal.md');
  await page.getByRole('button', { name: 'Create note', exact: true }).click(); await sourceMode(page);
  await editor(page, 'personal.md').fill('# My personal note');
  await expect.poll(() => read(page, 'personal.md')).toBe('# My personal note');
});

test('write failures preserve the buffer for retry', async ({ page }) => {
  await seed(page, { 'retry.md': '# Original' }); await browserNotes(page); await row(page, 'retry.md').click(); await sourceMode(page);
  await page.evaluate(() => {
    const original = FileSystemFileHandle.prototype.createWritable;
    window.__restoreNotesWrites = () => { FileSystemFileHandle.prototype.createWritable = original; };
    FileSystemFileHandle.prototype.createWritable = async function (...args) {
      if (this.name === 'retry.md') throw new DOMException('Write permission was revoked', 'NotAllowedError');
      return original.apply(this, args);
    };
  });
  await editor(page, 'retry.md').fill('# Keep my edits');
  await expect(page.getByRole('status')).toHaveText('Write permission was revoked');
  expect(await read(page, 'retry.md')).toBe('# Original');
  await page.evaluate(() => window.__restoreNotesWrites()); await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect.poll(() => read(page, 'retry.md')).toBe('# Keep my edits');
});

test('remembered Mac folders reconnect when the browser requires permission again', async ({ page }) => {
  await seed(page, { 'work.md': '# Reconnected' }, 'Work'); await addFolder(page, 'Work');
  await page.addInitScript(() => {
    const prototype = FileSystemDirectoryHandle.prototype;
    const query = prototype.queryPermission;
    prototype.queryPermission = async function (options) {
      if (this.name === 'Work') return window.__folderPermission ? 'granted' : 'prompt';
      return query ? query.call(this, options) : 'granted';
    };
    prototype.requestPermission = async function () { window.__folderPermission = true; return 'granted'; };
  });
  await page.reload();
  const work = mac(page).getByRole('button', { name: /^Work Reconnect folder/ });
  await expect(work).toBeVisible(); await work.click();
  await row(page, 'work.md').click(); await sourceMode(page);
  await expect(editor(page, 'work.md')).toHaveValue('# Reconnected');
});

test('phone folder navigation stays in the master stack when a leaf opens and the detail returns', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.reload();
  await seed(page, { 'nested/phone.md': '# Phone note' }, 'Work');
  await page.evaluate(() => { window.__nextFolder = 'Work'; });
  await action(page, 'Add Folder…');
  await current(page).getByRole('button', { name: 'Open folder nested', exact: true }).click();
  await expect(current(page)).toHaveAttribute('data-screen-key', 'folder:Work/nested');
  const before = await path(page);
  await row(page, 'phone.md').click(); await sourceMode(page);
  await expect(editor(page, 'phone.md')).toHaveValue('# Phone note');
  expect(await path(page)).toEqual(before);
  await page.locator('[data-slot=split-view-detail] [data-slot=split-view-back]').click();
  await expect(current(page)).toHaveAttribute('data-screen-key', 'folder:Work/nested');
});

test('Markdown opens in Docstream by default, preserves frontmatter, saves rich edits and watches external edits', async ({ page }) => {
  const properties = '---\nid: E0-T04\ntitle: MMIO dispatch\nstatus: verified\n---\n';
  const body = '\n## Goal\n\nOriginal **important** paragraph.\n\n- [ ] Review\n';
  await seed(page, { 'note.md': properties + body }, 'Work'); await addFolder(page, 'Work');
  await row(page, 'note.md').click();
  const rich = page.getByRole('textbox', { name: 'note.md note', exact: true });
  await expect(rich.locator('h2')).toHaveText('Goal');
  await expect(rich.locator('strong')).toHaveText('important');
  await expect(page.getByRole('textbox', { name: 'note.md source', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toHaveCount(0);
  await expect(page.locator('[data-slot=split-view-detail] [data-slot=split-view-header]')).toContainText('note.md');
  await expect(page.getByRole('radiogroup', { name: 'Note view' }).getByRole('radio', { name: 'Editor', exact: true })).toBeChecked();
  expect(await read(page, 'note.md', 'Work')).toBe(properties + body);
  const paragraph = rich.locator('p').filter({ hasText: 'Original important paragraph.' });
  await paragraph.click(); await page.keyboard.press('End'); await page.keyboard.type(' Edited in Docstream.');
  await expect.poll(() => read(page, 'note.md', 'Work')).toContain('Edited in Docstream.');
  expect(await read(page, 'note.md', 'Work')).toMatch(/^---\nid: E0-T04\ntitle: MMIO dispatch\nstatus: verified\n---\n/);
  await page.screenshot({ path: test.info().outputPath('docstream.png') });
  await seed(page, { 'note.md': properties + '\n## Goal\n\nChanged in my other editor.\n' }, 'Work');
  await expect(rich).toContainText('Changed in my other editor.');
  expect(await read(page, 'note.md', 'Work')).toBe(properties + '\n## Goal\n\nChanged in my other editor.\n');
});

test('first-party document properties edit and autosave with the body and stay in sync with the source view', async ({ page }) => {
  const markdown = '---\n# Task metadata\ntitle: "My note"\npriority: 4\ncomplete: false\n---\n\n## Goal\n\nWrite the note.\n';
  await seed(page, { 'properties.md': markdown }, 'Work'); await addFolder(page, 'Work'); await row(page, 'properties.md').click();
  const sheet = page.locator('[data-document-properties]');
  await expect(sheet).toBeVisible();
  await sheet.locator('summary').click();
  await sheet.getByRole('spinbutton', { name: 'priority', exact: true }).fill('7');
  await expect.poll(() => read(page, 'properties.md', 'Work')).toBe(markdown.replace('priority: 4', 'priority: 7'));
  await sheet.getByRole('checkbox', { name: 'complete', exact: true }).check();
  await expect.poll(() => read(page, 'properties.md', 'Work')).toContain('complete: true');
  await sourceMode(page);
  await expect(editor(page, 'properties.md')).toHaveValue(/priority: 7[\s\S]*complete: true/);
  await page.getByRole('radiogroup', { name: 'Note view' }).getByText('Editor', { exact: true }).click();
  await sheet.locator('summary').click();
  await expect(sheet.getByRole('spinbutton', { name: 'priority', exact: true })).toHaveValue('7');
});

test('task icons, state-name tooltips and the complete right-click menu serialize every choice and autosave', async ({ page }) => {
  const states = [[' ', 'Pending'], ['~', 'In progress'], ['?', 'Implemented'], ['b', 'Blocked'], ['d', 'Parked'], ['!', 'Refuted'], ['x', 'Verified'], ['-', 'Cancelled']];
  const body = '---\ntitle: Task states\n---\n\n# Checklist\n\n' + states.map(([marker, label]) => `- [${marker}] ${label}`).join('\n') + '\n';
  await seed(page, { 'task-states.md': body, 'review.md': '# Original review\n' }, 'Work'); await addFolder(page, 'Work'); await row(page, 'task-states.md').click();
  const control = page.getByRole('checkbox', { name: /^Blocked: Blocked$/ });
  await expect(control).toHaveAttribute('aria-checked', 'mixed');
  await control.hover(); await expect(page.getByRole('tooltip')).toHaveText('Blocked');
  await control.click({ button: 'right' });
  const menu = page.getByRole('menu', { name: 'Task state', exact: true });
  await expect(menu.getByRole('menuitemradio')).toHaveCount(8);
  await expect(menu.locator('[data-state-icon]')).toHaveCount(8);
  await menu.getByRole('menuitemradio', { name: /Parked/ }).click();
  await expect.poll(() => read(page, 'task-states.md', 'Work')).toContain('- [d] Blocked');
  const changed = page.getByRole('checkbox', { name: /^Blocked: Parked/ });
  await changed.click(); await expect.poll(() => read(page, 'task-states.md', 'Work')).toContain('- [ ] Blocked');
  await page.getByRole('checkbox', { name: /^Blocked: Pending$/ }).click();
  await expect.poll(() => read(page, 'task-states.md', 'Work')).toContain('- [x] Blocked');
  await expect(row(page, 'task-states.md').getByRole('img', { name: 'Changed outside Notes' })).toHaveCount(0);
  await seed(page, { 'review.md': '# Updated in another editor\n' }, 'Work');
  await expect(row(page, 'review.md').getByRole('img', { name: 'Changed outside Notes' })).toBeVisible();
  await page.getByRole('checkbox', { name: /^Blocked: Verified$/ }).click({ button: 'right' });
  await menu.getByRole('menuitemradio', { name: 'Blocked', exact: true }).click();
  await expect.poll(() => read(page, 'task-states.md', 'Work')).toContain('- [b] Blocked');
  await page.getByRole('checkbox', { name: /^Blocked: Blocked$/ }).click({ button: 'right' });
  await page.screenshot({ path: test.info().outputPath('task-states.png') });
});

test('external edits get persistent blue dots in both list and tree, opening clears them, and own saves stay read', async ({ page }) => {
  await seed(page, { 'one.md': '# One\n', 'two.md': '# Two\n' }, 'Work'); await addFolder(page, 'Work');
  await row(page, 'one.md').click();
  await seed(page, { 'two.md': '# Changed outside\n' }, 'Work');
  await expect(row(page, 'two.md').getByRole('img', { name: 'Changed outside Notes' })).toBeVisible();
  await page.reload();
  await mac(page).getByRole('button', { name: /^Work / }).click();
  await expect(row(page, 'two.md').getByRole('img', { name: 'Changed outside Notes' })).toBeVisible();
  await current(page).getByRole('radiogroup', { name: 'View as' }).locator('label').filter({ has: page.getByRole('radio', { name: 'Tree view', exact: true }) }).click();
  const treeRow = page.getByRole('treegrid').getByRole('row', { name: /two.md/ });
  await expect(treeRow.getByRole('img', { name: 'Changed outside Notes' })).toBeVisible();
  await treeRow.click();
  await expect(treeRow.getByRole('img', { name: 'Changed outside Notes' })).toHaveCount(0);
  await sourceMode(page); await editor(page, 'two.md').fill('# Saved in Notes\n');
  await expect.poll(() => read(page, 'two.md', 'Work')).toBe('# Saved in Notes\n');
  await expect(treeRow.getByRole('img', { name: 'Changed outside Notes' })).toHaveCount(0);
  await seed(page, { 'two.md': '# Changed while viewing\n' }, 'Work');
  await expect(editor(page, 'two.md')).toHaveValue('# Changed while viewing\n');
  await expect(treeRow.getByRole('img', { name: 'Changed outside Notes' })).toHaveCount(0);
});

test('local notes inherit the host demo registry so app examples render automatically', async ({ page }) => {
  await seed(page, { 'guide.md': '# Guide\n\n{% demo src="adaptive-pane/pane-modes" %}\n' }, 'Work');
  await addFolder(page, 'Work'); await row(page, 'guide.md').click();
  const demo = page.locator('[data-demo-src="adaptive-pane/pane-modes"][data-demo-mode="resolver"]');
  await expect(demo.getByRole('button', { name: 'Open right drawer', exact: true })).toBeVisible();
});

test('added folders provide Docstream demo source files, metadata and a working preview, with watched source updates', async ({ page }) => {
  test.setTimeout(120_000);
  await seed(page, {
    'docs/pages/example.md': '# Example\n\n{% demo src="hello/world" %}\n',
    'docs/examples/hello/world/meta.json': JSON.stringify({ title: 'Folder example', height: 180 }),
    'docs/examples/hello/world/index.tsx': 'import React from "react"; import { greeting } from "./message"; import "./styles.css"; export default function Example(){ return <button>{greeting}</button> }',
    'docs/examples/hello/world/message.ts': 'export const greeting = "Hello from my folder";',
    'docs/examples/hello/world/styles.css': 'button { color: rgb(0, 122, 255); }',
  }, 'Work');
  await addFolder(page, 'Work');
  await current(page).getByRole('button', { name: 'Open folder docs', exact: true }).click();
  await current(page).getByRole('button', { name: 'Open folder pages', exact: true }).click();
  await row(page, 'example.md').click();
  await expect(page.getByText('Folder example', { exact: true })).toBeVisible();
  const frame = page.frameLocator('iframe[title="Folder example"]');
  await expect(frame.getByRole('button', { name: 'Hello from my folder' })).toBeVisible({ timeout: 90_000 });
  await seed(page, { 'docs/examples/hello/world/message.ts': 'export const greeting = "Updated outside Notes";' }, 'Work');
  await expect(frame.getByRole('button', { name: 'Updated outside Notes' })).toBeVisible({ timeout: 90_000 });
});

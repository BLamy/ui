const assert = require('node:assert/strict');
const {
  mkdtempSync,
  mkdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { createFolderAccess } = require('./folder-access.cjs');

function fixture(t) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'bl-notes-permissions-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const folder = path.join(root, 'Notes');
  mkdirSync(folder);
  return { root, folder, state: path.join(root, 'permissions.json') };
}

test('folder access requires approval and survives relaunch', async (t) => {
  const { folder, state } = fixture(t);
  let prompts = 0;
  const access = createFolderAccess(state, async () => {
    prompts++;
    return true;
  });
  assert.equal(access.isGranted(folder), false);
  assert.equal(await access.request(folder, true), true);
  assert.equal(access.isGranted(path.join(folder, 'nested/note.md')), true);
  assert.equal(await access.request(folder, true), true);
  assert.equal(prompts, 1);
  assert.equal(
    createFolderAccess(state, () => {
      throw new Error('Unexpected prompt');
    }).isGranted(folder),
    true,
  );
});

test('denial does not grant access and a later request can be approved', async (t) => {
  const { folder, state } = fixture(t);
  let allow = false;
  const access = createFolderAccess(state, async () => allow);
  assert.equal(await access.request(folder, true), false);
  assert.equal(access.isGranted(folder), false);
  allow = true;
  assert.equal(await access.request(folder, true), true);
});

test('a grant excludes sibling paths and symlinks outside the chosen folder', async (t) => {
  const { root, folder, state } = fixture(t);
  const outside = path.join(root, 'outside');
  mkdirSync(outside);
  symlinkSync(outside, path.join(folder, 'escape'));
  const access = createFolderAccess(state, async () => true);
  await access.request(folder, true);
  assert.equal(access.isGranted(path.join(root, 'Notes-other/note.md')), false);
  assert.equal(
    access.isGranted(path.join(folder, '../outside/note.md')),
    false,
  );
  assert.equal(access.isGranted(path.join(folder, 'escape/note.md')), false);
});

test('opening one file does not grant its parent or nearby files', async (t) => {
  const { folder, state } = fixture(t);
  const file = path.join(folder, 'note.md');
  writeFileSync(file, 'hello');
  const access = createFolderAccess(state, async () => true);
  await access.request(file, false);
  assert.equal(access.isGranted(file), true);
  assert.equal(access.isGranted(folder), false);
  assert.equal(access.isGranted(path.join(folder, 'other.md')), false);
});

test('simultaneous read and write requests show one prompt', async (t) => {
  const { folder, state } = fixture(t);
  let prompts = 0;
  const access = createFolderAccess(state, async () => {
    prompts++;
    return true;
  });
  assert.deepEqual(
    await Promise.all([
      access.request(folder, true),
      access.request(folder, true),
    ]),
    [true, true],
  );
  assert.equal(prompts, 1);
});

test('invalid or damaged permission data never grants filesystem access', async (t) => {
  const { folder, state } = fixture(t);
  writeFileSync(state, '{broken');
  const access = createFolderAccess(state, async () => true);
  assert.equal(access.isGranted(folder), false);
  assert.equal(await access.request('', true), false);
  assert.equal(await access.request('relative/path', true), false);
});

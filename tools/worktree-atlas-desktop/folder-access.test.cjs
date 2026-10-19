const assert = require('node:assert/strict');
const { mkdtempSync, mkdirSync, rmSync, symlinkSync } = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { createFolderAccess } = require('./folder-access.cjs');

function fixture(t) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'worktree-atlas-permissions-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const folder = path.join(root, 'Code');
  mkdirSync(path.join(folder, 'app/.git'), { recursive: true });
  return { root, folder, state: path.join(root, 'permissions.json') };
}

test('reading a folder takes one approval and survives relaunch', async (t) => {
  const { folder, state } = fixture(t);
  let prompts = 0;
  const access = createFolderAccess(state, async () => {
    prompts++;
    return true;
  });
  assert.equal(access.isGranted(folder), false);
  assert.equal(await access.request(folder, true), true);
  assert.equal(access.isGranted(path.join(folder, 'app/.git/HEAD')), true);
  assert.equal(await access.request(folder, true), true);
  assert.equal(prompts, 1);
  assert.equal(
    createFolderAccess(state, () => {
      throw new Error('Unexpected prompt');
    }).isGranted(folder),
    true,
  );
});

test('deleting asks again: read access does not grant write access', async (t) => {
  const { folder, state } = fixture(t);
  const asked = [];
  const access = createFolderAccess(state, async (_p, _d, write) => {
    asked.push(write);
    return true;
  });
  await access.request(folder, true);
  assert.equal(access.isGranted(path.join(folder, 'app'), true), false);
  assert.equal(await access.request(folder, true, true), true);
  assert.equal(access.isGranted(path.join(folder, 'app'), true), true);
  // Write access implies read access, and nothing is asked twice.
  assert.equal(await access.request(path.join(folder, 'app'), true), true);
  assert.deepEqual(asked, [false, true]);
});

test('a refusal is not remembered, and siblings are not granted', async (t) => {
  const { root, folder, state } = fixture(t);
  let answer = false;
  const access = createFolderAccess(state, async () => answer);
  assert.equal(await access.request(folder, true), false);
  answer = true;
  assert.equal(await access.request(folder, true), true);
  mkdirSync(path.join(root, 'Code-other'));
  assert.equal(access.isGranted(path.join(root, 'Code-other')), false);
  assert.equal(access.isGranted(root), false);
});

test('a symlinked path resolves to the folder it points at', async (t) => {
  const { root, folder, state } = fixture(t);
  const link = path.join(root, 'link');
  symlinkSync(folder, link);
  const access = createFolderAccess(state, async () => true);
  await access.request(link, true);
  assert.equal(access.isGranted(path.join(folder, 'app')), true);
});

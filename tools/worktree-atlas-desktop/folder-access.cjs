const {
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} = require('node:fs');
const path = require('node:path');

function canonical(filePath) {
  if (typeof filePath !== 'string' || !path.isAbsolute(filePath)) return null;
  try {
    return realpathSync(filePath);
  } catch {
    const parent = path.dirname(filePath);
    if (parent === filePath) return path.normalize(filePath);
    return path.join(canonical(parent), path.basename(filePath));
  }
}

const inside = (folder, requested) => {
  const relative = path.relative(folder, requested);
  return (
    relative !== '..' &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
};

// Chromium owns the directory handles; this records only the user's access decisions.
// Reading and writing are granted separately: Atlas reads folders to list worktrees and
// only asks to write when you delete one.
function createFolderAccess(statePath, ask) {
  let grants = [];
  try {
    const saved = JSON.parse(readFileSync(statePath, 'utf8'));
    if (Array.isArray(saved))
      grants = saved.filter(
        (grant) =>
          typeof grant?.path === 'string' &&
          path.isAbsolute(grant.path) &&
          typeof grant.directory === 'boolean' &&
          typeof grant.write === 'boolean',
      );
  } catch {
    /* The first launch has no saved grants. */
  }
  const pending = new Map();
  const isGranted = (filePath, write = false) => {
    const requested = canonical(filePath);
    return Boolean(
      requested &&
      grants.some(
        (grant) =>
          (grant.write || !write) &&
          (requested === grant.path ||
            (grant.directory && inside(grant.path, requested))),
      ),
    );
  };
  return {
    isGranted,
    request(filePath, directory, write = false) {
      const requested = canonical(filePath);
      if (!requested) return Promise.resolve(false);
      if (isGranted(requested, write)) return Promise.resolve(true);
      const key = `${write ? 'w' : 'r'}:${requested}`;
      if (pending.has(key)) return pending.get(key);
      const operation = (async () => {
        if (!(await ask(requested, directory, write))) return false;
        grants = grants.filter(
          (grant) => !(grant.path === requested && !grant.write),
        );
        grants.push({ path: requested, directory: Boolean(directory), write });
        mkdirSync(path.dirname(statePath), { recursive: true });
        writeFileSync(statePath, JSON.stringify(grants, null, 2), {
          mode: 0o600,
        });
        return true;
      })().finally(() => pending.delete(key));
      pending.set(key, operation);
      return operation;
    },
  };
}

module.exports = { createFolderAccess };

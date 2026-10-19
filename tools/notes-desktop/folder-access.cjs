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

// Chromium owns the directory handles; this records only the user's access decisions.
function createFolderAccess(statePath, ask) {
  let grants = [];
  try {
    const saved = JSON.parse(readFileSync(statePath, 'utf8'));
    if (Array.isArray(saved))
      grants = saved.filter(
        (grant) =>
          typeof grant?.path === 'string' &&
          path.isAbsolute(grant.path) &&
          typeof grant.directory === 'boolean',
      );
  } catch {
    /* The first launch has no saved grants. */
  }
  const pending = new Map();
  const isGranted = (filePath) => {
    const requested = canonical(filePath);
    return Boolean(
      requested &&
      grants.some((grant) => {
        if (requested === grant.path) return true;
        const relative = path.relative(grant.path, requested);
        return (
          grant.directory &&
          relative !== '..' &&
          !relative.startsWith(`..${path.sep}`) &&
          !path.isAbsolute(relative)
        );
      }),
    );
  };
  return {
    isGranted,
    request(filePath, directory) {
      const requested = canonical(filePath);
      if (!requested) return Promise.resolve(false);
      if (isGranted(requested)) return Promise.resolve(true);
      if (pending.has(requested)) return pending.get(requested);
      const operation = (async () => {
        if (!(await ask(requested, directory))) return false;
        grants.push({ path: requested, directory: Boolean(directory) });
        mkdirSync(path.dirname(statePath), { recursive: true });
        writeFileSync(statePath, JSON.stringify(grants, null, 2), {
          mode: 0o600,
        });
        return true;
      })().finally(() => pending.delete(requested));
      pending.set(requested, operation);
      return operation;
    },
  };
}

module.exports = { createFolderAccess };

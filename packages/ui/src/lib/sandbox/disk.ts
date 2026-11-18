/* @internal The page's copy of the sandbox's disk. The sandbox keeps one so that a Worker it has to replace starts from
   the same files, and so that reading a file never waits for a thread that may be busy. Changes come from two sides:
   the page (`write`, `mkdir`, `rename`, `remove`, applied here at once and then sent to the Worker) and commands (what
   the Worker reports, in batches). Both are told to whoever watches. */
import { SandboxError } from './error';
import type { SandboxFileData, SandboxFileEntry, SandboxFileEvent } from './model';
import type { FileEntry, FsBatch } from './protocol';

export interface SandboxDisk {
  readonly files: Map<string, SandboxFileData>;
  readonly directories: Set<string>;
  /** An absolute, normalized path for one given absolutely or relative to the root. */
  resolve: (path: string) => string;
  snapshot: () => { files: FileEntry[]; dirs: string[] };
  /** The four changes the page can make. Each throws a `SandboxError` when the disk can't take it. */
  write: (path: string, data: SandboxFileData) => void;
  mkdir: (path: string) => void;
  rename: (from: string, to: string) => void;
  remove: (path: string, recursive: boolean) => void;
  list: (path: string) => SandboxFileEntry[];
  /** What commands did, as the Worker reported it. */
  apply: (batch: FsBatch) => void;
  watch: (path: string, listener: (events: SandboxFileEvent[]) => void) => () => void;
}

/** `/a/b/../c//d/` → `/a/c/d`. */
export function normalizePath(path: string): string {
  const out: string[] = [];
  for (const part of path.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') out.pop();
    else out.push(part);
  }
  return `/${out.join('/')}`;
}

const dirname = (path: string) => path.slice(0, path.lastIndexOf('/')) || '/';
const basename = (path: string) => path.slice(path.lastIndexOf('/') + 1);

/** Every folder above a path, nearest last: `/a/b/c` → `/a`, `/a/b`. */
const ancestors = (path: string) => {
  const out: string[] = [];
  for (let dir = dirname(path); dir !== '/'; dir = dirname(dir)) out.unshift(dir);
  return out;
};

const sameData = (a: SandboxFileData | undefined, b: SandboxFileData | undefined) => {
  if (a === undefined || b === undefined) return false;
  if (typeof a === 'string' || typeof b === 'string') return a === b;
  return a.length === b.length && a.every((byte, i) => byte === b[i]);
};

const inside = (path: string, folder: string) => path === folder || folder === '/' || path.startsWith(`${folder}/`);

export function createSandboxDisk(root: string, initial: Record<string, SandboxFileData> = {}): SandboxDisk {
  const files = new Map<string, SandboxFileData>();
  const directories = new Set<string>(['/']);
  const watchers = new Set<{ path: string; listener: (events: SandboxFileEvent[]) => void }>();

  const resolve = (path: string) => normalizePath(path.startsWith('/') ? path : `${root}/${path}`);
  const addDirs = (path: string, events?: SandboxFileEvent[]) => {
    for (const dir of [...ancestors(path), path]) {
      if (directories.has(dir)) continue;
      directories.add(dir);
      events?.push({ type: 'change', path: dir, kind: 'directory' });
    }
  };

  const fire = (events: SandboxFileEvent[]) => {
    if (!events.length) return;
    for (const { path, listener } of [...watchers]) {
      const mine = events.filter((event) => (event.type === 'rename' ? inside(event.from, path) || inside(event.to, path) : inside(event.path, path)));
      if (mine.length) listener(mine);
    }
  };

  /** A file can't be written where a folder is, or under a file. */
  const refuse = (path: string, what: string) => {
    if (path === '/') throw new SandboxError('files', `Cannot ${what} the disk's root.`);
    const blocking = ancestors(path).find((dir) => files.has(dir));
    if (blocking) throw new SandboxError('files', `Not a directory: ${blocking}`);
  };

  addDirs(root);
  for (const [name, data] of Object.entries(initial)) {
    const path = resolve(name);
    addDirs(dirname(path));
    files.set(path, data);
  }

  return {
    files,
    directories,
    resolve,
    snapshot: () => ({ files: [...files].map(([path, data]) => ({ path, data })), dirs: [...directories].filter((dir) => dir !== '/') }),
    write(path, data) {
      refuse(path, 'write');
      if (directories.has(path)) throw new SandboxError('files', `Is a directory: ${path}`);
      const events: SandboxFileEvent[] = [];
      addDirs(dirname(path), events);
      files.set(path, data);
      events.push({ type: 'change', path, kind: 'file' });
      fire(events);
    },
    mkdir(path) {
      if (path === '/') return;
      refuse(path, 'make');
      if (files.has(path)) throw new SandboxError('files', `File exists: ${path}`);
      const events: SandboxFileEvent[] = [];
      addDirs(path, events);
      fire(events);
    },
    rename(from, to) {
      refuse(from, 'move');
      refuse(to, 'replace');
      if (!files.has(from) && !directories.has(from)) throw new SandboxError('files', `No such file or directory: ${from}`);
      if (to === from) return;
      if (to.startsWith(`${from}/`)) throw new SandboxError('files', `Cannot move ${from} into itself.`);
      // As `rename(2)` has it: a file replaces a file, and a folder an empty folder, and nothing else.
      if (files.has(from) && directories.has(to)) throw new SandboxError('files', `Is a directory: ${to}`);
      if (directories.has(from) && files.has(to)) throw new SandboxError('files', `Not a directory: ${to}`);
      if (directories.has(to) && [...files.keys(), ...directories].some((entry) => entry !== to && inside(entry, to))) {
        throw new SandboxError('files', `Directory not empty: ${to}`);
      }
      const events: SandboxFileEvent[] = [];
      files.delete(to);
      directories.delete(to);
      addDirs(dirname(to), events);
      const move = (path: string) => to + path.slice(from.length);
      for (const [path, data] of [...files]) {
        if (!inside(path, from)) continue;
        files.delete(path);
        files.set(move(path), data);
      }
      for (const dir of [...directories]) {
        if (!inside(dir, from)) continue;
        directories.delete(dir);
        directories.add(move(dir));
      }
      events.push({ type: 'rename', from, to });
      fire(events);
    },
    remove(path, recursive) {
      refuse(path, 'remove');
      if (!files.has(path) && !directories.has(path)) throw new SandboxError('files', `No such file or directory: ${path}`);
      if (directories.has(path) && !recursive) {
        const occupied = [...files.keys(), ...directories].some((entry) => entry !== path && inside(entry, path));
        if (occupied) throw new SandboxError('files', `Directory not empty: ${path}`);
      }
      for (const file of [...files.keys()]) if (inside(file, path)) files.delete(file);
      for (const dir of [...directories]) if (inside(dir, path)) directories.delete(dir);
      fire([{ type: 'delete', path }]);
    },
    list(path) {
      if (!directories.has(path)) throw new SandboxError('files', files.has(path) ? `Not a directory: ${path}` : `No such directory: ${path}`);
      const entries: SandboxFileEntry[] = [];
      for (const dir of directories) if (dir !== '/' && dirname(dir) === path) entries.push({ name: basename(dir), kind: 'directory' });
      for (const file of files.keys()) if (dirname(file) === path) entries.push({ name: basename(file), kind: 'file' });
      return entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    },
    /* `mv a b` looks like one gone and one new with the same bytes: that is told as a move, so that whatever follows a
       file (an editor's tab) can follow it.
       A report is the Worker's word, and the copy stays a tree whatever it says: the newest report about a path wins,
       so a file that arrives where a folder is takes the folder's place, with what was in it, and the reverse; a file
       or folder under a file turns that file into a folder. The root is never removed. */
    apply({ changed, removed, dirs: madeDirs, removedDirs }) {
      const events: SandboxFileEvent[] = [];
      /** A folder, and the folders above it: a file in the way gives way. */
      const makeDir = (path: string) => {
        for (const dir of [...ancestors(path), path]) {
          if (files.delete(dir)) events.push({ type: 'delete', path: dir });
          if (directories.has(dir)) continue;
          directories.add(dir);
          events.push({ type: 'change', path: dir, kind: 'directory' });
        }
      };
      /** Takes a folder and everything in it, quietly: the caller tells of it. */
      const dropTree = (path: string) => {
        for (const file of [...files.keys()]) if (inside(file, path)) files.delete(file);
        for (const dir of [...directories]) if (dir !== '/' && inside(dir, path)) directories.delete(dir);
      };
      /** A file, where a folder may have been. Says whether it took a folder's place. */
      const placeFile = (path: string, data: SandboxFileData) => {
        const parent = dirname(path);
        if (parent !== '/') makeDir(parent);
        if (directories.has(path)) {
          dropTree(path);
          events.push({ type: 'delete', path });
        }
        files.set(path, data);
      };

      const moved = new Set<string>();
      const fresh = changed.filter(({ path }) => !files.has(path) && !directories.has(path));
      for (const from of removed) {
        const was = files.get(from);
        const match = fresh.find(({ path, data }) => !moved.has(path) && sameData(was, data));
        if (!match) continue;
        moved.add(match.path);
        moved.add(from);
        files.delete(from);
        placeFile(match.path, match.data);
        events.push({ type: 'rename', from, to: match.path });
      }
      for (const path of madeDirs) if (path !== '/') makeDir(path);
      for (const { path, data } of changed) {
        if (path === '/' || moved.has(path) || sameData(files.get(path), data)) continue;
        placeFile(path, data);
        events.push({ type: 'change', path, kind: 'file' });
      }
      for (const path of removed) {
        if (moved.has(path) || !files.delete(path)) continue;
        events.push({ type: 'delete', path });
      }
      for (const path of removedDirs) {
        if (path === '/' || !directories.has(path)) continue;
        dropTree(path);
        events.push({ type: 'delete', path });
      }
      fire(events);
    },
    watch(path, listener) {
      const watcher = { path, listener };
      watchers.add(watcher);
      return () => { watchers.delete(watcher); };
    },
  };
}

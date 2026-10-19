/* Worktrees from folders opened in the browser (File System Access: Chrome, Edge, Arc). OPFS can't help here —
   it is a private, empty disk for this site — so the user opens real folders (a projects folder, ~/.codex) and
   their handles are remembered in IndexedDB; the browser asks again for access after a restart.
   Git runs in the page: isomorphic-git reads refs, trees and blobs straight out of `.git` through git-fs.ts.
   Discovery walks each folder (skipping dependency and cache folders) for checkouts: a `.git` folder is a
   repository's own checkout, a `.git` file a linked worktree. Every repository's `.git/worktrees/<name>/gitdir` lists
   all of its linked worktrees, wherever they are; matching one of those absolute paths to a checkout found in
   the walk tells us where on disk the opened folder is, so the rest resolve by path. Deleting does what
   `git worktree remove` does: delete the checkout and the repository's `.git/worktrees/<name>`. */
import { Buffer } from 'buffer';
import { HandleFs, parseIndex, type Mount } from './git-fs';
import type { DiffFile, Location, Project, RemoveResult, ScanProgress, Worktree, WorktreeDiff, WorktreeSource, WorktreeStatus } from './types';

type Git = typeof import('isomorphic-git');
type Dir = FileSystemDirectoryHandle;
type PermissionDir = Dir & {
  queryPermission?: (o: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>;
  requestPermission?: (o: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>;
};
type PickerWindow = Window & { showDirectoryPicker?: (o?: { id?: string; mode?: 'read' | 'readwrite' }) => Promise<Dir> };

/** isomorphic-git expects Node's Buffer; load it (and the library) on first use only. */
let gitModule: Promise<Git> | null = null;
function loadGit() {
  const g = globalThis as { Buffer?: typeof Buffer };
  g.Buffer ??= Buffer;
  return (gitModule ??= import('isomorphic-git'));
}

export const browserFoldersSupported = () => typeof window !== 'undefined' && 'showDirectoryPicker' in window;

/* ── Remembered locations (IndexedDB can store handles; localStorage can't) ── */

interface SavedLocation { id: string; name: string; handle: Dir }

function store<T>(mode: IDBTransactionMode, action: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('worktree-atlas', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('locations', { keyPath: 'id' });
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('locations', mode);
      const op = action(tx.objectStore('locations'));
      tx.oncomplete = () => { db.close(); resolve(op.result); };
      tx.onabort = tx.onerror = () => { db.close(); reject(tx.error ?? op.error); };
    };
  });
}

/* ── Small file helpers ── */

const SKIP = new Set(['node_modules', 'Library', 'Applications', 'AppData', 'Caches', 'DerivedData', 'Pods', 'dist', 'build',
  'out', 'target', 'vendor', 'venv', 'coverage', 'tmp', '__pycache__']);
const MAX_DEPTH = 5;
const MAX_TEXT = 1024 * 1024;

const join = (...parts: string[]) => parts.filter(Boolean).join('/');
const isMissing = (e: unknown) => e instanceof DOMException && (e.name === 'NotFoundError' || e.name === 'TypeMismatchError');

async function child(dir: Dir, name: string): Promise<FileSystemHandle | null> {
  try { return await dir.getDirectoryHandle(name); } catch (e) {
    if (!isMissing(e)) throw e;
    try { return await dir.getFileHandle(name); } catch (e2) { if (isMissing(e2)) return null; throw e2; }
  }
}
async function subdir(dir: Dir, path: string[]): Promise<Dir | null> {
  let at = dir;
  for (const part of path) {
    try { at = await at.getDirectoryHandle(part); } catch (e) { if (isMissing(e)) return null; throw e; }
  }
  return at;
}
async function readText(dir: Dir, path: string): Promise<string | null> {
  const parts = path.split('/');
  const parent = await subdir(dir, parts.slice(0, -1));
  if (!parent) return null;
  try { return await (await (await parent.getFileHandle(parts[parts.length - 1])).getFile()).text(); } catch (e) {
    if (isMissing(e)) return null; throw e;
  }
}
async function modifiedAt(dir: Dir, path: string): Promise<number | undefined> {
  const parts = path.split('/');
  const parent = await subdir(dir, parts.slice(0, -1));
  try { return parent ? (await (await parent.getFileHandle(parts[parts.length - 1])).getFile()).lastModified : undefined; } catch { return undefined; }
}
async function names(dir: Dir): Promise<{ name: string; kind: FileSystemHandleKind }[]> {
  const out: { name: string; kind: FileSystemHandleKind }[] = [];
  for await (const [name, handle] of (dir as Dir & { entries(): AsyncIterable<[string, FileSystemHandle]> }).entries()) out.push({ name, kind: handle.kind });
  return out;
}

/** A loose ref, else the packed one. */
async function readRef(git: Dir, ref: string): Promise<string | null> {
  const loose = (await readText(git, ref))?.trim();
  if (loose) return loose;
  const packed = await readText(git, 'packed-refs');
  const line = packed?.split('\n').find((l) => l.endsWith(` ${ref}`));
  return line ? line.split(' ')[0] : null;
}
async function readHead(common: Dir, own: Dir) {
  const head = (await readText(own, 'HEAD'))?.trim() ?? '';
  if (head.startsWith('ref: ')) {
    const ref = head.slice(5);
    return { branch: ref.replace(/^refs\/heads\//, ''), oid: (await readRef(common, ref)) ?? '' };
  }
  return { branch: null, oid: head };
}
async function baseBranchOf(common: Dir) {
  for (const b of ['main', 'master', 'trunk', 'develop']) if (await readRef(common, `refs/heads/${b}`)) return b;
  return 'main';
}

/* ── The source ── */

interface Checkout { location: LocationState; rel: string; dir: Dir }
interface LocationState extends SavedLocation { connected: boolean; abs: string | null }
/** What it takes to read one worktree with git. */
interface Handles { checkout: Dir | null; common: Dir; own: Dir; entry: string | null; parent: Dir | null; location: LocationState | null }

export interface BrowserSourceOptions {
  /** Called when the list of locations changes (added, removed, connected). */
  onLocationsChange?: () => void;
  /** Start from these folders instead of the ones remembered in IndexedDB (tests, or an app that already has handles). */
  folders?: FileSystemDirectoryHandle[];
}

export function createBrowserSource(options: BrowserSourceOptions = {}): WorktreeSource & { ready: Promise<void> } {
  let locations: LocationState[] = [];
  const handles = new Map<string, Handles>();
  const changed = () => options.onLocationsChange?.();

  const saved = options.folders
    ? Promise.resolve(options.folders.map((handle, i) => ({ id: `folder-${i}`, name: handle.name, handle })))
    : store<SavedLocation[]>('readonly', (s) => s.getAll());
  const ready = saved.then(async (saved) => {
    locations = await Promise.all(saved.map(async (l) => {
      const h = l.handle as PermissionDir;
      const connected = !h.queryPermission || (await h.queryPermission({ mode: 'read' })) === 'granted';
      return { ...l, connected, abs: null };
    }));
    changed();
  }).catch(() => {});

  /** The folder at an absolute path, through whichever opened location contains it. */
  async function resolve(abs: string): Promise<{ dir: Dir | null; parent: Dir | null; location: LocationState } | null> {
    for (const l of locations) {
      if (!l.connected || !l.abs || (abs !== l.abs && !abs.startsWith(`${l.abs}/`))) continue;
      const parts = abs.slice(l.abs.length).split('/').filter(Boolean);
      const parent = await subdir(l.handle, parts.slice(0, -1));
      const dir = parts.length === 0 ? l.handle : parent ? await subdir(parent, parts.slice(-1)) : null;
      return { dir, parent, location: l };
    }
    return null;
  }

  async function walk(l: LocationState, onProgress: ((p: ScanProgress) => void) | undefined, found: { repos: Checkout[]; linked: (Checkout & { gitdir: string })[] }) {
    const queue: { dir: Dir; rel: string; depth: number }[] = [{ dir: l.handle, rel: '', depth: 0 }];
    while (queue.length) {
      const { dir, rel, depth } = queue.shift()!;
      onProgress?.({ at: join(l.name, rel), found: found.repos.length + found.linked.length });
      let entries: { name: string; kind: FileSystemHandleKind }[];
      try { entries = await names(dir); } catch { continue; }
      const git = entries.find((e) => e.name === '.git');
      if (git?.kind === 'directory') { found.repos.push({ location: l, rel, dir }); continue; }
      if (git?.kind === 'file') {
        const text = (await readText(dir, '.git'))?.trim() ?? '';
        if (text.startsWith('gitdir: ')) found.linked.push({ location: l, rel, dir, gitdir: text.slice(8) });
        continue;
      }
      if (depth >= MAX_DEPTH) continue;
      for (const e of entries) {
        // Hidden folders are skipped except the agent worktree homes (~/.codex, .claude/worktrees).
        if (e.kind !== 'directory' || SKIP.has(e.name) || (e.name.startsWith('.') && !['.codex', '.claude', '.worktrees'].includes(e.name))) continue;
        queue.push({ dir: await dir.getDirectoryHandle(e.name), rel: join(rel, e.name), depth: depth + 1 });
      }
    }
  }

  /** A repository's records of its linked worktrees: entry name → the checkout's absolute path. */
  async function recordsOf(repo: Checkout) {
    const records = await subdir(await repo.dir.getDirectoryHandle('.git'), ['worktrees']);
    const out: { name: string; checkout: string }[] = [];
    for (const r of records ? await names(records) : []) {
      const gitdir = r.kind === 'directory' ? (await readText(records!, `${r.name}/gitdir`))?.trim() : undefined;
      if (gitdir?.endsWith('/.git')) out.push({ name: r.name, checkout: gitdir.slice(0, -5) });
    }
    return out;
  }

  /** `path` without its trailing `rel`, or null when it doesn't end with it. */
  const strip = (path: string, rel: string) => (!rel ? path : path.endsWith(`/${rel}`) ? path.slice(0, -(rel.length + 1)) : null);

  /** Works out where on disk each opened folder is. A linked worktree's `.git` file names its repository, and the
      repository's record names the worktree: when both were found in the walk, the two paths pin both locations. */
  async function pin(found: { repos: Checkout[]; linked: (Checkout & { gitdir: string })[] }) {
    const records = new Map<Checkout, { name: string; checkout: string }[]>();
    for (const repo of found.repos) records.set(repo, await recordsOf(repo).catch(() => []));
    for (const w of found.linked) {
      const m = /^(.*)\/\.git\/worktrees\/([^/]+)$/.exec(w.gitdir);
      if (!m) continue;
      for (const repo of found.repos) {
        const record = records.get(repo)!.find((r) => r.name === m[2]);
        const abs = record ? strip(record.checkout, w.rel) : null;
        const repoAbs = strip(m[1], repo.rel);
        if (abs === null || repoAbs === null || (w.location === repo.location && abs !== repoAbs)) continue;
        w.location.abs ??= abs;
        repo.location.abs ??= repoAbs;
        break;
      }
    }
    // A location with repositories but none of their worktrees in the walk (they sit in skipped or hidden folders):
    // try each record's path from its tail; the longest tail that exists here and links back wins.
    for (const repo of found.repos) {
      const l = repo.location;
      for (const r of l.abs ? [] : records.get(repo)!) {
        const parts = r.checkout.split('/').filter(Boolean);
        for (let k = parts.length - 1; k >= 1 && !l.abs; k--) {
          const dir = await subdir(l.handle, parts.slice(parts.length - k));
          const text = dir ? (await readText(dir, '.git'))?.trim() : null;
          if (!text?.startsWith('gitdir: ') || !text.endsWith(`/.git/worktrees/${r.name}`)) continue;
          const abs = `/${parts.slice(0, parts.length - k).join('/')}`;
          if (strip(text.slice(8, -`/.git/worktrees/${r.name}`.length), repo.rel) === abs) l.abs = abs;
        }
        if (l.abs) break;
      }
    }
  }

  async function project(repo: Checkout, abs: string | null): Promise<Project> {
    const common = await repo.dir.getDirectoryHandle('.git');
    const name = repo.rel.split('/').pop() || repo.location.name;
    const id = abs ?? `${repo.location.id}:${repo.rel}`;
    const baseBranch = await baseBranchOf(common);
    const own = await readHead(common, common);
    const worktrees: Worktree[] = [{
      id: `${id}#`, projectId: id, name, path: abs ?? join(repo.location.name, repo.rel), branch: own.branch, head: own.oid.slice(0, 7),
      primary: true, modified: Math.max((await modifiedAt(common, 'index')) ?? 0, (await modifiedAt(common, 'logs/HEAD')) ?? 0) || undefined,
    }];
    handles.set(`${id}#`, { checkout: repo.dir, common, own: common, entry: null, parent: null, location: repo.location });
    const records = await subdir(common, ['worktrees']);
    let unreachable = 0;
    for (const r of records ? await names(records) : []) {
      if (r.kind !== 'directory') continue;
      const record = await records!.getDirectoryHandle(r.name);
      const gitdir = (await readText(record, 'gitdir'))?.trim() ?? '';
      const path = gitdir.replace(/\/\.git$/, '');
      const head = await readHead(common, record);
      const at = path ? await resolve(path) : null;
      const wid = `${id}#${r.name}`;
      const missing = !!at && !at.dir;
      if (!at) unreachable++;
      worktrees.push({
        id: wid, projectId: id, name: path.split('/').pop() || r.name, path: path || r.name, branch: head.branch, head: head.oid.slice(0, 7),
        primary: false, locked: !!(await child(record, 'locked')), missing, unreachable: !at,
        modified: Math.max((await modifiedAt(record, 'index')) ?? 0, (await modifiedAt(record, 'logs/HEAD')) ?? 0) || undefined,
      });
      handles.set(wid, { checkout: at?.dir ?? null, common, own: record, entry: r.name, parent: at?.parent ?? null, location: at?.location ?? null });
    }
    return {
      id, name, path: abs ?? join(repo.location.name, repo.rel), baseBranch, worktrees,
      note: unreachable ? `${unreachable} worktree${unreachable > 1 ? 's are' : ' is'} outside the opened folders. Add a folder that contains ${unreachable > 1 ? 'them' : 'it'} to read or delete ${unreachable > 1 ? 'them' : 'it'}.` : undefined,
    };
  }

  async function scan(onProgress?: (p: ScanProgress) => void): Promise<Project[]> {
    await ready;
    handles.clear();
    const found = { repos: [] as Checkout[], linked: [] as (Checkout & { gitdir: string })[] };
    for (const l of locations) if (l.connected) await walk(l, onProgress, found);
    await pin(found);
    // Repositories that only their linked worktrees led us to (a repo in one location, its worktrees in another).
    const repos = found.repos.map((r) => ({ repo: r, abs: r.location.abs ? join(r.location.abs, r.rel) || r.location.abs : null }));
    for (const w of found.linked) {
      const repoAbs = w.gitdir.replace(/\/\.git\/worktrees\/[^/]+$/, '');
      if (repos.some((r) => r.abs === repoAbs)) continue;
      const at = await resolve(repoAbs);
      if (at?.dir) repos.push({ repo: { location: at.location, rel: repoAbs.slice(at.location.abs!.length + 1), dir: at.dir }, abs: repoAbs });
    }
    const projects: Project[] = [];
    for (const { repo, abs } of repos) {
      if (abs && projects.some((p) => p.id === abs)) continue;
      try { projects.push(await project(repo, abs)); } catch { /* unreadable: skipped */ }
    }
    return projects.sort((a, b) => a.name.localeCompare(b.name));
  }

  /** isomorphic-git over this worktree's three folders, with its index as the stat cache. */
  async function open(wt: Worktree) {
    const h = handles.get(wt.id);
    if (!h?.checkout) throw new Error(wt.unreachable ? 'This worktree is outside the opened folders.' : 'This worktree’s folder is missing.');
    const index = await h.own.getFileHandle('index').then((f) => f.getFile()).then((f) => f.arrayBuffer()).catch(() => null);
    const hints = new Map([...(index ? parseIndex(new Uint8Array(index)) : new Map())].map(([p, s]) => [`/wt/${p}`, s]));
    const mounts: Mount[] = [{ at: '/wt', dir: h.checkout }, { at: '/git', dir: h.common }];
    if (h.entry) mounts.push({ at: '/git/HEAD', dir: h.own, file: 'HEAD' }, { at: '/git/index', dir: h.own, file: 'index' });
    return { git: await loadGit(), fs: new HandleFs(mounts, hints), dir: '/wt', gitdir: '/git', cache: {} };
  }

  type Opened = Awaited<ReturnType<typeof open>>;
  type Row = { path: string; base?: string; head?: string; work?: string };

  /** Blob ids for every path at `refs` (merge base, HEAD…) and in the checkout, skipping ignored files. */
  async function compare(o: Opened, refs: string[], signal?: AbortSignal): Promise<Row[]> {
    const { git, fs, dir, gitdir, cache } = o;
    const trees = [...refs.map((ref) => git.TREE({ ref })), git.WORKDIR()];
    return git.walk({
      fs, dir, gitdir, cache, trees,
      map: async (path, entries) => {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        if (path === '.') return undefined;
        if (path === '.git' || path.endsWith('/.git')) return null;
        const work = entries[entries.length - 1];
        const tracked = entries.slice(0, -1).some(Boolean);
        if (work && !tracked && await git.isIgnored({ fs, dir, gitdir, filepath: path })) return null;
        const types = await Promise.all(entries.map((e) => e?.type()));
        if (types.some((t) => t === 'commit' || t === 'special')) return null;
        if (types.every((t) => t === undefined || t === 'tree')) return undefined;
        const oid = async (i: number) => (types[i] === 'blob' ? await entries[i]!.oid() : undefined);
        const ids = await Promise.all(entries.map((_, i) => oid(i)));
        const row: Row = { path, work: ids[ids.length - 1] };
        if (refs.length === 2) { row.base = ids[0]; row.head = ids[1]; } else row.head = ids[0];
        return row;
      },
    }) as Promise<Row[]>;
  }

  const decode = (bytes: Uint8Array): { text?: string; skipped?: DiffFile['skipped'] } => {
    if (bytes.length > MAX_TEXT) return { skipped: 'large' };
    if (bytes.subarray(0, 8000).includes(0)) return { skipped: 'binary' };
    return { text: new TextDecoder().decode(bytes) };
  };

  async function count(o: Opened, from: string, until: string) {
    if (from === until) return 0;
    const commits = await o.git.log({ fs: o.fs, gitdir: o.gitdir, ref: from, depth: 500, cache: o.cache }).catch(() => []);
    const i = commits.findIndex((c) => c.oid === until);
    return i < 0 ? commits.length : i;
  }

  async function diff(wt: Worktree, signal?: AbortSignal): Promise<WorktreeDiff> {
    const o = await open(wt);
    const { git, fs, gitdir, cache } = o;
    const baseBranch = await baseBranchOf(handles.get(wt.id)!.common);
    const head = await git.resolveRef({ fs, gitdir, ref: 'HEAD' });
    const tip = await git.resolveRef({ fs, gitdir, ref: `refs/heads/${baseBranch}` }).catch(() => head);
    const [base = tip] = await git.findMergeBase({ fs, gitdir, oids: [head, tip], cache });
    const rows = await compare(o, [base, head], signal);
    const files: DiffFile[] = [];
    for (const r of rows) {
      if (r.base === r.work) continue;
      const status = !r.base ? 'added' : !r.work ? 'deleted' : 'modified';
      const file: DiffFile = { path: r.path, status };
      if (r.base) {
        const { blob } = await git.readBlob({ fs, gitdir, oid: r.base, cache });
        const d = decode(blob);
        file.before = d.text; file.skipped ??= d.skipped;
      }
      if (r.work) {
        const d = decode(new Uint8Array(await fs.promises.readFile(`/wt/${r.path}`) as Buffer));
        file.after = d.text; file.skipped ??= d.skipped;
      }
      files.push(file);
    }
    return {
      baseBranch, base: base.slice(0, 7), ahead: await count(o, head, base), behind: await count(o, tip, base),
      dirty: rows.some((r) => r.head !== r.work), files,
    };
  }

  async function status(wt: Worktree): Promise<WorktreeStatus> {
    if (wt.missing) return { dirty: false, changed: 0 };
    const o = await open(wt);
    const head = await o.git.resolveRef({ fs: o.fs, gitdir: o.gitdir, ref: 'HEAD' });
    const changed = (await compare(o, [head])).filter((r) => r.head !== r.work).length;
    return { dirty: changed > 0, changed };
  }

  async function remove(worktrees: Worktree[], { force }: { force: boolean }): Promise<RemoveResult[]> {
    // Ask for write access first, while the press that started this still counts as a user gesture.
    const roots = new Set<PermissionDir>();
    for (const wt of worktrees) {
      const h = handles.get(wt.id);
      if (h?.location) roots.add(h.location.handle);
      const repo = handles.get(`${wt.projectId}#`);
      if (repo?.location) roots.add(repo.location.handle);
    }
    const granted = new Set<PermissionDir>();
    for (const root of roots) {
      if (!root.requestPermission || (await root.requestPermission({ mode: 'readwrite' })) === 'granted') granted.add(root);
    }
    const results: RemoveResult[] = [];
    for (const wt of worktrees) {
      const h = handles.get(wt.id);
      const fail = (error: string) => results.push({ id: wt.id, ok: false, error });
      if (!h) { fail('Scan again: this worktree is no longer known.'); continue; }
      if (wt.primary) { fail('The repository’s own checkout can’t be deleted.'); continue; }
      if (wt.locked) { fail('Locked. Run git worktree unlock first.'); continue; }
      if (wt.unreachable) { fail('Outside the opened folders.'); continue; }
      const repo = handles.get(`${wt.projectId}#`);
      if (!repo?.location || !granted.has(repo.location.handle) || (h.location && !granted.has(h.location.handle))) { fail('Write access was not granted.'); continue; }
      try {
        if (!wt.missing && !force && (await status(wt)).dirty) { fail('Has uncommitted changes.'); continue; }
        if (h.checkout) {
          const self = h.checkout as Dir & { remove?: (o: { recursive: boolean }) => Promise<void> };
          if (h.parent) await h.parent.removeEntry(h.checkout.name, { recursive: true });
          else if (self.remove) await self.remove({ recursive: true });
          else { fail('Its folder is an opened location; remove it in Finder.'); continue; }
        }
        const records = await h.common.getDirectoryHandle('worktrees');
        await records.removeEntry(h.entry!, { recursive: true });
        handles.delete(wt.id);
        results.push({ id: wt.id, ok: true });
      } catch (e) { fail(e instanceof Error ? e.message : String(e)); }
    }
    return results;
  }

  return {
    label: 'This browser',
    ready,
    scan, diff, status, remove,
    locations: (): Location[] => locations.map((l) => ({ id: l.id, name: l.name, connected: l.connected })),
    async addLocation() {
      const pick = (window as PickerWindow).showDirectoryPicker;
      if (!pick) return false;
      let handle: Dir;
      try { handle = await pick({ id: 'worktree-atlas', mode: 'read' }); } catch { return false; }
      for (const l of locations) if (await l.handle.isSameEntry(handle)) { l.connected = true; changed(); return true; }
      const saved = { id: crypto.randomUUID(), name: handle.name, handle };
      await store('readwrite', (s) => s.put(saved));
      locations = [...locations, { ...saved, connected: true, abs: null }];
      changed();
      return true;
    },
    async removeLocation(id) {
      await store('readwrite', (s) => s.delete(id));
      locations = locations.filter((l) => l.id !== id);
      changed();
    },
    async reconnect(id) {
      const l = locations.find((x) => x.id === id);
      const h = l?.handle as PermissionDir | undefined;
      if (!l || !h) return false;
      l.connected = !h.requestPermission || (await h.requestPermission({ mode: 'read' })) === 'granted';
      changed();
      return l.connected;
    },
  };
}

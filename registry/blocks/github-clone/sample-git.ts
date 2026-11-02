/* The sample repository's git: real commits over snapshots of plain text files, small enough to keep whole. It exists so
   the sample's history, branches, compare, merges, conflicts and blame are computed rather than written down, and a file
   committed in the demo really shows up in its tree, its history and the diff of the pull request it opens. Used by
   sample-server.ts; nothing here knows about GitHub's JSON. */

export interface GitPerson {
  name: string;
  email: string;
  login?: string;
  date: string;
}

export interface GitCommit {
  sha: string;
  parents: string[];
  message: string;
  author: GitPerson;
  committer: GitPerson;
  /** The whole tree at this commit: path to text. */
  files: ReadonlyMap<string, string>;
}

export interface DiffEntry {
  path: string;
  status: 'added' | 'removed' | 'modified' | 'renamed';
  additions: number;
  deletions: number;
  patch: string;
  previous?: string;
}

/** A stable 40-hex name for whatever goes in: the sample's shas are the same in every run. */
export function hashOf(text: string): string {
  const h = [0x811c9dc5, 0x1b873593, 0xcc9e2d51, 0x2545f491, 0x9e3779b1];
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    for (let k = 0; k < h.length; k++) h[k] = Math.imul(h[k] ^ c, 0x01000193 + k * 2) >>> 0;
  }
  // Two rounds so short inputs still spread across every word.
  for (let round = 0; round < 2; round++) {
    for (let k = 0; k < h.length; k++) h[k] = Math.imul(h[k] ^ (h[(k + 1) % h.length] >>> 13), 0x5bd1e995) >>> 0;
  }
  return h.map((n) => n.toString(16).padStart(8, '0')).join('');
}

/* ── Line diff ── */

export type LineOp = { t: 'ctx' | 'add' | 'del'; text: string; a: number; b: number };

const split = (text: string) => {
  if (!text) return [];
  const lines = text.split('\n');
  if (lines.at(-1) === '') lines.pop();
  return lines;
};

/** Longest-common-subsequence line diff; `a`/`b` are 1-based line numbers. Sample files are small, so O(n·m) is fine. */
export function diffLines(before: string, after: string): LineOp[] {
  const a = split(before);
  const b = split(after);
  const n = a.length;
  const m = b.length;
  const lcs: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const ops: LineOp[] = [];
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) ops.push({ t: 'ctx', text: a[i++], a: i, b: ++j });
    else if (i < n && (j >= m || lcs[i + 1][j] >= lcs[i][j + 1])) ops.push({ t: 'del', text: a[i++], a: i, b: j });
    else ops.push({ t: 'add', text: b[j++], a: i, b: j });
  }
  return ops;
}

/** Unified hunks in the form GitHub's `patch` field uses (no file header). */
export function patchOf(ops: LineOp[], context = 3): string {
  const changed = ops.map((o, i) => (o.t === 'ctx' ? -1 : i)).filter((i) => i >= 0);
  if (!changed.length) return '';
  const hunks: [number, number][] = [];
  for (const i of changed) {
    const from = Math.max(0, i - context);
    const to = Math.min(ops.length - 1, i + context);
    const last = hunks.at(-1);
    if (last && from <= last[1] + 1) last[1] = to;
    else hunks.push([from, to]);
  }
  const out: string[] = [];
  for (const [from, to] of hunks) {
    const rows = ops.slice(from, to + 1);
    const del = rows.filter((r) => r.t !== 'add').length;
    const add = rows.filter((r) => r.t !== 'del').length;
    // A side with no lines starts on the line before the change, as git writes it.
    const aStart = rows.find((r) => r.t !== 'add')?.a ?? rows[0].a;
    const bStart = rows.find((r) => r.t !== 'del')?.b ?? rows[0].b;
    out.push(`@@ -${aStart},${del} +${bStart},${add} @@`);
    for (const r of rows) out.push((r.t === 'add' ? '+' : r.t === 'del' ? '-' : ' ') + r.text);
  }
  return out.join('\n');
}

/** What changed between two trees, sorted by path; an unchanged file moved to a new path reads as a rename. */
export function diffTrees(before: ReadonlyMap<string, string>, after: ReadonlyMap<string, string>): DiffEntry[] {
  const out: DiffEntry[] = [];
  const removed = new Map<string, string>();
  for (const [path, text] of before) if (!after.has(path)) removed.set(path, text);
  for (const [path, text] of after) {
    const old = before.get(path);
    if (old === text) continue;
    if (old === undefined) {
      const from = [...removed].find(([, t]) => t === text);
      if (from && text) {
        removed.delete(from[0]);
        out.push({ path, status: 'renamed', additions: 0, deletions: 0, patch: '', previous: from[0] });
        continue;
      }
    }
    const ops = diffLines(old ?? '', text);
    out.push({
      path,
      status: old === undefined ? 'added' : 'modified',
      additions: ops.filter((o) => o.t === 'add').length,
      deletions: ops.filter((o) => o.t === 'del').length,
      patch: patchOf(ops),
    });
  }
  for (const [path, text] of removed) {
    const ops = diffLines(text, '');
    out.push({ path, status: 'removed', additions: 0, deletions: ops.length, patch: patchOf(ops) });
  }
  return out.sort((x, y) => x.path.localeCompare(y.path));
}

/* ── The repository ── */

export class GitStore {
  readonly commits = new Map<string, GitCommit>();
  readonly branches = new Map<string, string>();
  readonly tags = new Map<string, string>();
  private counter = 0;

  commit(input: { parents: string[]; message: string; author: Omit<GitPerson, 'date'>; date: string; files: ReadonlyMap<string, string>; committer?: Omit<GitPerson, 'date'> }): GitCommit {
    // The counter keeps two identical commits apart (a re-run of the same edit is still a new commit).
    const sha = hashOf([input.parents.join(), input.message, input.author.email, input.date, this.counter++, ...[...input.files].map(([p, t]) => p + '\0' + t)].join('\n'));
    const c: GitCommit = {
      sha,
      parents: input.parents,
      message: input.message,
      author: { ...input.author, date: input.date },
      committer: { ...(input.committer ?? input.author), date: input.date },
      files: input.files,
    };
    this.commits.set(sha, c);
    return c;
  }

  /** A branch, tag or (abbreviated) sha to its commit. */
  resolve(ref: string): GitCommit | undefined {
    const name = ref.replace(/^refs\/(heads|tags)\//, '');
    const sha = this.branches.get(name) ?? this.tags.get(name) ?? (this.commits.has(name) ? name : undefined);
    if (sha) return this.commits.get(sha);
    if (name.length >= 7 && /^[0-9a-f]+$/.test(name)) {
      for (const [k, c] of this.commits) if (k.startsWith(name)) return c;
    }
    return undefined;
  }

  /** `sha` and everything behind it, newest first (by date, first parent breaking ties). */
  log(sha: string): GitCommit[] {
    const seen = new Set<string>();
    const out: GitCommit[] = [];
    const walk = (s: string) => {
      if (seen.has(s)) return;
      seen.add(s);
      const c = this.commits.get(s);
      if (!c) return;
      out.push(c);
      c.parents.forEach(walk);
    };
    walk(sha);
    return out.sort((a, b) => Date.parse(b.committer.date) - Date.parse(a.committer.date));
  }

  /** The commits on `sha` that changed `path` (a file or a folder). */
  history(sha: string, path: string): GitCommit[] {
    const touches = (c: GitCommit) => {
      const parent = c.parents[0] ? this.commits.get(c.parents[0]) : undefined;
      const inPath = (p: string) => p === path || p.startsWith(path + '/');
      const now = [...c.files].filter(([p]) => inPath(p));
      const was = parent ? [...parent.files].filter(([p]) => inPath(p)) : [];
      return now.length !== was.length || now.some(([p, t]) => parent?.files.get(p) !== t);
    };
    return this.log(sha).filter(touches);
  }

  /** The latest commit both sides have. */
  mergeBase(a: string, b: string): GitCommit | undefined {
    const ours = new Set(this.log(a).map((c) => c.sha));
    return this.log(b).find((c) => ours.has(c.sha));
  }

  /** Commits `head` has that `base` doesn't, oldest first (what a pull request's Commits tab lists). */
  ahead(base: string, head: string): GitCommit[] {
    const theirs = new Set(this.log(base).map((c) => c.sha));
    return this.log(head).filter((c) => !theirs.has(c.sha)).reverse();
  }

  /**
   * A three-way merge by whole file: each side's change to a different file combines; both sides changing the same file
   * merges it only when their line changes don't overlap. Null means a conflict, with the paths that clash.
   */
  merge(base: string, head: string): { files: Map<string, string>; conflicts: string[] } {
    const ancestor = this.mergeBase(base, head);
    const ours = this.commits.get(base)!.files;
    const theirs = this.commits.get(head)!.files;
    const start = ancestor?.files ?? new Map<string, string>();
    const files = new Map(ours);
    const conflicts: string[] = [];
    for (const path of new Set([...theirs.keys(), ...start.keys()])) {
      const o = start.get(path);
      const b = ours.get(path);
      const t = theirs.get(path);
      if (t === o || t === b) continue; // Theirs didn't change, or both ended up the same.
      if (b === o) {
        if (t === undefined) files.delete(path);
        else files.set(path, t);
        continue;
      }
      if (o !== undefined && b !== undefined && t !== undefined) {
        const merged = mergeText(o, b, t);
        if (merged != null) {
          files.set(path, merged);
          continue;
        }
      }
      conflicts.push(path);
    }
    return { files, conflicts };
  }

  /** Per line of `path` at `sha`: the commit that last changed it. */
  blame(sha: string, path: string): { start: number; end: number; commit: GitCommit }[] {
    const commits = this.history(sha, path).reverse();
    let owners: GitCommit[] = [];
    let text = '';
    for (const c of commits) {
      const next = c.files.get(path) ?? '';
      const lines: GitCommit[] = [];
      let i = 0;
      for (const op of diffLines(text, next)) {
        if (op.t === 'ctx') lines.push(owners[i++]);
        else if (op.t === 'del') i++;
        else lines.push(c);
      }
      owners = lines;
      text = next;
    }
    const out: { start: number; end: number; commit: GitCommit }[] = [];
    owners.forEach((commit, i) => {
      const last = out.at(-1);
      if (last && last.commit.sha === commit.sha) last.end = i + 1;
      else out.push({ start: i + 1, end: i + 1, commit });
    });
    return out;
  }
}

/** Applies both sides' line changes to the ancestor; null when they touch the same lines. */
export function mergeText(base: string, ours: string, theirs: string): string | null {
  const edits = (other: string) => {
    // ancestor line index → what replaces it (a change run is keyed by the line it starts on).
    const out: { from: number; to: number; lines: string[] }[] = [];
    let run: { from: number; to: number; lines: string[] } | null = null;
    let at = 0;
    for (const op of diffLines(base, other)) {
      if (op.t === 'ctx') {
        if (run) out.push(run);
        run = null;
        at++;
        continue;
      }
      run ??= { from: at, to: at, lines: [] };
      if (op.t === 'del') {
        at++;
        run.to = at;
      } else run.lines.push(op.text);
    }
    if (run) out.push(run);
    return out;
  };
  const all = [...edits(ours), ...edits(theirs)].sort((x, y) => x.from - y.from);
  for (let i = 1; i < all.length; i++) {
    const [p, q] = [all[i - 1], all[i]];
    const same = p.from === q.from && p.to === q.to && p.lines.join('\n') === q.lines.join('\n');
    if (!same && q.from < Math.max(p.to, p.from + 1)) return null;
  }
  const lines = split(base);
  const out: string[] = [];
  let at = 0;
  let previous: { from: number; to: number; lines: string[] } | null = null;
  for (const e of all) {
    if (previous && previous.from === e.from && previous.to === e.to && previous.lines.join('\n') === e.lines.join('\n')) continue;
    out.push(...lines.slice(at, e.from), ...e.lines);
    at = e.to;
    previous = e;
  }
  out.push(...lines.slice(at));
  return out.join('\n') + (base.endsWith('\n') || !base ? '\n' : '');
}

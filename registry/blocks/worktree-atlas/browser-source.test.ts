/* The browser source against real repositories: worktrees made with the git CLI in a temp folder, read through a
   small File System Access shim over node:fs, so discovery, diffs and deletes run exactly as they do in Chrome. */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createBrowserSource } from './browser-source';
import type { Project, Worktree } from './types';

const notFound = () => new DOMException('not found', 'NotFoundError');
const mismatch = () => new DOMException('type mismatch', 'TypeMismatchError');

class FileShim {
  readonly kind = 'file' as const;
  constructor(readonly path: string, readonly name: string) {}
  async getFile() {
    const s = statSync(this.path);
    return new File([readFileSync(this.path)], this.name, { lastModified: s.mtimeMs });
  }
}

class DirShim {
  readonly kind = 'directory' as const;
  constructor(readonly path: string, readonly name: string) {}
  /** Chrome's rule: one plain name, never empty, `.`, `..` or containing a slash. */
  private at(name: string) {
    if (!name || name === '.' || name === '..' || name.includes('/')) throw new TypeError(`Name is not allowed: ${JSON.stringify(name)}`);
    return join(this.path, name);
  }
  async getDirectoryHandle(name: string) {
    if (!existsSync(this.at(name))) throw notFound();
    if (!statSync(this.at(name)).isDirectory()) throw mismatch();
    return new DirShim(this.at(name), name);
  }
  async getFileHandle(name: string) {
    if (!existsSync(this.at(name))) throw notFound();
    if (statSync(this.at(name)).isDirectory()) throw mismatch();
    return new FileShim(this.at(name), name);
  }
  async *entries() {
    for (const name of readdirSync(this.path)) {
      yield [name, statSync(this.at(name)).isDirectory() ? new DirShim(this.at(name), name) : new FileShim(this.at(name), name)] as const;
    }
  }
  async *keys() { for (const name of readdirSync(this.path)) yield name; }
  async removeEntry(name: string, { recursive = false } = {}) {
    if (!existsSync(this.at(name))) throw notFound();
    rmSync(this.at(name), { recursive });
  }
  async isSameEntry(other: { path?: string }) { return other.path === this.path; }
  async queryPermission() { return 'granted'; }
  async requestPermission() { return 'granted'; }
}

const asHandle = (path: string) => new DirShim(path, path.split('/').pop()!) as unknown as FileSystemDirectoryHandle;

let root: string, outside: string;
const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', ['-c', 'user.name=Atlas', '-c', 'user.email=atlas@example.com', ...args], { cwd, encoding: 'utf8' });
const write = (path: string, text: string) => { mkdirSync(join(path, '..'), { recursive: true }); writeFileSync(path, text); };

beforeAll(() => {
  // realpath: macOS's /var is a symlink to /private/var, and Git records real paths.
  root = realpathSync(mkdtempSync(join(tmpdir(), 'atlas-')));
  outside = realpathSync(mkdtempSync(join(tmpdir(), 'atlas-outside-')));
  const app = join(root, 'code/app');
  mkdirSync(app, { recursive: true });
  git(app, 'init', '-q', '-b', 'main');
  write(join(app, 'a.ts'), 'export const a = 1;\n');
  write(join(app, 'src/b.ts'), 'export const b = 2;\n');
  write(join(app, '.gitignore'), 'node_modules\n.claude\n');
  git(app, 'add', '-A');
  git(app, 'commit', '-q', '-m', 'init');

  const feat = join(app, '.claude/worktrees/feat');
  git(app, 'worktree', 'add', '-q', '-b', 'feat', feat);
  write(join(feat, 'a.ts'), 'export const a = 10;\n');
  write(join(feat, 'c.ts'), 'export const c = 3;\n');
  git(feat, 'add', '-A');
  git(feat, 'commit', '-q', '-m', 'feat');
  write(join(feat, 'src/b.ts'), 'export const b = 20;\n'); // uncommitted
  write(join(feat, 'new.txt'), 'untracked\n');
  write(join(feat, 'node_modules/x.js'), 'ignored\n');

  const fix = join(root, 'wt/fix');
  git(app, 'worktree', 'add', '-q', '-b', 'fix', fix);
  git(fix, 'rm', '-q', 'src/b.ts');
  git(fix, 'commit', '-q', '-m', 'fix');

  git(app, 'worktree', 'add', '-q', '-b', 'lockme', join(root, 'wt/lockme'));
  git(app, 'worktree', 'lock', join(root, 'wt/lockme'));
  git(app, 'worktree', 'add', '-q', '-b', 'gone', join(root, 'wt/gone'));
  rmSync(join(root, 'wt/gone'), { recursive: true });
  git(app, 'worktree', 'add', '-q', '-b', 'far', join(outside, 'far'));
  git(app, 'remote', 'add', 'origin', 'https://github.com/You/App.git');

  // Clones of the same project: one cloned from the local repo (with a branch nobody has), one with the GitHub
  // origin written the SSH way (with its own linked worktree), and an unrelated repository that is also called app.
  const copy = join(root, 'scratch/app-copy');
  mkdirSync(join(root, 'scratch'), { recursive: true });
  git(root, 'clone', '-q', app, copy);
  git(copy, 'switch', '-q', '-c', 'local-only');
  write(join(copy, 'e.ts'), 'export const e = 5;\n');
  git(copy, 'add', '-A');
  git(copy, 'commit', '-q', '-m', 'local');
  const ssh = join(root, 'elsewhere/app2');
  mkdirSync(join(root, 'elsewhere'), { recursive: true });
  git(root, 'clone', '-q', app, ssh);
  git(ssh, 'remote', 'set-url', 'origin', 'git@github.com:you/app.git');
  git(ssh, 'worktree', 'add', '-q', '-b', 'ssh-wt', join(root, 'wt/ssh-wt'));
  const other = join(root, 'misc/app');
  mkdirSync(other, { recursive: true });
  git(other, 'init', '-q', '-b', 'main');
  write(join(other, 'x.ts'), 'x\n');
  git(other, 'add', '-A');
  git(other, 'commit', '-q', '-m', 'other');
  // main moves on after the branches: they are behind by one.
  write(join(app, 'd.ts'), 'export const d = 4;\n');
  git(app, 'add', '-A');
  git(app, 'commit', '-q', '-m', 'main moves');
}, 60_000); // git clone runs any global hooks, which can take seconds

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
  rmSync(outside, { recursive: true, force: true });
});

describe('createBrowserSource', () => {
  let projects: Project[];
  const app = () => projects.find((p) => p.path === join(root, 'code/app')) as Project;
  const wt = (branch: string) => app().worktrees.find((w) => w.branch === branch && !w.clone) as Worktree;
  const clone = (dir: string) => app().worktrees.find((w) => w.path === join(root, dir)) as Worktree;
  const source = () => createBrowserSource({ folders: [asHandle(root)] });
  let s: ReturnType<typeof source>;

  beforeAll(async () => {
    s = source();
    projects = await s.scan();
  });

  it('groups every worktree under its repository, with absolute paths', () => {
    expect(projects.map((p) => p.path)).toEqual([join(root, 'code/app'), join(root, 'misc/app')]);
    const p = app();
    expect(p.baseBranch).toBe('main');
    expect(p.worktrees.filter((w) => !w.clone && w.path !== join(root, 'wt/ssh-wt')).map((w) => w.branch).sort())
      .toEqual(['far', 'feat', 'fix', 'gone', 'lockme', 'main']);
    expect(wt('main').primary).toBe(true);
    expect(wt('feat').path).toBe(join(root, 'code/app/.claude/worktrees/feat'));
  });

  it('folds clones of the same origin into one project, wherever and however they were cloned', () => {
    expect(clone('scratch/app-copy')).toMatchObject({ clone: true, primary: false, branch: 'local-only', projectId: app().id });
    expect(clone('elsewhere/app2')).toMatchObject({ clone: true, primary: false, branch: 'main' });
    // A clone's own linked worktrees come along.
    expect(clone('wt/ssh-wt')).toMatchObject({ primary: false, branch: 'ssh-wt' });
    expect(clone('wt/ssh-wt').clone).toBeFalsy();
    expect(wt('main').primary).toBe(true);
  });

  it('reads a clone’s unpushed branches, and won’t delete them (or a clone with linked worktrees) unforced', async () => {
    expect(await s.status(clone('scratch/app-copy'))).toEqual({ dirty: false, changed: 0, unpushed: ['local-only'] });
    expect(await s.status(clone('elsewhere/app2'))).toEqual({ dirty: false, changed: 0, unpushed: [] });
    const [kept] = await s.remove([clone('scratch/app-copy')], { force: false });
    expect(kept).toMatchObject({ ok: false, error: 'Unpushed: local-only.' });
    const [linked] = await s.remove([clone('elsewhere/app2')], { force: true });
    expect(linked).toMatchObject({ ok: false, error: 'Has 1 linked worktree; delete it first.' });
    const [gone] = await s.remove([clone('scratch/app-copy')], { force: true });
    expect(gone.ok).toBe(true);
    expect(existsSync(join(root, 'scratch/app-copy'))).toBe(false);
  }, 30_000);

  it('marks locked, missing and out-of-reach worktrees', () => {
    expect(wt('lockme').locked).toBe(true);
    expect(wt('gone').missing).toBe(true);
    expect(wt('far').unreachable).toBe(true);
    expect(wt('feat')).toMatchObject({ locked: false, missing: false, unreachable: false });
    expect(app().note).toMatch(/1 worktree is outside/);
  });

  it('diffs a worktree against its merge base with main, uncommitted and untracked files included', async () => {
    const d = await s.diff(wt('feat'));
    expect(d).toMatchObject({ baseBranch: 'main', ahead: 1, behind: 1, dirty: true });
    const files = Object.fromEntries(d.files.map((f) => [f.path, f]));
    expect(Object.keys(files).sort()).toEqual(['a.ts', 'c.ts', 'new.txt', 'src/b.ts']);
    expect(files['a.ts']).toMatchObject({ status: 'modified', before: 'export const a = 1;\n', after: 'export const a = 10;\n' });
    expect(files['c.ts']).toMatchObject({ status: 'added', after: 'export const c = 3;\n' });
    // main's later d.ts is not this worktree's change.
    expect(files['d.ts']).toBeUndefined();
  });

  it('diffs a deletion, and reads clean status', async () => {
    const d = await s.diff(wt('fix'));
    expect(d.files).toEqual([{ path: 'src/b.ts', status: 'deleted', before: 'export const b = 2;\n' }]);
    expect(d.dirty).toBe(false);
    expect(await s.status(wt('fix'))).toEqual({ dirty: false, changed: 0 });
    expect(await s.status(wt('feat'))).toEqual({ dirty: true, changed: 2 });
  });

  it('diffs the primary checkout against main itself', async () => {
    const d = await s.diff(wt('main'));
    expect(d).toMatchObject({ ahead: 0, behind: 0, dirty: false, files: [] });
  });

  it('removes like git worktree remove: keeps dirty (unless forced), locked and primary; prunes missing', async () => {
    const results = await s.remove([wt('feat'), wt('fix'), wt('gone'), wt('lockme'), wt('main')], { force: false });
    expect(Object.fromEntries(results.map((r) => [r.id.split('#')[1] || 'primary', r.ok]))).toEqual({
      feat: false, fix: true, gone: true, lockme: false, primary: false,
    });
    expect(existsSync(join(root, 'wt/fix'))).toBe(false);
    const listed = git(join(root, 'code/app'), 'worktree', 'list', '--porcelain');
    expect(listed).not.toContain('wt/fix');
    expect(listed).not.toContain('wt/gone');
    expect(listed).toContain('worktrees/feat');

    const forced = await s.remove([wt('feat')], { force: true });
    expect(forced[0].ok).toBe(true);
    expect(git(join(root, 'code/app'), 'worktree', 'list', '--porcelain')).not.toContain('worktrees/feat');
    // The branches stay.
    expect(git(join(root, 'code/app'), 'branch', '--list', 'feat', 'fix')).toMatch(/feat[\s\S]*fix/);
  });

  it('finds a repository in one folder from worktrees opened in another', async () => {
    const far = createBrowserSource({ folders: [asHandle(outside), asHandle(join(root, 'code'))] });
    const p = (await far.scan()).find((x) => x.path === join(root, 'code/app')) as Project;
    expect(p.worktrees.find((w) => w.branch === 'far')).toMatchObject({ unreachable: false, path: join(outside, 'far') });
  });
});

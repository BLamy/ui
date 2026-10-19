/* Sample worktrees: three repositories with feature, fix and agent worktrees, a second clone, one locked, one
   whose folder is gone, pull requests in every state, and real file changes to diff. The demo source keeps its own copy, so
   deleting works (and stays deleted until the page reloads). Times are relative to when the source was made. */
import type { DiffFile, FileContent, FileEntry, Project, RemoveResult, Worktree, WorktreeDiff, WorktreeSource } from './types';

const HOUR = 3_600_000;
const GB = 1024 ** 3, MB = 1024 ** 2;

export function formatBytes(n?: number) {
  if (n == null) return '';
  if (n >= GB) return `${(n / GB).toFixed(1)} GB`;
  if (n >= MB) return `${Math.round(n / MB)} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}

export function relativeTime(ms?: number, now = Date.now()) {
  if (!ms) return '';
  const m = Math.round((now - ms) / 60_000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  if (m < 60 * 24) return `${Math.round(m / 60)}h ago`;
  if (m < 60 * 24 * 7) return `${Math.round(m / 1440)}d ago`;
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/* ── File contents ── */

const SEGMENTED_BEFORE = `export function Segmented({ options, value, onChange, className }: SegmentedProps) {
  return (
    <ToggleButtonGroup selectedKeys={[value]} onSelectionChange={(k) => onChange([...k][0] as string)}
      className={cn('relative grid auto-cols-fr grid-flow-col rounded-ctl bg-secondary p-0.5', className)}>
      {options.map((o) => (
        <ToggleButton key={o.id} id={o.id} className="z-10 h-7 rounded-[7px] text-footnote font-medium">
          {o.label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
`;
const SEGMENTED_AFTER = SEGMENTED_BEFORE
  .replace("className=\"z-10 h-7 rounded-[7px] text-footnote font-medium\"", "className=\"z-10 h-7 rounded-[7px] text-footnote font-medium data-selected:bg-card data-selected:shadow-hairline\"")
  .replace("p-0.5', className)", "p-0.5 dark:bg-secondary-strong', className)");

const ATLAS_META = `{
  "name": "worktree-atlas",
  "title": "Worktree Atlas",
  "description": "Every Git worktree on your machine, grouped by repository, with a diff to main.",
  "categories": ["developer", "application"],
  "files": ["page.tsx", "sidebar.tsx", "worktree-list.tsx", "diff-view.tsx"]
}
`;
const ATLAS_PAGE = `import { SplitView } from '@/components/ui/split-view';
import { ProjectsSidebar } from './sidebar';
import { WorktreeColumn } from './worktree-list';
import { DiffColumn } from './diff-view';

export default function WorktreeAtlas() {
  return (
    <SplitView aria-label="Worktree Atlas">
      <ProjectsSidebar />
      <WorktreeColumn />
      <DiffColumn />
    </SplitView>
  );
}
`;
const BLOCKS_BEFORE = `{% demo src="blocks/apple-mail" layout="multi" %}

{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/apple-mail.json{% endcommand %}
`;
const BLOCKS_AFTER = `${BLOCKS_BEFORE}
{% demo src="blocks/worktree-atlas" layout="multi" %}

Worktree Atlas lists every Git worktree under the folders you open, grouped by repository.

{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/worktree-atlas.json{% endcommand %}
`;
const TREE_BEFORE = `export function Tree({ items, sort, search, className, ...props }: TreeProps) {
  const index = useMemo(() => indexOf(items), [items]);
  const { model } = useFileTree({ paths: index.paths, search });
  return <FileTree model={model} className={cn('h-full', className)} {...props} />;
}
`;
const TREE_AFTER = `export function Tree({ items, sort, search, gitStatus, className, ...props }: TreeProps) {
  const index = useMemo(() => indexOf(items), [items]);
  const status = useMemo(() => statusEntries(index, gitStatus), [index, gitStatus]);
  const { model } = useFileTree({ paths: index.paths, search, gitStatus: status });
  return <FileTree model={model} className={cn('h-full', className)} {...props} />;
}
`;
const RELEASE_BEFORE = `# Releasing

1. Publish docstream.
2. Publish the editor.
3. Publish ui.
`;
const RELEASE_AFTER = `# Releasing

Publish on main, in this order, with exact pins:

1. Publish docstream (\`pnpm release docstream\`).
2. Bump the editor's docstream pin and publish it.
3. Bump both pins in ui and publish it.

Never publish from a worktree branch.
`;
const TABLE_BEFORE = `export function CardTable({ rows }: { rows: Row[] }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {rows.map((r) => <Card key={r.id} row={r} />)}
    </div>
  );
}
`;
const TABLE_AFTER = `export function CardTable({ rows, columns = 3 }: { rows: Row[]; columns?: 2 | 3 | 4 }) {
  return (
    <div className={cn('grid gap-3', COLUMNS[columns])}>
      {rows.map((r) => <Card key={r.id} row={r} />)}
    </div>
  );
}

const COLUMNS = { 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4' } as const;
`;

/* ── Checkouts: the files every worktree of a repository starts with ── */

const TREES: Record<string, string[]> = {
  ui: [
    'README.md', 'package.json', 'pnpm-workspace.yaml', 'tsconfig.base.json', '.gitignore',
    'apps/docs/package.json', 'apps/docs/pages/index.md', 'apps/docs/pages/blocks.md', 'apps/docs/pages/components.md',
    'packages/ui/package.json', 'packages/ui/src/components/button.tsx', 'packages/ui/src/components/segmented.tsx',
    'packages/ui/src/components/split-view.tsx', 'packages/ui/src/components/tree.tsx', 'packages/ui/src/components/schema-tree.tsx',
    'packages/ui/src/lib/icon.tsx', 'packages/ui/src/lib/motion.ts', 'packages/ui/src/lib/utils.ts', 'packages/ui/src/styles.css',
    'registry/blocks/apple-mail/page.tsx', 'registry/blocks/apple-mail/meta.json', 'tools/registry/build.mjs',
  ],
  docstream: [
    'README.md', 'RELEASING.md', 'package.json', 'tsconfig.json', 'src/index.ts', 'src/render.tsx', 'src/parse.ts',
    'src/blocks/card-table.tsx', 'src/blocks/hint.tsx', 'src/blocks/tabs.tsx', 'src/blocks/stepper.tsx', 'test/parse.test.ts',
  ],
  editor: ['README.md', 'CHANGELOG.md', 'package.json', 'src/index.ts', 'src/editor.tsx', 'src/toolbar.tsx', 'src/keymap.ts'],
};

/** Something plausible for a file the fixtures don't spell out. */
function placeholder(path: string, project: string) {
  const name = path.split('/').pop()!;
  const base = name.replace(/\.[^.]+$/, '');
  if (name === 'package.json') return `{\n  "name": "${path.includes('/') ? `@you/${path.split('/').slice(-2, -1)[0]}` : project}",\n  "version": "1.0.0",\n  "type": "module"\n}\n`;
  if (name.endsWith('.json')) return '{\n  "extends": "../../tsconfig.base.json"\n}\n';
  if (name.endsWith('.md')) return `# ${base === 'README' ? project : base}\n\nSample file in the ${project} repository.\n`;
  if (name.endsWith('.tsx')) {
    const component = base.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join('');
    return `export function ${component}() {\n  return <div data-slot="${base}" />;\n}\n`;
  }
  if (/\.(ts|mjs)$/.test(name)) return `export const ${base.replace(/\W/g, '_')} = {};\n`;
  if (name.endsWith('.css')) return '@import "tailwindcss";\n';
  if (name.endsWith('.yaml')) return 'packages:\n  - apps/*\n  - packages/*\n';
  return '\n';
}

/* ── Repositories ── */

interface Fixture { diff: Omit<WorktreeDiff, 'baseBranch'>; uncommitted: number; unpushed?: string[] }

function fixtures(now: number) {
  const wt = (projectId: string, w: Partial<Worktree> & Pick<Worktree, 'name' | 'path' | 'branch' | 'head'>): Worktree => ({
    id: `${projectId}#${w.primary ? '' : w.clone ? `clone:${w.path}` : w.name}`, projectId, primary: false, ...w,
  });
  const ui = '/Users/you/Code/ui', docstream = '/Users/you/Code/docstream', editor = '/Users/you/Code/editor';
  const projects: Project[] = [
    {
      id: ui, name: 'ui', path: ui, baseBranch: 'main', gitSize: 212 * MB,
      worktrees: [
        wt(ui, { name: 'ui', path: ui, branch: 'main', head: '06aefda', primary: true, modified: now - 0.4 * HOUR, size: 1.9 * GB }),
        wt(ui, { name: 'worktree-atlas', path: `${ui}/.claude/worktrees/worktree-atlas`, branch: 'feat/worktree-atlas', head: 'c41e9b2',
          modified: now - 0.2 * HOUR, size: 1.2 * GB, pullRequest: { number: 10, state: 'open', url: 'https://github.com/you/ui/pull/10' } }),
        wt(ui, { name: 'segmented-hit-target', path: `${ui}/.claude/worktrees/segmented-hit-target`, branch: 'fix/segmented-hit-target', head: 'b1c0e3a',
          modified: now - 26 * HOUR, size: 1.1 * GB, pullRequest: { number: 9, state: 'merged', url: 'https://github.com/you/ui/pull/9' } }),
        wt(ui, { name: 'pierre-trees', path: `${ui}/.claude/worktrees/pierre-trees`, branch: 'feat/pierre-trees', head: '8f6cd38',
          modified: now - 3 * 24 * HOUR, size: 1.3 * GB, pullRequest: { number: 8, state: 'merged', url: 'https://github.com/you/ui/pull/8' } }),
        wt(ui, { name: 'tree-status', path: '/Users/you/.codex/worktrees/a3f1/ui', branch: 'codex/tree-git-status', head: '5d20c7e',
          modified: now - 5 * HOUR, size: 640 * MB }),
        wt(ui, { name: 'release-3.2', path: `${ui}-release`, branch: 'release/3.2', head: '0b9d114', locked: true,
          modified: now - 12 * 24 * HOUR, size: 980 * MB }),
      ],
    },
    {
      id: docstream, name: 'docstream', path: docstream, baseBranch: 'main', gitSize: 64 * MB,
      worktrees: [
        wt(docstream, { name: 'docstream', path: docstream, branch: 'main', head: '91aa0f3', primary: true, modified: now - 30 * HOUR, size: 420 * MB }),
        wt(docstream, { name: 'card-table-columns', path: `${docstream}-card-table`, branch: 'feat/card-table-columns', head: 'e7b2c10',
          modified: now - 8 * HOUR, size: 380 * MB, pullRequest: { number: 41, state: 'open', url: 'https://github.com/you/docstream/pull/41' } }),
        wt(docstream, { name: 'docstream', path: '/Users/you/Code/scratch/docstream', branch: 'try/streaming-tables', head: '4be19d0', clone: true,
          modified: now - 9 * 24 * HOUR, size: 450 * MB }),
        wt(docstream, { name: 'old-spike', path: '/Users/you/Code/scratch/old-spike', branch: 'spike/streaming', head: '3c0de55', missing: true,
          modified: now - 40 * 24 * HOUR, pullRequest: { number: 12, state: 'closed', url: 'https://github.com/you/docstream/pull/12' } }),
      ],
    },
    {
      id: editor, name: 'editor', path: editor, baseBranch: 'main', gitSize: 48 * MB,
      worktrees: [
        wt(editor, { name: 'editor', path: editor, branch: 'main', head: '7a7e0c1', primary: true, modified: now - 50 * HOUR, size: 510 * MB }),
        wt(editor, { name: 'release-notes', path: `${editor}-release-notes`, branch: null, head: '2f4e8aa', modified: now - 6 * 24 * HOUR, size: 470 * MB }),
      ],
    },
  ];
  const changes: Record<string, Fixture> = {
    [`${ui}#`]: { uncommitted: 0, diff: { base: '06aefda', ahead: 0, behind: 0, dirty: false, files: [] } },
    [`${ui}#worktree-atlas`]: {
      uncommitted: 2,
      diff: {
        base: '06aefda', ahead: 3, behind: 0, dirty: true, files: [
          { path: 'apps/docs/pages/blocks.md', status: 'modified', before: BLOCKS_BEFORE, after: BLOCKS_AFTER },
          { path: 'registry/blocks/worktree-atlas/meta.json', status: 'added', after: ATLAS_META },
          { path: 'registry/blocks/worktree-atlas/page.tsx', status: 'added', after: ATLAS_PAGE },
          { path: 'registry/blocks/worktree-atlas/preview.png', status: 'added', skipped: 'binary' },
        ],
      },
    },
    [`${ui}#segmented-hit-target`]: {
      uncommitted: 0,
      diff: { base: '8f6cd38', ahead: 1, behind: 2, dirty: false, files: [
        { path: 'packages/ui/src/components/segmented.tsx', status: 'modified', before: SEGMENTED_BEFORE, after: SEGMENTED_AFTER },
      ] },
    },
    [`${ui}#pierre-trees`]: {
      uncommitted: 0,
      diff: { base: '28ec74a', ahead: 4, behind: 6, dirty: false, files: [
        { path: 'packages/ui/src/components/tree.tsx', status: 'modified', before: TREE_BEFORE, after: TREE_AFTER },
        { path: 'packages/ui/src/components/schema-tree.tsx', status: 'deleted', before: 'export function SchemaTree() {\n  return null;\n}\n' },
      ] },
    },
    [`${ui}#tree-status`]: {
      uncommitted: 1,
      diff: { base: '06aefda', ahead: 0, behind: 0, dirty: true, files: [
        { path: 'packages/ui/src/components/tree.tsx', status: 'modified', before: TREE_BEFORE, after: TREE_AFTER },
      ] },
    },
    [`${ui}#release-3.2`]: {
      uncommitted: 0,
      diff: { base: '0b9d114', ahead: 0, behind: 14, dirty: false, files: [] },
    },
    [`${docstream}#`]: {
      uncommitted: 1,
      diff: { base: '91aa0f3', ahead: 0, behind: 0, dirty: true, files: [
        { path: 'RELEASING.md', status: 'modified', before: RELEASE_BEFORE, after: RELEASE_AFTER },
      ] },
    },
    [`${docstream}#clone:/Users/you/Code/scratch/docstream`]: {
      uncommitted: 0, unpushed: ['try/streaming-tables'],
      diff: { base: '91aa0f3', ahead: 1, behind: 3, dirty: false, files: [
        { path: 'src/blocks/card-table.tsx', status: 'modified', before: TABLE_BEFORE, after: TABLE_BEFORE.replace('gap-3', 'gap-4') },
      ] },
    },
    [`${docstream}#card-table-columns`]: {
      uncommitted: 0,
      diff: { base: '91aa0f3', ahead: 2, behind: 0, dirty: false, files: [
        { path: 'src/blocks/card-table.tsx', status: 'modified', before: TABLE_BEFORE, after: TABLE_AFTER },
      ] },
    },
    [`${editor}#`]: { uncommitted: 0, diff: { base: '7a7e0c1', ahead: 0, behind: 0, dirty: false, files: [] } },
    [`${editor}#release-notes`]: {
      uncommitted: 0,
      diff: { base: '7a7e0c1', ahead: 1, behind: 0, dirty: false, files: [
        { path: 'CHANGELOG.md', status: 'modified', before: '# Changelog\n', after: '# Changelog\n\n## 2.4.0\n\n- Card tables take a column count.\n' },
      ] },
    },
  };
  return { projects, changes };
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** An in-memory source with the sample repositories. `latency` (ms) makes loading states visible. */
export function createDemoSource({ latency = 250, now = Date.now() }: { latency?: number; now?: number } = {}): WorktreeSource {
  const { projects, changes } = fixtures(now);
  let state = projects;
  const find = (id: string) => state.flatMap((p) => p.worktrees).find((w) => w.id === id);
  return {
    label: 'Sample data',
    async scan() {
      await wait(latency);
      return structuredClone(state);
    },
    async diff(wt) {
      await wait(latency);
      if (wt.missing) throw new Error('This worktree’s folder is missing.');
      const project = state.find((p) => p.id === wt.projectId);
      const fixture = changes[wt.id] ?? { diff: { base: wt.head, ahead: 0, behind: 0, dirty: false, files: [] as DiffFile[] } };
      return { baseBranch: project?.baseBranch ?? 'main', ...structuredClone(fixture.diff) };
    },
    async status(wt) {
      await wait(latency);
      const n = changes[wt.id]?.uncommitted ?? 0;
      return { dirty: n > 0, changed: n, ...(wt.clone ? { unpushed: changes[wt.id]?.unpushed ?? [] } : {}) };
    },
    async files(wt) {
      await wait(latency);
      if (wt.missing) throw new Error('This worktree’s folder is missing.');
      const project = state.find((p) => p.id === wt.projectId);
      const fixture = changes[wt.id];
      const paths = new Set(TREES[project?.name ?? ''] ?? []);
      for (const f of fixture?.diff.files ?? []) {
        if (f.status === 'deleted') paths.delete(f.path); else paths.add(f.path);
      }
      // The fixture's last few changes are the uncommitted ones.
      const changed = fixture?.diff.files ?? [];
      const dirty = fixture?.uncommitted ? changed.slice(-fixture.uncommitted).filter((f) => f.status !== 'deleted') : [];
      return [...paths].sort().map((path): FileEntry => {
        const f = dirty.find((x) => x.path === path);
        return f ? { path, status: f.status } : { path };
      });
    },
    async read(wt, path): Promise<FileContent> {
      await wait(latency / 2);
      const own = changes[wt.id]?.diff.files.find((x) => x.path === path);
      if (own?.skipped) return { skipped: own.skipped };
      // A file another worktree changes is, here, as it is on main.
      const main = Object.values(changes).flatMap((c) => c.diff.files).find((x) => x.path === path && x.before != null)?.before;
      return { text: own?.after ?? main ?? placeholder(path, state.find((p) => p.id === wt.projectId)?.name ?? '') };
    },
    async remove(worktrees, { force }) {
      await wait(latency * 2);
      const results: RemoveResult[] = worktrees.map((w) => {
        const current = find(w.id);
        if (!current) return { id: w.id, ok: false, error: 'Already removed.' };
        if (current.primary) return { id: w.id, ok: false, error: 'The repository’s own checkout can’t be deleted.' };
        if (current.locked) return { id: w.id, ok: false, error: 'Locked. Run git worktree unlock first.' };
        if (!force && !current.missing && (changes[w.id]?.uncommitted ?? 0) > 0) return { id: w.id, ok: false, error: 'Has uncommitted changes.' };
        if (!force && changes[w.id]?.unpushed?.length) return { id: w.id, ok: false, error: `Unpushed: ${changes[w.id].unpushed!.join(', ')}.` };
        return { id: w.id, ok: true };
      });
      const gone = new Set(results.filter((r) => r.ok).map((r) => r.id));
      state = state.map((p) => ({ ...p, worktrees: p.worktrees.filter((w) => !gone.has(w.id)) }));
      return results;
    },
  };
}

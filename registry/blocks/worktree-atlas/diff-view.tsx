/* The open worktree against main: what it changes since it branched from main, uncommitted edits included. A
   summary strip (base, ahead / behind, lines, uncommitted state), the changed files as a Tree (trees.software)
   with Git status, and every file's diff in one virtualized @pierre/diffs CodeView (diffs.com). Picking a file in
   the tree scrolls the diff to it. Split or unified, in the app's appearance; the tree folds away on narrow
   columns and on the phone. */
import { useMemo, useRef, useState } from 'react';
import { parseDiffFromFile, type CodeViewItem } from '@pierre/diffs';
import { CodeView, type CodeViewHandle } from '@pierre/diffs/react';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import { Spinner } from '@/components/ui/spinner';
import { SplitViewDetail, SplitViewHeader, useSplitView } from '@/components/ui/split-view';
import { Tree, type TreeGitStatus, type TreeNode } from '@/components/ui/tree';
import { Icon } from '@/lib/icon';
import { useAppearance } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { BarButton, BranchIcon, Chip, WorktreeChips, branchLabel, shortPath } from './parts';
import type { DiffFile, Worktree, WorktreeDiff } from './types';
import type { AtlasState } from './use-atlas';

/** Changed paths as nested nodes: folders are `dir:`-prefixed, files keep their path as id. */
function treeOf(files: DiffFile[]): TreeNode[] {
  type Folder = { node: TreeNode & { children: TreeNode[] }; folders: Map<string, Folder> };
  const root: Folder = { node: { id: 'dir:', name: '', children: [] }, folders: new Map() };
  for (const f of files) {
    const parts = f.path.split('/');
    let at = root;
    parts.slice(0, -1).forEach((name, i) => {
      let next = at.folders.get(name);
      if (!next) {
        next = { node: { id: `dir:${parts.slice(0, i + 1).join('/')}`, name, children: [] }, folders: new Map() };
        at.folders.set(name, next);
        at.node.children.push(next.node);
      }
      at = next;
    });
    at.node.children.push({ id: f.path, name: parts[parts.length - 1], dimmed: !!f.skipped });
  }
  return root.node.children;
}

function lineCounts(items: CodeViewItem[]) {
  let added = 0, removed = 0;
  for (const item of items) {
    if (item.type !== 'diff') continue;
    for (const h of item.fileDiff.hunks) { added += h.additionLines; removed += h.deletionLines; }
  }
  return { added, removed };
}

function Summary({ w, diff, added, removed }: { w: Worktree; diff: WorktreeDiff; added: number; removed: number }) {
  const n = diff.files.length;
  return (
    <div className="shrink-0 border-b border-border px-5 pt-3 pb-3.5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-subhead">
        <BranchIcon size={15} className="text-muted-foreground" />
        <span className={cn('font-semibold', !w.branch && 'italic')}>{branchLabel(w)}</span>
        <Icon name="arrow-left" size={13} sw={2.4} className="text-tertiary-foreground" />
        <span className="text-muted-foreground">{diff.baseBranch} <span className="font-mono text-footnote">@{diff.base}</span></span>
        <span className="flex flex-wrap gap-1"><WorktreeChips w={w} />{diff.dirty ? <Chip tone="warning">Uncommitted changes</Chip> : null}</span>
      </div>
      <div className="mt-1 truncate font-mono text-footnote text-muted-foreground" title={w.path}>{shortPath(w.path)}</div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-footnote text-muted-foreground tabular-nums">
        <span><b className="font-semibold text-foreground">{n}</b> file{n === 1 ? '' : 's'} changed</span>
        <span className="font-mono"><span className="text-success">+{added}</span> <span className="text-destructive">−{removed}</span></span>
        <span>{diff.ahead} commit{diff.ahead === 1 ? '' : 's'} ahead · {diff.behind} behind {diff.baseBranch}</span>
      </div>
    </div>
  );
}

function DiffBody({ w, diff, showTree, diffStyle }: { w: Worktree; diff: WorktreeDiff; showTree: boolean; diffStyle: 'unified' | 'split' }) {
  const appearance = useAppearance() ?? 'light';
  const view = useRef<CodeViewHandle<undefined>>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const items = useMemo<CodeViewItem[]>(() => diff.files.filter((f) => !f.skipped).map((f) => ({
    id: f.path,
    type: 'diff',
    fileDiff: parseDiffFromFile(
      f.before != null ? { name: f.path, contents: f.before, cacheKey: `${w.id}:${f.path}:before` } : null,
      f.after != null ? { name: f.path, contents: f.after, cacheKey: `${w.id}:${f.path}:after` } : null,
    ),
  })), [diff, w.id]);
  const tree = useMemo(() => treeOf(diff.files), [diff.files]);
  const gitStatus = useMemo(() => Object.fromEntries(diff.files.map((f) => [f.path, f.status as TreeGitStatus])), [diff.files]);
  const skipped = diff.files.filter((f) => f.skipped);
  const { added, removed } = useMemo(() => lineCounts(items), [items]);
  const options = useMemo(() => ({ diffStyle, themeType: appearance, diffIndicators: 'bars' as const, stickyHeaders: true }), [diffStyle, appearance]);

  return (
    <>
      <Summary w={w} diff={diff} added={added} removed={removed} />
      {diff.files.length === 0 ? (
        <div className="grid flex-1 place-items-center px-8 text-center">
          <div>
            <Icon name="check-circle" size={40} className="mx-auto text-success" />
            <div className="mt-3 text-headline font-semibold">Nothing to merge</div>
            <div className="mt-1 text-subhead text-muted-foreground">This worktree has the same files as {diff.baseBranch}.</div>
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1">
          {showTree ? (
            <div className="flex w-[260px] shrink-0 flex-col border-r border-border">
              <Tree aria-label="Changed files" items={tree} defaultExpanded="all" flatten gitStatus={gitStatus} selectedIds={picked}
                className="min-h-0 flex-1 px-1.5 py-2"
                onSelectionChange={(ids) => {
                  setPicked(ids);
                  const id = ids.find((i) => !i.startsWith('dir:'));
                  if (id && items.some((it) => it.id === id)) view.current?.scrollTo({ type: 'item', id, align: 'start', behavior: 'smooth' });
                }} />
            </div>
          ) : null}
          <div data-slot="atlas-diff" className="relative min-w-0 flex-1">
            <CodeView ref={view} items={items} options={options} className="absolute inset-0 overflow-auto"
              renderCodeViewFooter={skipped.length ? () => (
                <div className="px-4 py-5 text-footnote text-muted-foreground">
                  {skipped.map((f) => (
                    <div key={f.path} className="flex items-center gap-2 py-0.5">
                      <Icon name="doc" size={15} /><span className="font-mono">{f.path}</span>
                      <span>· {f.skipped === 'binary' ? 'binary file' : 'too large to show'} ({f.status})</span>
                    </div>
                  ))}
                </div>
              ) : undefined} />
          </div>
        </div>
      )}
    </>
  );
}

function Placeholder({ icon, title, detail, children }: { icon?: string; title: string; detail?: string; children?: React.ReactNode }) {
  return (
    <div className="grid flex-1 place-items-center px-8 text-center">
      <div className="max-w-sm">
        {icon ? <Icon name={icon} size={40} className="mx-auto text-tertiary-foreground" /> : null}
        <div className="mt-3 text-headline font-semibold">{title}</div>
        {detail ? <div className="mt-1 text-subhead text-muted-foreground">{detail}</div> : null}
        {children ? <div className="mt-4 flex justify-center gap-2">{children}</div> : null}
      </div>
    </div>
  );
}

export function DiffColumn({ atlas }: { atlas: AtlasState }) {
  const s = useSplitView();
  const w = atlas.selected;
  const state = w ? atlas.diffs.get(w.id) : undefined;
  const wide = s.widthClass === 'regular';
  const [treeOpen, setTreeOpen] = useState(true);
  const [diffStyle, setDiffStyle] = useState<'unified' | 'split'>('unified');
  const done = () => { if (s.collapsed) s.back(); };

  return (
    <SplitViewDetail aria-label="Changes">
      <SplitViewHeader title={w ? branchLabel(w) : undefined}
        leading={w && wide ? <BarButton label={treeOpen ? 'Hide files' : 'Show files'} onPress={() => setTreeOpen(!treeOpen)}><Icon name="sidebar" size={20} /></BarButton> : null}
        trailing={w ? <>
          {wide ? <Segmented aria-label="Diff layout" className="mr-1 w-[150px]" value={diffStyle} onChange={(v) => setDiffStyle(v as 'unified' | 'split')}
            options={[{ id: 'unified', label: 'Unified' }, { id: 'split', label: 'Split' }]} /> : null}
          <BarButton label="Reload diff" isDisabled={state?.status === 'loading'} onPress={() => atlas.refreshDiff(w.id)}><Icon name="arrow-clockwise" size={20} /></BarButton>
          {atlas.deletable(w) ? (
            <BarButton label="Delete worktree" className="text-destructive" onPress={() => atlas.requestDelete([w])}><Icon name="trash" size={20} /></BarButton>
          ) : null}
        </> : null} />
      {!w ? (
        atlas.scanned && atlas.all.length === 0 ? null
          : <Placeholder icon="doc" title="No Worktree Selected" detail="Pick a worktree to see what it changes against main." />
      ) : w.unreachable ? (
        <Placeholder icon="folder" title="Outside your folders" detail={`Open a folder that contains ${shortPath(w.path)} to read its changes.`}>
          {atlas.source.addLocation ? <Button size="sm" onPress={() => void atlas.addLocation()}>Add Folder…</Button> : null}
        </Placeholder>
      ) : !state || state.status === 'loading' ? (
        <div className="grid flex-1 place-items-center"><Spinner size={22} label="Reading changes" /></div>
      ) : state.status === 'error' ? (
        <Placeholder icon="warning" title="Couldn’t read this worktree" detail={state.error}>
          <Button size="sm" variant="secondary" onPress={() => atlas.refreshDiff(w.id)}>Try Again</Button>
          {w.missing && atlas.deletable(w) ? <Button size="sm" variant="destructive" onPress={() => { atlas.requestDelete([w]); done(); }}>Prune</Button> : null}
        </Placeholder>
      ) : (
        <DiffBody key={w.id} w={w} diff={state.diff} showTree={wide && treeOpen} diffStyle={wide ? diffStyle : 'unified'} />
      )}
    </SplitViewDetail>
  );
}

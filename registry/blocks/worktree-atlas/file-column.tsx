/* The master column: the open worktree's files as a Tree (trees.software). In Files, every file in the checkout,
   with search and uncommitted changes marked; in Changes, a summary of the diff to main (base, ahead / behind,
   lines, uncommitted state) over the files it changes, with Git status. Picking a file opens it in the detail
   (Files) or scrolls the diff to it (Changes). Reload and Delete sit in the bar. */
import { useMemo, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { SplitViewHeader, SplitViewSupplementary, SplitViewToggle, useSplitView } from '@/components/ui/split-view';
import { Tree, type TreeGitStatus } from '@/components/ui/tree';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';
import { diffItems, isFolder, lineCounts, treeOf } from './files';
import { BarButton, BranchIcon, Chip, WorktreeChips, branchLabel, shortPath } from './parts';
import type { FileEntry, Worktree, WorktreeDiff } from './types';
import type { AtlasState } from './use-atlas';

export function Placeholder({ icon, title, detail, children }: { icon?: string; title: string; detail?: string; children?: ReactNode }) {
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

export const Loading = ({ label }: { label: string }) => <div className="grid flex-1 place-items-center"><Spinner size={22} label={label} /></div>;

function Summary({ w, diff }: { w: Worktree; diff: WorktreeDiff }) {
  const n = diff.files.length;
  const { added, removed } = useMemo(() => lineCounts(diffItems(diff, w.id)), [diff, w.id]);
  return (
    <div className="shrink-0 border-b border-border px-4 pt-1 pb-3">
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-footnote text-muted-foreground">
        <span>into <span className="font-medium text-foreground">{diff.baseBranch}</span> <span className="font-mono">@{diff.base}</span></span>
        <span className="flex flex-wrap gap-1"><WorktreeChips w={w} />{diff.dirty ? <Chip tone="warning">Uncommitted</Chip> : null}</span>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-footnote text-muted-foreground tabular-nums">
        <span><b className="font-semibold text-foreground">{n}</b> file{n === 1 ? '' : 's'}</span>
        <span className="font-mono"><span className="text-success">+{added}</span> <span className="text-destructive">−{removed}</span></span>
        <span>{diff.ahead} ahead · {diff.behind} behind</span>
      </div>
    </div>
  );
}

function FileTree({ atlas, files, gitStatus, search }: {
  atlas: AtlasState; files: { path: string; dimmed?: boolean }[]; gitStatus: Record<string, TreeGitStatus>; search?: boolean;
}) {
  const s = useSplitView();
  const items = useMemo(() => treeOf(files), [files]);
  return (
    <Tree aria-label={atlas.view === 'files' ? 'Files' : 'Changed files'} items={items} sort={atlas.view === 'files'} search={search}
      defaultExpanded={atlas.view === 'changes' ? 'all' : 'none'} flatten gitStatus={gitStatus}
      selectedIds={atlas.filePath ? [atlas.filePath] : []}
      className="min-h-0 flex-1 px-1.5 py-1"
      onSelectionChange={(ids) => {
        const id = ids.find((i) => !isFolder(i));
        if (!id) return;
        atlas.openFile(id);
        s.select('supplementary', id);
      }} />
  );
}

function FilesBody({ atlas, files }: { atlas: AtlasState; files: FileEntry[] }) {
  const status = useMemo(() => Object.fromEntries(files.flatMap((f) => (f.status ? [[f.path, f.status as TreeGitStatus]] : []))), [files]);
  const rows = useMemo(() => files.map((f) => ({ path: f.path, dimmed: f.status === 'deleted' })), [files]);
  if (!files.length) return <Placeholder icon="folder" title="No Files" detail="This checkout is empty." />;
  return <FileTree atlas={atlas} files={rows} gitStatus={status} search />;
}

function ChangesBody({ atlas, w, diff }: { atlas: AtlasState; w: Worktree; diff: WorktreeDiff }) {
  const status = useMemo(() => Object.fromEntries(diff.files.map((f) => [f.path, f.status as TreeGitStatus])), [diff.files]);
  const rows = useMemo(() => diff.files.map((f) => ({ path: f.path, dimmed: !!f.skipped })), [diff.files]);
  return (
    <>
      <Summary w={w} diff={diff} />
      {diff.files.length ? <FileTree atlas={atlas} files={rows} gitStatus={status} />
        : <Placeholder icon="check-circle" title="Nothing to merge" detail={`Same files as ${diff.baseBranch}.`} />}
    </>
  );
}

export function FileColumn({ atlas }: { atlas: AtlasState }) {
  const w = atlas.selected;
  const state = atlas.view === 'files' ? atlas.files : atlas.diff;
  return (
    <SplitViewSupplementary aria-label={atlas.view === 'files' ? 'Files' : 'Changes'} width={320} minWidth={260}>
      <SplitViewHeader titleAlign="leading" leading={<SplitViewToggle />}
        title={w ? <span className="flex min-w-0 items-center gap-1.5">
          <BranchIcon size={15} className="text-muted-foreground" />
          <span className={cn('truncate', !w.branch && 'italic')}>{branchLabel(w)}</span>
        </span> : atlas.view === 'files' ? 'Files' : 'Changes'}
        trailing={w ? <>
          <BarButton label="Reload" isDisabled={state?.status === 'loading'} onPress={atlas.reload}><Icon name="arrow-clockwise" size={20} /></BarButton>
          {atlas.deletable(w) ? (
            <BarButton label={w.clone ? 'Delete clone' : 'Delete worktree'} className="text-destructive" onPress={() => atlas.requestDelete([w])}><Icon name="trash" size={20} /></BarButton>
          ) : null}
        </> : null} />
      {w ? <div className="truncate px-4 pt-2 pb-1 font-mono text-caption text-muted-foreground" title={w.path}>{shortPath(w.path)}</div> : null}
      <div className="flex min-h-0 flex-1 flex-col">
        {!w ? (
          atlas.scanned && atlas.all.length === 0 ? null
            : <Placeholder icon="folder" title="No Worktree Selected" detail="Pick a worktree in the sidebar." />
        ) : w.unreachable ? (
          <Placeholder icon="folder" title="Outside your folders" detail={`Open a folder that contains ${shortPath(w.path)} to read it.`}>
            {atlas.source.addLocation ? <Button size="sm" onPress={() => void atlas.addLocation()}>Add Folder…</Button> : null}
          </Placeholder>
        ) : !state || state.status === 'loading' ? (
          <Loading label={atlas.view === 'files' ? 'Reading files' : 'Reading changes'} />
        ) : state.status === 'error' ? (
          <Placeholder icon="warning" title="Couldn’t read this worktree" detail={state.error}>
            <Button size="sm" variant="secondary" onPress={atlas.reload}>Try Again</Button>
            {w.missing && atlas.deletable(w) ? <Button size="sm" variant="destructive" onPress={() => atlas.requestDelete([w])}>Prune</Button> : null}
          </Placeholder>
        ) : atlas.view === 'files' ? (
          <FilesBody key={w.id} atlas={atlas} files={state.value as FileEntry[]} />
        ) : (
          <ChangesBody key={w.id} atlas={atlas} w={w} diff={state.value as WorktreeDiff} />
        )}
      </div>
    </SplitViewSupplementary>
  );
}

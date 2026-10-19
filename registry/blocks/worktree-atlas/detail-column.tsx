/* The detail: in Files, the file picked in the tree, highlighted; in Changes, every changed file's diff to main in
   one virtualized @pierre/diffs CodeView (diffs.com), unified or split, scrolled to the file picked in the tree.
   Both follow the app's appearance. */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CodeViewItem } from '@pierre/diffs';
import { CodeView, type CodeViewHandle } from '@pierre/diffs/react';
import { Segmented } from '@/components/ui/segmented';
import { SplitViewDetail, SplitViewHeader, useSplitView } from '@/components/ui/split-view';
import { Icon } from '@/lib/icon';
import { useAppearance } from '@/lib/theme';
import { Loading, Placeholder } from './file-column';
import { diffItems } from './files';
import type { Worktree, WorktreeDiff } from './types';
import type { AtlasState } from './use-atlas';

function DiffBody({ w, diff, filePath, diffStyle }: { w: Worktree; diff: WorktreeDiff; filePath: string | null; diffStyle: 'unified' | 'split' }) {
  const appearance = useAppearance() ?? 'light';
  const view = useRef<CodeViewHandle<undefined>>(null);
  const items = useMemo(() => diffItems(diff, w.id), [diff, w.id]);
  const skipped = diff.files.filter((f) => f.skipped);
  const options = useMemo(() => ({ diffStyle, themeType: appearance, diffIndicators: 'bars' as const, stickyHeaders: true }), [diffStyle, appearance]);
  useEffect(() => {
    if (filePath && items.some((it) => it.id === filePath)) view.current?.scrollTo({ type: 'item', id: filePath, align: 'start', behavior: 'smooth' });
  }, [filePath, items]);
  if (!diff.files.length) return <Placeholder icon="check-circle" title="Nothing to merge" detail={`This worktree has the same files as ${diff.baseBranch}.`} />;
  return (
    <div data-slot="atlas-diff" className="relative min-h-0 flex-1">
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
  );
}

function FileBody({ w, path, text }: { w: Worktree; path: string; text: string }) {
  const appearance = useAppearance() ?? 'light';
  const items = useMemo<CodeViewItem[]>(() => [{ id: path, type: 'file', file: { name: path, contents: text, cacheKey: `${w.id}:${path}:${text.length}` } }], [w.id, path, text]);
  const options = useMemo(() => ({ themeType: appearance, stickyHeaders: true }), [appearance]);
  return (
    <div data-slot="atlas-file" className="relative min-h-0 flex-1">
      <CodeView items={items} options={options} className="absolute inset-0 overflow-auto" />
    </div>
  );
}

export function DetailColumn({ atlas }: { atlas: AtlasState }) {
  const s = useSplitView();
  const w = atlas.selected;
  const wide = s.widthClass === 'regular';
  const [diffStyle, setDiffStyle] = useState<'unified' | 'split'>('unified');
  const files = atlas.view === 'files';
  const name = atlas.filePath?.split('/').pop();

  let body;
  if (!w || w.unreachable) body = null;
  else if (files) {
    const c = atlas.content;
    body = !atlas.filePath ? <Placeholder icon="doc" title="No File Selected" detail="Pick a file in the tree to read it." />
      : !c || c.status === 'loading' ? <Loading label="Reading file" />
      : c.status === 'error' ? <Placeholder icon="warning" title="Couldn’t read this file" detail={c.error} />
      : c.value.text == null ? <Placeholder icon="doc" title={c.value.skipped === 'binary' ? 'Binary file' : 'Too large to show'} detail={atlas.filePath} />
      : <FileBody w={w} path={atlas.filePath} text={c.value.text} />;
  } else {
    const d = atlas.diff;
    body = !d || d.status === 'loading' ? <Loading label="Reading changes" />
      : d.status === 'error' ? null
      : <DiffBody key={w.id} w={w} diff={d.value} filePath={atlas.filePath} diffStyle={wide ? diffStyle : 'unified'} />;
  }

  return (
    <SplitViewDetail aria-label={files ? 'File' : 'Diff'}>
      <SplitViewHeader title={files ? name : w ? 'Changes' : undefined}
        trailing={w && !files && wide ? (
          <Segmented aria-label="Diff layout" className="mr-1 w-[150px]" value={diffStyle} onChange={(v) => setDiffStyle(v as 'unified' | 'split')}
            options={[{ id: 'unified', label: 'Unified' }, { id: 'split', label: 'Split' }]} />
        ) : null} />
      {body ?? (w ? null : atlas.scanned && atlas.all.length === 0 ? null
        : <Placeholder icon="doc" title="No Worktree Selected" detail="Pick a worktree to browse its files or see what it changes against main." />)}
    </SplitViewDetail>
  );
}

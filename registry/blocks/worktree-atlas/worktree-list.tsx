/* The master list: a project's worktrees (or all of them), newest activity first. Each row shows the branch, the
   folder, when it was last active, its size and status chips. Swipe a row left for Delete; Edit mode adds check
   circles and a bottom bar to delete many at once. Both go through the confirmation Credenza, never straight to
   disk. The repository's own checkout can't be selected or swiped: Git won't remove it. */
import { useRef } from 'react';
import { ListRow } from '@/components/ui/list';
import { SearchField } from '@/components/ui/search-field';
import { SplitViewContent, SplitViewHeader, SplitViewSupplementary, SplitViewToggle, useSplitView } from '@/components/ui/split-view';
import { Icon } from '@/lib/icon';
import { springs, useMotion } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { formatBytes, relativeTime } from './data';
import { BarButton, BottomBar, BranchIcon, WorktreeChips, branchLabel, shortPath } from './parts';
import type { Worktree } from './types';
import { ALL, type AtlasState } from './use-atlas';

const ROW = cn(
  '[&>[data-slot=list-row-content]]:bg-transparent [&>[data-slot=list-row-content]]:transition-[padding]',
  '[&>[data-slot=list-row-content]]:duration-spring-snappy [&>[data-slot=list-row-content]]:ease-spring-snappy',
);

function WorktreeRow({ atlas, w, selected, chevron, isEdge, showProject, onOpen }: {
  atlas: AtlasState; w: Worktree; selected: boolean; chevron?: boolean; isEdge?: (x: number) => boolean; showProject: boolean; onOpen: (id: string) => void;
}) {
  const { motion } = useMotion();
  const deletable = atlas.deletable(w);
  const on = selected && !atlas.editing;
  const project = showProject ? atlas.projects.find((p) => p.id === w.projectId)?.name : null;
  return (
    <ListRow edit={atlas.editing && deletable} checked={atlas.checked.has(w.id)} divider={false} isEdge={isEdge}
      className={cn(ROW, '[&>[data-slot=list-row-content]]:pl-4', atlas.editing && !deletable && 'opacity-50')}
      onPress={() => { if (atlas.editing) { if (deletable) atlas.toggleChecked(w.id); } else onOpen(w.id); }}
      // Not `destructive`: that would collapse the row before the confirmation has been answered.
      trailingActions={deletable && !atlas.editing ? [
        { label: 'Delete', icon: 'trash', tint: 'var(--destructive)', onAction: () => atlas.requestDelete([w]) },
      ] : undefined}
      title={<>
        {on ? (
          <motion.span layoutId="atlas-selection" transition={springs.snappy} aria-hidden="true"
            className="absolute inset-y-[2px] -right-2 -left-2 rounded-ctl bg-primary" />
        ) : null}
        <span className={cn('relative block py-2 whitespace-normal', on && 'text-primary-foreground')}>
          <span className="flex items-center gap-1.5">
            <BranchIcon size={15} className={on ? 'opacity-90' : 'text-muted-foreground'} />
            <span className={cn('min-w-0 flex-1 truncate text-callout leading-[1.3] font-semibold tracking-[-.2px]', !w.branch && 'italic')}>{branchLabel(w)}</span>
            <span className={cn('shrink-0 text-detail tabular-nums', on ? 'opacity-85' : 'text-muted-foreground')}>{relativeTime(w.modified)}</span>
            {chevron ? <Icon name="chevron-right" size={13} sw={2.6} className="text-tertiary-foreground" /> : null}
          </span>
          <span className={cn('mt-0.5 block truncate font-mono text-footnote', on ? 'opacity-80' : 'text-muted-foreground')} title={w.path}>
            {project ? <span className={cn('font-sans font-medium', on ? '' : 'text-foreground')}>{project} · </span> : null}{shortPath(w.path)}
          </span>
          <span className={cn('mt-1.5 flex flex-wrap items-center gap-1', on && '[&>span]:bg-primary-foreground/18 [&>span]:text-primary-foreground')}>
            <WorktreeChips w={w} />
            {w.size ? <span className={cn('text-caption tabular-nums', on ? 'bg-transparent! opacity-80' : 'text-tertiary-foreground')}>{formatBytes(w.size)}</span> : null}
          </span>
        </span>
        <span aria-hidden="true" className={cn('absolute -right-4 bottom-0 left-0 h-px bg-border', on && 'opacity-0')} />
      </>} />
  );
}

function WorktreeList({ atlas, onOpen }: { atlas: AtlasState; onOpen: (id: string) => void }) {
  const { motion, AnimatePresence, LayoutGroup } = useMotion();
  const s = useSplitView();
  const list = useRef<HTMLDivElement | null>(null);
  // On the phone the leading edge belongs to the back swipe.
  const isEdge = s.collapsed ? (x: number) => x - (list.current?.getBoundingClientRect().left ?? 0) < 28 : undefined;
  const rows = [...atlas.list].sort((a, b) => Number(b.primary) - Number(a.primary) || (b.modified ?? 0) - (a.modified ?? 0));
  return (
    <div className="pb-16">
      <LayoutGroup id={`atlas-${atlas.projectId}`}>
        <div ref={list} key={atlas.projectId} role="list" aria-label="Worktrees">
          <AnimatePresence initial={false}>
            {rows.map((w) => (
              <motion.div key={w.id} role="listitem" className="overflow-hidden"
                initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                transition={{ height: springs.smooth, opacity: { duration: 0.18 } }}>
                <WorktreeRow atlas={atlas} w={w} selected={!s.collapsed && atlas.worktreeId === w.id} chevron={s.collapsed}
                  isEdge={isEdge} showProject={atlas.projectId === ALL} onOpen={onOpen} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </LayoutGroup>
      {rows.length === 0 && atlas.scanned ? (
        <div className="px-6 pt-16 text-center">
          <div className="text-title font-semibold">{atlas.query ? 'No Results' : 'No Worktrees'}</div>
          <div className="mt-1 text-detail text-muted-foreground">
            {atlas.query ? `Nothing matches “${atlas.query}”.` : 'Worktrees in the folders you open show up here.'}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function WorktreeColumn({ atlas }: { atlas: AtlasState }) {
  const s = useSplitView();
  const title = atlas.project?.name ?? 'All Worktrees';
  const all = atlas.candidates.length > 0 && atlas.checked.size === atlas.candidates.length;
  const checked = atlas.list.filter((w) => atlas.checked.has(w.id));
  const total = atlas.list.reduce((n, w) => n + (w.size ?? 0), 0);
  return (
    <SplitViewSupplementary aria-label={title} width={380} minWidth={300}>
      <SplitViewHeader largeTitle title={atlas.editing && checked.length ? `${checked.length} Selected` : title}
        leading={atlas.editing ? <BarButton label={all ? 'Deselect All' : 'Select All'} onPress={atlas.checkAll} isDisabled={!atlas.candidates.length} /> : <SplitViewToggle />}
        trailing={<BarButton label={atlas.editing ? 'Done' : 'Edit'} className={atlas.editing ? 'font-semibold' : undefined}
          isDisabled={!atlas.editing && !atlas.candidates.length} onPress={() => atlas.setEditing(!atlas.editing)} />} />
      <SplitViewContent>
        <div className="px-4 pb-2"><SearchField value={atlas.query} onChange={atlas.setQuery} aria-label={`Search ${title}`} /></div>
        {atlas.project?.note ? (
          <div className="mx-4 mb-2 flex gap-2 rounded-ctl bg-secondary px-3 py-2 text-footnote text-muted-foreground">
            <Icon name="info" size={16} className="mt-px shrink-0" />{atlas.project.note}
          </div>
        ) : null}
        <WorktreeList atlas={atlas} onOpen={(id) => { atlas.open(id); s.select('supplementary', id); }} />
      </SplitViewContent>
      {atlas.editing ? (
        <BottomBar>
          <span className="min-w-0 flex-1 truncate pl-2 text-caption text-muted-foreground">
            {checked.length ? formatBytes(checked.reduce((n, w) => n + (w.size ?? 0), 0)) : 'Select worktrees to delete'}
          </span>
          <BarButton label={checked.length ? `Delete (${checked.length})` : 'Delete'} isDisabled={!checked.length}
            className="text-destructive" onPress={() => atlas.requestDelete(checked)} />
        </BottomBar>
      ) : (
        <BottomBar className="justify-center">
          <div className="min-w-0 text-center leading-[1.25]" aria-live="polite">
            <div className="truncate text-caption text-foreground">
              {atlas.scanning ? 'Scanning…' : `${atlas.list.length} Worktree${atlas.list.length === 1 ? '' : 's'}`}
            </div>
            <div className="truncate text-[11.5px] text-muted-foreground">{total ? `${formatBytes(total)} checked out` : ' '}</div>
          </div>
        </BottomBar>
      )}
    </SplitViewSupplementary>
  );
}

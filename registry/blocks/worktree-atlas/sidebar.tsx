/* The sidebar: a rail on its leading edge picks the view (Files: browse the checkout; Changes: its diff to main),
   and beside it every project folds open to its worktrees: five at first, then Show more for twenty, then twenty
   more at a time. Right-click (or long-press) a worktree for its menu, Delete included. Below them, the opened
   folders (for the browser source), each one reconnectable after a restart and removable. Rescan and Add Folder
   sit in the bar; the footer says where the data comes from and what a scan is reading. */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { PlainButton } from '@/components/ui/plain-button';
import { Button } from '@/components/ui/button';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator } from '@/components/ui/context-menu';
import { Spinner } from '@/components/ui/spinner';
import { SplitViewContent, SplitViewHeader, SplitViewItem, SplitViewSection, SplitViewSidebar, useSplitView } from '@/components/ui/split-view';
import { AnimatedHeight } from '@/components/ui/animated-height';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';
import { relativeTime } from './data';
import { BarButton, ChangesIcon, FolderIcon, branchLabel, shortPath } from './parts';
import type { Project, Worktree } from './types';
import type { AtlasState, AtlasView } from './use-atlas';

/** Worktrees a project shows before Show more, then after the first one; each later press adds `MORE`. */
const FIRST = 5, SECOND = 20, MORE = 20;
const nextLimit = (n: number) => (n < SECOND ? SECOND : n + MORE);

const VIEWS: { id: AtlasView; label: string; icon: ReactNode }[] = [
  { id: 'files', label: 'Files', icon: <Icon name="folder" size={21} /> },
  { id: 'changes', label: 'Changes', icon: <ChangesIcon size={21} /> },
];

function Rail({ atlas }: { atlas: AtlasState }) {
  return (
    <div role="toolbar" aria-label="View" aria-orientation="vertical"
      className="flex w-[52px] shrink-0 flex-col items-center gap-1.5 shadow-[inset_-1px_0_0_var(--border)]">
      <div aria-hidden="true" className="h-toolbar shrink-0" />
      {VIEWS.map((v) => {
        const on = atlas.view === v.id;
        return (
          <PlainButton key={v.id} aria-label={v.label} aria-pressed={on} onPress={() => atlas.showView(v.id)}
            className={cn(
              'bl-btn grid size-10 cursor-pointer place-items-center rounded-ctl border-0 outline-none transition-colors duration-150',
              'data-[focus-visible]:ring-2 data-[focus-visible]:ring-ring',
              on ? 'bg-secondary text-foreground' : 'bg-transparent text-muted-foreground data-[hovered]:bg-secondary/60 data-[hovered]:text-foreground',
            )}>
            {v.icon}
          </PlainButton>
        );
      })}
    </div>
  );
}

const sortWorktrees = (ws: Worktree[]) =>
  [...ws].sort((a, b) => Number(b.primary) - Number(a.primary) || (b.modified ?? 0) - (a.modified ?? 0));

function WorktreeItem({ atlas, w }: { atlas: AtlasState; w: Worktree }) {
  const s = useSplitView();
  const show = (view: AtlasView) => { atlas.showView(view); atlas.open(w.id); s.select('sidebar', w.id); };
  return (
    <ContextMenu>
      <SplitViewItem id={w.id} className="min-h-[34px] py-1 pl-10">
        <span className="flex min-w-0 flex-1 items-center gap-2" title={shortPath(w.path)}>
          <span className={cn('min-w-0 flex-1 truncate text-subhead leading-[1.3]', !w.branch && 'italic', (w.missing || w.unreachable) && 'opacity-55')}>
            {branchLabel(w)}
          </span>
          {w.locked ? <Icon name="lock" size={13} className="shrink-0 text-muted-foreground group-data-selected/item:text-primary-foreground/80" /> : null}
          <span className="shrink-0 text-caption text-muted-foreground tabular-nums group-data-selected/item:text-primary-foreground/80">
            {w.primary ? 'Primary' : relativeTime(w.modified)}
          </span>
        </span>
      </SplitViewItem>
      <ContextMenuContent aria-label={`${branchLabel(w)} actions`} onAction={(key) => {
        if (key === 'files' || key === 'changes') show(key);
        else if (key === 'copy') void navigator.clipboard?.writeText(w.path);
        else if (key === 'delete') atlas.requestDelete([w]);
      }}>
        <ContextMenuItem id="changes" icon={<ChangesIcon size={18} />}>Show Changes</ContextMenuItem>
        <ContextMenuItem id="files" icon={<Icon name="folder" size={18} />}>Browse Files</ContextMenuItem>
        <ContextMenuItem id="copy" icon={<Icon name="copy" size={18} />}>Copy Path</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem id="delete" variant="destructive" isDisabled={!atlas.deletable(w)} icon={<Icon name="trash" size={18} />}>
          {w.clone ? 'Delete Clone…' : 'Delete Worktree…'}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

function ProjectGroup({ atlas, p, where, expanded, onExpandedChange }: {
  atlas: AtlasState; p: Project; where?: string; expanded: boolean; onExpandedChange: (open: boolean) => void;
}) {
  const [limit, setLimit] = useState(FIRST);
  const rows = sortWorktrees(p.worktrees);
  const shown = rows.slice(0, limit);
  // The open worktree stays in view even when it is past the limit.
  if (atlas.selected?.projectId === p.id && !shown.includes(atlas.selected)) shown.push(atlas.selected);
  return (
    <div role="group" aria-label={p.name}>
      <PlainButton onPress={() => onExpandedChange(!expanded)} aria-expanded={expanded}
        className="bl-btn flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-ctl border-0 bg-transparent px-2.5 text-left [font-family:inherit] text-[15px] text-foreground outline-none data-[hovered]:bg-secondary data-[focus-visible]:ring-2 data-[focus-visible]:ring-ring">
        <FolderIcon open={expanded} size={20} className="text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate" title={shortPath(p.path)}>
          {p.name}{where ? <span className="ml-1.5 text-footnote text-muted-foreground">{where}</span> : null}
        </span>
      </PlainButton>
      <AnimatedHeight>
        {expanded ? (
          <div className="flex flex-col gap-px pb-1">
            {shown.map((w) => <WorktreeItem key={w.id} atlas={atlas} w={w} />)}
            {rows.length > limit ? (
              <PlainButton onPress={() => setLimit(nextLimit(limit))}
                className="bl-btn flex h-8 w-full cursor-pointer items-center rounded-ctl border-0 bg-transparent pl-10 text-left [font-family:inherit] text-subhead text-muted-foreground outline-none data-[hovered]:text-foreground data-[focus-visible]:ring-2 data-[focus-visible]:ring-ring">
                Show more
              </PlainButton>
            ) : null}
            {rows.length === 0 ? <div className="pl-10 py-1.5 text-footnote text-muted-foreground">No worktrees</div> : null}
          </div>
        ) : null}
      </AnimatedHeight>
    </div>
  );
}

/** `footer`: shown at the bottom right, beside the source's name (the block puts "Open My Folders" there in sample mode). */
export function ProjectsSidebar({ atlas, footer }: { atlas: AtlasState; footer?: ReactNode }) {
  const s = useSplitView();
  const canAdd = !!atlas.source.addLocation;
  // Different projects can share a folder name: those show where they live.
  const named = new Map<string, number>();
  for (const p of atlas.projects) named.set(p.name, (named.get(p.name) ?? 0) + 1);

  // The open worktree's project is unfolded; with nothing open, the first project is.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const openProject = atlas.selected?.projectId ?? null;
  const first = atlas.projects[0]?.id ?? null;
  const seeded = useRef(false);
  useEffect(() => {
    const id = openProject ?? (seeded.current ? null : first);
    if (first) seeded.current = true;
    if (id) setExpanded((e) => (e.has(id) ? e : new Set(e).add(id)));
  }, [openProject, first]);
  const setOpen = (id: string, open: boolean) => setExpanded((e) => { const next = new Set(e); if (open) next.add(id); else next.delete(id); return next; });

  return (
    <SplitViewSidebar aria-label="Projects" width={300} minWidth={250} className="flex-row">
      <Rail atlas={atlas} />
      <div className="relative flex min-w-0 flex-1 flex-col">
        <SplitViewHeader title="Projects" titleAlign="leading" largeTitle={s.collapsed} trailing={<>
          <BarButton label="Scan again" isDisabled={atlas.scanning} onPress={() => void atlas.scan()}><Icon name="arrow-clockwise" size={20} /></BarButton>
          {canAdd ? <BarButton label="Add folder" onPress={() => void atlas.addLocation()}><Icon name="folder-badge-plus" size={22} /></BarButton> : null}
        </>} />
        <SplitViewContent>
          <div className="flex flex-col gap-px px-2 pt-1 pb-20">
            {atlas.projects.map((p) => (
              <ProjectGroup key={p.id} atlas={atlas} p={p} expanded={expanded.has(p.id)} onExpandedChange={(o) => setOpen(p.id, o)}
                where={(named.get(p.name) ?? 0) > 1 ? shortPath(p.path.slice(0, p.path.lastIndexOf('/')) || p.path) : undefined} />
            ))}
            {atlas.scanned && !atlas.projects.length ? (
              <div className="px-2.5 py-3 text-footnote text-muted-foreground">No repositories found in the opened folders.</div>
            ) : null}
            {atlas.locations.length ? (
              <SplitViewSection title="Folders" collapsible className="mt-2">
                {atlas.locations.map((l) => (
                  <div key={l.id} className="flex h-10 items-center gap-2.5 rounded-ctl pr-1 pl-2.5 text-subhead">
                    <Icon name={l.connected ? 'internaldrive' : 'lock'} size={18} className="text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{l.name}</span>
                    {l.connected ? null : (
                      <Button size="sm" variant="secondary" onPress={() => void atlas.reconnect(l.id)}>Allow</Button>
                    )}
                    <Button variant="quiet" size="icon-sm" aria-label={`Remove ${l.name}`} onPress={() => void atlas.removeLocation(l.id)}>
                      <Icon name="xmark" size={13} sw={2.4} />
                    </Button>
                  </div>
                ))}
              </SplitViewSection>
            ) : null}
          </div>
        </SplitViewContent>
        <div className="absolute inset-x-0 bottom-0 flex h-[50px] items-center gap-2 px-4 text-caption text-muted-foreground" aria-live="polite">
          {atlas.scanning ? <>
            <Spinner size={14} label="Scanning" />
            <span className="min-w-0 flex-1 truncate">{atlas.progress?.at ? `Reading ${atlas.progress.at}` : 'Scanning…'}</span>
          </> : <span className="min-w-0 flex-1 truncate">{atlas.source.label}</span>}
          {footer}
        </div>
      </div>
    </SplitViewSidebar>
  );
}

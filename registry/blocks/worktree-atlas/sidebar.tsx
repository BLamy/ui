/* The sidebar: a rail on its leading edge picks the view (Files: browse the checkout; Changes: its diff to main),
   and beside it every project folds open to its worktrees: five at first, then Show more for twenty, then twenty
   more at a time. Right-click (or long-press) a worktree for its menu, Delete included. Below them, the opened
   folders (for the browser source), each one reconnectable after a restart and removable. Rescan and Add Folder
   sit in the bar; the footer says where the data comes from and what a scan is reading. Resting on a worktree previews
   it in a hover card (its folder, HEAD, pull request, size and age), so two agent branches can be told apart before
   either is opened. */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from '@brett_lamy/ui/sdk/react/collapsible';
import { Toggle as SdkToggle, ToggleGroup } from '@brett_lamy/ui/sdk/react/toggle';
import { Button as SdkButton } from '@brett_lamy/ui/sdk/react/button';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuContextTrigger } from '@/components/ui/dropdown-menu';
import { HoverCardHeader } from '@/components/ui/hover-card';
import { Spinner } from '@/components/ui/spinner';
import { SplitViewContent, SplitViewHeader, SplitViewItem, SplitViewSection, SplitViewSidebar, useSplitView } from '@/components/ui/split-view';
import { AnimatedHeight } from '@/components/ui/animated-height';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';
import { formatBytes, relativeTime } from './data';
import { BarButton, BranchIcon, ChangesIcon, FolderIcon, WorktreeChips, branchLabel, shortPath } from './parts';
import type { Project, Worktree } from './types';
import type { AtlasState, AtlasView } from './use-atlas';
import { EmptyState } from '@/components/ui/empty-state';

/** Worktrees a project shows before Show more, then after the first one; each later press adds `MORE`. */
const FIRST = 5, SECOND = 20, MORE = 20;
const nextLimit = (n: number) => (n < SECOND ? SECOND : n + MORE);

const VIEWS: { id: AtlasView; label: string; icon: ReactNode }[] = [
  { id: 'files', label: 'Files', icon: <Icon name="folder" size={21} /> },
  { id: 'changes', label: 'Changes', icon: <ChangesIcon size={21} /> },
];

function Rail({ atlas }: { atlas: AtlasState }) {
  return (
    <ToggleGroup<AtlasView> aria-label="View" orientation="vertical" deselectable={false} value={[atlas.view]}
      onValueChange={([view]) => { if (view) atlas.showView(view); }}
      className="flex w-[52px] shrink-0 flex-col items-center gap-1.5 shadow-[inset_-1px_0_0_var(--border)]">
      <div aria-hidden="true" data-slot="atlas-rail-top" className="h-toolbar w-full shrink-0" />
      {VIEWS.map((v) => (
        <SdkToggle key={v.id} value={v.id} aria-label={v.label}
          className={cn(
            'bl-btn grid size-10 cursor-pointer place-items-center rounded-ctl border-0 bg-transparent text-muted-foreground outline-none transition-colors duration-150',
            'focus-visible:ring-2 focus-visible:ring-ring',
            'not-data-pressed:hover:bg-secondary/60 not-data-pressed:hover:text-foreground data-pressed:bg-secondary data-pressed:text-foreground',
          )}>
          {v.icon}
        </SdkToggle>
      ))}
    </ToggleGroup>
  );
}

const sortWorktrees = (ws: Worktree[]) =>
  [...ws].sort((a, b) => Number(b.primary) - Number(a.primary) || (b.modified ?? 0) - (a.modified ?? 0));

/** A worktree's hover card: the branch and folder, what it is (chips), and the facts the row has no room for. */
function WorktreeCard({ p, w }: { p: Project; w: Worktree }) {
  const facts: [string, ReactNode][] = [
    ['HEAD', <span className="font-mono">{w.head}</span>],
    ['Merges into', p.baseBranch],
    ...(w.modified ? [['Changed', relativeTime(w.modified)] as [string, ReactNode]] : []),
    ...(w.size ? [['On disk', formatBytes(w.size)] as [string, ReactNode]] : []),
  ];
  return (
    <div className="flex flex-col gap-2.5">
      <HoverCardHeader
        icon={<span className="grid size-9 place-items-center rounded-ctl bg-secondary text-muted-foreground"><BranchIcon size={18} /></span>}
        title={<span className={cn(!w.branch && 'italic')}>{branchLabel(w)}</span>}
        description={p.name}
      />
      <code className="block rounded-ctl bg-secondary px-2 py-1 text-caption break-all text-muted-foreground select-text">{shortPath(w.path)}</code>
      <span className="flex flex-wrap gap-1 empty:hidden"><WorktreeChips w={w} /></span>
      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-footnote">
        {facts.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="m-0 min-w-0 truncate">{v}</dd>
          </div>
        ))}
      </dl>
      {w.pullRequest ? (
        <a href={w.pullRequest.url} target="_blank" rel="noreferrer" className="text-footnote text-primary no-underline hover:underline">
          Open pull request #{w.pullRequest.number}
        </a>
      ) : null}
    </div>
  );
}

function WorktreeItem({ atlas, p, w }: { atlas: AtlasState; p: Project; w: Worktree }) {
  const s = useSplitView();
  const show = (view: AtlasView) => { atlas.showView(view); atlas.open(w.id); s.select('sidebar', w.id); };
  return (
    <DropdownMenu onAction={(value) => {
      if (value === 'files' || value === 'changes') show(value);
      else if (value === 'copy') void navigator.clipboard?.writeText(w.path);
      else if (value === 'delete') atlas.requestDelete([w]);
    }}>
      <DropdownMenuContextTrigger className="flex w-full">
        <SplitViewItem value={w.id} className="min-h-[34px] w-full py-1 pl-10" preview={<WorktreeCard p={p} w={w} />}>
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <span className={cn('min-w-0 flex-1 truncate text-subhead leading-[1.3]', !w.branch && 'italic', (w.missing || w.unreachable) && 'opacity-55')}>
              {branchLabel(w)}
            </span>
            {w.locked ? <Icon name="lock" size={13} className="shrink-0 text-muted-foreground group-data-current/item:text-primary-foreground/80" /> : null}
            <span className="shrink-0 text-caption text-muted-foreground tabular-nums group-data-current/item:text-primary-foreground/80">
              {w.primary ? 'Primary' : relativeTime(w.modified)}
            </span>
          </span>
        </SplitViewItem>
      </DropdownMenuContextTrigger>
      <DropdownMenuContent aria-label={`${branchLabel(w)} actions`}>
        <DropdownMenuItem value="changes" icon={<ChangesIcon size={18} />}>Show Changes</DropdownMenuItem>
        <DropdownMenuItem value="files" icon={<Icon name="folder" size={18} />}>Browse Files</DropdownMenuItem>
        <DropdownMenuItem value="copy" icon={<Icon name="copy" size={18} />}>Copy Path</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem value="delete" destructive disabled={!atlas.deletable(w)} icon={<Icon name="trash" size={18} />}>
          {w.clone ? 'Delete Clone…' : 'Delete Worktree…'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
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
    <Collapsible open={expanded} onOpenChange={(open) => onExpandedChange(open)} role="group" aria-label={p.name}>
      <CollapsibleTrigger
        className="bl-btn flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-ctl border-0 bg-transparent px-2.5 text-left [font-family:inherit] text-subhead text-foreground outline-none hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring">
        <FolderIcon open={expanded} size={20} className="text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate" title={shortPath(p.path)}>
          {p.name}{where ? <span className="ml-1.5 text-footnote text-muted-foreground">{where}</span> : null}
        </span>
      </CollapsibleTrigger>
      <CollapsiblePanel className="h-(--collapsible-panel-height) overflow-clip transition-[height] duration-spring-tray ease-spring-tray data-starting-style:h-0 data-ending-style:h-0 motion-reduce:transition-none">
        {/* Show more grows the open group on the same spring. */}
        <AnimatedHeight>
          <div className="flex flex-col gap-px pb-1">
            {shown.map((w) => <WorktreeItem key={w.id} atlas={atlas} p={p} w={w} />)}
            {rows.length > limit ? (
              <SdkButton onClick={() => setLimit(nextLimit(limit))}
                className="bl-btn flex h-8 w-full cursor-pointer items-center rounded-ctl border-0 bg-transparent pl-10 text-left [font-family:inherit] text-subhead text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
                Show more
              </SdkButton>
            ) : null}
            {rows.length === 0 ? <div className="pl-10 py-1.5 text-footnote text-muted-foreground">No worktrees</div> : null}
          </div>
        </AnimatedHeight>
      </CollapsiblePanel>
    </Collapsible>
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
        <SplitViewHeader title="Projects" titleAlign="start" largeTitle={s.collapsed} trailing={<>
          <BarButton label="Scan again" disabled={atlas.scanning} onClick={() => void atlas.scan()}><Icon name="arrow-clockwise" size={20} /></BarButton>
          {canAdd ? <BarButton label="Add folder" onClick={() => void atlas.addLocation()}><Icon name="folder-badge-plus" size={22} /></BarButton> : null}
        </>} />
        <SplitViewContent>
          <div className="flex flex-col gap-px px-2 pt-1 pb-20">
            {atlas.projects.map((p) => (
              <ProjectGroup key={p.id} atlas={atlas} p={p} expanded={expanded.has(p.id)} onExpandedChange={(o) => setOpen(p.id, o)}
                where={(named.get(p.name) ?? 0) > 1 ? shortPath(p.path.slice(0, p.path.lastIndexOf('/')) || p.path) : undefined} />
            ))}
            {atlas.scanned && !atlas.projects.length ? (
              <EmptyState size="sm" title="No repositories found in the opened folders." className="py-3" />
            ) : null}
            {atlas.locations.length ? (
              <SplitViewSection title="Folders" collapsible className="mt-2">
                {atlas.locations.map((l) => (
                  <div key={l.id} className="flex h-10 items-center gap-2.5 rounded-ctl pr-1 pl-2.5 text-subhead">
                    <Icon name={l.connected ? 'internaldrive' : 'lock'} size={18} className="text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{l.name}</span>
                    {l.connected ? null : (
                      <Button size="sm" variant="secondary" onClick={() => void atlas.reconnect(l.id)}>Allow</Button>
                    )}
                    <Button variant="quiet" size="icon-sm" aria-label={`Remove ${l.name}`} onClick={() => void atlas.removeLocation(l.id)}>
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

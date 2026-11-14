/* Site map: every page Loop QA has found, as a tree (the kit's Tree: arrow keys move and fold, typing finds a page)
   — how often the agents visited it, and whether it has open bugs or hasn't been reached yet. Pressing a page with
   bugs, or Return on it, jumps to them. */
import type { CSSProperties } from 'react';
import { NumberMorph } from '@/components/ui/number-morph';
import { ProgressRing } from '@/components/ui/progress-ring';
import { Tree, TreeGroup, TreeItem, TreeItemIndicator, TreeItemLabel } from '@/components/ui/tree';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';
import { SITE_MAP, type Project, type SiteNode } from './data';
import { Empty, Panel, Pill } from './parts';
import { useLoopQA } from './state';

const flatten = (n: SiteNode): SiteNode[] => [n, ...(n.children ?? []).flatMap(flatten)];
/** Every branch, so the tree opens fully expanded. */
const BRANCHES = flatten(SITE_MAP).filter((n) => n.children?.length).map((n) => n.path);

export function SiteMapTab({ project }: { project: Project }) {
  const qa = useLoopQA();
  if (project.id !== 'northwind') {
    return <Empty icon="network" title="Mapping in progress" text="The site map fills in as runs and recorded sessions visit pages. Start a run to map this project." />;
  }
  const all = flatten(SITE_MAP);
  const covered = all.filter((n) => n.status !== 'unvisited').length;
  const withBugs = all.filter((n) => n.status === 'bugs').length;
  const max = Math.max(...all.map((n) => n.visits));
  return (
    <div className="grid gap-5 @4xl:grid-cols-[1fr_240px]!">
      <Panel title="Pages" icon="network" trailing={<span className="text-caption text-muted-foreground">{all.length} pages</span>} bodyClassName="py-2">
        <Tree aria-label="Site map" mode="none" density="comfortable" defaultExpanded={BRANCHES} expandOnPress={false}
          onAction={(path) => { if (all.find((n) => n.path === path)?.bugs) qa.setTab('bugs'); }}
          className="px-2 text-[length:inherit] [--tree-indent:22px] [--tree-pad-x:8px]">
          <Node node={SITE_MAP} depth={0} max={max} />
        </Tree>
      </Panel>
      <div className="flex flex-col gap-3">
        <Panel bodyClassName="flex items-center gap-4 p-4">
          <ProgressRing aria-label="Pages covered" value={(covered / all.length) * 100} size="xl" showValue />
          <div className="text-[12.5px] leading-[18px] text-muted-foreground"><span className="font-semibold text-foreground">{covered} of {all.length}</span> pages visited by an agent or a recorded session.</div>
        </Panel>
        <Panel bodyClassName="grid gap-2.5 p-4 text-[12.5px]">
          <Legend tone="bg-success" label="Covered" n={covered - withBugs} />
          <Legend tone="bg-destructive" label="Has open bugs" n={withBugs} />
          <Legend tone="bg-tertiary-foreground/40" label="Not reached yet" n={all.length - covered} />
          <p className="m-0 mt-1 border-t border-border pt-2.5 text-caption text-muted-foreground">Account pages need a signed-in session — add test credentials in Settings to reach them.</p>
        </Panel>
      </div>
    </div>
  );
}

function Legend({ tone, label, n }: { tone: string; label: string; n: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn('size-2.5 rounded-full', tone)} />
      <span className="flex-1">{label}</span>
      <span className="font-semibold tabular-nums"><NumberMorph value={n} /></span>
    </div>
  );
}

function Node({ node: n, depth, max }: { node: SiteNode; depth: number; max: number }) {
  const kids = n.children ?? [];
  return (
    <TreeItem value={n.path} label={n.title}>
      <TreeItemLabel className="group h-auto min-h-10 gap-2 leading-[normal] hover:not-data-disabled:not-data-selected:bg-muted">
        {kids.length ? (
          <TreeItemIndicator className="size-5">
            <Icon name="chev" size={12} sw={2.6} className="group-data-expanded/tree-indicator:rotate-90 rtl:-scale-x-100" />
          </TreeItemIndicator>
        ) : <span className="size-5 shrink-0" />}
        <span className={cn('size-2 shrink-0 rounded-full', n.status === 'bugs' ? 'bg-destructive' : n.status === 'covered' ? 'bg-success' : 'bg-tertiary-foreground/40')} />
        <span className={cn('min-w-0 flex-1 truncate text-[13.5px]', n.status === 'unvisited' ? 'text-muted-foreground' : 'font-medium')}>
          {n.title} <span className="ml-1 font-mono text-[11.5px] font-normal text-tertiary-foreground">{n.path}</span>
        </span>
        <span className="hidden w-[120px] items-center gap-2 @2xl:flex!" aria-label={`${n.visits} visits`}>
          <span className="h-1 flex-1 overflow-hidden rounded-full bg-secondary">
            <span className="block h-full w-(--w) rounded-full bg-foreground/35" style={{ '--w': `${(n.visits / max) * 100}%` } as CSSProperties} />
          </span>
          <span className="w-6 text-right text-[11.5px] text-muted-foreground tabular-nums">{n.visits}</span>
        </span>
        <span className="flex w-[92px] shrink-0 justify-end">
          {n.bugs ? <Pill tone="danger" className="cursor-pointer">{n.bugs} {n.bugs === 1 ? 'bug' : 'bugs'}<Icon name="chevron-right" size={10} sw={2.6} /></Pill>
            : n.status === 'unvisited' ? <Pill tone="outline">Not reached</Pill> : null}
        </span>
      </TreeItemLabel>
      {kids.length ? (
        // A line down the left of each open branch, under its chevron.
        <TreeGroup className="relative before:absolute before:top-0 before:bottom-3 before:left-(--x) before:w-px before:bg-border before:content-['']" style={{ '--x': `${18 + depth * 22}px` } as CSSProperties}>
          {kids.map((k) => <Node key={k.path} node={k} depth={depth + 1} max={max} />)}
        </TreeGroup>
      ) : null}
    </TreeItem>
  );
}

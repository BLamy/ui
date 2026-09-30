/* Site map: every page Loop QA has found, as a tree — how often the agents visited it, and whether it has open
   bugs or hasn't been reached yet. Branches fold on a spring; a page with bugs jumps to them. */
import { useState, type CSSProperties } from 'react';
import { AnimatedHeight, Chevron, Icon, NumberMorph, ProgressRing, cn } from '@brett_lamy/ui';
import { SITE_MAP, type Project, type SiteNode } from './data';
import { Empty, Panel, Pill, Pressable } from './parts';
import { useLoopQA } from './state';

const flatten = (n: SiteNode): SiteNode[] => [n, ...(n.children ?? []).flatMap(flatten)];

export function SiteMapTab({ project }: { project: Project }) {
  if (project.id !== 'northwind') {
    return <Empty icon="network" title="Mapping in progress" text="The site map fills in as runs and recorded sessions visit pages. Start a run to map this project." />;
  }
  const all = flatten(SITE_MAP);
  const covered = all.filter((n) => n.status !== 'unvisited').length;
  const withBugs = all.filter((n) => n.status === 'bugs').length;
  const max = Math.max(...all.map((n) => n.visits));
  return (
    <div className="grid gap-5 @4xl:grid-cols-[1fr_240px]!">
      <Panel title="Pages" icon="network" trailing={<span className="text-[12px] text-muted-foreground">{all.length} pages</span>} bodyClassName="py-2">
        <ul className="m-0 list-none px-2 py-0" role="tree" aria-label="Site map">
          <Node node={SITE_MAP} depth={0} max={max} />
        </ul>
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
          <p className="m-0 mt-1 border-t border-border pt-2.5 text-[12px] text-muted-foreground">Account pages need a signed-in session — add test credentials in Settings to reach them.</p>
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
  const qa = useLoopQA();
  const [open, setOpen] = useState(true);
  const kids = n.children ?? [];
  return (
    <li role="treeitem" aria-expanded={kids.length ? open : undefined} aria-selected={false} className="relative">
      <div className="group flex min-h-10 items-center gap-2 rounded-[10px] pr-2 hover:bg-muted!" style={{ paddingLeft: 8 + depth * 22 } as CSSProperties}>
        {kids.length ? (
          <Pressable aria-label={open ? `Collapse ${n.title}` : `Expand ${n.title}`} onPress={() => setOpen(!open)}
            className="grid size-5 shrink-0 cursor-pointer place-items-center rounded-md p-0 text-muted-foreground data-hovered:bg-secondary-strong!">
            <Chevron direction={open ? 'down' : 'right'} size={12} sw={2.6} />
          </Pressable>
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
        {n.bugs ? (
          <Pressable onPress={() => qa.setTab('bugs')} className="h-auto cursor-pointer rounded-full p-0 data-pressed:not-aria-expanded:scale-95">
            <Pill tone="danger">{n.bugs} {n.bugs === 1 ? 'bug' : 'bugs'}<Icon name="chevron-right" size={10} sw={2.6} /></Pill>
          </Pressable>
        ) : n.status === 'unvisited' ? <Pill tone="outline">Not reached</Pill> : null}
        </span>
      </div>
      {kids.length ? (
        <AnimatedHeight>
          {open ? (
            <ul role="group" className="relative m-0 list-none p-0 before:absolute before:top-0 before:bottom-3 before:w-px before:bg-border before:content-[''] before:left-(--x)" style={{ '--x': `${18 + depth * 22}px` } as CSSProperties}>
              {kids.map((k) => <Node key={k.path} node={k} depth={depth + 1} max={max} />)}
            </ul>
          ) : null}
        </AnimatedHeight>
      ) : null}
    </li>
  );
}

/* All projects: a summary strip across every project, then a card per project — a drawing of the site, its
   status, open bugs by severity, the bug trend over recent runs and when it last ran. Cards reflow from four
   columns to one; filtering morphs them into place. */
import { useMemo, useState, type CSSProperties } from 'react';
import {
  Button, Icon, Morph, MorphGroup, MorphPresence, NumberMorph, SearchField, Segmented, SplitViewContent, SplitViewHeader,
} from '@brett_lamy/ui';
import { isOpen } from './agent';
import { CREDITS, PROJECTS, SEVERITIES, host, relativeTime, type Project, type Severity } from './data';
import { Leading, PageActions } from './header';
import { Empty, Pill, SeverityBar, SiteThumb, Sparkline, StatTile, Pressable } from './parts';
import { useLoopQA } from './state';

export function ProjectsHome() {
  const qa = useLoopQA();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'paused'>('all');
  const open = qa.bugs.filter(isOpen);
  const counts = countBySeverity(open.map((b) => b.severity));
  const weekRuns = qa.runs.filter((r) => r.status !== 'running');
  const passed = weekRuns.flatMap((r) => r.journeys).filter((j) => j.status === 'passed').length;
  const journeys = weekRuns.flatMap((r) => r.journeys).length;
  const shown = useMemo(() => PROJECTS.filter((p) =>
    (filter === 'all' || p.status === filter) &&
    (!query || `${p.name} ${p.url}`.toLowerCase().includes(query.toLowerCase()))), [filter, query]);

  return (
    <>
      <SplitViewHeader title="Projects" largeTitle largeTitleClassName="mx-auto w-full max-w-[1180px] px-5 @3xl:px-8!" leading={<Leading />} trailing={<PageActions run={false} />} />
      <SplitViewContent className="@container">
        <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 px-5 pb-12 @3xl:px-8!">
          <p className="-mt-1 m-0 text-[14px] text-muted-foreground">Every app Loop QA is testing — what it found and when it last looked.</p>

          <div className="grid grid-cols-2 gap-3 @4xl:grid-cols-4!">
            <StatTile label="Open bugs" icon="exclamation-circle" value={open.length} foot={`${counts.critical} critical · ${counts.high} high`}>
              <SeverityBar counts={counts} className="mt-2.5" />
            </StatTile>
            <StatTile label="Runs this week" icon="checklist" value={weekRuns.length} foot={`${journeys} journeys replayed`} />
            <StatTile label="Journey pass rate" icon="checkmark-circle" foot="across every project">
              <div className="mt-1.5 text-[30px] leading-9 font-semibold tracking-[-.03em] tabular-nums">
                <NumberMorph value={journeys ? passed / journeys : 0} format={{ style: 'percent' }} />
              </div>
            </StatTile>
            <StatTile label="Credits left" icon="bolt" value={Math.round(CREDITS.total - CREDITS.used)} foot={`of ${CREDITS.total.toLocaleString('en-US')} · renews ${CREDITS.renews}`} />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <SearchField aria-label="Filter projects" placeholder="Filter projects" value={query} onChange={setQuery} className="max-w-[340px] min-w-[200px] flex-1" />
            <Segmented
              aria-label="Status"
              value={filter}
              onChange={(v) => setFilter(v as typeof filter)}
              options={[{ id: 'all', label: 'All' }, { id: 'active', label: 'Active' }, { id: 'paused', label: 'Paused' }]}
              className="w-[220px]"
            />
            <span className="flex-1" />
            <Button size="sm" variant="secondary" className="h-8 rounded-[9px]" onPress={() => qa.setDialog('new-project')}>
              <Icon name="plus" size={13} sw={2.4} />New project
            </Button>
          </div>

          {shown.length ? (
            <MorphGroup>
              <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(248px,1fr))] gap-4 p-0">
                <MorphPresence>
                  {shown.map((p) => (
                    <Morph key={p.id} id={p.id} as="li" layout="position" fade>
                      <ProjectCard project={p} />
                    </Morph>
                  ))}
                </MorphPresence>
              </ul>
            </MorphGroup>
          ) : (
            <Empty icon="magnifyingglass" title="No projects match" text={`Nothing matches “${query}”. Try a name or a URL.`} />
          )}
        </div>
      </SplitViewContent>
    </>
  );
}

function ProjectCard({ project: p }: { project: Project }) {
  const qa = useLoopQA();
  const open = qa.bugs.filter((b) => b.projectId === p.id && isOpen(b));
  const counts = countBySeverity(open.map((b) => b.severity));
  const running = qa.runs.some((r) => r.projectId === p.id && r.status === 'running');
  return (
    <Pressable
      onPress={() => qa.openSection(p.id)}
      aria-label={`${p.name}, ${open.length} open bugs`}
      className="group flex w-full cursor-pointer flex-col items-stretch justify-start gap-0 overflow-hidden rounded-[16px] border border-solid border-border bg-card p-0 text-left whitespace-normal outline-none shadow-[0_1px_2px_--alpha(black/4%)] transition-[translate,box-shadow,scale] duration-spring-smooth ease-spring-smooth data-hovered:-translate-y-0.5 data-hovered:shadow-[0_12px_32px_-12px_--alpha(black/22%)] data-pressed:not-aria-expanded:scale-[.985] data-focus-visible:ring-2 data-focus-visible:ring-ring motion-reduce:transition-none"
    >
      <div className="relative m-1.5 mb-0 overflow-hidden rounded-[11px] border border-border">
        <SiteThumb kind={p.site} brand={p.brand} className="aspect-[16/10] w-full transition-[scale] duration-spring-smooth ease-spring-smooth group-data-hovered:scale-[1.025] motion-reduce:transition-none" />
        <div className="absolute top-2 left-2 flex gap-1.5">
          {running ? (
            <Pill tone="primary" className="bg-card shadow-[0_2px_8px_--alpha(black/12%)]"><span className="size-1.5 animate-pulse rounded-full bg-primary motion-reduce:animate-none" />Running</Pill>
          ) : p.status === 'paused' ? (
            <Pill tone="neutral" className="bg-card shadow-[0_2px_8px_--alpha(black/12%)]">Paused</Pill>
          ) : null}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3 px-4 pt-3 pb-4">
        <div className="min-w-0">
          <div className="truncate text-[14.5px] font-semibold tracking-[-.01em]">{p.name}</div>
          <div className="mt-0.5 flex items-center gap-1 truncate text-[12.5px] text-muted-foreground">
            <Icon name="globe" size={12} sw={2} className="shrink-0" />{host(p.url)}
          </div>
        </div>
        <div className="mt-auto flex items-end justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-1.5">
              <span className="text-[20px] leading-6 font-semibold tracking-[-.02em] tabular-nums"><NumberMorph value={open.length} /></span>
              <span className="text-[12px] text-muted-foreground">open {open.length === 1 ? 'bug' : 'bugs'}</span>
            </div>
            <SeverityBar counts={counts} className="mt-2 w-[120px]" />
          </div>
          <Sparkline values={p.trend} />
        </div>
        <div className="flex items-center justify-between border-t border-border pt-2.5 text-[11.5px] text-muted-foreground">
          <span className="inline-flex items-center gap-1"><Icon name="clock" size={12} sw={2} />{relativeTime(p.lastRun)}</span>
          <span className="flex -space-x-1">
            {p.members.map((m, i) => (
              <span key={m} className="grid size-6 place-items-center rounded-full bg-secondary-strong text-[9.5px] font-semibold tracking-[-.02em] text-foreground ring-2 ring-card" style={{ zIndex: 5 - i } as CSSProperties}>{m}</span>
            ))}
          </span>
        </div>
      </div>
    </Pressable>
  );
}

export function countBySeverity(list: Severity[]): Record<Severity, number> {
  const out = Object.fromEntries(SEVERITIES.map((s) => [s, 0])) as Record<Severity, number>;
  for (const s of list) out[s] += 1;
  return out;
}

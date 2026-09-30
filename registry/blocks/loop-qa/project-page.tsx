/* A project: its name and target under a large title, then a sticky tab bar (Overview · Bugs · Site map ·
   Test runs · Playwright tests). The underline is one element that slides to the chosen tab, and panels move in
   the direction of travel. Rows push the bug, run or test page onto the column's stack. */
import type { ReactNode } from 'react';
import {
  ContentSwap, Icon, NumberMorph, SplitViewContent, SplitViewHeader, TabView, TabViewBar, TabViewIndicator, TabViewList, TabViewTab,
  cn, useDirection,
} from '@brett_lamy/ui';
import { isOpen } from './agent';
import { BugsTab } from './bugs';
import { host, relativeTime, type Project } from './data';
import { Leading, PageActions } from './header';
import { Overview } from './overview';
import { Pill } from './parts';
import { RunsTab } from './runs';
import { SiteMapTab } from './site-map';
import { TestsTab } from './tests';
import { useLoopQA, type ProjectTab } from './state';

const TABS: { id: ProjectTab; label: string; icon: string }[] = [
  { id: 'overview', label: 'Overview', icon: 'grid' },
  { id: 'bugs', label: 'Bugs', icon: 'exclamation-circle' },
  { id: 'sitemap', label: 'Site map', icon: 'network' },
  { id: 'runs', label: 'Test runs', icon: 'checklist' },
  { id: 'tests', label: 'Playwright tests', icon: 'doc-text' },
];

export function ProjectPage({ project: p }: { project: Project }) {
  const qa = useLoopQA();
  const index = TABS.findIndex((t) => t.id === qa.tab);
  const dir = useDirection(index);
  const open = qa.bugs.filter((b) => b.projectId === p.id && isOpen(b)).length;
  const runs = qa.runs.filter((r) => r.projectId === p.id).length;
  const wrap = 'mx-auto w-full max-w-[1180px] px-5 @3xl:px-8!';
  return (
    <>
      <SplitViewHeader title={p.name} largeTitle largeTitleClassName={wrap} leading={<Leading />} trailing={<PageActions />} />
      <SplitViewContent className="@container">
        <div className={cn(wrap, '-mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5 pb-3 text-[13px] text-muted-foreground')}>
          <a href={p.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-muted-foreground no-underline hover:text-foreground">
            <Icon name="globe" size={13} sw={2} />{host(p.url)}<Icon name="arrow-up-right" size={11} sw={2.2} />
          </a>
          <span className="text-tertiary-foreground">·</span>
          <Pill tone={p.status === 'active' ? 'success' : 'neutral'} dot>{p.status === 'active' ? 'Active' : 'Paused'}</Pill>
          <span className="inline-flex items-center gap-1"><Icon name="clock" size={13} sw={2} />{p.schedule}</span>
          <span className="text-tertiary-foreground">·</span>
          <span>Last run {relativeTime(p.lastRun)}</span>
        </div>

        <TabView placement="top" selectedKey={qa.tab} onSelectionChange={(k) => qa.setTab(k as ProjectTab)}>
          <div className="sticky top-0 z-20 border-b border-border bg-bar backdrop-blur-xl backdrop-saturate-150">
            <TabViewBar variant="plain" className={cn(wrap, 'overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden')}>
              <TabViewList aria-label="Project" className="flex gap-1">
                {TABS.map((t) => (
                  <UnderlineTab key={t.id} id={t.id} label={t.label} icon={t.icon}
                    count={t.id === 'bugs' ? open : t.id === 'runs' ? runs : undefined}
                    alert={t.id === 'bugs' && open > 0} />
                ))}
              </TabViewList>
            </TabViewBar>
          </div>
        </TabView>
        <div className={cn(wrap, 'pt-5 pb-14')}>
          <ContentSwap id={qa.tab} direction={dir} distance={28}>
            <Panel tab={qa.tab} project={p} />
          </ContentSwap>
        </div>
      </SplitViewContent>
    </>
  );
}

function Panel({ tab, project }: { tab: ProjectTab; project: Project }) {
  switch (tab) {
    case 'bugs': return <BugsTab project={project} />;
    case 'sitemap': return <SiteMapTab project={project} />;
    case 'runs': return <RunsTab project={project} />;
    case 'tests': return <TestsTab project={project} />;
    default: return <Overview project={project} />;
  }
}

function UnderlineTab({ id, label, icon, count, alert }: { id: string; label: string; icon: string; count?: number; alert?: boolean }) {
  return (
    <TabViewTab id={id} textValue={label} className="group relative flex shrink-0 cursor-pointer items-center py-1.5 outline-none">
      <span className="flex items-center gap-2 rounded-[8px] px-2.5 py-1.5 text-[13.5px] font-medium text-muted-foreground transition-[color,background-color] group-data-hovered:bg-secondary! group-data-hovered:text-foreground group-data-selected:text-foreground group-data-focus-visible:ring-2 group-data-focus-visible:ring-ring">
        <Icon name={icon} size={15} sw={2} />
        <span className="whitespace-nowrap">{label}</span>
        {count != null ? <Count n={count} alert={alert} /> : null}
      </span>
      <TabViewIndicator className="inset-x-2 -bottom-px z-1 h-[2px] rounded-full bg-primary" />
    </TabViewTab>
  );
}

function Count({ n, alert }: { n: number; alert?: boolean }): ReactNode {
  return (
    <span className={cn('min-w-5 rounded-full px-1.5 text-center text-[11px] leading-[18px] font-semibold tabular-nums', alert ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground')}>
      <NumberMorph value={n} />
    </span>
  );
}

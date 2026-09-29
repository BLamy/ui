/* GitHub clone — a repository page (Code, Issues, Pull requests, Actions) with a file browser, README, issue and
   PR lists, a pull request conversation with a comment composer, and a "Files changed" diff.
   Wide: GitHub's desktop layout with sidebars. Phone: a NavigationStack pushes folders, files and PRs. */
import { useState } from 'react';
import {
  Avatar, BLProvider, NavigationStack, TabView, TabViewBar, TabViewList, TabViewPanels, WorkbenchTheme, cn, useAppearance,
  useContainerWidth, type Screen,
} from '@brett_lamy/ui';
import { ISSUE_COUNTS, ME, PR_COUNTS, REPO } from './data';
import { Box, FlowPanel, Oct, UnderlineTab, ghButton, githubVars, type OctName, type Layout, type Nav } from './parts';
import { ActionsView } from './actions-tab';
import { CodeHome, PathView } from './code-tab';
import { CloneDialog, LabelFilter } from './dialogs';
import { IssueList } from './issues-tab';
import { PullRequestView, type PullRequestTab } from './pull-request';
import { PullList } from './pulls-tab';
import { GlobalHeader, RepoHeader } from './repo-header';

export type GithubTab = 'code' | 'issues' | 'pulls' | 'actions';

export interface GithubCloneProps {
  /** Repository tab to open on. Defaults to Code. */
  initialTab?: GithubTab;
  /** Open this pull request's detail view (e.g. 488) — implies the Pull requests tab. */
  initialPullRequest?: number;
  /** Open a file or folder in the Code tab (e.g. 'src/queue.ts'). */
  initialPath?: string;
  /** The pull request's sub-tab to open on (with `initialPullRequest`), e.g. 'files' for Files changed. */
  initialPullRequestTab?: PullRequestTab;
}

export default function GithubClone({ initialTab, initialPullRequest, initialPath = '', initialPullRequestTab }: GithubCloneProps) {
  const dark = useAppearance() === 'dark';
  const [ref, width] = useContainerWidth<HTMLDivElement>(1200);
  const ui: Layout = { phone: width < 640, wide: width >= 1012, dark };
  const [tab, setTab] = useState<GithubTab>(initialTab ?? (initialPullRequest ? 'pulls' : 'code'));
  const [path, setPath] = useState(initialPath);
  const [pr, setPr] = useState<number | null>(initialPullRequest ?? null);
  const [cloneOpen, setCloneOpen] = useState(false);
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [labelFilter, setLabelFilter] = useState<string[]>([]);

  const nav = {
    openPath: (p: string) => { setTab('code'); setPath(p); },
    openPr: (n: number | null) => { setTab('pulls'); setPr(n); },
    clone: () => setCloneOpen(true),
    labels: () => setLabelsOpen(true),
  };
  const page = (
    <RepoPage ui={ui} tab={tab} onTab={setTab} path={ui.phone ? '' : path} pr={ui.phone ? null : pr} nav={nav} labelFilter={labelFilter} prTab={initialPullRequestTab} />
  );

  /* Phone: the repo page is the root screen; each folder level, the open file and the PR push on top. */
  const screens: Screen[] = [
    {
      key: 'repo', title: REPO.name, content: page, hideChromeOnScroll: false,
      leading: <button type="button" aria-label="Menu" className={cn(ghButton(), 'ml-2 w-8 px-0')}><Oct name="menu" /></button>,
      trailing: <Avatar c={ME} size={28} className="mr-2.5" />,
    },
    ...(tab === 'code' && path
      ? path.split('/').map((_, i, parts) => {
          const p = parts.slice(0, i + 1).join('/');
          return { key: 'path:' + p, title: parts[i], content: <PathView ui={ui} path={p} nav={nav} />, hideChromeOnScroll: false };
        })
      : []),
    ...(tab === 'pulls' && pr ? [{ key: 'pr', title: '#' + pr, content: <PullRequestView ui={ui} number={pr} nav={nav} initialTab={initialPullRequestTab} />, hideChromeOnScroll: false }] : []),
  ];
  const pop = () => (pr && tab === 'pulls' ? setPr(null) : setPath(path.split('/').slice(0, -1).join('/')));

  return (
    <BLProvider tint={dark ? '#4493f8' : '#0969da'} style={githubVars(dark)} className="min-h-0 bg-background">
      <WorkbenchTheme appearance={dark ? 'dark' : 'light'} tint={dark ? '#4493f8' : '#0969da'} style={githubVars(dark)}
        className="h-full w-full bg-background text-[14px] text-foreground select-text">
        <div ref={ref} className="relative flex h-full min-h-0 w-full flex-col">
          {ui.phone ? (
            <NavigationStack screens={screens} onPop={pop} />
          ) : (
            <>
              <GlobalHeader ui={ui} width={width} />
              <div className="bl-scroll min-h-0 flex-1 overflow-y-auto">{page}</div>
            </>
          )}
        </div>
        <CloneDialog open={cloneOpen} onClose={() => setCloneOpen(false)} compact={ui.phone} />
        <LabelFilter open={labelsOpen} onClose={() => setLabelsOpen(false)} compact={ui.phone} value={labelFilter} onChange={setLabelFilter} />
      </WorkbenchTheme>
    </BLProvider>
  );
}

/** Repo header + tabs; each tab shows its screen (on wide layouts the open folder / file / PR shows in place). */
function RepoPage({ ui, tab, onTab, path, pr, nav, labelFilter, prTab }: {
  ui: Layout; tab: GithubTab; onTab: (t: GithubTab) => void; path: string; pr: number | null; nav: Nav; labelFilter: string[]; prTab?: PullRequestTab;
}) {
  return (
    <TabView placement="top" selectedKey={tab} onSelectionChange={(k) => { onTab(k as GithubTab); if (k === 'pulls') nav.openPr(null); }}>
      <div className="border-b border-border">
        <RepoHeader ui={ui} />
        <TabViewBar variant="plain" className="mt-2 overflow-x-auto px-2 [scrollbar-width:none] md:px-4">
          <TabViewList aria-label="Repository" className="flex gap-1">
            <UnderlineTab id="code" icon="code" label="Code" />
            <UnderlineTab id="issues" icon="issue" label="Issues" count={ISSUE_COUNTS.open} />
            <UnderlineTab id="pulls" icon="pr" label="Pull requests" count={PR_COUNTS.open} />
            <UnderlineTab id="actions" icon="play" label="Actions" />
            {!ui.phone ? <UnderlineTab id="insights" icon="pulse" label="Insights" /> : null}
            {!ui.phone ? <UnderlineTab id="settings" icon="gear" label="Settings" /> : null}
          </TabViewList>
        </TabViewBar>
      </div>
      <TabViewPanels className="mx-auto w-full max-w-[1280px] px-4 py-6 md:px-6">
        <FlowPanel id="code">{path ? <PathView ui={ui} path={path} nav={nav} /> : <CodeHome ui={ui} nav={nav} />}</FlowPanel>
        <FlowPanel id="issues"><IssueList ui={ui} nav={nav} labelFilter={labelFilter} /></FlowPanel>
        <FlowPanel id="pulls">{pr ? <PullRequestView ui={ui} number={pr} nav={nav} initialTab={prTab} /> : <PullList ui={ui} nav={nav} />}</FlowPanel>
        <FlowPanel id="actions"><ActionsView ui={ui} /></FlowPanel>
        <FlowPanel id="insights"><Placeholder icon="pulse" title="Insights" text="Pulse, contributors, traffic and dependency graphs." /></FlowPanel>
        <FlowPanel id="settings"><Placeholder icon="gear" title="Settings" text="Only repository admins can change settings." /></FlowPanel>
      </TabViewPanels>
    </TabView>
  );
}

function Placeholder({ icon, title, text }: { icon: OctName; title: string; text: string }) {
  return (
    <Box className="grid place-items-center px-6 py-16 text-center">
      <Oct name={icon} size={24} className="text-muted-foreground" />
      <h3 className="mt-3 mb-1 text-[20px] font-semibold">{title}</h3>
      <p className="m-0 text-muted-foreground">{text}</p>
    </Box>
  );
}

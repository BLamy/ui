/* GitHub clone — a repository page (Code, Issues, Pull requests, Actions) with a file browser, README, issue and
   PR lists, an issue or pull request conversation with a comment composer, and a "Files changed" diff.
   Wide: GitHub's desktop layout with sidebars. Phone: a NavigationStack pushes folders, files, issues and PRs.

   Our UI over GitHub's data: signed in with GitHub in the Passwords keychain (the same passkey vault the Passwords
   block and the docs' "Load from Keychain" use, see ../apple-passwords/keychain.tsx), the block reads the real
   repository you pick — any owner/name, BLamy/ui by default, the account's recent ones in the picker — straight from
   api.github.com, and the comment composer posts real comments. Without a token it shows the invented acme/orbit
   (data.ts), offline, with a "Sign in with GitHub" button (or "Unlock keychain" when a saved sign-in is behind the
   passkey). `token` or `github` bypass the keychain; `keychain={false}` keeps it out entirely. */
import { useMemo, useRef, useState } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { NavigationStack, type Screen } from '@/components/ui/navigation-stack';
import { TabView, TabViewBar, TabViewList, TabViewPanels } from '@/components/ui/tab-view';
import { WorkbenchTheme } from '@/components/ui/workbench-theme';
import { useContainerWidth } from '@/lib/container';
import type { Tailscale } from '@/lib/tailscale';
import { BLProvider, useAppearance } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { PasswordsKeychain, useKeychainSignIn, type DeviceAuth } from '../apple-passwords/page';
import { githubClient, githubRepo, type GitHub } from './github-api';
import { Box, FlowPanel, Oct, UnderlineTab, ghButton, GITHUB_THEME, GITHUB_TINT, type OctName, type Layout, type Nav } from './parts';
import { RepoProvider, useLoad, useRepo, Failed, Pending } from './repo-context';
import { SAMPLE_SOURCE, type RepoSource } from './source';
import { ActionsView } from './actions-tab';
import { CodeHome, PathView } from './code-tab';
import { CloneDialog, LabelFilter, RepoPicker } from './dialogs';
import { IssueList, IssueView } from './issues-tab';
import { PullRequestView, type PullRequestTab } from './pull-request';
import { PullList } from './pulls-tab';
import { GlobalHeader, RepoHeader } from './repo-header';

export type GithubTab = 'code' | 'issues' | 'pulls' | 'actions';

/** What a signed-in block opens first. */
export const DEFAULT_REPO = 'BLamy/ui';

export interface GithubCloneProps {
  /** Repository tab to open on. Defaults to Code. */
  initialTab?: GithubTab;
  /** Open this pull request's detail view (e.g. 488) — implies the Pull requests tab. */
  initialPullRequest?: number;
  /** Open a file or folder in the Code tab (e.g. 'src/queue.ts'). */
  initialPath?: string;
  /** The pull request's sub-tab to open on (with `initialPullRequest`), e.g. 'files' for Files changed. */
  initialPullRequestTab?: PullRequestTab;
  /** The repository (owner/name) to show once there's a GitHub token. Default BLamy/ui. */
  repo?: string;
  /** A GitHub token to use instead of the keychain's (never hardcode one). */
  token?: string;
  /** A GitHub client to use (createGitHub({ token, fetch })): tests and stories pass one with a stand-in fetch. */
  github?: GitHub;
  /** Read the GitHub sign-in from the Passwords keychain (default true). False: sample data unless `token`/`github`. */
  keychain?: boolean;
  /** Runs the keychain's device sign-in (default the real one; `createDemoDeviceAuth()` fakes it). */
  auth?: DeviceAuth;
  /** The Tailscale controller the sign-in may use (default the Safari block's node); false: always the CORS proxy. */
  tailscale?: Tailscale | false;
}

export default function GithubClone({ keychain = true, auth, tailscale, ...props }: GithubCloneProps) {
  const appearance = useAppearance() === 'dark' ? 'dark' : 'light';
  const [ref, width] = useContainerWidth<HTMLDivElement>(1200);
  const app = <GithubApp {...props} width={width} dark={appearance === 'dark'} />;
  return (
    <BLProvider tint={GITHUB_TINT[appearance]} style={GITHUB_THEME[appearance]} className="min-h-0 bg-background">
      <WorkbenchTheme appearance={appearance} tint={GITHUB_TINT[appearance]} style={GITHUB_THEME[appearance]}
        className="h-full w-full bg-background text-detail text-foreground select-text">
        <div ref={ref} className="relative flex h-full min-h-0 w-full flex-col">
          {keychain && !props.token && !props.github
            ? <PasswordsKeychain compact={width < 640} auth={auth} tailscale={tailscale} protects="the GitHub sign-in this block reads your repositories with">{app}</PasswordsKeychain>
            : app}
        </div>
      </WorkbenchTheme>
    </BLProvider>
  );
}

type AppProps = Omit<GithubCloneProps, 'keychain' | 'auth' | 'tailscale'> & { width: number; dark: boolean };

/** Picks the source: live with a token (the chosen repository), the sample without one or when chosen. */
function GithubApp({ width, dark, repo: initialRepo, token, github, ...initial }: AppProps) {
  const keychain = useKeychainSignIn('github');
  const liveToken = token ?? keychain?.token;
  const gh = useMemo(() => github ?? (liveToken ? githubClient(liveToken) : null), [github, liveToken]);
  const [repo, setRepo] = useState(initialRepo ?? DEFAULT_REPO);
  const [sample, setSample] = useState(false);
  const [picking, setPicking] = useState(false);
  const source: RepoSource = useMemo(() => (gh && !sample ? githubRepo(gh, repo) : SAMPLE_SOURCE), [gh, sample, repo]);
  // The initial screen (a PR, a path) belongs to the first repository shown; another one opens on its Code tab.
  const first = useRef(source.id);
  const ui: Layout = { phone: width < 640, wide: width >= 1012, dark };
  return (
    <>
      <RepoScreens key={source.id} ui={ui} width={width} source={source} keychain={keychain} openPicker={() => setPicking(true)}
        {...(source.id === first.current ? initial : {})} />
      <RepoPicker open={picking} onClose={() => setPicking(false)} compact={ui.phone} keychain={keychain} gh={gh} current={source}
        onPick={(full) => { setPicking(false); if (full) { setRepo(full); setSample(false); } else setSample(true); }} />
    </>
  );
}

function RepoScreens({ ui, width, source, keychain, openPicker, initialTab, initialPullRequest, initialPath = '', initialPullRequestTab }: {
  ui: Layout; width: number; source: RepoSource; keychain: ReturnType<typeof useKeychainSignIn>; openPicker: () => void;
} & Pick<GithubCloneProps, 'initialTab' | 'initialPullRequest' | 'initialPath' | 'initialPullRequestTab'>) {
  const [tab, setTab] = useState<GithubTab>(initialTab ?? (initialPullRequest ? 'pulls' : 'code'));
  const [path, setPath] = useState(initialPath);
  const [pr, setPr] = useState<number | null>(initialPullRequest ?? null);
  const [issue, setIssue] = useState<number | null>(null);
  const [ref, setRef] = useState('');
  const [cloneOpen, setCloneOpen] = useState(false);
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [labelFilter, setLabelFilter] = useState<string[]>([]);
  const repo = useLoad(source.id + ':repo', source.repo);
  const viewer = useLoad(source.id + ':viewer', source.viewer);
  const name = repo.data?.name ?? source.full.split('/')[1];

  const nav: Nav = {
    openPath: (p: string) => { setTab('code'); setPath(p); },
    openPr: (n: number | null) => { setTab('pulls'); setPr(n); },
    openIssue: (n: number | null) => { setTab('issues'); setIssue(n); },
    clone: () => setCloneOpen(true),
    labels: () => setLabelsOpen(true),
  };
  const state = { source, keychain, openPicker, repo: repo.data, viewer: viewer.data, ref, setRef };
  const page = repo.data ? (
    <RepoPage ui={ui} tab={tab} onTab={setTab} path={ui.phone ? '' : path} pr={ui.phone ? null : pr} issue={ui.phone ? null : issue}
      nav={nav} labelFilter={labelFilter} prTab={initialPullRequestTab} />
  ) : (
    <div className="mx-auto w-full max-w-[1280px] px-4 py-6 md:px-6">
      {repo.error ? <Failed error={repo.error} retry={repo.retry} /> : <Pending label={`Opening ${source.full}…`} />}
    </div>
  );

  /* Phone: the repo page is the root screen; each folder level, the open file, issue and PR push on top. */
  const screens: Screen[] = [
    {
      key: 'repo', title: name, content: page, hideChromeOnScroll: false,
      leading: <button type="button" aria-label="Choose repository" onClick={openPicker} className={cn(ghButton(), 'ml-2 w-8 px-0')}><Oct name="menu" /></button>,
      trailing: viewer.data ? <Avatar c={viewer.data} src={viewer.data.avatar} size={28} className="mr-2.5" /> : undefined,
    },
    ...(repo.data && tab === 'code' && path
      ? path.split('/').map((_, i, parts) => {
          const p = parts.slice(0, i + 1).join('/');
          return { key: 'path:' + p, title: parts[i], content: <PathView ui={ui} path={p} nav={nav} />, hideChromeOnScroll: false };
        })
      : []),
    ...(repo.data && tab === 'pulls' && pr ? [{ key: 'pr', title: '#' + pr, content: <PullRequestView ui={ui} number={pr} nav={nav} initialTab={initialPullRequestTab} />, hideChromeOnScroll: false }] : []),
    ...(repo.data && tab === 'issues' && issue ? [{ key: 'issue', title: '#' + issue, content: <IssueView ui={ui} number={issue} nav={nav} />, hideChromeOnScroll: false }] : []),
  ];
  const pop = () => (pr && tab === 'pulls' ? setPr(null) : issue && tab === 'issues' ? setIssue(null) : setPath(path.split('/').slice(0, -1).join('/')));

  return (
    <RepoProvider value={state}>
      {ui.phone ? (
        <NavigationStack screens={screens} onPop={pop} />
      ) : (
        <>
          <GlobalHeader ui={ui} width={width} />
          <div className="bl-scroll min-h-0 flex-1 overflow-y-auto">{page}</div>
        </>
      )}
      {repo.data ? (
        <>
          <CloneDialog open={cloneOpen} onClose={() => setCloneOpen(false)} compact={ui.phone} />
          <LabelFilter open={labelsOpen} onClose={() => setLabelsOpen(false)} compact={ui.phone} value={labelFilter} onChange={setLabelFilter} />
        </>
      ) : null}
    </RepoProvider>
  );
}

/** Repo header + tabs; each tab shows its screen (on wide layouts the open folder / file / issue / PR shows in place). */
function RepoPage({ ui, tab, onTab, path, pr, issue, nav, labelFilter, prTab }: {
  ui: Layout; tab: GithubTab; onTab: (t: GithubTab) => void; path: string; pr: number | null; issue: number | null; nav: Nav; labelFilter: string[]; prTab?: PullRequestTab;
}) {
  const { source } = useRepo();
  const counts = useLoad(source.id + ':counts', source.counts).data;
  return (
    <TabView placement="top" selectedKey={tab} onSelectionChange={(k) => { onTab(k as GithubTab); if (k === 'pulls') nav.openPr(null); if (k === 'issues') nav.openIssue(null); }}>
      <div className="border-b border-border">
        <RepoHeader ui={ui} />
        <TabViewBar variant="plain" className="mt-2 overflow-x-auto px-2 [scrollbar-width:none] md:px-4">
          <TabViewList aria-label="Repository" className="flex gap-1">
            <UnderlineTab id="code" icon="code" label="Code" />
            <UnderlineTab id="issues" icon="issue" label="Issues" count={counts?.issues.open} />
            <UnderlineTab id="pulls" icon="pr" label="Pull requests" count={counts?.pulls.open} />
            <UnderlineTab id="actions" icon="play" label="Actions" />
            {!ui.phone ? <UnderlineTab id="insights" icon="pulse" label="Insights" /> : null}
            {!ui.phone ? <UnderlineTab id="settings" icon="gear" label="Settings" /> : null}
          </TabViewList>
        </TabViewBar>
      </div>
      <TabViewPanels className="mx-auto w-full max-w-[1280px] px-4 py-6 md:px-6">
        <FlowPanel id="code">{path ? <PathView ui={ui} path={path} nav={nav} /> : <CodeHome ui={ui} nav={nav} />}</FlowPanel>
        <FlowPanel id="issues">{issue ? <IssueView ui={ui} number={issue} nav={nav} /> : <IssueList ui={ui} nav={nav} labelFilter={labelFilter} />}</FlowPanel>
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
      <h3 className="mt-3 mb-1 text-title font-semibold">{title}</h3>
      <p className="m-0 text-muted-foreground">{text}</p>
    </Box>
  );
}

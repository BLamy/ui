/* GitHub clone: a repository (Code, Issues, Pull requests, Actions, Insights, Settings) and what you do in one: browse
   and edit files, read history and blame, branch, compare, open and review pull requests, merge them, run the issue
   tracker, drive workflows, cut releases, change settings.
   Wide: GitHub's desktop layout. Phone: a NavigationStack pushes each screen, and nothing the desktop does is missing.

   Our UI over GitHub's data: signed in with GitHub in the Passwords keychain (the same passkey vault the Passwords block
   and the docs' "Load from Keychain" use, see ../apple-passwords/keychain.tsx), the block reads and writes the repository
   you pick straight on api.github.com, opening on your most recently pushed one (or `repo`). Without a token it runs the
   invented acme/orbit on a small GitHub in the page (sample-server.ts): every workflow works, and nothing you do leaves the page.
   `token` or `github` bypass the keychain; `keychain={false}` keeps it out entirely. */
import { Component, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { NavigationStack, type Screen as StackScreen } from '@/components/ui/navigation-stack';
import { TabView, TabViewBar, TabViewList, TabViewPanels } from '@/components/ui/tab-view';
import { Toaster, createToastQueue } from '@/components/ui/toast';
import { WorkbenchTheme } from '@/components/ui/workbench-theme';
import { useContainerWidth } from '@/lib/container';
import type { Tailscale } from '@/lib/tailscale';
import { BLProvider, useAppearance } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { PasswordsKeychain, useKeychainSignIn, type DeviceAuth } from '../apple-passwords/page';
import { githubClient, githubRepo, recentRepos, type GitHub } from './github-api';
import { FlowPanel, Oct, UnderlineTab, ghButton, GITHUB_THEME, GITHUB_TINT, type Layout } from './parts';
import { RepoProvider, useLoad, useRepo, Failed, Pending, type Nav } from './repo-context';
import { chainOf, fromPath, parseGitHubUrl, tabOf, toPath, type PullTab, type RepoTab, type Route } from './route';
import { SAMPLE_REPO, sampleGitHub } from './sample';
import { ActionsView, RunPage } from './actions-tab';
import { AppMenu, type AppView } from './account';
import { CodeHome, PathView } from './code-tab';
import { CommitPage, CommitsPage } from './commits';
import { ComparePage } from './compare';
import { CloneDialog, GoToFile, RepoPicker, SearchDialog } from './dialogs';
import { DeleteFile, EditFile, NewFile, UploadFiles } from './file-edit';
import { InsightsTab } from './insights-tab';
import { IssueList, IssueView, NewIssue } from './issues-tab';
import { LabelsPage, MilestonePage, MilestonesPage } from './labels';
import { PeoplePage } from './people';
import { PullRequestView } from './pull-request';
import { PullList } from './pulls-tab';
import { BranchesPage, TagsPage } from './refs';
import { ReleasePage, ReleaseForm, ReleasesPage } from './releases';
import { GlobalHeader, RepoHeader } from './repo-header';
import { SettingsTab } from './settings-tab';

export type GithubTab = RepoTab;
export type PullRequestTab = PullTab;

export interface GithubCloneProps {
  /** Repository tab to open on. Defaults to Code. */
  initialTab?: GithubTab;
  /** Open this pull request's detail view (e.g. 488) — implies the Pull requests tab. */
  initialPullRequest?: number;
  /** Open a file or folder in the Code tab (e.g. 'src/queue.ts'). */
  initialPath?: string;
  /** The pull request's sub-tab to open on (with `initialPullRequest`), e.g. 'files' for Files changed. */
  initialPullRequestTab?: PullTab;
  /** Open this screen: a path after owner/name on github.com ('issues/12', 'blob/main/README.md'). */
  initialRoute?: string;
  /** The repository (owner/name) to show. Default: your most recently pushed one, or the sample without a token. */
  repo?: string;
  /** A GitHub token to use instead of the keychain's (never hardcode one). */
  token?: string;
  /** A GitHub client to use (createGitHub({ token, fetch })): tests and stories pass one with a stand-in fetch. */
  github?: GitHub;
  /** With `github`: it's a stand-in, so say "sample" rather than posting "to GitHub". Default false. */
  sample?: boolean;
  /** Read the GitHub sign-in from the Passwords keychain (default true). False: sample data unless `token`/`github`. */
  keychain?: boolean;
  /** Runs the keychain's device sign-in (default the real one; `createDemoDeviceAuth()` fakes it). */
  auth?: DeviceAuth;
  /** The Tailscale controller the sign-in may use (default the Safari block's node); false: always the CORS proxy. */
  tailscale?: Tailscale | false;
  /** Keep the screen in the URL's hash (#/owner/name/issues/12), for reload, deep links and the browser's back button. */
  syncUrl?: boolean;
}

export default function GithubClone({ keychain = true, auth, tailscale, ...props }: GithubCloneProps) {
  const appearance = useAppearance() === 'dark' ? 'dark' : 'light';
  const [ref, width] = useContainerWidth<HTMLDivElement>(1200);
  const phone = width < 640;
  const app = <GithubApp {...props} width={width} dark={appearance === 'dark'} />;
  return (
    /* The layout's data attribute sits above the theme root, so overlays portalled into it can see it too. */
    <div data-phone={phone} className="group/gh h-full w-full min-h-0">
      <BLProvider tint={GITHUB_TINT[appearance]} style={GITHUB_THEME[appearance]} className="min-h-0 bg-background">
        <WorkbenchTheme appearance={appearance} tint={GITHUB_TINT[appearance]} style={GITHUB_THEME[appearance]}
          className="h-full w-full bg-background text-detail text-foreground select-text">
          <div ref={ref} className="relative flex h-full min-h-0 w-full flex-col">
            {keychain && !props.token && !props.github
              ? <PasswordsKeychain compact={phone} auth={auth} tailscale={tailscale} protects="the GitHub sign-in this block reads your repositories with">{app}</PasswordsKeychain>
              : app}
          </div>
        </WorkbenchTheme>
      </BLProvider>
    </div>
  );
}

type AppProps = Omit<GithubCloneProps, 'keychain' | 'auth' | 'tailscale'> & { width: number; dark: boolean };

/** Which repository was open last, per account, so you come back to it. */
const LAST_REPO = 'github-clone:last-repo';
const readLast = (account?: string) => { try { return localStorage.getItem(`${LAST_REPO}:${account}`); } catch { return null; } };
const writeLast = (account: string | undefined, full: string) => { try { localStorage.setItem(`${LAST_REPO}:${account}`, full); } catch { /* Private mode. */ } };

const initialRouteOf = ({ initialRoute, initialPullRequest, initialPullRequestTab, initialPath, initialTab }: AppProps): Route => {
  if (initialRoute) { const r = fromPath(initialRoute); if (r) return r; }
  if (initialPullRequest) return { s: 'pull', n: initialPullRequest, tab: initialPullRequestTab };
  if (initialPath) return { s: 'code', path: initialPath };
  switch (initialTab) {
    case 'issues': return { s: 'issues' };
    case 'pulls': return { s: 'pulls' };
    case 'actions': return { s: 'actions' };
    case 'insights': return { s: 'insights' };
    case 'settings': return { s: 'settings' };
    default: return { s: 'code' };
  }
};

/** Picks the source: live with a token, the sample without one or when chosen. */
function GithubApp({ width, dark, repo: initialRepo, token, github, sample: asSample, syncUrl, ...rest }: AppProps) {
  const keychain = useKeychainSignIn('github');
  const liveToken = token ?? keychain?.token;
  const liveClient = useMemo(() => github ?? (liveToken ? githubClient(liveToken) : null), [github, liveToken]);
  const account = keychain?.account;
  const fromHash = useMemo(() => (syncUrl ? parseHash() : null), [syncUrl]);
  const [chosen, setChosen] = useState<string | null>(fromHash?.full ?? initialRepo ?? null);
  const [useSample, setUseSample] = useState(false);
  const [picking, setPicking] = useState(false);
  const gh = liveClient && !useSample ? liveClient : sampleGitHub();
  const isLive = !!liveClient && !useSample && !asSample;
  // Signed in with no repository named: the last one you had open, else your most recently pushed.
  const recent = useLoad<string | null>(`first-repo:${liveClient?.id}:${chosen ?? ''}`, async () => {
    if (!liveClient || chosen || useSample) return null;
    const last = readLast(account);
    if (last) return last;
    const list = await recentRepos(liveClient);
    return list[0]?.full ?? null;
  });
  const full = useSample ? SAMPLE_REPO : chosen ?? (liveClient ? recent.data ?? null : SAMPLE_REPO);
  const source = useMemo(() => (full ? githubRepo(gh, full, { live: isLive }) : null), [gh, full, isLive]);
  /* The screen to open a repository on: the one asked for at the start, then whatever each switch asks for. */
  const began = useRef(false);
  const startRoute = useRef<Route | null>(null);
  if (source && !began.current) {
    began.current = true;
    startRoute.current = fromHash?.route ?? initialRouteOf({ ...rest, width, dark });
  }
  /** The open repository's navigation: a link into the repository you're already in just goes there. */
  const navRef = useRef<Nav | null>(null);
  /** Where you are now, and the repositories you came through, so Back crosses a switch. */
  const routeRef = useRef<Route>({ s: 'code' });
  const trail = useRef<{ full: string; route: Route }[]>([]);
  const openRepo = useCallback((next: string, route?: Route | null, o?: { fromHistory?: boolean }) => {
    if (next.toLowerCase() === full?.toLowerCase() && !useSample) {
      if (route) navRef.current?.go(route, o?.fromHistory ? { replace: true } : undefined);
      return;
    }
    if (full && !o?.fromHistory) {
      trail.current.push({ full, route: routeRef.current });
      // A new history entry, so the browser's back returns here. The new screen fills in its exact address when it mounts.
      if (syncUrl) history.pushState(null, '', `#/${next}`);
    }
    startRoute.current = route ?? null;
    setUseSample(false);
    setChosen(next);
    if (liveClient) writeLast(account, next);
  }, [account, liveClient, full, useSample, syncUrl]);
  const ui: Layout = { phone: width < 640, wide: width >= 1012, dark };
  const [toastQueue] = useState(() => createToastQueue());
  const picker = source ? (
    <RepoPicker open={picking} onClose={() => setPicking(false)} compact={ui.phone} keychain={keychain} gh={liveClient ?? gh} current={source}
      onPick={(next, route) => {
        setPicking(false);
        if (next) openRepo(next, route);
        else { startRoute.current = null; setUseSample(true); setChosen(null); }
      }} />
  ) : null;
  if (!source) {
    if (recent.error) return <div className="m-auto w-full max-w-[600px] p-6"><Failed error={recent.error} retry={recent.retry} /></div>;
    if (recent.loading) return <div className="m-auto w-full max-w-[600px] p-6"><Pending label="Finding your repositories…" /></div>;
    return (
      <div className="m-auto max-w-[480px] p-6 text-center">
        <Oct name="book" size={24} className="text-muted-foreground" />
        <h2 className="mt-3 mb-1 text-title font-semibold">No repositories yet</h2>
        <p className="mt-0 mb-4 text-muted-foreground">This account doesn’t have any repositories. Open any public one by name, or look around the sample.</p>
        <div className="flex justify-center gap-2">
          <Button className={ghButton()} onPress={() => setUseSample(true)}>Open the sample</Button>
        </div>
      </div>
    );
  }
  const start = startRoute.current ?? { s: 'code' as const };
  return (
    <>
      <RepoScreens key={source.id} ui={ui} width={width} source={source} keychain={keychain} openPicker={() => setPicking(true)} gh={gh} start={start} openRepo={openRepo} navRef={navRef} routeRef={routeRef} backAcross={() => { const last = trail.current.pop(); if (last) openRepo(last.full, last.route, { fromHistory: true }); return !!last; }} syncUrl={syncUrl} toast={(m) => toastQueue.show({ variant: 'hud', title: m })} />
      {picker}
      <Toaster queue={toastQueue} inline placement="bottom" />
    </>
  );
}

function parseHash(): { full: string; route: Route | null } | null {
  if (typeof location === 'undefined') return null;
  const m = /^#\/([\w.-]+\/[\w.-]+)(?:\/(.*))?$/.exec(location.hash);
  if (!m) return null;
  const rest = m[2] ?? '';
  return { full: m[1], route: fromPath(rest) ?? { s: 'elsewhere', path: rest } };
}

function RepoScreens({ ui, width, source, keychain, openPicker, gh, start, openRepo, navRef, routeRef, backAcross, syncUrl, toast }: {
  ui: Layout; width: number; source: ReturnType<typeof githubRepo>; keychain: ReturnType<typeof useKeychainSignIn>; openPicker: () => void; gh: GitHub; start: Route; openRepo: (full: string, r?: Route | null, o?: { fromHistory?: boolean }) => void; navRef: { current: Nav | null }; routeRef: { current: Route }; backAcross: () => boolean; syncUrl?: boolean; toast: (m: string) => void;
}) {
  const [route, setRoute] = useState<Route>(start);
  const stack = useRef<Route[]>([]);
  const [cloneOpen, setCloneOpen] = useState(false);
  const [fileOpen, setFileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState<{ q?: string } | null>(null);
  const [appView, setAppView] = useState<AppView | null>(null);
  const repo = useLoad(source.id + ':repo', source.repo);
  const viewer = useLoad(source.id + ':viewer', source.viewer);
  const branch = repo.data?.branch ?? 'main';
  const name = repo.data?.name ?? source.full.split('/')[1];
  const refNames = repo.data?.branches ?? [];

  const hashOf = useCallback((r: Route) => `#/${source.full}${toPath(r, branch) ? '/' + toPath(r, branch) : ''}`, [source.full, branch]);
  const scroller = useRef<HTMLDivElement>(null);
  const nav: Nav = useMemo(() => ({
    go(r, o) {
      setRoute((current) => {
        if (!o?.replace) stack.current.push(current);
        if (syncUrl) {
          if (o?.replace) history.replaceState(null, '', hashOf(r));
          else history.pushState(null, '', hashOf(r));
        }
        return r;
      });
      if (!o?.replace) scroller.current?.scrollTo?.({ top: 0 });
    },
    back() {
      if (stack.current.length) {
        if (syncUrl) history.back(); // popstate pops the stack.
        else setRoute(stack.current.pop()!);
        return;
      }
      // Nothing in this repository to go back to: the one before a switch, else this screen's parent. Never out of the block.
      if (backAcross()) return;
      setRoute((current) => {
        const parent = chainOf(current).at(-2) ?? { s: 'code' as const };
        if (syncUrl) history.replaceState(null, '', hashOf(parent));
        return parent;
      });
    },
    url: (r) => `https://github.com/${source.full}${toPath(r, branch) ? '/' + toPath(r, branch) : ''}`,
    isInternal: (href) => !!parseGitHubUrl(href, refNames)?.route,
    open(href) {
      const hit = parseGitHubUrl(href, refNames);
      if (hit?.route) {
        if (hit.full.toLowerCase() === source.full.toLowerCase()) nav.go(hit.route);
        else openRepo(hit.full, hit.route);
      } else if (typeof window !== 'undefined') window.open(href, '_blank', 'noopener');
    },
    openRepo: (full, r) => openRepo(full, r),
    clone: () => setCloneOpen(true),
    search: (q) => setSearchOpen({ q }),
    goToFile: () => setFileOpen(true),
  }), [source.full, branch, refNames.join(), syncUrl, hashOf, openRepo]);

  navRef.current = nav;
  routeRef.current = route;

  /* Moving to another screen moves focus to its heading and says where you are: without this, a link click leaves focus on
     nothing and a screen reader silent. Changing a filter or page stays put, since you're still working there. */
  const rootRef = useRef<HTMLDivElement>(null);
  const screenOf = (r: Route) => toPath(r).split(/[?#]/)[0];
  const shownScreen = useRef(screenOf(route));
  useEffect(() => {
    const screen = screenOf(route);
    if (screen === shownScreen.current) return;
    shownScreen.current = screen;
    let tries = 0;
    const find = () => {
      const heading = [...(rootRef.current?.querySelectorAll<HTMLElement>('h1') ?? [])].filter((h) => !h.closest('[inert]')).at(-1);
      if (heading) {
        heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
      } else if (tries++ < 20) setTimeout(find, 50);
      else scroller.current?.focus({ preventScroll: true });
    };
    // A form on the new screen may have claimed focus on purpose (autoFocus): leave it.
    // Likewise arrowing along the tabs: focus stays on the tab, or the next arrow goes nowhere.
    setTimeout(() => { if (!document.activeElement?.closest('input,textarea,select,[role="tablist"]')) find(); }, 30);
  }, [route]);

  // The browser's back and forward, and hand-edited hashes.
  useEffect(() => {
    if (!syncUrl) return;
    history.replaceState(null, '', hashOf(route));
    const onPop = () => {
      const hit = parseHash();
      if (!hit) return;
      if (hit.full.toLowerCase() !== source.full.toLowerCase()) { openRepo(hit.full, hit.route, { fromHistory: true }); return; }
      stack.current.pop();
      setRoute(hit.route ?? { s: 'code' });
    };
    addEventListener('popstate', onPop);
    return () => removeEventListener('popstate', onPop);
  }, [syncUrl, source.full]);

  // Coming back to the tab, ask GitHub again: someone may have merged in the meantime.
  useEffect(() => {
    if (!source.live) return;
    let last = Date.now();
    const onFocus = () => {
      if (document.hidden || Date.now() - last < 60_000) return;
      last = Date.now();
      source.refresh();
    };
    addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => { removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onFocus); };
  }, [source]);

  // `/` searches and `t` finds a file, anywhere but in a text box, as on GitHub.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey || t?.closest('input,textarea,select,[contenteditable="true"],[role="dialog"]')) return;
      if (e.key === '/' && repo.data) { e.preventDefault(); setSearchOpen({}); }
      if (e.key === 't' && repo.data) { e.preventDefault(); setFileOpen(true); }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [repo.data]);

  const gitRef = route.s === 'code' || route.s === 'commits' || route.s === 'edit' || route.s === 'new-file' ? route.ref ?? '' : '';
  const state = {
    source, keychain, openPicker, repo: repo.data, viewer: viewer.data, ref: gitRef, nav, ui, gh, notify: toast, openApp: (v?: AppView) => setAppView(v ?? 'menu'),
  };
  const failed = (
    <div className="mx-auto w-full max-w-[1280px] px-4 py-6 md:px-6">
      {repo.error ? <Failed error={repo.error} retry={repo.retry} /> : <Pending label={`Opening ${source.full}…`} />}
    </div>
  );
  const chain = chainOf(route);
  const tab = tabOf(route);

  /* Phone: the tab's list is the root screen; everything else pushes on top. */
  const screens: StackScreen[] = repo.data ? chain.map((r, i): StackScreen => (i === 0 ? {
    key: 'repo', title: name, content: <RepoPage route={r} tab={tab} />, hideChromeOnScroll: false, onRefresh: async () => source.refresh(),
    leading: <Button aria-label="Open menu" onPress={() => setAppView('menu')} className={cn(ghButton(), 'ml-2 px-0')}><Oct name="menu" /></Button>,
    trailing: (
      <div className="mr-2 flex items-center gap-1">
        <Button aria-label="Search" className={cn(ghButton(), 'bg-transparent px-0')} onPress={() => setSearchOpen({})}><Oct name="search" /></Button>
        {viewer.data ? <Button aria-label={`Account: ${viewer.data.login}`} onPress={() => setAppView('menu')} className="grid size-11 cursor-pointer place-items-center rounded-full border-0 bg-transparent p-0"><Avatar c={viewer.data} src={viewer.data.avatar} size={28} /></Button> : null}
      </div>
    ),
  } : {
    key: `${r.s}:${i}`, title: titleOf(r), content: <ScreenFor route={r} />, hideChromeOnScroll: false, onRefresh: async () => source.refresh(),
    trailing: <Button aria-label="Search" className={cn(ghButton(), 'mr-2 bg-transparent px-0')} onPress={() => setSearchOpen({})}><Oct name="search" /></Button>,
  })) : [{ key: 'repo', title: name, content: failed, hideChromeOnScroll: false, leading: <Button aria-label="Choose repository" onPress={openPicker} className={cn(ghButton(), 'ml-2 px-0')}><Oct name="menu" /></Button> }];

  return (
    <RepoProvider value={state}>
      <div ref={rootRef} className="contents">
      <div role="status" aria-live="polite" className="sr-only">{titleOf(route)}</div>
      {ui.phone ? (
        <>
          {!source.live ? <SampleNotice /> : null}
          <RefreshNote load={repo} />
          <div className="relative min-h-0 flex-1"><NavigationStack screens={screens} onPop={() => nav.go(chain.at(-2) ?? { s: 'code' }, { replace: true })} /></div>
        </>
      ) : (
        <>
          <GlobalHeader width={width} />
          {!source.live ? <SampleNotice /> : null}
          <RefreshNote load={repo} />
          <main ref={scroller} tabIndex={-1} className="bl-scroll min-h-0 flex-1 overflow-y-auto outline-none">{repo.data ? <RepoPage route={route} tab={tab} /> : failed}</main>
        </>
      )}
      </div>
      {repo.data ? (
        <>
          <CloneDialog open={cloneOpen} onClose={() => setCloneOpen(false)} compact={ui.phone} />
          <GoToFile open={fileOpen} onClose={() => setFileOpen(false)} gitRef={gitRef} compact={ui.phone} />
          <SearchDialog open={!!searchOpen} initial={searchOpen?.q} onClose={() => setSearchOpen(null)} compact={ui.phone} />
        </>
      ) : null}
      <AppMenu view={appView} onView={setAppView} onClose={() => setAppView(null)} compact={ui.phone} gh={gh} viewer={viewer.data} keychain={keychain} live={source.live} onOpen={openRepo} openPicker={openPicker} />
    </RepoProvider>
  );
}

/** The repository itself couldn't be re-read: everything under it may be behind, so say it once, at the top. */
function RefreshNote({ load }: { load: { staleError?: unknown; retry: () => void } }) {
  if (!load.staleError) return null;
  return (
    <p role="status" className="m-0 flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-(--gh-attention)/10 px-4 py-1 text-caption">
      <span className="min-w-0 flex-1">Couldn’t reach GitHub, so this may be out of date: {load.staleError instanceof Error ? load.staleError.message : String(load.staleError)}</span>
      <Button className="cursor-pointer border-0 bg-transparent p-0 text-caption font-semibold text-primary outline-none data-focus-visible:ring-2 data-focus-visible:ring-primary group-data-[phone=true]/gh:min-h-11" onPress={load.retry}>Try again</Button>
    </p>
  );
}

/** Says what this is, so nobody takes the sample for real or expects it on github.com. */
function SampleNotice() {
  const { keychain } = useRepo();
  return (
    <div role="note" className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-(--gh-attention)/10 px-4 py-1 text-caption text-muted-foreground">
      <Oct name="book" size={14} />
      <span className="min-w-0 flex-1">Sample repository: invented data on a small GitHub in this page. What you do here stays here. Links to people and topics go to the real github.com, where this repository doesn’t exist.</span>
      {keychain && !keychain.token && !keychain.locked ? <Button className="cursor-pointer border-0 bg-transparent p-0 text-caption font-semibold text-primary outline-none data-hovered:underline data-focus-visible:ring-2 data-focus-visible:ring-primary group-data-[phone=true]/gh:min-h-11" onPress={keychain.signIn}>Sign in with GitHub</Button> : null}
    </div>
  );
}

function titleOf(r: Route): string {
  switch (r.s) {
    case 'code': return r.path?.split('/').at(-1) ?? 'Code';
    case 'commits': return r.path ? 'History' : 'Commits';
    case 'commit': return r.sha.slice(0, 7);
    case 'edit': return r.mode === 'edit' ? 'Edit' : 'Delete';
    case 'new-file': return 'New file';
    case 'upload': return 'Upload files';
    case 'branches': return 'Branches';
    case 'tags': return 'Tags';
    case 'releases': return 'Releases';
    case 'release': return r.tag;
    case 'new-release': return r.editing ? 'Edit release' : 'New release';
    case 'compare': return r.create ? 'New pull request' : 'Compare';
    case 'issues': return 'Issues';
    case 'issue': return '#' + r.n;
    case 'new-issue': return 'New issue';
    case 'labels': return 'Labels';
    case 'milestones': return 'Milestones';
    case 'milestone': return 'Milestone';
    case 'pulls': return 'Pull requests';
    case 'pull': return '#' + r.n;
    case 'actions': return 'Actions';
    case 'run': return 'Run';
    case 'insights': return 'Insights';
    case 'settings': return 'Settings';
    case 'people': return r.kind === 'stargazers' ? 'Stargazers' : r.kind === 'watchers' ? 'Watchers' : 'Contributors';
    case 'elsewhere': return 'Not in this example';
  }
}

/** A screen that breaks stays one broken screen: the header, the tabs and your drafts (held outside it) carry on. */
class ScreenBoundary extends Component<{ screen: string; children: ReactNode }, { error: unknown; screen: string }> {
  override state = { error: null as unknown, screen: this.props.screen };
  static getDerivedStateFromError(error: unknown) { return { error }; }
  static getDerivedStateFromProps(props: { screen: string }, state: { screen: string }) {
    return props.screen === state.screen ? null : { error: null, screen: props.screen };
  }
  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="grid place-items-center rounded-md border border-border px-6 py-12 text-center">
        <Oct name="x" size={24} className="text-muted-foreground" />
        <h1 className="mt-3 mb-1 text-title font-semibold">This screen hit a bug</h1>
        <p className="mt-0 mb-4 max-w-[480px] text-muted-foreground">It’s a problem in this example, not on GitHub. Anything you were typing is kept. {this.state.error instanceof Error ? this.state.error.message : ''}</p>
        <Button className={ghButton()} onPress={() => this.setState({ error: null })}>Try again</Button>
      </div>
    );
  }
}

/** A screen that isn't one of the tabs' roots. */
function ScreenFor({ route }: { route: Route }) {
  // Another issue, file or pull request is another screen: nothing half-typed or half-open on one may carry over to the next.
  const key = route.s === 'pull' ? `pull/${route.n}` : route.s === 'code' ? `code/${route.ref ?? ''}/${route.path ?? ''}` : toPath(route).split(/[?#]/)[0];
  return <ScreenBoundary key={key} screen={toPath(route)}><Screen route={route} /></ScreenBoundary>;
}

function Screen({ route: r }: { route: Route }) {
  const { ui } = useRepo();
  switch (r.s) {
    case 'code': return r.path ? <PathView path={r.path} gitRef={r.ref ?? ''} line={r.line} lineEnd={r.lineEnd} blame={r.blame} /> : <div className={cn(ui.phone && 'p-4')}><CodeHome gitRef={r.ref ?? ''} /></div>;
    case 'commits': return <CommitsPage gitRef={r.ref} path={r.path} author={r.author} page={r.page} />;
    case 'commit': return <CommitPage sha={r.sha} />;
    case 'edit': return r.mode === 'edit' ? <EditFile path={r.path} gitRef={r.ref} /> : <DeleteFile path={r.path} gitRef={r.ref} />;
    case 'new-file': return <NewFile gitRef={r.ref} dir={r.dir} name={r.name} content={r.content} message={r.message} />;
    case 'upload': return <UploadFiles gitRef={r.ref} dir={r.dir} />;
    case 'branches': return <BranchesPage page={r.page} />;
    case 'tags': return <TagsPage page={r.page} />;
    case 'releases': return <ReleasesPage page={r.page} />;
    case 'release': return <ReleasePage tag={r.tag} />;
    case 'new-release': return <ReleaseForm tag={r.tag} editing={r.editing} />;
    case 'compare': return <ComparePage base={r.base} head={r.head} create={r.create} />;
    case 'issues': return <div className={cn(ui.phone && 'p-4')}><IssueList q={r.q} page={r.page} /></div>;
    case 'issue': return <IssueView number={r.n} />;
    case 'new-issue': return <NewIssue title={r.title} body={r.body} />;
    case 'labels': return <LabelsPage />;
    case 'milestones': return <MilestonesPage state={r.state} />;
    case 'milestone': return <MilestonePage number={r.n} q={r.q} page={r.page} />;
    case 'pulls': return <div className={cn(ui.phone && 'p-4')}><PullList q={r.q} page={r.page} /></div>;
    case 'pull': return <PullRequestView number={r.n} tab={r.tab} commit={r.commit} />;
    case 'actions': return <div className={cn(ui.phone && 'p-4')}><ActionsView filter={r} /></div>;
    case 'run': return <RunPage id={r.id} />;
    case 'insights': return <InsightsTab page={r.page} />;
    case 'settings': return <SettingsTab page={r.page} />;
    case 'people': return <PeoplePage kind={r.kind} />;
    case 'elsewhere': return <Elsewhere path={r.path} />;
  }
}

/** A GitHub address this example has no screen for. */
function Elsewhere({ path }: { path: string }) {
  const { source } = useRepo();
  return (
    <div role="alert" className="grid place-items-center rounded-md border border-border px-6 py-12 text-center">
      <h1 className="mt-0 mb-1 text-title font-semibold">This example has no screen for that</h1>
      <p className="mt-0 mb-4 font-mono text-caption break-all text-muted-foreground">/{path}</p>
      {source.live ? <a href={`https://github.com/${source.full}/${path}`} target="_blank" rel="noreferrer" className={cn(ghButton(), 'no-underline')}>Open on GitHub<Oct name="external" size={12} /></a> : null}
    </div>
  );
}

/** Repo header + tabs; each tab shows its screen. */
function RepoPage({ route, tab }: { route: Route; tab: RepoTab }) {
  const { source, ui, repo } = useRepo();
  const nav = useRepo().nav;
  const counts = useLoad(source.id + ':counts', source.counts).data;
  const rootOf = (t: RepoTab): Route => ({ code: { s: 'code' }, issues: { s: 'issues' }, pulls: { s: 'pulls' }, actions: { s: 'actions' }, insights: { s: 'insights' }, settings: { s: 'settings' } } as const)[t];
  return (
    <TabView placement="top" selectedKey={tab} onSelectionChange={(k) => nav.go(rootOf(k as RepoTab))}>
      <div className="border-b border-border">
        <RepoHeader />
        <TabViewBar variant="plain" className="mt-2 overflow-x-auto px-2 [scrollbar-width:thin] md:px-4">
          <TabViewList aria-label="Repository" className="flex gap-1">
            <UnderlineTab id="code" icon="code" label="Code" />
            {repo.has.issues ? <UnderlineTab id="issues" icon="issue" label="Issues" count={counts?.issues.open} /> : null}
            <UnderlineTab id="pulls" icon="pr" label="Pull requests" count={counts?.pulls.open} />
            <UnderlineTab id="actions" icon="play" label="Actions" />
            <UnderlineTab id="insights" icon="pulse" label="Insights" />
            {repo.permissions.admin ? <UnderlineTab id="settings" icon="gear" label="Settings" /> : null}
          </TabViewList>
        </TabViewBar>
      </div>
      <TabViewPanels className={cn('mx-auto w-full max-w-[1280px]', !ui.phone && 'px-4 py-6 md:px-6')}>
        {(['code', 'issues', 'pulls', 'actions', 'insights', 'settings'] as RepoTab[]).map((t) => (
          <FlowPanel key={t} id={t}>{t === tab ? <ScreenFor route={route} /> : null}</FlowPanel>
        ))}
      </TabViewPanels>
    </TabView>
  );
}

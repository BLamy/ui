import type { ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { AppearanceProvider } from '@/lib/theme';
import { createDemoDeviceAuth } from '../apple-passwords/page';
import { createGitHub } from './github-api';
import GithubClone from './page';

const meta: Meta<typeof GithubClone> = {
  title: 'Blocks/GitHub clone',
  component: GithubClone,
  parameters: { layout: 'fullscreen' },
  // The sample repository unless the Passwords keychain holds a GitHub sign-in (then it's your real repositories).
  // Screenshot stories leave the keychain out so they never depend on this browser's sign-ins.
  args: { keychain: false },
};
export default meta;
/** The desk behind the device frames: a fixed backdrop, not a theme color. */
const DESK = '#e6e8eb';

type Story = StoryObj<typeof GithubClone>;

/** The block fills whatever box it's given; these stories give it the viewport or a phone-sized frame. */
function Full({ children }: { children: ReactNode }) {
  return <div className="h-screen w-full">{children}</div>;
}

export const Light: Story = { render: (args) => <Full><GithubClone {...args} /></Full> };

export const Dark: Story = {
  render: (args) => (
    <AppearanceProvider value="dark">
      <Full><GithubClone {...args} /></Full>
    </AppearanceProvider>
  ),
};

export const Phone: Story = {
  render: (args) => (
    <div className="box-border grid min-h-screen place-items-center p-4" style={{ background: DESK }}>
      <div className="h-[844px] w-[390px] overflow-hidden rounded-[24px] shadow-[0_12px_40px_black] shadow-black/18">
        <GithubClone {...args} />
      </div>
    </div>
  ),
};

export const PullRequest: Story = {
  args: { initialPullRequest: 488 },
  render: (args) => <Full><GithubClone {...args} /></Full>,
};

/** The Code tab's file viewer: SyntaxHighlighting with GitHub's gutter and Primer colors. */
export const FileView: Story = {
  args: { initialPath: 'src/queue.ts' },
  render: (args) => <Full><GithubClone {...args} /></Full>,
};

export const FileViewDark: Story = {
  args: { initialPath: 'src/queue.ts' },
  render: (args) => (
    <AppearanceProvider value="dark">
      <Full><GithubClone {...args} /></Full>
    </AppearanceProvider>
  ),
};

/** Files changed: +/- rows and gutters, syntax colors inside the lines. */
export const FilesChanged: Story = {
  args: { initialPullRequest: 488, initialPullRequestTab: 'files' },
  render: (args) => <Full><GithubClone {...args} /></Full>,
};

export const FilesChangedDark: Story = {
  args: { initialPullRequest: 488, initialPullRequestTab: 'files' },
  render: (args) => (
    <AppearanceProvider value="dark">
      <Full><GithubClone {...args} /></Full>
    </AppearanceProvider>
  ),
};

/** With the Passwords keychain: your GitHub sign-in (or Sign in with GitHub, a real device-code login) opens your
    real repositories. Nothing is shown from GitHub until you sign in or unlock. */
export const Keychain: Story = {
  args: { keychain: true },
  render: (args) => <Full><GithubClone {...args} /></Full>,
};

/** The keychain with a pretend device login: "Sign in with GitHub" approves itself (the token it saves is fake, so
    GitHub turns it down — the block then says to sign in again). */
export const KeychainDemoSignIn: Story = {
  args: { keychain: true, auth: createDemoDeviceAuth() },
  render: (args) => <Full><GithubClone {...args} /></Full>,
};

/* ── The live path offline: a GitHub client whose fetch answers from canned REST JSON ── */
const T = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
const u = (login: string) => ({ login, avatar_url: '' });
const R = '/repos/octo/hello-world';
const ISSUE = { number: 12, title: 'Greeting is not localized', state: 'open', user: u('mona'), created_at: T(30), closed_at: null, labels: [{ name: 'bug', color: 'd73a4a' }], comments: 1, assignees: [], html_url: 'https://github.com/octo/hello-world/issues/12', body: 'Every visitor gets **Hello** in English.', author_association: 'CONTRIBUTOR' };
const PULL = { number: 14, title: 'Localize the greeting', state: 'open', draft: false, merged_at: null, user: u('octo'), created_at: T(5), labels: [{ name: 'enhancement', color: 'a2eeef' }], comments: 1, head: { ref: 'i18n', sha: 'c0ffee' }, base: { ref: 'main' }, commits: 2, additions: 6, deletions: 1, changed_files: 1, html_url: 'https://github.com/octo/hello-world/pull/14', body: 'Fixes #12.', requested_reviewers: [u('mona')], mergeable_state: 'blocked', author_association: 'OWNER' };
const CANNED: Record<string, unknown> = {
  '/user': { login: 'octo', name: 'Octo Cat', avatar_url: '' },
  '/user/repos': [{ full_name: 'octo/hello-world', description: 'My first repository', private: false }, { full_name: 'octo/dotfiles', description: '', private: true }],
  [R]: { name: 'hello-world', owner: { login: 'octo' }, description: 'My first repository on GitHub (canned API answers).', homepage: 'octo.example', topics: ['hello', 'demo'], stargazers_count: 2410, forks_count: 1300, subscribers_count: 88, license: { name: 'MIT License' }, default_branch: 'main', private: false, html_url: 'https://github.com/octo/hello-world' },
  [`${R}/branches`]: [{ name: 'main' }, { name: 'i18n' }],
  [`${R}/languages`]: { TypeScript: 800, CSS: 150, HTML: 50 },
  [`${R}/contributors`]: [u('octo'), u('mona')],
  [`${R}/commits`]: [{ sha: '7fd1a60b01f91b314f59955a4e4d4e80d8edf11d', commit: { message: 'Merge pull request #6 from octo/readme', author: { name: 'Octo Cat', date: T(3) } }, author: u('octo') }],
  [`${R}/git/trees/HEAD`]: { truncated: false, tree: [
    { path: 'src', type: 'tree' }, { path: 'src/greet.ts', type: 'blob', size: 120 }, { path: 'README.md', type: 'blob', size: 60 }, { path: 'package.json', type: 'blob', size: 80 },
  ] },
  [`${R}/readme`]: '# hello-world\n\nServed by a **stand-in fetch** in the shape of GitHub’s REST API: sign in with GitHub for the real thing.\n',
  [`${R}/contents/src/greet.ts`]: "export function greet(name: string) {\n  return `Hello, ${name}!`;\n}\n",
  [`${R}/labels`]: [{ name: 'bug', color: 'd73a4a', description: "Something isn't working" }, { name: 'enhancement', color: 'a2eeef' }],
  [`${R}/issues/12`]: ISSUE,
  [`${R}/issues/14`]: { ...PULL, labels: PULL.labels, pull_request: {} },
  [`${R}/issues/12/timeline`]: [{ event: 'commented', id: 1, actor: u('octo'), created_at: T(20), body: 'Good catch — on it.', author_association: 'OWNER', html_url: '#' }],
  [`${R}/issues/14/timeline`]: [
    { event: 'committed', sha: 'aaaaaaa1', message: 'i18n: add messages', author: { name: 'Octo Cat', date: T(5) }, committer: { date: T(5) } },
    { event: 'review_requested', actor: u('octo'), created_at: T(4), requested_reviewer: u('mona') },
    { event: 'reviewed', id: 3, user: u('mona'), submitted_at: T(2), state: 'commented', body: 'Should the fallback be English?' },
  ],
  [`${R}/pulls/14`]: PULL,
  [`${R}/pulls/14/reviews`]: [{ user: u('mona'), state: 'COMMENTED' }],
  [`${R}/pulls/14/commits`]: [{ sha: 'aaaaaaa1', commit: { message: 'i18n: add messages', author: { name: 'Octo Cat', date: T(5) } }, author: u('octo') }],
  [`${R}/pulls/14/files`]: [{ filename: 'src/greet.ts', additions: 6, deletions: 1, status: 'modified', patch: "@@ -1,3 +1,8 @@\n-export function greet(name: string) {\n+const HELLO: Record<string, string> = { en: 'Hello', fr: 'Bonjour' };\n+\n+export function greet(name: string, lang = 'en') {\n+  const word = HELLO[lang] ?? HELLO.en;\n+  return `${word}, ${name}!`;\n+}\n-  return `Hello, ${name}!`;\n-}" }],
  [`${R}/commits/c0ffee/check-runs`]: { check_runs: [{ name: 'CI / test', status: 'completed', conclusion: 'success', started_at: T(1), completed_at: T(0.97) }, { name: 'CI / lint', status: 'in_progress', conclusion: null, started_at: T(0.1), completed_at: null }] },
  [`${R}/commits/c0ffee/status`]: { statuses: [] },
  [`${R}/actions/runs`]: { total_count: 2, workflow_runs: [{ id: 1, name: 'CI', display_title: 'Localize the greeting', run_number: 31, event: 'pull_request', pull_requests: [{ number: 14 }], actor: u('octo'), head_branch: 'i18n', status: 'in_progress', conclusion: null, created_at: T(0.1), run_started_at: T(0.1), updated_at: T(0.05), html_url: '#' }] },
  [`${R}/actions/workflows`]: { workflows: [{ name: 'CI', state: 'active' }] },
};
function cannedFetch(url: string, init?: RequestInit): Promise<Response> {
  const p = new URL(url);
  const path = p.pathname;
  const delay = new Promise((r) => setTimeout(r, 250));
  if (init?.method === 'POST') {
    const { body } = JSON.parse(String(init.body)) as { body: string };
    return delay.then(() => new Response(JSON.stringify({ id: Date.now(), body, user: u('octo'), created_at: new Date().toISOString(), html_url: `https://github.com${path.replace('/repos', '').replace('/comments', '')}`, author_association: 'OWNER' }), { status: 201 }));
  }
  if (path === '/search/issues') {
    const q = p.searchParams.get('q') ?? '';
    const items = q.includes('is:issue') ? (q.includes('is:open') ? [ISSUE] : []) : q.includes('is:open') ? [{ ...PULL, pull_request: { merged_at: null } }] : [];
    return delay.then(() => new Response(JSON.stringify({ total_count: items.length, items })));
  }
  const hit = CANNED[path];
  return delay.then(() => (hit === undefined ? new Response('{"message":"Not Found"}', { status: 404 })
    : new Response(typeof hit === 'string' ? hit : JSON.stringify(hit), { status: 200, headers: { 'x-ratelimit-limit': '5000', 'x-ratelimit-remaining': '4987', 'x-ratelimit-reset': String(Math.round(Date.now() / 1000) + 3600) } })));
}

/** The live data path without a network: GitHub-shaped answers from a stand-in fetch (a quarter-second each, to show
    the loading states). Comments "post" to the stand-in. */
export const LiveStandIn: Story = {
  args: { github: createGitHub({ token: 'not-a-real-token', fetch: cannedFetch }), repo: 'octo/hello-world' },
  render: (args) => <Full><GithubClone {...args} /></Full>,
};

export const LiveStandInPhone: Story = {
  args: { github: createGitHub({ token: 'not-a-real-token', fetch: cannedFetch }), repo: 'octo/hello-world' },
  render: (args) => (
    <div className="box-border grid min-h-screen place-items-center p-4" style={{ background: DESK }}>
      <div className="h-[844px] w-[390px] overflow-hidden rounded-[24px] shadow-[0_12px_40px_black] shadow-black/18">
        <GithubClone {...args} />
      </div>
    </div>
  ),
};

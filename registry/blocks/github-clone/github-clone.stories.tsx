import type { ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { AppearanceProvider } from '@/lib/theme';
import { createDemoDeviceAuth } from '../apple-passwords/page';
import GithubClone from './page';
import { createSampleGitHub } from './sample';

const meta: Meta<typeof GithubClone> = {
  title: 'Blocks/GitHub clone',
  component: GithubClone,
  parameters: { layout: 'fullscreen' },
  // The sample repository unless the Passwords keychain holds a GitHub sign-in (then it's your real repositories).
  // Screenshot stories leave the keychain out so they never depend on this browser's sign-ins.
  args: { keychain: false, syncUrl: true },
};
export default meta;
/** The desk behind the device frames: a fixed backdrop, not a theme color. */
const DESK = '#e6e8eb';

type Story = StoryObj<typeof GithubClone>;

/** The block fills whatever box it's given; these stories give it the viewport or a phone-sized frame. */
function Full({ children }: { children: ReactNode }) {
  return <div className="h-screen w-full">{children}</div>;
}

function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="box-border grid min-h-screen place-items-center p-4" style={{ background: DESK }}>
      <div className="h-[844px] w-[390px] overflow-hidden rounded-[24px] shadow-[0_12px_40px_black] shadow-black/18">{children}</div>
    </div>
  );
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
  render: (args) => <PhoneFrame><GithubClone {...args} /></PhoneFrame>,
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

/* ── The other kinds of repository, on the same small GitHub the sample runs on ── */

/** The live path without a network: a quarter-second per request, to show the loading states. */
export const LiveStandIn: Story = {
  args: { github: createSampleGitHub({ latency: 250 }).gh, repo: 'octo/hello-world', syncUrl: true },
  render: (args) => <Full><GithubClone {...args} /></Full>,
};

export const LiveStandInPhone: Story = {
  args: { github: createSampleGitHub({ latency: 250 }).gh, repo: 'octo/hello-world' },
  render: (args) => <PhoneFrame><GithubClone {...args} /></PhoneFrame>,
};

/** A repository you can only read: no merge, no labels menu, no Settings; Fork and comment still work. */
export const ReadOnly: Story = {
  args: { github: createSampleGitHub({ role: 'read' }).gh, sample: true, repo: 'acme/orbit', initialPullRequest: 488 },
  render: (args) => <Full><GithubClone {...args} /></Full>,
};

/** Triage: labels and assignees but no merge. */
export const Triage: Story = {
  args: { github: createSampleGitHub({ role: 'triage' }).gh, sample: true, repo: 'acme/orbit', initialRoute: 'issues/489' },
  render: (args) => <Full><GithubClone {...args} /></Full>,
};

export const Archived: Story = {
  args: { github: createSampleGitHub().gh, sample: true, repo: 'acme/orbit-legacy', initialRoute: 'issues/1' },
  render: (args) => <Full><GithubClone {...args} /></Full>,
};

export const EmptyRepository: Story = {
  args: { github: createSampleGitHub().gh, sample: true, repo: 'you/new-idea' },
  render: (args) => <Full><GithubClone {...args} /></Full>,
};

export const SignedOut: Story = {
  args: { github: createSampleGitHub({ viewer: null }).gh, sample: true, repo: 'octo/hello-world', initialRoute: 'issues/12' },
  render: (args) => <Full><GithubClone {...args} /></Full>,
};

export const NotFound: Story = {
  args: { github: createSampleGitHub().gh, sample: true, repo: 'nobody/nothing' },
  render: (args) => <Full><GithubClone {...args} /></Full>,
};

/** GitHub says no: every write in this one comes back 403, and reads run out of rate limit if you keep going. */
const refused = createSampleGitHub();
refused.server.refuseWrites('Resource not accessible by integration');
// Tests change the world behind the page's back through this (someone else pushing, a token being revoked).
(globalThis as { __githubCloneServer?: unknown }).__githubCloneServer = refused.server;
export const WritesRefused: Story = {
  args: { github: refused.gh, sample: true, repo: 'acme/orbit', initialRoute: 'issues/489' },
  render: (args) => <Full><GithubClone {...args} /></Full>,
};

/** Someone else's commit lands while you edit: tests reach the server to make it happen. */
const shared = createSampleGitHub();
(globalThis as { __githubSharedServer?: unknown }).__githubSharedServer = shared.server;
export const SharedRepository: Story = {
  args: { github: shared.gh, sample: true, repo: 'acme/orbit', syncUrl: true },
  render: (args) => <Full><GithubClone {...args} /></Full>,
};

const limited = createSampleGitHub();
limited.server.fail(/GET \/repos\/acme\/orbit$/, 403, 'API rate limit exceeded', { 'x-ratelimit-remaining': '0' });
export const RateLimited: Story = {
  args: { github: limited.gh, sample: true, repo: 'acme/orbit' },
  render: (args) => <Full><GithubClone {...args} /></Full>,
};

export const IssuesList: Story = { args: { initialTab: 'issues' }, render: (args) => <Full><GithubClone {...args} /></Full> };
export const PullsList: Story = { args: { initialTab: 'pulls' }, render: (args) => <Full><GithubClone {...args} /></Full> };
export const Actions: Story = { args: { initialTab: 'actions' }, render: (args) => <Full><GithubClone {...args} /></Full> };
export const Insights: Story = { args: { initialTab: 'insights' }, render: (args) => <Full><GithubClone {...args} /></Full> };
export const Settings: Story = { args: { initialTab: 'settings' }, render: (args) => <Full><GithubClone {...args} /></Full> };
export const CommitHistory: Story = { args: { initialRoute: 'commits/main' }, render: (args) => <Full><GithubClone {...args} /></Full> };
export const Blame: Story = { args: { initialRoute: 'blame/main/src/retry.ts' }, render: (args) => <Full><GithubClone {...args} /></Full> };
export const CompareBranches: Story = { args: { initialRoute: 'compare/main...feat%2Fretry-jitter' }, render: (args) => <Full><GithubClone {...args} /></Full> };
export const IssueOnPhone: Story = { args: { initialRoute: 'issues/489' }, render: (args) => <PhoneFrame><GithubClone {...args} /></PhoneFrame> };
export const PullOnPhone: Story = { args: { initialPullRequest: 488 }, render: (args) => <PhoneFrame><GithubClone {...args} /></PhoneFrame> };

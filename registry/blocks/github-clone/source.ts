/* Where a screen's data comes from. Every screen asks a RepoSource — the repository's metadata, a tree, a file, the
   issue and pull request lists, a conversation, a diff, workflow runs — and draws whatever comes back the same way.
   Two implement it: SAMPLE_SOURCE, the invented acme/orbit in data.ts (answers synchronously, so the stories,
   screenshots and tests render in one pass, offline), and githubRepo() in github-api.ts, the real GitHub REST API with
   a token from the Passwords keychain (answers with promises, cached per session). `ref` is a branch name, or '' for
   the default branch. */
import {
  ISSUES, ISSUE_COUNTS, LABELS, ME, PR_CHECKS, PR_COMMITS, PR_COUNTS, PR_FILES, PR_TIMELINE, PULLS, REPO, RUNS, TREE, USERS, WORKFLOWS, README_MD,
  findNode,
  type Check, type Commit, type DiffFile, type FileNode, type Issue, type IssueDetail, type Label, type LastCommit, type PullDetail,
  type PullRequest, type Repo, type TimelineItem, type User, type WorkflowRun,
} from './data';

export type Maybe<T> = T | Promise<T>;

export interface Counts {
  issues: { open: number; closed: number };
  pulls: { open: number; closed: number };
}

export interface Runs {
  /** All runs in the repository (the list holds the latest page). */
  total: number;
  workflows: string[];
  runs: WorkflowRun[];
}

export interface RepoSource {
  /** Distinguishes cached loads: 'sample', or 'live:owner/name'. */
  id: string;
  /** Real GitHub data (and real writes). */
  live: boolean;
  /** owner/name */
  full: string;
  /** Who is signed in (the composer's and header's avatar). */
  viewer: () => Maybe<User>;
  repo: () => Maybe<Repo>;
  counts: () => Maybe<Counts>;
  labels: () => Maybe<Label[]>;
  tree: (ref: string) => Maybe<FileNode[]>;
  /** The README's Markdown, or null when there is none. */
  readme: (ref: string) => Maybe<string | null>;
  /** A file's text, or null when it is binary. */
  file: (path: string, ref: string) => Maybe<string | null>;
  /** The last commit touching a path ('' for the whole repository). */
  lastCommit: (path: string, ref: string) => Maybe<LastCommit | null>;
  issues: (state: 'open' | 'closed') => Maybe<Issue[]>;
  issue: (n: number) => Maybe<IssueDetail>;
  pulls: (state: 'open' | 'closed') => Maybe<PullRequest[]>;
  pull: (n: number) => Maybe<PullDetail>;
  /** An issue's or pull request's conversation, its description first. */
  timeline: (n: number) => Maybe<TimelineItem[]>;
  pullCommits: (n: number) => Maybe<Commit[]>;
  pullChecks: (n: number) => Maybe<Check[]>;
  pullFiles: (n: number) => Maybe<DiffFile[]>;
  runs: () => Maybe<Runs>;
  /** Posts a comment on an issue or pull request; resolves to it as the timeline shows it. */
  comment: (n: number, body: string) => Promise<TimelineItem>;
}

/** The sample PR's sidebar (#488); other sample PRs borrow its people. */
const sampleDetail = (p: PullRequest): PullDetail => ({
  ...p,
  body: '',
  reviewers: [{ user: USERS.jonas, state: 'approved' }],
  assignees: [p.author],
  milestone: { title: 'v3.3', pct: 62 },
  closes: ['Retries fire in lockstep after an outage'],
  mergeable: 'clean',
  changedFiles: PR_FILES.length,
});

let posted = 0;

/** acme/orbit from data.ts: everything synchronous, comments kept on the page only. */
export const SAMPLE_SOURCE: RepoSource = {
  id: 'sample',
  live: false,
  full: `${REPO.owner}/${REPO.name}`,
  viewer: () => ME,
  repo: () => REPO,
  counts: () => ({ issues: ISSUE_COUNTS, pulls: PR_COUNTS }),
  labels: () => Object.values(LABELS),
  tree: () => TREE,
  readme: () => README_MD,
  file: (path) => {
    const node = findNode(path);
    return node?.content ?? `// ${node?.name ?? path}\n// Contents are not included in this sample repository.\n`;
  },
  lastCommit: (path) => {
    const node = path ? findNode(path) : undefined;
    return node ? { ...REPO.lastCommit!, message: node.commit, when: node.when } : REPO.lastCommit;
  },
  issues: (state) => ISSUES.filter((i) => i.state === state),
  issue: (n) => {
    const i = ISSUES.find((x) => x.number === n) ?? ISSUES[0];
    return { ...i, body: `*${i.title}* — this sample issue has no description. Sign in with GitHub to open real ones.` };
  },
  pulls: (state) => PULLS.filter((p) => (state === 'open' ? p.state === 'open' || p.state === 'draft' : p.state === 'merged' || p.state === 'closed')),
  pull: (n) => sampleDetail(PULLS.find((x) => x.number === n) ?? PULLS[0]),
  timeline: (n) => {
    if (PULLS.some((p) => p.number === n)) return PR_TIMELINE;
    const i = SAMPLE_SOURCE.issue(n) as IssueDetail;
    return [{ kind: 'comment', id: 'body', author: i.author, when: i.when, body: i.body, role: 'Author' }];
  },
  pullCommits: () => PR_COMMITS,
  pullChecks: () => PR_CHECKS,
  pullFiles: () => PR_FILES,
  runs: () => ({ total: 184, workflows: WORKFLOWS, runs: RUNS }),
  comment: async (_n, body) => ({ kind: 'comment', id: 'new' + posted++, author: ME, when: 'now', body, role: 'Member' }),
};

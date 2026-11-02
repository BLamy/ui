/* Where a screen's data comes from, and where its changes go. Every screen talks to a RepoSource: githubRepo() in
   github-api.ts over a GitHub client. Real GitHub and the sample are the same implementation over different fetches:
   real GitHub takes the token in the Passwords keychain and api.github.com, the sample takes sample-server.ts's small
   in-page GitHub. `live` says whether writes reach GitHub (the copy changes) and nothing else. `ref` is a branch, tag
   or sha, or '' for the default branch. Any write refreshes every screen showing what it changed (see useLoad). */
import type {
  BlameRange, Check, CodeHit, Comparison, Commit, CommitDetail, CommentTarget, ContributorStat, DiffFile, FileNode, Issue, IssueDetail, IssueDraft, IssueExtras, IssuePatch, Label, LastCommit, Milestone, NewReviewComment, PullDetail, PullExtras,
  PullRequest, PullThreads, ReactionContent, RefInfo, Release, ReleaseDraft, Repo, ReviewEvent, RunDetail, TimelineItem, Traffic, User, Workflow, WorkflowInput, WorkflowRun,
} from './data';

export type Maybe<T> = T | Promise<T>;

export interface Counts {
  issues: { open: number; closed: number };
  pulls: { open: number; closed: number };
}

/** One page of a list and how much more there is. */
export interface Paged<T> {
  items: T[];
  total?: number;
  page: number;
  hasNext: boolean;
  hasPrev: boolean;
  lastPage?: number;
}

export interface RunFilter {
  workflow?: number;
  event?: string;
  status?: string;
  branch?: string;
  actor?: string;
  page?: number;
}

export interface RepoSettings {
  name?: string;
  description?: string;
  homepage?: string;
  private?: boolean;
  has_issues?: boolean;
  has_wiki?: boolean;
  has_projects?: boolean;
  has_discussions?: boolean;
  allow_merge_commit?: boolean;
  allow_squash_merge?: boolean;
  allow_rebase_merge?: boolean;
  allow_auto_merge?: boolean;
  delete_branch_on_merge?: boolean;
  allow_update_branch?: boolean;
  default_branch?: string;
  archived?: boolean;
}

export type Subscription = 'participating' | 'all' | 'ignored';

export type PeopleKind = 'stargazers' | 'watchers' | 'contributors' | 'forks';

export interface RepoSource {
  /** Distinguishes cached loads. */
  id: string;
  /** Writes reach real GitHub. */
  live: boolean;
  /** owner/name */
  full: string;
  /** Reads part of the repository again ('/pulls/5'), or all of it. */
  refresh: (scope?: string) => void;

  /* Repository */
  viewer: () => Maybe<User | null>;
  repo: () => Maybe<Repo>;
  counts: () => Maybe<Counts>;
  labels: () => Maybe<Label[]>;
  milestones: (state: 'open' | 'closed' | 'all') => Maybe<Milestone[]>;
  milestone: (n: number) => Maybe<Milestone>;
  /** People who can be assigned or asked for a review. */
  assignable: () => Maybe<User[]>;
  people: (kind: PeopleKind, page: number) => Maybe<Paged<User & { detail?: string; full?: string }>>;
  starred: () => Maybe<boolean>;
  setStarred: (on: boolean) => Promise<void>;
  subscription: () => Maybe<Subscription>;
  setSubscription: (to: Subscription) => Promise<void>;
  /** Forks into the account (or an organization); resolves to the new owner/name. */
  fork: (o: { name?: string; organization?: string; defaultBranchOnly?: boolean }) => Promise<string>;
  update: (patch: RepoSettings) => Promise<string>;
  setTopics: (names: string[]) => Promise<void>;
  /** Your collaborators: admins only. */
  collaborators: () => Maybe<(User & { role: string })[]>;
  addCollaborator: (login: string, permission: string) => Promise<void>;
  removeCollaborator: (login: string) => Promise<void>;
  /** Branch protection on a branch; null when none (or not allowed to read). */
  protection: (branch: string) => Maybe<{ reviews: number; checks: string[]; strict: boolean } | null>;

  /* Code */
  tree: (ref: string) => Maybe<FileNode[]>;
  /** GitHub cut the recursive listing short: this repository's too big to list at once, and folders are read one at a time instead. */
  treeTruncated: (ref: string) => Maybe<boolean>;
  /** One path, asked of GitHub directly: a file, or a folder and what's in it; null when it isn't there. */
  pathInfo: (path: string, ref: string) => Maybe<FileNode | null>;
  /** The README's Markdown, or null when there is none. */
  readme: (ref: string) => Maybe<string | null>;
  /** A file's text, or null when it is binary. */
  file: (path: string, ref: string) => Maybe<string | null>;
  /** A file's bytes as an object URL (images). */
  fileUrl: (path: string, ref: string) => Maybe<string>;
  /** The blob sha GitHub wants before it overwrites or deletes a file. */
  fileSha: (path: string, ref: string) => Maybe<string | null>;
  /** The last commit touching a path ('' for the whole repository). */
  lastCommit: (path: string, ref: string) => Maybe<LastCommit | null>;
  /** The last commit of each path: the file table's middle column. */
  lastCommits: (paths: string[], ref: string) => Maybe<Record<string, LastCommit>>;
  blame: (path: string, ref: string) => Maybe<BlameRange[]>;
  branches: (page: number, query?: string) => Maybe<Paged<RefInfo>>;
  tags: (page: number) => Maybe<Paged<RefInfo>>;
  refNames: () => Maybe<{ branches: string[]; tags: string[] }>;
  createBranch: (name: string, from: string) => Promise<void>;
  /** Makes a branch at an exact commit (restoring a deleted head). */
  createBranchAt: (name: string, sha: string) => Promise<void>;
  deleteBranch: (name: string) => Promise<void>;
  renameBranch: (from: string, to: string) => Promise<void>;
  createTag: (name: string, sha: string) => Promise<void>;
  deleteTag: (name: string) => Promise<void>;
  /** Creates or replaces a file; resolves to the new commit's sha. */
  putFile: (o: { path: string; content: string; message: string; branch: string; sha?: string | null }) => Promise<string>;
  deleteFile: (o: { path: string; message: string; branch: string; sha: string }) => Promise<string>;

  /* History */
  commits: (o: { ref: string; path?: string; author?: string; since?: string; until?: string; page: number }) => Maybe<Paged<Commit>>;
  commit: (sha: string) => Maybe<CommitDetail>;
  compare: (base: string, head: string) => Maybe<Comparison>;

  /* Issues and pull requests */
  /** `q` is GitHub's own search syntax ('is:open label:bug sort:updated-desc'). */
  searchIssues: (q: string, page: number) => Maybe<Paged<Issue>>;
  searchPulls: (q: string, page: number) => Maybe<Paged<PullRequest>>;
  issue: (n: number) => Maybe<IssueDetail>;
  issueExtras: (n: number) => Maybe<IssueExtras | null>;
  createIssue: (draft: IssueDraft) => Promise<number>;
  updateIssue: (n: number, patch: IssuePatch) => Promise<void>;
  lock: (n: number, reason?: string) => Promise<void>;
  unlock: (n: number) => Promise<void>;
  deleteIssue: (id: string, n: number) => Promise<void>;
  setPinned: (id: string, n: number, on: boolean) => Promise<void>;
  setThreadSubscribed: (id: string, n: number, on: boolean) => Promise<void>;
  /** An issue's or pull request's conversation, its description first. */
  timeline: (n: number) => Maybe<TimelineItem[]>;
  /** Posts a comment on an issue or pull request; resolves to it as the timeline shows it. */
  comment: (n: number, body: string) => Promise<TimelineItem>;
  editComment: (target: CommentTarget, body: string) => Promise<void>;
  deleteComment: (target: CommentTarget, n: number) => Promise<void>;
  /** Yours among a comment's reactions: content to reaction id. */
  myReactions: (target: CommentTarget) => Maybe<Partial<Record<ReactionContent, number>>>;
  react: (target: CommentTarget, content: ReactionContent) => Promise<void>;
  unreact: (target: CommentTarget, reactionId: number) => Promise<void>;
  createLabel: (l: { name: string; color: string; description?: string }) => Promise<void>;
  updateLabel: (name: string, l: { name?: string; color?: string; description?: string }) => Promise<void>;
  deleteLabel: (name: string) => Promise<void>;
  createMilestone: (m: { title: string; description?: string; due?: string | null }) => Promise<number>;
  updateMilestone: (n: number, m: { title?: string; description?: string; due?: string | null; state?: 'open' | 'closed' }) => Promise<void>;
  deleteMilestone: (n: number) => Promise<void>;
  /** The templates in .github/ISSUE_TEMPLATE and .github/PULL_REQUEST_TEMPLATE.md. */
  issueTemplates: () => Maybe<{ name: string; about: string; title: string; body: string; labels: string[] }[]>;
  pullTemplate: () => Maybe<string | null>;

  pull: (n: number) => Maybe<PullDetail>;
  pullExtras: (n: number) => Maybe<PullExtras | null>;
  pullCommits: (n: number) => Maybe<Commit[]>;
  pullChecks: (n: number) => Maybe<Check[]>;
  pullFiles: (n: number) => Maybe<DiffFile[]>;
  pullThreads: (n: number) => Maybe<PullThreads>;
  createPull: (o: { title: string; body: string; head: string; base: string; draft: boolean; maintainerCanModify?: boolean }) => Promise<number>;
  updatePull: (n: number, patch: { title?: string; body?: string; state?: 'open' | 'closed'; base?: string }) => Promise<void>;
  /** Opens a pull request undoing a merged one; resolves to its number. */
  revert: (nodeId: string, n: number, title: string) => Promise<number>;
  /** Branch names in another repository (your fork, for compare). */
  branchNamesOf: (full: string) => Maybe<string[]>;
  merge: (n: number, o: { method: 'merge' | 'squash' | 'rebase'; title?: string; message?: string; sha?: string }) => Promise<void>;
  updateBranch: (n: number) => Promise<void>;
  setDraft: (nodeId: string, n: number, draft: boolean) => Promise<void>;
  setAutoMerge: (nodeId: string, n: number, method: 'merge' | 'squash' | 'rebase' | null) => Promise<void>;
  requestReviewers: (n: number, logins: string[]) => Promise<void>;
  removeReviewers: (n: number, logins: string[]) => Promise<void>;
  dismissReview: (n: number, id: number, message: string) => Promise<void>;
  /** Starts or adds to your pending review with inline comments. */
  addPendingComment: (n: number, c: NewReviewComment, headSha: string) => Promise<void>;
  /** Posts a one-off inline comment immediately. */
  addReviewComment: (n: number, c: NewReviewComment, headSha: string) => Promise<void>;
  replyToThread: (n: number, commentId: number, body: string) => Promise<void>;
  setThreadResolved: (threadId: string, n: number, resolved: boolean) => Promise<void>;
  submitReview: (n: number, o: { event: ReviewEvent; body: string; pendingId?: number; headSha: string }) => Promise<void>;
  discardReview: (n: number, id: number) => Promise<void>;
  setFileViewed: (nodeId: string, n: number, path: string, viewed: boolean) => Promise<void>;

  /* Actions */
  runs: (f: RunFilter) => Maybe<Paged<WorkflowRun>>;
  run: (id: number) => Maybe<RunDetail>;
  workflows: () => Maybe<Workflow[]>;
  workflowInputs: (path: string, ref: string) => Maybe<{ dispatchable: boolean; inputs: WorkflowInput[] }>;
  dispatch: (workflow: number, ref: string, inputs: Record<string, string>) => Promise<void>;
  setWorkflowEnabled: (workflow: number, on: boolean) => Promise<void>;
  cancelRun: (id: number) => Promise<void>;
  rerun: (id: number, onlyFailed: boolean) => Promise<void>;
  deleteRun: (id: number) => Promise<void>;
  jobLog: (id: number) => Maybe<string>;

  /* Releases */
  releases: (page: number) => Maybe<Paged<Release>>;
  release: (tag: string) => Maybe<Release>;
  createRelease: (d: ReleaseDraft) => Promise<string>;
  updateRelease: (id: number, d: Partial<ReleaseDraft>) => Promise<string>;
  deleteRelease: (id: number) => Promise<void>;
  generateNotes: (tag: string, target: string) => Promise<{ name: string; body: string }>;

  /* Search within the repository */
  searchCode: (q: string) => Maybe<Paged<CodeHit>>;

  /* Insights */
  contributorStats: () => Maybe<ContributorStat[] | 'computing'>;
  commitActivity: () => Maybe<{ week: number; total: number; days: number[] }[] | 'computing'>;
  codeFrequency: () => Maybe<{ week: number; additions: number; deletions: number }[] | 'computing'>;
  traffic: () => Maybe<Traffic | null>;
}

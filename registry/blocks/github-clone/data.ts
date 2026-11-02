/* The shapes every screen draws: github-api.ts maps GitHub's REST and GraphQL answers into these. The sample repository
   isn't a different source of them: it's sample-server.ts, a small GitHub in the page, behind the same client. */

export interface User {
  login: string;
  /** First / last name: what the Avatar's initials are drawn from. */
  f: string;
  l: string;
  /** Profile picture; the initials show without it. */
  avatar?: string;
}

export interface Label {
  name: string;
  /** GitHub-style label color (hex). */
  color: string;
  description?: string;
}

export interface Permissions {
  admin: boolean;
  maintain: boolean;
  push: boolean;
  triage: boolean;
  pull: boolean;
}

export interface Repo {
  owner: string;
  name: string;
  description: string;
  /** As GitHub stores it, with or without a scheme. */
  homepage: string;
  topics: string[];
  /** Counts as GitHub prints them ('12.4k'). */
  stars: string;
  forks: string;
  watchers: string;
  starCount: number;
  forkCount: number;
  watcherCount: number;
  license: string;
  /** The default branch. */
  branch: string;
  branches: string[];
  branchCount: number;
  tagCount: number;
  commitCount: string;
  release: { tag: string; when: string; count: number } | null;
  languages: { name: string; pct: number; color: string }[];
  contributors: User[];
  contributorCount: number;
  lastCommit: LastCommit | null;
  private?: boolean;
  url?: string;
  /** Nothing committed yet. */
  empty: boolean;
  archived: boolean;
  fork: boolean;
  /** owner/name this was forked from. */
  parent?: string;
  /** What the signed-in account may do here. */
  permissions: Permissions;
  has: { issues: boolean; wiki: boolean; projects: boolean; discussions: boolean };
  merge: { merge: boolean; squash: boolean; rebase: boolean; auto: boolean; deleteBranch: boolean; updateBranch: boolean };
}

export interface LastCommit {
  author: User;
  message: string;
  sha: string;
  fullSha?: string;
  when: string;
  at?: string;
}

/* ── Files ── */
export interface FileNode {
  name: string;
  path: string;
  type: 'dir' | 'file';
  commit: string;
  when: string;
  children?: FileNode[];
  /** Bytes, so huge files aren't fetched. */
  size?: number;
  fullSha?: string;
  /** Not a plain file: a pointer to another repository's commit, or a link to another path. */
  special?: 'submodule' | 'symlink';
  objectSha?: string;
}

/** A branch or tag as the branches and tags pages list them. */
export interface RefInfo {
  name: string;
  sha: string;
  protected?: boolean;
  /** Filled in for branches and tags on their pages. */
  commit?: LastCommit;
  ahead?: number;
  behind?: number;
  pull?: { number: number; state: 'open' | 'merged' | 'closed' | 'draft' };
}

/* ── Reactions ── */
export type ReactionContent = '+1' | '-1' | 'laugh' | 'hooray' | 'confused' | 'heart' | 'rocket' | 'eyes';
export const REACTION_GLYPH: Record<ReactionContent, string> = { '+1': '👍', '-1': '👎', laugh: '😄', hooray: '🎉', confused: '😕', heart: '❤️', rocket: '🚀', eyes: '👀' };
export type Reactions = Partial<Record<ReactionContent, number>>;
/** What a reaction, an edit or a delete applies to. */
export type CommentTarget =
  | { kind: 'issue'; number: number }
  | { kind: 'issueComment'; id: number }
  | { kind: 'reviewComment'; id: number };

/* ── Issues ── */
export interface Milestone {
  number: number;
  title: string;
  description: string;
  state: 'open' | 'closed';
  due?: string;
  dueWhen?: string;
  open: number;
  closed: number;
  pct: number;
  url?: string;
  closedWhen?: string;
}

export interface Issue {
  number: number;
  title: string;
  state: 'open' | 'closed';
  stateReason?: string | null;
  author: User;
  when: string;
  at?: string;
  labels: Label[];
  comments: number;
  assignees: User[];
  milestone?: string;
  url?: string;
  locked?: boolean;
  /** owner/name, for lists across repositories. */
  repo?: string;
}

/** An issue opened in full. */
export interface IssueDetail extends Issue {
  body: string;
  bodyEdited: boolean;
  milestoneNumber?: number;
  milestoneDetail?: Milestone;
  reactions: Reactions;
  lockReason?: string | null;
  closedBy?: User | null;
  nodeId: string;
}

export interface IssueExtras {
  id: string;
  pinned: boolean;
  subscribed: boolean;
  canDelete: boolean;
}

export interface IssueDraft {
  title: string;
  body: string;
  labels: string[];
  assignees: string[];
  milestone?: number | null;
}

export interface IssuePatch {
  title?: string;
  body?: string;
  state?: 'open' | 'closed';
  stateReason?: 'completed' | 'not_planned' | 'reopened' | null;
  labels?: string[];
  assignees?: string[];
  milestone?: number | null;
}

/* ── Pull requests ── */
export type ReviewState = 'approved' | 'changes' | 'pending' | 'draft';
export interface PullRequest {
  number: number;
  title: string;
  state: 'open' | 'merged' | 'closed' | 'draft';
  author: User;
  when: string;
  at?: string;
  labels: Label[];
  comments: number;
  assignees?: User[];
  milestone?: string;
  review?: ReviewState;
  checks?: 'success' | 'failure' | 'pending';
  head: string;
  base: string;
  commits: number;
  additions: number;
  deletions: number;
  url?: string;
  repo?: string;
}

export interface Reviewer {
  user: User;
  state: 'approved' | 'changes' | 'commented' | 'pending' | 'dismissed';
  reviewId?: number;
  isTeam?: boolean;
}

/** A pull request opened in full: the sidebar's people and milestone, and what the merge box says. */
export interface PullDetail extends PullRequest {
  body: string;
  bodyEdited: boolean;
  reviewers: Reviewer[];
  assignees: User[];
  milestone?: string;
  milestoneNumber?: number;
  milestoneDetail?: Milestone;
  changedFiles: number;
  /** GitHub's mergeable_state: clean, blocked, dirty (conflicts), behind, unstable, unknown… */
  mergeable: string;
  /** null while GitHub is still working it out. */
  canMerge: boolean | null;
  headSha: string;
  baseSha: string;
  headLabel: string;
  /** owner/name the head branch lives in; missing once a fork is gone. */
  headRepo?: string;
  headDeleted: boolean;
  fromFork: boolean;
  mergedBy?: User | null;
  mergedWhen?: string;
  mergeSha?: string | null;
  closedWhen?: string;
  maintainerCanModify: boolean;
  autoMerge: { method: string; by: User } | null;
  nodeId: string;
  reactions: Reactions;
  locked?: boolean;
  lockReason?: string | null;
}

export interface PullExtras {
  decision: 'APPROVED' | 'CHANGES_REQUESTED' | 'REVIEW_REQUIRED' | null;
  closes: { number: number; title: string; state: 'open' | 'closed' }[];
  viewed: string[];
  subscribed: boolean;
}

export interface Commit {
  sha: string;
  fullSha: string;
  message: string;
  /** The rest of the commit message after the first line. */
  body?: string;
  author: User;
  when: string;
  at?: string;
  verified?: boolean;
  parents?: string[];
  url?: string;
}

export interface CommitDetail extends Commit {
  files: DiffFile[];
  additions: number;
  deletions: number;
  checks?: Check[];
  pulls: { number: number; title: string }[];
}

export interface Comparison {
  status: 'identical' | 'ahead' | 'behind' | 'diverged';
  ahead: number;
  behind: number;
  commits: Commit[];
  files: DiffFile[];
  url?: string;
}

export type TimelineItem =
  | { kind: 'comment'; id: string; dbId?: number; author: User; when: string; at?: string; body: string; role?: string; url?: string; reactions?: Reactions; edited?: boolean; target?: CommentTarget; isBody?: boolean }
  | { kind: 'commits'; id: string; author: User; when: string; commits: Commit[] }
  | { kind: 'labeled'; id: string; author: User; when: string; labels: Label[]; removed?: Label[] }
  | { kind: 'review'; id: string; reviewId?: number; author: User; when: string; state: 'approved' | 'commented' | 'changes' | 'dismissed'; body?: string; role?: string; url?: string; threads?: ReviewThread[] }
  | { kind: 'requested'; id: string; author: User; when: string; reviewer: User; removed?: boolean }
  /** closed, reopened, merged, renamed, assigned, unassigned, milestoned, demilestoned, locked, unlocked, head_ref_deleted, ready_for_review, convert_to_draft, cross-referenced, referenced, auto_merge_*; `text` for the detail. */
  | { kind: 'event'; id: string; author: User; when: string; event: string; text?: string; ref?: number; reason?: string | null; sha?: string };

export interface ReviewComment {
  id: number;
  author: User;
  body: string;
  when: string;
  at?: string;
  role?: string;
  url?: string;
  reviewId?: number;
  pending?: boolean;
  canEdit: boolean;
  canDelete: boolean;
  reactions?: Reactions;
}

export interface ReviewThread {
  id: string;
  path: string;
  line: number | null;
  startLine?: number | null;
  side: 'LEFT' | 'RIGHT';
  resolved: boolean;
  resolvedBy?: string | null;
  outdated: boolean;
  canResolve: boolean;
  canUnresolve: boolean;
  canReply: boolean;
  hunk: string;
  comments: ReviewComment[];
}

export interface PullThreads {
  threads: ReviewThread[];
  /** Your review in progress, if any. */
  pending: { id: number; nodeId: string; count: number } | null;
}

export type ReviewEvent = 'COMMENT' | 'APPROVE' | 'REQUEST_CHANGES';
export interface NewReviewComment {
  path: string;
  line: number;
  side: 'LEFT' | 'RIGHT';
  startLine?: number;
  body: string;
}

export interface Check {
  name: string;
  status: 'success' | 'failure' | 'pending' | 'neutral';
  /** How long it ran ('1m 48s'), or what it's doing. */
  time: string;
  url?: string;
  summary?: string;
  /** The Actions run behind it, when it's one of the repository's. */
  runId?: number;
  app?: string;
}

export interface DiffFile {
  path: string;
  additions: number;
  deletions: number;
  status?: 'added' | 'removed' | 'modified' | 'renamed' | 'copied' | 'changed' | 'unchanged';
  previous?: string;
  /** Unified-diff hunks (each starts with an `@@ -a,b +c,d @@` header); empty when GitHub sends none (binary, too large). */
  patch: string;
  /** Said instead of a diff when there's no patch. */
  note?: string;
}

/* ── Actions ── */
export interface WorkflowRun {
  id: number;
  title: string;
  workflow: string;
  workflowId?: number;
  number: number;
  attempt?: number;
  event: string;
  rawEvent?: string;
  pull?: number;
  actor: User;
  branch: string;
  sha?: string;
  status: 'success' | 'failure' | 'running' | 'cancelled' | 'queued' | 'skipped';
  when: string;
  at?: string;
  duration: string;
  url?: string;
}

export interface Workflow {
  id: number;
  name: string;
  path: string;
  state: string;
  active: boolean;
  url?: string;
}

export interface WorkflowInput {
  name: string;
  description?: string;
  required?: boolean;
  default?: string;
  type?: string;
  options?: string[];
}

export interface RunJob {
  id: number;
  name: string;
  status: WorkflowRun['status'];
  duration: string;
  url?: string;
  steps: { number: number; name: string; status: WorkflowRun['status']; duration: string }[];
}

export interface RunDetail extends WorkflowRun {
  jobs: RunJob[];
  rawStatus: string;
  hasFailed: boolean;
}

/* ── Releases ── */
export interface Release {
  id: number;
  tag: string;
  name: string;
  body: string;
  draft: boolean;
  prerelease: boolean;
  latest: boolean;
  author: User;
  when: string;
  at?: string;
  target: string;
  url?: string;
  zip?: string;
  tar?: string;
  assets: { id: number; name: string; size: number; downloads: number; url: string }[];
}

export interface ReleaseDraft {
  tag: string;
  target?: string;
  name: string;
  body: string;
  draft: boolean;
  prerelease: boolean;
}

/* ── Account ── */
export interface RepoSummary {
  full: string;
  description: string;
  private: boolean;
  stars?: string;
  language?: string;
  fork?: boolean;
  archived?: boolean;
  when?: string;
}

export interface Notification {
  id: string;
  unread: boolean;
  reason: string;
  title: string;
  type: string;
  repo: string;
  number?: number;
  when: string;
  url?: string;
}

export interface CodeHit {
  path: string;
  fragment: string;
  matches: [number, number][];
  url?: string;
}

/* ── Insights ── */
export interface ContributorStat {
  user: User;
  commits: number;
  additions: number;
  deletions: number;
  weeks: { w: number; c: number; a: number; d: number }[];
}

export interface Traffic {
  views: { at: string; count: number; uniques: number }[];
  clones: { at: string; count: number; uniques: number }[];
  viewsTotal: number;
  viewsUnique: number;
  clonesTotal: number;
  clonesUnique: number;
  referrers: { referrer: string; count: number; uniques: number }[];
  paths: { path: string; title: string; count: number; uniques: number }[];
}

/* ── Blame ── */
export interface BlameRange {
  start: number;
  end: number;
  commit: LastCommit;
}

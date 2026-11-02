/* A small GitHub that runs in the page: a `fetch` answering the REST and GraphQL calls github-api.ts makes, in GitHub's
   JSON, over repositories held in memory (sample-seed.ts). The sample repository is simply this server behind the same
   client as real GitHub, so every screen and every mapper runs the same code for both, every write really changes what
   the next read returns, and tests and stories can drive the live path offline.

   It enforces what GitHub enforces where the UI depends on it: repository roles (read / triage / write / maintain /
   admin), archived repositories, merge conflicts, required reviews and checks, allowed merge methods. Error bodies copy
   GitHub's. `fail()` queues a failure for a request and `latency` slows answers down to show the loading states. */
import { diffTrees, GitStore, hashOf, type DiffEntry, type GitCommit } from './sample-git';

export type Role = 'read' | 'triage' | 'write' | 'maintain' | 'admin';
const RANK: Record<Role, number> = { read: 0, triage: 1, write: 2, maintain: 3, admin: 4 };

export interface ServerUser {
  login: string;
  name: string;
  email?: string;
  bio?: string;
}

export interface ServerLabel { name: string; color: string; description?: string | null }

export interface ServerMilestone {
  number: number; title: string; description: string; state: 'open' | 'closed'; due_on: string | null; created_at: string; closed_at: string | null;
}

export interface ServerReaction { id: number; content: string; user: string }

export interface ServerComment {
  id: number; user: string; body: string; created_at: string; updated_at: string; reactions: ServerReaction[];
}

export type ServerEvent = {
  id: number; event: string; actor: string; created_at: string;
  label?: ServerLabel; assignee?: string; reviewer?: string; rename?: { from: string; to: string }; milestone?: string;
  commit_id?: string; source?: number; lock_reason?: string | null; state_reason?: string | null;
};

export interface ServerIssue {
  number: number; title: string; body: string; state: 'open' | 'closed'; state_reason: string | null; user: string; created_at: string; updated_at: string;
  closed_at: string | null; closed_by?: string | null; labels: string[]; assignees: string[]; milestone: number | null; locked: boolean; active_lock_reason: string | null;
  comments: ServerComment[]; events: ServerEvent[]; reactions: ServerReaction[]; pinned?: boolean;
  /** Who gets notified: `true` subscribed by hand, `false` unsubscribed. */
  subscribed?: boolean;
}

export interface ServerReview {
  id: number; user: string; state: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'PENDING' | 'DISMISSED'; body: string; submitted_at: string | null; commit_id: string;
}

export interface ServerReviewComment {
  id: number; review_id: number; user: string; body: string; path: string; line: number; start_line: number | null; side: 'LEFT' | 'RIGHT'; commit_id: string;
  created_at: string; updated_at: string; in_reply_to_id?: number; thread: number; reactions: ServerReaction[];
}

export interface ServerThread { id: number; resolved: boolean; resolved_by: string | null; }

export interface ServerPull {
  number: number; base: string; head: string; head_repo?: string; head_deleted?: boolean; draft: boolean; merged_at: string | null; merged_by: string | null; merge_commit_sha: string | null;
  requested_reviewers: string[]; requested_teams: string[]; reviews: ServerReview[]; review_comments: ServerReviewComment[]; threads: ServerThread[];
  /** Base and head when it merged or closed: the diff stays even when the branch moves on or goes away. */
  frozen?: { base: string; head: string };
  maintainer_can_modify: boolean; auto_merge: { method: string; by: string } | null; viewed: string[];
}

export interface ServerStep { number: number; name: string; status: string; conclusion: string | null; started_at: string | null; completed_at: string | null }
export interface ServerJob { id: number; name: string; status: string; conclusion: string | null; started_at: string | null; completed_at: string | null; steps: ServerStep[]; log?: string }
export interface ServerRun {
  id: number; workflow_id: number; name: string; display_title: string; run_number: number; run_attempt: number; event: string; actor: string; head_branch: string; head_sha: string; status: string;
  conclusion: string | null; created_at: string; run_started_at: string; updated_at: string; pull_request?: number; jobs: ServerJob[];
}
export interface ServerWorkflow { id: number; name: string; path: string; state: 'active' | 'disabled_manually' }

export interface ServerCheck { name: string; status: string; conclusion: string | null; started_at: string | null; completed_at: string | null; run?: number; summary?: string }

export interface ServerRelease {
  id: number; tag_name: string; name: string; body: string; draft: boolean; prerelease: boolean; created_at: string; published_at: string | null; author: string; target_commitish: string;
  assets: { id: number; name: string; size: number; download_count: number; content_type: string }[];
}

export interface ServerRepo {
  id: number; owner: string; name: string; description: string; homepage: string; topics: string[]; private: boolean; archived: boolean; fork: boolean; parent?: string;
  default_branch: string; license: string | null; created_at: string; pushed_at: string; stars: number; forks: string[]; extra_forks: number; extra_watchers: number; extra_contributors?: number;
  has_issues: boolean; has_wiki: boolean; has_projects: boolean; has_discussions: boolean;
  allow_merge_commit: boolean; allow_squash_merge: boolean; allow_rebase_merge: boolean; allow_auto_merge: boolean; delete_branch_on_merge: boolean; allow_update_branch: boolean;
  git: GitStore;
  labels: ServerLabel[]; milestones: ServerMilestone[]; issues: Map<number, ServerIssue>; pulls: Map<number, ServerPull>;
  /** Roles by login; the owner is an admin. */
  roles: Record<string, Role>;
  /** Branch protection: `required_reviews` approvals and `required_checks` must pass before merging. */
  protection: Record<string, { required_reviews: number; required_checks: string[]; strict?: boolean }>;
  checks: Record<string, ServerCheck[]>; statuses: Record<string, { context: string; state: string; description: string; target_url?: string }[]>;
  workflows: ServerWorkflow[]; runs: ServerRun[]; releases: ServerRelease[];
  /** Hidden from readers: GitHub's Traffic API needs push access. */
  traffic?: { views: number[]; clones: number[]; referrers: { referrer: string; count: number; uniques: number }[]; paths: { path: string; title: string; count: number; uniques: number }[] };
  stargazers: string[]; watchers: string[]; subscriptions: Record<string, { subscribed: boolean; ignored: boolean }>;
}

export interface ServerNotification { id: string; repo: string; subject: { title: string; type: 'Issue' | 'PullRequest' | 'Release'; number?: number }; reason: string; unread: boolean; updated_at: string }

export interface ServerSeed {
  now: string;
  viewer: string;
  users: ServerUser[];
  repos: ServerRepo[];
  notifications: ServerNotification[];
  orgs?: string[];
}

export interface ServerOptions {
  seed: () => ServerSeed;
  latency?: number;
  /** Signed in as someone else (or `null`, not at all): the permission tests. */
  viewer?: string | null;
  /** What the token may do (GitHub's x-oauth-scopes header). */
  scopes?: string;
}

class HttpError extends Error {
  constructor(readonly status: number, message: string, readonly errors?: unknown) { super(message); }
}

type Ctx = { query: URLSearchParams; body: any; viewer: string | null; accept: string; params: Record<string, string>; repo: ServerRepo };
type Answer = { status?: number; json?: unknown; text?: string; bytes?: Uint8Array; headers?: Record<string, string> };
type Handler = (ctx: Ctx) => Answer | unknown;

const ok = (json: unknown, status = 200): Answer => ({ json, status });
const noContent: Answer = { status: 204 };
const notFound = (): never => { throw new HttpError(404, 'Not Found'); };
const invalid = (message: string, errors?: unknown): never => { throw new HttpError(422, message, errors); };

export function createSampleServer({ seed, latency = 0, viewer: asViewer, scopes = 'repo, read:org, gist, notifications' }: ServerOptions) {
  const db = seed();
  const viewer = asViewer === undefined ? db.viewer : asViewer;
  let clock = Date.parse(db.now);
  const failures: { match: RegExp; status: number; message: string; headers?: Record<string, string> }[] = [];
  let nextId = 900_000;
  const log: { method: string; url: string; body?: unknown }[] = [];

  const iso = (t = clock) => new Date(t).toISOString();
  /** Writes advance the clock a minute: events keep their order and read as just now. */
  const tick = () => { clock += 60_000; return iso(); };
  const id = () => ++nextId;

  const user = (login: string) => {
    const u = db.users.find((x) => x.login === login);
    return { login, id: Number(BigInt('0x' + hashOf(login).slice(0, 8))), node_id: 'U_' + login, avatar_url: '', html_url: 'https://github.com/' + login, type: login.endsWith('[bot]') ? 'Bot' : 'User', name: u?.name ?? null };
  };
  const roleIn = (r: ServerRepo, login: string | null): Role | null => {
    if (!login) return r.private ? null : 'read';
    if (r.owner === login) return 'admin';
    return r.roles[login] ?? (r.private ? null : 'read');
  };
  const can = (r: ServerRepo, need: Role, login = viewer) => {
    const role = roleIn(r, login);
    return role != null && RANK[role] >= RANK[need];
  };
  const must = (r: ServerRepo, need: Role) => {
    if (!viewer) throw new HttpError(401, 'Requires authentication');
    if (!can(r, need)) throw new HttpError(403, 'Must have ' + need + ' access to this repository.');
    if (r.archived) throw new HttpError(403, 'Repository was archived so is read-only.');
  };
  const authed = () => {
    if (!viewer) throw new HttpError(401, 'Requires authentication');
    return viewer;
  };
  const full = (r: ServerRepo) => `${r.owner}/${r.name}`;
  const web = (r: ServerRepo) => `https://github.com/${full(r)}`;
  const findRepo = (o: string, n: string) => {
    const r = db.repos.find((x) => x.owner.toLowerCase() === o.toLowerCase() && x.name.toLowerCase() === n.toLowerCase());
    if (!r || !roleIn(r, viewer)) notFound();
    return r!;
  };

  /* ── JSON ── */
  const association = (r: ServerRepo, login: string, issueAuthor?: string) => {
    if (login === r.owner) return 'OWNER';
    const role = r.roles[login];
    if (role && RANK[role] >= RANK.maintain) return 'MEMBER';
    if (role) return 'COLLABORATOR';
    if (r.git.log(r.git.branches.get(r.default_branch) ?? '').some((c) => c.author.login === login)) return 'CONTRIBUTOR';
    return issueAuthor === login ? 'NONE' : 'NONE';
  };
  const reactionSummary = (rs: ServerReaction[], url: string) => {
    const of = (c: string) => rs.filter((x) => x.content === c).length;
    return {
      url, total_count: rs.length, '+1': of('+1'), '-1': of('-1'), laugh: of('laugh'), confused: of('confused'), heart: of('heart'), hooray: of('hooray'), rocket: of('rocket'), eyes: of('eyes'),
    };
  };
  const labelJson = (r: ServerRepo, name: string) => {
    const l = r.labels.find((x) => x.name === name);
    return { id: hashNum(name), node_id: 'LA_' + name, name, color: l?.color ?? '9198a1', description: l?.description ?? null, default: false };
  };
  const milestoneJson = (r: ServerRepo, m: ServerMilestone) => {
    const all = [...r.issues.values()].filter((i) => i.milestone === m.number);
    return {
      id: m.number, node_id: 'MI_' + m.number, number: m.number, title: m.title, description: m.description, state: m.state, due_on: m.due_on, created_at: m.created_at, closed_at: m.closed_at, updated_at: m.created_at,
      open_issues: all.filter((i) => i.state === 'open').length, closed_issues: all.filter((i) => i.state === 'closed').length, html_url: `${web(r)}/milestone/${m.number}`, creator: user(r.owner),
    };
  };
  const issueJson = (r: ServerRepo, i: ServerIssue) => {
    const pr = r.pulls.get(i.number);
    return {
      id: i.number, node_id: `I_${r.name}_${i.number}`, number: i.number, title: i.title, body: i.body, state: i.state, state_reason: i.state_reason, user: user(i.user), created_at: i.created_at, updated_at: i.updated_at, closed_at: i.closed_at,
      closed_by: i.closed_by ? user(i.closed_by) : null, locked: i.locked, active_lock_reason: i.active_lock_reason,
      labels: i.labels.map((n) => labelJson(r, n)), comments: i.comments.length, assignees: i.assignees.map(user), assignee: i.assignees[0] ? user(i.assignees[0]) : null,
      milestone: i.milestone != null ? milestoneOf(r, i.milestone) : null, html_url: `${web(r)}/${pr ? 'pull' : 'issues'}/${i.number}`, draft: pr?.draft ?? false, author_association: association(r, i.user, i.user),
      reactions: reactionSummary(i.reactions, `${web(r)}/issues/${i.number}/reactions`),
      ...(pr ? { pull_request: { url: `${web(r)}/pull/${i.number}`, html_url: `${web(r)}/pull/${i.number}`, merged_at: pr.merged_at } } : {}),
    };
  };
  const milestoneOf = (r: ServerRepo, n: number) => {
    const m = r.milestones.find((x) => x.number === n);
    return m ? milestoneJson(r, m) : null;
  };
  const commentJson = (r: ServerRepo, n: number, c: ServerComment) => ({
    id: c.id, node_id: 'IC_' + c.id, body: c.body, user: user(c.user), created_at: c.created_at, updated_at: c.updated_at, html_url: `${web(r)}/issues/${n}#issuecomment-${c.id}`, issue_url: `/repos/${full(r)}/issues/${n}`,
    author_association: association(r, c.user), reactions: reactionSummary(c.reactions, ''),
  });
  const headRepo = (r: ServerRepo, p: ServerPull) => (p.head_repo ? db.repos.find((x) => full(x) === p.head_repo) ?? r : r);
  const pullShas = (r: ServerRepo, p: ServerPull) => {
    const h = headRepo(r, p);
    const headSha = p.frozen?.head ?? h.git.branches.get(p.head) ?? '';
    const baseSha = p.frozen?.base ?? r.git.branches.get(p.base) ?? '';
    return { headSha, baseSha };
  };
  /** A fork's commits live in its own store; copying what's missing lets the base repository diff and merge them. */
  const syncFork = (r: ServerRepo, p: ServerPull) => {
    const h = headRepo(r, p);
    if (h === r) return;
    const sha = h.git.branches.get(p.head);
    if (sha) for (const c of h.git.log(sha)) if (!r.git.commits.has(c.sha)) r.git.commits.set(c.sha, c);
  };
  const pullDiff = (r: ServerRepo, p: ServerPull): DiffEntry[] => {
    syncFork(r, p);
    const { headSha, baseSha } = pullShas(r, p);
    if (!headSha || !baseSha) return [];
    const base = r.git.mergeBase(baseSha, headSha);
    const head = r.git.commits.get(headSha);
    return head ? diffTrees(base?.files ?? new Map(), head.files) : [];
  };
  const checksFor = (r: ServerRepo, sha: string) => [...(r.checks[sha] ?? [])];
  const reviewDecision = (p: ServerPull): 'APPROVED' | 'CHANGES_REQUESTED' | 'REVIEW_REQUIRED' => {
    const latest = new Map<string, ServerReview>();
    for (const v of p.reviews) if (v.state === 'APPROVED' || v.state === 'CHANGES_REQUESTED' || v.state === 'DISMISSED') latest.set(v.user, v);
    const states = [...latest.values()].map((v) => v.state);
    return states.includes('CHANGES_REQUESTED') ? 'CHANGES_REQUESTED' : states.includes('APPROVED') ? 'APPROVED' : 'REVIEW_REQUIRED';
  };
  const rollup = (r: ServerRepo, sha: string): 'SUCCESS' | 'FAILURE' | 'PENDING' | null => {
    const checks = checksFor(r, sha);
    const statuses = r.statuses[sha] ?? [];
    if (!checks.length && !statuses.length) return null;
    const bad = checks.some((c) => c.status === 'completed' && (c.conclusion === 'failure' || c.conclusion === 'timed_out' || c.conclusion === 'cancelled')) || statuses.some((s) => s.state === 'failure' || s.state === 'error');
    if (bad) return 'FAILURE';
    return checks.some((c) => c.status !== 'completed') || statuses.some((s) => s.state === 'pending') ? 'PENDING' : 'SUCCESS';
  };
  const mergeability = (r: ServerRepo, p: ServerPull, issue: ServerIssue) => {
    if (issue.state === 'closed' || p.merged_at) return { mergeable: null as boolean | null, mergeable_state: 'unknown' };
    syncFork(r, p);
    const { headSha, baseSha } = pullShas(r, p);
    if (!headSha || !baseSha) return { mergeable: false, mergeable_state: 'dirty' };
    if (r.git.merge(baseSha, headSha).conflicts.length) return { mergeable: false, mergeable_state: 'dirty' };
    if (p.draft) return { mergeable: true, mergeable_state: 'draft' };
    const rule = r.protection[p.base];
    const behind = !r.git.log(headSha).some((c) => c.sha === baseSha);
    if (rule) {
      if (rule.strict && behind) return { mergeable: true, mergeable_state: 'behind' };
      const approvals = new Set(p.reviews.filter((v) => v.state === 'APPROVED').map((v) => v.user)).size;
      if (approvals < rule.required_reviews || reviewDecision(p) === 'CHANGES_REQUESTED') return { mergeable: true, mergeable_state: 'blocked' };
      const checks = checksFor(r, headSha);
      for (const name of rule.required_checks) {
        const c = checks.find((x) => x.name === name);
        if (!c || c.status !== 'completed' || c.conclusion !== 'success') return { mergeable: true, mergeable_state: 'blocked' };
      }
    }
    return { mergeable: true, mergeable_state: rollup(r, headSha) === 'FAILURE' ? 'unstable' : 'clean' };
  };
  const pullJson = (r: ServerRepo, p: ServerPull) => {
    const i = r.issues.get(p.number)!;
    const { headSha, baseSha } = pullShas(r, p);
    const diff = pullDiff(r, p);
    const h = headRepo(r, p);
    const commits = headSha && baseSha && r.git.commits.has(headSha) ? r.git.ahead(baseSha, headSha).length : 0;
    return {
      ...issueJson(r, i), id: i.number, node_id: `PR_${r.name}_${p.number}`, draft: p.draft, merged: !!p.merged_at, merged_at: p.merged_at, merged_by: p.merged_by ? user(p.merged_by) : null, merge_commit_sha: p.merge_commit_sha,
      head: { ref: p.head, sha: headSha, label: `${h.owner}:${p.head}`, repo: p.head_deleted ? null : { full_name: full(h), owner: user(h.owner), name: h.name, fork: h.fork } },
      base: { ref: p.base, sha: baseSha, label: `${r.owner}:${p.base}`, repo: { full_name: full(r), owner: user(r.owner), name: r.name } },
      commits, additions: diff.reduce((s, f) => s + f.additions, 0), deletions: diff.reduce((s, f) => s + f.deletions, 0), changed_files: diff.length,
      comments: i.comments.length, review_comments: p.review_comments.length, requested_reviewers: p.requested_reviewers.map(user), requested_teams: p.requested_teams.map((name) => ({ name, slug: name })),
      maintainer_can_modify: p.maintainer_can_modify, auto_merge: p.auto_merge ? { merge_method: p.auto_merge.method, enabled_by: user(p.auto_merge.by) } : null, rebaseable: true,
      ...mergeability(r, p, i),
    };
  };
  const commitJson = (r: ServerRepo, c: GitCommit, withFiles = false) => {
    const parent = c.parents[0] ? r.git.commits.get(c.parents[0]) : undefined;
    const files = withFiles ? diffTrees(parent?.files ?? new Map(), c.files) : [];
    return {
      sha: c.sha, node_id: 'C_' + c.sha, html_url: `${web(r)}/commit/${c.sha}`, parents: c.parents.map((sha) => ({ sha, html_url: `${web(r)}/commit/${sha}` })),
      commit: { message: c.message, author: c.author, committer: c.committer, comment_count: 0, tree: { sha: hashOf(c.sha + ':tree') }, verification: { verified: c.message.includes('(verified)') } },
      author: c.author.login ? user(c.author.login) : null, committer: c.committer.login ? user(c.committer.login) : null,
      ...(withFiles ? {
        stats: { total: files.reduce((s, f) => s + f.additions + f.deletions, 0), additions: files.reduce((s, f) => s + f.additions, 0), deletions: files.reduce((s, f) => s + f.deletions, 0) },
        files: files.map(fileJson),
      } : {}),
    };
  };
  const fileJson = (f: DiffEntry) => ({
    filename: f.path, previous_filename: f.previous, status: f.status, additions: f.additions, deletions: f.deletions, changes: f.additions + f.deletions, patch: f.patch || undefined, sha: hashOf(f.path + f.patch),
  });
  const repoJson = (r: ServerRepo) => {
    const role = roleIn(r, viewer);
    return {
      id: r.id, node_id: 'R_' + r.id, name: r.name, full_name: full(r), owner: { ...user(r.owner), type: db.orgs?.includes(r.owner) ? 'Organization' : 'User' }, description: r.description, homepage: r.homepage, topics: r.topics, private: r.private, visibility: r.private ? 'private' : 'public',
      archived: r.archived, disabled: false, fork: r.fork, parent: r.parent ? { full_name: r.parent, html_url: 'https://github.com/' + r.parent } : undefined, default_branch: r.default_branch, html_url: web(r), created_at: r.created_at, pushed_at: r.pushed_at, updated_at: r.pushed_at,
      license: r.license ? { name: r.license, spdx_id: r.license } : null, stargazers_count: r.stars + r.stargazers.length, watchers_count: r.stars + r.stargazers.length, forks_count: r.extra_forks + r.forks.length, subscribers_count: r.extra_watchers + r.watchers.length,
      open_issues_count: [...r.issues.values()].filter((i) => i.state === 'open').length, has_issues: r.has_issues, has_wiki: r.has_wiki, has_projects: r.has_projects, has_discussions: r.has_discussions,
      allow_merge_commit: r.allow_merge_commit, allow_squash_merge: r.allow_squash_merge, allow_rebase_merge: r.allow_rebase_merge, allow_auto_merge: r.allow_auto_merge, delete_branch_on_merge: r.delete_branch_on_merge, allow_update_branch: r.allow_update_branch,
      permissions: { admin: role === 'admin', maintain: can(r, 'maintain'), push: can(r, 'write'), triage: can(r, 'triage'), pull: role != null },
    };
  };
  const hashNum = (s: string) => Number.parseInt(hashOf(s).slice(0, 7), 16);

  /* ── Helpers for writes ── */
  const issueOr404 = (r: ServerRepo, n: string | number) => r.issues.get(Number(n)) ?? notFound();
  const pullOr404 = (r: ServerRepo, n: string | number) => r.pulls.get(Number(n)) ?? notFound();
  const nextNumber = (r: ServerRepo) => Math.max(0, ...r.issues.keys()) + 1;
  const event = (i: ServerIssue, e: Omit<ServerEvent, 'id' | 'created_at' | 'actor'>, actor = viewer!) => {
    const at = tick();
    i.events.push({ ...e, id: id(), created_at: at, actor });
    i.updated_at = at;
  };
  const personOf = (login: string) => {
    const u = db.users.find((x) => x.login === login);
    return { name: u?.name ?? login, email: u?.email ?? `${login}@users.noreply.github.com`, login };
  };
  const commitTo = (r: ServerRepo, branch: string, message: string, files: ReadonlyMap<string, string>, parents?: string[]) => {
    const parent = r.git.branches.get(branch);
    const c = r.git.commit({ parents: parents ?? (parent ? [parent] : []), message, author: personOf(viewer!), date: tick(), files });
    r.git.branches.set(branch, c.sha);
    r.pushed_at = iso();
    startRunsFor(r, c, branch);
    return c;
  };
  /** A push starts the repository's CI: a check run that passes straight away unless the message asks otherwise. */
  const startRunsFor = (r: ServerRepo, c: GitCommit, branch: string) => {
    const workflow = r.workflows.find((w) => w.name === 'CI' && w.state === 'active');
    if (!workflow) return;
    const at = iso();
    const pull = [...r.pulls.values()].find((p) => p.head === branch && !p.merged_at && r.issues.get(p.number)?.state === 'open');
    const run = newRun(r, workflow, { title: c.message.split('\n')[0], event: pull ? 'pull_request' : 'push', branch, sha: c.sha, pull: pull?.number, status: 'completed', conclusion: 'success', at });
    r.checks[c.sha] = ['test', 'lint'].map((name) => ({ name: `CI / ${name}`, status: 'completed', conclusion: 'success', started_at: at, completed_at: at, run: run.id }));
  };
  const newRun = (r: ServerRepo, w: ServerWorkflow, o: { title: string; event: string; branch: string; sha: string; pull?: number; status: string; conclusion: string | null; at: string; actor?: string }) => {
    const number = Math.max(0, ...r.runs.filter((x) => x.workflow_id === w.id).map((x) => x.run_number)) + 1;
    const job = (name: string): ServerJob => ({
      id: id(), name, status: o.status, conclusion: o.conclusion, started_at: o.at, completed_at: o.status === 'completed' ? o.at : null,
      steps: ['Set up job', 'Run actions/checkout@v4', 'Run ' + name, 'Complete job'].map((s, i) => ({ number: i + 1, name: s, status: o.status, conclusion: o.conclusion, started_at: o.at, completed_at: o.status === 'completed' ? o.at : null })),
      log: `${o.at} Run ${name}\n${o.at} ${o.conclusion === 'failure' ? 'Error: Process completed with exit code 1.' : 'Done.'}\n`,
    });
    const run: ServerRun = {
      id: id(), workflow_id: w.id, name: w.name, display_title: o.title, run_number: number, run_attempt: 1, event: o.event, actor: o.actor ?? viewer ?? r.owner, head_branch: o.branch, head_sha: o.sha, status: o.status, conclusion: o.conclusion,
      created_at: o.at, run_started_at: o.at, updated_at: o.at, pull_request: o.pull, jobs: [job('test'), job('lint')],
    };
    r.runs.unshift(run);
    return run;
  };
  const runJson = (r: ServerRepo, x: ServerRun) => ({
    id: x.id, workflow_id: x.workflow_id, name: x.name, display_title: x.display_title, run_number: x.run_number, run_attempt: x.run_attempt, event: x.event, actor: user(x.actor), triggering_actor: user(x.actor), head_branch: x.head_branch, head_sha: x.head_sha,
    status: x.status, conclusion: x.conclusion, created_at: x.created_at, run_started_at: x.run_started_at, updated_at: x.updated_at, html_url: `${web(r)}/actions/runs/${x.id}`, path: r.workflows.find((w) => w.id === x.workflow_id)?.path ?? '',
    pull_requests: x.pull_request ? [{ number: x.pull_request }] : [], head_commit: { message: x.display_title, id: x.head_sha },
  });
  const jobJson = (r: ServerRepo, run: ServerRun, j: ServerJob) => ({
    id: j.id, run_id: run.id, name: j.name, status: j.status, conclusion: j.conclusion, started_at: j.started_at, completed_at: j.completed_at, html_url: `${web(r)}/actions/runs/${run.id}/job/${j.id}`, steps: j.steps,
  });
  const treeJson = (c: GitCommit) => {
    const dirs = new Set<string>();
    for (const p of c.files.keys()) {
      const parts = p.split('/');
      for (let i = 1; i < parts.length; i++) dirs.add(parts.slice(0, i).join('/'));
    }
    return {
      sha: c.sha, truncated: false,
      tree: [
        ...[...dirs].map((path) => ({ path, type: 'tree', mode: '040000', sha: hashOf(path) })),
        ...[...c.files].map(([path, text]) => ({ path, type: 'blob', mode: '100644', size: new TextEncoder().encode(text).length, sha: hashOf(text) })),
      ].sort((a, b) => a.path.localeCompare(b.path)),
    };
  };
  const contentJson = (r: ServerRepo, path: string, text: string) => ({
    type: 'file', name: path.split('/').at(-1), path, sha: hashOf(text), size: text.length, encoding: 'base64', content: btoa(unescape(encodeURIComponent(text))), html_url: `${web(r)}/blob/${r.default_branch}/${path}`,
  });
  const decode = (b64: string) => decodeURIComponent(escape(atob(b64.replace(/\s/g, ''))));

  /** Merge, squash or rebase `p` into its base; returns the sha it landed as. */
  const landPull = (r: ServerRepo, p: ServerPull, i: ServerIssue, method: string, title?: string, message?: string): string => {
    const { headSha, baseSha } = pullShas(r, p);
    const merged = r.git.merge(baseSha, headSha);
    const ahead = r.git.ahead(baseSha, headSha);
    const baseBefore = baseSha;
    let sha: string;
    const heading = title ?? (method === 'merge' ? `Merge pull request #${p.number} from ${r.owner}/${p.head}` : `${i.title} (#${p.number})`);
    const text = message ?? (method === 'merge' ? i.title : ahead.map((c) => `* ${c.message.split('\n')[0]}`).join('\n'));
    if (method === 'merge') sha = commitTo(r, p.base, `${heading}\n\n${text}`, merged.files, [baseSha, headSha]).sha;
    else if (method === 'squash') sha = commitTo(r, p.base, `${heading}\n\n${text}`, merged.files).sha;
    else {
      // Rebase: the same commits one after another on the base; the last one's tree is the merged result.
      let parent = baseSha;
      for (const c of ahead) {
        const replay = r.git.commit({ parents: [parent], message: c.message, author: c.author, committer: personOf(viewer!), date: tick(), files: c === ahead.at(-1) ? merged.files : c.files });
        parent = replay.sha;
      }
      r.git.branches.set(p.base, parent);
      sha = parent;
    }
    const at = tick();
    p.merged_at = at;
    p.merged_by = viewer;
    p.merge_commit_sha = sha;
    p.frozen = { base: baseBefore, head: headSha };
    p.auto_merge = null;
    i.state = 'closed';
    i.closed_at = at;
    i.closed_by = viewer;
    i.updated_at = at;
    i.events.push({ id: id(), event: 'merged', actor: viewer!, created_at: at, commit_id: sha });
    i.events.push({ id: id(), event: 'closed', actor: viewer!, created_at: at });
    // "Closes #n" in the description closes the issue, as on GitHub.
    for (const n of closingNumbers(i.body)) {
      const target = r.issues.get(n);
      if (target && !r.pulls.has(n) && target.state === 'open') {
        target.state = 'closed';
        target.state_reason = 'completed';
        target.closed_at = at;
        target.closed_by = viewer;
        target.updated_at = at;
        target.events.push({ id: id(), event: 'closed', actor: viewer!, created_at: at, commit_id: sha, source: p.number, state_reason: 'completed' });
      }
    }
    if (r.delete_branch_on_merge && !p.head_repo && p.head !== r.default_branch) {
      r.git.branches.delete(p.head);
      p.head_deleted = true;
      i.events.push({ id: id(), event: 'head_ref_deleted', actor: viewer!, created_at: at });
    }
    // Anything else based on the merged branch now has a moved base; nothing to do: its diff is computed on read.
    return sha;
  };

  /* ── Search ── */
  const tokenize = (q: string) => {
    const out: { key: string; value: string; negate: boolean }[] = [];
    const words: string[] = [];
    for (const m of q.matchAll(/(-?)([\w-]+):(?:"([^"]*)"|(\S+))|"([^"]*)"|(\S+)/g)) {
      if (m[2]) out.push({ key: m[2].toLowerCase(), value: m[3] ?? m[4] ?? '', negate: m[1] === '-' });
      else words.push((m[5] ?? m[6]).toLowerCase());
    }
    return { qualifiers: out, words };
  };
  const issueMatches = (r: ServerRepo, i: ServerIssue, q: string) => {
    const { qualifiers, words } = tokenize(q);
    const pr = r.pulls.get(i.number);
    const groups = new Map<string, boolean>();
    // Repeated qualifiers AND together; labels too, as on GitHub.
    const test = (key: string, value: string): boolean => {
      const v = value.toLowerCase();
      switch (key) {
        case 'repo': return full(r).toLowerCase() === v;
        case 'is':
          if (v === 'issue') return !pr;
          if (v === 'pr' || v === 'pull-request') return !!pr;
          if (v === 'open' || v === 'closed') return i.state === v;
          if (v === 'merged') return !!pr?.merged_at;
          if (v === 'unmerged') return !!pr && !pr.merged_at;
          if (v === 'draft') return !!pr?.draft;
          if (v === 'locked') return i.locked;
          return true;
        case 'state': return i.state === v;
        case 'reason': return (i.state_reason ?? '').replace('_', ' ') === v.replace('_', ' ') || (v === 'not planned' && i.state_reason === 'not_planned');
        case 'author': return i.user.toLowerCase() === v.replace(/^@me$/, viewer?.toLowerCase() ?? '');
        case 'assignee': return i.assignees.some((a) => a.toLowerCase() === v.replace(/^@me$/, viewer?.toLowerCase() ?? ''));
        case 'mentions': return (i.body + i.comments.map((c) => c.body).join(' ')).toLowerCase().includes('@' + v.replace(/^@me$/, viewer?.toLowerCase() ?? ''));
        case 'commenter': return i.comments.some((c) => c.user.toLowerCase() === v.replace(/^@me$/, viewer?.toLowerCase() ?? ''));
        case 'involves': {
          const me = v.replace(/^@me$/, viewer?.toLowerCase() ?? '');
          return i.user.toLowerCase() === me || i.assignees.some((a) => a.toLowerCase() === me) || i.comments.some((c) => c.user.toLowerCase() === me);
        }
        case 'label': return i.labels.some((l) => l.toLowerCase() === v);
        case 'milestone': return i.milestone != null && r.milestones.find((m) => m.number === i.milestone)?.title.toLowerCase() === v;
        case 'no':
          if (v === 'label') return !i.labels.length;
          if (v === 'assignee') return !i.assignees.length;
          if (v === 'milestone') return i.milestone == null;
          return true;
        case 'review':
          if (!pr) return false;
          if (v === 'none') return !pr.reviews.some((x) => x.state !== 'PENDING');
          if (v === 'required') return reviewDecision(pr) === 'REVIEW_REQUIRED';
          if (v === 'approved') return reviewDecision(pr) === 'APPROVED';
          if (v === 'changes_requested') return reviewDecision(pr) === 'CHANGES_REQUESTED';
          return true;
        case 'review-requested': return !!pr?.requested_reviewers.some((x) => x.toLowerCase() === v.replace(/^@me$/, viewer?.toLowerCase() ?? ''));
        case 'reviewed-by': return !!pr?.reviews.some((x) => x.user.toLowerCase() === v.replace(/^@me$/, viewer?.toLowerCase() ?? ''));
        case 'head': return pr?.head.toLowerCase() === v;
        case 'base': return pr?.base.toLowerCase() === v;
        case 'draft': return !!pr && pr.draft === (v === 'true');
        case 'status': {
          if (!pr) return false;
          const state = rollup(r, pullShas(r, pr).headSha);
          return v === 'success' ? state === 'SUCCESS' : v === 'failure' ? state === 'FAILURE' : v === 'pending' ? state === 'PENDING' : true;
        }
        default: return true;
      }
    };
    for (const q of qualifiers) {
      const hit = test(q.key, q.value);
      groups.set(q.key + q.value, q.negate ? !hit : hit);
    }
    if ([...groups.values()].some((v) => !v)) return false;
    const hay = (i.title + '\n' + i.body + '\n' + i.comments.map((c) => c.body).join('\n')).toLowerCase();
    return words.every((w) => hay.includes(w));
  };
  const sortIssues = (list: ServerIssue[], sort: string | null, order: string | null) => {
    const dir = order === 'asc' ? 1 : -1;
    const key = (i: ServerIssue) => {
      if (sort === 'comments') return i.comments.length;
      if (sort === 'updated') return Date.parse(i.updated_at);
      if (sort === 'reactions') return i.reactions.length;
      return Date.parse(i.created_at) + i.number / 1000;
    };
    return [...list].sort((a, b) => dir * (key(a) - key(b)));
  };
  const page = <T,>(ctx: Ctx, all: T[], perDefault = 30): Answer & { items: T[] } => {
    const per = Math.max(1, Math.min(100, Number(ctx.query.get('per_page') ?? perDefault)));
    const pg = Math.max(1, Number(ctx.query.get('page') ?? 1));
    const items = all.slice((pg - 1) * per, pg * per);
    const last = Math.max(1, Math.ceil(all.length / per));
    const url = (n: number) => {
      const q = new URLSearchParams(ctx.query);
      q.set('page', String(n));
      q.set('per_page', String(per));
      return `${ctx.params.__url}?${q}`;
    };
    const rels: string[] = [];
    if (pg < last) rels.push(`<${url(pg + 1)}>; rel="next"`, `<${url(last)}>; rel="last"`);
    if (pg > 1) rels.push(`<${url(pg - 1)}>; rel="prev"`, `<${url(1)}>; rel="first"`);
    return { items, headers: rels.length ? { link: rels.join(', ') } : {} };
  };
  const listAnswer = <T,>(ctx: Ctx, all: T[], json: (x: T) => unknown = (x) => x, per = 30): Answer => {
    const p = page(ctx, all, per);
    return { json: p.items.map(json), headers: p.headers };
  };
  const searchAnswer = <T,>(ctx: Ctx, all: T[], json: (x: T) => unknown): Answer => {
    const p = page(ctx, all);
    return { json: { total_count: all.length, incomplete_results: false, items: p.items.map(json) }, headers: p.headers };
  };

  /* ── Routes ── */
  const routes: [string, RegExp, string[], Handler, boolean][] = [];
  const add = (method: string, pattern: string, handler: Handler, repoScoped = pattern.startsWith('/repos/:owner/:repo')) => {
    const names: string[] = [];
    const rx = new RegExp('^' + pattern.replace(/:(\w+)\*?/g, (m, n: string) => { names.push(n); return m.endsWith('*') ? '(.*)' : '([^/]+)'; }) + '/?$');
    routes.push([method, rx, names, handler, repoScoped]);
  };

  /* Account */
  add('GET', '/user', () => { const me = authed(); const u = db.users.find((x) => x.login === me); return ok({ ...user(me), name: u?.name ?? me, email: u?.email ?? null, bio: u?.bio ?? null, public_repos: db.repos.filter((r) => r.owner === me).length, html_url: 'https://github.com/' + me }); });
  add('GET', '/user/orgs', () => { authed(); return ok((db.orgs ?? []).map((login) => ({ login, avatar_url: '', description: '' }))); });
  add('GET', '/user/repos', (ctx) => {
    const me = authed();
    const mine = db.repos.filter((r) => roleIn(r, me) && (r.owner === me || r.roles[me] || db.orgs?.includes(r.owner)));
    const sorted = [...mine].sort((a, b) => Date.parse(b.pushed_at) - Date.parse(a.pushed_at));
    return listAnswer(ctx, sorted, repoJson);
  });
  add('POST', '/user/repos', (ctx) => {
    const me = authed();
    const name = String(ctx.body?.name ?? '').trim();
    if (!/^[\w.-]+$/.test(name)) invalid('Repository creation failed.', [{ field: 'name', message: 'name is invalid' }]);
    if (db.repos.some((r) => r.owner === me && r.name.toLowerCase() === name.toLowerCase())) invalid('Repository creation failed.', [{ field: 'name', message: 'name already exists on this account' }]);
    const r = blankRepo(me, name, { description: ctx.body?.description ?? '', private: !!ctx.body?.private, homepage: ctx.body?.homepage ?? '' });
    if (ctx.body?.auto_init) {
      const c = r.git.commit({ parents: [], message: 'Initial commit', author: personOf(me), date: tick(), files: new Map([['README.md', `# ${name}\n\n${ctx.body?.description ?? ''}\n`]]) });
      r.git.branches.set('main', c.sha);
    }
    db.repos.push(r);
    return ok(repoJson(r), 201);
  }, false);
  add('GET', '/user/starred/:owner/:repo', (ctx) => {
    const r = findRepo(ctx.params.owner, ctx.params.repo);
    return r.stargazers.includes(authed()) ? noContent : notFound();
  }, false);
  add('PUT', '/user/starred/:owner/:repo', (ctx) => {
    const r = findRepo(ctx.params.owner, ctx.params.repo);
    const me = authed();
    if (!r.stargazers.includes(me)) r.stargazers.push(me);
    return noContent;
  }, false);
  add('DELETE', '/user/starred/:owner/:repo', (ctx) => {
    const r = findRepo(ctx.params.owner, ctx.params.repo);
    const me = authed();
    r.stargazers = r.stargazers.filter((x) => x !== me);
    return noContent;
  }, false);
  add('GET', '/user/starred', (ctx) => { const me = authed(); return listAnswer(ctx, db.repos.filter((r) => r.stargazers.includes(me)), repoJson); });
  add('GET', '/users/:login', (ctx) => {
    const u = db.users.find((x) => x.login.toLowerCase() === ctx.params.login.toLowerCase()) ?? notFound();
    return ok({ ...user(u!.login), name: u!.name, bio: u!.bio ?? null, public_repos: db.repos.filter((r) => r.owner === u!.login && !r.private).length });
  });

  /* Notifications */
  const notificationJson = (n: ServerNotification) => {
    const r = db.repos.find((x) => full(x) === n.repo);
    const type = n.subject.type === 'PullRequest' ? 'pulls' : n.subject.type === 'Issue' ? 'issues' : 'releases';
    return {
      id: n.id, unread: n.unread, reason: n.reason, updated_at: n.updated_at, last_read_at: null,
      subject: { title: n.subject.title, type: n.subject.type, url: `https://api.github.com/repos/${n.repo}/${type}/${n.subject.number ?? ''}`, latest_comment_url: null },
      repository: r ? { full_name: n.repo, private: r.private, html_url: web(r), owner: user(r.owner), name: r.name } : { full_name: n.repo },
    };
  };
  add('GET', '/notifications', (ctx) => {
    authed();
    const all = ctx.query.get('all') === 'true';
    return listAnswer(ctx, db.notifications.filter((n) => all || n.unread), notificationJson, 50);
  });
  add('PUT', '/notifications', () => {
    authed();
    for (const n of db.notifications) n.unread = false;
    return { status: 205 };
  });
  add('PATCH', '/notifications/threads/:id', (ctx) => {
    authed();
    const n = db.notifications.find((x) => x.id === ctx.params.id) ?? notFound();
    n!.unread = false;
    return { status: 205 };
  });
  add('DELETE', '/notifications/threads/:id', (ctx) => {
    authed();
    db.notifications = db.notifications.filter((x) => x.id !== ctx.params.id);
    return noContent;
  });

  /* Search */
  add('GET', '/search/repositories', (ctx) => {
    const q = ctx.query.get('q') ?? '';
    const { qualifiers, words } = tokenize(q);
    const user_ = qualifiers.find((x) => x.key === 'user' || x.key === 'org')?.value.toLowerCase();
    const hits = db.repos.filter((r) => roleIn(r, viewer)).filter((r) => {
      if (user_ && r.owner.toLowerCase() !== user_) return false;
      const hay = (full(r) + ' ' + r.description + ' ' + r.topics.join(' ')).toLowerCase();
      return words.every((w) => hay.includes(w));
    });
    return searchAnswer(ctx, hits, repoJson);
  });
  add('GET', '/search/users', (ctx) => {
    const q = (ctx.query.get('q') ?? '').toLowerCase().split(/\s+/)[0];
    return searchAnswer(ctx, db.users.filter((u) => u.login.toLowerCase().includes(q) || u.name.toLowerCase().includes(q)), (u) => user(u.login));
  });
  add('GET', '/search/issues', (ctx) => {
    const q = ctx.query.get('q') ?? '';
    const { qualifiers } = tokenize(q);
    const repoName = qualifiers.find((x) => x.key === 'repo')?.value.toLowerCase();
    const scoped = repoName ? db.repos.filter((r) => full(r).toLowerCase() === repoName) : db.repos;
    const hits: { r: ServerRepo; i: ServerIssue }[] = [];
    for (const r of scoped) {
      if (!roleIn(r, viewer)) continue;
      for (const i of r.issues.values()) if (issueMatches(r, i, q)) hits.push({ r, i });
    }
    const dir = ctx.query.get('order') === 'asc' ? 1 : -1;
    const sort = ctx.query.get('sort');
    const sorted = sort || repoName ? sortIssues(hits.map((h) => h.i), sort, ctx.query.get('order')).map((i) => hits.find((h) => h.i === i)!) : hits.sort((a, b) => dir * (Date.parse(a.i.created_at) - Date.parse(b.i.created_at)));
    return searchAnswer(ctx, sorted, ({ r, i }) => ({ ...issueJson(r, i), repository_url: `https://api.github.com/repos/${full(r)}` }));
  });
  add('GET', '/search/code', (ctx) => {
    const q = ctx.query.get('q') ?? '';
    const { qualifiers, words } = tokenize(q);
    const repoName = qualifiers.find((x) => x.key === 'repo')?.value.toLowerCase();
    const r = db.repos.find((x) => full(x).toLowerCase() === repoName);
    if (!r || !roleIn(r, viewer)) return searchAnswer(ctx, [], (x) => x);
    const head = r.git.resolve(r.default_branch);
    const hits = head ? [...head.files].filter(([path, text]) => words.every((w) => (path + '\n' + text).toLowerCase().includes(w))) : [];
    return searchAnswer(ctx, hits, ([path, text]) => {
      const line = text.split('\n').find((l) => words.some((w) => l.toLowerCase().includes(w))) ?? text.split('\n')[0];
      const fragment = line.slice(0, 160);
      const matches = words.flatMap((w) => { const at = fragment.toLowerCase().indexOf(w); return at >= 0 ? [{ text: fragment.slice(at, at + w.length), indices: [at, at + w.length] }] : []; });
      return { name: path.split('/').at(-1), path, sha: hashOf(text), html_url: `${web(r)}/blob/${r.default_branch}/${path}`, repository: { full_name: full(r) }, text_matches: [{ fragment, matches, property: 'content' }] };
    });
  });
  add('GET', '/search/commits', (ctx) => {
    const q = ctx.query.get('q') ?? '';
    const { qualifiers, words } = tokenize(q);
    const repoName = qualifiers.find((x) => x.key === 'repo')?.value.toLowerCase();
    const r = db.repos.find((x) => full(x).toLowerCase() === repoName);
    if (!r || !roleIn(r, viewer)) return searchAnswer(ctx, [], (x) => x);
    const head = r.git.branches.get(r.default_branch);
    const hits = head ? r.git.log(head).filter((c) => words.every((w) => c.message.toLowerCase().includes(w))) : [];
    return searchAnswer(ctx, hits, (c) => commitJson(r, c));
  });

  /* Repository */
  add('GET', '/repos/:owner/:repo', ({ repo }) => ok(repoJson(repo)));
  add('PATCH', '/repos/:owner/:repo', ({ repo, body }) => {
    must(repo, 'admin');
    if (body.archived === false && repo.archived) repo.archived = false;
    for (const k of ['description', 'homepage', 'has_issues', 'has_wiki', 'has_projects', 'has_discussions', 'allow_merge_commit', 'allow_squash_merge', 'allow_rebase_merge', 'allow_auto_merge', 'delete_branch_on_merge', 'allow_update_branch', 'archived'] as const) {
      if (k in body) (repo as any)[k] = body[k];
    }
    if (body.private !== undefined) repo.private = !!body.private;
    if (body.visibility) repo.private = body.visibility === 'private';
    if (body.default_branch) {
      if (!repo.git.branches.has(body.default_branch)) invalid('Validation Failed', [{ field: 'default_branch', message: 'The branch does not exist' }]);
      repo.default_branch = body.default_branch;
    }
    if (body.name && body.name !== repo.name) {
      if (db.repos.some((x) => x.owner === repo.owner && x.name.toLowerCase() === String(body.name).toLowerCase())) invalid('Validation Failed', [{ field: 'name', message: 'name already exists on this account' }]);
      repo.name = body.name;
    }
    return ok(repoJson(repo));
  });
  add('DELETE', '/repos/:owner/:repo', ({ repo }) => {
    must(repo, 'admin');
    if (!scopes.includes('delete_repo')) throw new HttpError(403, 'Must have admin rights to Repository.');
    db.repos = db.repos.filter((x) => x !== repo);
    return noContent;
  });
  add('PUT', '/repos/:owner/:repo/topics', ({ repo, body }) => {
    must(repo, 'admin');
    repo.topics = (body.names as string[]).map((t) => t.toLowerCase().trim()).filter(Boolean);
    return ok({ names: repo.topics });
  });
  add('GET', '/repos/:owner/:repo/topics', ({ repo }) => ok({ names: repo.topics }));
  add('GET', '/repos/:owner/:repo/languages', ({ repo }) => {
    const out: Record<string, number> = {};
    const head = repo.git.resolve(repo.default_branch);
    const LANG: Record<string, string> = { ts: 'TypeScript', tsx: 'TypeScript', js: 'JavaScript', json: '', md: '', yml: 'YAML', yaml: 'YAML', sql: 'PLpgSQL', css: 'CSS', html: 'HTML', sh: 'Shell' };
    for (const [p, t] of head?.files ?? []) {
      const lang = LANG[p.split('.').at(-1) ?? ''];
      if (lang) out[lang] = (out[lang] ?? 0) + t.length;
    }
    return ok(out);
  });
  add('GET', '/repos/:owner/:repo/contributors', (ctx) => {
    const head = ctx.repo.git.branches.get(ctx.repo.default_branch);
    const tally = new Map<string, number>();
    for (const c of head ? ctx.repo.git.log(head) : []) if (c.author.login) tally.set(c.author.login, (tally.get(c.author.login) ?? 0) + 1);
    const sorted = [...tally].sort((a, b) => b[1] - a[1]).map(([login, contributions]) => ({ ...user(login), contributions }));
    return listAnswer(ctx, sorted);
  });
  add('GET', '/repos/:owner/:repo/stargazers', (ctx) => listAnswer(ctx, ctx.repo.stargazers.map(user)));
  add('GET', '/repos/:owner/:repo/subscribers', (ctx) => listAnswer(ctx, ctx.repo.watchers.map(user)));
  add('GET', '/repos/:owner/:repo/forks', (ctx) => listAnswer(ctx, ctx.repo.forks.map((f) => db.repos.find((x) => full(x) === f)).filter(Boolean).map((x) => repoJson(x!))));
  add('POST', '/repos/:owner/:repo/forks', ({ repo, body }) => {
    const me = authed();
    const owner = body?.organization ?? me;
    const name = body?.name ?? repo.name;
    if (db.repos.some((x) => x.owner === owner && x.name.toLowerCase() === String(name).toLowerCase())) {
      const existing = db.repos.find((x) => x.owner === owner && x.name.toLowerCase() === String(name).toLowerCase())!;
      if (existing.parent === full(repo)) return ok(repoJson(existing), 202);
      invalid('Validation Failed', [{ field: 'name', message: 'name already exists on this account' }]);
    }
    const f = blankRepo(owner, name, { description: repo.description, homepage: repo.homepage, topics: [...repo.topics], license: repo.license });
    f.fork = true;
    f.parent = full(repo);
    f.default_branch = repo.default_branch;
    f.has_issues = false;
    for (const [k, v] of repo.git.commits) f.git.commits.set(k, v);
    const keep = body?.default_branch_only ? [repo.default_branch] : [...repo.git.branches.keys()];
    for (const b of keep) f.git.branches.set(b, repo.git.branches.get(b)!);
    for (const [t, sha] of repo.git.tags) f.git.tags.set(t, sha);
    f.labels = repo.labels.map((l) => ({ ...l }));
    db.repos.push(f);
    repo.forks.push(full(f));
    return ok(repoJson(f), 202);
  });
  add('GET', '/repos/:owner/:repo/subscription', ({ repo }) => {
    const me = authed();
    const s = repo.subscriptions[me];
    return s ? ok({ subscribed: s.subscribed, ignored: s.ignored, reason: null, created_at: repo.created_at }) : notFound();
  });
  add('PUT', '/repos/:owner/:repo/subscription', ({ repo, body }) => {
    const me = authed();
    repo.subscriptions[me] = { subscribed: !!body.subscribed, ignored: !!body.ignored };
    if (body.subscribed && !repo.watchers.includes(me)) repo.watchers.push(me);
    if (!body.subscribed) repo.watchers = repo.watchers.filter((x) => x !== me);
    return ok({ ...repo.subscriptions[me], reason: null, created_at: repo.created_at });
  });
  add('DELETE', '/repos/:owner/:repo/subscription', ({ repo }) => {
    const me = authed();
    delete repo.subscriptions[me];
    repo.watchers = repo.watchers.filter((x) => x !== me);
    return noContent;
  });
  add('GET', '/repos/:owner/:repo/collaborators', (ctx) => {
    must(ctx.repo, 'write');
    const logins = [ctx.repo.owner, ...Object.keys(ctx.repo.roles)];
    return listAnswer(ctx, logins, (login) => ({ ...user(login), role_name: roleIn(ctx.repo, login), permissions: { admin: can(ctx.repo, 'admin', login), maintain: can(ctx.repo, 'maintain', login), push: can(ctx.repo, 'write', login), triage: can(ctx.repo, 'triage', login), pull: true } }));
  });
  add('GET', '/repos/:owner/:repo/assignees', (ctx) => listAnswer(ctx, [ctx.repo.owner, ...Object.keys(ctx.repo.roles)], user, 30));
  add('PUT', '/repos/:owner/:repo/collaborators/:login', ({ repo, params, body }) => {
    must(repo, 'admin');
    if (!db.users.some((u) => u.login.toLowerCase() === params.login.toLowerCase())) notFound();
    repo.roles[params.login] = ({ pull: 'read', triage: 'triage', push: 'write', maintain: 'maintain', admin: 'admin' } as Record<string, Role>)[body?.permission ?? 'push'] ?? 'write';
    return { status: 201, json: { id: id(), invitee: user(params.login), permissions: body?.permission ?? 'write' } };
  });
  add('DELETE', '/repos/:owner/:repo/collaborators/:login', ({ repo, params }) => {
    must(repo, 'admin');
    delete repo.roles[params.login];
    return noContent;
  });

  /* Branches, tags, trees, contents */
  const branchJson = (r: ServerRepo, name: string, sha: string) => ({ name, commit: { sha, url: '' }, protected: !!r.protection[name] });
  add('GET', '/repos/:owner/:repo/branches', (ctx) => listAnswer(ctx, [...ctx.repo.git.branches].sort(([a], [b]) => a.localeCompare(b)).map(([n, s]) => branchJson(ctx.repo, n, s))));
  add('GET', '/repos/:owner/:repo/branches/:branch*', ({ repo, params }) => {
    const name = decodeURIComponent(params.branch);
    if (name.endsWith('/protection')) {
      const b = name.slice(0, -'/protection'.length);
      must(repo, 'admin');
      const p = repo.protection[b] ?? notFound();
      return ok({ required_pull_request_reviews: { required_approving_review_count: p!.required_reviews }, required_status_checks: { strict: !!p!.strict, contexts: p!.required_checks } });
    }
    const sha = repo.git.branches.get(name) ?? notFound();
    return ok({ ...branchJson(repo, name, sha!), commit: commitJson(repo, repo.git.commits.get(sha!)!) });
  });
  add('POST', '/repos/:owner/:repo/branches/:branch*', ({ repo, params, body }) => {
    const m = /^(.*)\/rename$/.exec(decodeURIComponent(params.branch));
    if (!m) return notFound();
    must(repo, 'write');
    const sha = repo.git.branches.get(m[1]) ?? notFound();
    if (repo.git.branches.has(body.new_name)) invalid('Validation Failed', [{ message: 'A branch with that name already exists' }]);
    repo.git.branches.delete(m[1]);
    repo.git.branches.set(body.new_name, sha!);
    if (repo.default_branch === m[1]) repo.default_branch = body.new_name;
    for (const p of repo.pulls.values()) { if (p.head === m[1]) p.head = body.new_name; if (p.base === m[1]) p.base = body.new_name; }
    return ok(branchJson(repo, body.new_name, sha!), 201);
  });
  add('GET', '/repos/:owner/:repo/tags', (ctx) => listAnswer(ctx, [...ctx.repo.git.tags].sort(([a], [b]) => b.localeCompare(a, undefined, { numeric: true })).map(([name, sha]) => ({ name, commit: { sha }, zipball_url: `${web(ctx.repo)}/archive/refs/tags/${name}.zip`, tarball_url: `${web(ctx.repo)}/archive/refs/tags/${name}.tar.gz` }))));
  add('POST', '/repos/:owner/:repo/git/refs', ({ repo, body }) => {
    must(repo, 'write');
    const ref = String(body.ref ?? '');
    const m = /^refs\/(heads|tags)\/(.+)$/.exec(ref);
    if (!m) invalid('Reference name must start with \'refs/\'.');
    const store = m![1] === 'heads' ? repo.git.branches : repo.git.tags;
    if (store.has(m![2])) invalid('Reference already exists');
    if (!repo.git.commits.has(body.sha)) invalid('Object does not exist');
    store.set(m![2], body.sha);
    if (m![1] === 'heads') {
      for (const p of repo.pulls.values()) {
        if (p.head !== m![2] || !p.head_deleted) continue;
        p.head_deleted = false;
        repo.issues.get(p.number)!.events.push({ id: id(), event: 'head_ref_restored', actor: viewer!, created_at: tick() });
      }
    }
    return ok({ ref, object: { sha: body.sha, type: 'commit' } }, 201);
  });
  add('DELETE', '/repos/:owner/:repo/git/refs/:ref*', ({ repo, params }) => {
    must(repo, 'write');
    const m = /^(heads|tags)\/(.+)$/.exec(decodeURIComponent(params.ref));
    if (!m) invalid('Reference does not exist');
    const store = m![1] === 'heads' ? repo.git.branches : repo.git.tags;
    if (!store.has(m![2])) invalid('Reference does not exist');
    if (m![1] === 'heads' && m![2] === repo.default_branch) invalid('Cannot delete the default branch');
    store.delete(m![2]);
    if (m![1] === 'heads') {
      for (const p of repo.pulls.values()) {
        if (p.head === m![2] && !p.merged_at) {
          p.head_deleted = true;
          const i = repo.issues.get(p.number)!;
          if (i.state === 'open') { i.state = 'closed'; i.closed_at = tick(); i.closed_by = viewer; }
          i.events.push({ id: id(), event: 'head_ref_deleted', actor: viewer!, created_at: iso() });
        } else if (p.head === m![2]) {
          p.head_deleted = true;
          repo.issues.get(p.number)!.events.push({ id: id(), event: 'head_ref_deleted', actor: viewer!, created_at: tick() });
        }
      }
    }
    return noContent;
  });
  add('GET', '/repos/:owner/:repo/git/trees/:ref*', ({ repo, params }) => {
    const c = repo.git.resolve(params.ref === 'HEAD' ? repo.default_branch : decodeURIComponent(params.ref)) ?? (repo.git.branches.size ? notFound() : null);
    if (!c) throw new HttpError(409, 'Git Repository is empty.');
    return ok(treeJson(c));
  });
  const atRef = (r: ServerRepo, ctx: Ctx) => {
    const ref = ctx.query.get('ref') || r.default_branch;
    const c = r.git.resolve(ref);
    if (!c) throw new HttpError(404, r.git.branches.size ? `No commit found for the ref ${ref}` : 'This repository is empty.');
    return c;
  };
  add('GET', '/repos/:owner/:repo/readme', (ctx) => {
    const c = atRef(ctx.repo, ctx);
    const path = [...c.files.keys()].find((p) => /^readme(\.|$)/i.test(p)) ?? notFound();
    const text = c.files.get(path!)!;
    return ctx.accept.includes('raw') ? { text } : ok(contentJson(ctx.repo, path!, text));
  });
  add('GET', '/repos/:owner/:repo/contents/:path*', (ctx) => {
    const path = decodeURIComponent(ctx.params.path).replace(/\/$/, '');
    const c = atRef(ctx.repo, ctx);
    const text = c.files.get(path);
    if (text === undefined) {
      const inside = [...c.files.keys()].filter((p) => !path || p.startsWith(path + '/'));
      if (!inside.length) notFound();
      const names = new Map<string, boolean>();
      for (const p of inside) {
        const rest = path ? p.slice(path.length + 1) : p;
        const [head, ...more] = rest.split('/');
        names.set(head, more.length > 0 || names.get(head) === true);
      }
      return ok([...names].map(([name, dir]) => ({ name, path: path ? `${path}/${name}` : name, type: dir ? 'dir' : 'file', sha: hashOf(name), size: dir ? 0 : (c.files.get(path ? `${path}/${name}` : name) ?? '').length })));
    }
    if (ctx.accept.includes('raw')) return { text };
    return ok(contentJson(ctx.repo, path, text));
  });
  const writeBranch = (r: ServerRepo, body: any) => {
    const branch = body.branch || r.default_branch;
    if (!r.git.branches.has(branch) && r.git.branches.size) throw new HttpError(404, `Branch ${branch} not found`);
    return branch as string;
  };
  add('PUT', '/repos/:owner/:repo/contents/:path*', ({ repo, params, body }) => {
    must(repo, 'write');
    const path = decodeURIComponent(params.path);
    const branch = writeBranch(repo, body);
    const head = repo.git.resolve(branch);
    const prev = head?.files.get(path);
    if (prev !== undefined && !body.sha) invalid('Invalid request.\n\n"sha" wasn\'t supplied.', [{ field: 'sha', code: 'missing' }]);
    if (prev !== undefined && body.sha !== hashOf(prev)) throw new HttpError(409, `${path} does not match ${body.sha}`);
    if (prev === undefined && body.sha) throw new HttpError(409, `${path} does not exist`);
    const files = new Map(head?.files ?? []);
    const text = decode(String(body.content ?? ''));
    files.set(path, text);
    const c = commitTo(repo, branch, String(body.message ?? `Update ${path}`), files);
    return ok({ content: contentJson(repo, path, text), commit: { sha: c.sha, message: c.message, html_url: `${web(repo)}/commit/${c.sha}` } }, prev === undefined ? 201 : 200);
  });
  add('DELETE', '/repos/:owner/:repo/contents/:path*', ({ repo, params, body }) => {
    must(repo, 'write');
    const path = decodeURIComponent(params.path);
    const branch = writeBranch(repo, body);
    const head = repo.git.resolve(branch);
    const prev = head?.files.get(path);
    if (prev === undefined) notFound();
    if (body.sha !== hashOf(prev!)) throw new HttpError(409, `${path} does not match ${body.sha}`);
    const files = new Map(head!.files);
    files.delete(path);
    const c = commitTo(repo, branch, String(body.message ?? `Delete ${path}`), files);
    return ok({ content: null, commit: { sha: c.sha, message: c.message, html_url: `${web(repo)}/commit/${c.sha}` } });
  });

  /* Commits and compare */
  add('GET', '/repos/:owner/:repo/commits', (ctx) => {
    const { repo, query } = ctx;
    const ref = query.get('sha') || repo.default_branch;
    if (!repo.git.branches.size) throw new HttpError(409, 'Git Repository is empty.');
    const c = repo.git.resolve(ref);
    if (!c) throw new HttpError(404, `No commit found for SHA: ${ref}`);
    const path = query.get('path');
    let list = path ? repo.git.history(c.sha, path) : repo.git.log(c.sha);
    const author = query.get('author')?.toLowerCase();
    if (author) list = list.filter((x) => x.author.login?.toLowerCase() === author || x.author.name.toLowerCase() === author);
    const since = query.get('since');
    const until = query.get('until');
    if (since) list = list.filter((x) => Date.parse(x.committer.date) >= Date.parse(since));
    if (until) list = list.filter((x) => Date.parse(x.committer.date) <= Date.parse(until));
    return listAnswer(ctx, list, (x) => commitJson(repo, x));
  });
  add('GET', '/repos/:owner/:repo/commits/:ref/check-runs', ({ repo, params }) => {
    const c = repo.git.resolve(decodeURIComponent(params.ref)) ?? notFound();
    const checks = checksFor(repo, c!.sha);
    return ok({
      total_count: checks.length,
      check_runs: checks.map((k, i) => ({ id: hashNum(k.name + c!.sha) + i, name: k.name, status: k.status, conclusion: k.conclusion, started_at: k.started_at, completed_at: k.completed_at, html_url: `${web(repo)}/runs/${k.run ?? 0}`, details_url: `${web(repo)}/actions/runs/${k.run ?? 0}`, output: { title: k.summary ?? null, summary: k.summary ?? null }, app: { name: 'GitHub Actions', slug: 'github-actions' }, head_sha: c!.sha })),
    });
  });
  add('GET', '/repos/:owner/:repo/commits/:ref/status', ({ repo, params }) => {
    const c = repo.git.resolve(decodeURIComponent(params.ref)) ?? notFound();
    const statuses = repo.statuses[c!.sha] ?? [];
    return ok({ state: statuses.some((s) => s.state === 'failure') ? 'failure' : statuses.some((s) => s.state === 'pending') ? 'pending' : 'success', statuses, sha: c!.sha, total_count: statuses.length });
  });
  add('GET', '/repos/:owner/:repo/commits/:ref/pulls', ({ repo, params }) => {
    const c = repo.git.resolve(decodeURIComponent(params.ref)) ?? notFound();
    return ok([...repo.pulls.values()].filter((p) => p.merge_commit_sha === c!.sha || pullShas(repo, p).headSha === c!.sha).map((p) => pullJson(repo, p)));
  });
  add('GET', '/repos/:owner/:repo/commits/:ref', ({ repo, params }) => ok(commitJson(repo, repo.git.resolve(decodeURIComponent(params.ref)) ?? (() => { throw new HttpError(422, `No commit found for SHA: ${params.ref}`); })(), true)));
  add('GET', '/repos/:owner/:repo/compare/:spec*', ({ repo, params }) => {
    const m = /^(.+?)\.\.\.(.+)$/.exec(decodeURIComponent(params.spec));
    if (!m) notFound();
    const [, baseRef, headSpec] = m!;
    const head = (() => {
      // owner:branch or owner:repo:branch: the head of a fork.
      const parts = headSpec.split(':');
      if (parts.length === 1) return { store: repo, ref: headSpec };
      const f = parts.length === 3 ? db.repos.find((x) => x.owner === parts[0] && x.name === parts[1]) : db.repos.find((x) => x.owner === parts[0] && (x.parent === full(repo) || x.name === repo.name));
      return f ? { store: f, ref: parts.at(-1)! } : notFound();
    })();
    const base = repo.git.resolve(baseRef) ?? notFound();
    const headCommit = head!.store.git.resolve(head!.ref) ?? notFound();
    for (const c of head!.store.git.log(headCommit!.sha)) if (!repo.git.commits.has(c.sha)) repo.git.commits.set(c.sha, c);
    const ancestor = repo.git.mergeBase(base!.sha, headCommit!.sha);
    const ahead = repo.git.ahead(base!.sha, headCommit!.sha);
    const behind = repo.git.ahead(headCommit!.sha, base!.sha);
    const files = diffTrees(ancestor?.files ?? new Map(), headCommit!.files);
    return ok({
      status: !ahead.length && !behind.length ? 'identical' : !behind.length ? 'ahead' : !ahead.length ? 'behind' : 'diverged', ahead_by: ahead.length, behind_by: behind.length, total_commits: ahead.length,
      html_url: `${web(repo)}/compare/${params.spec}`, merge_base_commit: ancestor ? commitJson(repo, ancestor) : null, commits: ahead.map((c) => commitJson(repo, c)), files: files.map(fileJson),
    });
  });

  /* Labels and milestones */
  add('GET', '/repos/:owner/:repo/labels', (ctx) => listAnswer(ctx, ctx.repo.labels, (l) => labelJson(ctx.repo, l.name)));
  add('POST', '/repos/:owner/:repo/labels', ({ repo, body }) => {
    must(repo, 'triage');
    if (repo.labels.some((l) => l.name.toLowerCase() === String(body.name).toLowerCase())) invalid('Validation Failed', [{ resource: 'Label', code: 'already_exists', field: 'name' }]);
    if (!/^[0-9a-fA-F]{6}$/.test(String(body.color))) invalid('Validation Failed', [{ resource: 'Label', code: 'invalid', field: 'color' }]);
    repo.labels.push({ name: body.name, color: body.color, description: body.description ?? null });
    return ok(labelJson(repo, body.name), 201);
  });
  add('PATCH', '/repos/:owner/:repo/labels/:name', ({ repo, params, body }) => {
    must(repo, 'triage');
    const name = decodeURIComponent(params.name);
    const l = repo.labels.find((x) => x.name === name) ?? notFound();
    if (body.new_name && body.new_name !== name) {
      if (repo.labels.some((x) => x.name.toLowerCase() === String(body.new_name).toLowerCase())) invalid('Validation Failed', [{ resource: 'Label', code: 'already_exists', field: 'name' }]);
      for (const i of repo.issues.values()) i.labels = i.labels.map((n) => (n === name ? body.new_name : n));
      l!.name = body.new_name;
    }
    if (body.color) l!.color = body.color;
    if ('description' in body) l!.description = body.description;
    return ok(labelJson(repo, l!.name));
  });
  add('DELETE', '/repos/:owner/:repo/labels/:name', ({ repo, params }) => {
    must(repo, 'triage');
    const name = decodeURIComponent(params.name);
    repo.labels = repo.labels.filter((x) => x.name !== name);
    for (const i of repo.issues.values()) i.labels = i.labels.filter((n) => n !== name);
    return noContent;
  });
  add('GET', '/repos/:owner/:repo/milestones', (ctx) => {
    const state = ctx.query.get('state') ?? 'open';
    const list = ctx.repo.milestones.filter((m) => state === 'all' || m.state === state);
    return listAnswer(ctx, list, (m) => milestoneJson(ctx.repo, m));
  });
  add('POST', '/repos/:owner/:repo/milestones', ({ repo, body }) => {
    must(repo, 'triage');
    if (!String(body.title ?? '').trim()) invalid('Validation Failed', [{ resource: 'Milestone', code: 'missing_field', field: 'title' }]);
    if (repo.milestones.some((m) => m.title === body.title)) invalid('Validation Failed', [{ resource: 'Milestone', code: 'already_exists', field: 'title' }]);
    const m: ServerMilestone = { number: Math.max(0, ...repo.milestones.map((x) => x.number)) + 1, title: body.title, description: body.description ?? '', state: body.state ?? 'open', due_on: body.due_on ?? null, created_at: tick(), closed_at: null };
    repo.milestones.push(m);
    return ok(milestoneJson(repo, m), 201);
  });
  add('GET', '/repos/:owner/:repo/milestones/:n', ({ repo, params }) => ok(milestoneJson(repo, repo.milestones.find((m) => m.number === Number(params.n)) ?? notFound())));
  add('PATCH', '/repos/:owner/:repo/milestones/:n', ({ repo, params, body }) => {
    must(repo, 'triage');
    const m = repo.milestones.find((x) => x.number === Number(params.n)) ?? notFound();
    for (const k of ['title', 'description', 'due_on'] as const) if (k in body) (m as any)[k] = body[k];
    if (body.state && body.state !== m!.state) {
      m!.state = body.state;
      m!.closed_at = body.state === 'closed' ? tick() : null;
    }
    return ok(milestoneJson(repo, m!));
  });
  add('DELETE', '/repos/:owner/:repo/milestones/:n', ({ repo, params }) => {
    must(repo, 'triage');
    repo.milestones = repo.milestones.filter((m) => m.number !== Number(params.n));
    for (const i of repo.issues.values()) if (i.milestone === Number(params.n)) i.milestone = null;
    return noContent;
  });

  /* Issues */
  const canEditIssue = (r: ServerRepo, i: ServerIssue) => i.user === viewer || can(r, 'triage');
  const applyLabels = (r: ServerRepo, i: ServerIssue, next: string[]) => {
    for (const n of next) if (!r.labels.some((l) => l.name === n)) r.labels.push({ name: n, color: 'ededed', description: null });
    for (const n of next) if (!i.labels.includes(n)) event(i, { event: 'labeled', label: { name: n, color: r.labels.find((l) => l.name === n)?.color ?? 'ededed' } });
    for (const n of i.labels) if (!next.includes(n)) event(i, { event: 'unlabeled', label: { name: n, color: r.labels.find((l) => l.name === n)?.color ?? 'ededed' } });
    i.labels = [...new Set(next)];
  };
  const applyAssignees = (r: ServerRepo, i: ServerIssue, next: string[]) => {
    const allowed = new Set([r.owner, ...Object.keys(r.roles), i.user]);
    const valid = next.filter((n) => allowed.has(n));
    for (const n of valid) if (!i.assignees.includes(n)) event(i, { event: 'assigned', assignee: n });
    for (const n of i.assignees) if (!valid.includes(n)) event(i, { event: 'unassigned', assignee: n });
    i.assignees = [...new Set(valid)];
  };
  const setState = (r: ServerRepo, i: ServerIssue, state: 'open' | 'closed', reason?: string | null) => {
    if (state === i.state) {
      if (state === 'closed' && reason && reason !== i.state_reason) i.state_reason = reason;
      return;
    }
    if (state === 'open' && r.pulls.get(i.number)?.merged_at) invalid('Validation Failed', [{ message: 'Cannot reopen a merged pull request' }]);
    const at = tick();
    i.state = state;
    i.updated_at = at;
    i.closed_at = state === 'closed' ? at : null;
    i.closed_by = state === 'closed' ? viewer : null;
    i.state_reason = state === 'closed' ? (reason ?? 'completed') : 'reopened';
    i.events.push({ id: id(), event: state === 'closed' ? 'closed' : 'reopened', actor: viewer!, created_at: at, state_reason: i.state_reason });
  };
  const findIssue = (r: ServerRepo, n: string) => {
    const i = r.issues.get(Number(n));
    if (!i) throw new HttpError(404, 'Not Found');
    if (!r.has_issues && !r.pulls.has(Number(n))) throw new HttpError(410, 'Issues are disabled for this repo');
    return i;
  };
  add('GET', '/repos/:owner/:repo/issues', (ctx) => {
    const { repo, query } = ctx;
    if (!repo.has_issues) return listAnswer(ctx, []);
    const state = query.get('state') ?? 'open';
    let list = [...repo.issues.values()].filter((i) => state === 'all' || i.state === state);
    const label = query.get('labels');
    if (label) for (const l of label.split(',')) list = list.filter((i) => i.labels.includes(l));
    const assignee = query.get('assignee');
    if (assignee === 'none') list = list.filter((i) => !i.assignees.length);
    else if (assignee && assignee !== '*') list = list.filter((i) => i.assignees.includes(assignee));
    const creator = query.get('creator');
    if (creator) list = list.filter((i) => i.user === creator);
    const milestone = query.get('milestone');
    if (milestone && milestone !== '*') list = list.filter((i) => (milestone === 'none' ? i.milestone == null : i.milestone === Number(milestone)));
    const sorted = sortIssues(list, query.get('sort') ?? 'created', query.get('direction'));
    return listAnswer(ctx, sorted, (i) => issueJson(repo, i));
  });
  add('POST', '/repos/:owner/:repo/issues', ({ repo, body }) => {
    const me = authed();
    if (repo.archived) throw new HttpError(403, 'Repository was archived so is read-only.');
    if (!repo.has_issues) throw new HttpError(410, 'Issues are disabled for this repo');
    if (!String(body.title ?? '').trim()) invalid('Validation Failed', [{ resource: 'Issue', code: 'missing_field', field: 'title' }]);
    const number = nextNumber(repo);
    const at = tick();
    const i: ServerIssue = { number, title: body.title, body: body.body ?? '', state: 'open', state_reason: null, user: me, created_at: at, updated_at: at, closed_at: null, labels: [], assignees: [], milestone: null, locked: false, active_lock_reason: null, comments: [], events: [], reactions: [] };
    repo.issues.set(number, i);
    // Only people with triage can set these when opening an issue; for others GitHub silently drops them.
    if (can(repo, 'triage')) {
      if (body.labels?.length) applyLabels(repo, i, body.labels.map((l: any) => (typeof l === 'string' ? l : l.name)));
      if (body.assignees?.length) applyAssignees(repo, i, body.assignees);
      if (body.milestone != null) { i.milestone = Number(body.milestone); event(i, { event: 'milestoned', milestone: repo.milestones.find((m) => m.number === Number(body.milestone))?.title }); }
    }
    return ok(issueJson(repo, i), 201);
  });
  add('GET', '/repos/:owner/:repo/issues/comments/:id', ({ repo, params }) => {
    for (const i of repo.issues.values()) {
      const c = i.comments.find((x) => x.id === Number(params.id));
      if (c) return ok(commentJson(repo, i.number, c));
    }
    return notFound();
  });
  const findComment = (r: ServerRepo, cid: number) => {
    for (const i of r.issues.values()) {
      const c = i.comments.find((x) => x.id === cid);
      if (c) return { i, c };
    }
    return notFound();
  };
  add('PATCH', '/repos/:owner/:repo/issues/comments/:id', ({ repo, params, body }) => {
    const hit = findComment(repo, Number(params.id))!;
    if (hit.c.user !== viewer && !can(repo, 'triage')) throw new HttpError(403, 'Must have triage access to edit other people\'s comments.');
    hit.c.body = body.body;
    hit.c.updated_at = tick();
    return ok(commentJson(repo, hit.i.number, hit.c));
  });
  add('DELETE', '/repos/:owner/:repo/issues/comments/:id', ({ repo, params }) => {
    const hit = findComment(repo, Number(params.id))!;
    if (hit.c.user !== viewer && !can(repo, 'triage')) throw new HttpError(403, 'Must have triage access to delete other people\'s comments.');
    hit.i.comments = hit.i.comments.filter((x) => x !== hit.c);
    return noContent;
  });
  const reactOn = (rs: ServerReaction[], content: string): Answer => {
    const me = authed();
    const hit = rs.find((x) => x.user === me && x.content === content);
    if (hit) return ok({ id: hit.id, content, user: user(me) }, 200);
    const reaction = { id: id(), content, user: me };
    rs.push(reaction);
    return ok({ id: reaction.id, content, user: user(me) }, 201);
  };
  const reactionList = (ctx: Ctx, rs: ServerReaction[]) => listAnswer(ctx, rs, (x) => ({ id: x.id, content: x.content, user: user(x.user) }), 100);
  add('GET', '/repos/:owner/:repo/issues/comments/:id/reactions', (ctx) => reactionList(ctx, findComment(ctx.repo, Number(ctx.params.id))!.c.reactions));
  add('POST', '/repos/:owner/:repo/issues/comments/:id/reactions', ({ repo, params, body }) => reactOn(findComment(repo, Number(params.id))!.c.reactions, body.content));
  add('DELETE', '/repos/:owner/:repo/issues/comments/:id/reactions/:rid', ({ repo, params }) => {
    const { c } = findComment(repo, Number(params.id))!;
    c.reactions = c.reactions.filter((x) => x.id !== Number(params.rid));
    return noContent;
  });
  add('GET', '/repos/:owner/:repo/issues/:n', ({ repo, params }) => ok(issueJson(repo, findIssue(repo, params.n))));
  add('PATCH', '/repos/:owner/:repo/issues/:n', ({ repo, params, body }) => {
    authed();
    const i = findIssue(repo, params.n);
    if (repo.archived) throw new HttpError(403, 'Repository was archived so is read-only.');
    if (!canEditIssue(repo, i)) throw new HttpError(403, 'Must have triage access to edit this issue.');
    if (body.title !== undefined && body.title !== i.title) {
      if (!String(body.title).trim()) invalid('Validation Failed', [{ resource: 'Issue', code: 'missing_field', field: 'title' }]);
      event(i, { event: 'renamed', rename: { from: i.title, to: body.title } });
      i.title = body.title;
    }
    if (body.body !== undefined) { i.body = body.body; i.updated_at = tick(); }
    if (body.state) setState(repo, i, body.state, body.state_reason);
    else if (body.state_reason && i.state === 'closed') i.state_reason = body.state_reason;
    if (can(repo, 'triage')) {
      if (body.labels) applyLabels(repo, i, body.labels.map((l: any) => (typeof l === 'string' ? l : l.name)));
      if (body.assignees) applyAssignees(repo, i, body.assignees);
      if (body.milestone !== undefined) {
        const next = body.milestone == null ? null : Number(body.milestone);
        if (next !== i.milestone) {
          if (i.milestone != null) event(i, { event: 'demilestoned', milestone: repo.milestones.find((m) => m.number === i.milestone)?.title });
          if (next != null) event(i, { event: 'milestoned', milestone: repo.milestones.find((m) => m.number === next)?.title });
          i.milestone = next;
        }
      }
    }
    return ok(issueJson(repo, i));
  });
  add('PUT', '/repos/:owner/:repo/issues/:n/lock', ({ repo, params, body }) => {
    must(repo, 'triage');
    const i = findIssue(repo, params.n);
    i.locked = true;
    i.active_lock_reason = body?.lock_reason ?? null;
    event(i, { event: 'locked', lock_reason: i.active_lock_reason });
    return noContent;
  });
  add('DELETE', '/repos/:owner/:repo/issues/:n/lock', ({ repo, params }) => {
    must(repo, 'triage');
    const i = findIssue(repo, params.n);
    i.locked = false;
    i.active_lock_reason = null;
    event(i, { event: 'unlocked' });
    return noContent;
  });
  add('GET', '/repos/:owner/:repo/issues/:n/comments', (ctx) => listAnswer(ctx, findIssue(ctx.repo, ctx.params.n).comments, (c) => commentJson(ctx.repo, Number(ctx.params.n), c)));
  add('POST', '/repos/:owner/:repo/issues/:n/comments', ({ repo, params, body }) => {
    const me = authed();
    const i = findIssue(repo, params.n);
    if (repo.archived) throw new HttpError(403, 'Repository was archived so is read-only.');
    if (i.locked && !can(repo, 'triage')) throw new HttpError(403, 'This conversation has been locked and limited to collaborators.');
    if (!String(body.body ?? '').trim()) invalid('Validation Failed', [{ resource: 'IssueComment', code: 'missing_field', field: 'body' }]);
    const at = tick();
    const c: ServerComment = { id: id(), user: me, body: body.body, created_at: at, updated_at: at, reactions: [] };
    i.comments.push(c);
    i.updated_at = at;
    return ok(commentJson(repo, i.number, c), 201);
  });
  add('POST', '/repos/:owner/:repo/issues/:n/labels', ({ repo, params, body }) => {
    must(repo, 'triage');
    const i = findIssue(repo, params.n);
    applyLabels(repo, i, [...i.labels, ...(body.labels ?? body)]);
    return ok(i.labels.map((n) => labelJson(repo, n)));
  });
  add('PUT', '/repos/:owner/:repo/issues/:n/labels', ({ repo, params, body }) => {
    must(repo, 'triage');
    const i = findIssue(repo, params.n);
    applyLabels(repo, i, body.labels ?? body);
    return ok(i.labels.map((n) => labelJson(repo, n)));
  });
  add('DELETE', '/repos/:owner/:repo/issues/:n/labels/:name', ({ repo, params }) => {
    must(repo, 'triage');
    const i = findIssue(repo, params.n);
    applyLabels(repo, i, i.labels.filter((n) => n !== decodeURIComponent(params.name)));
    return ok(i.labels.map((n) => labelJson(repo, n)));
  });
  add('POST', '/repos/:owner/:repo/issues/:n/assignees', ({ repo, params, body }) => {
    must(repo, 'triage');
    const i = findIssue(repo, params.n);
    applyAssignees(repo, i, [...i.assignees, ...body.assignees]);
    return ok(issueJson(repo, i), 201);
  });
  add('DELETE', '/repos/:owner/:repo/issues/:n/assignees', ({ repo, params, body }) => {
    must(repo, 'triage');
    const i = findIssue(repo, params.n);
    applyAssignees(repo, i, i.assignees.filter((a) => !body.assignees.includes(a)));
    return ok(issueJson(repo, i));
  });
  add('GET', '/repos/:owner/:repo/issues/:n/reactions', (ctx) => reactionList(ctx, findIssue(ctx.repo, ctx.params.n).reactions));
  add('POST', '/repos/:owner/:repo/issues/:n/reactions', ({ repo, params, body }) => reactOn(findIssue(repo, params.n).reactions, body.content));
  add('DELETE', '/repos/:owner/:repo/issues/:n/reactions/:rid', ({ repo, params }) => {
    const i = findIssue(repo, params.n);
    i.reactions = i.reactions.filter((x) => x.id !== Number(params.rid));
    return noContent;
  });
  add('GET', '/repos/:owner/:repo/issues/:n/timeline', (ctx) => {
    const { repo, params } = ctx;
    const i = findIssue(repo, params.n);
    const p = repo.pulls.get(i.number);
    type Row = { at: string; json: unknown };
    const rows: Row[] = [];
    for (const c of i.comments) rows.push({ at: c.created_at, json: { event: 'commented', ...commentJson(repo, i.number, c), actor: user(c.user) } });
    for (const e of i.events) {
      rows.push({
        at: e.created_at,
        json: {
          event: e.event, id: e.id, actor: user(e.actor), created_at: e.created_at, commit_id: e.commit_id ?? null, state_reason: e.state_reason ?? null,
          ...(e.label ? { label: e.label } : {}), ...(e.assignee ? { assignee: user(e.assignee) } : {}), ...(e.reviewer ? { requested_reviewer: user(e.reviewer), review_requester: user(e.actor) } : {}),
          ...(e.rename ? { rename: e.rename } : {}), ...(e.milestone ? { milestone: { title: e.milestone } } : {}), ...(e.lock_reason ? { lock_reason: e.lock_reason } : {}),
          ...(e.event === 'cross-referenced' && e.source ? { source: { type: 'issue', issue: issueJson(repo, repo.issues.get(e.source)!) }, updated_at: e.created_at } : {}),
        },
      });
    }
    if (p) {
      for (const v of p.reviews) {
        if (v.state === 'PENDING' && v.user !== viewer) continue;
        rows.push({ at: v.submitted_at ?? iso(), json: { event: 'reviewed', id: v.id, node_id: 'PRR_' + v.id, user: user(v.user), body: v.body, state: v.state.toLowerCase(), submitted_at: v.submitted_at, commit_id: v.commit_id, author_association: association(repo, v.user), html_url: `${web(repo)}/pull/${p.number}#pullrequestreview-${v.id}` } });
      }
      const { baseSha, headSha } = pullShas(repo, p);
      if (headSha && baseSha && repo.git.commits.has(headSha)) {
        for (const c of repo.git.ahead(baseSha, headSha)) {
          rows.push({ at: c.committer.date, json: { event: 'committed', sha: c.sha, node_id: 'C_' + c.sha, message: c.message, author: c.author, committer: c.committer, html_url: `${web(repo)}/commit/${c.sha}` } });
        }
      }
    }
    rows.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
    return listAnswer(ctx, rows, (x) => x.json, 100);
  });

  /* Pull requests */
  add('GET', '/repos/:owner/:repo/pulls', (ctx) => {
    const { repo, query } = ctx;
    const state = query.get('state') ?? 'open';
    const head = query.get('head');
    const base = query.get('base');
    const list = [...repo.pulls.values()].filter((p) => {
      const i = repo.issues.get(p.number)!;
      if (state !== 'all' && i.state !== state) return false;
      if (base && p.base !== base) return false;
      if (head) {
        const [owner, branch] = head.includes(':') ? head.split(':') : [repo.owner, head];
        if (p.head !== branch || headRepo(repo, p).owner !== owner) return false;
      }
      return true;
    }).sort((a, b) => b.number - a.number);
    return listAnswer(ctx, list, (p) => pullJson(repo, p));
  });
  add('POST', '/repos/:owner/:repo/pulls', ({ repo, body }) => {
    const me = authed();
    if (repo.archived) throw new HttpError(403, 'Repository was archived so is read-only.');
    if (!String(body.title ?? '').trim()) invalid('Validation Failed', [{ resource: 'PullRequest', code: 'missing_field', field: 'title' }]);
    if (!repo.git.branches.has(body.base)) invalid('Validation Failed', [{ resource: 'PullRequest', code: 'invalid', field: 'base' }]);
    const [owner, branch] = String(body.head ?? '').includes(':') ? String(body.head).split(':') : [repo.owner, String(body.head ?? '')];
    const source = owner === repo.owner ? repo : db.repos.find((x) => x.owner === owner && x.parent === full(repo));
    if (!source?.git.branches.has(branch)) invalid('Validation Failed', [{ resource: 'PullRequest', code: 'invalid', field: 'head' }]);
    const open = [...repo.pulls.values()].find((p) => p.head === branch && p.base === body.base && headRepo(repo, p) === source && repo.issues.get(p.number)?.state === 'open');
    if (open) invalid('Validation Failed', [{ resource: 'PullRequest', code: 'custom', message: `A pull request already exists for ${owner}:${branch}.` }]);
    if (source !== repo) for (const c of source!.git.log(source!.git.branches.get(branch)!)) if (!repo.git.commits.has(c.sha)) repo.git.commits.set(c.sha, c);
    if (!repo.git.ahead(repo.git.branches.get(body.base)!, source!.git.branches.get(branch)!).length) invalid('Validation Failed', [{ resource: 'PullRequest', code: 'custom', message: `No commits between ${body.base} and ${branch}` }]);
    const number = nextNumber(repo);
    const at = tick();
    repo.issues.set(number, { number, title: body.title, body: body.body ?? '', state: 'open', state_reason: null, user: me, created_at: at, updated_at: at, closed_at: null, labels: [], assignees: [], milestone: null, locked: false, active_lock_reason: null, comments: [], events: [], reactions: [] });
    const p: ServerPull = { number, base: body.base, head: branch, head_repo: source === repo ? undefined : full(source!), draft: !!body.draft, merged_at: null, merged_by: null, merge_commit_sha: null, requested_reviewers: [], requested_teams: [], reviews: [], review_comments: [], threads: [], maintainer_can_modify: !!body.maintainer_can_modify, auto_merge: null, viewed: [] };
    repo.pulls.set(number, p);
    return ok(pullJson(repo, p), 201);
  });
  add('GET', '/repos/:owner/:repo/pulls/comments/:id', ({ repo, params }) => {
    for (const p of repo.pulls.values()) {
      const c = p.review_comments.find((x) => x.id === Number(params.id));
      if (c) return ok(reviewCommentJson(repo, p, c));
    }
    return notFound();
  });
  const findReviewComment = (r: ServerRepo, cid: number) => {
    for (const p of r.pulls.values()) {
      const c = p.review_comments.find((x) => x.id === cid);
      if (c) return { p, c };
    }
    return notFound();
  };
  add('PATCH', '/repos/:owner/:repo/pulls/comments/:id', ({ repo, params, body }) => {
    const hit = findReviewComment(repo, Number(params.id))!;
    if (hit.c.user !== viewer && !can(repo, 'triage')) throw new HttpError(403, 'Must have triage access to edit other people\'s comments.');
    hit.c.body = body.body;
    hit.c.updated_at = tick();
    return ok(reviewCommentJson(repo, hit.p, hit.c));
  });
  add('DELETE', '/repos/:owner/:repo/pulls/comments/:id', ({ repo, params }) => {
    const hit = findReviewComment(repo, Number(params.id))!;
    if (hit.c.user !== viewer && !can(repo, 'triage')) throw new HttpError(403, 'Must have triage access to delete other people\'s comments.');
    hit.p.review_comments = hit.p.review_comments.filter((x) => x !== hit.c);
    return noContent;
  });
  add('POST', '/repos/:owner/:repo/pulls/comments/:id/reactions', ({ repo, params, body }) => reactOn(findReviewComment(repo, Number(params.id))!.c.reactions, body.content));
  add('GET', '/repos/:owner/:repo/pulls/comments/:id/reactions', (ctx) => reactionList(ctx, findReviewComment(ctx.repo, Number(ctx.params.id))!.c.reactions));
  add('DELETE', '/repos/:owner/:repo/pulls/comments/:id/reactions/:rid', ({ repo, params }) => {
    const { c } = findReviewComment(repo, Number(params.id))!;
    c.reactions = c.reactions.filter((x) => x.id !== Number(params.rid));
    return noContent;
  });
  add('GET', '/repos/:owner/:repo/pulls/:n', ({ repo, params }) => ok(pullJson(repo, pullOr404(repo, params.n)!)));
  add('PATCH', '/repos/:owner/:repo/pulls/:n', ({ repo, params, body }) => {
    authed();
    const p = pullOr404(repo, params.n)!;
    const i = issueOr404(repo, params.n)!;
    if (repo.archived) throw new HttpError(403, 'Repository was archived so is read-only.');
    if (!canEditIssue(repo, i) && !can(repo, 'write')) throw new HttpError(403, 'Must have write access to edit this pull request.');
    if (body.title !== undefined && body.title !== i.title) {
      if (!String(body.title).trim()) invalid('Validation Failed', [{ resource: 'PullRequest', code: 'missing_field', field: 'title' }]);
      event(i, { event: 'renamed', rename: { from: i.title, to: body.title } });
      i.title = body.title;
    }
    if (body.body !== undefined) { i.body = body.body; i.updated_at = tick(); }
    if (body.base && body.base !== p.base) {
      if (!repo.git.branches.has(body.base)) invalid('Validation Failed', [{ resource: 'PullRequest', code: 'invalid', field: 'base' }]);
      event(i, { event: 'base_ref_changed', rename: { from: p.base, to: body.base } });
      p.base = body.base;
    }
    if (body.state) {
      if (body.state === 'open' && p.head_deleted) invalid('Validation Failed', [{ message: 'The head branch was deleted: restore it before reopening.' }]);
      setState(repo, i, body.state);
    }
    return ok(pullJson(repo, p));
  });
  add('GET', '/repos/:owner/:repo/pulls/:n/commits', (ctx) => {
    const { repo, params } = ctx;
    const p = pullOr404(repo, params.n)!;
    syncFork(repo, p);
    const { baseSha, headSha } = pullShas(repo, p);
    return listAnswer(ctx, headSha && baseSha ? repo.git.ahead(baseSha, headSha) : [], (c) => commitJson(repo, c));
  });
  add('GET', '/repos/:owner/:repo/pulls/:n/files', (ctx) => listAnswer(ctx, pullDiff(ctx.repo, pullOr404(ctx.repo, ctx.params.n)!), fileJson));
  add('GET', '/repos/:owner/:repo/pulls/:n/merge', ({ repo, params }) => (pullOr404(repo, params.n)!.merged_at ? noContent : notFound()));
  add('PUT', '/repos/:owner/:repo/pulls/:n/merge', ({ repo, params, body }) => {
    must(repo, 'write');
    const p = pullOr404(repo, params.n)!;
    const i = issueOr404(repo, params.n)!;
    if (p.merged_at) throw new HttpError(405, 'Pull Request is already merged');
    if (i.state === 'closed') throw new HttpError(405, 'Pull Request is closed');
    if (p.draft) throw new HttpError(405, 'Pull Request is in draft state');
    const method = body?.merge_method ?? 'merge';
    const allowed = { merge: repo.allow_merge_commit, squash: repo.allow_squash_merge, rebase: repo.allow_rebase_merge }[method as 'merge'];
    if (!allowed) throw new HttpError(405, `${method} merges are not allowed on this repository.`);
    if (body?.sha && body.sha !== pullShas(repo, p).headSha) throw new HttpError(409, 'Head branch was modified. Review and try the merge again.');
    const state = mergeability(repo, p, i).mergeable_state;
    if (state === 'dirty') throw new HttpError(405, 'Pull Request is not mergeable');
    if (state === 'blocked' || state === 'behind') throw new HttpError(405, state === 'behind' ? 'Head branch is not up to date with the base branch' : 'At least 1 approving review is required by reviewers with write access. Required status check is expected.');
    const sha = landPull(repo, p, i, method, body?.commit_title, body?.commit_message);
    return ok({ sha, merged: true, message: 'Pull Request successfully merged' });
  });
  add('PUT', '/repos/:owner/:repo/pulls/:n/update-branch', ({ repo, params }) => {
    authed();
    const p = pullOr404(repo, params.n)!;
    const h = headRepo(repo, p);
    if (!can(h, 'write') && !(p.maintainer_can_modify && can(repo, 'write'))) throw new HttpError(403, 'Must have write access to the head branch.');
    const { baseSha, headSha } = pullShas(repo, p);
    const merged = repo.git.merge(headSha, baseSha);
    if (merged.conflicts.length) invalid('merge conflict between base and head');
    const c = h.git.commit({ parents: [headSha, baseSha], message: `Merge branch '${p.base}' into ${p.head}`, author: personOf(viewer!), date: tick(), files: merged.files });
    h.git.branches.set(p.head, c.sha);
    if (h !== repo) repo.git.commits.set(c.sha, c);
    startRunsFor(repo, c, p.head);
    return ok({ message: 'Updating pull request branch.', url: `${web(repo)}/pull/${p.number}` }, 202);
  });
  add('GET', '/repos/:owner/:repo/pulls/:n/requested_reviewers', ({ repo, params }) => {
    const p = pullOr404(repo, params.n)!;
    return ok({ users: p.requested_reviewers.map(user), teams: p.requested_teams.map((name) => ({ name, slug: name })) });
  });
  add('POST', '/repos/:owner/:repo/pulls/:n/requested_reviewers', ({ repo, params, body }) => {
    must(repo, 'triage');
    const p = pullOr404(repo, params.n)!;
    const i = issueOr404(repo, params.n)!;
    for (const login of body.reviewers ?? []) {
      if (login === i.user) invalid('Review cannot be requested from pull request author.');
      if (!p.requested_reviewers.includes(login)) {
        p.requested_reviewers.push(login);
        event(i, { event: 'review_requested', reviewer: login });
      }
    }
    return ok(pullJson(repo, p), 201);
  });
  add('DELETE', '/repos/:owner/:repo/pulls/:n/requested_reviewers', ({ repo, params, body }) => {
    must(repo, 'triage');
    const p = pullOr404(repo, params.n)!;
    const i = issueOr404(repo, params.n)!;
    for (const login of body.reviewers ?? []) {
      if (p.requested_reviewers.includes(login)) {
        p.requested_reviewers = p.requested_reviewers.filter((x) => x !== login);
        event(i, { event: 'review_request_removed', reviewer: login });
      }
    }
    return ok(pullJson(repo, p));
  });
  const reviewJson = (r: ServerRepo, p: ServerPull, v: ServerReview) => ({
    id: v.id, node_id: 'PRR_' + v.id, user: user(v.user), body: v.body, state: v.state, submitted_at: v.submitted_at, commit_id: v.commit_id, author_association: association(r, v.user), html_url: `${web(r)}/pull/${p.number}#pullrequestreview-${v.id}`,
  });
  const reviewCommentJson = (r: ServerRepo, p: ServerPull, c: ServerReviewComment) => {
    const file = pullDiff(r, p).find((f) => f.path === c.path);
    return {
      id: c.id, node_id: 'PRRC_' + c.id, pull_request_review_id: c.review_id, user: user(c.user), body: c.body, path: c.path, line: c.line, start_line: c.start_line, original_line: c.line, side: c.side, commit_id: c.commit_id, original_commit_id: c.commit_id,
      created_at: c.created_at, updated_at: c.updated_at, in_reply_to_id: c.in_reply_to_id, html_url: `${web(r)}/pull/${p.number}#discussion_r${c.id}`, author_association: association(r, c.user), diff_hunk: file?.patch.split('\n').slice(0, 6).join('\n') ?? '', reactions: reactionSummary(c.reactions, ''),
    };
  };
  add('GET', '/repos/:owner/:repo/pulls/:n/reviews', (ctx) => {
    const p = pullOr404(ctx.repo, ctx.params.n)!;
    return listAnswer(ctx, p.reviews.filter((v) => v.state !== 'PENDING' || v.user === viewer), (v) => reviewJson(ctx.repo, p, v));
  });
  add('POST', '/repos/:owner/:repo/pulls/:n/reviews', ({ repo, params, body }) => {
    const me = authed();
    if (repo.archived) throw new HttpError(403, 'Repository was archived so is read-only.');
    const p = pullOr404(repo, params.n)!;
    const i = issueOr404(repo, params.n)!;
    const eventName = body?.event as string | undefined;
    const STATES: Record<string, ServerReview['state']> = { APPROVE: 'APPROVED', REQUEST_CHANGES: 'CHANGES_REQUESTED', COMMENT: 'COMMENTED' };
    if (i.user === me && (eventName === 'APPROVE' || eventName === 'REQUEST_CHANGES')) invalid('Unprocessable Entity', [`Can not ${eventName === 'APPROVE' ? 'approve' : 'request changes on'} your own pull request`]);
    if ((eventName === 'REQUEST_CHANGES' || eventName === 'COMMENT') && !String(body.body ?? '').trim() && !body.comments?.length) {
      invalid('Unprocessable Entity', [`Review body is required for ${eventName.toLowerCase().replace('_', ' ')}`]);
    }
    if (eventName && eventName !== 'PENDING' && !can(repo, 'read')) throw new HttpError(403, 'Forbidden');
    // GitHub allows one pending review per person and this endpoint won't add to it.
    if (p.reviews.some((v) => v.state === 'PENDING' && v.user === me)) invalid('Unprocessable Entity', ['User can only have one pending review per pull request']);
    const headSha = pullShas(repo, p).headSha;
    const review: ServerReview = { id: id(), user: me, state: 'PENDING', body: '', submitted_at: null, commit_id: body?.commit_id ?? headSha };
    p.reviews.push(review);
    for (const c of body?.comments ?? []) addReviewComment(repo, p, review, me, c);
    if (eventName && eventName !== 'PENDING') {
      review.state = STATES[eventName];
      review.body = body.body ?? '';
      review.submitted_at = tick();
      p.requested_reviewers = p.requested_reviewers.filter((x) => x !== me);
    }
    return ok(reviewJson(repo, p, review));
  });
  add('POST', '/repos/:owner/:repo/pulls/:n/reviews/:id/events', ({ repo, params, body }) => {
    const me = authed();
    const p = pullOr404(repo, params.n)!;
    const v = p.reviews.find((x) => x.id === Number(params.id) && x.user === me) ?? notFound();
    const STATES: Record<string, ServerReview['state']> = { APPROVE: 'APPROVED', REQUEST_CHANGES: 'CHANGES_REQUESTED', COMMENT: 'COMMENTED' };
    v!.state = STATES[body.event];
    v!.body = body.body ?? '';
    v!.submitted_at = tick();
    return ok(reviewJson(repo, p, v!));
  });
  add('DELETE', '/repos/:owner/:repo/pulls/:n/reviews/:id', ({ repo, params }) => {
    const p = pullOr404(repo, params.n)!;
    const v = p.reviews.find((x) => x.id === Number(params.id)) ?? notFound();
    if (v!.state !== 'PENDING') invalid('Can not delete a non-pending pull request review');
    p.reviews = p.reviews.filter((x) => x !== v);
    p.review_comments = p.review_comments.filter((c) => c.review_id !== v!.id);
    return ok(reviewJson(repo, p, v!));
  });
  add('PUT', '/repos/:owner/:repo/pulls/:n/reviews/:id/dismissals', ({ repo, params, body }) => {
    must(repo, 'write');
    const p = pullOr404(repo, params.n)!;
    const i = issueOr404(repo, params.n)!;
    const v = p.reviews.find((x) => x.id === Number(params.id)) ?? notFound();
    v!.state = 'DISMISSED';
    event(i, { event: 'review_dismissed', rename: { from: v!.user, to: String(body.message ?? '') } });
    return ok(reviewJson(repo, p, v!));
  });
  const addReviewComment = (r: ServerRepo, p: ServerPull, review: ServerReview, me: string, c: any): ServerReviewComment => {
    const file = pullDiff(r, p).find((f) => f.path === c.path);
    if (!file) invalid('Validation Failed', [{ resource: 'PullRequestReviewComment', code: 'invalid', field: 'path', message: 'path is not part of the diff' }]);
    if (c.line == null && c.position == null && c.subject_type !== 'file') invalid('Validation Failed', [{ resource: 'PullRequestReviewComment', code: 'missing_field', field: 'line' }]);
    const thread: ServerThread = { id: id(), resolved: false, resolved_by: null };
    p.threads.push(thread);
    const at = tick();
    const row: ServerReviewComment = { id: id(), review_id: review.id, user: me, body: c.body, path: c.path, line: c.line, start_line: c.start_line ?? null, side: c.side ?? 'RIGHT', commit_id: review.commit_id, created_at: at, updated_at: at, thread: thread.id, reactions: [] };
    p.review_comments.push(row);
    return row;
  };
  add('GET', '/repos/:owner/:repo/pulls/:n/comments', (ctx) => {
    const p = pullOr404(ctx.repo, ctx.params.n)!;
    const shown = p.review_comments.filter((c) => p.reviews.find((v) => v.id === c.review_id)?.state !== 'PENDING' || c.user === viewer);
    return listAnswer(ctx, shown, (c) => reviewCommentJson(ctx.repo, p, c));
  });
  add('POST', '/repos/:owner/:repo/pulls/:n/comments', ({ repo, params, body }) => {
    const me = authed();
    if (repo.archived) throw new HttpError(403, 'Repository was archived so is read-only.');
    const p = pullOr404(repo, params.n)!;
    const headSha = pullShas(repo, p).headSha;
    const review: ServerReview = { id: id(), user: me, state: 'COMMENTED', body: '', submitted_at: tick(), commit_id: body.commit_id ?? headSha };
    p.reviews.push(review);
    return ok(reviewCommentJson(repo, p, addReviewComment(repo, p, review, me, body)), 201);
  });
  add('POST', '/repos/:owner/:repo/pulls/:n/comments/:id/replies', ({ repo, params, body }) => {
    const me = authed();
    const p = pullOr404(repo, params.n)!;
    const parent = p.review_comments.find((c) => c.id === Number(params.id)) ?? notFound();
    const review: ServerReview = { id: id(), user: me, state: 'COMMENTED', body: '', submitted_at: tick(), commit_id: parent!.commit_id };
    p.reviews.push(review);
    const at = tick();
    const c: ServerReviewComment = { ...parent!, id: id(), review_id: review.id, user: me, body: body.body, created_at: at, updated_at: at, in_reply_to_id: parent!.id, reactions: [] };
    p.review_comments.push(c);
    return ok(reviewCommentJson(repo, p, c), 201);
  });

  /* Actions */
  add('GET', '/repos/:owner/:repo/actions/workflows', ({ repo }) => ok({ total_count: repo.workflows.length, workflows: repo.workflows.map((w) => ({ id: w.id, name: w.name, path: w.path, state: w.state, html_url: `${web(repo)}/actions/workflows/${w.path.split('/').at(-1)}` })) }));
  add('PUT', '/repos/:owner/:repo/actions/workflows/:id/disable', ({ repo, params }) => {
    must(repo, 'write');
    const w = repo.workflows.find((x) => String(x.id) === params.id) ?? notFound();
    w!.state = 'disabled_manually';
    return noContent;
  });
  add('PUT', '/repos/:owner/:repo/actions/workflows/:id/enable', ({ repo, params }) => {
    must(repo, 'write');
    const w = repo.workflows.find((x) => String(x.id) === params.id) ?? notFound();
    w!.state = 'active';
    return noContent;
  });
  add('POST', '/repos/:owner/:repo/actions/workflows/:id/dispatches', ({ repo, params, body }) => {
    must(repo, 'write');
    const w = repo.workflows.find((x) => String(x.id) === params.id) ?? notFound();
    if (w!.state !== 'active') invalid('Workflow is disabled');
    const c = repo.git.resolve(body.ref ?? '') ?? (() => invalid(`No ref found for: ${body.ref}`))();
    if (!c!.files.get(w!.path)?.includes('workflow_dispatch')) invalid(`Workflow does not have 'workflow_dispatch' trigger`);
    newRun(repo, w!, { title: w!.name, event: 'workflow_dispatch', branch: body.ref, sha: c!.sha, status: 'in_progress', conclusion: null, at: tick() });
    return noContent;
  });
  const runFilter = (ctx: Ctx, runs: ServerRun[]) => {
    const { query, repo } = ctx;
    let list = runs;
    const status = query.get('status');
    if (status) list = list.filter((r) => (['success', 'failure', 'cancelled', 'skipped', 'timed_out'].includes(status) ? r.conclusion === status : r.status === status));
    const branch = query.get('branch');
    if (branch) list = list.filter((r) => r.head_branch === branch);
    const eventName = query.get('event');
    if (eventName) list = list.filter((r) => r.event === eventName);
    const actor = query.get('actor');
    if (actor) list = list.filter((r) => r.actor === actor);
    const p = page(ctx, list);
    return { json: { total_count: list.length, workflow_runs: p.items.map((x) => runJson(repo, x)) }, headers: p.headers };
  };
  add('GET', '/repos/:owner/:repo/actions/workflows/:id/runs', (ctx) => runFilter(ctx, ctx.repo.runs.filter((r) => String(r.workflow_id) === ctx.params.id)));
  add('GET', '/repos/:owner/:repo/actions/runs', (ctx) => runFilter(ctx, ctx.repo.runs));
  const runOr404 = (r: ServerRepo, runId: string) => r.runs.find((x) => String(x.id) === runId) ?? notFound();
  add('GET', '/repos/:owner/:repo/actions/runs/:id', ({ repo, params }) => ok(runJson(repo, runOr404(repo, params.id)!)));
  add('DELETE', '/repos/:owner/:repo/actions/runs/:id', ({ repo, params }) => {
    must(repo, 'write');
    const x = runOr404(repo, params.id)!;
    if (x.status !== 'completed') throw new HttpError(403, 'Cannot delete a run that is in progress.');
    repo.runs = repo.runs.filter((y) => y !== x);
    return noContent;
  });
  add('GET', '/repos/:owner/:repo/actions/runs/:id/jobs', (ctx) => {
    const x = runOr404(ctx.repo, ctx.params.id)!;
    return { json: { total_count: x.jobs.length, jobs: x.jobs.map((j) => jobJson(ctx.repo, x, j)) } };
  });
  add('POST', '/repos/:owner/:repo/actions/runs/:id/cancel', ({ repo, params }) => {
    must(repo, 'write');
    const x = runOr404(repo, params.id)!;
    if (x.status === 'completed') throw new HttpError(409, 'Cannot cancel a workflow run that is completed.');
    x.status = 'completed';
    x.conclusion = 'cancelled';
    x.updated_at = tick();
    for (const j of x.jobs) {
      if (j.status !== 'completed') {
        j.status = 'completed';
        j.conclusion = 'cancelled';
        j.completed_at = x.updated_at;
        for (const s of j.steps) if (s.status !== 'completed') { s.status = 'completed'; s.conclusion = 'cancelled'; s.completed_at = x.updated_at; }
      }
    }
    return ok({}, 202);
  });
  const rerun = (r: ServerRepo, x: ServerRun, onlyFailed: boolean) => {
    if (x.status !== 'completed') throw new HttpError(403, 'This workflow is already running');
    x.run_attempt++;
    const at = tick();
    x.status = 'completed';
    x.conclusion = 'success';
    x.updated_at = at;
    x.run_started_at = at;
    x.actor = viewer!;
    for (const j of x.jobs) {
      if (onlyFailed && j.conclusion === 'success') continue;
      j.status = 'completed';
      j.conclusion = 'success';
      j.started_at = at;
      j.completed_at = at;
      for (const s of j.steps) { s.status = 'completed'; s.conclusion = 'success'; s.started_at = at; s.completed_at = at; }
    }
    // The checks on that commit follow the run.
    for (const k of r.checks[x.head_sha] ?? []) {
      if (k.run === x.id) { k.status = 'completed'; k.conclusion = 'success'; k.started_at = at; k.completed_at = at; }
    }
  };
  add('POST', '/repos/:owner/:repo/actions/runs/:id/rerun', ({ repo, params }) => { must(repo, 'write'); rerun(repo, runOr404(repo, params.id)!, false); return ok({}, 201); });
  add('POST', '/repos/:owner/:repo/actions/runs/:id/rerun-failed-jobs', ({ repo, params }) => { must(repo, 'write'); rerun(repo, runOr404(repo, params.id)!, true); return ok({}, 201); });
  add('GET', '/repos/:owner/:repo/actions/jobs/:id/logs', ({ repo, params }) => {
    must(repo, 'read');
    for (const x of repo.runs) {
      const j = x.jobs.find((y) => String(y.id) === params.id);
      if (j) return { text: j.log ?? '' };
    }
    return notFound();
  });

  /* Releases */
  const releaseJson = (r: ServerRepo, x: ServerRelease) => ({
    id: x.id, tag_name: x.tag_name, name: x.name, body: x.body, draft: x.draft, prerelease: x.prerelease, created_at: x.created_at, published_at: x.published_at, author: user(x.author), target_commitish: x.target_commitish, html_url: `${web(r)}/releases/tag/${x.tag_name}`,
    zipball_url: `${web(r)}/archive/refs/tags/${x.tag_name}.zip`, tarball_url: `${web(r)}/archive/refs/tags/${x.tag_name}.tar.gz`, assets: x.assets.map((a) => ({ ...a, browser_download_url: `${web(r)}/releases/download/${x.tag_name}/${a.name}` })),
  });
  const publicReleases = (r: ServerRepo) => r.releases.filter((x) => !x.draft || can(r, 'write'));
  add('GET', '/repos/:owner/:repo/releases', (ctx) => listAnswer(ctx, publicReleases(ctx.repo), (x) => releaseJson(ctx.repo, x)));
  add('GET', '/repos/:owner/:repo/releases/latest', ({ repo }) => {
    const x = repo.releases.find((y) => !y.draft && !y.prerelease);
    return x ? ok(releaseJson(repo, x)) : notFound();
  });
  add('GET', '/repos/:owner/:repo/releases/tags/:tag*', ({ repo, params }) => {
    const x = repo.releases.find((y) => y.tag_name === decodeURIComponent(params.tag)) ?? notFound();
    return ok(releaseJson(repo, x!));
  });
  add('POST', '/repos/:owner/:repo/releases/generate-notes', ({ repo, body }) => {
    must(repo, 'write');
    const head = repo.git.resolve(body.target_commitish || repo.default_branch);
    const previous = body.previous_tag_name || [...repo.git.tags.keys()].sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))[0];
    const base = previous ? repo.git.resolve(previous) : undefined;
    const list = head ? (base ? repo.git.ahead(base.sha, head.sha) : repo.git.log(head.sha)) : [];
    return ok({ name: body.tag_name, body: `## What's Changed\n${list.map((c) => `* ${c.message.split('\n')[0]} by @${c.author.login ?? c.author.name}`).join('\n')}\n` });
  });
  add('POST', '/repos/:owner/:repo/releases', ({ repo, body }) => {
    must(repo, 'write');
    const tag = String(body.tag_name ?? '').trim();
    if (!tag) invalid('Validation Failed', [{ resource: 'Release', code: 'missing_field', field: 'tag_name' }]);
    if (repo.releases.some((x) => x.tag_name === tag)) invalid('Validation Failed', [{ resource: 'Release', code: 'already_exists', field: 'tag_name' }]);
    const target = repo.git.resolve(body.target_commitish || repo.default_branch);
    if (!body.draft && !repo.git.tags.has(tag) && target) repo.git.tags.set(tag, target.sha);
    const at = tick();
    const x: ServerRelease = { id: id(), tag_name: tag, name: body.name || tag, body: body.body ?? '', draft: !!body.draft, prerelease: !!body.prerelease, created_at: at, published_at: body.draft ? null : at, author: viewer!, target_commitish: body.target_commitish || repo.default_branch, assets: [] };
    repo.releases.unshift(x);
    return ok(releaseJson(repo, x), 201);
  });
  add('GET', '/repos/:owner/:repo/releases/:id', ({ repo, params }) => ok(releaseJson(repo, repo.releases.find((x) => String(x.id) === params.id) ?? notFound())));
  add('PATCH', '/repos/:owner/:repo/releases/:id', ({ repo, params, body }) => {
    must(repo, 'write');
    const x = repo.releases.find((y) => String(y.id) === params.id) ?? notFound();
    for (const k of ['name', 'body', 'prerelease'] as const) if (k in body) (x as any)[k] = body[k];
    if (body.tag_name) x!.tag_name = body.tag_name;
    if (body.draft === false && x!.draft) {
      x!.draft = false;
      x!.published_at = tick();
      const target = repo.git.resolve(x!.target_commitish);
      if (!repo.git.tags.has(x!.tag_name) && target) repo.git.tags.set(x!.tag_name, target.sha);
    }
    return ok(releaseJson(repo, x!));
  });
  add('DELETE', '/repos/:owner/:repo/releases/:id', ({ repo, params }) => {
    must(repo, 'write');
    repo.releases = repo.releases.filter((x) => String(x.id) !== params.id);
    return noContent;
  });

  /* Insights */
  const weekOf = (t: number) => Math.floor(t / 604800000) * 604800;
  add('GET', '/repos/:owner/:repo/stats/contributors', ({ repo }) => {
    const head = repo.git.branches.get(repo.default_branch);
    const by = new Map<string, Map<number, { a: number; d: number; c: number }>>();
    for (const c of head ? repo.git.log(head) : []) {
      if (!c.author.login) continue;
      const weeks = by.get(c.author.login) ?? new Map();
      by.set(c.author.login, weeks);
      const w = weekOf(Date.parse(c.author.date));
      const row = weeks.get(w) ?? { a: 0, d: 0, c: 0 };
      const parent = c.parents[0] ? repo.git.commits.get(c.parents[0]) : undefined;
      for (const f of diffTrees(parent?.files ?? new Map(), c.files)) { row.a += f.additions; row.d += f.deletions; }
      row.c++;
      weeks.set(w, row);
    }
    return ok([...by].map(([login, weeks]) => ({
      author: user(login), total: [...weeks.values()].reduce((s: number, x: any) => s + x.c, 0),
      weeks: [...weeks].sort(([a], [b]) => a - b).map(([w, x]: any) => ({ w, a: x.a, d: x.d, c: x.c })),
    })).sort((a, b) => a.total - b.total));
  });
  add('GET', '/repos/:owner/:repo/stats/commit_activity', ({ repo }) => {
    const head = repo.git.branches.get(repo.default_branch);
    const end = weekOf(clock);
    const weeks = Array.from({ length: 52 }, (_, i) => ({ week: end - (51 - i) * 604800, total: 0, days: [0, 0, 0, 0, 0, 0, 0] }));
    for (const c of head ? repo.git.log(head) : []) {
      const t = Date.parse(c.author.date);
      const row = weeks.find((w) => w.week === weekOf(t));
      if (row) { row.total++; row.days[new Date(t).getUTCDay()]++; }
    }
    return ok(weeks);
  });
  add('GET', '/repos/:owner/:repo/stats/code_frequency', ({ repo }) => {
    const head = repo.git.branches.get(repo.default_branch);
    const by = new Map<number, [number, number]>();
    for (const c of head ? repo.git.log(head) : []) {
      const parent = c.parents[0] ? repo.git.commits.get(c.parents[0]) : undefined;
      const w = weekOf(Date.parse(c.author.date));
      const row = by.get(w) ?? [0, 0];
      for (const f of diffTrees(parent?.files ?? new Map(), c.files)) { row[0] += f.additions; row[1] -= f.deletions; }
      by.set(w, row);
    }
    return ok([...by].sort(([a], [b]) => a - b).map(([w, [a, d]]) => [w, a, d]));
  });
  add('GET', '/repos/:owner/:repo/traffic/views', ({ repo }) => {
    must(repo, 'write');
    const v = repo.traffic?.views ?? [];
    return ok({ count: v.reduce((a, b) => a + b, 0), uniques: Math.round(v.reduce((a, b) => a + b, 0) * 0.42), views: v.map((count, i) => ({ timestamp: iso(clock - (v.length - 1 - i) * 86400000), count, uniques: Math.round(count * 0.42) })) });
  });
  add('GET', '/repos/:owner/:repo/traffic/clones', ({ repo }) => {
    must(repo, 'write');
    const v = repo.traffic?.clones ?? [];
    return ok({ count: v.reduce((a, b) => a + b, 0), uniques: Math.round(v.reduce((a, b) => a + b, 0) * 0.6), clones: v.map((count, i) => ({ timestamp: iso(clock - (v.length - 1 - i) * 86400000), count, uniques: Math.round(count * 0.6) })) });
  });
  add('GET', '/repos/:owner/:repo/traffic/popular/referrers', ({ repo }) => { must(repo, 'write'); return ok(repo.traffic?.referrers ?? []); });
  add('GET', '/repos/:owner/:repo/traffic/popular/paths', ({ repo }) => { must(repo, 'write'); return ok(repo.traffic?.paths ?? []); });

  /* ── GraphQL ── */
  const gqlIssue = (r: ServerRepo, nodeId: string) => {
    const n = Number(/_(\d+)$/.exec(nodeId)?.[1]);
    return r.issues.get(n);
  };
  const repoOfNode = (nodeId: string) => {
    const m = /^(?:PR|I)_(.+)_\d+$/.exec(nodeId);
    return m ? db.repos.find((r) => r.name === m[1] && roleIn(r, viewer)) : undefined;
  };
  const threadJson = (r: ServerRepo, p: ServerPull, t: ServerThread) => {
    const comments = p.review_comments.filter((c) => c.thread === t.id && (p.reviews.find((v) => v.id === c.review_id)?.state !== 'PENDING' || c.user === viewer));
    const first = comments[0];
    const file = first ? pullDiff(r, p).find((f) => f.path === first.path) : undefined;
    return {
      id: 'T_' + t.id, isResolved: t.resolved, isOutdated: !!first && first.commit_id !== pullShas(r, p).headSha && !file, path: first?.path, line: first?.line, startLine: first?.start_line, diffSide: first?.side,
      resolvedBy: t.resolved_by ? user(t.resolved_by) : null, viewerCanResolve: can(r, 'write') || p.number === -1, viewerCanUnresolve: can(r, 'write'), viewerCanReply: !!viewer,
      comments: { nodes: comments.map((c) => ({
        databaseId: c.id, id: 'PRRC_' + c.id, body: c.body, author: user(c.user), createdAt: c.created_at, authorAssociation: association(r, c.user), url: `${web(r)}/pull/${p.number}#discussion_r${c.id}`, diffHunk: file?.patch.split('\n').slice(0, 8).join('\n') ?? '',
        viewerCanUpdate: c.user === viewer || can(r, 'triage'), viewerCanDelete: c.user === viewer || can(r, 'triage'), pullRequestReview: { databaseId: c.review_id, state: p.reviews.find((v) => v.id === c.review_id)?.state },
      })) },
    };
  };
  const graphql = (query: string, variables: Record<string, any>, operationName?: string) => {
    const op = operationName ?? /(?:query|mutation)\s+(\w+)/.exec(query)?.[1] ?? '';
    const repoVar = () => {
      const r = db.repos.find((x) => x.owner.toLowerCase() === String(variables.owner).toLowerCase() && x.name.toLowerCase() === String(variables.name).toLowerCase());
      if (!r || !roleIn(r, viewer)) throw new GraphQLProblem(`Could not resolve to a Repository with the name '${variables.owner}/${variables.name}'.`, 'NOT_FOUND');
      return r;
    };
    switch (op) {
      case 'Counts': {
        const r = repoVar();
        const rows = [...r.issues.values()];
        const issues = rows.filter((i) => !r.pulls.has(i.number));
        const pulls = rows.filter((i) => r.pulls.has(i.number));
        return { repository: {
          openIssues: { totalCount: issues.filter((i) => i.state === 'open').length }, closedIssues: { totalCount: issues.filter((i) => i.state === 'closed').length },
          openPulls: { totalCount: pulls.filter((i) => i.state === 'open').length }, closedPulls: { totalCount: pulls.filter((i) => i.state === 'closed').length },
        } };
      }
      case 'LastCommits': {
        const r = repoVar();
        const c = r.git.resolve(!variables.ref || variables.ref === 'HEAD' ? r.default_branch : variables.ref);
        if (!c) return { repository: { object: null } };
        const out: Record<string, unknown> = { __typename: 'Commit' };
        for (const m of query.matchAll(/(\w+):\s*history\(first:\s*1,\s*path:\s*"([^"]*)"\)/g)) {
          const [hit] = r.git.history(c.sha, JSON.parse(`"${m[2]}"`));
          out[m[1]] = { nodes: hit ? [{ oid: hit.sha, messageHeadline: hit.message.split('\n')[0], committedDate: hit.committer.date, author: { name: hit.author.name, user: hit.author.login ? user(hit.author.login) : null } }] : [] };
        }
        return { repository: { object: out } };
      }
      case 'PullRows': {
        const r = repoVar();
        const out: Record<string, unknown> = {};
        for (const m of query.matchAll(/p(\d+):\s*pullRequest\(number:\s*(\d+)\)/g)) {
          const p = r.pulls.get(Number(m[2]));
          if (!p) continue;
          const { headSha } = pullShas(r, p);
          const state = rollup(r, headSha);
          out[`p${m[1]}`] = {
            number: p.number, isDraft: p.draft, reviewDecision: r.protection[p.base]?.required_reviews || p.reviews.some((v) => v.state !== 'PENDING') ? reviewDecision(p) : null, totalCommentsCount: r.issues.get(p.number)!.comments.length + p.review_comments.length,
            commits: { nodes: [{ commit: { statusCheckRollup: state ? { state } : null } }] }, headRefName: p.head, baseRefName: p.base,
          };
        }
        return { repository: out };
      }
      case 'PullExtras': {
        const r = repoVar();
        const p = r.pulls.get(Number(variables.number));
        if (!p) throw new GraphQLProblem(`Could not resolve to a PullRequest with the number of ${variables.number}.`, 'NOT_FOUND');
        const i = r.issues.get(p.number)!;
        return {
          repository: {
            viewerDefaultMergeMethod: 'MERGE',
            pullRequest: {
              id: `PR_${r.name}_${p.number}`, reviewDecision: reviewDecision(p), viewerCanUpdate: can(r, 'write') || i.user === viewer, viewerSubscription: i.subscribed === false ? 'UNSUBSCRIBED' : i.subscribed ? 'SUBSCRIBED' : 'UNSUBSCRIBED',
              isInMergeQueue: false, autoMergeRequest: p.auto_merge ? { mergeMethod: p.auto_merge.method.toUpperCase(), enabledBy: user(p.auto_merge.by) } : null,
              closingIssuesReferences: { nodes: closingNumbers(i.body).map((n) => r.issues.get(n)).filter((x) => x && !r.pulls.has(x.number)).map((x) => ({ number: x!.number, title: x!.title, state: x!.state.toUpperCase(), url: `${web(r)}/issues/${x!.number}` })) },
              files: { nodes: pullDiff(r, p).map((f) => ({ path: f.path, viewerViewedState: p.viewed.includes(f.path) ? 'VIEWED' : 'UNVIEWED' })) },
            },
          },
        };
      }
      case 'IssueExtras': {
        const r = repoVar();
        const i = r.issues.get(Number(variables.number));
        if (!i) throw new GraphQLProblem(`Could not resolve to an Issue with the number of ${variables.number}.`, 'NOT_FOUND');
        return { repository: { issue: {
          id: `I_${r.name}_${i.number}`, isPinned: !!i.pinned, viewerSubscription: i.subscribed ? 'SUBSCRIBED' : 'UNSUBSCRIBED', viewerCanDelete: can(r, 'admin'),
          viewerCanSubscribe: !!viewer,
        } } };
      }
      case 'ReviewThreads': {
        const r = repoVar();
        const p = r.pulls.get(Number(variables.number));
        if (!p) throw new GraphQLProblem(`Could not resolve to a PullRequest with the number of ${variables.number}.`, 'NOT_FOUND');
        const threads = p.threads.map((t) => threadJson(r, p, t)).filter((t) => t.comments.nodes.length);
        const pending = viewer ? p.reviews.find((v) => v.state === 'PENDING' && v.user === viewer) : undefined;
        return { repository: { pullRequest: { reviewThreads: { nodes: threads }, reviews: { nodes: pending ? [{ id: 'PRR_' + pending.id, databaseId: pending.id, comments: { totalCount: p.review_comments.filter((c) => c.review_id === pending.id).length } }] : [] } } } };
      }
      case 'Blame': {
        const r = repoVar();
        const c = r.git.resolve(!variables.ref || variables.ref === 'HEAD' ? r.default_branch : variables.ref);
        if (!c) return { repository: { object: null } };
        const ranges = r.git.blame(c.sha, variables.path).map((b) => ({
          startingLine: b.start, endingLine: b.end, age: 1,
          commit: { oid: b.commit.sha, messageHeadline: b.commit.message.split('\n')[0], committedDate: b.commit.committer.date, author: { name: b.commit.author.name, user: b.commit.author.login ? user(b.commit.author.login) : null } },
        }));
        return { repository: { object: { __typename: 'Commit', blame: { ranges } } } };
      }
      case 'AddPendingThread': {
        const me = authed();
        for (const r of db.repos) {
          for (const p of r.pulls.values()) {
            const v = p.reviews.find((x) => 'PRR_' + x.id === variables.review && x.user === me && x.state === 'PENDING');
            if (!v) continue;
            addReviewComment(r, p, v, me, { path: variables.path, line: variables.line, side: variables.side, start_line: variables.startLine, body: variables.body });
            return { result: { thread: { id: 'T_' + p.threads.at(-1)!.id } } };
          }
        }
        throw new GraphQLProblem('Could not resolve to a node with the global id.', 'NOT_FOUND');
      }
      case 'ResolveThread':
      case 'UnresolveThread': {
        authed();
        for (const r of db.repos) {
          for (const p of r.pulls.values()) {
            const t = p.threads.find((x) => 'T_' + x.id === variables.id);
            if (!t) continue;
            if (!can(r, 'write') && p.review_comments.find((c) => c.thread === t.id)?.user !== viewer && r.issues.get(p.number)?.user !== viewer) throw new GraphQLProblem('You do not have permission to resolve this thread.', 'FORBIDDEN');
            t.resolved = op === 'ResolveThread';
            t.resolved_by = t.resolved ? viewer : null;
            return { thread: { thread: { id: variables.id, isResolved: t.resolved } } };
          }
        }
        throw new GraphQLProblem('Could not resolve to a node with the global id.', 'NOT_FOUND');
      }
      case 'MarkReady':
      case 'ConvertToDraft': {
        authed();
        const r = repoOfNode(variables.id);
        const n = r ? gqlIssue(r, variables.id) : undefined;
        const p = n ? r!.pulls.get(n.number) : undefined;
        if (!r || !p || !n) throw new GraphQLProblem('Could not resolve to a node with the global id.', 'NOT_FOUND');
        if (!can(r, 'write') && n.user !== viewer) throw new GraphQLProblem(`${viewer} does not have the correct permissions to execute this mutation.`, 'FORBIDDEN');
        p.draft = op === 'ConvertToDraft';
        event(n, { event: op === 'MarkReady' ? 'ready_for_review' : 'convert_to_draft' });
        return { result: { pullRequest: { id: variables.id, isDraft: p.draft } } };
      }
      case 'EnableAutoMerge':
      case 'DisableAutoMerge': {
        authed();
        const r = repoOfNode(variables.id);
        const n = r ? gqlIssue(r, variables.id) : undefined;
        const p = n ? r!.pulls.get(n.number) : undefined;
        if (!r || !p || !n) throw new GraphQLProblem('Could not resolve to a node with the global id.', 'NOT_FOUND');
        if (!can(r, 'write')) throw new GraphQLProblem(`${viewer} does not have the correct permissions to execute this mutation.`, 'FORBIDDEN');
        if (op === 'EnableAutoMerge' && !r.allow_auto_merge) throw new GraphQLProblem('Auto merge is not allowed for this repository', 'UNPROCESSABLE');
        p.auto_merge = op === 'EnableAutoMerge' ? { method: String(variables.method).toLowerCase(), by: viewer! } : null;
        event(n, { event: op === 'EnableAutoMerge' ? 'auto_merge_enabled' : 'auto_merge_disabled' });
        return { result: { pullRequest: { id: variables.id } } };
      }
      case 'MarkFileViewed':
      case 'UnmarkFileViewed': {
        authed();
        const r = repoOfNode(variables.id);
        const n = r ? gqlIssue(r, variables.id) : undefined;
        const p = n ? r!.pulls.get(n.number) : undefined;
        if (!p) throw new GraphQLProblem('Could not resolve to a node with the global id.', 'NOT_FOUND');
        p.viewed = op === 'MarkFileViewed' ? [...new Set([...p.viewed, variables.path])] : p.viewed.filter((x) => x !== variables.path);
        return { result: { clientMutationId: null } };
      }
      case 'DeleteIssue': {
        authed();
        const r = repoOfNode(variables.id);
        const n = r ? gqlIssue(r, variables.id) : undefined;
        if (!r || !n) throw new GraphQLProblem('Could not resolve to a node with the global id.', 'NOT_FOUND');
        if (!can(r, 'admin')) throw new GraphQLProblem(`${viewer} does not have the correct permissions to execute \`DeleteIssue\``, 'FORBIDDEN');
        r.issues.delete(n.number);
        return { result: { clientMutationId: null } };
      }
      case 'PinIssue':
      case 'UnpinIssue': {
        authed();
        const r = repoOfNode(variables.id);
        const n = r ? gqlIssue(r, variables.id) : undefined;
        if (!r || !n) throw new GraphQLProblem('Could not resolve to a node with the global id.', 'NOT_FOUND');
        if (!can(r, 'triage')) throw new GraphQLProblem(`${viewer} does not have the correct permissions to execute \`PinIssue\``, 'FORBIDDEN');
        n.pinned = op === 'PinIssue';
        return { result: { clientMutationId: null } };
      }
      case 'SetSubscription': {
        authed();
        const r = repoOfNode(variables.id);
        const n = r ? gqlIssue(r, variables.id) : undefined;
        if (!n) throw new GraphQLProblem('Could not resolve to a node with the global id.', 'NOT_FOUND');
        n.subscribed = variables.state === 'SUBSCRIBED';
        return { result: { subscribable: { viewerSubscription: variables.state } } };
      }
      default:
        throw new GraphQLProblem(`Unknown operation ${op}`, 'UNDEFINED');
    }
  };

  /* ── The fetch ── */
  const handle = async (url: string, init: RequestInit = {}): Promise<Response> => {
    const u = new URL(url);
    const method = (init.method ?? 'GET').toUpperCase();
    const headers = new Headers(init.headers);
    const accept = headers.get('accept') ?? '';
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    log.push({ method, url: u.pathname + u.search, body });
    const base: Record<string, string> = { 'x-ratelimit-limit': '5000', 'x-ratelimit-remaining': String(4990 - log.length), 'x-ratelimit-reset': String(Math.round(clock / 1000) + 3600), 'x-oauth-scopes': scopes };
    const reply = (a: Answer) => {
      const status = a.status ?? 200;
      const payload = a.bytes ?? a.text ?? (a.json === undefined ? null : JSON.stringify(a.json));
      return new Response(status === 204 || status === 205 ? null : (payload as BodyInit | null), { status, headers: { ...base, ...a.headers } });
    };
    const fail = failures.find((f) => f.match.test(`${method} ${u.pathname}`));
    if (fail) {
      failures.splice(failures.indexOf(fail), 1);
      return reply({ status: fail.status, json: { message: fail.message }, headers: fail.headers });
    }
    if (u.pathname === '/graphql') {
      try {
        return reply({ json: { data: graphql(body.query, body.variables ?? {}, body.operationName) } });
      } catch (e) {
        if (e instanceof GraphQLProblem) return reply({ json: { data: null, errors: [{ message: e.message, type: e.type }] } });
        if (e instanceof HttpError) return reply({ status: e.status, json: { message: e.message } });
        throw e;
      }
    }
    for (const [m, rx, names, handler, scoped] of routes) {
      if (m !== method) continue;
      const hit = rx.exec(u.pathname);
      if (!hit) continue;
      const params: Record<string, string> = { __url: u.origin + u.pathname };
      names.forEach((n, i) => { params[n] = hit[i + 1]; });
      try {
        const repo = scoped ? findRepo(params.owner, params.repo) : (undefined as unknown as ServerRepo);
        const out = handler({ query: u.searchParams, body, viewer, accept, params, repo });
        return reply(out as Answer);
      } catch (e) {
        if (e instanceof HttpError) return reply({ status: e.status, json: { message: e.message, ...(e.errors ? { errors: e.errors } : {}) } });
        throw e;
      }
    }
    return reply({ status: 404, json: { message: 'Not Found' } });
  };

  const fetchImpl = async (url: string, init?: RequestInit) => {
    if (latency) await new Promise((r) => setTimeout(r, latency));
    return handle(url, init);
  };

  return {
    fetch: fetchImpl,
    now: () => clock,
    /** The next request matching `match` ("METHOD /path" as a regular expression) answers `status`. */
    fail(match: RegExp, status: number, message: string, headers?: Record<string, string>) { failures.push({ match, status, message, headers }); },
    /** Every request so far. */
    log,
    /** The data itself, for test setup and assertions. */
    db,
  };
}

class GraphQLProblem extends Error {
  constructor(message: string, readonly type: string) { super(message); }
}

/** `closes #12`, `Fixes #3`, `resolved #9`: what GitHub links from a pull request description. */
export function closingNumbers(body: string): number[] {
  return [...body.matchAll(/\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)/gi)].map((m) => Number(m[1]));
}

let repoIds = 7000;
/** A repository with nothing in it yet. */
export function blankRepo(owner: string, name: string, init: Partial<ServerRepo> = {}): ServerRepo {
  return {
    id: repoIds++, owner, name, description: '', homepage: '', topics: [], private: false, archived: false, fork: false, default_branch: 'main', license: null, created_at: '2026-01-01T00:00:00Z', pushed_at: '2026-01-01T00:00:00Z',
    stars: 0, forks: [], extra_forks: 0, extra_watchers: 0, has_issues: true, has_wiki: true, has_projects: true, has_discussions: false, allow_merge_commit: true, allow_squash_merge: true, allow_rebase_merge: true, allow_auto_merge: false, delete_branch_on_merge: false, allow_update_branch: true,
    git: new GitStore(), labels: [], milestones: [], issues: new Map(), pulls: new Map(), roles: {}, protection: {}, checks: {}, statuses: {}, workflows: [], runs: [], releases: [], stargazers: [], watchers: [], subscriptions: {},
    ...init,
  };
}

export type SampleServer = ReturnType<typeof createSampleServer>;

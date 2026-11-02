/* GitHub's REST and GraphQL APIs behind the GitHub clone, mapped into data.ts's shapes. api.github.com answers browsers
   itself (CORS, bearer token), so requests go straight there; only the device sign-in needed a proxy, and the Passwords
   keychain already did that. The sample repository is the same code over sample-server.ts's fetch.

   Reading. GETs are cached for a short while (`ttl`), so going back to a screen is instant, and sent with `cache:
   'no-cache'`, so the browser revalidates (a 304 doesn't spend rate limit) instead of showing its own 60-second copy
   after a write. Search allows 30 requests a minute and can trail a write by a few seconds, so the tab counts come from
   GraphQL, and rows this page just changed are laid over search results.

   Writing. A write invalidates the cached reads it affects and tells subscribers (useLoad), so every mounted screen
   re-reads. GraphQL is used where REST has nothing: last commits per path, blame, review threads and resolving them,
   draft and auto-merge, viewed files, pinning, deleting an issue, list rows' review and check state.

   Errors are GitHubErrors with a kind: 'auth' (401), 'forbidden' (403, with GitHub's words and the scope it wanted),
   'notFound' (404, also what a private repository looks like to a token that can't see it), 'rateLimit', 'validation'
   (422, with GitHub's field errors) and 'other'. Screens explain them. */
import type {
  BlameRange, Check, CodeHit, CommentTarget, Commit, CommitComment, CommitDetail, Comparison, ContributorStat, DiffFile, FileNode, Issue, IssueDetail, IssueExtras, Label, LastCommit, Milestone, Notification, PullDetail, PullExtras, PullRequest, PullThreads,
  ReactionContent, Reactions, RefInfo, Release, Repo, RepoSummary, Reviewer, ReviewThread, RunArtifact, RunDetail, RunJob, TimelineItem, Traffic, User, Workflow, WorkflowInput, WorkflowRun,
} from './data';
import type { Counts, Paged, RepoSource, RunFilter, Subscription } from './source';

export type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

export const API = 'https://api.github.com';

export type GitHubErrorKind = 'auth' | 'forbidden' | 'notFound' | 'rateLimit' | 'validation' | 'other';

export class GitHubError extends Error {
  constructor(readonly status: number, message: string, readonly kind: GitHubErrorKind, readonly resetAt?: number) {
    super(message);
    this.name = 'GitHubError';
  }
}

export interface RateLimit {
  limit: number;
  remaining: number;
  /** Epoch ms. */
  resetAt: number;
}

export interface GitHubOptions {
  token: string;
  /** Defaults to the page's fetch: api.github.com sends CORS headers. */
  fetch?: Fetch;
  /** The clock relative times are written against (tests pin it; the sample's ticks with its writes). */
  now?: () => number;
  /** How long a read is reused, ms. Default a minute. */
  ttl?: number;
  /** Search trails writes: re-read it this long after one. 0 turns it off (tests, the sample). Default 4 seconds. */
  settle?: number;
}

type Accept = 'json' | 'raw' | 'bytes';
const ACCEPT: Record<Accept, string> = { json: 'application/vnd.github+json', raw: 'application/vnd.github.raw+json', bytes: 'application/vnd.github.raw+json' };

export type GitHub = ReturnType<typeof createGitHub>;

let clientIds = 0;

/* Bumped by every invalidation in the page: useLoad re-reads on it, and untouched reads answer from their caches. */
let revision = 0;
const revisionListeners = new Set<() => void>();
export const dataRevision = {
  get: () => revision,
  subscribe: (fn: () => void) => { revisionListeners.add(fn); return () => { revisionListeners.delete(fn); }; },
};
const bumpRevision = () => { revision++; for (const l of [...revisionListeners]) l(); };

export function createGitHub({ token, fetch: f = (u, i) => fetch(u, i), now = Date.now, ttl = 60_000, settle = 4000 }: GitHubOptions) {
  const cache = new Map<string, { value: Promise<unknown>; at: number }>();
  const listeners = new Set<() => void>();
  let rate: RateLimit | null = null;
  let scopes: string[] | null = null;
  const clientId = ++clientIds;

  async function request(path: string, init: RequestInit = {}, accept: Accept = 'json'): Promise<Response> {
    const url = path.startsWith('http') ? path : API + path;
    const res = await f(url, {
      cache: 'no-cache',
      ...init,
      headers: { Accept: ACCEPT[accept], Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28', ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
    });
    const remaining = res.headers.get('x-ratelimit-remaining');
    const reset = Number(res.headers.get('x-ratelimit-reset')) * 1000;
    if (remaining != null) rate = { limit: Number(res.headers.get('x-ratelimit-limit') ?? 0), remaining: Number(remaining), resetAt: reset };
    const scopeHeader = res.headers.get('x-oauth-scopes');
    if (scopeHeader != null) scopes = scopeHeader.split(',').map((s) => s.trim()).filter(Boolean);
    if (res.ok || res.status === 304) return res;
    const body = (await res.json().catch(() => ({}))) as { message?: string; errors?: (string | { message?: string; field?: string; code?: string; resource?: string })[]; documentation_url?: string };
    const message = body.message || res.statusText || `HTTP ${res.status}`;
    if (res.status === 401) throw new GitHubError(401, 'GitHub turned this token down (revoked or expired). Sign in again.', 'auth');
    if (res.status === 404) throw new GitHubError(404, 'Not found — or private, and this sign-in can’t see it.', 'notFound');
    if ((res.status === 403 || res.status === 429) && (remaining === '0' || /rate limit/i.test(message))) {
      const retry = Number(res.headers.get('retry-after'));
      const resetAt = retry ? retry * 1000 + now() : reset || undefined;
      throw new GitHubError(res.status, `GitHub’s rate limit is used up${resetAt ? `; it resets at ${new Date(resetAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : ''}.`, 'rateLimit', resetAt);
    }
    if (res.status === 403) {
      const needed = res.headers.get('x-accepted-oauth-scopes');
      const sso = res.headers.get('x-github-sso');
      const hint = sso ? ' This organization requires single sign-on for this token.' : needed && scopes && !needed.split(',').some((s) => scopes!.includes(s.trim())) ? ` This sign-in lacks the ${needed} scope.` : '';
      throw new GitHubError(403, message + hint, 'forbidden');
    }
    if (res.status === 422 || res.status === 409 || res.status === 405 || res.status === 410) {
      const details = (body.errors ?? []).map((e) => (typeof e === 'string' ? e : e.message || sentenceOf(e))).filter(Boolean);
      throw new GitHubError(res.status, details.length ? details.join(' ') : message, 'validation');
    }
    throw new GitHubError(res.status, message, 'other');
  }

  function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
    const hit = cache.get(key);
    // The wall clock, not `now`: a pinned clock (tests, the sample) mustn't hold entries forever.
    if (hit && Date.now() - hit.at < ttl) return hit.value as Promise<T>;
    const value = load();
    value.catch(() => { if (cache.get(key)?.value === value) cache.delete(key); });
    cache.set(key, { value, at: Date.now() });
    return value;
  }

  /** A cached GET: JSON, raw text, or raw bytes. */
  function get<T>(path: string, accept: Accept = 'json'): Promise<T> {
    return cached(accept + ' ' + path, () => request(path, {}, accept).then((r) => (accept === 'json' ? r.json() : accept === 'raw' ? r.text() : r.arrayBuffer()) as Promise<T>));
  }

  /** A cached list across pages (Link rel="next"), up to `max` pages. */
  function getAll<T>(path: string, max = 3): Promise<T[]> {
    return cached('all ' + path, async () => {
      const out: T[] = [];
      let next: string | null = path;
      for (let page = 0; next && page < max; page++) {
        const res = await request(next);
        out.push(...((await res.json()) as T[]));
        next = linkRel(res.headers.get('link'), 'next');
      }
      return out;
    });
  }

  /** One page of a list and what's around it, from its Link header. */
  function getPage<T>(path: string, page: number, map: (body: unknown) => { items: T[]; total?: number } = (b) => ({ items: b as T[] })): Promise<Paged<T>> {
    const url = path + (path.includes('?') ? '&' : '?') + `page=${page}`;
    return cached('page ' + url, async () => {
      const res = await request(url);
      const { items, total } = map(await res.json());
      const link = res.headers.get('link');
      const last = linkRel(link, 'last');
      return { items, total, page, hasNext: !!linkRel(link, 'next'), hasPrev: !!linkRel(link, 'prev') || page > 1, lastPage: last ? Number(new URL(last).searchParams.get('page')) || undefined : page };
    });
  }

  /** How many items a list holds, from one per_page=1 request: its last page number, else the length. */
  function count(path: string): Promise<number> {
    return cached('count ' + path, () => request(path + (path.includes('?') ? '&' : '?') + 'per_page=1').then(async (res) => {
      const last = linkRel(res.headers.get('link'), 'last');
      const page = last ? Number(new URL(last).searchParams.get('page')) : NaN;
      return Number.isFinite(page) ? page : ((await res.json()) as unknown[]).length;
    }));
  }

  /** Whether a GET answers: GitHub says yes/no with 204/404 on a few endpoints. */
  function exists(path: string): Promise<boolean> {
    return cached('exists ' + path, () => request(path).then(() => true, (e: unknown) => {
      if (e instanceof GitHubError && e.kind === 'notFound') return false;
      throw e;
    }));
  }

  async function send<T>(method: string, path: string, body?: unknown, accept: Accept = 'json'): Promise<T> {
    const res = await request(path, { method, body: body === undefined ? undefined : JSON.stringify(body) }, accept);
    const text = await res.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }
  const post = <T>(path: string, body?: unknown) => send<T>('POST', path, body ?? {});

  async function runGraphql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
    const res = await request('/graphql', { method: 'POST', body: JSON.stringify({ query, variables }) });
    const body = (await res.json()) as { data?: T; errors?: { message: string; type?: string }[] };
    if (body.errors?.length) {
      const e = body.errors[0];
      const kind: GitHubErrorKind = e.type === 'NOT_FOUND' ? 'notFound' : e.type === 'FORBIDDEN' || e.type === 'INSUFFICIENT_SCOPES' ? 'forbidden' : e.type === 'RATE_LIMITED' ? 'rateLimit' : 'other';
      throw new GitHubError(200, e.message, kind);
    }
    return body.data as T;
  }

  /** A cached GraphQL read. */
  function query<T>(text: string, variables: Record<string, unknown>): Promise<T> {
    return cached(`graphql ${text.trim()} ${JSON.stringify(variables)}`, () => runGraphql<T>(text, variables));
  }

  /** A GraphQL write. */
  const mutate = <T>(text: string, variables: Record<string, unknown>) => runGraphql<T>(text, variables);

  /** Drops cached reads whose path starts with one of `prefixes`, then tells every mounted screen to re-read. */
  function invalidate(...prefixes: string[]) {
    for (const key of [...cache.keys()]) {
      const path = key.slice(key.indexOf(' ') + 1);
      if (prefixes.some((p) => path.startsWith(p))) cache.delete(key);
    }
    for (const l of [...listeners]) l();
    bumpRevision();
  }

  /** Search and a few other reads trail a write: read them again once GitHub has caught up. */
  function settleLater(...prefixes: string[]) {
    if (!settle) return;
    setTimeout(() => invalidate(...prefixes), settle);
  }

  return {
    id: clientId, get, getAll, getPage, count, exists, send, post, query, mutate, invalidate, settleLater, now,
    rateLimit: () => rate,
    /** What the token may do, once GitHub has said (null before the first answer). */
    scopes: () => scopes,
    subscribe: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; },
    /** Everything read again. */
    refresh: () => invalidate(''),
  };
}

/** GitHub's field errors as a sentence ("name already_exists" isn't one). */
function sentenceOf(e: { field?: string; code?: string; resource?: string }): string {
  const field = (e.field ?? e.resource ?? 'That').replace(/_/g, ' ');
  const name = field.charAt(0).toUpperCase() + field.slice(1);
  if (e.code === 'already_exists') return `${name} already exists.`;
  if (e.code === 'missing_field' || e.code === 'missing') return `${name} is required.`;
  if (e.code === 'invalid') return `${name} isn’t valid.`;
  return [name, e.code?.replace(/_/g, ' ')].filter(Boolean).join(' ');
}

/* One client per token for the session, so going back to a repository (or remounting the block) is instant. */
const clients = new Map<string, GitHub>();
export function githubClient(token: string): GitHub {
  let c = clients.get(token);
  if (!c) clients.set(token, (c = createGitHub({ token })));
  return c;
}

export function linkRel(link: string | null, rel: string): string | null {
  if (!link) return null;
  for (const part of link.split(',')) {
    const m = /<([^>]+)>\s*;\s*rel="([^"]+)"/.exec(part);
    if (m && m[2].split(/\s+/).includes(rel)) return m[1];
  }
  return null;
}

/* ── Writing it like GitHub does ── */

/** '12.4k', '842', '1.2m'. */
export function compactCount(n: number): string {
  if (n < 1000) return String(n);
  const [v, unit] = n < 1e6 ? [n / 1e3, 'k'] : [n / 1e6, 'm'];
  return (v >= 100 ? Math.round(v) : Math.round(v * 10) / 10) + unit;
}

/** 'now', '5 minutes ago', 'yesterday', '3 days ago', 'on Sep 24, 2026'. */
export function ago(iso: string | null | undefined, now: number): string {
  if (!iso) return '';
  const t = Date.parse(iso);
  const s = Math.max(0, (now - t) / 1000);
  const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'} ago`;
  if (s < 45) return 'now';
  if (s < 3600) return plural(Math.max(1, Math.round(s / 60)), 'minute');
  if (s < 86400) return plural(Math.round(s / 3600), 'hour');
  if (s < 2 * 86400) return 'yesterday';
  if (s < 30 * 86400) return plural(Math.floor(s / 86400), 'day');
  return 'on ' + new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

/** '48s', '1m 52s', '1h 4m'. */
export function duration(from: string | null | undefined, to: string | null | undefined): string {
  if (!from || !to) return '';
  const s = Math.max(0, Math.round((Date.parse(to) - Date.parse(from)) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}

/* ── GitHub's JSON, the fields used ── */
interface GhUser { login: string; avatar_url?: string; name?: string | null; type?: string }
interface GhLabel { name: string; color: string; description?: string | null }
interface GhMilestone { number: number; title: string; description?: string | null; state: 'open' | 'closed'; due_on?: string | null; open_issues: number; closed_issues: number; html_url?: string; closed_at?: string | null }
type GhReactions = Partial<Record<ReactionContent | 'total_count' | 'url', number | string>>;
interface GhIssue {
  number: number; title: string; state: 'open' | 'closed'; state_reason?: string | null; user: GhUser | null; created_at: string; updated_at?: string; closed_at: string | null; closed_by?: GhUser | null;
  labels: (GhLabel | string)[]; comments: number; assignees?: GhUser[] | null; milestone?: GhMilestone | null; locked?: boolean; active_lock_reason?: string | null; node_id?: string;
  html_url: string; body?: string | null; draft?: boolean; pull_request?: { merged_at?: string | null }; author_association?: string; reactions?: GhReactions; repository_url?: string;
}
interface GhPull {
  number: number; title: string; state: 'open' | 'closed'; draft?: boolean; merged_at: string | null; merged_by?: GhUser | null; merge_commit_sha?: string | null; closed_at?: string | null; user: GhUser | null; created_at: string; updated_at?: string;
  labels: GhLabel[]; comments: number; review_comments?: number; head: { ref: string; sha: string; label?: string; repo?: { full_name: string; fork?: boolean } | null }; base: { ref: string; sha: string; repo?: { full_name: string } };
  commits: number; additions: number; deletions: number; html_url: string; body: string | null; requested_reviewers?: GhUser[]; requested_teams?: { name: string }[];
  assignees?: GhUser[]; milestone?: GhMilestone | null; mergeable_state?: string; mergeable?: boolean | null; changed_files?: number; maintainer_can_modify?: boolean; node_id?: string; locked?: boolean; active_lock_reason?: string | null;
  auto_merge?: { merge_method: string; enabled_by: GhUser } | null;
}
interface GhCommit { sha: string; commit: { message: string; author: { name: string; date: string } | null; committer?: { date: string } | null; verification?: { verified?: boolean } }; author: GhUser | null; html_url?: string; parents?: { sha: string }[] }
interface GhFile { filename: string; additions: number; deletions: number; patch?: string; status: DiffFile['status']; previous_filename?: string }
interface GhRepo {
  name: string; full_name: string; owner: { login: string }; description: string | null; homepage: string | null; topics?: string[]; stargazers_count: number; forks_count: number; subscribers_count?: number; license: { name: string } | null;
  default_branch: string; private: boolean; html_url: string; archived?: boolean; fork?: boolean; parent?: { full_name: string }; permissions?: { admin?: boolean; maintain?: boolean; push?: boolean; triage?: boolean; pull?: boolean }; language?: string | null; pushed_at?: string;
  has_issues?: boolean; has_wiki?: boolean; has_projects?: boolean; has_discussions?: boolean; allow_merge_commit?: boolean; allow_squash_merge?: boolean; allow_rebase_merge?: boolean; allow_auto_merge?: boolean; delete_branch_on_merge?: boolean; allow_update_branch?: boolean;
}

/** A User from a GitHub account: initials from the login's first two words (they show until the picture loads). */
export function userOf(u: GhUser | null | undefined): User {
  const login = u?.login ?? 'ghost';
  const words = login.replace(/\[bot\]$/, '').split(/[-_.\s]+/).filter(Boolean);
  const cap = (w = '') => w.charAt(0).toUpperCase() + w.slice(1);
  return { login, f: cap(words[0] ?? login), l: cap(words[1] ?? ''), avatar: u?.avatar_url || undefined };
}
/** A commit author without an account: the git name. */
const nameUser = (name: string): User => {
  const [f = '?', ...rest] = name.split(/\s+/);
  return { login: name, f, l: rest.at(-1) ?? '' };
};
export const labelOf = (l: GhLabel | string): Label =>
  typeof l === 'string' ? { name: l, color: '#9198a1' } : { name: l.name, color: '#' + (l.color || '9198a1'), description: l.description ?? undefined };

const ROLE: Record<string, string> = { OWNER: 'Owner', MEMBER: 'Member', COLLABORATOR: 'Collaborator', CONTRIBUTOR: 'Contributor' };
const firstLine = (s: string) => s.split('\n')[0];
const restLines = (s: string) => s.split('\n').slice(1).join('\n').trim() || undefined;
export const milestoneOf = (m: GhMilestone, now: number): Milestone => ({
  number: m.number, title: m.title, description: m.description ?? '', state: m.state, due: m.due_on ?? undefined, dueWhen: m.due_on ? new Date(m.due_on).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : undefined,
  open: m.open_issues, closed: m.closed_issues, pct: Math.round((m.closed_issues / Math.max(1, m.open_issues + m.closed_issues)) * 100), url: m.html_url, closedWhen: m.closed_at ? ago(m.closed_at, now) : undefined,
});
const REACTION_KEYS: ReactionContent[] = ['+1', '-1', 'laugh', 'hooray', 'confused', 'heart', 'rocket', 'eyes'];
const reactionsOf = (r?: GhReactions): Reactions => {
  const out: Reactions = {};
  for (const k of REACTION_KEYS) { const n = Number(r?.[k] ?? 0); if (n) out[k] = n; }
  return out;
};

/** GitHub's language colors for the common ones; the rest are gray. */
const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: '#3178c6', JavaScript: '#f1e05a', Python: '#3572A5', Go: '#00ADD8', Rust: '#dea584', Java: '#b07219', Kotlin: '#A97BFF',
  Swift: '#F05138', 'C++': '#f34b7d', C: '#555555', 'C#': '#178600', Ruby: '#701516', PHP: '#4F5D95', HTML: '#e34c26', CSS: '#563d7c',
  SCSS: '#c6538c', Shell: '#89e051', MDX: '#fcb32c', Vue: '#41b883', Svelte: '#ff3e00', Dart: '#00B4AB', Elixir: '#6e4a7e', Lua: '#000080',
  Dockerfile: '#384d54', PLpgSQL: '#336790', Nix: '#7e7eff', Zig: '#ec915c', Astro: '#ff5a03', WebAssembly: '#04133b', YAML: '#cb171e',
};
const OTHER = '#9198a1';

export function languagesOf(bytes: Record<string, number>): Repo['languages'] {
  const total = Object.values(bytes).reduce((a, b) => a + b, 0);
  if (!total) return [];
  const all = Object.entries(bytes).sort((a, b) => b[1] - a[1]).map(([name, n]) => ({ name, pct: Math.round((n / total) * 1000) / 10, color: LANGUAGE_COLORS[name] ?? OTHER }));
  if (all.length <= 5) return all;
  const rest = all.slice(4).reduce((s, l) => s + l.pct, 0);
  return [...all.slice(0, 4), { name: 'Other', pct: Math.round(rest * 10) / 10, color: OTHER }];
}

/** The flat recursive tree as nested FileNodes. */
export function treeOf(entries: { path: string; type: string; size?: number; mode?: string; sha?: string }[]): FileNode[] {
  const root: FileNode[] = [];
  const dirs = new Map<string, FileNode[]>([['', root]]);
  // Parents come before children in GitHub's listing, but don't rely on it.
  for (const e of [...entries].sort((a, b) => a.path.split('/').length - b.path.split('/').length)) {
    const at = e.path.lastIndexOf('/');
    const parent = dirs.get(at < 0 ? '' : e.path.slice(0, at));
    if (!parent) continue;
    const node: FileNode = {
      name: e.path.slice(at + 1), path: e.path, type: e.type === 'tree' ? 'dir' : 'file', commit: '', when: '', size: e.size,
      special: e.type === 'commit' ? 'submodule' : e.mode === '120000' ? 'symlink' : undefined, objectSha: e.sha,
    };
    if (node.type === 'dir') dirs.set(e.path, (node.children = []));
    parent.push(node);
  }
  return root;
}

export const issueOf = (i: GhIssue, now: number): Issue => ({
  number: i.number, title: i.title, state: i.state, stateReason: i.state_reason, author: userOf(i.user), when: ago(i.state === 'closed' ? i.closed_at : i.created_at, now), at: i.state === 'closed' ? i.closed_at ?? undefined : i.created_at,
  labels: i.labels.map(labelOf), comments: i.comments, assignees: (i.assignees ?? []).map(userOf), milestone: i.milestone?.title, url: i.html_url, locked: i.locked,
  repo: i.repository_url?.split('/repos/')[1],
});

/** A search hit for a pull request: what a list row shows (`review` and `checks` come from GraphQL afterwards). */
export const pullRowOf = (i: GhIssue, now: number): PullRequest => {
  const state = i.pull_request?.merged_at ? 'merged' : i.state === 'closed' ? 'closed' : i.draft ? 'draft' : 'open';
  const at = state === 'merged' ? i.pull_request?.merged_at : state === 'closed' ? i.closed_at : i.created_at;
  return {
    number: i.number, title: i.title, state, author: userOf(i.user), when: ago(at, now), at: at ?? undefined, labels: i.labels.map(labelOf), comments: i.comments, assignees: (i.assignees ?? []).map(userOf), milestone: i.milestone?.title,
    review: i.draft ? 'draft' : undefined, head: '', base: '', commits: 0, additions: 0, deletions: 0, url: i.html_url, repo: i.repository_url?.split('/repos/')[1],
  };
};

const commitOf = (c: GhCommit, now: number): Commit => ({
  sha: c.sha.slice(0, 7), fullSha: c.sha, message: firstLine(c.commit.message), body: restLines(c.commit.message), author: c.author ? userOf(c.author) : nameUser(c.commit.author?.name ?? 'unknown'), when: ago(c.commit.committer?.date ?? c.commit.author?.date, now),
  at: c.commit.committer?.date ?? c.commit.author?.date, verified: c.commit.verification?.verified, parents: c.parents?.map((p) => p.sha), url: c.html_url,
});
const lastOf = (c: GhCommit, now: number): LastCommit => ({ sha: c.sha.slice(0, 7), fullSha: c.sha, message: firstLine(c.commit.message), author: c.author ? userOf(c.author) : nameUser(c.commit.author?.name ?? 'unknown'), when: ago(c.commit.author?.date, now), at: c.commit.author?.date });

export const diffFileOf = (f: GhFile): DiffFile => ({
  path: f.filename, additions: f.additions, deletions: f.deletions, status: f.status, previous: f.previous_filename, patch: f.patch ?? '',
  note: f.patch ? undefined : f.status === 'renamed' && !f.additions && !f.deletions ? `Renamed from ${f.previous_filename} without changes.` : 'Binary file, an empty one, or a large diff: not shown.',
});

/** A timeline event: which fields are there depends on `event`. */
export interface GhEvent {
  event: string; id?: number; node_id?: string; sha?: string; commit_id?: string | null; actor?: GhUser | null; user?: GhUser | null; created_at?: string; submitted_at?: string; updated_at?: string; updated?: string;
  body?: string | null; html_url?: string; author_association?: string; message?: string; state?: string; label?: GhLabel; state_reason?: string | null; lock_reason?: string | null; milestone?: { title: string };
  author?: { name: string; date: string }; committer?: { date: string }; requested_reviewer?: GhUser; requested_team?: { name: string }; review_requester?: GhUser;
  rename?: { from: string; to: string }; assignee?: GhUser; reactions?: GhReactions; source?: { issue?: { number: number; title?: string; pull_request?: unknown }; type?: string };
}

/** One timeline event as the conversation shows it; consecutive commits and labels fold into the previous item. */
export function timelineOf(events: GhEvent[], now: number): TimelineItem[] {
  const out: TimelineItem[] = [];
  const pushEvent = (e: GhEvent, id: string, event: string, extra: { text?: string; ref?: number; reason?: string | null; sha?: string } = {}) =>
    out.push({ kind: 'event', id: 'e' + id, author: userOf(e.actor ?? e.user), when: ago(e.created_at, now), event, ...extra });
  for (const e of events) {
    const last = out.at(-1);
    const id = String(e.id ?? e.node_id ?? e.sha ?? out.length);
    const actor = userOf(e.actor ?? e.user);
    switch (e.event) {
      case 'commented':
        out.push({
          kind: 'comment', id: 'c' + id, dbId: e.id, author: actor, when: ago(e.created_at, now), at: e.created_at, body: e.body ?? '', role: ROLE[e.author_association ?? ''], url: e.html_url, reactions: reactionsOf(e.reactions),
          edited: !!e.updated_at && !!e.created_at && Date.parse(e.updated_at) - Date.parse(e.created_at) > 1000, target: e.id ? { kind: 'issueComment', id: e.id } : undefined,
        });
        break;
      case 'committed': {
        const author = nameUser(e.author?.name ?? 'unknown');
        const commit: Commit = { sha: String(e.sha).slice(0, 7), fullSha: String(e.sha), message: firstLine(e.message ?? ''), author, when: ago(e.committer?.date ?? e.author?.date, now), url: e.html_url };
        if (last?.kind === 'commits' && last.author.login === author.login) { last.commits.push(commit); last.when = commit.when; }
        else out.push({ kind: 'commits', id: 'k' + id, author, when: commit.when, commits: [commit] });
        break;
      }
      case 'labeled':
      case 'unlabeled':
        if (!e.label) break;
        if (last?.kind === 'labeled' && last.author.login === actor.login && last.when === ago(e.created_at, now)) {
          if (e.event === 'labeled') last.labels.push(labelOf(e.label));
          else (last.removed ??= []).push(labelOf(e.label));
        } else out.push({ kind: 'labeled', id: 'l' + id, author: actor, when: ago(e.created_at, now), labels: e.event === 'labeled' ? [labelOf(e.label)] : [], removed: e.event === 'unlabeled' ? [labelOf(e.label)] : undefined });
        break;
      case 'review_requested':
      case 'review_request_removed':
        out.push({ kind: 'requested', id: 'r' + id, author: userOf(e.review_requester ?? e.actor), when: ago(e.created_at, now), reviewer: e.requested_reviewer ? userOf(e.requested_reviewer) : nameUser(e.requested_team?.name ?? 'a team'), removed: e.event === 'review_request_removed' });
        break;
      case 'reviewed': {
        if (e.state === 'pending') break;
        const state = e.state === 'approved' ? 'approved' : e.state === 'changes_requested' ? 'changes' : e.state === 'dismissed' ? 'dismissed' : 'commented';
        // A review with neither a verdict nor words is the wrapper of inline comments: still worth a line.
        out.push({ kind: 'review', id: 'v' + id, reviewId: e.id, author: userOf(e.user), when: ago(e.submitted_at, now), state, body: e.body || undefined, role: ROLE[e.author_association ?? ''], url: e.html_url });
        break;
      }
      case 'closed':
        pushEvent(e, id, 'closed', { reason: e.state_reason, sha: e.commit_id ?? undefined });
        break;
      case 'merged':
        pushEvent(e, id, 'merged', { sha: e.commit_id ?? undefined });
        break;
      case 'reopened': case 'head_ref_deleted': case 'head_ref_restored': case 'ready_for_review': case 'convert_to_draft': case 'unlocked': case 'pinned': case 'unpinned': case 'auto_merge_enabled': case 'auto_merge_disabled': case 'head_ref_force_pushed':
        pushEvent(e, id, e.event);
        break;
      case 'locked':
        pushEvent(e, id, 'locked', { text: e.lock_reason ?? undefined });
        break;
      case 'renamed':
        pushEvent(e, id, 'renamed', { text: e.rename?.to });
        break;
      case 'base_ref_changed':
        pushEvent(e, id, 'base_ref_changed', { text: e.rename?.to });
        break;
      case 'assigned': case 'unassigned':
        pushEvent(e, id, e.event, { text: e.assignee?.login });
        break;
      case 'milestoned': case 'demilestoned':
        pushEvent(e, id, e.event, { text: e.milestone?.title });
        break;
      case 'cross-referenced': {
        const n = e.source?.issue?.number;
        if (n != null) pushEvent(e, id, 'cross-referenced', { ref: n, text: e.source?.issue?.title });
        break;
      }
      case 'referenced':
        if (e.commit_id) pushEvent(e, id, 'referenced', { sha: e.commit_id });
        break;
      case 'review_dismissed':
        pushEvent(e, id, 'review_dismissed');
        break;
    }
  }
  return out;
}

const runStatus = (r: { status: string | null; conclusion: string | null }): WorkflowRun['status'] => {
  if (r.status === 'queued' || r.status === 'waiting' || r.status === 'requested' || r.status === 'pending') return 'queued';
  if (r.status !== 'completed') return 'running';
  if (r.conclusion === 'success') return 'success';
  if (r.conclusion === 'failure' || r.conclusion === 'timed_out' || r.conclusion === 'startup_failure') return 'failure';
  if (r.conclusion === 'skipped' || r.conclusion === 'neutral') return 'skipped';
  return 'cancelled';
};

const checkStatus = (status: string, conclusion: string | null): Check['status'] => {
  if (status !== 'completed') return 'pending';
  if (conclusion === 'success') return 'success';
  if (conclusion === 'failure' || conclusion === 'timed_out' || conclusion === 'cancelled' || conclusion === 'action_required' || conclusion === 'startup_failure') return 'failure';
  return 'neutral';
};

const encPath = (p: string) => p.split('/').map(encodeURIComponent).join('/');
const refQuery = (ref: string, sep = '?') => (ref ? `${sep}ref=${encodeURIComponent(ref)}` : '');
const b64 = (text: string) => {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
};

/** Who the token belongs to. */
export async function viewerOf(gh: GitHub): Promise<User> {
  const me = await gh.get<GhUser>('/user');
  return { ...userOf(me), ...(me.name ? { f: me.name.split(/\s+/)[0], l: me.name.split(/\s+/).at(-1) ?? '' } : {}) };
}

const summaryOf = (r: GhRepo & { stargazers_count?: number }, now: number): RepoSummary => ({ full: r.full_name, description: r.description ?? '', private: r.private, stars: r.stargazers_count != null ? compactCount(r.stargazers_count) : undefined, language: r.language ?? undefined, fork: r.fork, archived: r.archived, when: r.pushed_at ? ago(r.pushed_at, now) : undefined });

/** The signed-in account's repositories, most recently pushed first (the picker). */
export async function recentRepos(gh: GitHub): Promise<RepoSummary[]> {
  const list = await gh.get<GhRepo[]>('/user/repos?sort=pushed&per_page=50');
  return list.map((r) => summaryOf(r, gh.now()));
}

/** The account's starred repositories. */
export async function starredRepos(gh: GitHub): Promise<RepoSummary[]> {
  const list = await gh.get<GhRepo[]>('/user/starred?per_page=30');
  return list.map((r) => summaryOf(r, gh.now()));
}

/** Repositories matching a search. */
export async function searchRepos(gh: GitHub, q: string): Promise<RepoSummary[]> {
  const res = await gh.get<{ items: GhRepo[] }>(`/search/repositories?q=${encodeURIComponent(q)}&per_page=20`);
  return res.items.map((r) => summaryOf(r, gh.now()));
}

/** Creates a repository under the signed-in account. */
export async function createRepo(gh: GitHub, o: { name: string; description: string; private: boolean; autoInit: boolean }): Promise<string> {
  const r = await gh.post<GhRepo>('/user/repos', { name: o.name, description: o.description, private: o.private, auto_init: o.autoInit });
  gh.invalidate('/user/repos');
  return r.full_name;
}

export async function orgsOf(gh: GitHub): Promise<string[]> {
  const list = await gh.get<{ login: string }[]>('/user/orgs?per_page=100');
  return list.map((o) => o.login);
}

/** Issues and pull requests across every repository: "yours". */
export async function acrossRepos(gh: GitHub, q: string): Promise<(Issue & { isPull: boolean })[]> {
  const res = await gh.get<{ items: GhIssue[] }>(`/search/issues?q=${encodeURIComponent(q)}&sort=updated&order=desc&per_page=30`);
  return res.items.map((i) => ({ ...issueOf(i, gh.now()), isPull: !!i.pull_request }));
}

export async function notificationsOf(gh: GitHub, all: boolean): Promise<Notification[]> {
  const list = await gh.get<{ id: string; unread: boolean; reason: string; updated_at: string; subject: { title: string; type: string; url: string | null }; repository: { full_name: string } }[]>(`/notifications?per_page=50${all ? '&all=true' : ''}`);
  return list.map((n) => {
    const number = Number(/\/(?:issues|pulls)\/(\d+)$/.exec(n.subject.url ?? '')?.[1]) || undefined;
    return {
      id: n.id, unread: n.unread, reason: n.reason.replace(/_/g, ' '), title: n.subject.title, type: n.subject.type, repo: n.repository.full_name, number, when: ago(n.updated_at, gh.now()),
      url: number ? `https://github.com/${n.repository.full_name}/${n.subject.type === 'PullRequest' ? 'pull' : 'issues'}/${number}` : `https://github.com/${n.repository.full_name}`,
    };
  });
}

export async function markNotificationRead(gh: GitHub, id: string) {
  await gh.send('PATCH', `/notifications/threads/${id}`);
  gh.invalidate('/notifications');
}
export async function markAllNotificationsRead(gh: GitHub) {
  await gh.send('PUT', '/notifications', {});
  gh.invalidate('/notifications');
}

/** Reads `owner/name` (or a github.com URL) into owner/name; null when it isn't one. */
export function parseRepo(input: string): string | null {
  const m = /^(?:https?:\/\/)?(?:www\.)?(?:github\.com\/)?([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:[/?#].*)?$/.exec(input.trim());
  return m ? `${m[1]}/${m[2]}` : null;
}

/** Splits a simple YAML block with two-space indents into a workflow's `workflow_dispatch` inputs. Enough for what GitHub's own form reads. */
export function parseWorkflowInputs(yaml: string): { dispatchable: boolean; inputs: WorkflowInput[] } {
  const lines = yaml.split('\n');
  const at = lines.findIndex((l) => /^\s*workflow_dispatch\s*:?/.test(l) || /\bworkflow_dispatch\b/.test(l.replace(/#.*/, '')));
  if (at < 0) return { dispatchable: false, inputs: [] };
  const indentOf = (l: string) => l.length - l.trimStart().length;
  const base = indentOf(lines[at]);
  const inputs: WorkflowInput[] = [];
  let i = at + 1;
  while (i < lines.length && (!lines[i].trim() || indentOf(lines[i]) > base)) {
    if (/^\s*inputs\s*:/.test(lines[i])) {
      const inputsIndent = indentOf(lines[i]);
      i++;
      let current: WorkflowInput | null = null;
      let currentIndent = -1;
      let inOptions = false;
      while (i < lines.length && (!lines[i].trim() || indentOf(lines[i]) > inputsIndent)) {
        const line = lines[i];
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const indent = indentOf(line);
          const item = /^-\s+(.*)$/.exec(trimmed);
          if (inOptions && item && current) (current.options ??= []).push(unquote(item[1]));
          else {
            inOptions = false;
            const kv = /^([\w-]+)\s*:\s*(.*)$/.exec(trimmed);
            if (kv) {
              if (current == null || indent <= currentIndent) {
                current = { name: kv[1] };
                currentIndent = indent;
                inputs.push(current);
              } else if (kv[1] === 'options') {
                inOptions = true;
                const inline = /^\[(.*)\]$/.exec(kv[2]);
                if (inline) { current.options = inline[1].split(',').map((s) => unquote(s.trim())); inOptions = false; }
              } else if (kv[1] === 'description') current.description = unquote(kv[2]);
              else if (kv[1] === 'required') current.required = kv[2].trim() === 'true';
              else if (kv[1] === 'default') current.default = unquote(kv[2]);
              else if (kv[1] === 'type') current.type = kv[2].trim();
            }
          }
        }
        i++;
      }
      break;
    }
    i++;
  }
  return { dispatchable: true, inputs };
}
const unquote = (s: string) => s.trim().replace(/^['"]|['"]$/g, '');

/** A template's YAML front matter and body. */
export function parseTemplate(text: string, fallback: string): { name: string; about: string; title: string; body: string; labels: string[] } {
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text);
  const meta: Record<string, string> = {};
  for (const line of (m?.[1] ?? '').split('\n')) {
    const kv = /^([\w-]+)\s*:\s*(.*)$/.exec(line.trim());
    if (kv) meta[kv[1]] = unquote(kv[2]);
  }
  const labels = (meta.labels ?? '').replace(/^\[|\]$/g, '').split(',').map((s) => unquote(s)).filter(Boolean);
  return { name: meta.name ?? fallback, about: meta.about ?? meta.description ?? '', title: meta.title ?? '', body: m ? m[2] : text, labels };
}

/** A YAML issue form, as a Markdown skeleton. GitHub's API creates issues from text, so the form's fields become headings to fill in. */
export function parseIssueForm(text: string, fallback: string): { name: string; about: string; title: string; body: string; labels: string[] } {
  const top = (key: string) => unquote(new RegExp(`^${key}\\s*:\\s*(.*)$`, 'm').exec(text)?.[1] ?? '');
  const labelLine = top('labels');
  const labels = labelLine.replace(/^\[|\]$/g, '').split(',').map((x) => unquote(x)).filter(Boolean);
  const sections: string[] = [];
  let field: { type: string; label?: string; description?: string; value?: string; options: string[]; inOptions: boolean } | null = null;
  const flush = () => {
    if (!field || !field.label) { field = null; return; }
    if (field.type === 'markdown') { field = null; return; }
    const hint = field.description ? `<!-- ${field.description} -->\n` : '';
    const answer = field.type === 'checkboxes' ? field.options.map((o) => `- [ ] ${o}`).join('\n') : field.type === 'dropdown' ? `<!-- One of: ${field.options.join(', ')} -->\n` : field.value ?? '';
    sections.push(`### ${field.label}\n\n${hint}${answer}`.trimEnd());
    field = null;
  };
  for (const line of text.split('\n')) {
    const type = /^\s*-\s+type:\s*(\S+)/.exec(line);
    if (type) { flush(); field = { type: unquote(type[1]), options: [], inOptions: false }; continue; }
    if (!field) continue;
    const kv = /^\s*(label|description|value)\s*:\s*(.*)$/.exec(line);
    if (kv && !field.inOptions) { field[kv[1] as 'label' | 'description' | 'value'] = unquote(kv[2]); continue; }
    if (/^\s*options\s*:/.test(line)) { field.inOptions = true; continue; }
    if (field.inOptions) {
      const option = /^\s*-\s+(?:label:\s*)?(.+)$/.exec(line);
      if (option) field.options.push(unquote(option[1]));
      else if (/^\s*\w+\s*:/.test(line) && !/^\s*required\s*:/.test(line)) field.inOptions = false;
    }
  }
  flush();
  return { name: top('name') || fallback, about: top('description'), title: top('title'), body: sections.join('\n\n') + (sections.length ? '\n' : ''), labels };
}

const SORTS: Record<string, [string, string]> = {
  'created-desc': ['created', 'desc'], 'created-asc': ['created', 'asc'], 'updated-desc': ['updated', 'desc'], 'updated-asc': ['updated', 'asc'], 'comments-desc': ['comments', 'desc'], 'comments-asc': ['comments', 'asc'],
  'reactions-+1-desc': ['reactions-+1', 'desc'], 'reactions-desc': ['reactions', 'desc'],
};

/** Splits `sort:…` out of a query: the search API takes it as parameters. */
export function splitSort(q: string): { q: string; sort: string; order: string } {
  const m = /(?:^|\s)sort:(\S+)/.exec(q);
  const [sort, order] = (m && SORTS[m[1]]) ?? ['created', 'desc'];
  return { q: q.replace(/(?:^|\s)sort:\S+/, '').trim(), sort, order };
}

const LAST_COMMIT_FIELDS = 'nodes { oid messageHeadline committedDate author { name user { login avatarUrl } } }';
type GqlCommit = { oid: string; messageHeadline: string; committedDate: string; author: { name: string | null; user: { login: string; avatar_url?: string; avatarUrl?: string } | null } | null };
const gqlUser = (u: { login: string; avatar_url?: string; avatarUrl?: string } | null | undefined) => userOf(u ? { login: u.login, avatar_url: u.avatarUrl ?? u.avatar_url } : null);
const gqlLast = (c: GqlCommit, now: number): LastCommit => ({
  sha: c.oid.slice(0, 7), fullSha: c.oid, message: c.messageHeadline, author: c.author?.user ? gqlUser(c.author.user) : nameUser(c.author?.name ?? 'unknown'), when: ago(c.committedDate, now), at: c.committedDate,
});

const THREAD_QUERY = `query ReviewThreads($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      reviewThreads(first: 100) {
        nodes {
          id isResolved isOutdated path line originalLine startLine diffSide resolvedBy { login } viewerCanResolve viewerCanUnresolve viewerCanReply
          comments(first: 100) {
            nodes { databaseId body createdAt authorAssociation url diffHunk viewerCanUpdate viewerCanDelete author { login avatarUrl } pullRequestReview { databaseId state } }
          }
        }
      }
      reviews(first: 1, states: [PENDING]) { nodes { id databaseId comments { totalCount } } }
    }
  }
}`;

/** A RepoSource over GitHub's APIs for one repository. */
export function githubRepo(gh: GitHub, full: string, { live = true }: { live?: boolean } = {}): RepoSource {
  const r = '/repos/' + full;
  const [owner, name] = full.split('/');
  const now = gh.now;
  const optional = <T>(p: Promise<T>, fallback: T) => p.catch((e: unknown) => {
    // A missing optional part (no releases, Actions off) is not an error; a dead token or rate limit is.
    if (e instanceof GitHubError && (e.kind === 'auth' || e.kind === 'rateLimit')) throw e;
    return fallback;
  });
  const issue = (n: number) => gh.get<GhIssue>(`${r}/issues/${n}`);
  const pull = (n: number) => gh.get<GhPull>(`${r}/pulls/${n}`);
  const repoJson = () => gh.get<GhRepo>(r);
  const lastCommit = async (p: string, ref: string): Promise<LastCommit | null> => {
    const q = [ref && `sha=${encodeURIComponent(ref)}`, p && `path=${encodeURIComponent(p)}`, 'per_page=1'].filter(Boolean).join('&');
    const [c] = await gh.get<GhCommit[]>(`${r}/commits?${q}`);
    return c ? lastOf(c, now()) : null;
  };

  /* Rows this page just changed, laid over search results until search catches up. */
  const justChanged = new Map<number, { at: number; row: GhIssue }>();
  const remember = (row: GhIssue) => justChanged.set(row.number, { at: Date.now(), row });
  const overlay = (items: GhIssue[], q: string, kind: 'issue' | 'pr'): GhIssue[] => {
    const wants = /(?:^|\s)(?:is|state):(open|closed)\b/.exec(q)?.[1];
    const hits = new Set(items.map((i) => i.number));
    const out = items
      .map((i) => justChanged.get(i.number)?.row ?? i)
      .filter((i) => !wants || i.state === wants);
    // Only plain listings get rows added: we can't tell if a changed row matches a text or label query.
    if (/^(?:(?:is|state):\w+|sort:\S+|\s)*$/.test(q)) {
      for (const [n, { row, at }] of justChanged) {
        if (Date.now() - at > 30_000 || hits.has(n)) continue;
        if ((kind === 'pr') !== !!row.pull_request) continue;
        if (!wants || row.state === wants) out.unshift(row);
      }
    }
    return out;
  };
  const search = (q: string, page: number, kind: 'issue' | 'pr', per = 25) => {
    const { q: terms, sort, order } = splitSort(q);
    const full_q = `repo:${full} is:${kind} ${terms.replace(/(?:^|\s)is:(issue|pr)\b/g, ' ').trim()}`.trim();
    return gh.getPage<GhIssue>(`/search/issues?q=${encodeURIComponent(full_q)}&sort=${encodeURIComponent(sort)}&order=${order}&per_page=${per}`, page, (b) => {
      const body = b as { total_count: number; items: GhIssue[] };
      return { items: body.items, total: Math.min(body.total_count, 1000) };
    }).then((res) => ({ ...res, items: overlay(res.items, terms, kind) }));
  };

  /** After a change to issue or PR `n`: every read that shows it, now and again once search has caught up. */
  const touched = (n?: number) => {
    const prefixes = ['/search/issues', 'query', '/notifications'];
    gh.invalidate(...(n != null ? [`${r}/issues/${n}`, `${r}/pulls/${n}`, `${r}/pulls?`] : []), ...prefixes, `${r}/milestones`, `${r}/issues?`);
    gh.settleLater('/search/issues');
  };
  const gqlTouched = () => gh.invalidate('query');
  const codeTouched = () => {
    gh.invalidate(`${r}/git`, `${r}/contents`, `${r}/commits`, `${r}/readme`, `${r}/branches`, `${r}/compare`, `${r}/pulls`, `${r}/languages`, `${r}/contributors`, `${r}/tags`, 'query', r + ' ', `${r}/actions`, `${r}/stats`);
    gh.invalidate(r);
  };

  const pullStateOf = (p: GhPull): PullDetail['state'] => (p.merged_at ? 'merged' : p.state === 'closed' ? 'closed' : p.draft ? 'draft' : 'open');

  async function fetchRepo(): Promise<Repo> {
    const g = await repoJson();
    const branch = g.default_branch;
    const empty = await gh.get<unknown[]>(`${r}/commits?per_page=1`).then(() => false, (e: unknown) => {
      if (e instanceof GitHubError && e.status === 409) return true;
      if (e instanceof GitHubError && (e.kind === 'auth' || e.kind === 'rateLimit')) throw e;
      return false;
    });
    const [branches, branchCount, tagCount, commitCount, languages, contributors, contributorCount, release, releaseCount, last] = await Promise.all([
      optional(gh.get<{ name: string }[]>(`${r}/branches?per_page=100`), []),
      optional(gh.count(`${r}/branches`), 0),
      optional(gh.count(`${r}/tags`), 0),
      empty ? 0 : optional(gh.count(`${r}/commits?sha=${encodeURIComponent(branch)}`), 0),
      optional(gh.get<Record<string, number>>(`${r}/languages`), {}),
      empty ? [] : optional(gh.get<GhUser[]>(`${r}/contributors?per_page=14`), []),
      empty ? 0 : optional(gh.count(`${r}/contributors?anon=1`), 0),
      optional(gh.get<{ tag_name: string; published_at: string } | null>(`${r}/releases/latest`), null),
      optional(gh.count(`${r}/releases`), 0),
      empty ? null : optional(lastCommit('', ''), null),
    ]);
    const p = g.permissions ?? {};
    return {
      owner: g.owner.login, name: g.name, description: g.description ?? '', homepage: g.homepage ?? '', topics: g.topics ?? [],
      stars: compactCount(g.stargazers_count), forks: compactCount(g.forks_count), watchers: compactCount(g.subscribers_count ?? 0), starCount: g.stargazers_count, forkCount: g.forks_count, watcherCount: g.subscribers_count ?? 0,
      license: g.license?.name ?? '', branch,
      branches: [branch, ...branches.map((b) => b.name).filter((b) => b !== branch)],
      branchCount: branchCount || branches.length, tagCount, commitCount: commitCount.toLocaleString('en-US'),
      release: release ? { tag: release.tag_name, when: ago(release.published_at, now()), count: releaseCount } : null,
      languages: languagesOf(languages), contributors: contributors.map(userOf), contributorCount: contributorCount || contributors.length,
      lastCommit: last, private: g.private, url: g.html_url, empty, archived: !!g.archived, fork: !!g.fork, parent: g.parent?.full_name,
      permissions: { admin: !!p.admin, maintain: !!p.maintain, push: !!p.push, triage: !!p.triage, pull: p.pull ?? true },
      has: { issues: g.has_issues ?? true, wiki: g.has_wiki ?? false, projects: g.has_projects ?? false, discussions: g.has_discussions ?? false },
      merge: { merge: g.allow_merge_commit ?? true, squash: g.allow_squash_merge ?? true, rebase: g.allow_rebase_merge ?? true, auto: !!g.allow_auto_merge, deleteBranch: !!g.delete_branch_on_merge, updateBranch: !!g.allow_update_branch },
    };
  }

  const commentPath = (t: CommentTarget) => (t.kind === 'issue' ? `${r}/issues/${t.number}` : t.kind === 'issueComment' ? `${r}/issues/comments/${t.id}` : t.kind === 'commitComment' ? `${r}/comments/${t.id}` : `${r}/pulls/comments/${t.id}`);
  const reactionPath = (t: CommentTarget) => `${commentPath(t)}/reactions`;

  const releaseOf = (x: { id: number; tag_name: string; name: string | null; body: string | null; draft: boolean; prerelease: boolean; author: GhUser; created_at: string; published_at: string | null; target_commitish: string; html_url: string; zipball_url?: string | null; tarball_url?: string | null; assets: { id: number; name: string; size: number; download_count: number; browser_download_url: string }[] }, latest: string | null): Release => ({
    id: x.id, tag: x.tag_name, name: x.name || x.tag_name, body: x.body ?? '', draft: x.draft, prerelease: x.prerelease, latest: x.tag_name === latest, author: userOf(x.author), when: ago(x.published_at ?? x.created_at, now()), at: x.published_at ?? x.created_at, target: x.target_commitish,
    url: x.html_url, zip: x.zipball_url ?? undefined, tar: x.tarball_url ?? undefined, assets: x.assets.map((a) => ({ id: a.id, name: a.name, size: a.size, downloads: a.download_count, url: a.browser_download_url })),
  });
  const latestTag = () => optional(gh.get<{ tag_name: string }>(`${r}/releases/latest`).then((x) => x.tag_name as string | null), null);

  const runOf = (x: {
    id: number; workflow_id?: number; name: string; display_title: string; run_number: number; run_attempt?: number; event: string; actor: GhUser | null; head_branch: string | null; head_sha?: string; status: string | null; conclusion: string | null; created_at: string; run_started_at?: string; updated_at: string; html_url: string; pull_requests?: { number: number }[];
  }): WorkflowRun => ({
    id: x.id, title: x.display_title, workflow: x.name, workflowId: x.workflow_id, number: x.run_number, attempt: x.run_attempt, event: x.pull_requests?.[0] ? `${x.event} #${x.pull_requests[0].number}` : x.event, rawEvent: x.event, pull: x.pull_requests?.[0]?.number,
    actor: userOf(x.actor), branch: x.head_branch ?? '', sha: x.head_sha, status: runStatus(x), when: ago(x.created_at, now()), at: x.created_at,
    duration: duration(x.run_started_at ?? x.created_at, x.status === 'completed' ? x.updated_at : new Date(now()).toISOString()), url: x.html_url,
  });
  type GhRun = Parameters<typeof runOf>[0];

  const stats = async <T>(path: string): Promise<T | 'computing'> => {
    // 202: GitHub is computing the statistics and asks to come back; an empty answer means the same on a fresh repo.
    const res = await gh.get<T | Record<string, never>>(path);
    return Array.isArray(res) ? (res as T) : 'computing';
  };

  /** One commit of many paths on a branch: the Git Data API, since Contents is one file per commit. */
  const writeTree = async (branch: string, message: string, entries: ({ path: string; sha: string | null } | { path: string; content: string })[]) => {
    const ref = await gh.send<{ object: { sha: string } }>('GET', `${r}/git/ref/heads/${encPath(branch)}`);
    const parent = await gh.send<{ tree: { sha: string } }>('GET', `${r}/git/commits/${ref.object.sha}`);
    const tree = await gh.post<{ sha: string }>(`${r}/git/trees`, { base_tree: parent.tree.sha, tree: entries.map((e) => ({ path: e.path, mode: '100644', type: 'blob', ...('content' in e ? { content: e.content } : { sha: e.sha }) })) });
    const commit = await gh.post<{ sha: string }>(`${r}/git/commits`, { message, tree: tree.sha, parents: [ref.object.sha] });
    await gh.send('PATCH', `${r}/git/refs/heads/${encPath(branch)}`, { sha: commit.sha });
    return commit.sha;
  };

  const recursiveTree = (ref: string) => gh.get<{ tree: { path: string; type: string; size?: number; mode?: string; sha?: string }[]; truncated: boolean }>(`${r}/git/trees/${encodeURIComponent(ref || 'HEAD')}?recursive=1`).catch((e: unknown) => {
    if (e instanceof GitHubError && e.status === 409) return { tree: [], truncated: false };
    throw e;
  });

  const source: RepoSource = {
    id: `${live ? 'live' : 'sample'}:${gh.id}:${full}`,
    live,
    full,
    refresh: (scope) => gh.invalidate(r + (scope ?? ''), ...(scope ? [] : ['query', '/search'])),

    viewer: () => viewerOf(gh).catch((e: unknown) => {
      if (e instanceof GitHubError && e.kind === 'auth') return null;
      throw e;
    }),
    repo: fetchRepo,

    async counts(): Promise<Counts> {
      const data = await gh.query<{ repository: { openIssues: { totalCount: number }; closedIssues: { totalCount: number }; openPulls: { totalCount: number }; closedPulls: { totalCount: number } } }>(
        `query Counts($owner: String!, $name: String!) {
          repository(owner: $owner, name: $name) {
            openIssues: issues(states: OPEN) { totalCount }
            closedIssues: issues(states: CLOSED) { totalCount }
            openPulls: pullRequests(states: OPEN) { totalCount }
            closedPulls: pullRequests(states: [CLOSED, MERGED]) { totalCount }
          }
        }`, { owner, name });
      const x = data.repository;
      return { issues: { open: x.openIssues.totalCount, closed: x.closedIssues.totalCount }, pulls: { open: x.openPulls.totalCount, closed: x.closedPulls.totalCount } };
    },

    labels: async () => (await gh.getAll<GhLabel>(`${r}/labels?per_page=100`, 5)).map(labelOf),
    milestones: async (state) => (await gh.getAll<GhMilestone>(`${r}/milestones?state=${state}&per_page=100&sort=due_on`, 2)).map((m) => milestoneOf(m, now())),
    milestone: async (n) => milestoneOf(await gh.get<GhMilestone>(`${r}/milestones/${n}`), now()),
    assignable: async () => (await optional(gh.getAll<GhUser>(`${r}/assignees?per_page=100`, 2), [])).map(userOf),
    async people(kind, page) {
      if (kind === 'forks') {
        const res = await gh.getPage<GhRepo>(`${r}/forks?sort=stargazers&per_page=30`, page);
        return { ...res, items: res.items.map((f) => ({ ...userOf(f.owner), full: f.full_name, detail: `${f.full_name}${f.stargazers_count ? ` · ${compactCount(f.stargazers_count)} stars` : ''}` })) };
      }
      const path = kind === 'stargazers' ? 'stargazers' : kind === 'watchers' ? 'subscribers' : 'contributors';
      const res = await gh.getPage<GhUser & { contributions?: number }>(`${r}/${path}?per_page=30`, page);
      return { ...res, items: res.items.map((u) => ({ ...userOf(u), detail: u.contributions != null ? `${u.contributions.toLocaleString('en-US')} commits` : undefined })) };
    },
    starred: () => gh.exists(`/user/starred/${full}`),
    async setStarred(on) {
      await gh.send(on ? 'PUT' : 'DELETE', `/user/starred/${full}`);
      gh.invalidate(`/user/starred`, r);
    },
    async subscription() {
      const s = await gh.get<{ subscribed: boolean; ignored: boolean }>(`${r}/subscription`).catch((e: unknown) => {
        if (e instanceof GitHubError && e.kind === 'notFound') return null;
        throw e;
      });
      return !s ? 'participating' : s.ignored ? 'ignored' : 'all';
    },
    async setSubscription(to: Subscription) {
      if (to === 'participating') await gh.send('DELETE', `${r}/subscription`);
      else await gh.send('PUT', `${r}/subscription`, { subscribed: to === 'all', ignored: to === 'ignored' });
      gh.invalidate(`${r}/subscription`, r);
    },
    async fork({ name: forkName, organization, defaultBranchOnly }) {
      const f = await gh.post<GhRepo>(`${r}/forks`, { name: forkName || undefined, organization: organization || undefined, default_branch_only: !!defaultBranchOnly });
      gh.invalidate(r, '/user/repos');
      return f.full_name;
    },
    async update(patch) {
      const next = await gh.send<GhRepo>('PATCH', r, patch);
      gh.invalidate(r);
      return next.full_name;
    },
    async setTopics(names) {
      await gh.send('PUT', `${r}/topics`, { names });
      gh.invalidate(r);
    },
    collaborators: async () => (await gh.getAll<GhUser & { role_name?: string }>(`${r}/collaborators?per_page=100`, 2)).map((u) => ({ ...userOf(u), role: u.role_name ?? 'write' })),
    async addCollaborator(login, permission) {
      await gh.send('PUT', `${r}/collaborators/${encodeURIComponent(login)}`, { permission });
      gh.invalidate(`${r}/collaborators`, `${r}/assignees`);
    },
    async removeCollaborator(login) {
      await gh.send('DELETE', `${r}/collaborators/${encodeURIComponent(login)}`);
      gh.invalidate(`${r}/collaborators`, `${r}/assignees`);
    },
    async protection(branch) {
      const p = await gh.get<{ required_pull_request_reviews?: { required_approving_review_count?: number }; required_status_checks?: { strict?: boolean; contexts?: string[] } }>(`${r}/branches/${encPath(branch)}/protection`).catch((e: unknown) => {
        if (e instanceof GitHubError && (e.kind === 'notFound' || e.kind === 'forbidden')) return null;
        throw e;
      });
      return p ? { reviews: p.required_pull_request_reviews?.required_approving_review_count ?? 0, checks: p.required_status_checks?.contexts ?? [], strict: !!p.required_status_checks?.strict } : null;
    },

    async tree(ref) {
      return treeOf((await recursiveTree(ref)).tree);
    },
    treeTruncated: async (ref) => (await recursiveTree(ref)).truncated,
    async pathInfo(p, ref) {
      const hit = await gh.get<{ name: string; path: string; type: string; size?: number; sha?: string } | { name: string; path: string; type: string; size?: number; sha?: string }[]>(`${r}/contents/${encPath(p)}${refQuery(ref)}`).catch((e: unknown) => {
        if (e instanceof GitHubError && e.kind === 'notFound') return null;
        throw e;
      });
      if (!hit) return null;
      const node = (x: { name: string; path: string; type: string; size?: number; sha?: string }): FileNode => ({
        name: x.name, path: x.path, type: x.type === 'dir' ? 'dir' : 'file', commit: '', when: '', size: x.size, objectSha: x.sha, special: x.type === 'submodule' ? 'submodule' : x.type === 'symlink' ? 'symlink' : undefined,
      });
      if (Array.isArray(hit)) return { name: p.split('/').at(-1) ?? p, path: p, type: 'dir', commit: '', when: '', children: hit.map(node) };
      return node(hit);
    },
    readme: (ref) => gh.get<string>(`${r}/readme${refQuery(ref)}`, 'raw').catch((e: unknown) => {
      if (e instanceof GitHubError && e.kind === 'notFound') return null;
      throw e;
    }),
    async file(p, ref) {
      const bytes = new Uint8Array(await gh.get<ArrayBuffer>(`${r}/contents/${encPath(p)}${refQuery(ref)}`, 'bytes'));
      // Git's own test: a NUL in the first 8000 bytes means binary.
      if (bytes.subarray(0, 8000).includes(0)) return null;
      return new TextDecoder().decode(bytes);
    },
    async fileUrl(p, ref) {
      const bytes = await gh.get<ArrayBuffer>(`${r}/contents/${encPath(p)}${refQuery(ref)}`, 'bytes');
      const type = /\.svg$/i.test(p) ? 'image/svg+xml' : /\.png$/i.test(p) ? 'image/png' : /\.jpe?g$/i.test(p) ? 'image/jpeg' : /\.gif$/i.test(p) ? 'image/gif' : /\.webp$/i.test(p) ? 'image/webp' : 'application/octet-stream';
      return URL.createObjectURL(new Blob([bytes], { type }));
    },
    fileSha: (p, ref) => gh.get<{ sha: string }>(`${r}/contents/${encPath(p)}${refQuery(ref)}`).then((x) => x.sha, (e: unknown) => {
      if (e instanceof GitHubError && e.kind === 'notFound') return null;
      throw e;
    }),
    lastCommit,
    async lastCommits(paths, ref) {
      if (!paths.length) return {};
      // One query for the whole folder: what GitHub's own file table asks.
      const fields = paths.map((p, i) => `f${i}: history(first: 1, path: ${JSON.stringify(p)}) { ${LAST_COMMIT_FIELDS} }`).join('\n');
      const expression = ref || 'HEAD';
      const data = await gh.query<{ repository: { object: Record<string, { nodes: GqlCommit[] }> | null } }>(
        `query LastCommits($owner: String!, $name: String!, $ref: String!) { repository(owner: $owner, name: $name) { object(expression: $ref) { ... on Commit { ${fields} } } } }`, { owner, name, ref: expression });
      const out: Record<string, LastCommit> = {};
      const object = data.repository.object;
      if (object) paths.forEach((p, i) => { const c = object[`f${i}`]?.nodes[0]; if (c) out[p] = gqlLast(c, now()); });
      return out;
    },
    async blame(p, ref) {
      const data = await gh.query<{ repository: { object: { blame?: { ranges: { startingLine: number; endingLine: number; commit: GqlCommit }[] } } | null } }>(
        `query Blame($owner: String!, $name: String!, $ref: String!, $path: String!) { repository(owner: $owner, name: $name) { object(expression: $ref) { ... on Commit { blame(path: $path) { ranges { startingLine endingLine commit { oid messageHeadline committedDate author { name user { login avatarUrl } } } } } } } } }`,
        { owner, name, ref: ref || 'HEAD', path: p });
      return (data.repository.object?.blame?.ranges ?? []).map((x): BlameRange => ({ start: x.startingLine, end: x.endingLine, commit: gqlLast(x.commit, now()) }));
    },
    async branches(page, q) {
      const res = await gh.getPage<{ name: string; commit: { sha: string }; protected?: boolean }>(`${r}/branches?per_page=30`, page);
      const items = q ? res.items.filter((b) => b.name.toLowerCase().includes(q.toLowerCase())) : res.items;
      const def = (await repoJson()).default_branch;
      const rows = await Promise.all(items.map(async (b): Promise<RefInfo> => {
        const [commit, cmp, pulls] = await Promise.all([
          optional(gh.get<GhCommit>(`${r}/commits/${b.commit.sha}`).then((c) => lastOf(c, now())), undefined),
          b.name === def ? null : optional(gh.get<{ ahead_by: number; behind_by: number }>(`${r}/compare/${encodeURIComponent(def)}...${encodeURIComponent(b.name)}`), null),
          b.name === def ? [] : optional(gh.get<GhPull[]>(`${r}/pulls?state=all&head=${encodeURIComponent(`${owner}:${b.name}`)}&per_page=1`), []),
        ]);
        const p = pulls[0];
        return { name: b.name, sha: b.commit.sha, protected: b.protected, commit, ahead: cmp?.ahead_by, behind: cmp?.behind_by, pull: p ? { number: p.number, state: pullStateOf(p) } : undefined };
      }));
      return { ...res, items: rows };
    },
    async tags(page) {
      const res = await gh.getPage<{ name: string; commit: { sha: string } }>(`${r}/tags?per_page=30`, page);
      const rows = await Promise.all(res.items.map(async (t): Promise<RefInfo> => ({ name: t.name, sha: t.commit.sha, commit: await optional(gh.get<GhCommit>(`${r}/commits/${t.commit.sha}`).then((c) => lastOf(c, now())), undefined) })));
      return { ...res, items: rows };
    },
    async refNames() {
      const [branches, tags] = await Promise.all([gh.getAll<{ name: string }>(`${r}/branches?per_page=100`, 3), gh.getAll<{ name: string }>(`${r}/tags?per_page=100`, 3)]);
      return { branches: branches.map((b) => b.name), tags: tags.map((t) => t.name) };
    },
    async createBranch(branch, from) {
      const c = await gh.get<GhCommit>(`${r}/commits/${encodeURIComponent(from)}`);
      await gh.post(`${r}/git/refs`, { ref: `refs/heads/${branch}`, sha: c.sha });
      codeTouched();
    },
    async createBranchAt(branch, sha) {
      await gh.post(`${r}/git/refs`, { ref: `refs/heads/${branch}`, sha });
      codeTouched();
    },
    async deleteBranch(branch) {
      await gh.send('DELETE', `${r}/git/refs/heads/${encPath(branch)}`);
      codeTouched();
    },
    async renameBranch(from, to) {
      await gh.post(`${r}/branches/${encPath(from)}/rename`, { new_name: to });
      codeTouched();
    },
    async createTag(tag, sha) {
      await gh.post(`${r}/git/refs`, { ref: `refs/tags/${tag}`, sha });
      codeTouched();
    },
    async deleteTag(tag) {
      await gh.send('DELETE', `${r}/git/refs/tags/${encPath(tag)}`);
      codeTouched();
    },
    async putFile({ path, content, message, branch, sha }) {
      const res = await gh.send<{ commit: { sha: string } }>('PUT', `${r}/contents/${encPath(path)}`, { message, content: b64(content), branch, ...(sha ? { sha } : {}) }).catch((e: unknown) => {
        if (!sha && e instanceof GitHubError && e.kind === 'validation' && /\bsha\b/i.test(e.message)) throw new GitHubError(e.status, `A file already exists at ${path}.`, 'validation');
        throw e;
      });
      codeTouched();
      return res.commit.sha;
    },
    async deleteFile({ path, message, branch, sha }) {
      const res = await gh.send<{ commit: { sha: string } }>('DELETE', `${r}/contents/${encPath(path)}`, { message, branch, sha });
      codeTouched();
      return res.commit.sha;
    },

    async moveFile({ from, to, content, message, branch, sha }) {
      // The Git Data API doesn't check versions the way Contents does, so check first: same conflict, same protection.
      const current = await gh.send<{ sha: string }>('GET', `${r}/contents/${encPath(from)}${refQuery(branch)}`);
      if (sha && current.sha !== sha) throw new GitHubError(409, `${from} does not match ${sha}`, 'validation');
      const out = await writeTree(branch, message, [{ path: from, sha: null }, { path: to, content }]);
      codeTouched();
      return out;
    },
    async commitFiles({ files, message, branch }) {
      const blobs = await Promise.all(files.map(async (f) => ({ path: f.path, sha: (await gh.post<{ sha: string }>(`${r}/git/blobs`, { content: f.base64, encoding: 'base64' })).sha })));
      const out = await writeTree(branch, message, blobs);
      codeTouched();
      return out;
    },

    async commits({ ref, path, author, since, until, page }) {
      const q = [ref && `sha=${encodeURIComponent(ref)}`, path && `path=${encodeURIComponent(path)}`, author && `author=${encodeURIComponent(author)}`, since && `since=${encodeURIComponent(since)}`, until && `until=${encodeURIComponent(until)}`, 'per_page=30'].filter(Boolean).join('&');
      const res = await gh.getPage<GhCommit>(`${r}/commits?${q}`, page).catch((e: unknown) => {
        if (e instanceof GitHubError && e.status === 409) return { items: [], page: 1, hasNext: false, hasPrev: false } as Paged<GhCommit>;
        throw e;
      });
      return { ...res, items: res.items.map((c) => commitOf(c, now())) };
    },
    async commit(sha) {
      const c = await gh.get<GhCommit & { stats?: { additions: number; deletions: number }; files?: GhFile[] }>(`${r}/commits/${encodeURIComponent(sha)}`);
      const [pulls, runs, statuses] = await Promise.all([
        optional(gh.get<{ number: number; title: string }[]>(`${r}/commits/${c.sha}/pulls`), []),
        optional(gh.get<{ check_runs: GhCheckRun[] }>(`${r}/commits/${c.sha}/check-runs?per_page=100`), { check_runs: [] }),
        optional(gh.get<{ statuses: GhStatus[] }>(`${r}/commits/${c.sha}/status`), { statuses: [] }),
      ]);
      return { ...commitOf(c, now()), files: (c.files ?? []).map(diffFileOf), additions: c.stats?.additions ?? 0, deletions: c.stats?.deletions ?? 0, pulls: pulls.map((p) => ({ number: p.number, title: p.title })), checks: checksOf(runs.check_runs, statuses.statuses) } satisfies CommitDetail;
    },
    async compare(base, head) {
      const res = await gh.get<{ status: Comparison['status']; ahead_by: number; behind_by: number; commits: GhCommit[]; files?: GhFile[]; html_url: string }>(`${r}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}`);
      return { status: res.status, ahead: res.ahead_by, behind: res.behind_by, commits: res.commits.map((c) => commitOf(c, now())), files: (res.files ?? []).map(diffFileOf), url: res.html_url };
    },

    commitComments: async (sha) => (await gh.getAll<{ id: number; body: string; user: GhUser | null; created_at: string; html_url: string; path?: string | null; line?: number | null; author_association?: string }>(`${r}/commits/${encodeURIComponent(sha)}/comments?per_page=100`, 3)).map((c): CommitComment => ({
      id: c.id, author: userOf(c.user), body: c.body, when: ago(c.created_at, now()), at: c.created_at, url: c.html_url, path: c.path, line: c.line, role: ROLE[c.author_association ?? ''],
    })),
    async addCommitComment(sha, body) {
      await gh.post(`${r}/commits/${encodeURIComponent(sha)}/comments`, { body });
      gh.invalidate(`${r}/commits`);
    },

    async searchIssues(q, page) {
      const res = await search(q, page, 'issue');
      return { ...res, items: res.items.map((i) => issueOf(i, now())) };
    },
    async searchPulls(q, page) {
      const res = await search(q, page, 'pr');
      const rows = res.items.map((i) => pullRowOf(i, now()));
      if (!rows.length) return { ...res, items: rows };
      // Search says nothing about reviews and checks: one GraphQL query fills every row in.
      const fields = rows.map((p) => `p${p.number}: pullRequest(number: ${p.number}) { number isDraft reviewDecision commits(last: 1) { nodes { commit { statusCheckRollup { state } } } } headRefName baseRefName }`).join('\n');
      const data = await gh.query<{ repository: Record<string, { reviewDecision: string | null; isDraft: boolean; commits: { nodes: { commit: { statusCheckRollup: { state: string } | null } }[] }; headRefName: string; baseRefName: string }> }>(
        `query PullRows($owner: String!, $name: String!) { repository(owner: $owner, name: $name) { ${fields} } }`, { owner, name }).catch((e: unknown) => {
        if (e instanceof GitHubError && (e.kind === 'auth' || e.kind === 'rateLimit')) throw e;
        return null;
      });
      for (const p of rows) {
        const x = data?.repository[`p${p.number}`];
        if (!x) continue;
        const state = x.commits.nodes[0]?.commit.statusCheckRollup?.state;
        p.checks = state === 'SUCCESS' ? 'success' : state === 'FAILURE' || state === 'ERROR' ? 'failure' : state === 'PENDING' || state === 'EXPECTED' ? 'pending' : undefined;
        p.review = x.isDraft ? 'draft' : x.reviewDecision === 'APPROVED' ? 'approved' : x.reviewDecision === 'CHANGES_REQUESTED' ? 'changes' : x.reviewDecision === 'REVIEW_REQUIRED' ? 'pending' : undefined;
        p.head = x.headRefName;
        p.base = x.baseRefName;
      }
      return { ...res, items: rows };
    },

    async issue(n): Promise<IssueDetail> {
      const i = await issue(n);
      return {
        ...issueOf(i, now()), when: ago(i.created_at, now()), at: i.created_at, body: i.body ?? '', bodyEdited: false, milestoneNumber: i.milestone?.number, milestoneDetail: i.milestone ? milestoneOf(i.milestone, now()) : undefined,
        reactions: reactionsOf(i.reactions), lockReason: i.active_lock_reason, closedBy: i.closed_by ? userOf(i.closed_by) : null, nodeId: i.node_id ?? '',
      };
    },
    async issueExtras(n): Promise<IssueExtras | null> {
      const data = await gh.query<{ repository: { issue: { id: string; isPinned: boolean; viewerSubscription: string; viewerCanDelete: boolean; closedByPullRequestsReferences: { nodes: { number: number; title: string; state: string }[] } | null } } }>(
        `query IssueExtras($owner: String!, $name: String!, $number: Int!) { repository(owner: $owner, name: $name) { issue(number: $number) { id isPinned viewerSubscription viewerCanDelete closedByPullRequestsReferences(first: 10, includeClosedPrs: true) { nodes { number title state } } } } }`, { owner, name, number: n });
      const x = data?.repository.issue;
      return x ? {
        id: x.id, pinned: x.isPinned, subscribed: x.viewerSubscription === 'SUBSCRIBED', canDelete: x.viewerCanDelete,
        closedBy: (x.closedByPullRequestsReferences?.nodes ?? []).map((p) => ({ number: p.number, title: p.title, state: p.state === 'MERGED' ? 'merged' as const : p.state === 'OPEN' ? 'open' as const : 'closed' as const })),
      } : null;
    },
    async createIssue(d) {
      const row = await gh.post<GhIssue>(`${r}/issues`, { title: d.title, body: d.body, labels: d.labels, assignees: d.assignees, ...(d.milestone != null ? { milestone: d.milestone } : {}) });
      remember(row);
      touched();
      return row.number;
    },
    async updateIssue(n, p) {
      const row = await gh.send<GhIssue>('PATCH', `${r}/issues/${n}`, {
        ...(p.title !== undefined ? { title: p.title } : {}), ...(p.body !== undefined ? { body: p.body } : {}), ...(p.state ? { state: p.state } : {}), ...(p.stateReason !== undefined ? { state_reason: p.stateReason } : {}),
        ...(p.labels ? { labels: p.labels } : {}), ...(p.assignees ? { assignees: p.assignees } : {}), ...(p.milestone !== undefined ? { milestone: p.milestone } : {}),
      });
      remember(row);
      touched(n);
    },
    async lock(n, reason) {
      await gh.send('PUT', `${r}/issues/${n}/lock`, reason ? { lock_reason: reason } : {});
      touched(n);
    },
    async unlock(n) {
      await gh.send('DELETE', `${r}/issues/${n}/lock`);
      touched(n);
    },
    async deleteIssue(id, n) {
      await gh.mutate(`mutation DeleteIssue($id: ID!) { result: deleteIssue(input: { issueId: $id }) { clientMutationId } }`, { id });
      justChanged.delete(n);
      touched(n);
    },
    async setPinned(id, n, on) {
      await gh.mutate(on ? `mutation PinIssue($id: ID!) { result: pinIssue(input: { issueId: $id }) { clientMutationId } }` : `mutation UnpinIssue($id: ID!) { result: unpinIssue(input: { issueId: $id }) { clientMutationId } }`, { id });
      touched(n);
    },
    async setThreadSubscribed(id, n, on) {
      await gh.mutate(`mutation SetSubscription($id: ID!, $state: SubscriptionState!) { result: updateSubscription(input: { subscribableId: $id, state: $state }) { subscribable { viewerSubscription } } }`, { id, state: on ? 'SUBSCRIBED' : 'UNSUBSCRIBED' });
      touched(n);
    },
    async timeline(n) {
      const [i, events] = await Promise.all([issue(n), gh.getAll<GhEvent>(`${r}/issues/${n}/timeline?per_page=100`, 5)]);
      const body: TimelineItem = {
        kind: 'comment', id: 'body', author: userOf(i.user), when: ago(i.created_at, now()), at: i.created_at, body: i.body || '*No description provided.*', role: ROLE[i.author_association ?? ''], url: i.html_url,
        reactions: reactionsOf(i.reactions), target: { kind: 'issue', number: n }, isBody: true,
      };
      return [body, ...timelineOf(events, now())];
    },
    async comment(n, body) {
      const c = await gh.post<{ id: number; body: string; user: GhUser; created_at: string; html_url: string; author_association: string }>(`${r}/issues/${n}/comments`, { body });
      touched(n);
      return { kind: 'comment', id: 'c' + c.id, dbId: c.id, author: userOf(c.user), when: ago(c.created_at, now()), body: c.body, role: ROLE[c.author_association], url: c.html_url, target: { kind: 'issueComment', id: c.id } };
    },
    async editComment(t, body) {
      await gh.send('PATCH', commentPath(t), { body });
      if (t.kind === 'issue') touched(t.number);
      else gh.invalidate(`${r}/issues`, `${r}/pulls`, `${r}/comments`, `${r}/commits`, 'query');
    },
    async deleteComment(t, n) {
      await gh.send('DELETE', commentPath(t));
      gh.invalidate(`${r}/commits`);
      touched(n);
    },
    async myReactions(t) {
      const me = await viewerOf(gh).catch(() => null);
      const list = await gh.getAll<{ id: number; content: ReactionContent; user: GhUser | null }>(`${reactionPath(t)}?per_page=100`, 2);
      const out: Partial<Record<ReactionContent, number>> = {};
      for (const x of list) if (x.user?.login === me?.login) out[x.content] = x.id;
      return out;
    },
    async react(t, content) {
      await gh.post(reactionPath(t), { content });
      gh.invalidate(reactionPath(t), `${r}/issues`, `${r}/pulls`, 'query');
    },
    async unreact(t, id) {
      await gh.send('DELETE', `${reactionPath(t)}/${id}`);
      gh.invalidate(reactionPath(t), `${r}/issues`, `${r}/pulls`, 'query');
    },
    async createLabel(l) {
      await gh.post(`${r}/labels`, { name: l.name, color: l.color.replace('#', ''), description: l.description || undefined });
      gh.invalidate(`${r}/labels`);
    },
    async updateLabel(old, l) {
      await gh.send('PATCH', `${r}/labels/${encodeURIComponent(old)}`, { ...(l.name ? { new_name: l.name } : {}), ...(l.color ? { color: l.color.replace('#', '') } : {}), ...(l.description !== undefined ? { description: l.description } : {}) });
      gh.invalidate(`${r}/labels`, `${r}/issues`, `${r}/pulls`, '/search/issues');
    },
    async deleteLabel(l) {
      await gh.send('DELETE', `${r}/labels/${encodeURIComponent(l)}`);
      gh.invalidate(`${r}/labels`, `${r}/issues`, `${r}/pulls`, '/search/issues');
    },
    async createMilestone(m) {
      const res = await gh.post<GhMilestone>(`${r}/milestones`, { title: m.title, description: m.description, ...(m.due ? { due_on: m.due } : {}) });
      gh.invalidate(`${r}/milestones`);
      return res.number;
    },
    async updateMilestone(n, m) {
      await gh.send('PATCH', `${r}/milestones/${n}`, { ...(m.title !== undefined ? { title: m.title } : {}), ...(m.description !== undefined ? { description: m.description } : {}), ...(m.due !== undefined ? { due_on: m.due } : {}), ...(m.state ? { state: m.state } : {}) });
      gh.invalidate(`${r}/milestones`, `${r}/issues`, `${r}/pulls`, '/search/issues');
    },
    async deleteMilestone(n) {
      await gh.send('DELETE', `${r}/milestones/${n}`);
      gh.invalidate(`${r}/milestones`, `${r}/issues`, `${r}/pulls`, '/search/issues');
    },
    async issueTemplates() {
      const list = await gh.get<{ name: string; path: string; type: string }[]>(`${r}/contents/.github/ISSUE_TEMPLATE`).catch((e: unknown) => {
        if (e instanceof GitHubError && (e.kind === 'notFound' || e.status === 409)) return [];
        throw e;
      });
      const files = (Array.isArray(list) ? list : []).filter((f) => f.type === 'file' && /\.(md|ya?ml)$/i.test(f.name) && !/^config\.ya?ml$/i.test(f.name));
      return Promise.all(files.map(async (f) => {
        const text = await gh.get<string>(`${r}/contents/${encPath(f.path)}`, 'raw');
        const name = f.name.replace(/\.\w+$/, '');
        return /\.md$/i.test(f.name) ? parseTemplate(text, name) : parseIssueForm(text, name);
      }));
    },
    pullTemplate: async () => {
      for (const p of ['.github/PULL_REQUEST_TEMPLATE.md', '.github/pull_request_template.md', 'PULL_REQUEST_TEMPLATE.md', 'docs/PULL_REQUEST_TEMPLATE.md']) {
        const text = await gh.get<string>(`${r}/contents/${p}`, 'raw').catch((e: unknown) => {
          if (e instanceof GitHubError && (e.kind === 'notFound' || e.status === 409)) return null;
          throw e;
        });
        if (text != null) return text;
      }
      return null;
    },

    async pull(n): Promise<PullDetail> {
      const [p, reviews, i] = await Promise.all([pull(n), optional(gh.get<{ id: number; user: GhUser | null; state: string }[]>(`${r}/pulls/${n}/reviews?per_page=100`), []), optional(issue(n), null)]);
      // Each reviewer's latest verdict; a plain comment doesn't replace an approval.
      const latest = new Map<string, Reviewer>();
      for (const v of reviews) {
        const state = v.state === 'APPROVED' ? 'approved' : v.state === 'CHANGES_REQUESTED' ? 'changes' : v.state === 'COMMENTED' ? 'commented' : v.state === 'DISMISSED' ? 'dismissed' : null;
        if (!state || !v.user) continue;
        const prev = latest.get(v.user.login);
        if (state === 'commented' && prev && prev.state !== 'commented') continue;
        latest.set(v.user.login, { user: userOf(v.user), state, reviewId: v.id });
      }
      for (const u of p.requested_reviewers ?? []) latest.set(u.login, { user: userOf(u), state: 'pending' });
      for (const t of p.requested_teams ?? []) latest.set(t.name, { user: nameUser(t.name), state: 'pending', isTeam: true });
      const reviewers = [...latest.values()];
      const state = pullStateOf(p);
      return {
        number: p.number, title: p.title, state, author: userOf(p.user), when: ago(p.created_at, now()), at: p.created_at, labels: p.labels.map(labelOf), comments: p.comments + (p.review_comments ?? 0), milestone: p.milestone?.title, milestoneNumber: p.milestone?.number, milestoneDetail: p.milestone ? milestoneOf(p.milestone, now()) : undefined,
        review: p.draft ? 'draft' : reviewers.some((x) => x.state === 'changes') ? 'changes' : reviewers.some((x) => x.state === 'approved') ? 'approved' : 'pending',
        head: p.head.ref, base: p.base.ref, commits: p.commits, additions: p.additions, deletions: p.deletions, url: p.html_url,
        body: p.body ?? '', bodyEdited: false, reviewers, assignees: (p.assignees ?? []).map(userOf), changedFiles: p.changed_files ?? 0,
        mergeable: p.mergeable_state ?? 'unknown', canMerge: p.mergeable ?? null, headSha: p.head.sha, baseSha: p.base.sha, headLabel: p.head.label ?? p.head.ref, headRepo: p.head.repo?.full_name, headDeleted: !p.head.repo,
        fromFork: !!p.head.repo && p.head.repo.full_name !== full, mergedBy: p.merged_by ? userOf(p.merged_by) : null, mergedWhen: p.merged_at ? ago(p.merged_at, now()) : undefined, mergeSha: p.merge_commit_sha, closedWhen: p.closed_at ? ago(p.closed_at, now()) : undefined,
        maintainerCanModify: !!p.maintainer_can_modify, autoMerge: p.auto_merge ? { method: p.auto_merge.merge_method, by: userOf(p.auto_merge.enabled_by) } : null, nodeId: p.node_id ?? '', reactions: reactionsOf(i?.reactions), locked: p.locked, lockReason: p.active_lock_reason,
      };
    },
    async pullExtras(n): Promise<PullExtras | null> {
      const data = await gh.query<{ repository: { pullRequest: { reviewDecision: PullExtras['decision']; viewerSubscription: string; closingIssuesReferences: { nodes: { number: number; title: string; state: string }[] }; files: { nodes: { path: string; viewerViewedState: string }[] } | null } } }>(
        `query PullExtras($owner: String!, $name: String!, $number: Int!) { repository(owner: $owner, name: $name) { pullRequest(number: $number) { reviewDecision viewerSubscription closingIssuesReferences(first: 20) { nodes { number title state } } files(first: 100) { nodes { path viewerViewedState } } } } }`, { owner, name, number: n });
      const x = data?.repository.pullRequest;
      if (!x) return null;
      return {
        decision: x.reviewDecision, subscribed: x.viewerSubscription === 'SUBSCRIBED', closes: x.closingIssuesReferences.nodes.map((c) => ({ number: c.number, title: c.title, state: c.state === 'OPEN' ? 'open' : 'closed' })),
        viewed: (x.files?.nodes ?? []).filter((f) => f.viewerViewedState === 'VIEWED').map((f) => f.path),
      };
    },
    pullCommits: async (n) => (await gh.getAll<GhCommit>(`${r}/pulls/${n}/commits?per_page=100`, 3)).map((c) => commitOf(c, now())),
    async pullChecks(n) {
      const sha = (await pull(n)).head.sha;
      const [runs, statuses] = await Promise.all([
        optional(gh.get<{ check_runs: GhCheckRun[] }>(`${r}/commits/${sha}/check-runs?per_page=100`), { check_runs: [] }),
        optional(gh.get<{ statuses: GhStatus[] }>(`${r}/commits/${sha}/status`), { statuses: [] }),
      ]);
      return checksOf(runs.check_runs, statuses.statuses);
    },
    pullFiles: async (n) => (await gh.getAll<GhFile>(`${r}/pulls/${n}/files?per_page=100`, 3)).map(diffFileOf),
    async pullThreads(n): Promise<PullThreads> {
      const data = await gh.query<{ repository: { pullRequest: { reviewThreads: { nodes: GqlThread[] }; reviews: { nodes: { id: string; databaseId: number; comments: { totalCount: number } }[] } | null } } }>(THREAD_QUERY, { owner, name, number: n });
      const pr = data.repository.pullRequest;
      return {
        threads: pr.reviewThreads.nodes.map((t): ReviewThread => ({
          id: t.id, path: t.path, line: t.line, originalLine: t.originalLine ?? t.line, startLine: t.startLine, side: t.diffSide === 'LEFT' ? 'LEFT' : 'RIGHT', resolved: t.isResolved, resolvedBy: t.resolvedBy?.login, outdated: t.isOutdated, canResolve: t.viewerCanResolve, canUnresolve: t.viewerCanUnresolve, canReply: t.viewerCanReply,
          hunk: t.comments.nodes[0]?.diffHunk ?? '',
          comments: t.comments.nodes.map((c) => ({
            id: c.databaseId, author: gqlUser(c.author), body: c.body, when: ago(c.createdAt, now()), at: c.createdAt, role: ROLE[c.authorAssociation ?? ''], url: c.url, reviewId: c.pullRequestReview?.databaseId, pending: c.pullRequestReview?.state === 'PENDING', canEdit: c.viewerCanUpdate, canDelete: c.viewerCanDelete,
          })),
        })),
        pending: pendingOf(pr.reviews?.nodes[0]),
      };
    },
    async createPull(o) {
      const p = await gh.post<GhPull>(`${r}/pulls`, { title: o.title, body: o.body, head: o.head, base: o.base, draft: o.draft, maintainer_can_modify: o.maintainerCanModify ?? true });
      touched();
      gh.invalidate(`${r}/branches`);
      return p.number;
    },
    async updatePull(n, patch) {
      await gh.send('PATCH', `${r}/pulls/${n}`, patch);
      const row = await gh.send<GhIssue>('GET', `${r}/issues/${n}`);
      remember(row);
      touched(n);
    },
    async merge(n, { method, title, message, sha }) {
      await gh.send('PUT', `${r}/pulls/${n}/merge`, { merge_method: method, ...(title !== undefined ? { commit_title: title } : {}), ...(message !== undefined ? { commit_message: message } : {}), ...(sha ? { sha } : {}) });
      const row = await gh.send<GhIssue>('GET', `${r}/issues/${n}`);
      remember(row);
      touched(n);
      codeTouched();
    },
    async revert(id, n, title) {
      const res = await gh.mutate<{ result: { revertPullRequest: { number: number } } }>(`mutation RevertPull($id: ID!, $title: String) { result: revertPullRequest(input: { pullRequestId: $id, title: $title }) { revertPullRequest { number } } }`, { id, title });
      touched(n);
      codeTouched();
      return res.result.revertPullRequest.number;
    },
    branchNamesOf: async (other) => (await gh.getAll<{ name: string }>(`/repos/${other}/branches?per_page=100`, 2)).map((b) => b.name),
    async updateBranch(n) {
      await gh.send('PUT', `${r}/pulls/${n}/update-branch`, {});
      touched(n);
      codeTouched();
    },
    async setDraft(id, n, draft) {
      await gh.mutate(draft ? `mutation ConvertToDraft($id: ID!) { result: convertPullRequestToDraft(input: { pullRequestId: $id }) { pullRequest { id } } }` : `mutation MarkReady($id: ID!) { result: markPullRequestReadyForReview(input: { pullRequestId: $id }) { pullRequest { id } } }`, { id });
      touched(n);
    },
    async setAutoMerge(id, n, method) {
      if (method) await gh.mutate(`mutation EnableAutoMerge($id: ID!, $method: PullRequestMergeMethod!) { result: enablePullRequestAutoMerge(input: { pullRequestId: $id, mergeMethod: $method }) { pullRequest { id } } }`, { id, method: method.toUpperCase() });
      else await gh.mutate(`mutation DisableAutoMerge($id: ID!) { result: disablePullRequestAutoMerge(input: { pullRequestId: $id }) { pullRequest { id } } }`, { id });
      touched(n);
    },
    async requestReviewers(n, logins) {
      await gh.post(`${r}/pulls/${n}/requested_reviewers`, { reviewers: logins });
      touched(n);
    },
    async removeReviewers(n, logins) {
      await gh.send('DELETE', `${r}/pulls/${n}/requested_reviewers`, { reviewers: logins });
      touched(n);
    },
    async dismissReview(n, id, message) {
      await gh.send('PUT', `${r}/pulls/${n}/reviews/${id}/dismissals`, { message });
      touched(n);
    },
    async addPendingComment(n, c, headSha) {
      const existing = (await source.pullThreads(n) as PullThreads).pending;
      if (existing) {
        // REST allows one pending review and can't add to it; GraphQL can.
        await gh.mutate(
          `mutation AddPendingThread($review: ID!, $path: String!, $line: Int!, $side: DiffSide!, $startLine: Int, $body: String!) { result: addPullRequestReviewThread(input: { pullRequestReviewId: $review, path: $path, line: $line, side: $side, startLine: $startLine, body: $body }) { thread { id } } }`,
          { review: existing.nodeId, path: c.path, line: c.line, side: c.side, startLine: c.startLine ?? null, body: c.body },
        );
      } else {
        // A review with no event stays pending until it's submitted.
        const comment = { path: c.path, line: c.line, side: c.side, body: c.body, ...(c.startLine ? { start_line: c.startLine, start_side: c.side } : {}) };
        await gh.post(`${r}/pulls/${n}/reviews`, { commit_id: headSha, comments: [comment] });
      }
      gh.invalidate('query');
    },
    async addReviewComment(n, c, headSha) {
      await gh.post(`${r}/pulls/${n}/comments`, { commit_id: headSha, path: c.path, line: c.line, side: c.side, body: c.body, ...(c.startLine ? { start_line: c.startLine, start_side: c.side } : {}) });
      touched(n);
    },
    async replyToThread(n, commentId, body) {
      await gh.post(`${r}/pulls/${n}/comments/${commentId}/replies`, { body });
      touched(n);
    },
    async setThreadResolved(threadId, _n, resolved) {
      await gh.mutate(resolved ? `mutation ResolveThread($id: ID!) { thread: resolveReviewThread(input: { threadId: $id }) { thread { id isResolved } } }` : `mutation UnresolveThread($id: ID!) { thread: unresolveReviewThread(input: { threadId: $id }) { thread { id isResolved } } }`, { id: threadId });
      gqlTouched();
    },
    async submitReview(n, { event, body, pendingId, headSha }) {
      if (pendingId) await gh.post(`${r}/pulls/${n}/reviews/${pendingId}/events`, { event, body });
      else await gh.post(`${r}/pulls/${n}/reviews`, { event, body, commit_id: headSha });
      touched(n);
    },
    async discardReview(n, id) {
      await gh.send('DELETE', `${r}/pulls/${n}/reviews/${id}`);
      touched(n);
    },
    async setFileViewed(id, n, path, viewed) {
      await gh.mutate(viewed ? `mutation MarkFileViewed($id: ID!, $path: String!) { result: markFileAsViewed(input: { pullRequestId: $id, path: $path }) { clientMutationId } }` : `mutation UnmarkFileViewed($id: ID!, $path: String!) { result: unmarkFileAsViewed(input: { pullRequestId: $id, path: $path }) { clientMutationId } }`, { id, path });
      void n;
      gqlTouched();
    },

    async runs(f: RunFilter) {
      const q = [f.event && `event=${encodeURIComponent(f.event)}`, f.status && `status=${encodeURIComponent(f.status)}`, f.branch && `branch=${encodeURIComponent(f.branch)}`, f.actor && `actor=${encodeURIComponent(f.actor)}`, 'per_page=25'].filter(Boolean).join('&');
      const path = f.workflow ? `${r}/actions/workflows/${f.workflow}/runs?${q}` : `${r}/actions/runs?${q}`;
      const res = await gh.getPage<GhRun>(path, f.page ?? 1, (b) => {
        const body = b as { total_count: number; workflow_runs: GhRun[] };
        return { items: body.workflow_runs, total: body.total_count };
      });
      return { ...res, items: res.items.map(runOf) };
    },
    async run(id): Promise<RunDetail> {
      const [x, jobs] = await Promise.all([
        gh.get<GhRun>(`${r}/actions/runs/${id}`),
        gh.get<{ jobs: { id: number; name: string; status: string; conclusion: string | null; started_at: string | null; completed_at: string | null; html_url: string; steps?: { number: number; name: string; status: string; conclusion: string | null; started_at: string | null; completed_at: string | null }[] }[] }>(`${r}/actions/runs/${id}/jobs?per_page=100`),
      ]);
      const rows: RunJob[] = jobs.jobs.map((j) => ({
        id: j.id, name: j.name, status: runStatus(j), duration: duration(j.started_at, j.completed_at), url: j.html_url,
        steps: (j.steps ?? []).map((s) => ({ number: s.number, name: s.name, status: runStatus(s), duration: duration(s.started_at, s.completed_at) })),
      }));
      return { ...runOf(x), jobs: rows, rawStatus: x.status ?? '', hasFailed: rows.some((j) => j.status === 'failure' || j.status === 'cancelled') };
    },
    workflows: async () => {
      const res = await optional(gh.get<{ workflows: { id: number; name: string; path: string; state: string; html_url?: string }[] }>(`${r}/actions/workflows?per_page=100`), { workflows: [] });
      return res.workflows.map((w): Workflow => ({ id: w.id, name: w.name, path: w.path, state: w.state, active: w.state === 'active', url: w.html_url }));
    },
    async workflowInputs(path, ref) {
      const text = await gh.get<string>(`${r}/contents/${encPath(path)}${refQuery(ref)}`, 'raw').catch((e: unknown) => {
        if (e instanceof GitHubError && e.kind === 'notFound') return '';
        throw e;
      });
      return parseWorkflowInputs(text);
    },
    async dispatch(workflow, ref, inputs) {
      await gh.post(`${r}/actions/workflows/${workflow}/dispatches`, { ref, inputs });
      gh.invalidate(`${r}/actions`);
      gh.settleLater(`${r}/actions`);
    },
    async setWorkflowEnabled(workflow, on) {
      await gh.send('PUT', `${r}/actions/workflows/${workflow}/${on ? 'enable' : 'disable'}`);
      gh.invalidate(`${r}/actions`);
    },
    async cancelRun(id) {
      await gh.post(`${r}/actions/runs/${id}/cancel`);
      gh.invalidate(`${r}/actions`, `${r}/commits`);
      gh.settleLater(`${r}/actions`);
    },
    async rerun(id, onlyFailed) {
      await gh.post(`${r}/actions/runs/${id}/${onlyFailed ? 'rerun-failed-jobs' : 'rerun'}`);
      gh.invalidate(`${r}/actions`, `${r}/commits`, `${r}/pulls`);
      gh.settleLater(`${r}/actions`, `${r}/commits`);
    },
    async deleteRun(id) {
      await gh.send('DELETE', `${r}/actions/runs/${id}`);
      gh.invalidate(`${r}/actions`);
    },
    async rerunJob(id) {
      await gh.post(`${r}/actions/jobs/${id}/rerun`);
      gh.invalidate(`${r}/actions`, `${r}/commits`, `${r}/pulls`);
      gh.settleLater(`${r}/actions`, `${r}/commits`);
    },
    jobLog: (id) => gh.get<string>(`${r}/actions/jobs/${id}/logs`, 'raw'),
    artifacts: async (run) => (await optional(gh.get<{ artifacts: { id: number; name: string; size_in_bytes: number; expired: boolean }[] }>(`${r}/actions/runs/${run}/artifacts?per_page=100`), { artifacts: [] })).artifacts.map((a): RunArtifact => ({ id: a.id, name: a.name, size: a.size_in_bytes, expired: a.expired })),

    async releases(page) {
      const [res, latest] = await Promise.all([gh.getPage<Parameters<typeof releaseOf>[0]>(`${r}/releases?per_page=10`, page), latestTag()]);
      return { ...res, items: res.items.map((x) => releaseOf(x, latest)) };
    },
    async release(tag) {
      const [x, latest] = await Promise.all([gh.get<Parameters<typeof releaseOf>[0]>(`${r}/releases/tags/${encPath(tag)}`), latestTag()]);
      return releaseOf(x, latest);
    },
    async createRelease(d) {
      const x = await gh.post<{ tag_name: string }>(`${r}/releases`, { tag_name: d.tag, target_commitish: d.target || undefined, name: d.name, body: d.body, draft: d.draft, prerelease: d.prerelease });
      gh.invalidate(`${r}/releases`, `${r}/tags`, r);
      return x.tag_name;
    },
    async updateRelease(id, d) {
      const x = await gh.send<{ tag_name: string }>('PATCH', `${r}/releases/${id}`, { ...(d.tag ? { tag_name: d.tag } : {}), ...(d.name !== undefined ? { name: d.name } : {}), ...(d.body !== undefined ? { body: d.body } : {}), ...(d.draft !== undefined ? { draft: d.draft } : {}), ...(d.prerelease !== undefined ? { prerelease: d.prerelease } : {}) });
      gh.invalidate(`${r}/releases`, `${r}/tags`, r);
      return x.tag_name;
    },
    async deleteRelease(id) {
      await gh.send('DELETE', `${r}/releases/${id}`);
      gh.invalidate(`${r}/releases`, r);
    },
    generateNotes: (tag, target) => gh.post<{ name: string; body: string }>(`${r}/releases/generate-notes`, { tag_name: tag, target_commitish: target || undefined }),

    async searchCode(q) {
      // Code search needs the text-match media type to return fragments.
      const res = await gh.send<{ total_count: number; items: { path: string; html_url?: string; text_matches?: { fragment: string; matches: { indices: [number, number] }[] }[] }[] }>('GET', `/search/code?q=${encodeURIComponent(`${q} repo:${full}`)}&per_page=30`);
      return {
        items: res.items.map((h): CodeHit => ({ path: h.path, url: h.html_url, fragment: h.text_matches?.[0]?.fragment ?? '', matches: (h.text_matches?.[0]?.matches ?? []).map((m) => m.indices) })),
        total: res.total_count, page: 1, hasNext: false, hasPrev: false,
      };
    },

    async contributorStats() {
      const res = await stats<{ author: GhUser; total: number; weeks: { w: number; a: number; d: number; c: number }[] }[]>(`${r}/stats/contributors`);
      if (res === 'computing') return res;
      return res.map((x): ContributorStat => ({ user: userOf(x.author), commits: x.total, additions: x.weeks.reduce((s, w) => s + w.a, 0), deletions: x.weeks.reduce((s, w) => s + w.d, 0), weeks: x.weeks })).sort((a, b) => b.commits - a.commits);
    },
    commitActivity: () => stats<{ week: number; total: number; days: number[] }[]>(`${r}/stats/commit_activity`),
    async codeFrequency() {
      const res = await stats<[number, number, number][]>(`${r}/stats/code_frequency`);
      return res === 'computing' ? res : res.map(([week, additions, deletions]) => ({ week, additions, deletions: Math.abs(deletions) }));
    },
    async traffic(): Promise<Traffic | null> {
      const denied = (e: unknown) => {
        if (e instanceof GitHubError && (e.kind === 'forbidden' || e.kind === 'notFound')) return null;
        throw e;
      };
      const [views, clones, referrers, paths] = await Promise.all([
        gh.get<{ count: number; uniques: number; views: { timestamp: string; count: number; uniques: number }[] }>(`${r}/traffic/views`).catch(denied),
        gh.get<{ count: number; uniques: number; clones: { timestamp: string; count: number; uniques: number }[] }>(`${r}/traffic/clones`).catch(denied),
        gh.get<Traffic['referrers']>(`${r}/traffic/popular/referrers`).catch(denied),
        gh.get<Traffic['paths']>(`${r}/traffic/popular/paths`).catch(denied),
      ]);
      if (!views || !clones) return null;
      return {
        views: views.views.map((x) => ({ at: x.timestamp, count: x.count, uniques: x.uniques })), clones: clones.clones.map((x) => ({ at: x.timestamp, count: x.count, uniques: x.uniques })),
        viewsTotal: views.count, viewsUnique: views.uniques, clonesTotal: clones.count, clonesUnique: clones.uniques, referrers: referrers ?? [], paths: paths ?? [],
      };
    },
  };
  return source;
}

interface GhCheckRun { id?: number; name: string; status: string; conclusion: string | null; started_at: string | null; completed_at: string | null; html_url?: string | null; details_url?: string | null; output?: { title?: string | null; summary?: string | null }; app?: { name?: string; slug?: string } | null }
interface GhStatus { context: string; state: string; description: string | null; target_url?: string | null }
interface GqlThread {
  id: string; isResolved: boolean; isOutdated: boolean; path: string; line: number | null; originalLine: number | null; startLine: number | null; diffSide: string; resolvedBy: { login: string } | null; viewerCanResolve: boolean; viewerCanUnresolve: boolean; viewerCanReply: boolean;
  comments: { nodes: { databaseId: number; body: string; createdAt: string; authorAssociation?: string; url: string; diffHunk: string; viewerCanUpdate: boolean; viewerCanDelete: boolean; author: { login: string; avatarUrl?: string; avatar_url?: string } | null; pullRequestReview?: { databaseId: number; state: string } | null }[] };
}

const pendingOf = (x?: { id: string; databaseId: number; comments: { totalCount: number } }) => (x ? { id: x.databaseId, nodeId: x.id, count: x.comments.totalCount } : null);

const checksOf = (runs: GhCheckRun[], statuses: GhStatus[]): Check[] => [
  ...runs.map((c): Check => {
    const runId = /\/actions\/runs\/(\d+)/.exec(c.details_url ?? '')?.[1];
    return { name: c.name, status: checkStatus(c.status, c.conclusion), time: c.status === 'completed' ? duration(c.started_at, c.completed_at) : c.status.replace('_', ' '), url: c.html_url ?? c.details_url ?? undefined, summary: c.output?.title ?? undefined, runId: runId && Number(runId) ? Number(runId) : undefined, app: c.app?.name };
  }),
  ...statuses.map((s): Check => ({ name: s.context, status: s.state === 'success' ? 'success' : s.state === 'pending' ? 'pending' : 'failure', time: s.description ?? '', url: s.target_url ?? undefined })),
];


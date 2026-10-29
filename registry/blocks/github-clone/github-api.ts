/* GitHub's REST API behind the GitHub clone: the real repository, mapped into data.ts's shapes so the screens draw it
   exactly like the sample. api.github.com answers browsers itself (CORS, bearer token), so requests go straight there —
   only the device sign-in needed a proxy, and the Passwords keychain already did that. What each screen costs:

   - Code        GET /repos/{r} plus branches, languages, contributors, latest release and counts (branches, tags,
                 commits, releases, contributors: a per_page=1 request whose Link rel="last" is the count);
                 /git/trees/{ref}?recursive=1 for the whole tree at once (huge repositories come back truncated);
                 /readme and /contents/{path} as raw text; /commits?path= for a file's last commit.
   - Issues, PRs /search/issues (is:issue / is:pr, open / closed): rows with labels, comment counts and totals in one
                 request. The tab counts are four per_page=1 searches. Search allows 30 requests a minute.
   - A PR        /pulls/{n} and its /reviews (review state, reviewers), /issues/{n} + /issues/{n}/timeline for the
                 conversation (comments, commits, labels, review requests, reviews, closes and merges), /pulls/{n}/commits,
                 /pulls/{n}/files (patch hunks for Files changed), check runs and statuses for the head commit.
   - Actions     /actions/runs (latest 30) and /actions/workflows.
   - Writes      POST /issues/{n}/comments — the comment composer, on issues and pull requests alike.

   Every GET is cached for the client's life (one per token, kept for the session) and a failure leaves the cache so a
   retry asks again; a posted comment drops its conversation from the cache. Errors are GitHubErrors with a kind —
   'auth' (401: the token was revoked), 'notFound' (404, also what a private repository looks like to a token that
   can't see it), 'rateLimit' (403/429 with the remaining quota at 0, and when it resets) — that the screens explain. */
import type {
  Check, Commit, DiffFile, FileNode, Issue, IssueDetail, Label, LastCommit, PullDetail, PullRequest, Repo, TimelineItem, User, WorkflowRun,
} from './data';
import type { Counts, RepoSource, Runs } from './source';

export type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

export const API = 'https://api.github.com';

export type GitHubErrorKind = 'auth' | 'notFound' | 'rateLimit' | 'other';

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
  /** The clock relative times are written against (tests pin it). */
  now?: () => number;
}

type Accept = 'json' | 'raw' | 'bytes';
const ACCEPT: Record<Accept, string> = { json: 'application/vnd.github+json', raw: 'application/vnd.github.raw+json', bytes: 'application/vnd.github.raw+json' };

export type GitHub = ReturnType<typeof createGitHub>;

export function createGitHub({ token, fetch: f = (u, i) => fetch(u, i), now = Date.now }: GitHubOptions) {
  const cache = new Map<string, Promise<unknown>>();
  let rate: RateLimit | null = null;

  async function request(path: string, init: RequestInit = {}, accept: Accept = 'json'): Promise<Response> {
    const url = path.startsWith('http') ? path : API + path;
    const res = await f(url, {
      ...init,
      headers: { Accept: ACCEPT[accept], Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28', ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
    });
    const remaining = res.headers.get('x-ratelimit-remaining');
    const reset = Number(res.headers.get('x-ratelimit-reset')) * 1000;
    if (remaining != null) rate = { limit: Number(res.headers.get('x-ratelimit-limit') ?? 0), remaining: Number(remaining), resetAt: reset };
    if (res.ok) return res;
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    const message = body.message || res.statusText || `HTTP ${res.status}`;
    if (res.status === 401) throw new GitHubError(401, 'GitHub turned this token down (revoked or expired). Sign in again.', 'auth');
    if (res.status === 404) throw new GitHubError(404, 'Not found — or private, and this sign-in can’t see it.', 'notFound');
    if ((res.status === 403 || res.status === 429) && (remaining === '0' || /rate limit/i.test(message))) {
      const resetAt = reset || (Number(res.headers.get('retry-after')) * 1000 + now()) || undefined;
      throw new GitHubError(res.status, `GitHub’s rate limit is used up${resetAt ? `; it resets at ${new Date(resetAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : ''}.`, 'rateLimit', resetAt);
    }
    throw new GitHubError(res.status, message, 'other');
  }

  /** A cached GET: JSON, raw text, or raw bytes. */
  function get<T>(path: string, accept: Accept = 'json'): Promise<T> {
    const key = accept + ' ' + path;
    let hit = cache.get(key) as Promise<T> | undefined;
    if (!hit) {
      hit = request(path, {}, accept).then((r) => (accept === 'json' ? r.json() : accept === 'raw' ? r.text() : r.arrayBuffer()) as Promise<T>);
      hit.catch(() => cache.delete(key));
      cache.set(key, hit);
    }
    return hit;
  }

  /** A cached list across pages (Link rel="next"), up to `max` pages. */
  function getAll<T>(path: string, max = 3): Promise<T[]> {
    const key = 'all ' + path;
    let hit = cache.get(key) as Promise<T[]> | undefined;
    if (!hit) {
      hit = (async () => {
        const out: T[] = [];
        let next: string | null = path;
        for (let page = 0; next && page < max; page++) {
          const res = await request(next);
          out.push(...((await res.json()) as T[]));
          next = linkRel(res.headers.get('link'), 'next');
        }
        return out;
      })();
      hit.catch(() => cache.delete(key));
      cache.set(key, hit);
    }
    return hit;
  }

  /** How many items a list holds, from one per_page=1 request: its last page number, else the length. */
  function count(path: string): Promise<number> {
    const key = 'count ' + path;
    let hit = cache.get(key) as Promise<number> | undefined;
    if (!hit) {
      hit = request(path + (path.includes('?') ? '&' : '?') + 'per_page=1').then(async (res) => {
        const last = linkRel(res.headers.get('link'), 'last');
        const page = last ? Number(new URL(last).searchParams.get('page')) : NaN;
        return Number.isFinite(page) ? page : ((await res.json()) as unknown[]).length;
      });
      hit.catch(() => cache.delete(key));
      cache.set(key, hit);
    }
    return hit;
  }

  async function post<T>(path: string, body: unknown): Promise<T> {
    return (await request(path, { method: 'POST', body: JSON.stringify(body) })).json() as Promise<T>;
  }

  /** Drops cached GETs whose path starts with `prefix` (after a write). */
  function invalidate(prefix: string) {
    for (const key of [...cache.keys()]) if (key.slice(key.indexOf(' ') + 1).startsWith(prefix)) cache.delete(key);
  }

  return { get, getAll, count, post, invalidate, now, rateLimit: () => rate };
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
interface GhUser { login: string; avatar_url?: string; name?: string | null }
interface GhLabel { name: string; color: string; description?: string | null }
interface GhIssue {
  number: number; title: string; state: 'open' | 'closed'; user: GhUser | null; created_at: string; closed_at: string | null;
  labels: (GhLabel | string)[]; comments: number; assignees?: GhUser[] | null; milestone?: { title: string; open_issues: number; closed_issues: number } | null;
  html_url: string; body?: string | null; draft?: boolean; pull_request?: { merged_at?: string | null }; author_association?: string;
}
interface GhPull {
  number: number; title: string; state: 'open' | 'closed'; draft?: boolean; merged_at: string | null; user: GhUser | null; created_at: string;
  labels: GhLabel[]; comments: number; review_comments?: number; head: { ref: string; sha: string }; base: { ref: string }; commits: number;
  additions: number; deletions: number; html_url: string; body: string | null; requested_reviewers?: GhUser[]; requested_teams?: { name: string }[];
  assignees?: GhUser[]; milestone?: { title: string; open_issues: number; closed_issues: number } | null; mergeable_state?: string;
  changed_files?: number;
}
interface GhCommit { sha: string; commit: { message: string; author: { name: string; date: string } | null }; author: GhUser | null; html_url?: string }

/** A User from a GitHub account: initials from the login's first two words (they show until the picture loads). */
export function userOf(u: GhUser | null | undefined): User {
  const login = u?.login ?? 'ghost';
  const words = login.replace(/\[bot\]$/, '').split(/[-_.\s]+/).filter(Boolean);
  const cap = (w = '') => w.charAt(0).toUpperCase() + w.slice(1);
  return { login, f: cap(words[0] ?? login), l: cap(words[1] ?? ''), avatar: u?.avatar_url };
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
const milestoneOf = (m: GhPull['milestone']) => (m ? { title: m.title, pct: Math.round((m.closed_issues / Math.max(1, m.open_issues + m.closed_issues)) * 100) } : undefined);

/** GitHub's language colors for the common ones; the rest are gray. */
const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: '#3178c6', JavaScript: '#f1e05a', Python: '#3572A5', Go: '#00ADD8', Rust: '#dea584', Java: '#b07219', Kotlin: '#A97BFF',
  Swift: '#F05138', 'C++': '#f34b7d', C: '#555555', 'C#': '#178600', Ruby: '#701516', PHP: '#4F5D95', HTML: '#e34c26', CSS: '#563d7c',
  SCSS: '#c6538c', Shell: '#89e051', MDX: '#fcb32c', Vue: '#41b883', Svelte: '#ff3e00', Dart: '#00B4AB', Elixir: '#6e4a7e', Lua: '#000080',
  Dockerfile: '#384d54', PLpgSQL: '#336790', Nix: '#7e7eff', Zig: '#ec915c', Astro: '#ff5a03', WebAssembly: '#04133b',
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
export function treeOf(entries: { path: string; type: string; size?: number }[]): FileNode[] {
  const root: FileNode[] = [];
  const dirs = new Map<string, FileNode[]>([['', root]]);
  // Parents come before children in GitHub's listing, but don't rely on it.
  for (const e of [...entries].sort((a, b) => a.path.split('/').length - b.path.split('/').length)) {
    const at = e.path.lastIndexOf('/');
    const parent = dirs.get(at < 0 ? '' : e.path.slice(0, at));
    if (!parent) continue;
    const node: FileNode = { name: e.path.slice(at + 1), path: e.path, type: e.type === 'tree' ? 'dir' : 'file', commit: '', when: '', size: e.size };
    if (node.type === 'dir') dirs.set(e.path, (node.children = []));
    parent.push(node);
  }
  return root;
}

export const issueOf = (i: GhIssue, now: number): Issue => ({
  number: i.number, title: i.title, state: i.state, author: userOf(i.user), when: ago(i.state === 'closed' ? i.closed_at : i.created_at, now),
  labels: i.labels.map(labelOf), comments: i.comments, assignees: (i.assignees ?? []).map(userOf), milestone: i.milestone?.title, url: i.html_url,
});

/** A search hit for a pull request: what a list row shows (review and checks are unknown here). */
export const pullRowOf = (i: GhIssue, now: number): PullRequest => {
  const state = i.pull_request?.merged_at ? 'merged' : i.state === 'closed' ? 'closed' : i.draft ? 'draft' : 'open';
  return {
    number: i.number, title: i.title, state, author: userOf(i.user), when: ago(state === 'merged' ? i.pull_request?.merged_at : state === 'closed' ? i.closed_at : i.created_at, now),
    labels: i.labels.map(labelOf), comments: i.comments, review: i.draft ? 'draft' : undefined, head: '', base: '', commits: 0, additions: 0, deletions: 0, url: i.html_url,
  };
};

/** A timeline event: which fields are there depends on `event`. */
export interface GhEvent {
  event: string; id?: number; node_id?: string; sha?: string; actor?: GhUser | null; user?: GhUser | null; created_at?: string; submitted_at?: string;
  body?: string | null; html_url?: string; author_association?: string; message?: string; state?: string; label?: GhLabel;
  author?: { name: string; date: string }; committer?: { date: string }; requested_reviewer?: GhUser; requested_team?: { name: string };
  rename?: { from: string; to: string }; assignee?: GhUser;
}

/** One timeline event as the conversation shows it; consecutive commits and labels fold into the previous item. */
export function timelineOf(events: GhEvent[], now: number): TimelineItem[] {
  const out: TimelineItem[] = [];
  for (const e of events) {
    const last = out.at(-1);
    const id = String(e.id ?? e.node_id ?? e.sha ?? out.length);
    const actor = userOf(e.actor ?? e.user);
    switch (e.event) {
      case 'commented':
        out.push({ kind: 'comment', id: 'c' + id, author: actor, when: ago(e.created_at, now), body: e.body ?? '', role: ROLE[e.author_association ?? ''], url: e.html_url });
        break;
      case 'committed': {
        const author = nameUser(e.author?.name ?? 'unknown');
        const commit: Commit = { sha: String(e.sha).slice(0, 7), message: firstLine(e.message ?? ''), author, when: ago(e.committer?.date ?? e.author?.date, now) };
        if (last?.kind === 'commits' && last.author.login === author.login) { last.commits.push(commit); last.when = commit.when; }
        else out.push({ kind: 'commits', id: 'k' + id, author, when: commit.when, commits: [commit] });
        break;
      }
      case 'labeled':
        if (!e.label) break;
        if (last?.kind === 'labeled' && last.author.login === actor.login) last.labels.push(labelOf(e.label));
        else out.push({ kind: 'labeled', id: 'l' + id, author: actor, when: ago(e.created_at, now), labels: [labelOf(e.label)] });
        break;
      case 'review_requested':
        out.push({ kind: 'requested', id: 'r' + id, author: actor, when: ago(e.created_at, now), reviewer: e.requested_reviewer ? userOf(e.requested_reviewer) : nameUser(e.requested_team?.name ?? 'a team') });
        break;
      case 'reviewed': {
        if (e.state === 'pending') break;
        const state = e.state === 'approved' ? 'approved' : e.state === 'changes_requested' ? 'changes' : 'commented';
        // A review with neither a verdict nor words is the wrapper of inline comments: still worth a line.
        out.push({ kind: 'review', id: 'v' + id, author: userOf(e.user), when: ago(e.submitted_at, now), state, body: e.body || undefined });
        break;
      }
      case 'closed': case 'reopened': case 'merged': case 'head_ref_deleted': case 'ready_for_review': case 'convert_to_draft':
        out.push({ kind: 'event', id: 'e' + id, author: actor, when: ago(e.created_at, now), event: e.event });
        break;
      case 'renamed':
        out.push({ kind: 'event', id: 'e' + id, author: actor, when: ago(e.created_at, now), event: 'renamed', text: e.rename?.to });
        break;
      case 'assigned':
        out.push({ kind: 'event', id: 'e' + id, author: actor, when: ago(e.created_at, now), event: 'assigned', text: e.assignee?.login });
        break;
    }
  }
  return out;
}

const runStatus = (r: { status: string; conclusion: string | null }): WorkflowRun['status'] => {
  if (r.status !== 'completed') return 'running';
  if (r.conclusion === 'success') return 'success';
  if (r.conclusion === 'failure' || r.conclusion === 'timed_out' || r.conclusion === 'startup_failure') return 'failure';
  return 'cancelled';
};

const checkStatus = (status: string, conclusion: string | null): Check['status'] => {
  if (status !== 'completed') return 'pending';
  if (conclusion === 'success') return 'success';
  if (conclusion === 'failure' || conclusion === 'timed_out' || conclusion === 'cancelled' || conclusion === 'action_required' || conclusion === 'startup_failure') return 'failure';
  return 'neutral';
};

const path = (p: string) => p.split('/').map(encodeURIComponent).join('/');
const refQuery = (ref: string, sep = '?') => (ref ? `${sep}ref=${encodeURIComponent(ref)}` : '');

/** Who the token belongs to. */
export async function viewerOf(gh: GitHub): Promise<User> {
  const me = await gh.get<GhUser>('/user');
  return { ...userOf(me), ...(me.name ? { f: me.name.split(/\s+/)[0], l: me.name.split(/\s+/).at(-1) ?? '' } : {}) };
}

/** The signed-in account's repositories, most recently pushed first (the picker). */
export async function recentRepos(gh: GitHub): Promise<{ full: string; description: string; private: boolean }[]> {
  const list = await gh.get<{ full_name: string; description: string | null; private: boolean }[]>('/user/repos?sort=pushed&per_page=30');
  return list.map((r) => ({ full: r.full_name, description: r.description ?? '', private: r.private }));
}

/** Reads `owner/name` (or a github.com URL) into owner/name; null when it isn't one. */
export function parseRepo(input: string): string | null {
  const m = /^(?:https?:\/\/)?(?:www\.)?(?:github\.com\/)?([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:[/?#].*)?$/.exec(input.trim());
  return m ? `${m[1]}/${m[2]}` : null;
}

/** A RepoSource over GitHub's REST API for one repository. */
export function githubRepo(gh: GitHub, full: string): RepoSource {
  const r = '/repos/' + full;
  const now = gh.now;
  const search = (q: string, per = 50) => gh.get<{ total_count: number; items: GhIssue[] }>(`/search/issues?q=${encodeURIComponent(`repo:${full} ${q}`)}&sort=created&order=desc&per_page=${per}`);
  const optional = <T>(p: Promise<T>, fallback: T) => p.catch((e: unknown) => {
    // A missing optional part (no releases, Actions off) is not an error; a dead token or rate limit is.
    if (e instanceof GitHubError && e.kind !== 'notFound' && e.kind !== 'other') throw e;
    return fallback;
  });
  const issue = (n: number) => gh.get<GhIssue>(`${r}/issues/${n}`);
  const pull = (n: number) => gh.get<GhPull>(`${r}/pulls/${n}`);
  const lastCommit = async (p: string, ref: string): Promise<LastCommit | null> => {
    const q = [ref && `sha=${encodeURIComponent(ref)}`, p && `path=${encodeURIComponent(p)}`, 'per_page=1'].filter(Boolean).join('&');
    const [c] = await gh.get<GhCommit[]>(`${r}/commits?${q}`);
    return c ? { sha: c.sha.slice(0, 7), message: firstLine(c.commit.message), author: c.author ? userOf(c.author) : nameUser(c.commit.author?.name ?? 'unknown'), when: ago(c.commit.author?.date, now()) } : null;
  };

  return {
    id: 'live:' + full,
    live: true,
    full,
    viewer: () => viewerOf(gh),

    async repo() {
      const g = await gh.get<{
        name: string; owner: { login: string }; description: string | null; homepage: string | null; topics?: string[]; stargazers_count: number;
        forks_count: number; subscribers_count?: number; license: { name: string } | null; default_branch: string; private: boolean; html_url: string;
      }>(r);
      const branch = g.default_branch;
      const [branches, branchCount, tagCount, commitCount, languages, contributors, contributorCount, release, releaseCount, last] = await Promise.all([
        optional(gh.get<{ name: string }[]>(`${r}/branches?per_page=100`), []),
        optional(gh.count(`${r}/branches`), 0),
        optional(gh.count(`${r}/tags`), 0),
        optional(gh.count(`${r}/commits?sha=${encodeURIComponent(branch)}`), 0),
        optional(gh.get<Record<string, number>>(`${r}/languages`), {}),
        optional(gh.get<GhUser[]>(`${r}/contributors?per_page=14`), []),
        optional(gh.count(`${r}/contributors?anon=1`), 0),
        optional(gh.get<{ tag_name: string; published_at: string } | null>(`${r}/releases/latest`), null),
        optional(gh.count(`${r}/releases`), 0),
        optional(lastCommit('', ''), null),
      ]);
      return {
        owner: g.owner.login, name: g.name, description: g.description ?? '', homepage: (g.homepage ?? '').replace(/^https?:\/\//, ''), topics: g.topics ?? [],
        stars: compactCount(g.stargazers_count), forks: compactCount(g.forks_count), watchers: compactCount(g.subscribers_count ?? 0),
        license: g.license?.name ?? '', branch,
        branches: [branch, ...branches.map((b) => b.name).filter((b) => b !== branch)],
        branchCount: branchCount || branches.length, tagCount, commitCount: commitCount.toLocaleString('en-US'),
        release: release ? { tag: release.tag_name, when: ago(release.published_at, now()), count: releaseCount } : null,
        languages: languagesOf(languages), contributors: contributors.map(userOf), contributorCount: contributorCount || contributors.length,
        lastCommit: last, private: g.private, url: g.html_url,
      };
    },

    async counts(): Promise<Counts> {
      const total = (q: string) => search(q, 1).then((s) => s.total_count);
      const [io, ic, po, pc] = await Promise.all([total('is:issue is:open'), total('is:issue is:closed'), total('is:pr is:open'), total('is:pr is:closed')]);
      return { issues: { open: io, closed: ic }, pulls: { open: po, closed: pc } };
    },

    labels: async () => (await gh.get<GhLabel[]>(`${r}/labels?per_page=100`)).map(labelOf),

    async tree(ref) {
      const t = await gh.get<{ tree: { path: string; type: string; size?: number }[]; truncated: boolean }>(`${r}/git/trees/${encodeURIComponent(ref || 'HEAD')}?recursive=1`);
      return treeOf(t.tree);
    },

    readme: (ref) => gh.get<string>(`${r}/readme${refQuery(ref)}`, 'raw').catch((e: unknown) => {
      if (e instanceof GitHubError && e.kind === 'notFound') return null;
      throw e;
    }),

    async file(p, ref) {
      const bytes = new Uint8Array(await gh.get<ArrayBuffer>(`${r}/contents/${path(p)}${refQuery(ref)}`, 'bytes'));
      // Git's own test: a NUL in the first 8000 bytes means binary.
      if (bytes.subarray(0, 8000).includes(0)) return null;
      return new TextDecoder().decode(bytes);
    },

    lastCommit,

    issues: async (state) => (await search(`is:issue is:${state}`)).items.map((i) => issueOf(i, now())),

    async issue(n): Promise<IssueDetail> {
      const i = await issue(n);
      return { ...issueOf(i, now()), body: i.body ?? '' };
    },

    pulls: async (state) => (await search(`is:pr is:${state}`)).items.map((i) => pullRowOf(i, now())),

    async pull(n): Promise<PullDetail> {
      const [p, reviews] = await Promise.all([pull(n), optional(gh.get<{ user: GhUser | null; state: string }[]>(`${r}/pulls/${n}/reviews?per_page=100`), [])]);
      // Each reviewer's latest verdict; a plain comment doesn't replace an approval.
      const latest = new Map<string, { user: User; state: PullDetail['reviewers'][number]['state'] }>();
      for (const v of reviews) {
        const state = v.state === 'APPROVED' ? 'approved' : v.state === 'CHANGES_REQUESTED' ? 'changes' : v.state === 'COMMENTED' ? 'commented' : null;
        if (!state || !v.user) continue;
        const prev = latest.get(v.user.login);
        if (state === 'commented' && prev && prev.state !== 'commented') continue;
        latest.set(v.user.login, { user: userOf(v.user), state });
      }
      for (const u of p.requested_reviewers ?? []) latest.set(u.login, { user: userOf(u), state: 'pending' });
      for (const t of p.requested_teams ?? []) latest.set(t.name, { user: nameUser(t.name), state: 'pending' });
      const reviewers = [...latest.values()];
      const merged = !!p.merged_at;
      const state = merged ? 'merged' : p.state === 'closed' ? 'closed' : p.draft ? 'draft' : 'open';
      return {
        number: p.number, title: p.title, state, author: userOf(p.user), when: ago(p.created_at, now()), labels: p.labels.map(labelOf), comments: p.comments,
        review: p.draft ? 'draft' : reviewers.some((x) => x.state === 'changes') ? 'changes' : reviewers.some((x) => x.state === 'approved') ? 'approved' : 'pending',
        head: p.head.ref, base: p.base.ref, commits: p.commits, additions: p.additions, deletions: p.deletions, url: p.html_url,
        body: p.body ?? '', reviewers, assignees: (p.assignees ?? []).map(userOf), milestone: milestoneOf(p.milestone), closes: [],
        mergeable: p.mergeable_state ?? 'unknown', headSha: p.head.sha, changedFiles: p.changed_files ?? 0,
      };
    },

    async timeline(n) {
      const [i, events] = await Promise.all([issue(n), gh.getAll<GhEvent>(`${r}/issues/${n}/timeline?per_page=100`)]);
      const body: TimelineItem = {
        kind: 'comment', id: 'body', author: userOf(i.user), when: ago(i.created_at, now()), body: i.body || '*No description provided.*',
        role: ROLE[i.author_association ?? ''], url: i.html_url,
      };
      return [body, ...timelineOf(events, now())];
    },

    pullCommits: async (n) => (await gh.getAll<GhCommit>(`${r}/pulls/${n}/commits?per_page=100`, 3)).map((c) => ({
      sha: c.sha.slice(0, 7), message: firstLine(c.commit.message), author: c.author ? userOf(c.author) : nameUser(c.commit.author?.name ?? 'unknown'), when: ago(c.commit.author?.date, now()),
    })),

    async pullChecks(n) {
      const sha = (await pull(n)).head.sha;
      const [runs, statuses] = await Promise.all([
        optional(gh.get<{ check_runs: { name: string; status: string; conclusion: string | null; started_at: string | null; completed_at: string | null }[] }>(`${r}/commits/${sha}/check-runs?per_page=100`), { check_runs: [] }),
        optional(gh.get<{ statuses: { context: string; state: string; description: string | null }[] }>(`${r}/commits/${sha}/status`), { statuses: [] }),
      ]);
      return [
        ...runs.check_runs.map((c): Check => ({ name: c.name, status: checkStatus(c.status, c.conclusion), time: c.status === 'completed' ? duration(c.started_at, c.completed_at) : c.status.replace('_', ' ') })),
        ...statuses.statuses.map((s): Check => ({ name: s.context, status: s.state === 'success' ? 'success' : s.state === 'pending' ? 'pending' : 'failure', time: s.description ?? '' })),
      ];
    },

    pullFiles: async (n) => (await gh.getAll<{ filename: string; additions: number; deletions: number; patch?: string; status: string; previous_filename?: string }>(`${r}/pulls/${n}/files?per_page=100`, 3)).map((f): DiffFile => ({
      path: f.filename, additions: f.additions, deletions: f.deletions, patch: f.patch ?? '',
      note: f.patch ? undefined : f.status === 'renamed' && !f.additions && !f.deletions ? `Renamed from ${f.previous_filename} without changes.` : 'Binary file or a large diff: not shown.',
    })),

    async runs(): Promise<Runs> {
      const [list, workflows] = await Promise.all([
        optional(gh.get<{ total_count: number; workflow_runs: {
          id: number; name: string; display_title: string; run_number: number; event: string; actor: GhUser | null; head_branch: string | null;
          status: string; conclusion: string | null; created_at: string; run_started_at?: string; updated_at: string; html_url: string; pull_requests?: { number: number }[];
        }[] }>(`${r}/actions/runs?per_page=30`), { total_count: 0, workflow_runs: [] }),
        optional(gh.get<{ workflows: { name: string; state: string }[] }>(`${r}/actions/workflows?per_page=100`), { workflows: [] }),
      ]);
      return {
        total: list.total_count,
        workflows: workflows.workflows.filter((w) => w.state === 'active').map((w) => w.name),
        runs: list.workflow_runs.map((x) => ({
          id: x.id, title: x.display_title, workflow: x.name, number: x.run_number, event: x.pull_requests?.[0] ? `${x.event} #${x.pull_requests[0].number}` : x.event,
          actor: userOf(x.actor), branch: x.head_branch ?? '', status: runStatus(x), when: ago(x.created_at, now()),
          duration: duration(x.run_started_at ?? x.created_at, x.status === 'completed' ? x.updated_at : new Date(now()).toISOString()), url: x.html_url,
        })),
      };
    },

    async comment(n, body) {
      const c = await gh.post<{ id: number; body: string; user: GhUser; created_at: string; html_url: string; author_association: string }>(`${r}/issues/${n}/comments`, { body });
      // The conversation and the comment counts changed: ask again next time.
      gh.invalidate(`${r}/issues/${n}`);
      gh.invalidate('/search/issues');
      return { kind: 'comment', id: 'c' + c.id, author: userOf(c.user), when: ago(c.created_at, now()), body: c.body, role: ROLE[c.author_association], url: c.html_url };
    },
  };
}

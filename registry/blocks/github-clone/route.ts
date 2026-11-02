/* Where you are in a repository, as data. Every screen is a Route; `toPath` and `fromPath` translate them to and from
   GitHub's own URL paths, so a github.com link pasted anywhere opens the right screen here, "Open on GitHub" always goes
   to the same place, and the optional hash sync gives reload, deep links and browser back. */

export type PullTab = 'conversation' | 'commits' | 'checks' | 'files';
export type InsightsPage = 'pulse' | 'contributors' | 'commits' | 'code' | 'traffic' | 'forks';
export type SettingsPage = 'general' | 'merging' | 'branches' | 'collaborators';
export type PeoplePage = 'stargazers' | 'watchers' | 'contributors';

export type Route =
  | { s: 'code'; ref?: string; path?: string; line?: number; lineEnd?: number; blame?: boolean }
  | { s: 'commits'; ref?: string; path?: string; author?: string; page?: number }
  | { s: 'commit'; sha: string }
  | { s: 'edit'; ref?: string; path: string; mode: 'edit' | 'delete' }
  | { s: 'new-file'; ref?: string; dir?: string; name?: string; content?: string; message?: string }
  | { s: 'branches'; page?: number }
  | { s: 'tags'; page?: number }
  | { s: 'releases'; page?: number }
  | { s: 'release'; tag: string }
  | { s: 'new-release'; tag?: string; editing?: string }
  | { s: 'compare'; base?: string; head?: string; create?: boolean }
  | { s: 'issues'; q?: string; page?: number }
  | { s: 'issue'; n: number; comment?: number }
  | { s: 'new-issue'; title?: string; body?: string }
  | { s: 'labels' }
  | { s: 'milestones'; state?: 'open' | 'closed' }
  | { s: 'milestone'; n: number; q?: string; page?: number }
  | { s: 'pulls'; q?: string; page?: number }
  | { s: 'pull'; n: number; tab?: PullTab; commit?: string }
  | { s: 'actions'; workflow?: number; event?: string; status?: string; branch?: string; actor?: string; page?: number }
  | { s: 'run'; id: number }
  | { s: 'insights'; page?: InsightsPage }
  | { s: 'settings'; page?: SettingsPage }
  | { s: 'people'; kind: PeoplePage };

export type RepoTab = 'code' | 'issues' | 'pulls' | 'actions' | 'insights' | 'settings';

export const tabOf = (r: Route): RepoTab => {
  switch (r.s) {
    case 'issues': case 'issue': case 'new-issue': case 'labels': case 'milestones': case 'milestone': return 'issues';
    case 'pulls': case 'pull': case 'compare': return 'pulls';
    case 'actions': case 'run': return 'actions';
    case 'insights': return 'insights';
    case 'settings': return 'settings';
    default: return 'code';
  }
};

export const DEFAULT_ISSUE_Q = 'is:open';
export const DEFAULT_PULL_Q = 'is:open';

const enc = (s: string) => encodeURIComponent(s);
const encPath = (p: string) => p.split('/').map(enc).join('/');
/** A ref in a URL: its slashes stay encoded so our own paths read back unambiguously. */
const encRef = (ref: string) => enc(ref);

const withQuery = (path: string, q: Record<string, string | number | boolean | undefined>) => {
  const s = Object.entries(q).filter(([, v]) => v !== undefined && v !== '' && v !== false).map(([k, v]) => `${k}=${enc(String(v))}`).join('&');
  return s ? `${path}?${s}` : path;
};

/** The path after owner/name on github.com ('' for the repository's front page). */
export function toPath(r: Route, defaultBranch = 'main'): string {
  const ref = (x?: string) => encRef(x || defaultBranch);
  switch (r.s) {
    case 'code': {
      if (!r.path && !r.ref) return '';
      if (!r.path) return `tree/${ref(r.ref)}`;
      if (r.blame) return `blame/${ref(r.ref)}/${encPath(r.path)}`;
      return `${r.line ? 'blob' : 'tree'}/${ref(r.ref)}/${encPath(r.path)}${r.line ? `#L${r.line}${r.lineEnd ? `-L${r.lineEnd}` : ''}` : ''}`;
    }
    case 'commits': return withQuery(`commits/${ref(r.ref)}${r.path ? '/' + encPath(r.path) : ''}`, { author: r.author, page: r.page });
    case 'commit': return `commit/${r.sha}`;
    case 'edit': return `${r.mode === 'edit' ? 'edit' : 'delete'}/${ref(r.ref)}/${encPath(r.path)}`;
    case 'new-file': return `new/${ref(r.ref)}${r.dir ? '/' + encPath(r.dir) : ''}`;
    case 'branches': return withQuery('branches', { page: r.page });
    case 'tags': return withQuery('tags', { page: r.page });
    case 'releases': return withQuery('releases', { page: r.page });
    case 'release': return `releases/tag/${encPath(r.tag)}`;
    case 'new-release': return r.editing ? `releases/edit/${encPath(r.editing)}` : withQuery('releases/new', { tag: r.tag });
    case 'compare': return r.base || r.head ? withQuery(`compare/${[r.base, r.head].filter(Boolean).map((x) => enc(x!)).join('...')}`, { expand: r.create ? 1 : undefined }) : 'compare';
    case 'issues': return withQuery('issues', { q: r.q && r.q !== DEFAULT_ISSUE_Q ? r.q : undefined, page: r.page });
    case 'issue': return `issues/${r.n}${r.comment ? `#issuecomment-${r.comment}` : ''}`;
    case 'new-issue': return withQuery('issues/new', { title: r.title, body: r.body });
    case 'labels': return 'labels';
    case 'milestones': return withQuery('milestones', { state: r.state === 'closed' ? 'closed' : undefined });
    case 'milestone': return withQuery(`milestone/${r.n}`, { q: r.q, page: r.page });
    case 'pulls': return withQuery('pulls', { q: r.q && r.q !== DEFAULT_PULL_Q ? r.q : undefined, page: r.page });
    case 'pull': return `pull/${r.n}${r.commit ? `/commits/${r.commit}` : r.tab && r.tab !== 'conversation' ? `/${r.tab === 'files' ? 'files' : r.tab}` : ''}`;
    case 'actions': return withQuery(r.workflow ? `actions/workflows/${r.workflow}` : 'actions', { event: r.event, status: r.status, branch: r.branch, actor: r.actor, page: r.page });
    case 'run': return `actions/runs/${r.id}`;
    case 'insights': return r.page === 'traffic' ? 'graphs/traffic' : r.page === 'contributors' ? 'graphs/contributors' : r.page === 'commits' ? 'graphs/commit-activity' : r.page === 'code' ? 'graphs/code-frequency' : r.page === 'forks' ? 'network/members' : 'pulse';
    case 'settings': return r.page && r.page !== 'general' ? `settings/${r.page}` : 'settings';
    case 'people': return r.kind === 'contributors' ? 'graphs/contributors' : r.kind;
  }
}

/** A path after owner/name back into a Route; null when it's nothing the block shows. `refs` resolves branch names with slashes in GitHub's own URLs. */
export function fromPath(rawPath: string, refs: string[] = []): Route | null {
  const [beforeHash, hash = ''] = rawPath.split('#');
  const [pathOnly, query = ''] = beforeHash.split('?');
  const q = new URLSearchParams(query);
  const num = (k: string) => (q.get(k) ? Number(q.get(k)) : undefined);
  const parts = pathOnly.split('/').filter(Boolean);
  const dec = (s: string) => { try { return decodeURIComponent(s); } catch { return s; } };
  const [head, ...rest] = parts;
  /** Splits "feat/x/src/a.ts" into a ref and a path: the longest known ref, else the first segment. */
  const refAndPath = (segs: string[]) => {
    const decoded = segs.map(dec);
    const joined = decoded.join('/');
    const known = [...refs].sort((a, b) => b.length - a.length).find((x) => joined === x || joined.startsWith(x + '/'));
    if (known) return { ref: known, path: joined.slice(known.length + 1) };
    return { ref: decoded[0], path: decoded.slice(1).join('/') };
  };
  const lineOf = /^L(\d+)(?:-L(\d+))?/.exec(hash);
  switch (head) {
    case undefined: return { s: 'code' };
    case 'tree': case 'blob': case 'raw': {
      const { ref, path } = refAndPath(rest);
      return { s: 'code', ref, path, line: lineOf ? Number(lineOf[1]) : undefined, lineEnd: lineOf?.[2] ? Number(lineOf[2]) : undefined };
    }
    case 'blame': {
      const { ref, path } = refAndPath(rest);
      return { s: 'code', ref, path, blame: true };
    }
    case 'commits': {
      const { ref, path } = refAndPath(rest);
      return { s: 'commits', ref: ref || undefined, path: path || undefined, author: q.get('author') ?? undefined, page: num('page') };
    }
    case 'commit': return rest[0] ? { s: 'commit', sha: rest[0] } : null;
    case 'edit': case 'delete': {
      const { ref, path } = refAndPath(rest);
      return path ? { s: 'edit', ref, path, mode: head } : null;
    }
    case 'new': {
      const { ref, path } = refAndPath(rest);
      return { s: 'new-file', ref, dir: path || undefined };
    }
    case 'branches': return { s: 'branches', page: num('page') };
    case 'tags': return { s: 'tags', page: num('page') };
    case 'releases':
      if (rest[0] === 'tag') return { s: 'release', tag: rest.slice(1).map(dec).join('/') };
      if (rest[0] === 'new') return { s: 'new-release', tag: q.get('tag') ?? undefined };
      if (rest[0] === 'edit') return { s: 'new-release', editing: rest.slice(1).map(dec).join('/') };
      return { s: 'releases', page: num('page') };
    case 'compare': {
      if (!rest.length) return { s: 'compare' };
      const [base, h] = dec(rest.join('/')).split('...');
      return h ? { s: 'compare', base, head: h, create: !!q.get('expand') } : { s: 'compare', head: base, create: !!q.get('expand') };
    }
    case 'issues':
      if (rest[0] === 'new') return { s: 'new-issue', title: q.get('title') ?? undefined, body: q.get('body') ?? undefined };
      if (rest[0] && /^\d+$/.test(rest[0])) { const c = /^issuecomment-(\d+)/.exec(hash); return { s: 'issue', n: Number(rest[0]), comment: c ? Number(c[1]) : undefined }; }
      return { s: 'issues', q: q.get('q') ?? undefined, page: num('page') };
    case 'labels': return { s: 'labels' };
    case 'milestones': return { s: 'milestones', state: q.get('state') === 'closed' ? 'closed' : 'open' };
    case 'milestone': return rest[0] && /^\d+$/.test(rest[0]) ? { s: 'milestone', n: Number(rest[0]), q: q.get('q') ?? undefined, page: num('page') } : null;
    case 'pulls': return { s: 'pulls', q: q.get('q') ?? undefined, page: num('page') };
    case 'pull': {
      if (!rest[0] || !/^\d+$/.test(rest[0])) return null;
      const n = Number(rest[0]);
      if (rest[1] === 'commits' && rest[2]) return { s: 'pull', n, tab: 'files', commit: rest[2] };
      if (rest[1] === 'files') return { s: 'pull', n, tab: 'files' };
      if (rest[1] === 'commits') return { s: 'pull', n, tab: 'commits' };
      if (rest[1] === 'checks') return { s: 'pull', n, tab: 'checks' };
      return { s: 'pull', n };
    }
    case 'actions':
      if (rest[0] === 'runs' && rest[1]) return { s: 'run', id: Number(rest[1]) };
      return { s: 'actions', workflow: rest[0] === 'workflows' && /^\d+$/.test(rest[1] ?? '') ? Number(rest[1]) : undefined, event: q.get('event') ?? undefined, status: q.get('status') ?? undefined, branch: q.get('branch') ?? undefined, actor: q.get('actor') ?? undefined, page: num('page') };
    case 'pulse': return { s: 'insights', page: 'pulse' };
    case 'graphs':
      if (rest[0] === 'traffic') return { s: 'insights', page: 'traffic' };
      if (rest[0] === 'commit-activity') return { s: 'insights', page: 'commits' };
      if (rest[0] === 'code-frequency') return { s: 'insights', page: 'code' };
      return { s: 'insights', page: 'contributors' };
    case 'network': return { s: 'insights', page: 'forks' };
    case 'settings': return { s: 'settings', page: rest[0] === 'merging' || rest[0] === 'branches' || rest[0] === 'collaborators' ? rest[0] : 'general' };
    case 'stargazers': return { s: 'people', kind: 'stargazers' };
    case 'watchers': return { s: 'people', kind: 'watchers' };
    default: return null;
  }
}

/** A github.com URL into owner/name and a Route; null when it isn't a repository URL. */
export function parseGitHubUrl(href: string, refs: string[] = []): { full: string; route: Route | null } | null {
  const m = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?(\/[^]*)?(?:[?#].*)?$/.exec(href.trim());
  if (!m) return null;
  const tail = (m[3] ?? '').replace(/^\//, '');
  const query = /[?#].*$/.exec(href.trim())?.[0] ?? '';
  const path = tail.includes('?') || tail.includes('#') ? tail : tail + query;
  return { full: `${m[1]}/${m[2]}`, route: fromPath(path, refs) };
}

/** A bare `owner/name` or a github.com URL to one (and nothing else, unlike a lenient split on slashes). */
export function repoFromInput(input: string): string | null {
  const t = input.trim();
  const url = parseGitHubUrl(t);
  if (url) return url.full;
  if (/^https?:|:\/\/|^\.|\/\./.test(t)) return null;
  const m = /^([A-Za-z0-9][\w-]*)\/([\w.-]+?)(?:\.git)?$/.exec(t);
  return m && !m[2].startsWith('.') ? `${m[1]}/${m[2]}` : null;
}

/** The screens under a Route, root first: the phone's NavigationStack pushes each. */
export function chainOf(r: Route): Route[] {
  switch (r.s) {
    case 'code': {
      if (!r.path) return [r];
      const parts = r.path.split('/');
      return [{ s: 'code', ref: r.ref }, ...parts.map((_, i): Route => (i === parts.length - 1 ? r : { s: 'code', ref: r.ref, path: parts.slice(0, i + 1).join('/') }))];
    }
    case 'commits': return r.path ? [{ s: 'code', ref: r.ref }, { s: 'code', ref: r.ref, path: r.path }, r] : [{ s: 'code', ref: r.ref }, r];
    case 'commit': return [{ s: 'code' }, { s: 'commits' }, r];
    case 'edit': return [{ s: 'code', ref: r.ref }, { s: 'code', ref: r.ref, path: r.path }, r];
    case 'new-file': return [{ s: 'code', ref: r.ref }, r];
    case 'branches': case 'tags': case 'releases': case 'people': return [{ s: 'code' }, r];
    case 'release': return [{ s: 'code' }, { s: 'releases' }, r];
    case 'new-release': return [{ s: 'code' }, { s: 'releases' }, r];
    case 'compare': return [{ s: 'pulls' }, r];
    case 'issues': return [r];
    case 'issue': case 'new-issue': case 'labels': case 'milestones': return [{ s: 'issues' }, r];
    case 'milestone': return [{ s: 'issues' }, { s: 'milestones' }, r];
    case 'pulls': return [r];
    case 'pull': return [{ s: 'pulls' }, r];
    case 'actions': return [r];
    case 'run': return [{ s: 'actions' }, r];
    default: return [r];
  }
}

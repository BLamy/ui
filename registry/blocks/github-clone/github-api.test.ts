/* The GitHub data layer against a stand-in fetch: GitHub's JSON shapes in, data.ts's shapes out, plus the headers,
   caching, pagination, error kinds and the comment write. No network. */
import { describe, expect, it, vi } from 'vitest';
import {
  GitHubError, ago, compactCount, createGitHub, duration, githubRepo, languagesOf, linkRel, parseRepo, timelineOf, treeOf, type GhEvent,
} from './github-api';

const NOW = Date.parse('2026-10-29T12:00:00Z');
const H = (h: number) => new Date(NOW - h * 3600_000).toISOString();

type Route = { status?: number; body?: unknown; text?: string; bytes?: Uint8Array; headers?: Record<string, string> };
/** A fetch answering from `routes` (paths after api.github.com): an exact match, or the path with a query added. */
function fakeFetch(routes: Record<string, Route | (() => Route)>) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const f = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const path = url.replace('https://api.github.com', '');
    const key = Object.keys(routes).filter((k) => path === k || path.startsWith(k + '?') || (k.includes('?') && path.startsWith(k))).sort((a, b) => b.length - a.length)[0];
    if (!key) return new Response(JSON.stringify({ message: 'Not Found' }), { status: 404 });
    const r = typeof routes[key] === 'function' ? (routes[key] as () => Route)() : (routes[key] as Route);
    const body = r.bytes ?? r.text ?? JSON.stringify(r.body ?? {});
    return new Response(body as BodyInit, { status: r.status ?? 200, headers: { 'x-ratelimit-limit': '5000', 'x-ratelimit-remaining': '4990', 'x-ratelimit-reset': '1793275200', ...r.headers } });
  });
  return { f, calls };
}
const client = (routes: Record<string, Route | (() => Route)>) => {
  const { f, calls } = fakeFetch(routes);
  return { gh: createGitHub({ token: 'gho_test_token', fetch: f, now: () => NOW }), f, calls };
};
const user = (login: string) => ({ login, avatar_url: `https://avatars.example/${login}` });

describe('formatting', () => {
  it('writes counts and times like GitHub', () => {
    expect(compactCount(842)).toBe('842');
    expect(compactCount(12_400)).toBe('12.4k');
    expect(compactCount(1_250_000)).toBe('1.3m');
    expect(ago(H(0.001), NOW)).toBe('now');
    expect(ago(H(0.5), NOW)).toBe('30 minutes ago');
    expect(ago(H(3), NOW)).toBe('3 hours ago');
    expect(ago(H(30), NOW)).toBe('yesterday');
    expect(ago(H(24 * 5), NOW)).toBe('5 days ago');
    expect(ago('2026-01-02T00:00:00Z', NOW)).toBe('on Jan 2, 2026');
    expect(duration('2026-10-29T10:00:00Z', '2026-10-29T10:01:52Z')).toBe('1m 52s');
    expect(duration('2026-10-29T10:00:00Z', '2026-10-29T10:00:48Z')).toBe('48s');
  });

  it('reads Link headers and repository names', () => {
    const link = '<https://api.github.com/r?page=2>; rel="next", <https://api.github.com/r?page=38>; rel="last"';
    expect(linkRel(link, 'next')).toBe('https://api.github.com/r?page=2');
    expect(linkRel(link, 'last')).toBe('https://api.github.com/r?page=38');
    expect(linkRel(null, 'next')).toBeNull();
    expect(parseRepo('BLamy/ui')).toBe('BLamy/ui');
    expect(parseRepo('https://github.com/facebook/react/pulls')).toBe('facebook/react');
    expect(parseRepo('git@github')).toBeNull();
    expect(parseRepo('github.com/vercel/next.js.git')).toBe('vercel/next.js');
  });

  it('folds languages past four into Other and nests a flat tree', () => {
    const langs = languagesOf({ TypeScript: 900, CSS: 50, HTML: 20, Shell: 15, Nix: 10, Go: 5 });
    expect(langs.map((l) => l.name)).toEqual(['TypeScript', 'CSS', 'HTML', 'Shell', 'Other']);
    expect(langs[0]).toMatchObject({ pct: 90, color: '#3178c6' });
    const tree = treeOf([{ path: 'src/a.ts', type: 'blob', size: 3 }, { path: 'src', type: 'tree' }, { path: 'README.md', type: 'blob' }]);
    expect(tree.map((n) => n.name)).toEqual(['src', 'README.md']);
    expect(tree[0].children?.[0]).toMatchObject({ path: 'src/a.ts', type: 'file', size: 3 });
  });
});

describe('createGitHub', () => {
  it('sends the token and caches each GET for the session', async () => {
    const { gh, f, calls } = client({ '/user': { body: user('octocat') } });
    await gh.get('/user');
    await gh.get('/user');
    expect(f).toHaveBeenCalledTimes(1);
    const headers = calls[0].init?.headers as Record<string, string>;
    expect(calls[0].url).toBe('https://api.github.com/user');
    expect(headers.Authorization).toBe('Bearer gho_test_token');
    expect(headers.Accept).toBe('application/vnd.github+json');
    expect(gh.rateLimit()).toMatchObject({ limit: 5000, remaining: 4990 });
  });

  it('turns 401, 404 and an exhausted rate limit into error kinds, and does not cache failures', async () => {
    let n = 0;
    const { gh, f } = client({
      '/user': { status: 401, body: { message: 'Bad credentials' } },
      '/flaky': () => (n++ ? { body: { ok: true } } : { status: 500, body: { message: 'boom' } }),
      '/limited': { status: 403, body: { message: 'API rate limit exceeded' }, headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(NOW / 1000 + 600) } },
    });
    await expect(gh.get('/user')).rejects.toMatchObject({ kind: 'auth', status: 401 });
    await expect(gh.get('/nowhere')).rejects.toMatchObject({ kind: 'notFound' });
    const limited = await gh.get('/limited').catch((e: GitHubError) => e);
    expect(limited).toBeInstanceOf(GitHubError);
    expect(limited).toMatchObject({ kind: 'rateLimit', resetAt: NOW + 600_000 });
    await expect(gh.get('/flaky')).rejects.toMatchObject({ kind: 'other', message: 'boom' });
    await expect(gh.get('/flaky')).resolves.toEqual({ ok: true });
    expect(f.mock.calls.filter(([u]) => u.endsWith('/flaky'))).toHaveLength(2);
  });

  it('follows rel="next" across pages and counts from rel="last"', async () => {
    const { gh } = client({
      '/items?page=2': { body: [3] },
      '/items': { body: [1, 2], headers: { link: '<https://api.github.com/items?page=2>; rel="next"' } },
      '/things?per_page=1': { body: [1], headers: { link: '<https://api.github.com/things?per_page=1&page=38>; rel="last"' } },
      '/few?per_page=1': { body: [1] },
    });
    expect(await gh.getAll('/items')).toEqual([1, 2, 3]);
    expect(await gh.count('/things')).toBe(38);
    expect(await gh.count('/few')).toBe(1);
  });
});

const R = '/repos/BLamy/ui';

describe('githubRepo', () => {
  it('maps the repository page, tolerating what is missing (no releases)', async () => {
    const { gh } = client({
      [R]: { body: { name: 'ui', owner: { login: 'BLamy' }, description: 'BL UI', homepage: 'https://blamy.github.io/ui', topics: ['react'], stargazers_count: 12_400, forks_count: 842, subscribers_count: 9, license: { name: 'MIT License' }, default_branch: 'main', private: false, html_url: 'https://github.com/BLamy/ui' } },
      [`${R}/branches?per_page=100`]: { body: [{ name: 'feat/x' }, { name: 'main' }] },
      [`${R}/branches?per_page=1`]: { body: [{}], headers: { link: `<https://api.github.com${R}/branches?per_page=1&page=7>; rel="last"` } },
      [`${R}/tags?per_page=1`]: { body: [] },
      [`${R}/commits?sha=main&per_page=1`]: { body: [{}], headers: { link: `<https://api.github.com${R}/commits?sha=main&per_page=1&page=1482>; rel="last"` } },
      [`${R}/commits?per_page=1`]: { body: [{ sha: 'abcdef1234', commit: { message: 'fix: things\n\nlong body', author: { name: 'Brett', date: H(3) } }, author: user('BLamy') }] },
      [`${R}/languages`]: { body: { TypeScript: 3, CSS: 1 } },
      [`${R}/contributors?per_page=14`]: { body: [user('BLamy')] },
    });
    const repo = await githubRepo(gh, 'BLamy/ui').repo();
    expect(repo).toMatchObject({
      owner: 'BLamy', name: 'ui', homepage: 'blamy.github.io/ui', stars: '12.4k', forks: '842', license: 'MIT License', branch: 'main',
      branches: ['main', 'feat/x'], branchCount: 7, tagCount: 0, commitCount: '1,482', release: null, contributorCount: 1,
      lastCommit: { sha: 'abcdef1', message: 'fix: things', when: '3 hours ago' },
    });
    expect(repo.contributors[0]).toMatchObject({ login: 'BLamy', avatar: 'https://avatars.example/BLamy' });
    expect(repo.languages.map((l) => [l.name, l.pct])).toEqual([['TypeScript', 75], ['CSS', 25]]);
  });

  it('lists issues and pull requests through search', async () => {
    const { gh, calls } = client({
      '/search/issues': { body: { total_count: 2, items: [
        { number: 9, title: 'Crash', state: 'open', user: user('a'), created_at: H(2), closed_at: null, labels: [{ name: 'bug', color: 'd73a4a' }], comments: 3, assignees: [], html_url: 'https://github.com/BLamy/ui/issues/9' },
        { number: 8, title: 'Ship it', state: 'closed', user: user('b'), created_at: H(50), closed_at: H(1), labels: [], comments: 0, draft: false, pull_request: { merged_at: H(1) }, html_url: 'u' },
      ] } },
    });
    const src = githubRepo(gh, 'BLamy/ui');
    const issues = await src.issues('open');
    expect(decodeURIComponent(calls[0].url)).toContain('q=repo:BLamy/ui is:issue is:open');
    expect(issues[0]).toMatchObject({ number: 9, when: '2 hours ago', labels: [{ name: 'bug', color: '#d73a4a' }], comments: 3 });
    const pulls = await src.pulls('closed');
    expect(pulls[1]).toMatchObject({ number: 8, state: 'merged', when: '1 hour ago' });
    expect(pulls[1].review).toBeUndefined();
    expect(await src.counts()).toEqual({ issues: { open: 2, closed: 2 }, pulls: { open: 2, closed: 2 } });
  });

  it('builds a conversation: the description first, then folded commits and labels, reviews and events', async () => {
    const events: GhEvent[] = [
      { event: 'committed', sha: 'aaaaaaa111', message: 'one\nmore', author: { name: 'Maya Chen', date: H(5) }, committer: { date: H(5) } },
      { event: 'committed', sha: 'bbbbbbb222', message: 'two', author: { name: 'Maya Chen', date: H(4) }, committer: { date: H(4) } },
      { event: 'labeled', actor: user('jonas'), created_at: H(4), label: { name: 'perf', color: 'fbca04' } },
      { event: 'labeled', actor: user('jonas'), created_at: H(4), label: { name: 'bug', color: 'd73a4a' } },
      { event: 'review_requested', actor: user('maya'), created_at: H(4), requested_reviewer: user('jonas') },
      { event: 'reviewed', id: 5, user: user('jonas'), submitted_at: H(3), state: 'changes_requested', body: 'clamp it' },
      { event: 'commented', id: 6, actor: user('priya'), created_at: H(2), body: 'nice', author_association: 'CONTRIBUTOR', html_url: 'https://github.com/c/6' },
      { event: 'merged', id: 7, actor: user('maya'), created_at: H(1) },
      { event: 'subscribed', id: 8, actor: user('x') },
    ];
    const { gh } = client({
      [`${R}/issues/488/timeline`]: { body: events },
      [`${R}/issues/488`]: { body: { number: 488, title: 'T', state: 'closed', user: user('maya'), created_at: H(6), closed_at: H(1), labels: [], comments: 1, body: 'Closes #1', author_association: 'MEMBER', html_url: 'https://github.com/BLamy/ui/pull/488' } },
    });
    const items = await githubRepo(gh, 'BLamy/ui').timeline(488);
    expect(items.map((i) => i.kind)).toEqual(['comment', 'commits', 'labeled', 'requested', 'review', 'comment', 'event']);
    expect(items[0]).toMatchObject({ id: 'body', body: 'Closes #1', role: 'Member', author: { login: 'maya' } });
    expect(items[1].kind === 'commits' && items[1].commits.map((c) => [c.sha, c.message])).toEqual([['aaaaaaa', 'one'], ['bbbbbbb', 'two']]);
    expect(items[2].kind === 'labeled' && items[2].labels.map((l) => l.name)).toEqual(['perf', 'bug']);
    expect(items[4]).toMatchObject({ kind: 'review', state: 'changes', body: 'clamp it' });
    expect(items[5]).toMatchObject({ kind: 'comment', role: 'Contributor', url: 'https://github.com/c/6' });
    expect(items[6]).toMatchObject({ kind: 'event', event: 'merged' });
  });

  it('opens a pull request: each reviewer’s latest verdict, checks for the head commit, files with patches', async () => {
    const { gh } = client({
      [`${R}/pulls/12/reviews`]: { body: [
        { user: user('jonas'), state: 'CHANGES_REQUESTED' }, { user: user('jonas'), state: 'APPROVED' }, { user: user('jonas'), state: 'COMMENTED' }, { user: user('priya'), state: 'COMMENTED' },
      ] },
      [`${R}/pulls/12/files`]: { body: [
        { filename: 'src/a.ts', additions: 2, deletions: 1, status: 'modified', patch: '@@ -1 +1,2 @@\n-a\n+b\n+c' },
        { filename: 'logo.png', additions: 0, deletions: 0, status: 'added' },
      ] },
      [`${R}/pulls/12`]: { body: { number: 12, title: 'P', state: 'open', draft: false, merged_at: null, user: user('maya'), created_at: H(30), labels: [], comments: 2, head: { ref: 'feat', sha: 'cafe' }, base: { ref: 'main' }, commits: 3, additions: 2, deletions: 1, changed_files: 2, html_url: 'h', body: null, requested_reviewers: [user('ava')], mergeable_state: 'clean' } },
      [`${R}/commits/cafe/check-runs`]: { body: { check_runs: [
        { name: 'test', status: 'completed', conclusion: 'success', started_at: '2026-10-29T10:00:00Z', completed_at: '2026-10-29T10:01:48Z' },
        { name: 'lint', status: 'in_progress', conclusion: null, started_at: null, completed_at: null },
      ] } },
      [`${R}/commits/cafe/status`]: { body: { statuses: [{ context: 'netlify', state: 'failure', description: 'Deploy failed' }] } },
    });
    const src = githubRepo(gh, 'BLamy/ui');
    const p = await src.pull(12);
    expect(p).toMatchObject({ state: 'open', review: 'approved', head: 'feat', base: 'main', changedFiles: 2, mergeable: 'clean', when: 'yesterday' });
    expect(p.reviewers.map((r) => [r.user.login, r.state])).toEqual([['jonas', 'approved'], ['priya', 'commented'], ['ava', 'pending']]);
    expect(await src.pullChecks(12)).toEqual([
      { name: 'test', status: 'success', time: '1m 48s' },
      { name: 'lint', status: 'pending', time: 'in progress' },
      { name: 'netlify', status: 'failure', time: 'Deploy failed' },
    ]);
    const files = await src.pullFiles(12);
    expect(files[0]).toMatchObject({ path: 'src/a.ts', patch: expect.stringContaining('@@ -1 +1,2 @@'), note: undefined });
    expect(files[1]).toMatchObject({ path: 'logo.png', patch: '', note: expect.stringContaining('Binary') });
  });

  it('reads files as raw text, binary as null, and a missing README as null', async () => {
    const { gh, calls } = client({
      [`${R}/contents/src/a%20b.ts?ref=next`]: { text: 'export const x = 1;\n' },
      [`${R}/contents/logo.png`]: { bytes: new Uint8Array([137, 80, 78, 71, 0, 1]) },
    });
    const src = githubRepo(gh, 'BLamy/ui');
    expect(await src.file('src/a b.ts', 'next')).toBe('export const x = 1;\n');
    expect((calls[0].init?.headers as Record<string, string>).Accept).toBe('application/vnd.github.raw+json');
    expect(await src.file('logo.png', '')).toBeNull();
    expect(await src.readme('')).toBeNull();
  });

  it('maps workflow runs and keeps going when Actions is off', async () => {
    const { gh } = client({
      [`${R}/actions/runs`]: { body: { total_count: 184, workflow_runs: [
        { id: 1, name: 'CI', display_title: 'fix', run_number: 7, event: 'pull_request', pull_requests: [{ number: 12 }], actor: user('maya'), head_branch: 'feat', status: 'completed', conclusion: 'timed_out', created_at: H(2), run_started_at: '2026-10-29T10:00:00Z', updated_at: '2026-10-29T10:00:22Z', html_url: 'r' },
        { id: 2, name: 'CI', display_title: 'wip', run_number: 8, event: 'push', actor: user('maya'), head_branch: 'main', status: 'in_progress', conclusion: null, created_at: H(0.2), updated_at: H(0.1), html_url: 'r2' },
      ] } },
    });
    const runs = await githubRepo(gh, 'BLamy/ui').runs();
    expect(runs.total).toBe(184);
    expect(runs.workflows).toEqual([]);
    expect(runs.runs[0]).toMatchObject({ event: 'pull_request #12', status: 'failure', duration: '22s', branch: 'feat' });
    expect(runs.runs[1]).toMatchObject({ status: 'running', when: '12 minutes ago' });
  });

  it('posts a comment and asks for the conversation again afterwards', async () => {
    let timelineCalls = 0;
    const { gh, calls } = client({
      [`${R}/issues/9/comments`]: { status: 201, body: { id: 77, body: 'Looks good', user: user('octocat'), created_at: new Date(NOW).toISOString(), html_url: 'https://github.com/BLamy/ui/issues/9#issuecomment-77', author_association: 'OWNER' } },
      [`${R}/issues/9/timeline`]: () => { timelineCalls++; return { body: [] }; },
      [`${R}/issues/9`]: { body: { number: 9, title: 'x', state: 'open', user: user('a'), created_at: H(1), closed_at: null, labels: [], comments: 0, body: '', html_url: 'h' } },
    });
    const src = githubRepo(gh, 'BLamy/ui');
    await src.timeline(9);
    const item = await src.comment(9, 'Looks good');
    const post = calls.find((c) => c.init?.method === 'POST')!;
    expect(post.url).toBe(`https://api.github.com${R}/issues/9/comments`);
    expect(JSON.parse(String(post.init?.body))).toEqual({ body: 'Looks good' });
    expect(item).toMatchObject({ kind: 'comment', id: 'c77', body: 'Looks good', role: 'Owner', when: 'now', url: expect.stringContaining('issuecomment-77') });
    await src.timeline(9);
    expect(timelineCalls).toBe(2);
  });
});

describe('timelineOf', () => {
  it('skips pending reviews and events it does not draw', () => {
    expect(timelineOf([{ event: 'reviewed', state: 'pending', user: user('a') }, { event: 'mentioned', actor: user('b') }], NOW)).toEqual([]);
  });
});

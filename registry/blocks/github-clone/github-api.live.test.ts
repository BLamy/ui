/* The client against real GitHub, read-only: the check that our model of GitHub (sample-server.ts) and the mappers match
   what github.com actually sends. Skipped unless asked for:

     GITHUB_LIVE=1 pnpm exec vitest run --config packages/ui/vitest.config.mts registry/blocks/github-clone/github-api.live

   Requests go through the `gh` CLI, so this code never holds a token. The fetch refuses every write: only GET, and POST to
   /graphql with a query rather than a mutation. Mutations are checked by asking GitHub's schema about their inputs, never
   by running them. Nothing here changes anything on any account. */
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { createGitHub, githubRepo, recentRepos, viewerOf, type Fetch } from './github-api';

const LIVE = !!process.env.GITHUB_LIVE;
const REPO = process.env.GITHUB_LIVE_REPO ?? 'cli/cli';
/** cli/cli is known to have everything; any other repository may have no tags, issues or releases, and that's fine. */
const BUSY = REPO === 'cli/cli';

/** A fetch over `gh api`. Throws on anything that could change something. */
const ghFetch: Fetch = async (url, init = {}) => {
  const method = (init.method ?? 'GET').toUpperCase();
  const path = url.replace('https://api.github.com', '');
  const body = typeof init.body === 'string' ? init.body : undefined;
  if (method !== 'GET') {
    const query = body ? (JSON.parse(body) as { query?: string }).query ?? '' : '';
    if (!(method === 'POST' && path === '/graphql' && /^\s*query\b/.test(query))) throw new Error(`Refusing a write in the read-only live test: ${method} ${path}`);
  }
  const accept = new Headers(init.headers).get('accept') ?? 'application/vnd.github+json';
  const args = ['api', '--include', '--method', method, '-H', `Accept: ${accept}`, path.replace(/^\//, ''), ...(body ? ['--input', '-'] : [])];
  let out: Buffer;
  try {
    out = execFileSync('gh', args, { input: body, maxBuffer: 1 << 28, stdio: ['pipe', 'pipe', 'ignore'] });
  } catch (e) {
    // gh exits non-zero on 4xx and 5xx but has printed the response.
    out = (e as { stdout?: Buffer }).stdout ?? Buffer.from('HTTP/2.0 599\r\n\r\n{"message":"gh failed"}');
  }
  const split = out.indexOf('\r\n\r\n');
  const head = out.subarray(0, split).toString().split('\r\n');
  const status = Number(head[0].split(' ')[1]);
  const headers = new Headers();
  for (const line of head.slice(1)) {
    const at = line.indexOf(':');
    if (at > 0) headers.append(line.slice(0, at), line.slice(at + 1).trim());
  }
  const payload = out.subarray(split + 4);
  return new Response(status === 204 || status === 304 ? null : new Uint8Array(payload), { status, headers });
};

const graphql = (query: string) => JSON.parse(execFileSync('gh', ['api', 'graphql', '--input', '-'], { input: JSON.stringify({ query }), stdio: ['pipe', 'pipe', 'ignore'] }).toString()) as { data: Record<string, { inputFields?: { name: string }[] } | null> };

describe.skipIf(!LIVE)('real GitHub, read-only', () => {
  const gh = createGitHub({ token: 'held-by-the-gh-cli', fetch: ghFetch, settle: 0 });
  const source = githubRepo(gh, REPO);

  it('the fetch refuses writes', async () => {
    await expect(ghFetch('https://api.github.com/repos/x/y/issues', { method: 'POST', body: '{}' })).rejects.toThrow(/Refusing/);
    await expect(ghFetch('https://api.github.com/graphql', { method: 'POST', body: JSON.stringify({ query: 'mutation X { a }' }) })).rejects.toThrow(/Refusing/);
  });

  it('account', async () => {
    expect((await viewerOf(gh)).login).toBeTruthy();
    expect((await recentRepos(gh)).length).toBeGreaterThan(0);
    expect(gh.scopes()).toContain('repo');
    expect(gh.rateLimit()?.limit).toBeGreaterThan(0);
  }, 60_000);

  it('repository, counts and code', async () => {
    const repo = await source.repo();
    expect(repo).toMatchObject({ empty: false, permissions: { pull: true } });
    expect(repo.branchCount).toBeGreaterThan(0);
    expect(repo.lastCommit?.fullSha).toMatch(/^[0-9a-f]{40}$/);
    const counts = await source.counts();
    if (BUSY) expect(counts.issues.open + counts.issues.closed).toBeGreaterThan(0);
    if (BUSY) expect((await source.labels()).length).toBeGreaterThan(0);
    await source.milestones('all');
    const tree = await source.tree('');
    const file = tree.find((n) => n.type === 'file' && n.name === 'LICENSE') ?? tree.find((n) => n.type === 'file')!;
    expect(await source.file(file.path, '')).toBeTruthy();
    expect(await source.fileSha(file.path, '')).toMatch(/^[0-9a-f]{40}$/);
    expect(await source.readme('')).toBeTruthy();
    const last = await source.lastCommits(tree.slice(0, 5).map((n) => n.path), '');
    expect(Object.keys(last).length).toBeGreaterThan(0);
    expect((await source.blame(file.path, '')).length).toBeGreaterThan(0);
    const names = await source.refNames();
    expect(names.branches).toContain(repo.branch);
    const tags = await source.tags(1);
    if (BUSY) expect(tags.items.length).toBeGreaterThan(0);
    await source.starred();
    await source.subscription();
    await source.assignable();
    const forks = await source.people('forks', 1);
    if (BUSY) expect(forks.items.length).toBeGreaterThan(0);
  }, 180_000);

  it('history and compare', async () => {
    const page = await source.commits({ ref: '', page: 1 });
    expect(page.items.length).toBe(30);
    expect(page.hasNext).toBe(true);
    const detail = await source.commit(page.items[0].fullSha);
    expect(detail.fullSha).toBe(page.items[0].fullSha);
    expect(Array.isArray(await source.commitComments(page.items[0].fullSha))).toBe(true);
    const cmp = await source.compare(page.items[3].fullSha, page.items[0].fullSha);
    expect(cmp.ahead).toBeGreaterThan(0);
    expect(cmp.status).toBe('ahead');
  }, 120_000);

  it('issues: search with qualifiers, pages, a conversation', async () => {
    const open = await source.searchIssues('is:open sort:comments-desc', 1);
    if (!BUSY && !open.items.length) return;
    expect(open.total).toBeGreaterThan(0);
    const comments = open.items.map((i) => i.comments);
    expect(comments).toEqual([...comments].sort((a, b) => b - a));
    const n = open.items[0].number;
    const issue = await source.issue(n);
    expect(issue.nodeId).toBeTruthy();
    const timeline = await source.timeline(n);
    expect(timeline[0]).toMatchObject({ kind: 'comment', isBody: true });
    if (open.items[0].comments) expect(timeline.some((t) => t.kind === 'comment' && !t.isBody)).toBe(true);
    expect(await source.issueExtras(n)).toMatchObject({ id: expect.any(String), closedBy: expect.any(Array) });
    expect(Array.isArray(await source.issueTemplates())).toBe(true);
  }, 120_000);

  it('pull requests: rows filled from GraphQL, detail, threads, files, checks', async () => {
    const merged = await source.searchPulls('is:merged sort:comments-desc', 1);
    if (!BUSY && !merged.items.length) return;
    expect(merged.items.every((p) => p.state === 'merged')).toBe(true);
    expect(merged.items.some((p) => p.head)).toBe(true);
    const n = merged.items[0].number;
    const p = await source.pull(n);
    expect(p).toMatchObject({ number: n, state: 'merged' });
    expect(p.nodeId).toBeTruthy();
    expect((await source.pullCommits(n)).length).toBeGreaterThan(0);
    expect((await source.pullFiles(n)).length).toBeGreaterThan(0);
    await source.pullChecks(n);
    const threads = await source.pullThreads(n);
    expect(Array.isArray(threads.threads)).toBe(true);
    if (threads.threads[0]) expect(threads.threads[0].comments[0].id).toBeGreaterThan(0);
    expect(await source.pullExtras(n)).toMatchObject({ closes: expect.any(Array) });
    const timeline = await source.timeline(n);
    expect(timeline.some((t) => t.kind === 'event' && t.event === 'merged')).toBe(true);
    const open = await source.searchPulls('is:open', 1);
    if (open.items[0]) expect(['clean', 'blocked', 'dirty', 'behind', 'unstable', 'unknown', 'draft', 'has_hooks']).toContain((await source.pull(open.items[0].number)).mergeable);
  }, 180_000);

  it('Actions and releases', async () => {
    const runs = await source.runs({ status: 'success' });
    expect(runs.items.every((r) => r.status === 'success')).toBe(true);
    if (runs.items[0]) expect((await source.run(runs.items[0].id)).jobs.length).toBeGreaterThan(0);
    if (runs.items[0]) expect(Array.isArray(await source.artifacts(runs.items[0].id))).toBe(true);
    const workflows = await source.workflows();
    if (workflows[0]) await source.workflowInputs(workflows[0].path, '');
    const releases = await source.releases(1);
    if (BUSY) expect(releases.items.some((r) => r.latest)).toBe(true);
    if (releases.items[0]) expect((await source.release(releases.items[0].tag)).tag).toBe(releases.items[0].tag);
  }, 120_000);

  it('search and statistics', async () => {
    const hits = await source.searchCode('func');
    if (BUSY) expect(hits.items.length).toBeGreaterThan(0);
    const activity = await source.commitActivity();
    if (activity !== 'computing') expect(activity.length).toBe(52);
    await source.contributorStats();
    // GitHub refuses this one above 10,000 commits; the screen shows its words. Anything else is a real failure.
    await Promise.resolve(source.codeFrequency()).catch((e: { kind?: string }) => expect(e.kind).toBe('validation'));
    // Someone else's repository: GitHub keeps traffic from people who can't push.
    if (!(await source.repo()).permissions.push) expect(await source.traffic()).toBeNull();
  }, 120_000);

  it('a tree too big to list comes back truncated, and a path past the cut can still be asked for', async () => {
    const huge = githubRepo(gh, 'torvalds/linux');
    expect(await huge.treeTruncated('')).toBe(true);
    const dir = await huge.pathInfo('drivers/net/ethernet', '');
    expect(dir?.type).toBe('dir');
    expect(dir?.children?.length).toBeGreaterThan(10);
    expect((await huge.pathInfo('MAINTAINERS', ''))?.type).toBe('file');
    expect(await huge.pathInfo('no/such/path', '')).toBeNull();
  }, 180_000);

  it('submodules and symlinks read as what they are', async () => {
    const git = githubRepo(gh, 'git/git');
    const tree = await git.tree('');
    expect(tree.find((n) => n.name === 'RelNotes')?.special).toBe('symlink');
    expect(tree.find((n) => n.name === 'sha1collisiondetection')?.special).toBe('submodule');
    expect(tree.find((n) => n.name === 'README.md')?.special).toBeUndefined();
    expect((await git.pathInfo('sha1collisiondetection', ''))?.special).toBe('submodule');
  }, 120_000);

  it('a real 404 is notFound', async () => {
    await expect(githubRepo(gh, 'BLamy/this-repository-does-not-exist-xyz').repo()).rejects.toMatchObject({ kind: 'notFound' });
  }, 30_000);

  /* The mutations are never run: GitHub's schema says whether the inputs we send exist. */
  it('every mutation input we send exists in the schema', () => {
    const uses: Record<string, string[]> = {
      DeleteIssueInput: ['issueId'], PinIssueInput: ['issueId'], UnpinIssueInput: ['issueId'], UpdateSubscriptionInput: ['subscribableId', 'state'],
      ConvertPullRequestToDraftInput: ['pullRequestId'], MarkPullRequestReadyForReviewInput: ['pullRequestId'], EnablePullRequestAutoMergeInput: ['pullRequestId', 'mergeMethod'], DisablePullRequestAutoMergeInput: ['pullRequestId'],
      AddPullRequestReviewThreadInput: ['pullRequestReviewId', 'path', 'line', 'side', 'startLine', 'body'], ResolveReviewThreadInput: ['threadId'], UnresolveReviewThreadInput: ['threadId'], RevertPullRequestInput: ['pullRequestId', 'title'], MarkFileAsViewedInput: ['pullRequestId', 'path'], UnmarkFileAsViewedInput: ['pullRequestId', 'path'],
    };
    for (const [name, wanted] of Object.entries(uses)) {
      const fields = graphql(`query { t: __type(name: "${name}") { inputFields { name } } }`).data.t?.inputFields?.map((f) => f.name) ?? [];
      for (const want of wanted) expect(fields, name).toContain(want);
    }
  }, 60_000);
});

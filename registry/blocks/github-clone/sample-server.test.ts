/* The client against the sample GitHub: the same code path real GitHub takes, with writes that really change what the
   next read returns, and the rules (roles, conflicts, required reviews) the screens depend on. */
import { describe, expect, it } from 'vitest';
import { GitHubError, githubRepo } from './github-api';
import { createSampleGitHub } from './sample';
import { closingNumbers } from './sample-server';
import { diffLines, mergeText, patchOf } from './sample-git';
import type { PullThreads } from './data';
import { inCode, taskPositions, toggleTask } from './markdown';
import { applyLines, reviewedLines, suggestionOf } from './pull-request';
import { fromPath, repoFromInput, toPath } from './route';

const orbit = (o: Parameters<typeof createSampleGitHub>[0] = {}) => {
  const { gh, server } = createSampleGitHub(o);
  return { gh, server, source: githubRepo(gh, 'acme/orbit', { live: false }) };
};

describe('the sample git', () => {
  it('diffs and writes hunks like git', () => {
    const patch = patchOf(diffLines('a\nb\nc\n', 'a\nB\nc\nd\n'));
    expect(patch).toBe('@@ -1,3 +1,4 @@\n a\n-b\n+B\n c\n+d');
  });
  it('merges changes on different lines and refuses overlapping ones', () => {
    expect(mergeText('a\nb\nc\n', 'A\nb\nc\n', 'a\nb\nC\n')).toBe('A\nb\nC\n');
    expect(mergeText('a\nb\nc\n', 'a\nX\nc\n', 'a\nY\nc\n')).toBeNull();
    expect(mergeText('a\n', 'a\nb\n', 'a\nb\n')).toBe('a\nb\n');
  });
  it('reads closing keywords', () => {
    expect(closingNumbers('Fixes #12. closes #3, resolved #9; see #4')).toEqual([12, 3, 9]);
  });
});

describe('repository', () => {
  it('counts what is actually there', async () => {
    const { source } = orbit();
    const repo = await source.repo();
    const refs = await source.refNames();
    expect(repo.branchCount).toBe(refs.branches.length);
    expect(repo.tagCount).toBe(refs.tags.length);
    const counts = await source.counts();
    const open = await source.searchIssues('is:open', 1);
    expect(open.total).toBe(counts.issues.open);
    expect(repo.permissions.admin).toBe(true);
    expect(Number(repo.commitCount)).toBeGreaterThan(30);
  });
  it('stars, watches and forks', async () => {
    const { gh, source } = orbit();
    expect(await source.starred()).toBe(false);
    const before = (await source.repo()).starCount;
    await source.setStarred(true);
    expect(await source.starred()).toBe(true);
    expect((await source.repo()).starCount).toBe(before + 1);
    await source.setSubscription('all');
    expect(await source.subscription()).toBe('all');
    await source.setSubscription('ignored');
    expect(await source.subscription()).toBe('ignored');
    await source.setSubscription('participating');
    expect(await source.subscription()).toBe('participating');
    const full = await source.fork({ name: 'orbit-fork' });
    expect(full).toBe('you/orbit-fork');
    const fork = await githubRepo(gh, full, { live: false }).repo();
    expect(fork.parent).toBe('acme/orbit');
  });
  it('edits settings as an admin and refuses others', async () => {
    const { source } = orbit();
    await source.update({ description: 'New words', allow_rebase_merge: false });
    const repo = await source.repo();
    expect(repo.description).toBe('New words');
    expect(repo.merge.rebase).toBe(false);
    const reader = orbit({ role: 'read' }).source;
    await expect(reader.update({ description: 'x' })).rejects.toMatchObject({ kind: 'forbidden' });
  });
});

describe('code', () => {
  it('commits a file to a branch and sees it everywhere', async () => {
    const { source } = orbit();
    await source.createBranch('feat/new', 'main');
    const refs = await source.refNames();
    expect(refs.branches).toContain('feat/new');
    await source.putFile({ path: 'docs/new.md', content: '# New\n\nÜnicode ✓\n', message: 'docs: add new page', branch: 'feat/new' });
    expect(await source.file('docs/new.md', 'feat/new')).toBe('# New\n\nÜnicode ✓\n');
    await expect(source.file('docs/new.md', '')).rejects.toMatchObject({ kind: 'notFound' });
    const last = await source.lastCommit('docs/new.md', 'feat/new');
    expect(last?.message).toBe('docs: add new page');
    const cmp = await source.compare('main', 'feat/new');
    expect(cmp.ahead).toBe(1);
    expect(cmp.files.map((f) => f.path)).toEqual(['docs/new.md']);
    expect(cmp.files[0].status).toBe('added');
  });
  it('edits and deletes with the blob sha GitHub asks for', async () => {
    const { source } = orbit();
    const sha = await source.fileSha('README.md', '');
    await expect(source.putFile({ path: 'README.md', content: 'x', message: 'y', branch: 'main' })).rejects.toMatchObject({ kind: 'validation' });
    await source.putFile({ path: 'README.md', content: '# Hello\n', message: 'docs: shorten', branch: 'main', sha });
    expect(await source.readme('')).toBe('# Hello\n');
    await expect(source.putFile({ path: 'README.md', content: 'stale', message: 'y', branch: 'main', sha })).rejects.toMatchObject({ status: 409 });
    const now = await source.fileSha('README.md', '');
    await source.deleteFile({ path: 'README.md', message: 'chore: delete', branch: 'main', sha: now! });
    expect(await source.readme('')).toBeNull();
  });
  it('pages history, filters by path and author, and blames', async () => {
    const { source } = orbit();
    const first = await source.commits({ ref: '', page: 1 });
    expect(first.items.length).toBe(30);
    expect(first.hasNext).toBe(true);
    const second = await source.commits({ ref: '', page: 2 });
    expect(second.hasPrev).toBe(true);
    expect(second.items[0].fullSha).not.toBe(first.items[0].fullSha);
    const byPath = await source.commits({ ref: '', path: 'src/retry.ts', page: 1 });
    expect(byPath.items.map((c) => c.message)).toContain('feat: export fixed() retry policy');
    const byAuthor = await source.commits({ ref: '', author: 'avakim', page: 1 });
    expect(byAuthor.items.every((c) => c.author.login === 'avakim')).toBe(true);
    const blame = await source.blame('src/retry.ts', '');
    expect(blame[0].start).toBe(1);
    expect(blame.at(-1)!.end).toBe((await source.file('src/retry.ts', ''))!.trimEnd().split('\n').length);
    const detail = await source.commit(first.items[0].fullSha);
    expect(detail.files.length).toBeGreaterThan(0);
    expect(detail.additions + detail.deletions).toBeGreaterThan(0);
  });
  it('reads last commits per path in one query', async () => {
    const { source, server } = orbit();
    const before = server.log.length;
    const last = await source.lastCommits(['src', 'README.md', 'nope.txt'], '');
    expect(server.log.length).toBe(before + 1);
    expect(last.src.message).toBeTruthy();
    expect(last['README.md'].message).toContain('adapter');
    expect(last['nope.txt']).toBeUndefined();
  });
  it('handles an empty repository', async () => {
    const { gh } = orbit();
    const empty = githubRepo(gh, 'you/new-idea', { live: false });
    const repo = await empty.repo();
    expect(repo.empty).toBe(true);
    expect(await empty.tree('')).toEqual([]);
    expect((await empty.commits({ ref: '', page: 1 })).items).toEqual([]);
    expect(await empty.readme('')).toBeNull();
  });
});

describe('issues', () => {
  it('lives through create, edit, comment, close and reopen', async () => {
    const { source } = orbit();
    const n = await source.createIssue({ title: 'A new bug', body: 'It broke', labels: ['bug'], assignees: ['jonasw'], milestone: 1 });
    const issue = await source.issue(n);
    expect(issue.labels.map((l) => l.name)).toEqual(['bug']);
    expect(issue.assignees.map((u) => u.login)).toEqual(['jonasw']);
    expect(issue.milestone).toBe('v3.3');
    const listed = await source.searchIssues('is:open label:bug', 1);
    expect(listed.items.some((i) => i.number === n)).toBe(true);
    await source.updateIssue(n, { title: 'A renamed bug', body: 'Still broken' });
    expect((await source.issue(n)).title).toBe('A renamed bug');
    const c = await source.comment(n, 'me too');
    expect((await source.issue(n)).comments).toBe(1);
    if (c.kind !== 'comment' || !c.target) throw new Error('not a comment');
    await source.editComment(c.target, 'me three');
    const after = await source.timeline(n);
    expect(after.some((x) => x.kind === 'comment' && x.body === 'me three')).toBe(true);
    await source.deleteComment(c.target, n);
    expect((await source.issue(n)).comments).toBe(0);
    const before = await source.counts();
    await source.updateIssue(n, { state: 'closed', stateReason: 'not_planned' });
    const closed = await source.issue(n);
    expect(closed.state).toBe('closed');
    expect(closed.stateReason).toBe('not_planned');
    expect((await source.counts()).issues.closed).toBe(before.issues.closed + 1);
    expect((await source.searchIssues('is:open', 1)).items.some((i) => i.number === n)).toBe(false);
    await source.updateIssue(n, { state: 'open' });
    expect((await source.issue(n)).state).toBe('open');
    const events = (await source.timeline(n)).filter((x) => x.kind === 'event').map((x) => x.kind === 'event' && x.event);
    expect(events).toEqual(expect.arrayContaining(['assigned', 'milestoned', 'renamed', 'closed', 'reopened']));
  });
  it('filters, sorts and pages through search', async () => {
    const { source } = orbit();
    const all = await source.searchIssues('is:open', 1);
    expect(all.items.length).toBe(25);
    expect(all.hasNext).toBe(true);
    expect((await source.searchIssues('is:open', 2)).page).toBe(2);
    expect((await source.searchIssues('is:open author:avakim', 1)).items.every((i) => i.author.login === 'avakim')).toBe(true);
    expect((await source.searchIssues('is:open no:assignee', 1)).items.every((i) => !i.assignees.length)).toBe(true);
    expect((await source.searchIssues('is:open milestone:"v3.3"', 1)).items.every((i) => i.milestone === 'v3.3')).toBe(true);
    expect((await source.searchIssues('is:open -label:bug', 1)).items.every((i) => !i.labels.some((l) => l.name === 'bug'))).toBe(true);
    const byComments = (await source.searchIssues('is:open sort:comments-desc', 1)).items.map((i) => i.comments);
    expect(byComments).toEqual([...byComments].sort((a, b) => b - a));
    expect((await source.searchIssues('is:closed reason:"not planned"', 1)).items.map((i) => i.number)).toEqual([458]);
    expect((await source.searchIssues('nosuchword', 1)).items).toEqual([]);
    expect((await source.searchIssues('rolled-back', 1)).items.map((i) => i.number)).toEqual([489]);
  });
  it('edits labels, milestones and reactions', async () => {
    const { source } = orbit();
    await source.createLabel({ name: 'urgent', color: '#ff0000', description: 'Now' });
    expect((await source.labels()).find((l) => l.name === 'urgent')?.color).toBe('#ff0000');
    await expect(source.createLabel({ name: 'urgent', color: 'ff0000' })).rejects.toMatchObject({ kind: 'validation' });
    await source.updateIssue(489, { labels: ['urgent'] });
    await source.updateLabel('urgent', { name: 'now', color: '00ff00' });
    expect((await source.issue(489)).labels[0].name).toBe('now');
    await source.deleteLabel('now');
    expect((await source.issue(489)).labels).toEqual([]);
    const m = await source.createMilestone({ title: 'v9', description: 'later' });
    await source.updateIssue(489, { milestone: m });
    expect((await source.milestone(m)).open).toBe(1);
    await source.updateMilestone(m, { state: 'closed' });
    expect((await source.milestones('closed')).some((x) => x.number === m)).toBe(true);
    await source.deleteMilestone(m);
    expect((await source.issue(489)).milestone).toBeUndefined();
    const target = { kind: 'issue', number: 489 } as const;
    await source.react(target, 'heart');
    const mine = await source.myReactions(target);
    expect(mine.heart).toBeGreaterThan(0);
    expect((await source.issue(489)).reactions.heart).toBe(1);
    await source.unreact(target, mine.heart!);
    expect((await source.issue(489)).reactions.heart).toBeUndefined();
  });
  it('enforces roles and locks', async () => {
    const reader = orbit({ role: 'read' }).source;
    const n = await reader.createIssue({ title: 'From a reader', body: '', labels: ['bug'], assignees: ['you'] });
    const mine = await reader.issue(n);
    // GitHub silently drops labels and assignees from people without triage.
    expect(mine.labels).toEqual([]);
    await reader.updateIssue(n, { title: 'Own issues can be edited' });
    await expect(reader.updateIssue(489, { title: 'Not mine' })).rejects.toMatchObject({ kind: 'forbidden' });
    await expect(reader.comment(458, 'locked out')).rejects.toMatchObject({ kind: 'forbidden' });
    const admin = orbit().source;
    await admin.comment(458, 'admins can still comment');
    await admin.unlock(458);
    expect((await admin.issue(458)).locked).toBe(false);
    await admin.lock(458, 'resolved');
    expect((await admin.issue(458)).lockReason).toBe('resolved');
  });
  it('refuses writes to an archived repository', async () => {
    const { gh } = orbit();
    const legacy = githubRepo(gh, 'acme/orbit-legacy', { live: false });
    expect((await legacy.repo()).archived).toBe(true);
    await expect(legacy.comment(1, 'hello')).rejects.toBeInstanceOf(GitHubError);
    await expect(legacy.createIssue({ title: 't', body: '', labels: [], assignees: [] })).rejects.toMatchObject({ kind: 'forbidden' });
  });
  it('pins, subscribes and deletes through GraphQL', async () => {
    const { source } = orbit();
    const extras = (await source.issueExtras(487))!;
    expect(extras.pinned).toBe(false);
    await source.setPinned(extras.id, 487, true);
    expect((await source.issueExtras(487))!.pinned).toBe(true);
    await source.setThreadSubscribed(extras.id, 487, true);
    expect((await source.issueExtras(487))!.subscribed).toBe(true);
    await source.deleteIssue(extras.id, 487);
    await expect(source.issue(487)).rejects.toMatchObject({ kind: 'notFound' });
  });
});

describe('pull requests', () => {
  it('computes mergeability from real branches', async () => {
    const { source } = orbit();
    const state = async (n: number) => (await source.pull(n)).mergeable;
    expect(await state(488)).toBe('clean');
    expect(await state(484)).toBe('blocked'); // Changes requested.
    expect(await state(481)).toBe('blocked'); // No approval yet.
    expect(await state(479)).toBe('dirty');
    expect(await state(478)).toBe('behind');
    expect(await state(486)).toBe('draft');
  });
  it('shows each pull request its own commits and files', async () => {
    const { source } = orbit();
    expect((await source.pullCommits(488)).length).toBe(4);
    expect((await source.pullFiles(488)).map((f) => f.path)).toEqual(['docs/retries.md', 'src/retry.ts', 'test/retry.test.ts']);
    expect((await source.pullFiles(481)).map((f) => f.path)).toEqual(['docs/prisma.md']);
    const p = await source.pull(481);
    expect(p.changedFiles).toBe(1);
    expect(p.commits).toBe(1);
    await expect(source.pull(99999)).rejects.toMatchObject({ kind: 'notFound' });
  });
  it('merges by each method, closes linked issues, and refuses when it should', async () => {
    const { source } = orbit();
    await expect(source.merge(479, { method: 'merge' })).rejects.toMatchObject({ status: 405 });
    await expect(source.merge(486, { method: 'merge' })).rejects.toMatchObject({ status: 405 });
    await expect(source.merge(481, { method: 'merge' })).rejects.toMatchObject({ status: 405 });
    await expect(source.merge(488, { method: 'merge', sha: 'stale' })).rejects.toMatchObject({ status: 409 });
    await source.merge(488, { method: 'squash', title: 'Jitter (#488)', message: 'Closes #483' });
    const p = await source.pull(488);
    expect(p.state).toBe('merged');
    expect(p.mergeSha).toBeTruthy();
    expect((await source.issue(483)).state).toBe('closed');
    expect(await source.file('src/retry.ts', '')).toContain('applyJitter');
    expect((await source.lastCommit('', ''))?.message).toBe('Jitter (#488)');
    expect((await source.searchPulls('is:merged', 1)).items.some((x) => x.number === 488)).toBe(true);
    // The merged diff doesn't vanish.
    expect((await source.pullFiles(488)).length).toBe(3);
    await source.deleteBranch('feat/retry-jitter');
    expect((await source.pull(488)).headDeleted).toBe(true);
  });
  it('honors allowed merge methods', async () => {
    const { source } = orbit();
    await source.update({ allow_merge_commit: false });
    await expect(source.merge(488, { method: 'merge' })).rejects.toMatchObject({ status: 405 });
    await source.merge(488, { method: 'rebase' });
    expect((await source.pull(488)).state).toBe('merged');
  });
  it('updates a branch that is behind, closes and reopens, flips draft', async () => {
    const { source } = orbit();
    await source.updateBranch(478);
    expect((await source.pull(478)).mergeable).toBe('clean');
    await source.updatePull(481, { state: 'closed' });
    expect((await source.pull(481)).state).toBe('closed');
    await source.updatePull(481, { state: 'open' });
    expect((await source.pull(481)).state).toBe('open');
    const draft = await source.pull(486);
    await source.setDraft(draft.nodeId, 486, false);
    expect((await source.pull(486)).state).toBe('open');
    await source.setDraft(draft.nodeId, 486, true);
    expect((await source.pull(486)).state).toBe('draft');
    await source.setAutoMerge(draft.nodeId, 486, 'squash');
    expect((await source.pull(486)).autoMerge?.method).toBe('squash');
  });
  it('creates a pull request from a new branch and refuses duplicates', async () => {
    const { source } = orbit();
    await source.createBranch('feat/x', 'main');
    await expect(source.createPull({ title: 't', body: '', head: 'feat/x', base: 'main', draft: false })).rejects.toMatchObject({ kind: 'validation' });
    await source.putFile({ path: 'x.txt', content: 'x\n', message: 'add x', branch: 'feat/x' });
    const n = await source.createPull({ title: 'Add x', body: 'Closes #485', head: 'feat/x', base: 'main', draft: true });
    expect((await source.pull(n)).state).toBe('draft');
    expect((await source.pullExtras(n))?.closes.map((c) => c.number)).toEqual([485]);
    await expect(source.createPull({ title: 't', body: '', head: 'feat/x', base: 'main', draft: false })).rejects.toThrow(/already exists/);
    await source.putFile({ path: 'y.txt', content: 'y\n', message: 'add y', branch: 'feat/x' });
    expect((await source.pullCommits(n)).length).toBe(2);
  });
  it('opens a pull request from a fork across repositories', async () => {
    const { gh } = orbit();
    const hello = githubRepo(gh, 'octo/hello-world', { live: false });
    const forkName = await hello.fork({});
    const fork = githubRepo(gh, forkName, { live: false });
    await fork.createBranch('patch-1', 'main');
    await fork.putFile({ path: 'CONTRIB.md', content: 'hi\n', message: 'add contrib', branch: 'patch-1' });
    const cmp = await hello.compare('main', 'you:patch-1');
    expect(cmp.ahead).toBe(1);
    const n = await hello.createPull({ title: 'From a fork', body: '', head: 'you:patch-1', base: 'main', draft: false });
    const p = await hello.pull(n);
    expect(p.fromFork).toBe(true);
    expect(p.headRepo).toBe('you/hello-world');
    expect((await hello.pullFiles(n)).map((f) => f.path)).toEqual(['CONTRIB.md']);
    // You can open it but not merge it without write access.
    await expect(hello.merge(n, { method: 'merge' })).rejects.toMatchObject({ kind: 'forbidden' });
  });
  it('reviews: threads, pending comments, submitting, resolving', async () => {
    const { source } = orbit();
    const threads = (await source.pullThreads(488)) as PullThreads;
    expect(threads.threads.length).toBe(2);
    expect(threads.threads[0].resolved).toBe(true);
    expect(threads.threads[0].comments.length).toBe(2);
    await source.setThreadResolved(threads.threads[1].id, 488, true);
    expect(((await source.pullThreads(488)) as PullThreads).threads[1].resolved).toBe(true);
    const sha = (await source.pull(488)).headSha;
    await source.addPendingComment(488, { path: 'src/retry.ts', line: 8, side: 'RIGHT', body: 'first' }, sha);
    await source.addPendingComment(488, { path: 'src/retry.ts', line: 9, side: 'RIGHT', body: 'second' }, sha);
    const pending = ((await source.pullThreads(488)) as PullThreads).pending!;
    expect(pending.count).toBe(2);
    await source.submitReview(488, { event: 'REQUEST_CHANGES', body: 'See comments', pendingId: pending.id, headSha: sha });
    expect(((await source.pullThreads(488)) as PullThreads).pending).toBeNull();
    const p = await source.pull(488);
    expect(p.review).toBe('changes');
    expect(p.mergeable).toBe('blocked');
    await source.dismissReview(488, p.reviewers.find((x) => x.user.login === 'you')!.reviewId!, 'never mind');
    expect((await source.pull(488)).mergeable).toBe('clean');
    const t = ((await source.pullThreads(488)) as PullThreads).threads[1];
    await source.replyToThread(488, t.comments[0].id, 'a reply');
    expect(((await source.pullThreads(488)) as PullThreads).threads[1].comments.length).toBe(2);
    await source.addReviewComment(488, { path: 'docs/retries.md', line: 9, side: 'RIGHT', body: 'one-off' }, sha);
    expect(((await source.pullThreads(488)) as PullThreads).threads.length).toBe(5);
    await expect(source.addReviewComment(488, { path: 'nope.ts', line: 3, side: 'RIGHT', body: 'x' }, sha)).rejects.toMatchObject({ kind: 'validation' });
  });
  it('discards a pending review', async () => {
    const { source } = orbit();
    const sha = (await source.pull(488)).headSha;
    await source.addPendingComment(488, { path: 'src/retry.ts', line: 8, side: 'RIGHT', body: 'hm' }, sha);
    const pending = ((await source.pullThreads(488)) as PullThreads).pending!;
    await source.discardReview(488, pending.id);
    const after = (await source.pullThreads(488)) as PullThreads;
    expect(after.pending).toBeNull();
    expect(after.threads.length).toBe(2);
  });
  it('refuses to let you review your own pull request', async () => {
    const { source } = orbit();
    await source.createBranch('mine', 'main');
    await source.putFile({ path: 'm.txt', content: 'm\n', message: 'm', branch: 'mine' });
    const n = await source.createPull({ title: 'Mine', body: '', head: 'mine', base: 'main', draft: false });
    await expect(source.submitReview(n, { event: 'APPROVE', body: '', headSha: (await source.pull(n)).headSha })).rejects.toThrow(/own pull request/);
  });
  it('fills list rows with review and check state', async () => {
    const { source } = orbit();
    const rows = (await source.searchPulls('is:open', 1)).items;
    const row = (n: number) => rows.find((p) => p.number === n)!;
    expect(row(488).checks).toBe('success');
    expect(row(488).review).toBe('approved');
    expect(row(484).checks).toBe('failure');
    expect(row(484).review).toBe('changes');
    expect(row(486).checks).toBe('pending');
    expect(row(486).review).toBe('draft');
    expect(row(488).head).toBe('feat/retry-jitter');
  });
  it('marks files viewed', async () => {
    const { source } = orbit();
    const p = await source.pull(488);
    expect((await source.pullExtras(488))?.viewed).toEqual(['test/retry.test.ts']);
    await source.setFileViewed(p.nodeId, 488, 'src/retry.ts', true);
    expect((await source.pullExtras(488))?.viewed).toContain('src/retry.ts');
  });
});

describe('actions', () => {
  it('filters and pages runs', async () => {
    const { source } = orbit();
    const all = await source.runs({});
    expect(all.total).toBeGreaterThan(25);
    expect(all.hasNext).toBe(true);
    expect((await source.runs({ status: 'failure' })).items.every((r) => r.status === 'failure')).toBe(true);
    expect((await source.runs({ workflow: 102 })).items.every((r) => r.workflow === 'Release')).toBe(true);
    expect((await source.runs({ branch: 'main', event: 'push', actor: 'jonasw' })).items.every((r) => r.actor.login === 'jonasw')).toBe(true);
  });
  it('re-runs, cancels and deletes', async () => {
    const { source } = orbit();
    const failed = await source.run(5001);
    expect(failed.status).toBe('failure');
    expect(failed.hasFailed).toBe(true);
    expect(failed.jobs[0].steps.length).toBeGreaterThan(1);
    await source.rerun(5001, true);
    expect((await source.run(5001)).status).toBe('success');
    await source.cancelRun(5002);
    expect((await source.run(5002)).status).toBe('cancelled');
    await source.deleteRun(5002);
    await expect(source.run(5002)).rejects.toMatchObject({ kind: 'notFound' });
    expect(await source.jobLog(failed.jobs[0].id)).toContain('Run');
  });
  it('reads dispatch inputs from the workflow file and dispatches', async () => {
    const { source } = orbit();
    const wf = (await source.workflows()).find((w) => w.name === 'Release')!;
    const { dispatchable, inputs } = await source.workflowInputs(wf.path, '');
    expect(dispatchable).toBe(true);
    expect(inputs.map((i) => i.name)).toEqual(['version', 'dry_run']);
    expect(inputs[0].options).toEqual(['patch', 'minor', 'major']);
    expect(inputs[1].type).toBe('boolean');
    const before = (await source.runs({ workflow: wf.id })).total!;
    await source.dispatch(wf.id, 'main', { version: 'minor', dry_run: 'false' });
    expect((await source.runs({ workflow: wf.id })).total).toBe(before + 1);
    const ci = (await source.workflows()).find((w) => w.name === 'CI')!;
    expect((await source.workflowInputs(ci.path, '')).dispatchable).toBe(false);
    await expect(source.dispatch(ci.id, 'main', {})).rejects.toMatchObject({ kind: 'validation' });
    await source.setWorkflowEnabled(wf.id, false);
    expect((await source.workflows()).find((w) => w.id === wf.id)!.active).toBe(false);
  });
});

describe('releases and insights', () => {
  it('creates, edits and deletes a release', async () => {
    const { source } = orbit();
    const list = await source.releases(1);
    expect(list.items.find((r) => r.tag === 'v3.2.0')?.latest).toBe(true);
    const notes = await source.generateNotes('v3.3.0', 'main');
    expect(notes.body).toContain('What');
    const tag = await source.createRelease({ tag: 'v3.3.0', name: 'v3.3.0', body: notes.body, draft: false, prerelease: false, target: 'main' });
    expect(tag).toBe('v3.3.0');
    expect((await source.refNames()).tags).toContain('v3.3.0');
    const r = await source.release('v3.3.0');
    expect(r.latest).toBe(true);
    await source.updateRelease(r.id, { name: 'Renamed' });
    expect((await source.release('v3.3.0')).name).toBe('Renamed');
    await source.deleteRelease(r.id);
    await expect(source.release('v3.3.0')).rejects.toMatchObject({ kind: 'notFound' });
  });
  it('computes statistics; traffic needs push access', async () => {
    const { source } = orbit();
    const contributors = await source.contributorStats();
    if (contributors === 'computing') throw new Error('computing');
    expect(contributors[0].commits).toBeGreaterThan(0);
    const activity = await source.commitActivity();
    if (activity === 'computing') throw new Error('computing');
    expect(activity.length).toBe(52);
    expect((await source.traffic())?.viewsTotal).toBeGreaterThan(0);
    expect(await orbit({ role: 'read' }).source.traffic()).toBeNull();
  });
  it('searches code', async () => {
    const { source } = orbit();
    const hits = await source.searchCode('SKIP LOCKED');
    expect(hits.items.map((h) => h.path)).toContain('src/adapters/postgres.ts');
    expect(hits.items[0].fragment).toBeTruthy();
  });
});

describe('the client', () => {
  it('re-reads after a write and tells subscribers', async () => {
    const { gh, source } = orbit();
    let told = 0;
    const off = gh.subscribe(() => told++);
    await source.issue(489);
    await source.updateIssue(489, { title: 'Changed' });
    expect(told).toBeGreaterThan(0);
    expect((await source.issue(489)).title).toBe('Changed');
    off();
  });
  it('explains failures by kind and keeps going', async () => {
    const { server, source } = orbit();
    server.fail(/PATCH \/repos\/acme\/orbit\/issues\/489/, 403, 'Resource not accessible by integration');
    await expect(source.updateIssue(489, { title: 'x' })).rejects.toMatchObject({ kind: 'forbidden', message: 'Resource not accessible by integration' });
    server.fail(/POST \/repos\/acme\/orbit\/issues/, 403, 'API rate limit exceeded', { 'x-ratelimit-remaining': '0' });
    await expect(source.createIssue({ title: 't', body: '', labels: [], assignees: [] })).rejects.toMatchObject({ kind: 'rateLimit' });
    await expect(source.createIssue({ title: '', body: '', labels: [], assignees: [] })).rejects.toMatchObject({ kind: 'validation' });
    await expect(source.createIssue({ title: 'works now', body: '', labels: [], assignees: [] })).resolves.toBeGreaterThan(0);
  });
  it('has no account when signed out', async () => {
    const { source } = orbit({ viewer: null });
    expect(await source.viewer()).toBeNull();
    await expect(source.comment(489, 'hi')).rejects.toMatchObject({ kind: 'auth' });
    expect((await source.issue(489)).number).toBe(489);
  });
});

describe('code that writes where it means to', () => {
  it('renames a file in one commit, and refuses if it moved on', async () => {
    const { source } = orbit();
    const sha = await source.fileSha('docs/adapters.md', '');
    const before = (await source.commits({ ref: '', page: 1 })).items[0].fullSha;
    await source.moveFile({ from: 'docs/adapters.md', to: 'docs/backends.md', content: '# Backends\n', message: 'docs: rename', branch: 'main', sha });
    expect(await source.file('docs/backends.md', '')).toBe('# Backends\n');
    await expect(source.file('docs/adapters.md', '')).rejects.toMatchObject({ kind: 'notFound' });
    const log = (await source.commits({ ref: '', page: 1 })).items;
    expect(log[0].message).toBe('docs: rename');
    expect(log[1].fullSha).toBe(before);
    await expect(source.moveFile({ from: 'docs/backends.md', to: 'x.md', content: 'x', message: 'y', branch: 'main', sha })).rejects.toMatchObject({ status: 409 });
  });
  it('uploads several files in one commit, bytes included', async () => {
    const { source } = orbit();
    const png = btoa(String.fromCharCode(137, 80, 78, 71, 0, 1, 255));
    await source.commitFiles({ files: [{ path: 'a/one.txt', base64: btoa('one\n') }, { path: 'a/logo.png', base64: png }], message: 'Add files', branch: 'main' });
    expect(await source.file('a/one.txt', '')).toBe('one\n');
    expect(await source.file('a/logo.png', '')).toBeNull();
    expect((await source.commits({ ref: '', page: 1 })).items[0].message).toBe('Add files');
  });
  it('marks a thread outdated once its line changes, and keeps what it was made on', async () => {
    const { source } = orbit();
    const thread = async () => (await source.pullThreads(484) as PullThreads).threads[0];
    const t = await thread();
    expect(t.outdated).toBe(false);
    expect(t.line).toBe(3);
    expect(t.hunk.split('\n').at(-1)).toBe('+export function Timeline({ job }) {');
    const sha = await source.fileSha('src/dashboard/timeline.tsx', 'dash/attempts');
    await source.putFile({ path: 'src/dashboard/timeline.tsx', content: '// new first line\n' + await source.file('src/dashboard/timeline.tsx', 'dash/attempts'), message: 'shift', branch: 'dash/attempts', sha });
    const after = await thread();
    expect(after.outdated).toBe(true);
    expect(after.line).toBeNull();
    expect(after.originalLine).toBe(3);
    expect(after.hunk).toBe(t.hunk);
  });
  it('refuses a comment off the diff, an invalid branch, a path under a file', async () => {
    const { source } = orbit();
    const head = (await source.pull(488)).headSha;
    await expect(source.addReviewComment(488, { path: 'src/retry.ts', line: 9999, side: 'RIGHT', body: 'x' }, head)).rejects.toThrow(/part of the diff/);
    await expect(source.createBranch('bad name..~', 'main')).rejects.toMatchObject({ kind: 'validation' });
    await expect(source.putFile({ path: 'README.md/x.txt', content: 'x', message: 'x', branch: 'main' })).rejects.toThrow(/file/);
  });
  it('comments on commits, re-runs one job, lists artifacts, makes a tag, reverts', async () => {
    const { source } = orbit();
    const head = (await source.commits({ ref: '', page: 1 })).items[0].fullSha;
    await source.addCommitComment(head, 'Nice');
    const [c] = await source.commitComments(head) as { id: number; body: string }[];
    expect(c.body).toBe('Nice');
    await source.editComment({ kind: 'commitComment', id: c.id }, 'Nicer');
    expect((await source.commitComments(head) as { body: string }[])[0].body).toBe('Nicer');
    await source.deleteComment({ kind: 'commitComment', id: c.id }, 0);
    expect(await source.commitComments(head)).toEqual([]);
    const failed = await source.run(5001);
    await source.rerunJob(failed.jobs[0].id);
    expect((await source.run(5001)).status).toBe('success');
    expect((await source.artifacts(5003)).map((a) => a.name)).toEqual(['coverage-report', 'dist']);
    await source.createTag('v9', head);
    expect((await source.refNames()).tags).toContain('v9');
    const p = await source.pull(473);
    const before = await source.file('src/adapters/postgres.ts', '');
    const n = await source.revert(p.nodeId, 473, 'Revert it');
    const files = await source.pullFiles(n);
    expect(files.map((f) => f.path)).toEqual(['src/adapters/postgres.ts']);
    expect(await source.file('src/adapters/postgres.ts', (await source.pull(n)).head)).not.toBe(before);
    await expect(source.revert(p.nodeId, 473, 'Again')).rejects.toThrow(/already exists/);
  });
  it('knows which pull requests close an issue, and reads templates and forms', async () => {
    const { source } = orbit();
    expect((await source.issueExtras(483))?.closedBy.map((p) => p.number)).toEqual([488]);
    const templates = await source.issueTemplates();
    expect(templates.map((t) => t.name).sort()).toEqual(['Bug report', 'Feature request']);
    const form = templates.find((t) => t.name === 'Feature request')!;
    expect(form).toMatchObject({ title: 'Feature: ', labels: ['enhancement'] });
    expect(form.body).toContain('### What problem does this solve?');
    expect(form.body).toContain('- [ ] I searched existing issues');
    expect(await source.pullTemplate()).toContain('How it was tested');
  });
});

describe('tasks', () => {
  const list = '- [x] done\n- [ ] todo\n\n```\n- [ ] in a fence\n```\n\n    - [ ] indented code\n\n> - [ ] quoted\n\n- parent\n    - [ ] nested\n';
  it('finds the tasks a renderer would, and only those', () => {
    expect(taskPositions(list).map((t) => t.checked)).toEqual([true, false, false, false]);
  });
  it('flips exactly the one asked for', () => {
    expect(toggleTask(list, 1)).toContain('- [x] todo');
    expect(toggleTask(list, 0)).toContain('- [ ] done');
    expect(toggleTask(list, 2)).toContain('> - [x] quoted');
    expect(toggleTask(list, 2)).toContain('    - [ ] indented code');
    expect(toggleTask(list, 3)).toContain('    - [x] nested');
    expect(toggleTask(list, 9)).toBeNull();
  });
  it('tells code from prose for autocomplete', () => {
    expect(inCode('```\nconst a = ')).toBe(true);
    expect(inCode('```\ncode\n```\nthanks ')).toBe(false);
    expect(inCode('run `foo ')).toBe(true);
    expect(inCode('run `foo` then ')).toBe(false);
    expect(inCode('    indented ')).toBe(true);
  });
});

describe('routes', () => {
  it('round-trips every kind of address', () => {
    for (const path of ['issues/12', 'pull/5', 'pull/5/files', 'commit/abc1234', 'blob/main/src/a.ts#L3-L9', 'blame/main/src/a.ts', 'commits/main/src/a.ts', 'releases/tag/v1', 'actions/runs/9', 'settings/merging', 'compare/main...x', 'upload/main/docs', 'milestone/2', 'graphs/traffic']) {
      const r = fromPath(path);
      expect(r, path).not.toBeNull();
      expect(toPath(r!), path).toBe(path);
    }
    expect(fromPath('wiki/Home')).toBeNull();
  });
  it('accepts only real repository input', () => {
    expect(repoFromInput('acme/orbit')).toBe('acme/orbit');
    expect(repoFromInput('https://github.com/acme/orbit/pull/4')).toBe('acme/orbit');
    for (const bad of ['https://gitlab.com/foo/bar', '../..', 'a/b/c', 'foo']) expect(repoFromInput(bad), bad).toBeNull();
  });
});

describe('suggestions', () => {
  it('replaces lines, and an empty suggestion deletes them', () => {
    expect(applyLines('a\nb\nc\n', 2, 2, 'B\n')).toBe('a\nB\nc\n');
    expect(applyLines('a\nb\nc\n', 1, 2, 'x\ny\nz')).toBe('x\ny\nz\nc\n');
    expect(applyLines('a\nb\nc\n', 2, 2, '')).toBe('a\nc\n');
  });
  it('reads what a comment was made on from the end of its hunk', () => {
    expect(reviewedLines('@@ -1,2 +1,3 @@\n a\n-old\n+b\n+c', 2)).toEqual(['b', 'c']);
    expect(reviewedLines('@@ -1 +1 @@\n a', 5)).toBeNull();
  });
  it('reads suggestion fences', () => {
    expect(suggestionOf('Try:\n```suggestion\nfoo\n```')).toBe('foo\n');
    expect(suggestionOf('```suggestion\n```')).toBe('');
    expect(suggestionOf('no')).toBeNull();
  });
});

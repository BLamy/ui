/* The sample data: acme/orbit, an invented job queue, as sample-server.ts holds it, plus a few smaller repositories that
   show the other states a repository can be in (one you can only read, an archived one, an empty one, a private one).
   Nothing here is written down as a screen would show it: histories are real commits, diffs and blame are computed from
   them, list counts are what's in the lists. Every time is relative to one fixed moment, so runs are deterministic. */
import { GitStore, type GitCommit } from './sample-git';
import {
  ADAPTERS_MD, ADAPTER_TYPES_TS, CHANGELOG_MD, CI_YML, CODEQL_YML, CREATE_QUEUE_TS, DOCS_PREVIEW_YML, EXPRESS_EXAMPLE_TS, GETTING_STARTED_MD, GITIGNORE, INDEX_TS, LICENSE, MEMORY_TS, NEXT_EXAMPLE_TS,
  PACKAGE_JSON, POSTGRES_TS, QUEUE_TEST_TS, QUEUE_TS, README, RELEASE_YML, RETRIES_JITTER_MD, RETRIES_MD, RETRY_JITTER_TS, RETRY_TEST_JITTER_TS, RETRY_TEST_TS, RETRY_TS, TSCONFIG_JSON,
} from './sample-files';
import {
  blankRepo, type Role, type ServerCheck, type ServerComment, type ServerEvent, type ServerIssue, type ServerJob, type ServerPull, type ServerRepo, type ServerReview, type ServerReviewComment, type ServerRun, type ServerSeed, type ServerStep, type ServerUser, type ServerWorkflow,
} from './sample-server';

/** The fixed "now" the sample lives at. */
export const SAMPLE_NOW = '2026-09-25T12:00:00.000Z';
export const SAMPLE_VIEWER = 'you';
const NOW = Date.parse(SAMPLE_NOW);
const hours = (n: number) => new Date(NOW - n * 3600_000).toISOString();
const days = (n: number) => hours(n * 24);

const USERS: ServerUser[] = [
  { login: 'you', name: 'Alex Rivera', email: 'alex@acme.dev', bio: 'Platform at Acme.' },
  { login: 'maya-chen', name: 'Maya Chen', email: 'maya@acme.dev', bio: 'Maintainer of Orbit.' },
  { login: 'jonasw', name: 'Jonas Weber', email: 'jonas@acme.dev' },
  { login: 'priya-r', name: 'Priya Raman', email: 'priya@acme.dev' },
  { login: 'leodm', name: 'Leo Dumont', email: 'leo@example.org' },
  { login: 'samokafor', name: 'Sam Okafor', email: 'sam@example.org' },
  { login: 'avakim', name: 'Ava Kim', email: 'ava@example.org' },
  { login: 'orbit-bot', name: 'Orbit Bot', email: 'bot@acme.dev' },
  { login: 'octo', name: 'Octo Cat', email: 'octo@example.org' },
  { login: 'mona', name: 'Mona Lisa', email: 'mona@example.org' },
];
const person = (login: string) => {
  const u = USERS.find((x) => x.login === login)!;
  return { name: u.name, email: u.email ?? `${login}@users.noreply.github.com`, login };
};

const LABELS = [
  { name: 'bug', color: 'd73a4a', description: "Something isn't working" },
  { name: 'enhancement', color: 'a2eeef', description: 'New feature or request' },
  { name: 'documentation', color: '0075ca', description: 'Improvements or additions to documentation' },
  { name: 'good first issue', color: '7057ff', description: 'Good for newcomers' },
  { name: 'help wanted', color: '008672', description: 'Extra attention is needed' },
  { name: 'performance', color: 'fbca04', description: 'Faster, leaner, cheaper' },
  { name: 'breaking change', color: 'b60205', description: 'Requires a major version bump' },
  { name: 'question', color: 'd876e3', description: 'Further information is requested' },
];

/* ── acme/orbit's history ── */

const FILES = {
  license: ['LICENSE', LICENSE], gitignore: ['.gitignore', GITIGNORE], tsconfig: ['tsconfig.json', TSCONFIG_JSON], pkg: ['package.json', PACKAGE_JSON], readme: ['README.md', README], changelog: ['CHANGELOG.md', CHANGELOG_MD],
  ci: ['.github/workflows/ci.yml', CI_YML], release: ['.github/workflows/release.yml', RELEASE_YML], codeql: ['.github/workflows/codeql.yml', CODEQL_YML], docsPreview: ['.github/workflows/docs-preview.yml', DOCS_PREVIEW_YML],
  adapters: ['docs/adapters.md', ADAPTERS_MD], started: ['docs/getting-started.md', GETTING_STARTED_MD], retries: ['docs/retries.md', RETRIES_MD], express: ['examples/express/index.ts', EXPRESS_EXAMPLE_TS], next: ['examples/nextjs/route.ts', NEXT_EXAMPLE_TS],
  memory: ['src/adapters/memory.ts', MEMORY_TS], postgres: ['src/adapters/postgres.ts', POSTGRES_TS], types: ['src/adapters/types.ts', ADAPTER_TYPES_TS], create: ['src/create-queue.ts', CREATE_QUEUE_TS], index: ['src/index.ts', INDEX_TS], queue: ['src/queue.ts', QUEUE_TS], retry: ['src/retry.ts', RETRY_TS],
  queueTest: ['test/queue.test.ts', QUEUE_TEST_TS], retryTest: ['test/retry.test.ts', RETRY_TEST_TS],
} as const;
type FileKey = keyof typeof FILES;

/** The first `n` lines of a file: how an earlier commit saw it. */
const head = (text: string, n: number) => text.split('\n').slice(0, n).join('\n') + '\n';
const lineCount = (text: string) => text.split('\n').length - 1;

interface Step { at: string; by: string; message: string; files: Partial<Record<FileKey, number | true>>; tag?: string }

/* Oldest first. `true` writes the file as it finally stands; a number writes that many of its lines (the file grows). */
const HISTORY: Step[] = [
  { at: days(720), by: 'maya-chen', message: 'Initial commit', files: { license: true, gitignore: true, readme: 8 } },
  { at: days(700), by: 'maya-chen', message: 'feat: Queue with typed jobs', files: { queue: 20, pkg: true, types: true } },
  { at: days(690), by: 'maya-chen', message: 'feat: postgres adapter', files: { postgres: 18, queue: 36 } },
  { at: days(650), by: 'jonasw', message: 'test: first queue test', files: { queueTest: true } },
  { at: days(600), by: 'maya-chen', message: 'feat: exponential retries', files: { retry: 16, queue: true } },
  { at: days(540), by: 'priya-r', message: 'feat: memory adapter', files: { memory: 12 } },
  { at: days(500), by: 'jonasw', message: 'docs: quick start in the README', files: { readme: 32 } },
  { at: days(420), by: 'maya-chen', message: 'ci: run tests on push', files: { ci: 18 } },
  { at: days(360), by: 'maya-chen', message: 'chore(release): v3.0.0', files: { changelog: 2 }, tag: 'v3.0.0' },
  { at: days(330), by: 'avakim', message: 'docs: getting started', files: { started: 6 } },
  { at: days(300), by: 'priya-r', message: 'test: deterministic memory adapter clock', files: { memory: true } },
  { at: days(270), by: 'samokafor', message: 'examples: express', files: { express: 8 } },
  { at: days(240), by: 'jonasw', message: 'docs: explain retries', files: { retries: 12 } },
  { at: days(210), by: 'orbit-bot', message: 'chore: bump postgres to 3.4', files: { pkg: true } },
  { at: days(150), by: 'maya-chen', message: 'chore: target es2022', files: { tsconfig: true } },
  { at: days(120), by: 'leodm', message: 'chore: ignore coverage output', files: { gitignore: true } },
  { at: days(95), by: 'jonasw', message: 'feat: typed job records', files: { types: true } },
  { at: days(70), by: 'maya-chen', message: 'chore(release): v3.1.0', files: { changelog: 6 }, tag: 'v3.1.0' },
  { at: days(45), by: 'maya-chen', message: 'feat: createQueue accepts a connection string', files: { create: true, index: 4 } },
  { at: days(36), by: 'orbit-bot', message: 'ci: publish with provenance', files: { release: true } },
  { at: days(30), by: 'priya-r', message: 'feat: CodeQL analysis on main', files: { codeql: true } },
  { at: days(24), by: 'avakim', message: 'feat: export fixed() retry policy', files: { retry: true, index: true, retryTest: true } },
  { at: days(21), by: 'jonasw', message: 'docs: explain maxDelay', files: { retries: true } },
  { at: days(16), by: 'samokafor', message: 'examples: bump express to v5', files: { express: true } },
  { at: days(14), by: 'jonasw', message: 'ci: run the test matrix on Postgres 16', files: { ci: true } },
  { at: days(13), by: 'priya-r', message: 'docs: docs preview on every push', files: { docsPreview: true } },
  { at: days(9), by: 'jonasw', message: 'perf: claim jobs with SKIP LOCKED (#465)', files: { postgres: 30 } },
  { at: days(8), by: 'avakim', message: 'examples: next.js route handler', files: { next: true } },
  { at: days(7), by: 'jonasw', message: 'docs: transactional enqueue example', files: { started: true } },
  { at: days(7) , by: 'maya-chen', message: 'chore(release): v3.2.0', files: { changelog: true }, tag: 'v3.2.0' },
  { at: hours(30), by: 'priya-r', message: 'test: cover LISTEN reconnect', files: { queueTest: true } },
];

/** Small real commits so the repository has enough history to page through. */
const FILLER = [
  'chore: tidy imports', 'docs: fix a broken link', 'chore: update dev dependencies', 'test: name the flaky cases', 'docs: reword the install section', 'chore: format with prettier', 'ci: cache pnpm store',
  'test: speed up the memory adapter tests', 'docs: add a contributing note', 'chore: drop an unused helper', 'ci: pin action versions', 'docs: note Node 20 as the minimum', 'test: add a retry smoke test', 'chore: sort package scripts',
  'docs: link the adapters page', 'chore: align tsconfig with the examples', 'test: check fixed() bounds', 'ci: fail fast on lint',
];

function buildOrbitGit(): { git: GitStore; shas: Record<string, string> } {
  const git = new GitStore();
  let files = new Map<string, string>();
  let tip: GitCommit | undefined;
  const shas: Record<string, string> = {};
  const commit = (at: string, by: string, message: string, next: Map<string, string>) => {
    tip = git.commit({ parents: tip ? [tip.sha] : [], message, author: person(by), date: at, files: next });
    files = next;
    return tip;
  };
  const write = (next: Map<string, string>, key: FileKey, how: number | true) => {
    const [path, text] = FILES[key];
    next.set(path, how === true ? text : head(text, Math.min(how, lineCount(text))));
  };
  let filler = 0;
  for (const [index, step] of HISTORY.entries()) {
    const next = new Map(files);
    for (const [key, how] of Object.entries(step.files) as [FileKey, number | true][]) write(next, key, how);
    commit(step.at, step.by, step.message, next);
    if (step.tag) git.tags.set(step.tag, tip!.sha);
    // Between the milestones above, every other gap gets a filler commit touching a scratch line in the docs.
    if (index % 2 === 0 && filler < FILLER.length) {
      const stamp = new Map(files);
      const text = stamp.get('NOTES.md') ?? '# Maintainer notes\n';
      stamp.set('NOTES.md', text + `- ${FILLER[filler]}\n`);
      const when = new Date(Date.parse(step.at) + 86400_000).toISOString();
      commit(when, ['leodm', 'jonasw', 'orbit-bot', 'priya-r'][filler % 4], FILLER[filler], stamp);
      filler++;
    }
  }
  git.branches.set('main', tip!.sha);
  shas.base = tip!.sha;
  return { git, shas };
}

const branchFrom = (git: GitStore, name: string, from: string, steps: { at: string; by: string; message: string; files: Record<string, string | null> }[]) => {
  let parent = git.commits.get(from)!;
  for (const s of steps) {
    const next = new Map(parent.files);
    for (const [path, text] of Object.entries(s.files)) {
      if (text === null) next.delete(path);
      else next.set(path, text);
    }
    parent = git.commit({ parents: [parent.sha], message: s.message, author: person(s.by), date: s.at, files: next });
  }
  git.branches.set(name, parent.sha);
  return parent;
};

/* ── Issues ── */
let commentIds = 100_000;
const comment = (user: string, at: string, body: string, reactions: [string, string][] = []): ServerComment => ({
  id: commentIds++, user, body, created_at: at, updated_at: at, reactions: reactions.map(([content, u]) => ({ id: commentIds++, content, user: u })),
});
const ev = (actor: string, at: string, event: string, extra: Partial<ServerEvent> = {}): ServerEvent => ({ id: commentIds++, actor, created_at: at, event, ...extra });
const labelEvent = (actor: string, at: string, name: string): ServerEvent => ev(actor, at, 'labeled', { label: { name, color: LABELS.find((l) => l.name === name)!.color } });

interface IssueSpec {
  n: number; title: string; by: string; at: string; labels?: string[]; assignees?: string[]; milestone?: number; body?: string; comments?: ServerComment[]; closed?: string; reason?: string; closedBy?: string; events?: ServerEvent[]; locked?: string; pinned?: boolean; reactions?: [string, string][];
}

const ISSUE_SPECS: IssueSpec[] = [
  {
    n: 489, title: 'Jobs enqueued inside a rolled-back transaction still wake idle workers', by: 'samokafor', at: hours(2), labels: ['bug'], assignees: ['maya-chen'], pinned: true, reactions: [['+1', 'avakim'], ['+1', 'jonasw'], ['eyes', 'maya-chen']],
    body: 'When a transaction that enqueued a job rolls back, the job is gone (good) but `pg_notify` already went out, so every idle worker wakes up and finds nothing.\n\n**Steps**\n\n1. `BEGIN`\n2. `queue.enqueue(job, payload, { tx })`\n3. `ROLLBACK`\n\n**Expected:** workers keep sleeping.\n\n**Actual:** all of them poll once. With a few hundred workers this is visible on the database.\n\nRelated to #483.',
    comments: [
      comment('maya-chen', hours(1.8), 'Thanks. `pg_notify` inside the transaction should only deliver on commit, so this might be the `insert` going through a different connection. @samokafor which adapter options are you using?'),
      comment('samokafor', hours(1.5), 'Plain `postgres()`. The `tx` is from `sql.begin`.', [['+1', 'maya-chen']]),
      comment('maya-chen', hours(1.2), 'That confirms it: line 12 in `src/adapters/postgres.ts` notifies on `sql`, not on `db`. I will send a fix.', [['heart', 'samokafor'], ['rocket', 'avakim']]),
      comment('avakim', hours(0.5), 'Happy to review once it is up.'),
    ],
    events: [labelEvent('maya-chen', hours(1.9), 'bug'), ev('maya-chen', hours(1.85), 'assigned', { assignee: 'maya-chen' })],
  },
  {
    n: 487, title: 'Support per-key rate limits (e.g. 10 jobs/min per tenant)', by: 'avakim', at: hours(26), labels: ['enhancement', 'help wanted'], milestone: 1, reactions: [['+1', 'jonasw'], ['+1', 'priya-r'], ['+1', 'samokafor'], ['hooray', 'leodm']],
    body: 'We run one queue per product and need to stop a noisy tenant from starving the rest.\n\n```ts\ndefineJob(\'sync\', handler, { rateLimit: { key: (job) => job.tenant, max: 10, per: \'1m\' } })\n```\n\nThoughts on where the counters should live?',
    comments: Array.from({ length: 12 }, (_, i) => comment(['jonasw', 'avakim', 'priya-r', 'maya-chen'][i % 4], hours(25 - i), ['A sliding window in Postgres would add a write per claim.', 'Could be a token bucket per key.', 'Fixed windows are probably fine for most people.', 'Agreed, start simple.'][i % 4])),
  },
  { n: 485, title: 'Document how to run Orbit alongside Prisma migrations', by: 'leodm', at: hours(50), labels: ['documentation', 'good first issue'], body: 'People keep asking whether Orbit\'s tables conflict with `prisma migrate`. A short page would help.', comments: [comment('jonasw', hours(48), 'PR #481 starts this.'), comment('leodm', hours(47), 'Nice, closing when it lands.')] },
  {
    n: 483, title: 'Retries fire in lockstep after an outage (thundering herd)', by: 'priya-r', at: hours(74), labels: ['bug', 'performance'], assignees: ['maya-chen', 'jonasw'], milestone: 1,
    body: 'After a database outage every failed job retries on the same schedule, so workers hammer the database in waves.\n\nWe need jitter on the exponential backoff.',
    comments: Array.from({ length: 7 }, (_, i) => comment(['maya-chen', 'jonasw', 'priya-r'][i % 3], hours(70 - i * 6), ['Graph attached in the incident doc.', 'Seen this in staging too.', 'Full jitter looks best in the simulations.'][i % 3])),
    events: [ev('jonasw', hours(60), 'cross-referenced', { source: 488 })],
  },
  { n: 480, title: 'Expose job attempt history in the dashboard', by: 'jonasw', at: days(5), labels: ['enhancement'], assignees: ['jonasw'], body: 'The dashboard only shows the latest attempt. PR #484 adds a timeline.' },
  { n: 477, title: 'Typo in getting-started: "enqueu" → "enqueue"', by: 'orbit-bot', at: days(7), labels: ['documentation', 'good first issue'], body: 'Found by the docs spell checker.', comments: [comment('leodm', days(6), 'I can take this one.')] },
  { n: 474, title: 'Drop Node 18 support in v4', by: 'maya-chen', at: days(8), labels: ['breaking change', 'question'], milestone: 2, body: 'Node 18 reached end of life. Dropping it lets us use `using` and native `fetch` everywhere. Any objections?', comments: Array.from({ length: 18 }, (_, i) => comment(['samokafor', 'avakim', 'priya-r', 'leodm', 'maya-chen'][i % 5], days(7.8 - i * 0.3), ['Fine by us.', 'We are still on 18 until December.', 'Could we wait for 4.1?', 'No objection.', 'Noted, thanks all.'][i % 5])) },
  { n: 472, title: 'SQLite adapter: busy timeout when two workers claim at once', by: 'leodm', at: days(14), labels: ['bug', 'help wanted'], assignees: ['priya-r'], body: 'Reproduces with `concurrency: 2` on the SQLite adapter. `SQLITE_BUSY` after about a minute.', comments: Array.from({ length: 5 }, (_, i) => comment(['priya-r', 'leodm'][i % 2], days(13 - i), ['Is WAL on?', 'Yes, WAL is on.'][i % 2])) },
  { n: 470, title: 'Postgres LISTEN connection is not re-established after failover', by: 'samokafor', at: days(9), labels: ['bug'], assignees: ['priya-r'], closed: hours(28), closedBy: 'priya-r', reason: 'completed', body: 'After a primary failover workers stop waking up until restarted.', comments: Array.from({ length: 9 }, (_, i) => comment(['priya-r', 'samokafor', 'jonasw'][i % 3], days(8.5 - i * 0.5), ['Reproduced.', 'Thanks for looking.', 'Should we add a heartbeat?'][i % 3])) },
  { n: 466, title: 'Add a `fixed()` retry policy', by: 'avakim', at: days(30), labels: ['enhancement', 'good first issue'], closed: days(24), closedBy: 'avakim', reason: 'completed', body: 'A constant delay is all some jobs need.', comments: Array.from({ length: 3 }, (_, i) => comment('avakim', days(29 - i), ['Taking this.', 'PR is up.', 'Merged, closing.'][i])) },
  { n: 461, title: 'Claim query does a sequential scan on large tables', by: 'priya-r', at: days(38), labels: ['performance'], assignees: ['jonasw'], closed: days(9), closedBy: 'jonasw', reason: 'completed', body: 'Above a million rows the claim query plans a seq scan.', comments: Array.from({ length: 6 }, (_, i) => comment(['jonasw', 'priya-r'][i % 2], days(35 - i * 2), ['A partial index should fix it.', 'Confirmed on a copy of production.'][i % 2])) },
  { n: 458, title: 'Add a Redis adapter', by: 'samokafor', at: days(60), labels: ['enhancement'], closed: days(58), closedBy: 'maya-chen', reason: 'not_planned', locked: 'too heated', body: 'Would be nice to have a Redis backend as well.', comments: [comment('maya-chen', days(58), 'The whole point of Orbit is not needing Redis, so this will not happen. Closing.')] },
];

/* More open issues, so filters and pages have something to work on. */
const MORE_ISSUES: [string, string[], string, string[]][] = [
  ['Dashboard: filter jobs by queue name', ['enhancement'], 'avakim', ['jonasw']],
  ['`queue.work()` swallows errors thrown in adapter.claim', ['bug'], 'samokafor', ['maya-chen']],
  ['Graceful shutdown waits forever on a stuck job', ['bug', 'help wanted'], 'leodm', []],
  ['Add an OpenTelemetry integration', ['enhancement'], 'jonasw', ['priya-r']],
  ['Cron: support time zones per schedule', ['enhancement', 'good first issue'], 'avakim', []],
  ['Docs: explain at-least-once delivery', ['documentation'], 'priya-r', []],
  ['Deduplicate jobs by key', ['enhancement'], 'samokafor', ['maya-chen']],
  ['Migrations fail on Postgres 12', ['bug', 'question'], 'leodm', []],
  ['`createQueue` should accept an existing pool', ['enhancement', 'good first issue'], 'jonasw', []],
  ['Memory adapter drops the payload on retry', ['bug'], 'avakim', ['priya-r']],
  ['Show queue depth as a Prometheus metric', ['enhancement', 'performance'], 'priya-r', []],
  ['Docs: self-hosting the dashboard', ['documentation', 'help wanted'], 'leodm', []],
  ['Retry policy per error type', ['enhancement'], 'samokafor', []],
  ['Type error when a job has no payload', ['bug', 'good first issue'], 'orbit-bot', ['jonasw']],
  ['Batch enqueue API', ['enhancement', 'performance'], 'maya-chen', ['maya-chen']],
  ['Dashboard is unreadable in dark mode', ['bug'], 'avakim', []],
  ['Add an example for Bun', ['documentation', 'good first issue'], 'leodm', []],
  ['Pause and resume a queue at runtime', ['enhancement'], 'jonasw', []],
  ['Warn when a job name is registered twice', ['enhancement', 'good first issue'], 'priya-r', []],
  ['Support `AbortSignal.timeout` for job deadlines', ['enhancement'], 'samokafor', ['maya-chen']],
  ['Flaky test: LISTEN reconnect under load', ['bug'], 'orbit-bot', ['priya-r']],
  ['Docs: comparison with pg-boss and Graphile Worker', ['documentation'], 'avakim', []],
];

const issueRow = (s: IssueSpec): ServerIssue => {
  const updated = [s.at, s.closed, ...(s.comments ?? []).map((c) => c.created_at)].filter(Boolean).map((x) => Date.parse(x!));
  const events = [...(s.events ?? [])];
  if (s.closed) events.push(ev(s.closedBy ?? s.by, s.closed, 'closed', { state_reason: s.reason ?? 'completed' }));
  if (s.locked) events.push(ev(s.closedBy ?? s.by, s.closed ?? s.at, 'locked', { lock_reason: s.locked }));
  return {
    number: s.n, title: s.title, body: s.body ?? '', state: s.closed ? 'closed' : 'open', state_reason: s.closed ? s.reason ?? 'completed' : null, user: s.by, created_at: s.at, updated_at: new Date(Math.max(...updated)).toISOString(),
    closed_at: s.closed ?? null, closed_by: s.closed ? s.closedBy ?? s.by : null, labels: s.labels ?? [], assignees: s.assignees ?? [], milestone: s.milestone ?? null, locked: !!s.locked, active_lock_reason: s.locked ?? null, comments: s.comments ?? [], events,
    reactions: (s.reactions ?? []).map(([content, user]) => ({ id: commentIds++, content, user })), pinned: s.pinned,
  };
};

const blankPull = (o: Partial<ServerPull> & { number: number; base: string; head: string }): ServerPull => ({
  draft: false, merged_at: null, merged_by: null, merge_commit_sha: null, requested_reviewers: [], requested_teams: [], reviews: [], review_comments: [], threads: [], maintainer_can_modify: true, auto_merge: null, viewed: [], ...o,
});

const review = (id: number, user: string, state: ServerReview['state'], at: string, sha: string, body = ''): ServerReview => ({ id, user, state, body, submitted_at: at, commit_id: sha });

const passing = (names: string[], at: string, run?: number): ServerCheck[] => names.map((name) => ({ name, status: 'completed', conclusion: 'success', started_at: new Date(Date.parse(at) - 110_000).toISOString(), completed_at: at, run }));

const steps = (names: string[], status: string, conclusion: string | null, at: string): ServerStep[] => names.map((name, i) => ({ number: i + 1, name, status, conclusion, started_at: at, completed_at: status === 'completed' ? at : null }));
const job = (id: number, name: string, status: string, conclusion: string | null, at: string, log?: string): ServerJob => ({
  id, name, status, conclusion, started_at: at, completed_at: status === 'completed' ? at : null, steps: steps(['Set up job', 'Run actions/checkout@v4', 'Install dependencies', `Run ${name}`, 'Complete job'], status, conclusion, at),
  log: log ?? `${at} ##[group]Run ${name}\n${at} pnpm ${name}\n${at} ${conclusion === 'failure' ? 'FAIL  test/queue.test.ts > Queue > runs a job it was given\n' + at + ' ##[error]Process completed with exit code 1.' : 'Done in 42s.'}\n`,
});

/* ── acme/orbit ── */
function orbit(role: Role): ServerRepo {
  const { git, shas } = buildOrbitGit();
  const main = shas.base;
  const orbitRepo = blankRepo('acme', 'orbit', {
    id: 7001, description: 'Type-safe background jobs for TypeScript, backed by Postgres. Retries, cron, rate limits and a tiny dashboard — no Redis required.', homepage: 'https://orbit.acme.dev', topics: ['typescript', 'postgres', 'job-queue', 'background-jobs', 'nodejs', 'cron'], default_branch: 'main', license: 'MIT License',
    created_at: days(720), pushed_at: hours(3), stars: 12_389, extra_forks: 840, extra_watchers: 180, git, labels: LABELS.map((l) => ({ ...l })), allow_auto_merge: true, delete_branch_on_merge: false,
    roles: { you: role, 'maya-chen': 'admin', jonasw: 'maintain', 'priya-r': 'write', leodm: 'triage', avakim: 'write', 'orbit-bot': 'write' },
    protection: { main: { required_reviews: 1, required_checks: ['CI / lint'] }, next: { required_reviews: 0, required_checks: [], strict: true } },
    stargazers: ['maya-chen', 'jonasw', 'priya-r', 'leodm', 'samokafor', 'avakim', 'octo', 'mona'], watchers: ['maya-chen', 'jonasw', 'priya-r', 'avakim', 'orbit-bot', 'leodm'],
    subscriptions: {},
    traffic: {
      views: [812, 790, 1033, 954, 1120, 640, 588, 880, 921, 1002, 1187, 1094, 702, 611], clones: [84, 76, 91, 102, 88, 40, 36, 77, 93, 96, 110, 83, 44, 39],
      referrers: [{ referrer: 'news.ycombinator.com', count: 2140, uniques: 1602 }, { referrer: 'google.com', count: 1320, uniques: 880 }, { referrer: 'github.com', count: 760, uniques: 402 }, { referrer: 'orbit.acme.dev', count: 510, uniques: 330 }],
      paths: [{ path: '/acme/orbit', title: 'acme/orbit', count: 5210, uniques: 2900 }, { path: '/acme/orbit/blob/main/docs/retries.md', title: 'orbit/docs/retries.md', count: 880, uniques: 610 }, { path: '/acme/orbit/issues', title: 'Issues · acme/orbit', count: 640, uniques: 420 }],
    },
  });

  /* Merged history: two pull requests already landed on main. */
  const fixHead = branchFrom(git, 'fix/listen-reconnect', main, [{ at: hours(32), by: 'priya-r', message: 'fix(postgres): reconnect LISTEN after failover', files: { 'src/adapters/postgres.ts': POSTGRES_TS } }]);
  const fixMerge = git.commit({ parents: [main, fixHead.sha], message: 'fix(postgres): reconnect LISTEN after failover (#473)\n\nCloses #470.', author: person('priya-r'), date: hours(28), files: fixHead.files });
  const docsBase = fixMerge.sha;
  const docsHead = branchFrom(git, 'docs/adapters', docsBase, [{ at: hours(5), by: 'avakim', message: 'docs: adapter comparison table', files: { 'docs/adapters.md': ADAPTERS_MD, 'README.md': README } }]);
  const docsMerge = git.commit({ parents: [docsBase, docsHead.sha], message: 'Merge pull request #476 from acme/docs/adapters\n\ndocs: adapter comparison table', author: person('jonasw'), date: hours(3), files: docsHead.files });
  git.branches.set('main', docsMerge.sha);
  git.branches.delete('docs/adapters');
  const tip = docsMerge.sha;

  /* Open branches. */
  const jitter = branchFrom(git, 'feat/retry-jitter', tip, [
    { at: hours(28), by: 'maya-chen', message: 'retry: add jitter strategies (full, equal, decorrelated)', files: { 'src/retry.ts': RETRY_JITTER_TS.replace('      return Math.min(delay, maxDelay)\n', '      return delay\n') } },
    { at: hours(26), by: 'maya-chen', message: 'retry: clamp jittered delays to maxDelay', files: { 'src/retry.ts': RETRY_JITTER_TS } },
    { at: hours(20), by: 'maya-chen', message: 'test: cover jitter bounds with a seeded rng', files: { 'test/retry.test.ts': RETRY_TEST_JITTER_TS } },
    { at: hours(6), by: 'maya-chen', message: 'docs: document the jitter option', files: { 'docs/retries.md': RETRIES_JITTER_MD } },
  ]);
  const notify = branchFrom(git, 'feat/sqlite-notify', tip, [{ at: hours(50), by: 'priya-r', message: 'sqlite: poll with a notify table', files: { 'src/adapters/sqlite.ts': `import type { Adapter } from './types'\n\n/** Polls a notify table: SQLite has no LISTEN. */\nexport function sqliteAdapter(path: string): Adapter {\n  throw new Error('not implemented: ' + path)\n}\n` } }]);
  const attempts = branchFrom(git, 'dash/attempts', tip, [
    { at: hours(76), by: 'jonasw', message: 'dashboard: attempt history API', files: { 'src/dashboard/attempts.ts': `import type { JobRecord } from '../adapters/types'\n\nexport function attemptsOf(job: JobRecord) {\n  return Array.from({ length: job.attempt }, (_, i) => ({ attempt: i + 1 }))\n}\n` } },
    { at: hours(10), by: 'jonasw', message: 'dashboard: timeline component', files: { 'src/dashboard/timeline.tsx': `import { attemptsOf } from './attempts'\n\nexport function Timeline({ job }) {\n  return <ol>{attemptsOf(job).map((a) => <li key={a.attempt}>Attempt {a.attempt}</li>)}</ol>\n}\n` } },
  ]);
  const prisma = branchFrom(git, 'docs/prisma', tip, [{ at: hours(98), by: 'leodm', message: 'docs: running Orbit alongside Prisma migrations', files: { 'docs/prisma.md': `# Orbit and Prisma\n\nOrbit keeps its tables in its own schema, so \`prisma migrate\` never sees them.\n\nAdd this to your \`schema.prisma\` if you introspect:\n\n\`\`\`prisma\n/// Orbit's tables are managed by Orbit.\n\`\`\`\n` } }]);
  const renameWork = branchFrom(git, 'refactor/work-options', tip, [{ at: hours(120), by: 'samokafor', message: 'refactor: work() takes a slots option', files: { 'src/queue.ts': QUEUE_TS.replace('async work({ concurrency = 4 } = {}) {\n    const slots = Array.from({ length: concurrency }, () => this.loop())', 'async work({ slots: count = 4 } = {}) {\n    const slots = Array.from({ length: count }, () => this.loop())') } }]);
  // Main moved under it: the same lines changed, so this one conflicts.
  branchFrom(git, 'main', tip, [{ at: hours(2.5), by: 'jonasw', message: 'perf: default to 8 workers', files: { 'src/queue.ts': QUEUE_TS.replace('async work({ concurrency = 4 } = {}) {', 'async work({ concurrency = 8 } = {}) {') } }]);
  branchFrom(git, 'next', tip, [{ at: hours(40), by: 'maya-chen', message: 'next: start v4', files: { 'CHANGELOG.md': CHANGELOG_MD.replace('# Changelog\n', '# Changelog\n\n## 4.0.0 (unreleased)\n') } }]);
  const dropNode = branchFrom(git, 'chore/drop-node-18', tip, [{ at: hours(45), by: 'maya-chen', message: 'chore: require Node 20', files: { 'package.json': PACKAGE_JSON.replace('"type": "module",', '"type": "module",\n  "engines": { "node": ">=20" },') } }]);
  git.branches.set('fix/listen-reconnect', fixHead.sha);
  branchFrom(git, 'spike/redis', tip, [{ at: days(30), by: 'samokafor', message: 'spike: a Redis adapter', files: { 'src/adapters/redis.ts': `// A spike, see #458.\nexport {}\n` } }]);

  /* Issues and pull requests. */
  const issues: ServerIssue[] = ISSUE_SPECS.map(issueRow);
  let n = 456;
  MORE_ISSUES.forEach(([title, labels, by, assignees], i) => {
    issues.push(issueRow({ n: n--, title, labels, by, assignees, at: days(16 + i * 2), body: `${title}.\n\nSee the discussion in #483 for context.`, comments: i % 3 === 0 ? [comment(assignees[0] ?? 'jonasw', days(15 + i * 2), 'Thanks for writing this up.')] : [], milestone: i % 5 === 0 ? 1 : i % 7 === 0 ? 2 : undefined }));
    n--; // Numbers skip like a real repository's do.
  });
  orbitRepo.milestones = [
    { number: 1, title: 'v3.3', description: 'Jitter, per-key rate limits and dashboard polish.', state: 'open', due_on: '2026-10-15T00:00:00Z', created_at: days(40), closed_at: null },
    { number: 2, title: 'v4.0', description: 'Node 20+, ESM only.', state: 'open', due_on: null, created_at: days(30), closed_at: null },
    { number: 3, title: 'v3.2', description: 'Shipped.', state: 'closed', due_on: days(7), created_at: days(90), closed_at: days(7) },
  ];
  for (const i of issues) orbitRepo.issues.set(i.number, i);
  // Closed issues that belong to the shipped milestone.
  orbitRepo.issues.get(461)!.milestone = 3;
  orbitRepo.issues.get(466)!.milestone = 3;
  orbitRepo.issues.get(470)!.milestone = 3;

  const pullIssue = (spec: IssueSpec) => orbitRepo.issues.set(spec.n, issueRow(spec));

  // #488: approved, passing, two inline threads (one resolved). The showcase.
  pullIssue({
    n: 488, title: 'Add exponential backoff with jitter to retries', by: 'maya-chen', at: hours(28), labels: ['enhancement', 'performance'], assignees: ['maya-chen'], milestone: 1,
    body: `Closes #483.

After an outage every failed job retries on the **same schedule**, so workers hammer the database in waves. This adds a \`jitter\` option to \`exponential()\`:

- \`'full'\` — random delay between 0 and the computed backoff (new default)
- \`'equal'\` — half fixed, half random
- \`'none'\` — the previous behaviour

\`\`\`ts
const policy = exponential({ baseDelay: 500, maxDelay: 30_000, jitter: 'full' })
\`\`\`

The random source is injectable, so tests stay deterministic.`,
    comments: [
      comment('maya-chen', hours(20), 'Good catch, clamped in `7b21e04` and added a property test that runs 10k attempts against the bounds.'),
      comment('priya-r', hours(4), 'Tried the branch against our staging outage replay — p99 DB CPU during recovery dropped from 94% to 38%.', [['rocket', 'maya-chen'], ['+1', 'jonasw']]),
    ],
    events: [labelEvent('jonasw', hours(27), 'enhancement'), labelEvent('jonasw', hours(27), 'performance'), ev('maya-chen', hours(27), 'review_requested', { reviewer: 'jonasw' })],
  });
  const jitterComments: ServerReviewComment[] = [
    { id: 300_001, review_id: 200_001, user: 'jonasw', body: 'Jitter can push this *above* `maxDelay` when `baseDelay` is large. Can we clamp after applying it?', path: 'src/retry.ts', line: 30, start_line: null, side: 'RIGHT', commit_id: jitter.parents[0], created_at: hours(22), updated_at: hours(22), thread: 400_001, reactions: [] },
    { id: 300_002, review_id: 200_002, user: 'maya-chen', body: 'Done in the next commit.', path: 'src/retry.ts', line: 30, start_line: null, side: 'RIGHT', commit_id: jitter.parents[0], created_at: hours(20), updated_at: hours(20), in_reply_to_id: 300_001, thread: 400_001, reactions: [['+1', 'jonasw']].map(([content, user]) => ({ id: commentIds++, content, user })) },
    { id: 300_003, review_id: 200_003, user: 'jonasw', body: 'Should `decorrelated` from the first commit message come back later? Worth a note in the docs.', path: 'docs/retries.md', line: 10, start_line: null, side: 'RIGHT', commit_id: jitter.sha, created_at: hours(5), updated_at: hours(5), thread: 400_002, reactions: [] },
  ];
  orbitRepo.pulls.set(488, blankPull({
    number: 488, base: 'main', head: 'feat/retry-jitter',
    reviews: [
      review(200_001, 'jonasw', 'COMMENTED', hours(22), jitter.parents[0], 'Nice — the herd graph from #483 flattens out completely with `\'full\'`.'),
      review(200_002, 'maya-chen', 'COMMENTED', hours(20), jitter.parents[0]),
      review(200_003, 'jonasw', 'APPROVED', hours(5), jitter.sha, 'LGTM. Let’s ship this in **v3.3** 🚀'),
    ],
    review_comments: jitterComments,
    threads: [{ id: 400_001, resolved: true, resolved_by: 'maya-chen' }, { id: 400_002, resolved: false, resolved_by: null }],
    requested_reviewers: ['priya-r'],
    viewed: ['test/retry.test.ts'],
  }));

  // #486: a draft with checks still running.
  pullIssue({ n: 486, title: 'SQLite: poll a notify table for instant wake-ups', by: 'priya-r', at: hours(50), labels: ['enhancement'], body: 'A notify table gives SQLite the same wake-ups Postgres gets from `LISTEN`.\n\n**Not ready yet:** the adapter is still a stub.', comments: [comment('maya-chen', hours(40), 'Looking forward to this one.')] });
  orbitRepo.pulls.set(486, blankPull({ number: 486, base: 'main', head: 'feat/sqlite-notify', draft: true }));

  // #484: changes requested, CI failing.
  pullIssue({ n: 484, title: 'Dashboard: show attempt history per job', by: 'jonasw', at: hours(76), labels: ['enhancement'], assignees: ['jonasw'], body: 'Closes #480.\n\nAdds an attempt timeline to the job page.', comments: Array.from({ length: 6 }, (_, i) => comment(['jonasw', 'maya-chen'][i % 2], hours(70 - i * 8), ['Pushed an update.', 'Still needs a test for the empty state.'][i % 2])) });
  orbitRepo.pulls.set(484, blankPull({
    number: 484, base: 'main', head: 'dash/attempts',
    reviews: [review(200_010, 'maya-chen', 'CHANGES_REQUESTED', hours(9), attempts.sha, 'The timeline needs an empty state and `Timeline`’s props need types.')],
    review_comments: [{ id: 300_010, review_id: 200_010, user: 'maya-chen', body: 'Type this prop: `{ job: JobRecord }`.', path: 'src/dashboard/timeline.tsx', line: 3, start_line: null, side: 'RIGHT', commit_id: attempts.sha, created_at: hours(9), updated_at: hours(9), thread: 400_010, reactions: [] }],
    threads: [{ id: 400_010, resolved: false, resolved_by: null }],
    requested_reviewers: ['priya-r'],
  }));

  // #481: clean, waiting for a first review. Mergeability says blocked until someone approves.
  pullIssue({ n: 481, title: 'docs: running Orbit alongside Prisma migrations', by: 'leodm', at: hours(98), labels: ['documentation'], body: 'Fixes #485.', comments: [comment('jonasw', hours(90), 'Thanks! I will read this tomorrow.')] });
  orbitRepo.pulls.set(481, blankPull({ number: 481, base: 'main', head: 'docs/prisma', requested_reviewers: ['jonasw'] }));

  // #479: conflicts with main.
  pullIssue({ n: 479, title: 'refactor: rename `concurrency` to `slots`', by: 'samokafor', at: hours(120), labels: ['breaking change'], milestone: 2, body: '`slots` matches the dashboard’s wording.' });
  orbitRepo.pulls.set(479, blankPull({ number: 479, base: 'main', head: 'refactor/work-options', reviews: [review(200_020, 'maya-chen', 'APPROVED', hours(100), renameWork.sha, 'Fine by me for v4.')] }));

  // #478: targets `next`, which requires an up-to-date branch, and is behind it.
  pullIssue({ n: 478, title: 'chore: require Node 20', by: 'maya-chen', at: hours(45), labels: ['breaking change'], milestone: 2, body: 'Part of #474.' });
  orbitRepo.pulls.set(478, blankPull({ number: 478, base: 'next', head: 'chore/drop-node-18' }));

  // Landed and closed ones.
  pullIssue({ n: 476, title: 'docs: adapter comparison table', by: 'avakim', at: hours(8), labels: ['documentation'], closed: hours(3), closedBy: 'jonasw', body: 'A table in the README and a page in the docs.', comments: Array.from({ length: 3 }, (_, i) => comment(['jonasw', 'avakim'][i % 2], hours(7 - i), ['Love it.', 'Thanks!'][i % 2])), events: [ev('jonasw', hours(3), 'merged', { commit_id: docsMerge.sha }), ev('jonasw', hours(3), 'head_ref_deleted')] });
  orbitRepo.pulls.set(476, blankPull({ number: 476, base: 'main', head: 'docs/adapters', merged_at: hours(3), merged_by: 'jonasw', merge_commit_sha: docsMerge.sha, frozen: { base: docsBase, head: docsHead.sha }, head_deleted: true, reviews: [review(200_030, 'jonasw', 'APPROVED', hours(4), docsHead.sha)] }));
  pullIssue({ n: 473, title: 'fix(postgres): reconnect LISTEN after failover', by: 'priya-r', at: hours(32), labels: ['bug'], closed: hours(28), closedBy: 'priya-r', body: 'Closes #470.', comments: Array.from({ length: 6 }, (_, i) => comment(['samokafor', 'priya-r', 'jonasw'][i % 3], hours(31 - i * 0.4), ['Tried it, works.', 'Thanks for testing.', 'Approved.'][i % 3])), events: [ev('priya-r', hours(28), 'merged', { commit_id: fixMerge.sha })] });
  orbitRepo.pulls.set(473, blankPull({ number: 473, base: 'main', head: 'fix/listen-reconnect', merged_at: hours(28), merged_by: 'priya-r', merge_commit_sha: fixMerge.sha, frozen: { base: main, head: fixHead.sha }, reviews: [review(200_031, 'jonasw', 'APPROVED', hours(29), fixHead.sha)] }));
  pullIssue({ n: 459, title: 'spike: a Redis adapter', by: 'samokafor', at: days(30), closed: days(28), closedBy: 'maya-chen', labels: ['enhancement'], body: 'See #458.' });
  orbitRepo.pulls.set(459, blankPull({ number: 459, base: 'main', head: 'spike/redis' }));

  /* Actions. */
  const WORKFLOWS: ServerWorkflow[] = [
    { id: 101, name: 'CI', path: '.github/workflows/ci.yml', state: 'active' },
    { id: 102, name: 'Release', path: '.github/workflows/release.yml', state: 'active' },
    { id: 103, name: 'CodeQL', path: '.github/workflows/codeql.yml', state: 'active' },
    { id: 104, name: 'Docs preview', path: '.github/workflows/docs-preview.yml', state: 'active' },
  ];
  orbitRepo.workflows = WORKFLOWS;
  const run = (id: number, workflow: number, o: { title: string; n: number; event: string; actor: string; branch: string; sha: string; status: string; conclusion: string | null; at: string; pr?: number; seconds?: number; failing?: string }): ServerRun => {
    const end = new Date(Date.parse(o.at) + (o.seconds ?? 110) * 1000).toISOString();
    return {
      id, workflow_id: workflow, name: WORKFLOWS.find((w) => w.id === workflow)!.name, display_title: o.title, run_number: o.n, run_attempt: 1, event: o.event, actor: o.actor, head_branch: o.branch, head_sha: o.sha, status: o.status, conclusion: o.conclusion,
      created_at: o.at, run_started_at: o.at, updated_at: o.status === 'completed' ? end : o.at, pull_request: o.pr,
      jobs: [
        job(id * 10 + 1, 'test', o.status, o.failing === 'test' ? 'failure' : o.conclusion, end),
        job(id * 10 + 2, 'lint', o.status, o.failing === 'lint' ? 'failure' : o.failing ? 'success' : o.conclusion, end),
      ],
    };
  };
  orbitRepo.runs = [
    run(5001, 101, { title: 'Dashboard: show attempt history per job', n: 1292, event: 'pull_request', actor: 'jonasw', branch: 'dash/attempts', sha: attempts.sha, status: 'completed', conclusion: 'failure', at: hours(8), pr: 484, seconds: 123, failing: 'test' }),
    run(5002, 101, { title: 'SQLite: poll a notify table for instant wake-ups', n: 1291, event: 'pull_request', actor: 'priya-r', branch: 'feat/sqlite-notify', sha: notify.sha, status: 'in_progress', conclusion: null, at: hours(0.2), pr: 486 }),
    run(5003, 101, { title: 'docs: document the jitter option', n: 1290, event: 'pull_request', actor: 'maya-chen', branch: 'feat/retry-jitter', sha: jitter.sha, status: 'completed', conclusion: 'success', at: hours(6), pr: 488, seconds: 112 }),
    run(5004, 104, { title: 'Merge pull request #476 from acme/docs/adapters', n: 412, event: 'push', actor: 'jonasw', branch: 'main', sha: docsMerge.sha, status: 'completed', conclusion: 'success', at: hours(3), seconds: 48 }),
    run(5005, 103, { title: 'fix(postgres): reconnect LISTEN after failover (#473)', n: 377, event: 'push', actor: 'priya-r', branch: 'main', sha: fixMerge.sha, status: 'completed', conclusion: 'success', at: hours(28), seconds: 130 }),
    run(5006, 102, { title: 'chore(release): v3.2.0', n: 64, event: 'release', actor: 'orbit-bot', branch: 'v3.2.0', sha: git.tags.get('v3.2.0')!, status: 'completed', conclusion: 'success', at: days(7), seconds: 207 }),
    run(5007, 101, { title: 'test: flaky reconnect timing', n: 1284, event: 'push', actor: 'samokafor', branch: 'fix/listen-reconnect', sha: fixHead.sha, status: 'completed', conclusion: 'cancelled', at: days(7), seconds: 22 }),
    run(5008, 101, { title: 'perf: claim jobs with SKIP LOCKED (#465)', n: 1280, event: 'push', actor: 'jonasw', branch: 'main', sha: main, status: 'completed', conclusion: 'success', at: days(9), seconds: 104 }),
    run(5009, 101, { title: 'docs: running Orbit alongside Prisma migrations', n: 1279, event: 'pull_request', actor: 'leodm', branch: 'docs/prisma', sha: prisma.sha, status: 'completed', conclusion: 'success', at: hours(95), pr: 481 }),
    // A long list, so Actions has pages too.
    ...Array.from({ length: 28 }, (_, i) => run(5100 + i, i % 5 === 4 ? 103 : 101, { title: FILLER[i % FILLER.length], n: 1278 - i, event: 'push', actor: ['jonasw', 'priya-r', 'orbit-bot'][i % 3], branch: 'main', sha: main, status: 'completed', conclusion: i % 9 === 8 ? 'failure' : 'success', at: days(10 + i), seconds: 90 + i * 2, failing: i % 9 === 8 ? 'lint' : undefined })),
  ];
  const ciChecks = (runId: number, at: string) => passing(['CI / test (node 20, postgres 16)', 'CI / test (node 22, postgres 16)', 'CI / lint'], at, runId);
  orbitRepo.checks[jitter.sha] = [...ciChecks(5003, hours(5.97)), ...passing(['CodeQL / analyze (javascript)'], hours(5.9))];
  orbitRepo.statuses[jitter.sha] = [{ context: 'docs/preview', state: 'success', description: 'Preview deployed', target_url: 'https://orbit.acme.dev/preview/488' }];
  orbitRepo.checks[attempts.sha] = [
    { name: 'CI / test (node 20, postgres 16)', status: 'completed', conclusion: 'failure', started_at: hours(8), completed_at: hours(7.97), run: 5001, summary: '1 test failed: Queue > runs a job it was given' },
    { name: 'CI / test (node 22, postgres 16)', status: 'completed', conclusion: 'failure', started_at: hours(8), completed_at: hours(7.97), run: 5001 },
    { name: 'CI / lint', status: 'completed', conclusion: 'success', started_at: hours(8), completed_at: hours(7.98), run: 5001 },
  ];
  orbitRepo.checks[notify.sha] = [
    { name: 'CI / test (node 20, postgres 16)', status: 'in_progress', conclusion: null, started_at: hours(0.2), completed_at: null, run: 5002 },
    { name: 'CI / lint', status: 'completed', conclusion: 'success', started_at: hours(0.2), completed_at: hours(0.18), run: 5002 },
  ];
  orbitRepo.checks[prisma.sha] = ciChecks(5009, hours(95));
  orbitRepo.checks[renameWork.sha] = ciChecks(5009, hours(119));
  orbitRepo.checks[dropNode.sha] = ciChecks(5009, hours(44));
  orbitRepo.checks[git.branches.get('main')!] = ciChecks(5008, hours(2.4));

  /* Releases. */
  orbitRepo.releases = [
    { id: 8004, tag_name: 'v3.3.0-rc.1', name: 'v3.3.0-rc.1', body: 'Draft notes for 3.3.\n\n- Retry jitter (#488)', draft: true, prerelease: true, created_at: hours(10), published_at: null, author: 'maya-chen', target_commitish: 'main', assets: [] },
    { id: 8003, tag_name: 'v3.2.0', name: 'v3.2.0', body: '## What’s changed\n\n- Claim jobs with `SKIP LOCKED`, about 40% less contention under load (#465)\n- Reconnect `LISTEN` after a failover\n- Export the `fixed()` retry policy (#466)\n\n**Full changelog:** v3.1.0...v3.2.0', draft: false, prerelease: false, created_at: days(7), published_at: days(7), author: 'maya-chen', target_commitish: 'main', assets: [{ id: 1, name: 'orbit-3.2.0.tgz', size: 48_211, download_count: 412, content_type: 'application/gzip' }, { id: 2, name: 'orbit-3.2.0.sbom.json', size: 12_803, download_count: 37, content_type: 'application/json' }] },
    { id: 8002, tag_name: 'v3.1.0', name: 'v3.1.0', body: '- `createQueue` accepts a connection string\n- Typed job records', draft: false, prerelease: false, created_at: days(70), published_at: days(70), author: 'maya-chen', target_commitish: 'main', assets: [] },
    { id: 8001, tag_name: 'v3.0.0', name: 'v3.0.0: adapters', body: 'Rewritten around adapters: Postgres, SQLite and memory.', draft: false, prerelease: false, created_at: days(360), published_at: days(360), author: 'maya-chen', target_commitish: 'main', assets: [] },
  ];
  return orbitRepo;
}

/* ── The smaller repositories ── */

/** A repository anyone can read and you can't write: Fork and "ask a maintainer" paths. */
function helloWorld(): ServerRepo {
  const git = new GitStore();
  const start = git.commit({ parents: [], message: 'Initial commit', author: person('octo'), date: days(400), files: new Map([
    ['README.md', '# hello-world\n\nMy first repository on GitHub.\n\nYou can read this one but not write to it: fork it to propose a change.\n'],
    ['src/greet.ts', 'export function greet(name: string) {\n  return `Hello, ${name}!`;\n}\n'],
    ['package.json', '{\n  "name": "hello-world",\n  "version": "1.0.0"\n}\n'],
  ]) });
  git.branches.set('main', start.sha);
  const i18n = branchFrom(git, 'i18n', start.sha, [
    { at: hours(5), by: 'mona', message: 'i18n: add messages', files: { 'src/greet.ts': "const HELLO: Record<string, string> = { en: 'Hello', fr: 'Bonjour' };\n\nexport function greet(name: string, lang = 'en') {\n  const word = HELLO[lang] ?? HELLO.en;\n  return `${word}, ${name}!`;\n}\n" } },
  ]);
  const r = blankRepo('octo', 'hello-world', {
    id: 7002, description: 'My first repository on GitHub.', homepage: 'octo.example', topics: ['hello', 'demo'], license: 'MIT License', created_at: days(400), pushed_at: hours(5), stars: 2410, extra_forks: 1300, extra_watchers: 88, git,
    labels: LABELS.slice(0, 3).map((l) => ({ ...l })), roles: { mona: 'write' }, stargazers: ['mona'], watchers: ['mona'],
    workflows: [{ id: 201, name: 'CI', path: '.github/workflows/ci.yml', state: 'active' }],
  });
  r.issues.set(12, issueRow({ n: 12, title: 'Greeting is not localized', by: 'mona', at: hours(30), labels: ['bug'], body: 'Every visitor gets **Hello** in English.', comments: [comment('octo', hours(20), 'Good catch — on it.')] }));
  r.issues.set(14, issueRow({ n: 14, title: 'Localize the greeting', by: 'mona', at: hours(5), labels: ['enhancement'], body: 'Fixes #12.', comments: [comment('octo', hours(4), 'Should the fallback be English?')] }));
  r.pulls.set(14, blankPull({ number: 14, base: 'main', head: 'i18n', requested_reviewers: ['octo'] }));
  r.checks[i18n.sha] = [
    { name: 'CI / test', status: 'completed', conclusion: 'success', started_at: hours(1), completed_at: hours(0.97) },
    { name: 'CI / lint', status: 'in_progress', conclusion: null, started_at: hours(0.1), completed_at: null },
  ];
  r.runs = [{
    id: 6001, workflow_id: 201, name: 'CI', display_title: 'Localize the greeting', run_number: 31, run_attempt: 1, event: 'pull_request', actor: 'mona', head_branch: 'i18n', head_sha: i18n.sha, status: 'in_progress', conclusion: null, created_at: hours(0.1), run_started_at: hours(0.1), updated_at: hours(0.05), pull_request: 14,
    jobs: [job(60011, 'test', 'completed', 'success', hours(0.97)), job(60012, 'lint', 'in_progress', null, hours(0.1))],
  }];
  return r;
}

function archived(): ServerRepo {
  const git = new GitStore();
  const c = git.commit({ parents: [], message: 'Final commit', author: person('maya-chen'), date: days(500), files: new Map([['README.md', '# orbit-legacy\n\nArchived. Use [acme/orbit](https://github.com/acme/orbit).\n']]) });
  git.branches.set('main', c.sha);
  const r = blankRepo('acme', 'orbit-legacy', { id: 7003, description: 'The old Redis-backed Orbit. Archived.', archived: true, created_at: days(1500), pushed_at: days(500), stars: 310, git, labels: LABELS.slice(0, 2).map((l) => ({ ...l })), roles: { you: 'admin' } });
  r.issues.set(1, issueRow({ n: 1, title: 'Is this maintained?', by: 'leodm', at: days(510), body: 'Asking for a friend.', comments: [comment('maya-chen', days(500), 'No. See acme/orbit.')] }));
  return r;
}

function dotfiles(): ServerRepo {
  const git = new GitStore();
  const c = git.commit({ parents: [], message: 'Add zshrc', author: person('you'), date: days(40), files: new Map([['.zshrc', 'export EDITOR=nvim\n'], ['README.md', '# dotfiles\n\nJust mine.\n']]) });
  git.branches.set('main', c.sha);
  return blankRepo('you', 'dotfiles', { id: 7004, description: 'Just mine.', private: true, created_at: days(40), pushed_at: days(40), git });
}

/** Nothing committed yet: the empty state and the first file. */
function empty(): ServerRepo {
  return blankRepo('you', 'new-idea', { id: 7005, description: 'Nothing here yet.', created_at: days(1), pushed_at: days(1) });
}

export interface SampleSeedOptions {
  /** Your role on acme/orbit (default admin, so everything can be tried). */
  role?: Role;
}

export function sampleSeed({ role = 'admin' }: SampleSeedOptions = {}): ServerSeed {
  const repos = [orbit(role), helloWorld(), archived(), dotfiles(), empty()];
  return {
    now: SAMPLE_NOW,
    viewer: SAMPLE_VIEWER,
    users: USERS,
    repos,
    orgs: ['acme'],
    notifications: [
      { id: '1', repo: 'acme/orbit', subject: { title: 'Add exponential backoff with jitter to retries', type: 'PullRequest', number: 488 }, reason: 'review_requested', unread: true, updated_at: hours(4) },
      { id: '2', repo: 'acme/orbit', subject: { title: 'Jobs enqueued inside a rolled-back transaction still wake idle workers', type: 'Issue', number: 489 }, reason: 'mention', unread: true, updated_at: hours(0.5) },
      { id: '3', repo: 'acme/orbit', subject: { title: 'Dashboard: show attempt history per job', type: 'PullRequest', number: 484 }, reason: 'subscribed', unread: true, updated_at: hours(8) },
      { id: '4', repo: 'octo/hello-world', subject: { title: 'Greeting is not localized', type: 'Issue', number: 12 }, reason: 'subscribed', unread: false, updated_at: hours(20) },
    ],
  };
}


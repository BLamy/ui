/* Sample data for the GitHub clone block: one repository (acme/orbit) with its files, issues, pull requests,
   a pull request conversation + diff, and workflow runs. Times are fixed strings so renders are deterministic. */

export interface User {
  login: string;
  /** First / last name — what the Avatar's initials are drawn from. */
  f: string;
  l: string;
}

export interface Label {
  name: string;
  /** GitHub-style label color (hex). */
  color: string;
  description?: string;
}

export const USERS = {
  maya: { login: 'maya-chen', f: 'Maya', l: 'Chen' },
  jonas: { login: 'jonasw', f: 'Jonas', l: 'Weber' },
  priya: { login: 'priya-r', f: 'Priya', l: 'Raman' },
  leo: { login: 'leodm', f: 'Leo', l: 'Dumont' },
  sam: { login: 'samokafor', f: 'Sam', l: 'Okafor' },
  ava: { login: 'avakim', f: 'Ava', l: 'Kim' },
  bot: { login: 'orbit-bot', f: 'Orbit', l: 'Bot' },
} satisfies Record<string, User>;

export const ME: User = { login: 'you', f: 'Alex', l: 'Rivera' };

export const LABELS = {
  bug: { name: 'bug', color: '#d73a4a', description: "Something isn't working" },
  enhancement: { name: 'enhancement', color: '#a2eeef', description: 'New feature or request' },
  docs: { name: 'documentation', color: '#0075ca', description: 'Improvements or additions to documentation' },
  gfi: { name: 'good first issue', color: '#7057ff', description: 'Good for newcomers' },
  help: { name: 'help wanted', color: '#008672', description: 'Extra attention is needed' },
  perf: { name: 'performance', color: '#fbca04', description: 'Faster, leaner, cheaper' },
  breaking: { name: 'breaking change', color: '#b60205', description: 'Requires a major version bump' },
  question: { name: 'question', color: '#d876e3', description: 'Further information is requested' },
} satisfies Record<string, Label>;

export const REPO = {
  owner: 'acme',
  name: 'orbit',
  description: 'Type-safe background jobs for TypeScript, backed by Postgres. Retries, cron, rate limits and a tiny dashboard — no Redis required.',
  homepage: 'orbit.acme.dev',
  topics: ['typescript', 'postgres', 'job-queue', 'background-jobs', 'nodejs', 'cron'],
  stars: '12.4k',
  forks: '842',
  watchers: '186',
  license: 'MIT license',
  branch: 'main',
  branches: ['main', 'next', 'feat/retry-jitter', 'fix/listen-reconnect', 'docs/adapters'],
  branchCount: 38,
  tagCount: 64,
  commitCount: '1,482',
  release: { tag: 'v3.2.0', when: 'last week', count: 64 },
  languages: [
    { name: 'TypeScript', pct: 91.4, color: '#3178c6' },
    { name: 'PLpgSQL', pct: 5.1, color: '#336790' },
    { name: 'JavaScript', pct: 2.6, color: '#f1e05a' },
    { name: 'Other', pct: 0.9, color: '#9198a1' },
  ],
  contributors: [USERS.maya, USERS.jonas, USERS.priya, USERS.leo, USERS.sam, USERS.ava],
  contributorCount: 71,
  lastCommit: { author: USERS.jonas, message: 'Merge pull request #476 from acme/docs/adapters', sha: '4f1c2ab', when: '3 hours ago' },
};

/* ── Files ── */
export interface FileNode {
  name: string;
  path: string;
  type: 'dir' | 'file';
  commit: string;
  when: string;
  children?: FileNode[];
  content?: string;
}

const README = `# Orbit

Type-safe background jobs for TypeScript, backed by Postgres.

\`build: passing\` \`npm: v3.2.0\` \`license: MIT\` \`downloads: 48k/week\`

Orbit stores jobs in the database you already run. Enqueue inside a transaction, process with typed
handlers, and get retries, scheduling and rate limits without adding Redis to your stack.

## Features

- **Typed end to end** — payloads are inferred from your job definitions
- **Transactional enqueue** — a job only exists if your transaction commits
- **Retries with backoff** — exponential, fixed or custom strategies per job
- **Cron schedules** — distributed-safe, one run per tick across all workers
- **Rate limits and concurrency** — per queue, per job, or per key

## Install

\`\`\`bash
pnpm add @acme/orbit
\`\`\`

## Quick start

\`\`\`ts
import { createQueue, defineJob } from '@acme/orbit'

const sendWelcome = defineJob('send-welcome', async (job: { userId: string }) => {
  await mailer.send(job.userId, 'welcome')
})

const queue = createQueue({ connection: process.env.DATABASE_URL, jobs: [sendWelcome] })

await queue.enqueue(sendWelcome, { userId: 'u_123' })
await queue.work({ concurrency: 8 })
\`\`\`

## Adapters

| Adapter | Status | Notes |
| --- | --- | --- |
| Postgres | Stable | \`LISTEN/NOTIFY\` wake-ups, advisory locks |
| SQLite | Beta | Single process, great for local dev |
| Memory | Stable | Deterministic, built for tests |

## Retries

> Failed jobs are retried up to \`maxAttempts\` times. Delays grow exponentially from \`baseDelay\`
> and are capped at \`maxDelay\`.

## Contributing

We love contributions! Read [CONTRIBUTING.md](CONTRIBUTING.md), then look for issues labelled
**good first issue**. Run \`pnpm test\` before opening a pull request.

## License

MIT © Acme, Inc.
`;

const QUEUE_TS = `import type { Adapter, JobRecord } from './adapters/types'
import { defaultRetry, type RetryPolicy } from './retry'

export interface JobDefinition<P> {
  name: string
  handler: (payload: P, ctx: JobContext) => Promise<void>
  retry?: RetryPolicy
}

export interface JobContext {
  attempt: number
  signal: AbortSignal
  log: (message: string) => void
}

export function defineJob<P>(name: string, handler: JobDefinition<P>['handler'], retry?: RetryPolicy) {
  return { name, handler, retry } satisfies JobDefinition<P>
}

export class Queue {
  constructor(private adapter: Adapter, private jobs: Map<string, JobDefinition<any>>) {}

  /** Enqueue a job. Pass \`tx\` to enqueue inside your own transaction. */
  async enqueue<P>(job: JobDefinition<P>, payload: P, opts: { runAt?: Date; tx?: unknown } = {}) {
    return this.adapter.insert({ name: job.name, payload, runAt: opts.runAt ?? new Date() }, opts.tx)
  }

  async work({ concurrency = 4 } = {}) {
    const slots = Array.from({ length: concurrency }, () => this.loop())
    await Promise.all(slots)
  }

  private async loop() {
    for await (const record of this.adapter.claim()) {
      await this.run(record)
    }
  }

  private async run(record: JobRecord) {
    const job = this.jobs.get(record.name)
    if (!job) return this.adapter.fail(record, new Error('Unknown job: ' + record.name))
    const policy = job.retry ?? defaultRetry
    try {
      await job.handler(record.payload, { attempt: record.attempt, signal: record.signal, log: console.log })
      await this.adapter.complete(record)
    } catch (err) {
      const delay = policy.delay(record.attempt)
      if (record.attempt >= policy.maxAttempts) await this.adapter.fail(record, err)
      else await this.adapter.retry(record, delay)
    }
  }
}
`;

const RETRY_TS = `export interface RetryPolicy {
  maxAttempts: number
  /** Delay in ms before the given attempt (1-based). */
  delay: (attempt: number) => number
}

export interface BackoffOptions {
  baseDelay?: number
  maxDelay?: number
  maxAttempts?: number
}

export function exponential({ baseDelay = 1000, maxDelay = 60_000, maxAttempts = 5 }: BackoffOptions = {}): RetryPolicy {
  return {
    maxAttempts,
    delay: (attempt) => Math.min(baseDelay * 2 ** (attempt - 1), maxDelay),
  }
}

export function fixed(ms: number, maxAttempts = 3): RetryPolicy {
  return { maxAttempts, delay: () => ms }
}

export const defaultRetry = exponential()
`;

const INDEX_TS = `export { Queue, defineJob, type JobDefinition, type JobContext } from './queue'
export { createQueue } from './create-queue'
export { exponential, fixed, type RetryPolicy, type BackoffOptions } from './retry'
export { postgres } from './adapters/postgres'
export { memory } from './adapters/memory'
`;

const PACKAGE_JSON = `{
  "name": "@acme/orbit",
  "version": "3.2.0",
  "description": "Type-safe background jobs for TypeScript, backed by Postgres",
  "license": "MIT",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsup src/index.ts --format esm,cjs --dts",
    "test": "vitest run",
    "lint": "eslint src test"
  },
  "dependencies": {
    "postgres": "^3.4.4"
  },
  "devDependencies": {
    "tsup": "^8.2.4",
    "typescript": "^5.6.2",
    "vitest": "^2.1.1"
  }
}
`;

const CI_YML = `name: CI
on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: postgres
        ports: ['5432:5432']
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm test
        env:
          DATABASE_URL: postgres://postgres:postgres@localhost:5432/postgres
`;

const LICENSE = `MIT License

Copyright (c) 2023 Acme, Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.
`;

const POSTGRES_TS = `import postgres from 'postgres'
import type { Adapter } from './types'

export function postgresAdapter(url: string, { channel = 'orbit_jobs' } = {}): Adapter {
  const sql = postgres(url)
  return {
    async insert(job, tx) {
      const db = (tx as typeof sql) ?? sql
      const [row] = await db\`insert into orbit_jobs \${db(job)} returning id\`
      await db\`select pg_notify(\${channel}, \${job.name})\`
      return row.id
    },
    async *claim() {
      // FOR UPDATE SKIP LOCKED lets many workers share one table safely.
      while (true) {
        const rows = await sql\`
          update orbit_jobs set locked_at = now()
          where id = (select id from orbit_jobs where run_at <= now() and locked_at is null
                      order by run_at for update skip locked limit 1)
          returning *\`
        if (rows.length) yield rows[0] as any
        else await new Promise((r) => setTimeout(r, 500))
      }
    },
    complete: (job) => sql\`delete from orbit_jobs where id = \${job.id}\`.then(() => {}),
    retry: (job, ms) => sql\`update orbit_jobs set locked_at = null, attempt = attempt + 1,
      run_at = now() + \${ms} * interval '1 millisecond' where id = \${job.id}\`.then(() => {}),
    fail: (job, err) => sql\`update orbit_jobs set failed_at = now(), error = \${String(err)}
      where id = \${job.id}\`.then(() => {}),
  }
}
`;

type RawNode = Omit<FileNode, 'path' | 'children'> & { children?: RawNode[] };
const f = (name: string, commit: string, when: string, content?: string): RawNode => ({ name, type: 'file', commit, when, content });
const d = (name: string, commit: string, when: string, children: RawNode[]): RawNode => ({ name, type: 'dir', commit, when, children });
const withPaths = (nodes: RawNode[], base = ''): FileNode[] =>
  nodes.map((n) => {
    const path = base ? base + '/' + n.name : n.name;
    return { ...n, path, children: n.children ? withPaths(n.children, path) : undefined };
  });

export const TREE: FileNode[] = withPaths([
  d('.github', 'ci: run the test matrix on Postgres 16', '2 weeks ago', [
    d('workflows', 'ci: run the test matrix on Postgres 16', '2 weeks ago', [
      f('ci.yml', 'ci: run the test matrix on Postgres 16', '2 weeks ago', CI_YML),
      f('release.yml', 'ci: publish with provenance', 'last month'),
    ]),
  ]),
  d('docs', 'docs: adapter comparison table (#476)', '3 hours ago', [
    f('adapters.md', 'docs: adapter comparison table (#476)', '3 hours ago'),
    f('getting-started.md', 'docs: transactional enqueue example', 'last week'),
    f('retries.md', 'docs: explain maxDelay', '3 weeks ago'),
  ]),
  d('examples', 'examples: next.js route handler', 'last week', [
    d('express', 'examples: bump express to v5', '2 weeks ago', [f('index.ts', 'examples: bump express to v5', '2 weeks ago')]),
    d('nextjs', 'examples: next.js route handler', 'last week', [f('route.ts', 'examples: next.js route handler', 'last week')]),
  ]),
  d('src', 'fix(postgres): reconnect LISTEN after failover (#473)', 'yesterday', [
    d('adapters', 'fix(postgres): reconnect LISTEN after failover (#473)', 'yesterday', [
      f('memory.ts', 'test: deterministic memory adapter clock', 'last month'),
      f('postgres.ts', 'fix(postgres): reconnect LISTEN after failover (#473)', 'yesterday', POSTGRES_TS),
      f('types.ts', 'feat: typed job records', '2 months ago'),
    ]),
    f('create-queue.ts', 'feat: createQueue accepts a connection string', 'last month'),
    f('index.ts', 'feat: export fixed() retry policy', '3 weeks ago', INDEX_TS),
    f('queue.ts', 'perf: claim jobs with SKIP LOCKED (#465)', 'last week', QUEUE_TS),
    f('retry.ts', 'feat: export fixed() retry policy', '3 weeks ago', RETRY_TS),
  ]),
  d('test', 'test: cover LISTEN reconnect', 'yesterday', [
    f('queue.test.ts', 'test: cover LISTEN reconnect', 'yesterday'),
    f('retry.test.ts', 'feat: export fixed() retry policy', '3 weeks ago'),
  ]),
  f('.gitignore', 'chore: ignore coverage output', '4 months ago'),
  f('CHANGELOG.md', 'chore(release): v3.2.0', 'last week'),
  f('LICENSE', 'Initial commit', '2 years ago', LICENSE),
  f('README.md', 'docs: adapter comparison table (#476)', '3 hours ago', README),
  f('package.json', 'chore(release): v3.2.0', 'last week', PACKAGE_JSON),
  f('tsconfig.json', 'chore: target es2022', '5 months ago'),
]);

export const README_MD = README;

/** Finds a node by path ('' → a virtual root). */
export function findNode(path: string): FileNode | undefined {
  if (!path) return { name: REPO.name, path: '', type: 'dir', commit: '', when: '', children: TREE };
  let nodes: FileNode[] | undefined = TREE;
  let hit: FileNode | undefined;
  for (const part of path.split('/')) {
    hit = nodes?.find((n) => n.name === part);
    nodes = hit?.children;
  }
  return hit;
}

/* ── Issues ── */
export interface Issue {
  number: number;
  title: string;
  state: 'open' | 'closed';
  author: User;
  when: string;
  labels: Label[];
  comments: number;
  assignees: User[];
  milestone?: string;
}

export const ISSUE_COUNTS = { open: 23, closed: 187 };

export const ISSUES: Issue[] = [
  { number: 489, title: 'Jobs enqueued inside a rolled-back transaction still wake idle workers', state: 'open', author: USERS.sam, when: '2 hours ago', labels: [LABELS.bug], comments: 4, assignees: [USERS.maya] },
  { number: 487, title: 'Support per-key rate limits (e.g. 10 jobs/min per tenant)', state: 'open', author: USERS.ava, when: 'yesterday', labels: [LABELS.enhancement, LABELS.help], comments: 12, assignees: [], milestone: 'v3.3' },
  { number: 485, title: 'Document how to run Orbit alongside Prisma migrations', state: 'open', author: USERS.leo, when: '2 days ago', labels: [LABELS.docs, LABELS.gfi], comments: 2, assignees: [] },
  { number: 483, title: 'Retries fire in lockstep after an outage (thundering herd)', state: 'open', author: USERS.priya, when: '3 days ago', labels: [LABELS.bug, LABELS.perf], comments: 7, assignees: [USERS.maya, USERS.jonas], milestone: 'v3.3' },
  { number: 480, title: 'Expose job attempt history in the dashboard', state: 'open', author: USERS.jonas, when: '5 days ago', labels: [LABELS.enhancement], comments: 0, assignees: [USERS.jonas] },
  { number: 477, title: 'Typo in getting-started: "enqueu" → "enqueue"', state: 'open', author: USERS.bot, when: 'last week', labels: [LABELS.docs, LABELS.gfi], comments: 1, assignees: [] },
  { number: 474, title: 'Drop Node 18 support in v4', state: 'open', author: USERS.maya, when: 'last week', labels: [LABELS.breaking, LABELS.question], comments: 18, assignees: [], milestone: 'v4.0' },
  { number: 472, title: 'SQLite adapter: busy timeout when two workers claim at once', state: 'open', author: USERS.leo, when: '2 weeks ago', labels: [LABELS.bug, LABELS.help], comments: 5, assignees: [USERS.priya] },
  { number: 470, title: 'Postgres LISTEN connection is not re-established after failover', state: 'closed', author: USERS.sam, when: 'last week', labels: [LABELS.bug], comments: 9, assignees: [USERS.priya] },
  { number: 466, title: 'Add a `fixed()` retry policy', state: 'closed', author: USERS.ava, when: '3 weeks ago', labels: [LABELS.enhancement, LABELS.gfi], comments: 3, assignees: [] },
  { number: 461, title: 'Claim query does a sequential scan on large tables', state: 'closed', author: USERS.priya, when: 'last month', labels: [LABELS.perf], comments: 6, assignees: [USERS.jonas] },
];

/* ── Pull requests ── */
export type ReviewState = 'approved' | 'changes' | 'pending' | 'draft';
export interface PullRequest {
  number: number;
  title: string;
  state: 'open' | 'merged' | 'closed' | 'draft';
  author: User;
  when: string;
  labels: Label[];
  comments: number;
  review: ReviewState;
  checks: 'success' | 'failure' | 'pending';
  head: string;
  base: string;
  commits: number;
  additions: number;
  deletions: number;
}

export const PR_COUNTS = { open: 6, closed: 412 };

export const PULLS: PullRequest[] = [
  { number: 488, title: 'Add exponential backoff with jitter to retries', state: 'open', author: USERS.maya, when: 'yesterday', labels: [LABELS.enhancement, LABELS.perf], comments: 5, review: 'approved', checks: 'success', head: 'feat/retry-jitter', base: 'main', commits: 4, additions: 59, deletions: 8 },
  { number: 486, title: 'Postgres: use LISTEN/NOTIFY for instant wake-ups on SQLite parity', state: 'draft', author: USERS.priya, when: '2 days ago', labels: [LABELS.enhancement], comments: 1, review: 'draft', checks: 'pending', head: 'feat/sqlite-notify', base: 'next', commits: 7, additions: 312, deletions: 41 },
  { number: 484, title: 'Dashboard: show attempt history per job', state: 'open', author: USERS.jonas, when: '3 days ago', labels: [LABELS.enhancement], comments: 8, review: 'changes', checks: 'failure', head: 'dash/attempts', base: 'main', commits: 11, additions: 540, deletions: 96 },
  { number: 481, title: 'docs: running Orbit alongside Prisma migrations', state: 'open', author: USERS.leo, when: '4 days ago', labels: [LABELS.docs], comments: 2, review: 'pending', checks: 'success', head: 'docs/prisma', base: 'main', commits: 2, additions: 74, deletions: 3 },
  { number: 476, title: 'docs: adapter comparison table', state: 'merged', author: USERS.ava, when: '3 hours ago', labels: [LABELS.docs], comments: 3, review: 'approved', checks: 'success', head: 'docs/adapters', base: 'main', commits: 1, additions: 38, deletions: 12 },
  { number: 473, title: 'fix(postgres): reconnect LISTEN after failover', state: 'merged', author: USERS.priya, when: 'yesterday', labels: [LABELS.bug], comments: 6, review: 'approved', checks: 'success', head: 'fix/listen-reconnect', base: 'main', commits: 3, additions: 88, deletions: 21 },
];

/* ── Pull request #488: conversation, commits, diff ── */
export interface Commit {
  sha: string;
  message: string;
  author: User;
  when: string;
}

export type TimelineItem =
  | { kind: 'comment'; id: string; author: User; when: string; body: string; role?: 'Author' | 'Member' | 'Contributor' }
  | { kind: 'commits'; id: string; author: User; when: string; commits: Commit[] }
  | { kind: 'labeled'; id: string; author: User; when: string; labels: Label[] }
  | { kind: 'review'; id: string; author: User; when: string; state: 'approved' | 'commented' | 'changes'; body?: string }
  | { kind: 'requested'; id: string; author: User; when: string; reviewer: User };

export const PR_COMMITS: Commit[] = [
  { sha: 'a3f9c21', message: 'retry: add jitter strategies (full, equal, decorrelated)', author: USERS.maya, when: 'yesterday' },
  { sha: '7b21e04', message: 'retry: clamp jittered delays to maxDelay', author: USERS.maya, when: 'yesterday' },
  { sha: '0c4d8aa', message: 'test: cover jitter bounds with a seeded rng', author: USERS.maya, when: '20 hours ago' },
  { sha: 'e91b3f7', message: 'docs: document the jitter option', author: USERS.maya, when: '6 hours ago' },
];

export const PR_TIMELINE: TimelineItem[] = [
  {
    kind: 'comment', id: 'c1', author: USERS.maya, when: 'yesterday', role: 'Member',
    body: `Closes #483.

After an outage every failed job retries on the **same schedule**, so workers hammer the database in waves. This adds a \`jitter\` option to \`exponential()\`:

- \`'full'\` — random delay between 0 and the computed backoff (new default)
- \`'equal'\` — half fixed, half random
- \`'none'\` — the previous behaviour

\`\`\`ts
const policy = exponential({ baseDelay: 500, maxDelay: 30_000, jitter: 'full' })
\`\`\`

The random source is injectable, so tests stay deterministic.`,
  },
  { kind: 'commits', id: 'k1', author: USERS.maya, when: 'yesterday', commits: PR_COMMITS.slice(0, 2) },
  { kind: 'labeled', id: 'l1', author: USERS.jonas, when: 'yesterday', labels: [LABELS.enhancement, LABELS.perf] },
  { kind: 'requested', id: 'r0', author: USERS.maya, when: 'yesterday', reviewer: USERS.jonas },
  {
    kind: 'review', id: 'r1', author: USERS.jonas, when: '22 hours ago', state: 'commented',
    body: `Nice — the herd graph from #483 flattens out completely with \`'full'\`.

One thing: jitter can push a delay *above* \`maxDelay\` when \`baseDelay\` is large. Can we clamp after applying it?`,
  },
  {
    kind: 'comment', id: 'c2', author: USERS.maya, when: '20 hours ago', role: 'Author',
    body: `Good catch, clamped in \`7b21e04\` and added a property test that runs 10k attempts against the bounds.`,
  },
  { kind: 'commits', id: 'k2', author: USERS.maya, when: '20 hours ago', commits: PR_COMMITS.slice(2) },
  {
    kind: 'review', id: 'r2', author: USERS.jonas, when: '5 hours ago', state: 'approved',
    body: 'LGTM. Let’s ship this in **v3.3** 🚀',
  },
  {
    kind: 'comment', id: 'c3', author: USERS.priya, when: '4 hours ago', role: 'Contributor',
    body: 'Tried the branch against our staging outage replay — p99 DB CPU during recovery dropped from 94% to 38%.',
  },
];

export const PR_CHECKS = [
  { name: 'CI / test (node 20, postgres 16)', status: 'success', time: '1m 48s' },
  { name: 'CI / test (node 22, postgres 16)', status: 'success', time: '1m 52s' },
  { name: 'CI / lint', status: 'success', time: '31s' },
  { name: 'CodeQL / analyze (javascript)', status: 'success', time: '2m 10s' },
] as const;

export interface DiffFile {
  path: string;
  additions: number;
  deletions: number;
  /** Unified-diff hunks (each starts with an `@@ -a,b +c,d @@` header). */
  patch: string;
}

export const PR_FILES: DiffFile[] = [
  {
    path: 'src/retry.ts',
    additions: 24,
    deletions: 3,
    patch: `@@ -1,21 +1,42 @@
 export interface RetryPolicy {
   maxAttempts: number
   /** Delay in ms before the given attempt (1-based). */
   delay: (attempt: number) => number
 }

+export type Jitter = 'full' | 'equal' | 'none'
+
 export interface BackoffOptions {
   baseDelay?: number
   maxDelay?: number
   maxAttempts?: number
+  /** Spread retries out so they don't fire in lockstep. Defaults to 'full'. */
+  jitter?: Jitter
+  /** Random source in [0, 1) — inject a seeded one in tests. */
+  random?: () => number
 }

-export function exponential({ baseDelay = 1000, maxDelay = 60_000, maxAttempts = 5 }: BackoffOptions = {}): RetryPolicy {
+export function exponential({
+  baseDelay = 1000,
+  maxDelay = 60_000,
+  maxAttempts = 5,
+  jitter = 'full',
+  random = Math.random,
+}: BackoffOptions = {}): RetryPolicy {
   return {
     maxAttempts,
-    delay: (attempt) => Math.min(baseDelay * 2 ** (attempt - 1), maxDelay),
+    delay: (attempt) => {
+      const backoff = Math.min(baseDelay * 2 ** (attempt - 1), maxDelay)
+      const delay = applyJitter(backoff, jitter, random)
+      return Math.min(delay, maxDelay)
+    },
   }
 }

+function applyJitter(ms: number, jitter: Jitter, random: () => number) {
+  if (jitter === 'none') return ms
+  if (jitter === 'equal') return ms / 2 + random() * (ms / 2)
+  return random() * ms
+}
+
 export function fixed(ms: number, maxAttempts = 3): RetryPolicy {`,
  },
  {
    path: 'test/retry.test.ts',
    additions: 26,
    deletions: 0,
    patch: `@@ -1,4 +1,5 @@
 import { describe, expect, it } from 'vitest'
+import { seeded } from './helpers/rng'
 import { exponential, fixed } from '../src/retry'

 describe('exponential', () => {
@@ -18,3 +19,28 @@ describe('exponential', () => {
     expect(policy.delay(10)).toBe(60_000)
   })
 })
+
+describe('jitter', () => {
+  it('keeps full jitter within [0, backoff)', () => {
+    const policy = exponential({ baseDelay: 100, jitter: 'full', random: seeded(42) })
+    for (let attempt = 1; attempt <= 10_000; attempt++) {
+      const delay = policy.delay((attempt % 8) + 1)
+      expect(delay).toBeGreaterThanOrEqual(0)
+      expect(delay).toBeLessThanOrEqual(60_000)
+    }
+  })
+
+  it('never exceeds maxDelay', () => {
+    const policy = exponential({ baseDelay: 50_000, maxDelay: 60_000, jitter: 'equal', random: () => 0.999 })
+    expect(policy.delay(3)).toBeLessThanOrEqual(60_000)
+  })
+
+  it("matches the old behaviour with jitter: 'none'", () => {
+    const policy = exponential({ baseDelay: 1000, jitter: 'none' })
+    expect(policy.delay(1)).toBe(1000)
+    expect(policy.delay(4)).toBe(8000)
+  })
+})`,
  },
  {
    path: 'docs/retries.md',
    additions: 9,
    deletions: 5,
    patch: `@@ -8,11 +8,15 @@ Failed jobs are retried up to \`maxAttempts\` times.
 | Option | Default | Description |
 | --- | --- | --- |
 | \`baseDelay\` | \`1000\` | Delay before the first retry, in ms |
-| \`maxDelay\` | \`60000\` | Upper bound for any single delay |
+| \`maxDelay\` | \`60000\` | Upper bound for any single delay, after jitter |
 | \`maxAttempts\` | \`5\` | Attempts before the job is marked failed |
+| \`jitter\` | \`'full'\` | \`'full'\`, \`'equal'\` or \`'none'\` |

-Delays double on every attempt:
+Delays double on every attempt, then jitter spreads them out so a
+burst of failures doesn't retry in lockstep:

-    1s → 2s → 4s → 8s → 16s
+    0–1s → 0–2s → 0–4s → 0–8s → 0–16s

-Use \`fixed(ms)\` when you want a constant delay.
+Use \`fixed(ms)\` when you want a constant delay, or \`jitter: 'none'\`
+to restore the pre-3.3 schedule.
+
+See [AWS: Exponential Backoff And Jitter](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/).`,
  },
];

/* ── Actions ── */
export interface WorkflowRun {
  id: number;
  title: string;
  workflow: string;
  number: number;
  event: string;
  actor: User;
  branch: string;
  status: 'success' | 'failure' | 'running' | 'cancelled';
  when: string;
  duration: string;
}

export const WORKFLOWS = ['CI', 'Release', 'CodeQL', 'Docs preview'];

export const RUNS: WorkflowRun[] = [
  { id: 1, title: 'docs: document the jitter option', workflow: 'CI', number: 1291, event: 'pull_request #488', actor: USERS.maya, branch: 'feat/retry-jitter', status: 'success', when: '6 hours ago', duration: '1m 52s' },
  { id: 2, title: 'Merge pull request #476 from acme/docs/adapters', workflow: 'Docs preview', number: 412, event: 'push', actor: USERS.jonas, branch: 'main', status: 'success', when: '3 hours ago', duration: '48s' },
  { id: 3, title: 'Dashboard: show attempt history per job', workflow: 'CI', number: 1290, event: 'pull_request #484', actor: USERS.jonas, branch: 'dash/attempts', status: 'failure', when: '8 hours ago', duration: '2m 03s' },
  { id: 4, title: 'Postgres: LISTEN/NOTIFY parity for SQLite', workflow: 'CI', number: 1289, event: 'pull_request #486', actor: USERS.priya, branch: 'feat/sqlite-notify', status: 'running', when: '12 minutes ago', duration: '1m 10s' },
  { id: 5, title: 'fix(postgres): reconnect LISTEN after failover (#473)', workflow: 'CodeQL', number: 377, event: 'push', actor: USERS.priya, branch: 'main', status: 'success', when: 'yesterday', duration: '2m 10s' },
  { id: 6, title: 'chore(release): v3.2.0', workflow: 'Release', number: 64, event: 'release v3.2.0', actor: USERS.bot, branch: 'v3.2.0', status: 'success', when: 'last week', duration: '3m 27s' },
  { id: 7, title: 'test: flaky reconnect timing', workflow: 'CI', number: 1284, event: 'push', actor: USERS.sam, branch: 'fix/listen-reconnect', status: 'cancelled', when: 'last week', duration: '22s' },
  { id: 8, title: 'perf: claim jobs with SKIP LOCKED (#465)', workflow: 'CI', number: 1280, event: 'push', actor: USERS.jonas, branch: 'main', status: 'success', when: 'last week', duration: '1m 44s' },
];

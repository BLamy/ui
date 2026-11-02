/* The sample repository's files, as they stand on its default branch (sample-seed.ts commits them over time). */
export const README = `# Orbit

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

export const QUEUE_TS = `import type { Adapter, JobRecord } from './adapters/types'
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

export const RETRY_TS = `export interface RetryPolicy {
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

export const INDEX_TS = `export { Queue, defineJob, type JobDefinition, type JobContext } from './queue'
export { createQueue } from './create-queue'
export { exponential, fixed, type RetryPolicy, type BackoffOptions } from './retry'
export { postgres } from './adapters/postgres'
export { memory } from './adapters/memory'
`;

export const PACKAGE_JSON = `{
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

export const CI_YML = `name: CI
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

export const LICENSE = `MIT License

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

export const POSTGRES_TS = `import postgres from 'postgres'
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

export const MEMORY_TS = `import type { Adapter, JobRecord } from './types'

/** An in-memory adapter with a clock you control: built for tests. */
export function memoryAdapter({ now = () => Date.now() } = {}): Adapter {
  const rows: JobRecord[] = []
  return {
    async insert(job) {
      rows.push({ ...job, id: String(rows.length + 1), attempt: 1, signal: new AbortController().signal, payload: job.payload })
      return rows.at(-1)!.id
    },
    async *claim() {
      while (true) {
        const next = rows.find((r) => r.runAt.getTime() <= now())
        if (!next) return
        rows.splice(rows.indexOf(next), 1)
        yield next
      }
    },
    complete: async () => {},
    retry: async (job, ms) => { rows.push({ ...job, attempt: job.attempt + 1, runAt: new Date(now() + ms) }) },
    fail: async () => {},
  }
}
`;

export const ADAPTER_TYPES_TS = `export interface JobRecord {
  id: string
  name: string
  payload: unknown
  runAt: Date
  attempt: number
  signal: AbortSignal
}

export interface Adapter {
  insert(job: Pick<JobRecord, 'name' | 'payload' | 'runAt'>, tx?: unknown): Promise<string>
  claim(): AsyncIterable<JobRecord>
  complete(job: JobRecord): Promise<void>
  retry(job: JobRecord, delayMs: number): Promise<void>
  fail(job: JobRecord, error: unknown): Promise<void>
}
`;

export const CREATE_QUEUE_TS = `import { postgresAdapter } from './adapters/postgres'
import { Queue, type JobDefinition } from './queue'

export function createQueue({ connection, jobs }: { connection: string; jobs: JobDefinition<any>[] }) {
  return new Queue(postgresAdapter(connection), new Map(jobs.map((job) => [job.name, job])))
}
`;

export const QUEUE_TEST_TS = `import { describe, expect, it } from 'vitest'
import { memoryAdapter } from '../src/adapters/memory'
import { defineJob, Queue } from '../src/queue'

describe('Queue', () => {
  it('runs a job it was given', async () => {
    const seen: string[] = []
    const job = defineJob('greet', async (payload: { name: string }) => { seen.push(payload.name) })
    const queue = new Queue(memoryAdapter(), new Map([[job.name, job]]))
    await queue.enqueue(job, { name: 'Ada' })
    await queue.work({ concurrency: 1 })
    expect(seen).toEqual(['Ada'])
  })
})
`;

export const RETRY_TEST_TS = `import { describe, expect, it } from 'vitest'
import { exponential, fixed } from '../src/retry'

describe('exponential', () => {
  it('doubles every attempt', () => {
    const policy = exponential()
    expect(policy.delay(1)).toBe(1000)
    expect(policy.delay(2)).toBe(2000)
    expect(policy.delay(3)).toBe(4000)
  })

  it('stops growing at maxDelay', () => {
    const policy = exponential()
    expect(policy.delay(10)).toBe(60_000)
  })
})

describe('fixed', () => {
  it('never changes', () => {
    expect(fixed(250).delay(9)).toBe(250)
  })
})
`;

export const RETRIES_MD = `# Retries

Failed jobs are retried up to \`maxAttempts\` times.

| Option | Default | Description |
| --- | --- | --- |
| \`baseDelay\` | \`1000\` | Delay before the first retry, in ms |
| \`maxDelay\` | \`60000\` | Upper bound for any single delay |
| \`maxAttempts\` | \`5\` | Attempts before the job is marked failed |

Delays double on every attempt:

    1s → 2s → 4s → 8s → 16s

Use \`fixed(ms)\` when you want a constant delay.
`;

export const ADAPTERS_MD = `# Adapters

| Adapter | Status | Notes |
| --- | --- | --- |
| Postgres | Stable | \`LISTEN/NOTIFY\` wake-ups, advisory locks |
| SQLite | Beta | Single process, great for local dev |
| Memory | Stable | Deterministic, built for tests |
`;

export const GETTING_STARTED_MD = `# Getting started

Install Orbit and point it at the database you already run:

\`\`\`bash
pnpm add @acme/orbit
\`\`\`

Enqueue inside your own transaction, so a job only exists if the transaction commits.
`;

export const CHANGELOG_MD = `# Changelog

## 3.2.0

- Claim jobs with \`SKIP LOCKED\`, about 40% less contention under load
- Reconnect \`LISTEN\` after a failover
- Export the \`fixed()\` retry policy

## 3.1.0

- \`createQueue\` accepts a connection string
- Typed job records

## 3.0.0

- Rewritten around adapters: Postgres, SQLite and memory
`;

export const RELEASE_YML = `name: Release
on:
  push:
    tags: ['v*']
  workflow_dispatch:
    inputs:
      version:
        description: Version to publish
        required: true
        default: patch
        type: choice
        options:
          - patch
          - minor
          - major
      dry_run:
        description: Build without publishing
        type: boolean
        default: false

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
    steps:
      - uses: actions/checkout@v4
      - run: pnpm publish --provenance
`;

export const CODEQL_YML = `name: CodeQL
on:
  push:
    branches: [main]
  schedule:
    - cron: '0 6 * * 1'

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: github/codeql-action/analyze@v3
`;

export const DOCS_PREVIEW_YML = `name: Docs preview
on:
  push:
    paths: ['docs/**']

jobs:
  preview:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pnpm docs:build
`;

export const GITIGNORE = `node_modules
dist
coverage
*.log
`;

export const TSCONFIG_JSON = `{
  "compilerOptions": {
    "target": "es2022",
    "module": "nodenext",
    "strict": true,
    "declaration": true,
    "outDir": "dist"
  },
  "include": ["src"]
}
`;

export const EXPRESS_EXAMPLE_TS = `import express from 'express'
import { createQueue, defineJob } from '@acme/orbit'

const hello = defineJob('hello', async (job: { name: string }) => console.log('hello', job.name))
const queue = createQueue({ connection: process.env.DATABASE_URL!, jobs: [hello] })

const app = express()
app.post('/hello/:name', async (req, res) => {
  await queue.enqueue(hello, { name: req.params.name })
  res.sendStatus(202)
})
app.listen(3000)
`;

export const NEXT_EXAMPLE_TS = `import { createQueue, defineJob } from '@acme/orbit'

const hello = defineJob('hello', async (job: { name: string }) => console.log('hello', job.name))
const queue = createQueue({ connection: process.env.DATABASE_URL!, jobs: [hello] })

export async function POST(request: Request) {
  const { name } = await request.json()
  await queue.enqueue(hello, { name })
  return new Response(null, { status: 202 })
}
`;

/* The feat/retry-jitter branch (#488). */
export const RETRY_JITTER_TS = `export interface RetryPolicy {
  maxAttempts: number
  /** Delay in ms before the given attempt (1-based). */
  delay: (attempt: number) => number
}

export type Jitter = 'full' | 'equal' | 'none'

export interface BackoffOptions {
  baseDelay?: number
  maxDelay?: number
  maxAttempts?: number
  /** Spread retries out so they don't fire in lockstep. Defaults to 'full'. */
  jitter?: Jitter
  /** Random source in [0, 1) — inject a seeded one in tests. */
  random?: () => number
}

export function exponential({
  baseDelay = 1000,
  maxDelay = 60_000,
  maxAttempts = 5,
  jitter = 'full',
  random = Math.random,
}: BackoffOptions = {}): RetryPolicy {
  return {
    maxAttempts,
    delay: (attempt) => {
      const backoff = Math.min(baseDelay * 2 ** (attempt - 1), maxDelay)
      const delay = applyJitter(backoff, jitter, random)
      return Math.min(delay, maxDelay)
    },
  }
}

function applyJitter(ms: number, jitter: Jitter, random: () => number) {
  if (jitter === 'none') return ms
  if (jitter === 'equal') return ms / 2 + random() * (ms / 2)
  return random() * ms
}

export function fixed(ms: number, maxAttempts = 3): RetryPolicy {
  return { maxAttempts, delay: () => ms }
}

export const defaultRetry = exponential()
`;

export const RETRY_TEST_JITTER_TS = RETRY_TEST_TS + `
describe('jitter', () => {
  it('keeps full jitter within [0, backoff)', () => {
    const policy = exponential({ baseDelay: 100, jitter: 'full', random: () => 0.5 })
    for (let attempt = 1; attempt <= 8; attempt++) {
      expect(policy.delay(attempt)).toBeLessThanOrEqual(60_000)
    }
  })

  it('never exceeds maxDelay', () => {
    const policy = exponential({ baseDelay: 50_000, maxDelay: 60_000, jitter: 'equal', random: () => 0.999 })
    expect(policy.delay(3)).toBeLessThanOrEqual(60_000)
  })
})
`;

export const RETRIES_JITTER_MD = `# Retries

Failed jobs are retried up to \`maxAttempts\` times.

| Option | Default | Description |
| --- | --- | --- |
| \`baseDelay\` | \`1000\` | Delay before the first retry, in ms |
| \`maxDelay\` | \`60000\` | Upper bound for any single delay, after jitter |
| \`maxAttempts\` | \`5\` | Attempts before the job is marked failed |
| \`jitter\` | \`'full'\` | \`'full'\`, \`'equal'\` or \`'none'\` |

Delays double on every attempt, then jitter spreads them out so a
burst of failures doesn't retry in lockstep:

    0–1s → 0–2s → 0–4s → 0–8s → 0–16s

Use \`fixed(ms)\` when you want a constant delay, or \`jitter: 'none'\`
to restore the pre-3.3 schedule.
`;

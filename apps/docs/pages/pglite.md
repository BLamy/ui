# PGlite

Postgres in the browser, as React hooks. `PGliteProvider` opens a [PGlite](https://pglite.dev) database — real PostgreSQL compiled to WebAssembly — and shares it through `useQuery`, `useLiveQuery`, `useExec` and `useTransaction`, with migrations, a single-tab lock, SQL and data-directory export and import, and schema introspection. Everything is lazy: the engine downloads when the first provider mounts, not before.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/pglite.json{% endcommand %}

Copies the source into your project's `lib/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import {
  PGliteProvider, usePGlite, useDatabaseStatus, useQuery,
  useLiveQuery, useExec, useTransaction,
} from '@/lib/pglite'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import {
  PGliteProvider, usePGlite, useDatabaseStatus, useQuery,
  useLiveQuery, useExec, useTransaction,
} from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## Install the engine

The engine is `@electric-sql/pglite`, an **optional peer dependency** of `@brett_lamy/ui`: apps that never mount a provider never install, bundle or download it, and the rest of the package does not change. The registry item lists it (and `@electric-sql/pglite-tools`, used only for SQL export) as ordinary dependencies, so `shadcn add` installs them for you. With npm, add them yourself:

{% command %}npm install @electric-sql/pglite @electric-sql/pglite-tools{% endcommand %}

Pin the exact version. PGlite ships a specific Postgres major (0.5.x is PostgreSQL 18; the 0.4 line was 17), a data directory written by one major cannot be opened by another, and `@electric-sql/pglite-tools` and `-react` peer on an exact PGlite version. The types in this module are structural — a `PGlite` or `PGliteWorker` satisfies `Database` — so the library's own types never import the engine's.

## Usage

Wrap the part of the tree that needs a database. `migrations` run once, in order, when the database opens; `fallback` replaces the children until it is ready.

{% demo src="pglite/basic" %}

```tsx
import { PGliteProvider, useQuery, useExec } from '@/lib/pglite'

const migrations = [
  { id: '001_notes', sql: 'create table notes (id serial primary key, body text not null)' },
]

function Notes() {
  const { rows, isLoading, error } = useQuery<{ id: number; body: string }>('select id, body from notes order by id')
  const { run } = useExec()
  // run('insert into notes (body) values ($1)', [body])  — the list refreshes by itself
}

<PGliteProvider dataDir="idb://notes" migrations={migrations} fallback={<Spinner />}>
  <Notes />
</PGliteProvider>
```

The provider is **StrictMode-safe**: a database is opened once per `dataDir` (an in-memory one belongs to its provider) and reference counted. React's mount, unmount, mount in development, a re-render, or two providers on the same `idb://` name never open it twice; it closes when the last user really unmounts, and a database that is still closing is awaited before the same name opens again. Only `dataDir`, `workerId` and `loadDataDir` re-open the database when they change; every other option is read when it opens, so an inline `migrations={[…]}` literal is fine.

`useDatabaseStatus()` returns `{ status: 'loading' | 'ready' | 'error', db, error, info, retry, invalidate }`. `info` has the Postgres version (`18.3`), the PGlite version, the data directory, whether it runs in a worker and which migrations this open applied.

## Size and loading

PGlite is a whole database, and it is not small. Measured from the 0.5.8 package:

| File | Size | gzip | When it is fetched |
| --- | --- | --- | --- |
| `pglite.wasm` | 10.1 MB | 3.4 MB | when a database opens |
| `pglite.data` | 6.3 MB | 1.9 MB | when a database opens |
| `initdb.wasm` | 0.4 MB | 0.14 MB | when a database opens (runs only the first time) |
| `pg_dump.wasm` | 0.7 MB | — | only on SQL export |
| JavaScript | ~0.6 MB | — | when a database opens |

About 5.4 MB gzipped (16.8 MB raw) crosses the wire the first time; the browser's HTTP cache keeps the binaries afterwards. In the docs' demo (Chromium, local dev server, uncompressed, warm disk) the database is ready about 0.9 s after navigation; on a real network it is the download that dominates. Serve the `.wasm` and `.data` files with gzip or brotli, `Content-Type: application/wasm` for the former, and long cache headers. Nothing downloads for a page that does not mount a provider — the e2e suite asserts that — and each binary is fetched once even under StrictMode.

Mount the provider as low in the tree as the feature needs, behind a route or a "load" button, rather than at the app root.

## Hosting the WebAssembly

By default PGlite resolves its binaries next to its own module with `new URL('./pglite.wasm', import.meta.url)`, which a bundler turns into hashed assets. To serve them from your own path or a CDN, pass `assets` (main-thread databases; a worker file configures its own):

```tsx
<PGliteProvider
  assets={{ wasm: '/pglite/pglite.wasm', initdbWasm: '/pglite/initdb.wasm', data: '/pglite/pglite.data' }}
/>
```

URLs are fetched and compiled before the database starts; a server that does not send `application/wasm` still works (the bytes are compiled instead of streamed).

**Content-Security-Policy.** Compiling WebAssembly needs `script-src 'wasm-unsafe-eval'` (not `'unsafe-eval'`). Workers need `worker-src 'self'` (or `blob:` if your bundler inlines them), and hosted assets must be allowed by `connect-src`.

**Vite.** Exclude the engine from dependency pre-bundling, which would separate the JavaScript from the files it loads by relative URL, and build workers as ES modules:

```ts
export default defineConfig({
  optimizeDeps: { exclude: ['@electric-sql/pglite', '@electric-sql/pglite-tools'] },
  worker: { format: 'es' },
})
```

**Next.js.** Import the provider only in client components (`'use client'`) and keep the engine out of the server bundle: `serverExternalPackages: ['@electric-sql/pglite']`. The module is safe to import on the server — nothing touches `window`, `indexedDB` or `navigator` until an effect runs — and the provider renders `fallback` on the server. Workers use `new Worker(new URL('./pglite.worker.ts', import.meta.url), { type: 'module' })`.

## Persistence

`dataDir` picks where the data lives:

| `dataDir` | Where | Survives reload | Notes |
| --- | --- | --- | --- |
| `memory://` (default) | memory | no | Fastest. Right for scratch work, demos and tests. |
| `idb://name` | IndexedDB | yes | Works on the main thread or in a worker. |
| `opfs-ahp://name` | origin private file system | yes | **Needs a Web Worker** (it uses synchronous file handles). Faster writes than IndexedDB. |

With `idb://`, PGlite flushes the changed pages to IndexedDB after each query, so a committed write survives a crash of the tab; `relaxedDurability` defers the flush to speed up bulk writes at the price of losing the last writes if the tab dies. A data directory is the same Postgres cluster on disk (`PG_VERSION`, `base/`, WAL), so the same compatibility rules as a real server apply (below).

Browsers may evict "best effort" storage under disk pressure. `usePersistenceSupport()` reports what this browser offers and lets you ask not to be evicted:

```tsx
const { indexedDB, opfs, locks, persisted, estimate, persist } = usePersistenceSupport()
// <Button onPress={persist}>Keep my data</Button>
// estimate: { usage, quota } in bytes
```

## One writer: tabs and workers

A PGlite database is a single connection with a single writer. Two tabs that both open the same `idb://` database on the main thread overwrite each other's pages and corrupt it. There are two safe designs:

1. **One tab at a time** — wrap the provider in `SingleTabGate` (or call `useTabLock(name)`). It takes an exclusive Web Lock named after the database; the browser drops it when the tab closes or crashes. A second tab renders `blocked` and gets the lock the moment the first lets go, or can ask the holder to step aside with `takeover()` (a BroadcastChannel message; the holder becomes blocked and may take it back). Where `navigator.locks` is missing (insecure origins) the lock **fails open** and reports `unsupported`: nothing is protected, so serve over HTTPS.
2. **One database, many tabs** — run PGlite in a worker (`worker` option). Tabs that start the same worker with the same `workerId` share one database through leader election, so they can all use it at once and `useLiveQuery` in one tab sees writes from another. This is also the only way to use OPFS. Give a tab its own unique `workerId` and you opt out of the sharing — and are back to needing the lock.

{% demo src="pglite/persistent" %}

{% demo src="pglite/worker" %}

The worker file is yours; it calls `worker({ init })` from `@electric-sql/pglite/worker` and passes the options through:

```ts
// pglite.worker.ts
import { PGlite } from '@electric-sql/pglite'
import { live } from '@electric-sql/pglite/live'
import { worker } from '@electric-sql/pglite/worker'

worker({ async init(options) { return PGlite.create({ ...options, extensions: { live } }) } })
```

```tsx
<PGliteProvider
  dataDir="opfs-ahp://app"
  worker={() => new Worker(new URL('./pglite.worker.ts', import.meta.url), { type: 'module' })}
/>
```

## Migrations

`runMigrations(db, migrations)` (the provider calls it for you) records each migration in `_bl_migrations` and applies new ones in order, **each in its own transaction together with its bookkeeping row**. It is idempotent, and it refuses to guess when history has drifted:

- the migrations a database has applied must be an unchanged **prefix** of your list — same ids, same order. Inserting a migration before an applied one, reordering, or dropping one throws a `MigrationError` (`kind: 'order'`, `'unknown-applied'`) naming the culprit; add new migrations at the end;
- an applied SQL migration whose text changed throws (`'changed'`; a 32-bit checksum detects edits, it is not a security hash);
- a migration that fails rolls back, stops the run and throws (`'failed'`); earlier ones stay applied, and fixing the failed one and running again works.

A database that is *ahead* of the app (opened by an older version after a newer one migrated it) is rejected rather than opened, because an old app would write to a schema it does not know.

## Queries

`useQuery(sql, params)` runs when the database is ready and again when `sql` or `params` change (an inline `[id]` literal does not re-run it), when a write goes through `useExec` / `useTransaction`, or on `refetch()`. A slow earlier run that finishes late is dropped. SQL errors arrive as `error` with the SQLSTATE and the position in the text.

`useLiveQuery` uses PGlite's `live` extension to push a new result whenever the tables the query reads change, from any writer — including another tab on a shared worker. Pass `key` (a unique column) for incremental diffing of large results.

{% demo src="pglite/live" %}

**Why not `@electric-sql/pglite-react`?** It is a fine wrapper, and this is the same idea in about forty lines, but its `useLiveQuery` returns `undefined` until the first result and has no error or loading state, it brings its own provider next to this one, and it pins an exact `@electric-sql/pglite` peer. Writing it against `db.live` ties it to this provider's status and keeps one provider. If you already use pglite-react, its provider takes a database you made yourself — the two do not conflict.

## Export and import

`exportDatabase(db, format)` returns a `File`, plus the Postgres version that wrote it:

| Format | What it is | Restores into |
| --- | --- | --- |
| `'sql'` | a plain-text dump made by pg_dump (WebAssembly build, loaded only on use) | any PGlite version, and real Postgres. **The backup format.** |
| `'datadir'` | a gzipped tarball of the live data directory | the **same Postgres major** only, best with the same PGlite release |

```tsx
const { file, postgresVersion } = await exportDatabase(db, 'sql')   // database-pg18.sql
downloadFile(file)                                                    // lib/pglite-files: the DOM part, separate from the pure function
```

`importDatabase(db, file)` applies a SQL dump to an open database. A script is one implicit transaction, so a dump that clashes with existing objects fails with `nothing was changed`; import into an empty database. `importDatabase({ dataDir: 'idb://restored' }, file)` creates a **new** database from a dump or a data-directory archive and returns it open. A data-directory archive is read for its `PG_VERSION` first and refused on a major mismatch before anything starts; loading into a name that already holds a database is refused too (`DATABASE_EXISTS`), and a data directory cannot be loaded into an open database at all.

### Postgres versions and your users' data

Postgres cannot open a data directory written by another major version. When PGlite upgrades the engine (0.4 → 0.5 was PostgreSQL 17 → 18) every persisted `idb://` database becomes unreadable until it is migrated. Other libraries delete and recreate the database at this point. This one **never deletes anything**: `peekDataDirVersion` reads the stored `PG_VERSION` without starting the engine, and an open that cannot work rejects with a `DataDirVersionError` naming both versions (`error.found`, `error.expected`), `status: 'error'` in the provider, and the data untouched. To recover:

1. keep the old PGlite version pinned until the data has been exported — open the database with it and `exportDatabase(db, 'sql')`;
2. upgrade, create a new database name and `importDatabase` the dump into it;
3. only then, from an explicit user action, `deleteDatabase('idb://old')`.

Ship a "Download backup" button for any data users cannot recreate, store SQL dumps rather than data-directory archives as the long-term copy, and record the Postgres version you exported from (the export result and the file name carry it).

## Security

PGlite stores pages in IndexedDB or OPFS **in the clear**. Anyone with access to the browser profile — malware, another person on a shared machine, a forensic copy — can read them, and any script running on your origin (an XSS, a compromised dependency) can read the same storage. Column-level encryption done in JavaScript breaks `WHERE`, `ORDER BY` and search and is not offered here. If the data is sensitive, do not keep it only in the browser, or encrypt it with a key you control; the passkey vault page describes keeping a key behind WebAuthn.

## Browser requirements

Required: WebAssembly (every current browser) and IndexedDB for `idb://`. `opfs-ahp://` needs a dedicated Web Worker and the origin private file system with synchronous access handles. The tab lock needs `navigator.locks` and a secure context (HTTPS or `localhost`); `BroadcastChannel` is used for takeover, and the lock still works without it. `Set.union` and other very recent APIs are not used.

What was verified: Chromium 151 (Playwright) on macOS — the hooks, `memory://`, `idb://`, `opfs-ahp://` in a worker, two tabs sharing a worker database, the tab lock and takeover between two pages, hosted assets, export and import, and the refused version mismatch. **Not verified:** Firefox and Safari. Check them yourself before shipping, especially OPFS in a worker and `navigator.locks`.

## Limits

- **One connection, one writer.** Queries run one at a time; a slow query blocks the rest, including `useLiveQuery` refreshes. Run heavy work in a worker so the UI thread stays free.
- **Memory.** The whole engine lives in the WebAssembly heap, on top of your data and its buffers; a mobile tab with a large database can be killed by the OS. Measure on the devices you target.
- **Extensions** such as pgvector are separate packages (`@electric-sql/pglite-pgvector` in 0.5.x; the old `@electric-sql/pglite/vector` import is gone). Pass them as `extensions={{ vector }}`. They are not part of this module.

## Hooks

### usePGlite()

Returns the open database, or `null` while it opens or after it failed. Pass a type argument to reach PGlite's own API: `usePGlite<PGlite>()`. `useReadyDatabase()` returns it or throws — for components rendered under a `fallback` provider.

### useDatabaseStatus()

`{ status, db, error, info, retry, invalidate, epoch }`. `error` is a `DataDirVersionError`, `MigrationError` or `PGliteError`. `invalidate()` re-runs every `useQuery` and `useSchema`.

### useQuery(sql, params?, options?)

`{ rows, fields, error, isLoading, refetch }`. Options: `enabled`, `watch` (re-run on invalidation, default true).

### useLiveQuery(sql, params?, options?)

`{ rows, fields, error, isLoading }`. Options: `key` (incremental), `enabled`.

### useExec()

`{ exec(sql), run(sql, params?), isPending, error, reset }`. `exec` runs several statements and returns a result each; `run` binds parameters. A successful write invalidates queries.

### useTransaction()

`{ transaction(async (tx) => …), isPending, error, reset }`. Throw inside the callback to roll back.

### useTabLock(name)

`{ status: 'pending' | 'held' | 'blocked' | 'unsupported', held, takeover }`. Components with the same name in one tab share one lock.

### useSchema(options?)

`{ schema, isLoading, error, refetch }` — schemas, tables, views, columns with types, primary and foreign keys and row counts, from `pg_catalog`. Options: `rowCounts` (`'exact'` default, `'estimate'`, `'none'`), `system`, `internal`.

### usePersistenceSupport()

`{ indexedDB, opfs, worker, locks, wasm, secureContext, persisted, estimate, persist, refresh }`.

## Props

### PGliteProvider

| Prop | Default | Effect |
| --- | --- | --- |
| `dataDir` | `memory://` | `memory://`, `idb://name` or `opfs-ahp://name`. Changing it re-opens. |
| `worker` | — | `() => Worker` — run in a Web Worker (required for OPFS). |
| `workerId` | — | Workers with the same id share one database across tabs. |
| `extensions` | — | PGlite extensions by namespace. `live` is always added unless `live={false}`. |
| `live` | `true` | Load the `live` extension (about 10 KB). |
| `migrations` | — | `{ id, sql }[]` applied in order after opening. |
| `loadDataDir` | — | A data-directory archive to restore into a **new** database. |
| `relaxedDurability` | `false` | Flush to IndexedDB lazily (faster bulk writes, can lose the last writes). |
| `assets` | — | `{ wasm, initdbWasm, data }` URLs to host the WebAssembly yourself. |
| `fallback` | — | Rendered instead of `children` while loading. |
| `errorFallback` | — | Node or `(error, retry) => Node`, rendered on failure. |
| `onReady` | — | Called with the database and its info once open and migrated. |

### SingleTabGate

| Prop | Default | Effect |
| --- | --- | --- |
| `name` | — | The lock name; the database name is a good choice. |
| `pending` | — | Rendered while the lock is being checked. |
| `blocked` | — | Node or `({ takeover }) => Node`, rendered in a tab that does not hold the lock. |

### Functions

| Function | Returns |
| --- | --- |
| `openDatabase(options)` | `{ db, info, close }` — no React needed. |
| `runMigrations(db, migrations, { table })` | `{ applied, skipped }`. |
| `runSql(db, sql)` | One result per statement, timing, and a normalised error with line and column; never throws for SQL errors. |
| `exportDatabase(db, 'sql' \| 'datadir', { fileName, args })` | `{ file, format, postgresVersion, postgresMajor, pgliteVersion, bytes }`. |
| `importDatabase(db \| config, file)` | `{ format, sourceVersion, warnings, applied }` (plus the open database for a config). |
| `peekDataDirVersion(dataDir)` | The stored Postgres major of an `idb://` database, without starting PGlite. |
| `deleteDatabase(dataDir)` | Deletes a persisted database. Destroys data: call it from an explicit user action. |
| `loadSchema(db, options)` | The data behind `useSchema`. |
| `toSqlError(error, sql?)` | `{ message, code, position, line, column, detail, hint }`. |

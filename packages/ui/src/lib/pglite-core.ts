/* PGlite — Postgres compiled to WebAssembly — without React: opening a database, migrations, running SQL, error
   normalisation and data-directory helpers. `lib/pglite.tsx` wraps this in a provider and hooks.

   Everything is lazy. `@electric-sql/pglite` is imported dynamically inside `openDatabase`, so an app that never opens
   a database never downloads the ~10 MB WebAssembly module. The package is an optional peer dependency; the types
   below are structural (PGlite satisfies them) so this file's public types never reference it. No `window`,
   `indexedDB` or `navigator` access at module scope — safe to import on the server. */
import { positionToLineColumn, splitStatements } from '@/lib/sql-lex';

/* ── Structural types: what BL UI needs from a PGlite instance (a PGlite or a PGliteWorker satisfies them) ── */

export interface SqlField {
  name: string;
  /** The column's type OID (see `pgTypeName` in lib/sql-format). */
  dataTypeID: number;
}

export interface SqlResult<T = Record<string, unknown>> {
  rows: T[];
  fields: SqlField[];
  /** Rows changed so far in a multi-statement `exec` (cumulative); prefer `rowCount`. */
  affectedRows?: number;
  /** `SELECT`, `INSERT`, `CREATE`, … */
  command?: string;
  /** Rows returned or changed by this statement alone. */
  rowCount?: number;
}

export interface SqlRunner {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<SqlResult<T>>;
  exec(sql: string): Promise<SqlResult[]>;
}

export interface SqlTransaction extends SqlRunner {
  rollback(): Promise<void>;
}

export interface LiveQueryHandle<T = Record<string, unknown>> {
  initialResults: SqlResult<T>;
  subscribe(callback: (results: SqlResult<T>) => void): void;
  unsubscribe(callback?: (results: SqlResult<T>) => void): Promise<void>;
  refresh(): Promise<void>;
}

/** PGlite's `live` extension namespace. */
export interface LiveNamespace {
  query<T = Record<string, unknown>>(query: string, params?: unknown[] | null, callback?: (results: SqlResult<T>) => void): Promise<LiveQueryHandle<T>>;
  incrementalQuery<T = Record<string, unknown>>(query: string, params: unknown[] | undefined | null, key: string, callback?: (results: SqlResult<T>) => void): Promise<LiveQueryHandle<T>>;
}

/** An open database: a `PGlite` (main thread) or `PGliteWorker` (worker) instance. Cast to `PGlite` to reach the rest of its API. */
export interface Database extends SqlRunner {
  readonly closed: boolean;
  transaction<T>(callback: (tx: SqlTransaction) => Promise<T>): Promise<T>;
  close(): Promise<void>;
  dumpDataDir(compression?: 'none' | 'gzip' | 'auto'): Promise<File | Blob>;
  /** Present unless the provider was opened with `live: false`. */
  live?: LiveNamespace;
}

/* ── Errors ── */

export type PGliteErrorCode =
  | 'OPEN_FAILED'
  | 'VERSION_MISMATCH'
  | 'DATABASE_EXISTS'
  | 'UNSUPPORTED'
  | 'IMPORT_FAILED'
  | 'EXPORT_FAILED'
  | 'LOCKED';

/** Something went wrong opening, importing or exporting a database. `cause` carries the original error. */
export class PGliteError extends Error {
  readonly code: PGliteErrorCode;
  constructor(code: PGliteErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'PGliteError';
    this.code = code;
  }
}

/** The data directory was written by a different Postgres major version than the one this PGlite build runs.
    Nothing is deleted or modified: open it with the PGlite release that wrote it, export it as SQL, and import that. */
export class DataDirVersionError extends PGliteError {
  /** Major version in the data directory's `PG_VERSION` (`'17'`). */
  readonly found: string;
  /** Major version of the running engine (`'18'`), when known. */
  readonly expected: string | undefined;
  readonly dataDir: string;
  constructor(dataDir: string, found: string, expected: string | undefined, options?: { cause?: unknown }) {
    super(
      'VERSION_MISMATCH',
      `"${dataDir}" was created by Postgres ${found}, but this build of PGlite runs Postgres ${expected ?? 'a different major version'}. ` +
        `The data was left untouched. Open it with the PGlite release that created it and export a SQL dump, then import that dump into a new database. ` +
        `Pin the @electric-sql/pglite version so upgrades are deliberate.`,
      options,
    );
    this.name = 'DataDirVersionError';
    this.found = found;
    this.expected = expected;
    this.dataDir = dataDir;
  }
}

export type MigrationErrorKind = 'unknown-applied' | 'order' | 'changed' | 'duplicate' | 'failed';

/** A migration problem: the database's history does not match the list (drift), or one migration failed (and was rolled back). */
export class MigrationError extends Error {
  readonly kind: MigrationErrorKind;
  readonly migration?: string;
  constructor(kind: MigrationErrorKind, message: string, options?: { migration?: string; cause?: unknown }) {
    super(message, options?.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'MigrationError';
    this.kind = kind;
    this.migration = options?.migration;
  }
}

/** A database error in a form a UI can show: the message, SQLSTATE code and where in the SQL it happened. */
export interface SqlError {
  message: string;
  /** SQLSTATE, e.g. `42P01` (undefined table). */
  code?: string;
  severity?: string;
  detail?: string;
  hint?: string;
  /** 1-based character position of the error in the SQL that was run. */
  position?: number;
  line?: number;
  column?: number;
}

/** Normalises whatever was thrown (a PGlite `DatabaseError`, a plain Error, a string) into a {@link SqlError}. `sql` adds line and column. */
export function toSqlError(error: unknown, sql?: string): SqlError {
  const e = (error ?? {}) as Record<string, unknown>;
  const message = typeof error === 'string' ? error : typeof e.message === 'string' ? e.message : 'Unknown error';
  const out: SqlError = { message };
  if (typeof e.code === 'string') out.code = e.code;
  if (typeof e.severity === 'string') out.severity = e.severity;
  if (typeof e.detail === 'string') out.detail = e.detail;
  if (typeof e.hint === 'string') out.hint = e.hint;
  const position = typeof e.position === 'string' || typeof e.position === 'number' ? Number(e.position) : NaN;
  if (Number.isFinite(position) && position > 0) {
    out.position = position;
    if (sql !== undefined) Object.assign(out, positionToLineColumn(sql, position));
  }
  return out;
}

/* ── Identifiers and literals ── */

/** `"my table"` — an identifier quoted for SQL. */
export function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

const RESERVED = new Set(
  ('all analyse analyze and any array as asc asymmetric both case cast check collate column constraint create current_catalog current_date ' +
    'current_role current_time current_timestamp current_user default deferrable desc distinct do else end except false fetch for foreign from ' +
    'grant group having in initially intersect into lateral leading limit localtime localtimestamp not null offset on only or order placing ' +
    'primary references returning select session_user some symmetric table then to trailing true union unique user using variadic when where window with').split(' '),
);

/** An identifier as you would type it: bare when it is a plain lowercase name, quoted when it has capitals, spaces or is a reserved word. */
export function identifier(name: string): string {
  return /^[a-z_][a-z0-9_$]*$/.test(name) && !RESERVED.has(name) ? name : quoteIdent(name);
}

/** `'it''s'` — a string literal quoted for SQL (prefer query parameters for values). */
export function quoteLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/* ── Data directories ── */

export type DataDirKind = 'memory' | 'idb' | 'opfs-ahp' | 'nodefs';

export interface ParsedDataDir {
  kind: DataDirKind;
  /** The database name (the part after `idb://` / `opfs-ahp://`; the path for `file://`). */
  name: string;
  /** The normalised string PGlite takes. */
  dataDir: string;
}

/** `memory://` (default) | `idb://<name>` | `opfs-ahp://<name>` | `file://<path>` (Node and Bun). */
export function parseDataDir(dataDir: string | undefined): ParsedDataDir {
  const dir = dataDir?.trim() || 'memory://';
  if (dir.startsWith('memory://')) return { kind: 'memory', name: '', dataDir: 'memory://' };
  if (dir.startsWith('idb://')) return { kind: 'idb', name: dir.slice(6), dataDir: dir };
  if (dir.startsWith('opfs-ahp://')) return { kind: 'opfs-ahp', name: dir.slice(11), dataDir: dir };
  if (dir.startsWith('file://')) return { kind: 'nodefs', name: dir.slice(7), dataDir: dir };
  return { kind: 'nodefs', name: dir, dataDir: dir };
}

const idbName = (name: string) => `/pglite/${name}`;

function requireIdb(): IDBFactory {
  if (typeof indexedDB === 'undefined') throw new PGliteError('UNSUPPORTED', 'IndexedDB is not available here; use dataDir "memory://".');
  return indexedDB;
}

/** The Postgres major version recorded in an `idb://` database (its `PG_VERSION` file), `null` if the database does
    not exist (or is not readable), without starting PGlite. Other data-dir kinds return `null`. */
export async function peekDataDirVersion(dataDir: string): Promise<string | null> {
  const parsed = parseDataDir(dataDir);
  if (parsed.kind !== 'idb' || typeof indexedDB === 'undefined') return null;
  const path = idbName(parsed.name);
  const dbs = typeof indexedDB.databases === 'function' ? await indexedDB.databases() : undefined;
  if (dbs && !dbs.some((d) => d.name === path)) return null;
  return new Promise<string | null>((resolve) => {
    const req = indexedDB.open(path);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
    req.onupgradeneeded = () => {
      // The database did not exist: opening created an empty one. Abort so we leave nothing behind.
      req.transaction?.abort();
    };
    req.onsuccess = () => {
      const db = req.result;
      try {
        if (!db.objectStoreNames.contains('FILE_DATA')) return resolve(null);
        const get = db.transaction(['FILE_DATA'], 'readonly').objectStore('FILE_DATA').get(`${path}/PG_VERSION`);
        get.onerror = () => resolve(null);
        get.onsuccess = () => {
          const contents = (get.result as { contents?: ArrayBufferView } | undefined)?.contents;
          resolve(contents ? new TextDecoder().decode(contents).trim() || null : null);
        };
      } catch {
        resolve(null);
      } finally {
        // Closing after the request settles is safe: the transaction keeps the connection alive until it completes.
        db.close();
      }
    };
  });
}

/** Deletes a persisted database. This destroys data — call it only from an explicit user action. Resolves when the
    delete went through; rejects after `timeoutMs` if another connection (a tab, a worker) keeps it open. */
export async function deleteDatabase(dataDir: string, { timeoutMs = 5000 }: { timeoutMs?: number } = {}): Promise<void> {
  const parsed = parseDataDir(dataDir);
  if (parsed.kind === 'opfs-ahp') {
    const root = await navigator.storage.getDirectory();
    await root.removeEntry(parsed.name, { recursive: true }).catch((e: unknown) => {
      if ((e as DOMException)?.name !== 'NotFoundError') throw e;
    });
    return;
  }
  if (parsed.kind !== 'idb') return;
  const factory = requireIdb();
  const started = Date.now();
  for (;;) {
    const done = await new Promise<boolean>((resolve, reject) => {
      const req = factory.deleteDatabase(idbName(parsed.name));
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error ?? new Error('Could not delete the database'));
      // Blocked by an open connection (often a close still finishing): try again shortly.
      req.onblocked = () => resolve(false);
    });
    if (done) return;
    if (Date.now() - started > timeoutMs) throw new PGliteError('LOCKED', `"${dataDir}" is still open in another tab or worker, so it could not be deleted.`);
    await new Promise((r) => setTimeout(r, 100));
  }
}

/* ── Opening ── */

/** Where PGlite's binaries come from. By default PGlite resolves them next to its own module with
    `new URL('./pglite.wasm', import.meta.url)`, which a bundler turns into an asset. Set these to host them yourself
    (a CDN, a path your server compresses and caches) — URLs are fetched and compiled before the database starts.
    Main-thread databases only: a worker file configures its own. */
export interface PGliteAssets {
  /** `pglite.wasm`, the Postgres engine (~10 MB, ~3.4 MB gzip). */
  wasm?: string | URL;
  /** `initdb.wasm`, runs only when a database is created (~0.4 MB). */
  initdbWasm?: string | URL;
  /** `pglite.data`, the Postgres share files (~6 MB). */
  data?: string | URL;
}

export interface Migration {
  /** Unique and stable (`001_init`, `2026-10-02-add-notes`). Order in the list is the order they run in. */
  id: string;
  /** SQL (may hold several statements) or a function that receives the migration's transaction. */
  sql: string | ((tx: SqlTransaction) => Promise<void>);
}

export interface OpenDatabaseOptions {
  /** `memory://` (default), `idb://<name>` or `opfs-ahp://<name>`. */
  dataDir?: string;
  /** Run PGlite in a Web Worker: returns the `Worker` (`() => new Worker(new URL('./pglite.worker.ts', import.meta.url), { type: 'module' })`).
      The worker file calls `worker({ init })` from `@electric-sql/pglite/worker`. With the default id, every tab that
      starts the same worker shares ONE database through leader election, so several tabs can use it at once. */
  worker?: () => Worker;
  /** PGliteWorker's `id`: workers with the same id share one database across tabs; a unique id opts out. */
  workerId?: string;
  /** PGlite extensions by namespace (`{ vector }` from `@electric-sql/pglite-pgvector`). `live` is added unless `live` is false. */
  extensions?: Record<string, unknown>;
  /** Load the `live` extension (`useLiveQuery`). Default true (it is ~10 KB). */
  live?: boolean;
  /** Applied after the database opens (see {@link runMigrations}). */
  migrations?: readonly Migration[];
  /** Restore a data-directory archive from `exportDatabase(db, 'datadir')`. Only into a database that does not exist yet. */
  loadDataDir?: Blob;
  /** Flush to IndexedDB lazily instead of after every query: faster bulk writes, the last writes can be lost if the tab dies. */
  relaxedDurability?: boolean;
  assets?: PGliteAssets;
  /** PGlite's debug level, 0–5. */
  debug?: 0 | 1 | 2 | 3 | 4 | 5;
}

export interface DatabaseInfo {
  dataDir: string;
  kind: DataDirKind;
  /** `18.3` — `server_version`. */
  serverVersion: string;
  /** `18` */
  serverMajor: number;
  /** `0.5.8`, from `version()`, when reported. */
  pgliteVersion?: string;
  /** Running in a Web Worker. */
  worker: boolean;
  /** Applied by this open (empty when the database was already up to date). */
  migrated: string[];
  /** The `PG_VERSION` the data directory had before this open (`undefined` for a new database). */
  previousMajor?: string;
}

export interface OpenedDatabase {
  db: Database;
  info: DatabaseInfo;
}

type PGliteModule = typeof import('@electric-sql/pglite');

async function compile(url: string | URL): Promise<WebAssembly.Module> {
  const res = await fetch(url);
  if (!res.ok) throw new PGliteError('OPEN_FAILED', `Could not fetch ${String(url)} (${res.status}).`);
  try {
    return await WebAssembly.compileStreaming(res.clone());
  } catch {
    // A server that does not send `Content-Type: application/wasm` makes compileStreaming throw; compile the bytes.
    return WebAssembly.compile(await res.arrayBuffer());
  }
}

async function resolveAssets(assets: PGliteAssets | undefined) {
  if (!assets) return {};
  const [pgliteWasmModule, initdbWasmModule, fsBundle] = await Promise.all([
    assets.wasm ? compile(assets.wasm) : undefined,
    assets.initdbWasm ? compile(assets.initdbWasm) : undefined,
    assets.data ? fetch(assets.data).then((r) => (r.ok ? r.blob() : Promise.reject(new PGliteError('OPEN_FAILED', `Could not fetch ${String(assets.data)} (${r.status}).`)))) : undefined,
  ]);
  return { pgliteWasmModule, initdbWasmModule, fsBundle };
}

/** The server's version, from an open database. */
export async function readServerInfo(db: SqlRunner): Promise<{ serverVersion: string; serverMajor: number; pgliteVersion?: string }> {
  const { rows } = await db.query<{ v: string; full: string }>(`select current_setting('server_version') as v, version() as full`);
  const serverVersion = rows[0]?.v ?? '';
  return {
    serverVersion,
    serverMajor: parseInt(serverVersion, 10) || 0,
    pgliteVersion: /PGlite ([\w.-]+)/.exec(rows[0]?.full ?? '')?.[1],
  };
}

/** Postgres major version of this build of PGlite, found by starting a throwaway in-memory database (~0.5 s, cached). */
let runtimeMajor: Promise<string> | undefined;
export function runtimePostgresMajor(): Promise<string> {
  return (runtimeMajor ??= (async () => {
    const { PGlite } = (await import('@electric-sql/pglite')) as PGliteModule;
    const db = await PGlite.create();
    try {
      return String((await readServerInfo(db as unknown as SqlRunner)).serverMajor);
    } finally {
      await db.close();
    }
  })().catch((e) => {
    runtimeMajor = undefined;
    throw e;
  }));
}

/** Opens a database. Imports PGlite on first use. Never deletes or rewrites existing data: a data directory from a
    different Postgres major version rejects with {@link DataDirVersionError} instead. */
export async function openDatabase(options: OpenDatabaseOptions = {}): Promise<OpenedDatabase & { close(): Promise<void> }> {
  const parsed = parseDataDir(options.dataDir);
  const previousMajor = (await peekDataDirVersion(parsed.dataDir)) ?? undefined;
  if (options.loadDataDir && previousMajor) {
    throw new PGliteError(
      'DATABASE_EXISTS',
      `"${parsed.dataDir}" already exists, and a data-directory archive can only be loaded into a new database. Choose another name, or delete it first (this destroys its data).`,
    );
  }

  let worker: Worker | undefined;
  let db: Database | undefined;
  try {
    const core = (await import('@electric-sql/pglite')) as PGliteModule;
    const extensions: Record<string, unknown> = { ...options.extensions };
    if (options.live !== false) extensions.live = (await import('@electric-sql/pglite/live')).live;

    if (options.worker) {
      const { PGliteWorker } = await import('@electric-sql/pglite/worker');
      worker = options.worker();
      db = (await PGliteWorker.create(worker, {
        dataDir: parsed.dataDir,
        extensions: extensions as never,
        id: options.workerId,
        relaxedDurability: options.relaxedDurability,
        loadDataDir: options.loadDataDir,
        debug: options.debug,
      } as never)) as unknown as Database;
    } else {
      db = (await core.PGlite.create({
        dataDir: parsed.dataDir,
        extensions: extensions as never,
        relaxedDurability: options.relaxedDurability,
        loadDataDir: options.loadDataDir,
        debug: options.debug,
        ...(await resolveAssets(options.assets)),
      })) as unknown as Database;
    }

    const server = await readServerInfo(db);
    if (previousMajor && previousMajor !== String(server.serverMajor)) {
      throw new DataDirVersionError(parsed.dataDir, previousMajor, String(server.serverMajor));
    }
    const migrated = options.migrations?.length ? (await runMigrations(db, options.migrations)).applied : [];
    const opened = db;
    const info: DatabaseInfo = { dataDir: parsed.dataDir, kind: parsed.kind, ...server, worker: !!worker, migrated, previousMajor };
    return {
      db: opened,
      info,
      close: async () => {
        await opened.close().catch(() => undefined);
        worker?.terminate();
      },
    };
  } catch (error) {
    await db?.close().catch(() => undefined);
    worker?.terminate();
    if (error instanceof PGliteError || error instanceof MigrationError) throw error;
    // The engine could not start. If the stored data is from another Postgres major, that is why: say so, touch nothing.
    if (previousMajor) {
      const expected = await runtimePostgresMajor().catch(() => undefined);
      if (expected && expected !== previousMajor) throw new DataDirVersionError(parsed.dataDir, previousMajor, expected, { cause: error });
    }
    throw new PGliteError('OPEN_FAILED', `Could not open "${parsed.dataDir}": ${toSqlError(error).message}`, { cause: error });
  }
}

/* ── Migrations ── */

export interface MigrationOptions {
  /** The bookkeeping table (default `_bl_migrations`). */
  table?: string;
}

export interface MigrationResult {
  /** Ids applied by this call, in order. */
  applied: string[];
  /** How many were already applied. */
  skipped: number;
}

/** FNV-1a (32-bit) of the SQL text, as hex: detects an edited migration. Not a security hash. */
function checksum(sql: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < sql.length; i++) {
    h ^= sql.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** Applies migrations in order, each in its own transaction together with its bookkeeping row.
 *
 *  - Idempotent: calling it again applies only what is new.
 *  - Drift is an error, never repaired: the migrations the database has applied must be a **prefix** of `migrations`
 *    (same ids, same order), and an applied SQL migration whose text changed is rejected. A database that has applied
 *    migrations the list no longer contains (an older app version opened a newer database) is rejected too.
 *  - A failing migration rolls back, stops the run and throws a {@link MigrationError} naming it; earlier ones stay applied. */
export async function runMigrations(db: Pick<Database, 'transaction' | 'exec' | 'query'>, migrations: readonly Migration[], { table = '_bl_migrations' }: MigrationOptions = {}): Promise<MigrationResult> {
  const seen = new Set<string>();
  for (const m of migrations) {
    if (seen.has(m.id)) throw new MigrationError('duplicate', `Migration id "${m.id}" appears more than once.`, { migration: m.id });
    seen.add(m.id);
  }
  const t = quoteIdent(table);
  await db.exec(`create table if not exists ${t} (position integer primary key, id text not null unique, checksum text, applied_at timestamptz not null default now())`);
  const { rows: applied } = await db.query<{ position: number; id: string; checksum: string | null }>(`select position, id, checksum from ${t} order by position`);

  if (applied.length > migrations.length) {
    const extra = applied.slice(migrations.length).map((a) => a.id);
    throw new MigrationError(
      'unknown-applied',
      `The database has applied migrations this app does not know: ${extra.join(', ')}. It was probably migrated by a newer version of the app; refusing to open it.`,
      { migration: extra[0] },
    );
  }
  applied.forEach((a, i) => {
    const m = migrations[i];
    if (a.id !== m.id) {
      throw new MigrationError(
        'order',
        `Migration history has drifted: position ${i + 1} is "${a.id}" in the database but "${m.id}" in the list. Applied migrations must be an unchanged prefix of the list; add new migrations at the end.`,
        { migration: m.id },
      );
    }
    if (typeof m.sql === 'string' && a.checksum && a.checksum !== checksum(m.sql)) {
      throw new MigrationError('changed', `Migration "${m.id}" was edited after it was applied. Add a new migration instead of changing an applied one.`, { migration: m.id });
    }
  });

  const done: string[] = [];
  for (let i = applied.length; i < migrations.length; i++) {
    const m = migrations[i];
    try {
      await db.transaction(async (tx) => {
        if (typeof m.sql === 'string') await tx.exec(m.sql);
        else await m.sql(tx);
        await tx.query(`insert into ${t} (position, id, checksum) values ($1, $2, $3)`, [i + 1, m.id, typeof m.sql === 'string' ? checksum(m.sql) : null]);
      });
    } catch (cause) {
      throw new MigrationError('failed', `Migration "${m.id}" failed and was rolled back: ${toSqlError(cause).message}`, { migration: m.id, cause });
    }
    done.push(m.id);
  }
  return { applied: done, skipped: applied.length };
}

/* ── Running SQL ── */

export interface StatementResult extends SqlResult {
  /** The statement's SQL, when the script could be split reliably. */
  statement?: string;
}

export interface RunOutcome {
  results: StatementResult[];
  /** Wall-clock time of the whole script. */
  durationMs: number;
  /** Set when a statement failed; `results` is then empty (a script is one implicit transaction, so nothing was applied). */
  error?: SqlError;
  /** Statements in the script that ran (or tried to). */
  statementCount: number;
}

/** Runs a script of one or more statements through `exec` and returns one result per statement. A script without its
 *  own BEGIN/COMMIT is one implicit transaction, so a failure applies none of it; the error carries the position. Never throws for SQL errors. */
export async function runSql(db: Pick<Database, 'exec'>, sql: string): Promise<RunOutcome> {
  const statements = splitStatements(sql);
  const started = performance.now();
  try {
    const results = await db.exec(sql);
    const aligned = results.length === statements.length;
    return {
      results: results.map((r, i) => ({ ...r, statement: aligned ? statements[i].text : undefined })),
      durationMs: performance.now() - started,
      statementCount: statements.length,
    };
  } catch (error) {
    // An explicit BEGIN leaves the session in an aborted transaction after an error; end it so the next run works.
    if (/\b(begin|start\s+transaction)\b/i.test(sql)) await db.exec('rollback').catch(() => undefined);
    return { results: [], durationMs: performance.now() - started, error: toSqlError(error, sql), statementCount: statements.length };
  }
}

'use client';
import {
  createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState,
  type ReactNode,
} from 'react';
import {
  openDatabase, parseDataDir, toSqlError,
  type Database, type DatabaseInfo, type Migration, type OpenDatabaseOptions, type PGliteAssets,
  type SqlError, type SqlResult, type SqlTransaction,
} from '@/lib/pglite-core';

/* ══ PGlite for React ══
   `PGliteProvider` opens a database (lazily: the WebAssembly downloads when the first provider mounts, never before)
   and shares it through hooks: `usePGlite`, `useDatabaseStatus`, `useQuery`, `useLiveQuery`, `useExec`,
   `useTransaction`. The pure parts — opening, migrations, errors — are in `lib/pglite-core`.

   Lifecycle. A database is opened once per key (`dataDir`, or a per-provider key for `memory://`) and reference
   counted: StrictMode's mount → unmount → mount, a re-render, or two providers on the same `idb://` name never open it
   twice; it closes when the last user really unmounts. Closing is deferred one tick so a StrictMode remount keeps the
   open database, and a database that is still closing is awaited before the same name opens again. */

/* ── The registry: one open database per key, reference counted ── */

interface Open {
  db: Database;
  info: DatabaseInfo;
}

interface Entry {
  key: string;
  refs: number;
  promise: Promise<Open>;
  closeTimer: ReturnType<typeof setTimeout> | null;
  /** Settles when the underlying database has closed (or failed to open). */
  closed: Promise<void> | null;
  close: () => Promise<void>;
}

const registry = new Map<string, Entry>();
/** Entries that are closing: the same key must wait for them. */
const closing = new Map<string, Promise<void>>();

function acquireEntry(key: string, options: () => OpenDatabaseOptions): Entry {
  let entry = registry.get(key);
  if (!entry) {
    const created: Entry = { key, refs: 0, promise: undefined as never, closeTimer: null, closed: null, close: async () => undefined };
    created.promise = (async () => {
      await closing.get(key); // a previous holder of this database is still closing
      const opened = await openDatabase(options());
      created.close = opened.close;
      return { db: opened.db, info: opened.info };
    })();
    // A failed open leaves nothing to close and must not stay cached: the next acquire (a retry) starts fresh.
    created.promise.catch(() => {
      if (registry.get(key) === created) registry.delete(key);
    });
    registry.set(key, created);
    entry = created;
  }
  if (entry.closeTimer) {
    clearTimeout(entry.closeTimer);
    entry.closeTimer = null;
  }
  entry.refs++;
  return entry;
}

function releaseEntry(entry: Entry) {
  if (--entry.refs > 0) return;
  entry.closeTimer = setTimeout(() => {
    if (entry.refs > 0) return;
    if (registry.get(entry.key) === entry) registry.delete(entry.key);
    const done = entry.promise.then(() => entry.close(), () => undefined).finally(() => {
      if (closing.get(entry.key) === done) closing.delete(entry.key);
    });
    closing.set(entry.key, done);
  }, 0);
}

/* ── Context ── */

export type DatabaseStatus = 'loading' | 'ready' | 'error';

export interface DatabaseState {
  status: DatabaseStatus;
  /** The open database; `null` until `status` is `ready`. */
  db: Database | null;
  /** What went wrong opening it. A {@link DataDirVersionError} (`code === 'VERSION_MISMATCH'`) means the stored data is from another Postgres major. */
  error: Error | null;
  /** Postgres and PGlite versions, data directory, migrations applied by this open. */
  info: DatabaseInfo | null;
  /** Open again after an `error`. */
  retry: () => void;
  /** Re-runs every `useQuery` / `useSchema` on this provider. Writes made through `useExec` / `useTransaction` call it for you. */
  invalidate: () => void;
  /** Counts `invalidate()` calls. */
  epoch: number;
}

const noop = () => undefined;
const DatabaseContext = createContext<DatabaseState>({
  status: 'loading', db: null, error: null, info: null, retry: noop, invalidate: noop, epoch: 0,
});

export interface PGliteProviderProps {
  /** `memory://` (default: gone on reload), `idb://<name>` (IndexedDB) or `opfs-ahp://<name>` (the origin private file system; needs `worker`). */
  dataDir?: string;
  /** Run PGlite in a Web Worker: `() => new Worker(new URL('./pglite.worker.ts', import.meta.url), { type: 'module' })`. Tabs sharing a `workerId` share one database. */
  worker?: () => Worker;
  workerId?: string;
  extensions?: Record<string, unknown>;
  /** Load the `live` extension for `useLiveQuery`. Default true. */
  live?: boolean;
  /** Applied after the database opens, in order; the applied ones must stay an unchanged prefix of the list. */
  migrations?: readonly Migration[];
  /** Restore a data-directory archive into a new database. */
  loadDataDir?: Blob;
  relaxedDurability?: boolean;
  /** Host the WebAssembly yourself (main-thread databases). */
  assets?: PGliteAssets;
  /** Shown instead of `children` while the database opens. Without it, children render at once and the hooks report the status. */
  fallback?: ReactNode;
  /** Shown instead of `children` when it fails to open. Without it, children render and `useDatabaseStatus().error` has the error. */
  errorFallback?: ReactNode | ((error: Error, retry: () => void) => ReactNode);
  /** Called once the database is open and migrated. */
  onReady?: (db: Database, info: DatabaseInfo) => void;
  children?: ReactNode;
}

/** Opens a database and provides it to the hooks below. Only `dataDir`, `workerId` and `loadDataDir` re-open the
    database when they change; the other options are read when it opens. */
export function PGliteProvider({
  dataDir = 'memory://', worker, workerId, extensions, live, migrations, loadDataDir, relaxedDurability, assets,
  fallback, errorFallback, onReady, children,
}: PGliteProviderProps) {
  const instance = useId();
  const [attempt, setAttempt] = useState(0);
  const [epoch, setEpoch] = useState(0);
  const [state, setState] = useState<{ status: DatabaseStatus; db: Database | null; error: Error | null; info: DatabaseInfo | null }>({
    status: 'loading', db: null, error: null, info: null,
  });

  // The latest options, read when the database opens (inline `migrations={[…]}` literals do not re-open anything).
  const latest = useRef<OpenDatabaseOptions>({});
  latest.current = { dataDir, worker, workerId, extensions, live, migrations, loadDataDir, relaxedDurability, assets };
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  const kind = parseDataDir(dataDir).kind;
  // An in-memory database belongs to its provider; a persisted one is shared by name.
  const key = kind === 'memory' ? `memory://${instance}` : `${parseDataDir(dataDir).dataDir}${workerId ? `#${workerId}` : ''}${loadDataDir ? '#load' : ''}`;

  useEffect(() => {
    let cancelled = false;
    setState((s) => (s.status === 'loading' && !s.db && !s.error ? s : { status: 'loading', db: null, error: null, info: null }));
    const entry = acquireEntry(key, () => latest.current);
    entry.promise.then(
      ({ db, info }) => {
        if (cancelled) return;
        setState({ status: 'ready', db, error: null, info });
        onReadyRef.current?.(db, info);
      },
      (error: unknown) => {
        if (cancelled) return;
        setState({ status: 'error', db: null, error: error instanceof Error ? error : new Error(String(error)), info: null });
      },
    );
    return () => {
      cancelled = true;
      releaseEntry(entry);
    };
  }, [key, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const invalidate = useCallback(() => setEpoch((n) => n + 1), []);
  const value = useMemo<DatabaseState>(() => ({ ...state, retry, invalidate, epoch }), [state, retry, invalidate, epoch]);

  let content = children;
  if (state.status === 'loading' && fallback !== undefined) content = fallback;
  else if (state.status === 'error' && errorFallback !== undefined) {
    content = typeof errorFallback === 'function' ? errorFallback(state.error as Error, retry) : errorFallback;
  }
  return <DatabaseContext.Provider value={value}>{content}</DatabaseContext.Provider>;
}

/* ── Hooks ── */

/** The database and its status. */
export function useDatabaseStatus(): DatabaseState {
  return useContext(DatabaseContext);
}

/** The open database, or `null` while it opens (or failed to). Cast the type argument to reach PGlite's own API: `usePGlite<PGlite>()`. */
export function usePGlite<T extends Database = Database>(): T | null {
  return useContext(DatabaseContext).db as T | null;
}

/** The open database; throws when there is none. For components rendered under a `fallback` provider (children mount only once ready). */
export function useReadyDatabase<T extends Database = Database>(): T {
  const { db, status } = useContext(DatabaseContext);
  if (!db) throw new Error(`useReadyDatabase: the database is ${status}. Render this component under <PGliteProvider fallback={…}> or check useDatabaseStatus().`);
  return db as T;
}

/** A stable key for a params array, so inline `[id]` literals do not re-run a query every render. */
function paramsKey(params: readonly unknown[] | undefined): string {
  if (!params?.length) return '';
  return JSON.stringify(params, (_k, v: unknown) => (typeof v === 'bigint' ? `${v}n` : v instanceof Uint8Array ? Array.from(v) : v));
}

export interface QueryState<T> {
  rows: T[];
  fields: SqlResult<T>['fields'];
  /** The error of the last run (parse errors, missing tables, …) with its position in the SQL. */
  error: SqlError | null;
  /** True while the first result is loading and while a re-run is in flight. */
  isLoading: boolean;
  /** Run again now. Resolves when the new result is in. */
  refetch: () => Promise<void>;
}

export interface UseQueryOptions {
  /** `false` waits (the query is not run). Default true. */
  enabled?: boolean;
  /** Re-run when something calls `invalidate()` (writes through `useExec` / `useTransaction`). Default true. */
  watch?: boolean;
}

const EMPTY: never[] = [];

/** Runs `sql` once the database is ready and again whenever `sql` or `params` change, a write goes through
    `useExec` / `useTransaction`, or `refetch()` is called. Stale results (an older run finishing late) are dropped.
    For results that follow the database's own changes, use `useLiveQuery`. */
export function useQuery<T = Record<string, unknown>>(sql: string, params?: readonly unknown[], { enabled = true, watch = true }: UseQueryOptions = {}): QueryState<T> {
  const { db, epoch, status, error: dbError } = useDatabaseStatus();
  const [state, setState] = useState<{ rows: T[]; fields: SqlResult<T>['fields']; error: SqlError | null; loading: boolean }>({
    rows: EMPTY, fields: EMPTY, error: null, loading: true,
  });
  const [manual, setManual] = useState(0);
  const run = useRef(0);
  // `watch: false` keeps the effect from re-running on invalidation.
  const watchEpoch = watch ? epoch : 0;
  const pKey = paramsKey(params);
  const paramsRef = useRef(params);
  paramsRef.current = params;
  const resolvers = useRef<(() => void)[]>([]);

  useEffect(() => {
    if (!db || !enabled) return;
    const id = ++run.current;
    setState((s) => (s.loading ? s : { ...s, loading: true }));
    db.query<T>(sql, paramsRef.current ? [...paramsRef.current] : undefined).then(
      (r) => {
        if (id === run.current) setState({ rows: r.rows, fields: r.fields, error: null, loading: false });
      },
      (e: unknown) => {
        if (id === run.current) setState({ rows: EMPTY, fields: EMPTY, error: toSqlError(e, sql), loading: false });
      },
    ).finally(() => {
      if (id === run.current) resolvers.current.splice(0).forEach((r) => r());
    });
  }, [db, sql, pKey, enabled, manual, watchEpoch]);

  const refetch = useCallback(() => new Promise<void>((resolve) => {
    resolvers.current.push(resolve);
    setManual((n) => n + 1);
  }), []);

  const failed = status === 'error' && dbError ? toSqlError(dbError) : null;
  return {
    rows: state.rows,
    fields: state.fields,
    error: state.error ?? failed,
    isLoading: enabled && !failed && (!db || state.loading),
    refetch,
  };
}

export interface LiveQueryState<T> {
  rows: T[];
  fields: SqlResult<T>['fields'];
  error: SqlError | null;
  /** True until the first result arrives. */
  isLoading: boolean;
}

export interface UseLiveQueryOptions {
  /** A column that identifies a row: PGlite then diffs results incrementally instead of re-running the whole query. */
  key?: string;
  enabled?: boolean;
}

/** A query that stays up to date: PGlite's `live` extension watches the tables the query reads and pushes new results
 *  when they change — from any writer on the same database, including other tabs on a shared worker.
 *
 *  Why not `@electric-sql/pglite-react`? Its `useLiveQuery` returns `undefined` until the first result, has no error
 *  or loading state, needs its own provider next to ours and pins an exact `@electric-sql/pglite` peer version. This
 *  is the same ~40 lines on top of `db.live`, wired to our provider's status. */
export function useLiveQuery<T = Record<string, unknown>>(sql: string, params?: readonly unknown[], { key, enabled = true }: UseLiveQueryOptions = {}): LiveQueryState<T> {
  const { db } = useDatabaseStatus();
  const [state, setState] = useState<LiveQueryState<T>>({ rows: EMPTY, fields: EMPTY, error: null, isLoading: true });
  const pKey = paramsKey(params);
  const paramsRef = useRef(params);
  paramsRef.current = params;

  useEffect(() => {
    if (!db || !enabled) return;
    if (!db.live) {
      setState({ rows: EMPTY, fields: EMPTY, error: { message: 'useLiveQuery needs the live extension: the provider was opened with live={false}.' }, isLoading: false });
      return;
    }
    let cancelled = false;
    const p = paramsRef.current ? [...paramsRef.current] : undefined;
    const push = (r: SqlResult<T>) => {
      if (!cancelled) setState({ rows: r.rows, fields: r.fields, error: null, isLoading: false });
    };
    let unsubscribe: () => void = noop;
    const handle = key ? db.live.incrementalQuery<T>(sql, p, key) : db.live.query<T>(sql, p);
    handle.then(
      (h) => {
        if (cancelled) {
          void h.unsubscribe(push);
          return;
        }
        push(h.initialResults);
        h.subscribe(push);
        unsubscribe = () => void h.unsubscribe(push);
      },
      (e: unknown) => {
        if (!cancelled) setState({ rows: EMPTY, fields: EMPTY, error: toSqlError(e, sql), isLoading: false });
      },
    );
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [db, sql, pKey, key, enabled]);

  return state;
}

export interface MutationState {
  isPending: boolean;
  error: SqlError | null;
  reset: () => void;
}

/** Writes. `exec(sql)` runs one or more statements (no parameters) and returns a result per statement; `run(sql,
 *  params)` runs one parameterised statement. A successful write calls `invalidate()`, so `useQuery`s refresh. */
export function useExec(): MutationState & {
  exec: (sql: string) => Promise<SqlResult[]>;
  run: <T = Record<string, unknown>>(sql: string, params?: readonly unknown[]) => Promise<SqlResult<T>>;
} {
  const { db, invalidate } = useDatabaseStatus();
  const [state, setState] = useState<{ isPending: boolean; error: SqlError | null }>({ isPending: false, error: null });
  const track = useCallback(
    async <R,>(sql: string, fn: (db: Database) => Promise<R>): Promise<R> => {
      if (!db) throw new Error('The database is not ready.');
      setState({ isPending: true, error: null });
      try {
        const result = await fn(db);
        invalidate();
        setState({ isPending: false, error: null });
        return result;
      } catch (e) {
        setState({ isPending: false, error: toSqlError(e, sql) });
        throw e;
      }
    },
    [db, invalidate],
  );
  const exec = useCallback((sql: string) => track(sql, (d) => d.exec(sql)), [track]);
  const run = useCallback(
    <T,>(sql: string, params?: readonly unknown[]) => track(sql, (d) => d.query<T>(sql, params ? [...params] : undefined)),
    [track],
  );
  const reset = useCallback(() => setState({ isPending: false, error: null }), []);
  return { exec, run, isPending: state.isPending, error: state.error, reset };
}

/** `transaction(async (tx) => { … })` — everything the callback does commits together, or none of it does (throw to roll back). Invalidates queries on commit. */
export function useTransaction(): MutationState & {
  transaction: <R>(callback: (tx: SqlTransaction) => Promise<R>) => Promise<R>;
} {
  const { db, invalidate } = useDatabaseStatus();
  const [state, setState] = useState<{ isPending: boolean; error: SqlError | null }>({ isPending: false, error: null });
  const transaction = useCallback(
    async <R,>(callback: (tx: SqlTransaction) => Promise<R>): Promise<R> => {
      if (!db) throw new Error('The database is not ready.');
      setState({ isPending: true, error: null });
      try {
        const result = await db.transaction(callback);
        invalidate();
        setState({ isPending: false, error: null });
        return result;
      } catch (e) {
        setState({ isPending: false, error: toSqlError(e) });
        throw e;
      }
    },
    [db, invalidate],
  );
  const reset = useCallback(() => setState({ isPending: false, error: null }), []);
  return { transaction, isPending: state.isPending, error: state.error, reset };
}

// @vitest-environment happy-dom
import { StrictMode, useEffect, type ReactNode } from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { tmpdir } from 'node:os';
import * as pglite from '@electric-sql/pglite';
import {
  PGliteProvider, useDatabaseStatus, useExec, useLiveQuery, usePGlite, useQuery, useReadyDatabase, useTransaction,
  type Database, type DatabaseState,
} from '@/lib/pglite';
import { useSchema } from '@/lib/pglite-schema';

vi.setConfig({ testTimeout: 30_000 });

afterEach(async () => {
  cleanup();
  vi.restoreAllMocks();
  // closing is deferred a tick; let it finish so the next test starts clean
  await new Promise((r) => setTimeout(r, 20));
});

const wait = { timeout: 15_000 };

/** How many databases the provider asked PGlite for at `dataDir` (PGlite itself starts a nested instance for initdb, without a dataDir). */
const opensOf = (spy: { mock: { calls: unknown[][] } }, dataDir: string) =>
  spy.mock.calls.filter(([o]) => (o as { dataDir?: string } | undefined)?.dataDir === dataDir).length;

/** Collects what the hooks see, so a test can assert on the whole history. */
function Probe({ onState }: { onState: (s: DatabaseState) => void }) {
  const state = useDatabaseStatus();
  useEffect(() => {
    onState(state);
  });
  return <span data-testid="status">{state.status}</span>;
}

describe('PGliteProvider lifecycle', () => {
  it('goes loading → ready with an in-memory database', async () => {
    const seen: string[] = [];
    render(<PGliteProvider><Probe onState={(s) => seen.push(s.status)} /></PGliteProvider>);
    expect(screen.getByTestId('status').textContent).toBe('loading');
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('ready'), wait);
    expect(seen[0]).toBe('loading');
    expect(seen.at(-1)).toBe('ready');
  });

  it('opens ONE database under StrictMode (double mount) and closes it on a real unmount', async () => {
    const create = vi.spyOn(pglite.PGlite, 'create');
    let db: Database | null = null;
    function Grab() {
      db = usePGlite();
      return null;
    }
    const view = render(
      <StrictMode>
        <PGliteProvider><Probe onState={() => undefined} /><Grab /></PGliteProvider>
      </StrictMode>,
    );
    await waitFor(() => expect(db).not.toBeNull(), wait);
    await new Promise((r) => setTimeout(r, 50));
    expect(opensOf(create, 'memory://')).toBe(1);
    const opened = db as unknown as Database;
    expect(opened.closed).toBe(false);
    view.unmount();
    await waitFor(() => expect(opened.closed).toBe(true), wait);
  });

  it('shares one database between providers on the same dataDir, and closes it when the last one goes', async () => {
    const create = vi.spyOn(pglite.PGlite, 'create');
    const dbs: (Database | null)[] = [null, null];
    const Grab = ({ i }: { i: number }) => {
      dbs[i] = usePGlite();
      return null;
    };
    // Node has no IndexedDB, so use a file:// dir for a persisted-style (non-memory) key.
    const dir = `file://${tmpdir()}/bl-pglite-test-${Date.now()}`;
    const a = render(<PGliteProvider dataDir={dir}><Grab i={0} /></PGliteProvider>);
    const b = render(<PGliteProvider dataDir={dir}><Grab i={1} /></PGliteProvider>);
    await waitFor(() => expect(dbs[0] && dbs[1]).toBeTruthy(), wait);
    expect(dbs[0]).toBe(dbs[1]);
    expect(opensOf(create, dir)).toBe(1);
    a.unmount();
    await new Promise((r) => setTimeout(r, 50));
    expect(dbs[1]?.closed).toBe(false);
    b.unmount();
    await waitFor(() => expect(dbs[1]?.closed).toBe(true), wait);
    const { rmSync } = await import('node:fs');
    rmSync(dir.slice(7), { recursive: true, force: true });
  });

  it('reports a failing open as status "error" with the error, and retry() tries again', async () => {
    let state: DatabaseState | null = null;
    // A migration that fails makes the open fail; the second attempt has fixed SQL.
    let sql = 'select * from nope';
    const view = (
      <PGliteProvider migrations={[{ id: '1', sql }]}>
        <Probe onState={(s) => (state = s)} />
      </PGliteProvider>
    );
    const { rerender } = render(view);
    await waitFor(() => expect(state?.status).toBe('error'), wait);
    expect((state as DatabaseState | null)?.error).toMatchObject({ name: 'MigrationError', kind: 'failed' });
    sql = 'select 1';
    rerender(
      <PGliteProvider migrations={[{ id: '1', sql }]}>
        <Probe onState={(s) => (state = s)} />
      </PGliteProvider>,
    );
    act(() => (state as DatabaseState | null)?.retry());
    await waitFor(() => expect(state?.status).toBe('ready'), wait);
    expect((state as DatabaseState | null)?.info?.migrated).toEqual(['1']);
  });

  it('renders fallback while loading and errorFallback on failure', async () => {
    render(
      <PGliteProvider fallback={<p>opening…</p>} migrations={[{ id: '1', sql: 'select * from nope' }]} errorFallback={(e, retry) => <button onClick={retry}>failed: {e.name}</button>}>
        <p>app</p>
      </PGliteProvider>,
    );
    expect(screen.getByText('opening…')).toBeTruthy();
    await waitFor(() => expect(screen.getByText('failed: MigrationError')).toBeTruthy(), wait);
    expect(screen.queryByText('app')).toBeNull();
  });

  it('useReadyDatabase throws until the database is ready', () => {
    function Needs() {
      useReadyDatabase();
      return null;
    }
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<PGliteProvider><Needs /></PGliteProvider>)).toThrow(/loading/);
    error.mockRestore();
  });
});

function Rows({ sql, params }: { sql: string; params?: unknown[] }) {
  const q = useQuery<{ id: number; v: string }>(sql, params);
  return <ul data-testid="rows" data-loading={q.isLoading}>{q.rows.map((r) => <li key={r.id}>{r.v}</li>)}{q.error && <li data-testid="err">{q.error.message}</li>}</ul>;
}

function Writer({ children }: { children?: ReactNode }) {
  const { exec, run } = useExec();
  const { transaction } = useTransaction();
  return (
    <div>
      <button onClick={() => void exec("create table if not exists t (id serial primary key, v text); insert into t (v) values ('first')")}>seed</button>
      <button onClick={() => void run('insert into t (v) values ($1)', ['second'])}>add</button>
      <button onClick={() => void transaction(async (tx) => { await tx.query("insert into t (v) values ('tx')"); throw new Error('abort'); }).catch(() => undefined)}>rollback</button>
      {children}
    </div>
  );
}

describe('hooks', () => {
  it('useQuery runs when ready, re-runs after a write through useExec, and reports SQL errors', async () => {
    const { rerender } = render(
      <PGliteProvider migrations={[{ id: '1', sql: 'create table t (id serial primary key, v text)' }]}>
        <Rows sql="select id, v from t order by id" />
        <Writer />
      </PGliteProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('rows').dataset.loading).toBe('false'), wait);
    expect(screen.getByTestId('rows').children).toHaveLength(0);

    act(() => screen.getByText('seed').click());
    await waitFor(() => expect(screen.getByTestId('rows').textContent).toBe('first'), wait);
    act(() => screen.getByText('add').click());
    await waitFor(() => expect(screen.getByTestId('rows').textContent).toBe('firstsecond'), wait);
    // a rolled-back transaction changes nothing
    act(() => screen.getByText('rollback').click());
    await new Promise((r) => setTimeout(r, 100));
    expect(screen.getByTestId('rows').textContent).toBe('firstsecond');

    rerender(
      <PGliteProvider migrations={[{ id: '1', sql: 'create table t (id serial primary key, v text)' }]}>
        <Rows sql="select * from missing_table" />
      </PGliteProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('err').textContent).toMatch(/missing_table/), wait);
  });

  it('useQuery takes params, and an inline params literal does not re-run it every render', async () => {
    const runs: number[] = [];
    function Counting() {
      const db = usePGlite();
      const q = useQuery<{ n: number }>('select $1::int as n', [7]);
      useEffect(() => {
        if (db) runs.push(1);
      }, [db, q.rows]);
      return <span data-testid="n">{q.rows[0]?.n}</span>;
    }
    const { rerender } = render(<PGliteProvider><Counting /></PGliteProvider>);
    await waitFor(() => expect(screen.getByTestId('n').textContent).toBe('7'), wait);
    const before = runs.length;
    rerender(<PGliteProvider><Counting /></PGliteProvider>);
    rerender(<PGliteProvider><Counting /></PGliteProvider>);
    await new Promise((r) => setTimeout(r, 100));
    expect(runs.length).toBe(before);
  });

  it('useQuery refetch() resolves with new data', async () => {
    let q: ReturnType<typeof useQuery<{ n: number }>> | null = null;
    let db: Database | null = null;
    function C() {
      q = useQuery<{ n: number }>('select count(*)::int as n from t');
      db = usePGlite();
      return null;
    }
    render(<PGliteProvider migrations={[{ id: '1', sql: 'create table t (id serial primary key, v text)' }]}><C /></PGliteProvider>);
    await waitFor(() => expect(q?.rows[0]?.n).toBe(0), wait);
    // a write that bypasses the hooks is not seen until refetch()
    await (db as unknown as Database).exec("insert into t (v) values ('x')");
    expect(q?.rows[0]?.n).toBe(0);
    let done: Promise<void> | undefined;
    act(() => {
      done = q?.refetch();
    });
    await act(async () => {
      await done;
    });
    expect(q?.rows[0]?.n).toBe(1);
  });

  it('useLiveQuery pushes updates when the table changes', async () => {
    function Live() {
      const { rows, isLoading } = useLiveQuery<{ v: string }>('select v from t order by id');
      return <span data-testid="live" data-loading={isLoading}>{rows.map((r) => r.v).join(',')}</span>;
    }
    render(
      <PGliteProvider migrations={[{ id: '1', sql: "create table t (id serial primary key, v text); insert into t (v) values ('a')" }]}>
        <Live />
        <Writer />
      </PGliteProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('live').textContent).toBe('a'), wait);
    act(() => screen.getByText('add').click());
    await waitFor(() => expect(screen.getByTestId('live').textContent).toBe('a,second'), wait);
  });

  it('useLiveQuery says so when the live extension is off', async () => {
    function Live() {
      const { error } = useLiveQuery('select 1');
      return <span data-testid="live-err">{error?.message}</span>;
    }
    render(<PGliteProvider live={false}><Live /></PGliteProvider>);
    await waitFor(() => expect(screen.getByTestId('live-err').textContent).toMatch(/live extension/), wait);
  });

  it('useSchema lists tables and refreshes after a write', async () => {
    function Schema() {
      const { schema } = useSchema();
      return <span data-testid="tables">{schema?.schemas.flatMap((s) => s.tables.map((t) => `${t.schema}.${t.name}:${t.rowCount}`)).join(',')}</span>;
    }
    render(
      <PGliteProvider migrations={[{ id: '1', sql: 'create table t (id serial primary key, v text)' }]}>
        <Schema />
        <Writer />
      </PGliteProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('tables').textContent).toBe('public.t:0'), wait);
    act(() => screen.getByText('add').click());
    await waitFor(() => expect(screen.getByTestId('tables').textContent).toBe('public.t:1'), wait);
  });
});

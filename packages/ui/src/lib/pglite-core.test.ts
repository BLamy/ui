import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  DataDirVersionError, MigrationError, PGliteError, openDatabase, parseDataDir, quoteIdent, quoteLiteral, runMigrations, runSql, toSqlError,
  type Database, type Migration,
} from '@/lib/pglite-core';
import { loadSchema } from '@/lib/pglite-schema';
import { dumpVersion, exportDatabase, importDatabase, readArchiveVersion } from '@/lib/pglite-transfer';

/* PGlite runs in Node, so these tests use the real engine (in memory). Starting it takes about a second, several
   times over per test — more when the machine is busy — so the default 5 s limit is too tight. */
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const opened: { close(): Promise<void> }[] = [];
async function open(options: Parameters<typeof openDatabase>[0] = {}) {
  const o = await openDatabase(options);
  opened.push(o);
  return o;
}
afterAll(async () => {
  await Promise.all(opened.map((o) => o.close()));
});

describe('parseDataDir / quoting', () => {
  it('classifies data directories', () => {
    expect(parseDataDir(undefined)).toEqual({ kind: 'memory', name: '', dataDir: 'memory://' });
    expect(parseDataDir('idb://notes')).toEqual({ kind: 'idb', name: 'notes', dataDir: 'idb://notes' });
    expect(parseDataDir('opfs-ahp://x')).toMatchObject({ kind: 'opfs-ahp', name: 'x' });
    expect(parseDataDir('file:///tmp/db')).toMatchObject({ kind: 'nodefs', name: '/tmp/db' });
  });
  it('quotes identifiers and literals', () => {
    expect(quoteIdent('a"b')).toBe('"a""b"');
    expect(quoteLiteral("it's")).toBe("'it''s'");
  });
});

describe('openDatabase', () => {
  it('opens an in-memory database and reports versions', async () => {
    const { db, info } = await open();
    expect(info.kind).toBe('memory');
    expect(info.serverMajor).toBeGreaterThanOrEqual(17);
    expect(info.serverVersion).toMatch(/^\d+\.\d+/);
    expect(info.pgliteVersion).toMatch(/^\d+\.\d+\.\d+/);
    expect(info.migrated).toEqual([]);
    expect((await db.query<{ n: number }>('select 1 as n')).rows[0].n).toBe(1);
    expect(db.live).toBeDefined();
  });
  it('can leave the live extension out', async () => {
    const { db } = await open({ live: false });
    expect(db.live).toBeUndefined();
  });
  it('applies migrations while opening', async () => {
    const { db, info } = await open({ migrations: [{ id: '001', sql: 'create table t (id int)' }] });
    expect(info.migrated).toEqual(['001']);
    expect((await db.query('select count(*)::int as n from t')).rows[0]).toEqual({ n: 0 });
  });
  it('restores a data-directory archive passed as loadDataDir', async () => {
    const first = await open();
    await first.db.exec("create table keep (v text); insert into keep values ('x')");
    const archive = await first.db.dumpDataDir('gzip');
    expect(await readArchiveVersion(archive)).toBe(String(first.info.serverMajor));
    const restored = await open({ loadDataDir: archive });
    expect((await restored.db.query('select v from keep')).rows).toEqual([{ v: 'x' }]);
  });
});

describe('runMigrations', () => {
  const m = (id: string, sql: string): Migration => ({ id, sql });
  const list = [m('001', 'create table a (id int)'), m('002', 'create table b (id int)')];

  it('applies in order and is idempotent', async () => {
    const { db } = await open();
    expect(await runMigrations(db, list)).toEqual({ applied: ['001', '002'], skipped: 0 });
    expect(await runMigrations(db, list)).toEqual({ applied: [], skipped: 2 });
    const rows = (await db.query<{ id: string; position: number }>('select id, position from _bl_migrations order by position')).rows;
    expect(rows).toEqual([{ id: '001', position: 1 }, { id: '002', position: 2 }]);
  });

  it('applies only the new migrations when the list grows', async () => {
    const { db } = await open();
    await runMigrations(db, list);
    expect(await runMigrations(db, [...list, m('003', 'create table c (id int)')])).toEqual({ applied: ['003'], skipped: 2 });
  });

  it('rolls a failing migration back, keeps earlier ones and names the failure', async () => {
    const { db } = await open();
    const bad = [m('001', 'create table a (id int)'), m('002', 'create table b (id int); insert into b values (1); select * from missing')];
    const err = await runMigrations(db, bad).catch((e) => e);
    expect(err).toBeInstanceOf(MigrationError);
    expect(err).toMatchObject({ kind: 'failed', migration: '002' });
    expect(err.message).toMatch(/rolled back/);
    expect((await db.query('select id from _bl_migrations')).rows).toEqual([{ id: '001' }]);
    // the half-applied table b must not exist
    expect((await db.query("select to_regclass('b') as r")).rows[0]).toEqual({ r: null });
    // fixing the migration (same id, new sql) is allowed because 002 never applied
    expect(await runMigrations(db, [bad[0], m('002', 'create table b (id int)')])).toEqual({ applied: ['002'], skipped: 1 });
  });

  it('rejects a reordered or replaced history (drift) instead of applying out of order', async () => {
    const { db } = await open();
    await runMigrations(db, list);
    const err = await runMigrations(db, [list[1], list[0]]).catch((e) => e);
    expect(err).toMatchObject({ name: 'MigrationError', kind: 'order' });
    // inserting a new migration BEFORE an applied one is the classic drift: the index-based comparison missed this
    const inserted = await runMigrations(db, [list[0], m('001b', 'create table z (id int)'), list[1]]).catch((e) => e);
    expect(inserted).toMatchObject({ kind: 'order', migration: '001b' });
    expect((await db.query("select to_regclass('z') as r")).rows[0]).toEqual({ r: null });
  });

  it('rejects a database that is ahead of the list', async () => {
    const { db } = await open();
    await runMigrations(db, list);
    const err = await runMigrations(db, [list[0]]).catch((e) => e);
    expect(err).toMatchObject({ kind: 'unknown-applied', migration: '002' });
  });

  it('rejects an applied SQL migration that was edited', async () => {
    const { db } = await open();
    await runMigrations(db, list);
    const err = await runMigrations(db, [m('001', 'create table a (id int, extra text)'), list[1]]).catch((e) => e);
    expect(err).toMatchObject({ kind: 'changed', migration: '001' });
  });

  it('rejects duplicate ids and supports function migrations', async () => {
    const { db } = await open();
    expect(await runMigrations(db, [list[0], list[0]]).catch((e) => e)).toMatchObject({ kind: 'duplicate' });
    await runMigrations(db, [{ id: 'fn', sql: async (tx) => void (await tx.exec('create table f (id int)')) }]);
    expect((await db.query("select to_regclass('f') is not null as ok")).rows[0]).toEqual({ ok: true });
    // function migrations carry no checksum, so only their id is compared
    expect(await runMigrations(db, [{ id: 'fn', sql: async () => undefined }])).toEqual({ applied: [], skipped: 1 });
  });
});

describe('runSql / toSqlError', () => {
  let db: Database;
  beforeAll(async () => {
    db = (await open()).db;
    await db.exec('create table t (id int primary key, v text)');
  });

  it('returns one result per statement, labelled', async () => {
    const out = await runSql(db, "insert into t values (1, 'a'), (2, 'b'); select * from t order by id; -- trailing comment\n");
    expect(out.error).toBeUndefined();
    expect(out.results.map((r) => [r.command, r.statement])).toEqual([
      ['INSERT', "insert into t values (1, 'a'), (2, 'b')"],
      ['SELECT', 'select * from t order by id'],
    ]);
    expect(out.results[0].rowCount).toBe(2);
    expect(out.results[1].rows).toHaveLength(2);
    expect(out.durationMs).toBeGreaterThan(0);
  });

  it('reports the error position as line and column, relative to the whole script', async () => {
    const sql = 'select 1;\nselect 2;\n  selec 3';
    const out = await runSql(db, sql);
    expect(out.error).toMatchObject({ code: '42601', line: 3, column: 3 });
    expect(out.error?.position).toBe(sql.indexOf('selec 3') + 1);
    expect(out.results).toEqual([]);
  });

  it('applies none of a failing script (one implicit transaction)', async () => {
    const out = await runSql(db, "insert into t values (10, 'x'); select * from nope");
    expect(out.error?.code).toBe('42P01');
    expect((await db.query('select count(*)::int as n from t where id = 10')).rows[0]).toEqual({ n: 0 });
  });

  it('ends a transaction the script left open when it fails, so the next run works', async () => {
    const out = await runSql(db, 'begin; select * from nope');
    expect(out.error).toBeDefined();
    const next = await runSql(db, 'select 1 as ok');
    expect(next.error).toBeUndefined();
  });

  it('normalises plain errors and strings', () => {
    expect(toSqlError('boom')).toEqual({ message: 'boom' });
    expect(toSqlError(new Error('x'))).toEqual({ message: 'x' });
    expect(toSqlError({ message: 'm', position: '5', code: 'X', hint: 'h' }, 'abcdef')).toMatchObject({ position: 5, line: 1, column: 5, hint: 'h' });
  });
});

describe('loadSchema', () => {
  it('reads tables, columns, keys, views and row counts', async () => {
    const { db } = await open();
    await db.exec(`
      create schema app;
      create table app.users (id serial primary key, email text not null unique, bio text default 'hi');
      create table app.posts (id int primary key, author int references app.users(id), body jsonb, tags text[]);
      create view app.recent as select * from app.posts;
      insert into app.users (email) values ('a@x'), ('b@x');
      create table public.solo (a int, b int, primary key (a, b));
    `);
    const { schemas } = await loadSchema(db);
    expect(schemas.map((s) => s.name)).toEqual(['app', 'public']);
    const app = schemas[0].tables;
    expect(app.map((t) => [t.name, t.kind, t.rowCount])).toEqual([['posts', 'table', 0], ['recent', 'view', null], ['users', 'table', 2]]);
    const users = app.find((t) => t.name === 'users') as (typeof app)[number];
    expect(users.columns.map((c) => [c.name, c.type, c.nullable, c.isPrimaryKey])).toEqual([
      ['id', 'integer', false, true], ['email', 'text', false, false], ['bio', 'text', true, false],
    ]);
    expect(users.columns[0].default).toMatch(/nextval/);
    expect(users.columns[2].default).toBe("'hi'::text");
    const posts = app.find((t) => t.name === 'posts') as (typeof app)[number];
    expect(posts.columns[1].references).toEqual({ schema: 'app', table: 'users', column: 'id' });
    expect(posts.columns.map((c) => c.type)).toEqual(['integer', 'integer', 'jsonb', 'text[]']);
    const solo = schemas[1].tables[0];
    expect(solo.columns.map((c) => c.isPrimaryKey)).toEqual([true, true]);
  });
  it('can estimate or skip counts and include system schemas', async () => {
    const { db } = await open();
    await db.exec('create table t (id int); insert into t values (1)');
    expect((await loadSchema(db, { rowCounts: 'none' })).schemas[0].tables[0].rowCount).toBeNull();
    const withSystem = await loadSchema(db, { system: true, rowCounts: 'none' });
    expect(withSystem.schemas.map((s) => s.name)).toContain('pg_catalog');
  });
});

describe('export / import', () => {
  it('round-trips through a SQL dump, including awkward values', async () => {
    const a = await open();
    await a.db.exec(`
      create table t (id serial primary key, s text, j jsonb, b bytea, ts timestamptz, n numeric, arr int[]);
      insert into t (s, j, b, ts, n, arr) values ('it''s "quoted"', '{"k":[1,2]}', '\\xdeadbeef', '2026-01-02T03:04:05Z', 12.50, '{1,2,3}'), (null, null, null, null, null, null);
      create view v as select id from t;
      create function f() returns int language sql as $$ select 42 $$;
    `);
    const out = await exportDatabase(a.db, 'sql');
    expect(out.format).toBe('sql');
    expect(out.file.name).toMatch(/^database-pg\d+\.sql$/);
    expect(out.postgresMajor).toBe(a.info.serverMajor);
    const text = await out.file.text();
    expect(dumpVersion(text)).toBe(out.postgresVersion);

    const b = await open();
    const result = await importDatabase(b.db, out.file);
    expect(result).toMatchObject({ format: 'sql', applied: true, sourceVersion: out.postgresVersion, warnings: [] });
    const rows = (await b.db.query('select * from t order by id')).rows as Record<string, unknown>[];
    expect(rows[0]).toMatchObject({ s: 'it\'s "quoted"', j: { k: [1, 2] }, n: '12.50', arr: [1, 2, 3] });
    expect(rows[0].b).toEqual(new Uint8Array([0xde, 0xad, 0xbe, 0xef]));
    expect(rows[1].s).toBeNull();
    expect((await b.db.query('select f() as x')).rows[0]).toEqual({ x: 42 });
    // the dump empties search_path; the import restores the session so ordinary statements work afterwards
    await b.db.exec('create table after_import (id int)');
    // and the sequence continues where the source left off
    expect((await b.db.query("insert into t (s) values ('new') returning id")).rows[0]).toEqual({ id: 3 });
  });

  it('applies none of a dump that clashes with existing objects', async () => {
    const a = await open();
    await a.db.exec('create table t (id int); insert into t values (1)');
    const { file } = await exportDatabase(a.db, 'sql');
    const err = await importDatabase(a.db, file).catch((e) => e);
    expect(err).toBeInstanceOf(PGliteError);
    expect(err.code).toBe('IMPORT_FAILED');
    expect(err.message).toMatch(/nothing was changed/);
    expect((await a.db.query('select count(*)::int as n from t')).rows[0]).toEqual({ n: 1 });
  });

  it('round-trips a data-directory archive into a new database, and reads its Postgres version', async () => {
    const a = await open();
    await a.db.exec("create table kept (v text); insert into kept values ('same-version')");
    const out = await exportDatabase(a.db, 'datadir');
    expect(out.file.name).toMatch(/^database-pg\d+-pglite[\d.]+\.tar\.gz$/);
    expect(await readArchiveVersion(out.file)).toBe(String(out.postgresMajor));
    const restored = await importDatabase({}, out.file);
    opened.push(restored);
    expect(restored.format).toBe('datadir');
    expect(restored.sourceVersion).toBe(String(out.postgresMajor));
    expect((await restored.db.query('select v from kept')).rows).toEqual([{ v: 'same-version' }]);
  });

  it('refuses to load a data-directory archive into an open database', async () => {
    const a = await open();
    const { file } = await exportDatabase(a.db, 'datadir');
    expect(await importDatabase(a.db, file).catch((e) => e)).toMatchObject({ code: 'UNSUPPORTED' });
  });

  it('imports a SQL dump into a new database from a config', async () => {
    const a = await open();
    await a.db.exec('create table t (id int); insert into t values (7)');
    const { file } = await exportDatabase(a.db, 'sql', { fileName: 'mine.sql' });
    expect(file.name).toBe('mine.sql');
    const restored = await importDatabase({}, file);
    opened.push(restored);
    expect((await restored.db.query('select id from t')).rows).toEqual([{ id: 7 }]);
  });

  it('says so when a dump is from a newer Postgres, without refusing', async () => {
    const a = await open();
    const sql = `-- Dumped from database version 99.1\ncreate table newer (id int);`;
    const result = await importDatabase(a.db, new File([sql], 'x.sql'));
    expect(result.warnings[0]).toMatch(/newer than this database/);
  });
});

describe('DataDirVersionError', () => {
  it('names both versions and promises the data was left alone', () => {
    const e = new DataDirVersionError('idb://old', '17', '18');
    expect(e.code).toBe('VERSION_MISMATCH');
    expect(e.message).toMatch(/Postgres 17/);
    expect(e.message).toMatch(/Postgres 18/);
    expect(e.message).toMatch(/left untouched/);
  });
});

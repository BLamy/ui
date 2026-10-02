'use client';
import { useEffect, useState } from 'react';
import { quoteIdent, toSqlError, type SqlError, type SqlRunner } from '@/lib/pglite-core';
import { useDatabaseStatus } from '@/lib/pglite';

/* ══ Schema introspection ══
   What is in the database: schemas → tables / views → columns, with types, primary and foreign keys and row counts,
   read from pg_catalog. `loadSchema(db)` is a plain async function; `useSchema()` runs it for the provider's database
   and again after every write made through `useExec` / `useTransaction` / the SQL console. */

export type RelationKind = 'table' | 'view' | 'materialized view' | 'foreign table' | 'partitioned table';

export interface ColumnReference {
  schema: string;
  table: string;
  column: string;
}

export interface SchemaColumn {
  name: string;
  /** `format_type`: `integer`, `character varying(255)`, `timestamp with time zone`, `text[]`. */
  type: string;
  /** The type's OID, to look up with `pgTypeName`. */
  typeOid: number;
  nullable: boolean;
  /** The default expression, e.g. `nextval('app.t_id_seq'::regclass)` or `now()`. */
  default: string | null;
  isPrimaryKey: boolean;
  /** The column this one points at, when it is (part of) a foreign key. */
  references: ColumnReference | null;
}

export interface SchemaTable {
  schema: string;
  name: string;
  kind: RelationKind;
  comment: string | null;
  columns: SchemaColumn[];
  /** Rows, per the `rowCounts` option; `null` for views, when not counted, or when the count failed. */
  rowCount: number | null;
}

export interface SchemaNode {
  name: string;
  tables: SchemaTable[];
}

export interface SchemaInfo {
  schemas: SchemaNode[];
}

export interface LoadSchemaOptions {
  /** Include `pg_catalog`, `information_schema` and TOAST schemas. Default false. */
  system?: boolean;
  /** Include BL UI's own bookkeeping tables (`_bl_migrations`). Default false. */
  internal?: boolean;
  /** `exact` runs `count(*)` on each table (default; fine for browser-sized data), `estimate` reads the planner's
      statistics (instant, but 0 or -1 for a table that was never analyzed → shown as `null`), `none` skips counts. */
  rowCounts?: 'exact' | 'estimate' | 'none';
  /** Stop counting after this many tables (default 100). */
  maxCounted?: number;
}

const RELKIND: Record<string, RelationKind> = {
  r: 'table', v: 'view', m: 'materialized view', f: 'foreign table', p: 'partitioned table',
};

const COLUMNS_SQL = `
select n.nspname as schema, c.relname as table, c.relkind::text as kind, obj_description(c.oid, 'pg_class') as comment,
       c.reltuples::float8 as estimate,
       a.attname as column, format_type(a.atttypid, a.atttypmod) as type, a.atttypid::int as type_oid,
       not a.attnotnull as nullable, pg_get_expr(d.adbin, d.adrelid) as "default",
       coalesce(a.attnum = any(pk.indkey), false) as is_pk
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
left join pg_attrdef d on d.adrelid = c.oid and d.adnum = a.attnum
left join pg_index pk on pk.indrelid = c.oid and pk.indisprimary
where c.relkind in ('r', 'v', 'm', 'f', 'p')
  and not c.relispartition
order by n.nspname, c.relname, a.attnum`;

const FKS_SQL = `
select n.nspname as schema, c.relname as table, a.attname as column,
       fn.nspname as ref_schema, fc.relname as ref_table, fa.attname as ref_column
from pg_constraint con
join pg_class c on c.oid = con.conrelid
join pg_namespace n on n.oid = c.relnamespace
join pg_class fc on fc.oid = con.confrelid
join pg_namespace fn on fn.oid = fc.relnamespace
cross join lateral unnest(con.conkey, con.confkey) as k(attnum, fattnum)
join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k.attnum
join pg_attribute fa on fa.attrelid = con.confrelid and fa.attnum = k.fattnum
where con.contype = 'f'`;

const isSystemSchema = (s: string) => s === 'pg_catalog' || s === 'information_schema' || s.startsWith('pg_toast') || s.startsWith('pg_temp');

/** Reads the schema. Never throws for a failed row count (that table's `rowCount` is `null`). */
export async function loadSchema(db: SqlRunner, { system = false, internal = false, rowCounts = 'exact', maxCounted = 100 }: LoadSchemaOptions = {}): Promise<SchemaInfo> {
  const [cols, fks] = await Promise.all([
    db.query<{ schema: string; table: string; kind: string; comment: string | null; estimate: number; column: string; type: string; type_oid: number; nullable: boolean; default: string | null; is_pk: boolean }>(COLUMNS_SQL),
    db.query<{ schema: string; table: string; column: string; ref_schema: string; ref_table: string; ref_column: string }>(FKS_SQL),
  ]);
  const fkOf = new Map<string, ColumnReference>();
  for (const f of fks.rows) fkOf.set(`${f.schema}.${f.table}.${f.column}`, { schema: f.ref_schema, table: f.ref_table, column: f.ref_column });

  const tables = new Map<string, SchemaTable>();
  const estimates = new Map<string, number>();
  for (const r of cols.rows) {
    if (!system && isSystemSchema(r.schema)) continue;
    if (!internal && r.table.startsWith('_bl_')) continue;
    const id = `${r.schema}.${r.table}`;
    let table = tables.get(id);
    if (!table) {
      table = { schema: r.schema, name: r.table, kind: RELKIND[r.kind] ?? 'table', comment: r.comment, columns: [], rowCount: null };
      tables.set(id, table);
      estimates.set(id, r.estimate);
    }
    table.columns.push({
      name: r.column, type: r.type, typeOid: r.type_oid, nullable: r.nullable, default: r.default, isPrimaryKey: r.is_pk,
      references: fkOf.get(`${id}.${r.column}`) ?? null,
    });
  }

  if (rowCounts === 'estimate') {
    for (const [id, t] of tables) if (t.kind !== 'view') t.rowCount = (estimates.get(id) ?? -1) >= 0 ? Math.round(estimates.get(id) as number) : null;
  } else if (rowCounts === 'exact') {
    const countable = [...tables.values()].filter((t) => t.kind === 'table' || t.kind === 'partitioned table' || t.kind === 'materialized view').slice(0, maxCounted);
    for (const t of countable) {
      try {
        const { rows } = await db.query<{ n: number }>(`select count(*)::float8 as n from ${quoteIdent(t.schema)}.${quoteIdent(t.name)}`);
        t.rowCount = rows[0]?.n ?? null;
      } catch {
        t.rowCount = null;
      }
    }
  }

  const bySchema = new Map<string, SchemaNode>();
  // Schemas with no relations do not appear: the tree has nothing to show in them.
  for (const t of tables.values()) {
    let node = bySchema.get(t.schema);
    if (!node) bySchema.set(t.schema, (node = { name: t.schema, tables: [] }));
    node.tables.push(t);
  }
  return { schemas: [...bySchema.values()] };
}

export interface UseSchemaState {
  schema: SchemaInfo | null;
  isLoading: boolean;
  error: SqlError | null;
  refetch: () => void;
}

/** The provider's schema. Re-read after writes made through `useExec` / `useTransaction` (or `invalidate()`). */
export function useSchema(options: LoadSchemaOptions = {}): UseSchemaState {
  const { db, epoch } = useDatabaseStatus();
  const [state, setState] = useState<{ schema: SchemaInfo | null; error: SqlError | null; loading: boolean }>({ schema: null, error: null, loading: true });
  const [manual, setManual] = useState(0);
  const { system, internal, rowCounts, maxCounted } = options;

  useEffect(() => {
    if (!db) return;
    let cancelled = false;
    setState((s) => (s.loading ? s : { ...s, loading: true }));
    loadSchema(db, { system, internal, rowCounts, maxCounted }).then(
      (schema) => !cancelled && setState({ schema, error: null, loading: false }),
      (e: unknown) => !cancelled && setState((s) => ({ schema: s.schema, error: toSqlError(e), loading: false })),
    );
    return () => {
      cancelled = true;
    };
  }, [db, epoch, manual, system, internal, rowCounts, maxCounted]);

  return { schema: state.schema, isLoading: !db || state.loading, error: state.error, refetch: () => setManual((n) => n + 1) };
}

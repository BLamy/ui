'use client';
import { useMemo, useState, type ComponentProps } from 'react';
import type { TreeActionDetails } from '@ui-sdk/react/tree';
import { cva, type VariantProps } from 'class-variance-authority';
import { Skeleton } from '@/components/ui/skeleton';
import { Tree, type TreeNode } from '@/components/ui/tree';
import { cn } from '@/lib/utils';
import type { SchemaColumn, SchemaInfo, SchemaTable } from '@/lib/pglite-schema';

/* ══ SchemaTree — schemas → tables → columns on the kit's Tree ══
   Arrow keys move, → expands and ← collapses; choosing a table or a column (a press, or Return) fires `onAction` with
   the table (and column) in its details — SqlConsole uses it to paste `select * from …` into the editor. After each row: a schema's table
   count; a table's kind (when it isn't a plain table) and row count; a column's type, `→ table.column` for a foreign
   key and `not null`. Primary keys wear a key. Schemas start expanded. */

/** A schema and, with `defaultExpandAll`, its tables: what opens when it first shows. */
const openOf = (n: TreeNode, all?: boolean) => [n.value, ...(all ? (n.children ?? []).map((c) => c.value) : [])];

export const schemaTreeVariants = cva('flex min-h-0 min-w-0 flex-col text-footnote text-foreground outline-none', {
  variants: {
    variant: {
      /** A bare tree for a sidebar. */
      default: '',
      /** On its own card, with a hairline. */
      card: 'rounded-panel bg-card p-1 shadow-hairline',
    },
  },
  defaultVariants: { variant: 'default' },
});

type Node = TreeNode &
  ({ kind: 'schema' } | { kind: 'table'; table: SchemaTable } | { kind: 'column'; table: SchemaTable; column: SchemaColumn });

const schemaId = (s: string) => `schema:${s}`;
const tableId = (t: SchemaTable) => `table:${t.schema}.${t.name}`;
const columnId = (t: SchemaTable, c: SchemaColumn) => `column:${t.schema}.${t.name}.${c.name}`;

const KIND: Partial<Record<SchemaTable['kind'], string>> = { view: 'view', 'materialized view': 'matview', 'foreign table': 'foreign', 'partitioned table': 'partitioned' };

function nodesOf(schema: SchemaInfo): Node[] {
  return schema.schemas.map((s): Node => ({
    value: schemaId(s.name),
    kind: 'schema',
    label: s.name,
    detail: String(s.tables.length),
    detailTitle: `${s.tables.length} tables`,
    children: s.tables.map((t): Node => ({
      value: tableId(t),
      kind: 'table',
      label: t.name,
      table: t,
      detail: [KIND[t.kind], t.rowCount !== null ? t.rowCount.toLocaleString('en-US') : ''].filter(Boolean).join(' · '),
      ...(t.rowCount !== null ? { detailTitle: `${t.rowCount} rows` } : {}),
      children: t.columns.map((c): Node => ({
        value: columnId(t, c),
        kind: 'column',
        label: c.name,
        table: t,
        column: c,
        ...(c.isPrimaryKey ? { icon: 'key' as const } : {}),
        detail: [c.references ? `→ ${c.references.table}.${c.references.column}` : '', c.type, c.nullable ? '' : 'not null'].filter(Boolean).join(' '),
        ...(c.references ? { detailTitle: `References ${c.references.schema}.${c.references.table}(${c.references.column})` } : {}),
      })),
    })),
  }));
}

/** What `onAction` gets after the row's id: UI SDK's action details, with the table and, for a column, the column. */
export type SchemaTreeActionDetails = TreeActionDetails & { table: SchemaTable; column?: SchemaColumn };

export interface SchemaTreeProps extends Omit<ComponentProps<'div'>, 'children' | 'onSelect'>, VariantProps<typeof schemaTreeVariants> {
  /** From `useSchema()`. `null` while it loads. */
  schema: SchemaInfo | null;
  loading?: boolean;
  /** A table (or view) or a column was chosen: Return, or a press. `value` is the row's id; `details.table` is the
   *  table, `details.column` the column when one was chosen, and `details.event` the press or key. */
  onAction?: (value: string, details: SchemaTreeActionDetails) => void;
  /** Expand every table's columns at first (default: only schemas are open). */
  defaultExpandAll?: boolean;
  'aria-label'?: string;
}

export function SchemaTree({
  schema, loading, onAction, defaultExpandAll, variant, className, style, 'aria-label': ariaLabel = 'Database schema', ...props
}: SchemaTreeProps) {
  const nodes = useMemo(() => (schema ? nodesOf(schema) : []), [schema]);
  const index = useMemo(() => {
    const m = new Map<string, Node>();
    const visit = (n: TreeNode) => {
      m.set(n.value, n as Node);
      n.children?.forEach(visit);
    };
    nodes.forEach(visit);
    return m;
  }, [nodes]);
  const expanded = useMemo(() => nodes.flatMap((n) => openOf(n, defaultExpandAll)), [nodes, defaultExpandAll]);
  // A schema that appears later (a `create schema`) opens by itself; what the user closed stays closed.
  const [seen, setSeen] = useState<{ nodes: readonly Node[]; ids: ReadonlySet<string>; fresh: string[] }>(() => ({ nodes, ids: new Set(nodes.map((n) => n.value)), fresh: [] }));
  if (seen.nodes !== nodes) {
    const added = nodes.filter((n) => !seen.ids.has(n.value));
    setSeen({ nodes, ids: new Set([...seen.ids, ...nodes.map((n) => n.value)]), fresh: added.length ? added.flatMap((n) => openOf(n, defaultExpandAll)) : seen.fresh });
  }
  const choose = (value: string, details: TreeActionDetails) => {
    const node = index.get(value);
    if (node?.kind === 'table') onAction?.(value, { ...details, table: node.table });
    else if (node?.kind === 'column') onAction?.(value, { ...details, table: node.table, column: node.column });
  };

  return (
    <div data-slot="schema-tree" aria-busy={loading || undefined} className={cn(schemaTreeVariants({ variant }), className)} style={style} {...props}>
      {loading && !schema ? (
        <div role="group" aria-label={`${ariaLabel} loading`} className="flex flex-col gap-2 p-2">
          <Skeleton shape="text" className="w-1/3" />
          <Skeleton shape="text" className="ms-4 w-2/3" />
          <Skeleton shape="text" className="ms-4 w-1/2" />
        </div>
      ) : (
        nodes.length ? (
          <Tree aria-label={ariaLabel} items={nodes} icons={false} defaultExpanded={expanded} autoExpand={seen.fresh} density="compact"
            onAction={choose} className="min-h-48 flex-1" />
        ) : <div className="px-3 py-6 text-center text-footnote text-foreground/65">No tables yet</div>
      )}
    </div>
  );
}

'use client';
import { useMemo, type ComponentProps } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Skeleton } from '@/components/ui/skeleton';
import { Tree, type TreeNode } from '@/components/ui/tree';
import { cn } from '@/lib/utils';
import type { SchemaColumn, SchemaInfo, SchemaTable } from '@/lib/pglite-schema';

/* ══ SchemaTree — schemas → tables → columns on the library's Tree (Trees) ══
   Arrow keys move, → expands and ← collapses; choosing a table (a click, or Return) fires `onSelectTable` — SqlConsole
   uses it to paste `select * from …` into the editor — and a column `onSelectColumn`. After each row: a schema's table
   count; a table's kind (when it isn't a plain table) and row count; a column's type, `→ table.column` for a foreign
   key and `not null`. Primary keys wear a key. Schemas start expanded. */

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
    id: schemaId(s.name),
    kind: 'schema',
    name: s.name,
    detail: String(s.tables.length),
    detailTitle: `${s.tables.length} tables`,
    children: s.tables.map((t): Node => ({
      id: tableId(t),
      kind: 'table',
      name: t.name,
      table: t,
      detail: [KIND[t.kind], t.rowCount !== null ? t.rowCount.toLocaleString('en-US') : ''].filter(Boolean).join(' · '),
      ...(t.rowCount !== null ? { detailTitle: `${t.rowCount} rows` } : {}),
      children: t.columns.map((c): Node => ({
        id: columnId(t, c),
        kind: 'column',
        name: c.name,
        table: t,
        column: c,
        ...(c.isPrimaryKey ? { icon: 'key' as const } : {}),
        detail: [c.references ? `→ ${c.references.table}.${c.references.column}` : '', c.type, c.nullable ? '' : 'not null'].filter(Boolean).join(' '),
        ...(c.references ? { detailTitle: `References ${c.references.schema}.${c.references.table}(${c.references.column})` } : {}),
      })),
    })),
  }));
}

export interface SchemaTreeProps extends Omit<ComponentProps<'div'>, 'children' | 'onSelect'>, VariantProps<typeof schemaTreeVariants> {
  /** From `useSchema()`. `null` while it loads. */
  schema: SchemaInfo | null;
  isLoading?: boolean;
  /** A table (or view) was chosen: Enter, or a click. */
  onSelectTable?: (table: SchemaTable) => void;
  onSelectColumn?: (table: SchemaTable, column: SchemaColumn) => void;
  /** Expand every table's columns at first (default: only schemas are open). */
  defaultExpandAll?: boolean;
  'aria-label'?: string;
}

export function SchemaTree({
  schema, isLoading, onSelectTable, onSelectColumn, defaultExpandAll, variant, className, style, 'aria-label': ariaLabel = 'Database schema', ...props
}: SchemaTreeProps) {
  const nodes = useMemo(() => (schema ? nodesOf(schema) : []), [schema]);
  const index = useMemo(() => {
    const m = new Map<string, Node>();
    const visit = (n: TreeNode) => {
      m.set(n.id, n as Node);
      n.children?.forEach(visit);
    };
    nodes.forEach(visit);
    return m;
  }, [nodes]);
  // A schema that appears later (a `create schema`) opens by itself, without closing what the user toggled.
  const expanded = useMemo(() => nodes.flatMap((n) => [n.id, ...(defaultExpandAll ? (n.children ?? []).map((c) => c.id) : [])]), [nodes, defaultExpandAll]);
  const choose = (id: string | undefined) => {
    const node = id ? index.get(id) : undefined;
    if (node?.kind === 'table') onSelectTable?.(node.table);
    else if (node?.kind === 'column') onSelectColumn?.(node.table, node.column);
  };

  return (
    <div data-slot="schema-tree" aria-busy={isLoading || undefined} className={cn(schemaTreeVariants({ variant }), className)} style={style} {...props}>
      {isLoading && !schema ? (
        <div role="group" aria-label={`${ariaLabel} loading`} className="flex flex-col gap-2 p-2">
          <Skeleton shape="text" className="w-1/3" />
          <Skeleton shape="text" className="ms-4 w-2/3" />
          <Skeleton shape="text" className="ms-4 w-1/2" />
        </div>
      ) : (
        nodes.length ? (
          <Tree aria-label={ariaLabel} items={nodes} icons="none" defaultExpanded={expanded} expandedIds={expanded} density="compact"
            onSelectionChange={([id]) => choose(id)} onAction={(node) => choose(node.id)} className="min-h-48 flex-1" />
        ) : <div className="px-3 py-6 text-center text-footnote text-foreground/65">No tables yet</div>
      )}
    </div>
  );
}

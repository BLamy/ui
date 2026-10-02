'use client';
import { useEffect, useMemo, useRef, useState, type ComponentProps, type CSSProperties } from 'react';
import {
  Button as AriaButton, Collection, Tree as AriaTree, TreeItem as AriaTreeItem, TreeItemContent as AriaTreeItemContent,
  type Key,
} from 'react-aria-components';
import { cva, type VariantProps } from 'class-variance-authority';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';
import type { SchemaColumn, SchemaInfo, SchemaTable } from '@/lib/pglite-schema';

/* ══ SchemaTree — schemas → tables → columns on react-aria's Tree ══
   Arrow keys move, → expands and ← collapses, Enter (or a click) on a table fires `onSelectTable` — SqlConsole uses it
   to paste `select * from …` into the editor — and on a column `onSelectColumn`. Columns carry their type, a key for
   the primary key, `→ table.column` for a foreign key and a medium-weight name when NOT NULL. Schemas start expanded. */

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

type Node =
  | { id: string; kind: 'schema'; label: string; children: Node[]; tables: number }
  | { id: string; kind: 'table'; label: string; children: Node[]; table: SchemaTable }
  | { id: string; kind: 'column'; label: string; children?: undefined; table: SchemaTable; column: SchemaColumn };

const schemaId = (s: string) => `schema:${s}`;
const tableId = (t: SchemaTable) => `table:${t.schema}.${t.name}`;
const columnId = (t: SchemaTable, c: SchemaColumn) => `column:${t.schema}.${t.name}.${c.name}`;

function nodesOf(schema: SchemaInfo): Node[] {
  return schema.schemas.map((s) => ({
    id: schemaId(s.name),
    kind: 'schema',
    label: s.name,
    tables: s.tables.length,
    children: s.tables.map((t): Node => ({
      id: tableId(t),
      kind: 'table',
      label: t.name,
      table: t,
      children: t.columns.map((c): Node => ({ id: columnId(t, c), kind: 'column', label: c.name, table: t, column: c })),
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

function Row({ node }: { node: Node }) {
  return (
    <AriaTreeItemContent>
      {({ hasChildItems, isExpanded, level }) => (
        <div
          className="flex min-h-7 w-full min-w-0 items-center gap-1.5 ps-[calc((var(--level)-1)*0.875rem+0.25rem)] pe-2"
          style={{ '--level': level } as CSSProperties}
        >
          {hasChildItems ? (
            <AriaButton slot="chevron" className="grid size-5 shrink-0 place-items-center rounded-md border-0 bg-transparent p-0 text-foreground/65 outline-none data-focus-visible:ring-2 data-focus-visible:ring-ring">
              <Icon name="chevron-right" size={12} sw={2.4} className={cn('transition-transform duration-spring-snappy ease-spring-snappy motion-reduce:transition-none', isExpanded && 'rotate-90')} />
            </AriaButton>
          ) : (
            <span className="size-5 shrink-0" />
          )}
          {node.kind === 'schema' ? (
            <>
              <span className="min-w-0 flex-1 truncate font-semibold">{node.label}</span>
              <span className="text-caption2 text-foreground/65 tabular-nums">{node.tables}</span>
            </>
          ) : node.kind === 'table' ? (
            <>
              <Icon name={node.table.kind === 'view' || node.table.kind === 'materialized view' ? 'eye' : 'table'} size={14} className="shrink-0 text-foreground/65" />
              <span className="min-w-0 flex-1 truncate">{node.label}</span>
              {node.table.kind !== 'table' ? <Badge variant="secondary" className="h-4 px-1.5 text-caption2">{node.table.kind === 'materialized view' ? 'matview' : node.table.kind.replace(' table', '')}</Badge> : null}
              {node.table.rowCount !== null ? <span className="text-caption2 text-foreground/65 tabular-nums" title={`${node.table.rowCount} rows`}>{node.table.rowCount.toLocaleString('en-US')}</span> : null}
            </>
          ) : (
            <>
              {node.column.isPrimaryKey ? <Icon name="key" size={12} title="Primary key" className="shrink-0 text-warning" /> : null}
              <span className={cn('min-w-0 flex-1 truncate', !node.column.nullable && 'font-medium')}>{node.label}</span>
              {node.column.references ? (
                <span className="truncate text-caption2 text-foreground/65" title={`References ${node.column.references.schema}.${node.column.references.table}(${node.column.references.column})`}>
                  → {node.column.references.table}.{node.column.references.column}
                </span>
              ) : null}
              <Badge variant="secondary" className="h-4 max-w-28 shrink truncate px-1.5 font-mono text-caption2 font-normal" title={node.column.type}>{node.column.type}</Badge>
            </>
          )}
        </div>
      )}
    </AriaTreeItemContent>
  );
}

function renderNode(node: Node) {
  return (
    <AriaTreeItem
      key={node.id}
      id={node.id}
      textValue={node.kind === 'column' ? `${node.label}, ${node.column.type}` : node.label}
      className="group/tree-item cursor-default rounded-ctl outline-none data-focus-visible:ring-2 data-focus-visible:ring-ring data-hovered:bg-accent/60 data-pressed:bg-accent"
    >
      <Row node={node} />
      {node.children ? <Collection items={node.children}>{renderNode}</Collection> : null}
    </AriaTreeItem>
  );
}

export function SchemaTree({
  schema, isLoading, onSelectTable, onSelectColumn, defaultExpandAll, variant, className, style, 'aria-label': ariaLabel = 'Database schema', ...props
}: SchemaTreeProps) {
  const nodes = useMemo(() => (schema ? nodesOf(schema) : []), [schema]);
  const index = useMemo(() => {
    const m = new Map<string, Node>();
    const visit = (n: Node) => {
      m.set(n.id, n);
      n.children?.forEach(visit);
    };
    nodes.forEach(visit);
    return m;
  }, [nodes]);
  // Controlled so a schema that appears later (a `create schema`) opens by itself, without resetting what the user toggled.
  const [expandedKeys, setExpandedKeys] = useState<Set<Key>>(() => new Set());
  const seen = useRef(new Set<string>());
  useEffect(() => {
    const fresh = nodes.flatMap((n) => [n, ...(defaultExpandAll ? (n.children ?? []) : [])]).filter((n) => !seen.current.has(n.id));
    if (!fresh.length) return;
    fresh.forEach((n) => seen.current.add(n.id));
    setExpandedKeys((prev) => new Set([...prev, ...fresh.map((n) => n.id)]));
  }, [nodes, defaultExpandAll]);

  return (
    <div data-slot="schema-tree" aria-busy={isLoading || undefined} className={cn(schemaTreeVariants({ variant }), className)} style={style} {...props}>
      {isLoading && !schema ? (
        <div role="group" aria-label={`${ariaLabel} loading`} className="flex flex-col gap-2 p-2">
          <Skeleton shape="text" className="w-1/3" />
          <Skeleton shape="text" className="ms-4 w-2/3" />
          <Skeleton shape="text" className="ms-4 w-1/2" />
        </div>
      ) : (
        <AriaTree
          aria-label={ariaLabel}
          items={nodes}
          expandedKeys={expandedKeys}
          onExpandedChange={(keys) => setExpandedKeys(new Set(keys))}
          onAction={(key) => {
            const node = index.get(String(key));
            if (node?.kind === 'table') onSelectTable?.(node.table);
            else if (node?.kind === 'column') onSelectColumn?.(node.table, node.column);
          }}
          renderEmptyState={() => <div className="px-3 py-6 text-center text-footnote text-foreground/65">No tables yet</div>}
          className="bl-scroll min-h-0 flex-1 overflow-auto outline-none"
        >
          {renderNode}
        </AriaTree>
      )}
    </div>
  );
}

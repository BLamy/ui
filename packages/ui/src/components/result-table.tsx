'use client';
import { useMemo, useState, type ComponentProps, type CSSProperties, type ReactNode } from 'react';
import {
  Cell as AriaCell, Column as AriaColumn, ColumnResizer, ResizableTableContainer, Row as AriaRow,
  Table as AriaTable, TableBody as AriaTableBody, TableHeader as AriaTableHeader,
} from 'react-aria-components';
import { cva, type VariantProps } from 'class-variance-authority';
import { Button } from '@/components/ui/button';
import { Icon } from '@/lib/icon';
import { selectableText } from '@/lib/primitives';
import { cn } from '@/lib/utils';
import { formatCell, formatDuration, pgTypeName, pluralRows, toCsv, toJson, type FormattedCell } from '@/lib/sql-format';

/* ══ ResultTable — query results on react-aria's Table ══
   A grid with a sticky header, one column per field and type-aware cells: NULL in a muted italic, numbers right
   aligned in tabular figures, dates as ISO text, bytea as hex, JSON compact in the cell and pretty-printed when
   expanded. Long values are cut at the cell's width; a cell with more to show has an expand button. The toolbar says
   what came back ("3 rows · 12 ms") and copies the rows as CSV or JSON.

   Rows render in pages (`maxRows`, then "Show more"): a browser table of a hundred thousand rows is slow whatever
   draws it, and results this big belong in a LIMIT. Keyboard: arrow keys move between cells (a grid), Tab leaves. */

export const resultTableVariants = cva(
  'flex min-h-0 min-w-0 flex-col overflow-hidden rounded-panel bg-card text-card-foreground shadow-hairline',
  {
    variants: {
      /** Row height: `compact` (default) packs more rows, `comfortable` suits touch. */
      density: {
        compact: '[--result-pad:calc(var(--spacing)*1.5)]',
        comfortable: '[--result-pad:calc(var(--spacing)*2.5)]',
      },
    },
    defaultVariants: { density: 'compact' },
  },
);

export interface ResultField {
  name: string;
  /** The column's type OID (PGlite's `dataTypeID`): refines dates and numbers, and labels the header. */
  dataTypeID?: number;
}

export interface ResultSet {
  fields: readonly ResultField[];
  rows: readonly Record<string, unknown>[];
  /** `SELECT`, `INSERT`, … — shown when the statement returned no columns. */
  command?: string;
  /** Rows changed by a write. */
  rowCount?: number;
}

export interface ResultTableProps extends Omit<ComponentProps<'div'>, 'children' | 'onCopy'>, VariantProps<typeof resultTableVariants> {
  result: ResultSet;
  /** How long the statement took, in ms. */
  durationMs?: number;
  /** Rows drawn before "Show more" (default 200). */
  maxRows?: number;
  /** Let people drag the column edges. */
  resizable?: boolean;
  /** Show the summary and copy buttons (default true). */
  toolbar?: boolean;
  /** Height cap of the scrolling grid, as a CSS length (default `24rem`). */
  maxHeight?: string;
  /** Shown instead of the grid when there are no rows. */
  emptyMessage?: ReactNode;
  /** Called after Copy CSV / Copy JSON with what was copied. */
  onCopy?: (format: 'csv' | 'json', text: string) => void;
  'aria-label'?: string;
}

const EXPAND_AT = 80;

/** One cell: the formatted value, with an expand button when it is long, multi-line or structured. */
function ResultCell({ cell, oid }: { cell: FormattedCell; oid?: number }) {
  const [open, setOpen] = useState(false);
  const expandable = cell.kind !== 'null' && (cell.full.length > EXPAND_AT || cell.full.includes('\n') || (cell.kind === 'json' && cell.full !== cell.text));
  return (
    <div className="flex min-w-0 items-start gap-1" data-kind={cell.kind} data-oid={oid}>
      {open ? (
        <pre className={cn('max-h-64 min-w-0 flex-1 overflow-auto font-mono text-caption leading-snug break-all whitespace-pre-wrap', selectableText)}>{cell.full}</pre>
      ) : (
        <span
          title={expandable ? cell.full : undefined}
          className={cn(
            'min-w-0 flex-1 truncate',
            cell.align === 'end' && 'text-end tabular-nums',
            cell.kind === 'null' && 'text-foreground/65 italic',
            (cell.kind === 'json' || cell.kind === 'bytea') && 'font-mono text-caption',
            cell.kind === 'boolean' && 'font-medium',
            selectableText,
          )}
        >
          {cell.text}
        </span>
      )}
      {expandable ? (
        <Button
          variant="ghost"
          size="icon"
          aria-label={open ? 'Collapse value' : 'Expand value'}
          aria-expanded={open}
          onPress={() => setOpen((v) => !v)}
          className="size-5 shrink-0 text-foreground/65"
        >
          <Icon name={open ? 'chevron-up' : 'chevron-down'} size={12} sw={2.2} />
        </Button>
      ) : null}
    </div>
  );
}

const columnClass =
  'sticky top-0 z-1 max-w-80 min-w-24 bg-secondary px-3 py-1.5 text-start text-caption font-semibold whitespace-nowrap text-foreground/65 shadow-hairline-b outline-none data-focus-visible:ring-2 data-focus-visible:ring-ring data-focus-visible:ring-inset';
const cellClass =
  'max-w-80 px-3 py-(--result-pad) align-top shadow-hairline-b outline-none data-focus-visible:ring-2 data-focus-visible:ring-ring data-focus-visible:ring-inset';

export function ResultTable({
  result, durationMs, maxRows = 200, resizable = false, toolbar = true, maxHeight = '24rem', emptyMessage, onCopy, density,
  className, style, 'aria-label': ariaLabel = 'Query results', ...props
}: ResultTableProps) {
  const [shown, setShown] = useState(maxRows);
  const [copied, setCopied] = useState<'csv' | 'json' | null>(null);
  const { fields, rows } = result;
  const items = useMemo(() => rows.slice(0, shown).map((row, id) => ({ id, row })), [rows, shown]);
  const columns = useMemo(() => fields.map((f, i) => ({ id: `c${i}`, name: f.name, oid: f.dataTypeID })), [fields]);

  const copy = (format: 'csv' | 'json') => {
    const text = format === 'csv' ? toCsv(result) : toJson(result);
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(format);
      setTimeout(() => setCopied(null), 1500);
    });
    onCopy?.(format, text);
  };

  const summary =
    fields.length === 0
      ? `${result.command ?? 'OK'}${result.rowCount !== undefined ? ` · ${pluralRows(result.rowCount)} affected` : ''}`
      : pluralRows(rows.length);

  const grid = (
    <AriaTable aria-label={ariaLabel} className="w-max min-w-full border-separate border-spacing-0 text-footnote">
      <AriaTableHeader columns={columns}>
        {(col) => (
          <AriaColumn id={col.id} isRowHeader={col.id === 'c0'} className={columnClass}>
            <div className="flex items-baseline gap-1.5">
              <span className="truncate">{col.name}</span>
              <span className="text-caption2 font-normal text-foreground/65">{pgTypeName(col.oid)}</span>
              {resizable ? <ColumnResizer className="absolute inset-y-0 end-0 w-1.5 cursor-col-resize touch-none data-resizing:bg-primary/40" /> : null}
            </div>
          </AriaColumn>
        )}
      </AriaTableHeader>
      <AriaTableBody items={items}>
        {(item) => (
          <AriaRow id={item.id} columns={columns} className="outline-none data-hovered:bg-accent/50">
            {(col) => (
              <AriaCell className={cellClass}>
                <ResultCell cell={formatCell(item.row[col.name], col.oid)} oid={col.oid} />
              </AriaCell>
            )}
          </AriaRow>
        )}
      </AriaTableBody>
    </AriaTable>
  );

  return (
    <div
      data-slot="result-table"
      data-rows={rows.length}
      className={cn(resultTableVariants({ density }), className)}
      style={{ '--result-max-h': maxHeight, ...style } as CSSProperties}
      {...props}
    >
      {toolbar ? (
        <div data-slot="result-table-toolbar" className="flex min-h-9 shrink-0 items-center gap-2 px-3 py-1 shadow-hairline-b">
          <span data-slot="result-table-summary" role="status" className="min-w-0 flex-1 truncate text-footnote text-foreground/65 tabular-nums">
            {summary}
            {durationMs !== undefined ? ` · ${formatDuration(durationMs)}` : ''}
            {rows.length > shown ? ` · showing ${shown.toLocaleString('en-US')}` : ''}
          </span>
          {fields.length > 0 && rows.length > 0 ? (
            <>
              <Button variant="ghost" size="sm" onPress={() => copy('csv')}>{copied === 'csv' ? 'Copied' : 'Copy CSV'}</Button>
              <Button variant="ghost" size="sm" onPress={() => copy('json')}>{copied === 'json' ? 'Copied' : 'Copy JSON'}</Button>
            </>
          ) : null}
        </div>
      ) : null}

      {fields.length === 0 ? null : rows.length === 0 ? (
        <div className="px-3 py-6 text-center text-footnote text-foreground/65">{emptyMessage ?? 'No rows'}</div>
      ) : resizable ? (
        <ResizableTableContainer className="bl-scroll max-h-(--result-max-h) min-h-0 overflow-auto">
          {grid}
        </ResizableTableContainer>
      ) : (
        <div className="bl-scroll max-h-(--result-max-h) min-h-0 overflow-auto">
          {grid}
        </div>
      )}

      {rows.length > shown ? (
        <div className="flex shrink-0 justify-center px-3 py-1.5 shadow-hairline-t">
          <Button variant="ghost" size="sm" onPress={() => setShown((n) => n + maxRows)}>
            Show {Math.min(maxRows, rows.length - shown).toLocaleString('en-US')} more of {(rows.length - shown).toLocaleString('en-US')} remaining
          </Button>
        </div>
      ) : null}
    </div>
  );
}

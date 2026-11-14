'use client';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { ChangeDetails } from '@ui-sdk/core';
import { createParts, usePart, usePrimitive, type PartProps } from '@ui-sdk/react/primitive';
import { cva, type VariantProps } from 'class-variance-authority';
import { Button } from '@/components/ui/button';
import { Icon } from '@/lib/icon';
import { selectableText } from '@/lib/primitives';
import { resultTable, type ResultTableColumnWidthsChangeReason, type ResultTableOptions } from '@/lib/result-table-primitive';
import { cn, cx } from '@/lib/utils';
import { formatCell, formatDuration, pgTypeName, pluralRows, toCsv, toJson, type FormattedCell } from '@/lib/sql-format';

/* ══ ResultTable — query results in a grid ══
   A grid with a sticky header, one column per field and type-aware cells: NULL in a muted italic, numbers right
   aligned in tabular figures, dates as ISO text, bytea as hex, JSON compact in the cell and pretty-printed when
   expanded. Long values are cut at the cell's width; a cell with more to show has an expand button. The toolbar says
   what came back ("3 rows · 12 ms"), reads a new result out through UI SDK's `announce()`, and copies the rows as CSV or JSON.

   Rows render in pages (`maxRows`, then "Show more"): a browser table of a hundred thousand rows is slow whatever
   draws it, and results this big belong in a LIMIT. It's the result-table primitive (lib/result-table-primitive), on
   UI SDK's grid focus and resize: one tab stop, where the arrow keys move between cells (the headers included), Home
   and End go to a row's ends, Tab goes through a cell's expand button and on out, and with `resizable` a column's edge
   drags, and ⌥← ⌥→ on its header narrow and widen it. */

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

export interface ResultTableProps extends Omit<PartProps<'div'>, 'children' | 'onCopy'>, VariantProps<typeof resultTableVariants> {
  result: ResultSet;
  /** How long the statement took, in ms. */
  durationMs?: number;
  /** Rows drawn before "Show more" (default 200). */
  maxRows?: number;
  /** Let people drag the column edges. */
  resizable?: boolean;
  /** Widths set so far, in px by column index (`"0"`, `"1"`, …), controlled. A column with none keeps its own size. */
  columnWidths?: Readonly<Record<string, number>>;
  defaultColumnWidths?: Readonly<Record<string, number>>;
  onColumnWidthsChange?: (widths: Readonly<Record<string, number>>, details: ChangeDetails<ResultTableColumnWidthsChangeReason>) => void;
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
          onClick={() => setOpen((v) => !v)}
          className="size-5 shrink-0 text-foreground/65"
        >
          <Icon name={open ? 'chevron-up' : 'chevron-down'} size={12} sw={2.2} />
        </Button>
      ) : null}
    </div>
  );
}

const parts = createParts(resultTable, { grid: 'table', row: 'tr', column: 'th', resizer: 'div', cell: 'td' });

const columnClass =
  'sticky top-0 z-1 max-w-80 min-w-24 bg-secondary px-3 py-1.5 text-start text-caption font-semibold whitespace-nowrap text-foreground/65 shadow-hairline-b outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset';
const cellClass =
  'max-w-80 px-3 py-(--result-pad) align-top shadow-hairline-b outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset';

export function ResultTable({
  result, durationMs, maxRows = 200, resizable = false, toolbar = true, maxHeight = '24rem', emptyMessage, onCopy, density,
  columnWidths, defaultColumnWidths, onColumnWidthsChange, className, style, 'aria-label': ariaLabel = 'Query results', ...props
}: ResultTableProps) {
  const [shown, setShown] = useState(maxRows);
  const [copied, setCopied] = useState<'csv' | 'json' | null>(null);
  // "Copied" shows for a while: a second copy restarts it, and none outlives the table.
  const copiedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(copiedTimer.current), []);
  const { fields, rows } = result;
  const items = useMemo(() => rows.slice(0, shown), [rows, shown]);
  const columns = useMemo(() => fields.map((f) => ({ name: f.name, oid: f.dataTypeID })), [fields]);

  const copy = (format: 'csv' | 'json') => {
    const text = format === 'csv' ? toCsv(result) : toJson(result);
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(format);
      clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(null), 1500);
    });
    onCopy?.(format, text);
  };

  const summary =
    fields.length === 0
      ? `${result.command ?? 'OK'}${result.rowCount !== undefined ? ` · ${pluralRows(result.rowCount)} affected` : ''}`
      : pluralRows(rows.length);
  const said = `${summary}${durationMs !== undefined ? ` · ${formatDuration(durationMs)}` : ''}`;

  const options: ResultTableOptions = {
    rows: items.length, cols: columns.length, resizable, columnWidths, defaultColumnWidths, onColumnWidthsChange,
    result, durationMs, summary: said,
  };
  const handle = usePrimitive(resultTable, options);

  return usePart(handle, 'root', {}, {
    ...({ 'data-rows': rows.length } as object),
    ...props,
    className: cx(resultTableVariants({ density }), className),
    style: (state) => ({ '--result-max-h': maxHeight, ...(typeof style === 'function' ? style(state) : style) } as CSSProperties),
    children: (
      <>
        {toolbar ? (
          <div data-slot="result-table-toolbar" className="flex min-h-9 shrink-0 items-center gap-2 px-3 py-1 shadow-hairline-b">
            <span data-slot="result-table-summary" className="min-w-0 flex-1 truncate text-footnote text-foreground/65 tabular-nums">
              {said}
              {rows.length > shown ? ` · showing ${shown.toLocaleString('en-US')}` : ''}
            </span>
            {fields.length > 0 && rows.length > 0 ? (
              <>
                <Button variant="ghost" size="sm" onClick={() => copy('csv')}>{copied === 'csv' ? 'Copied' : 'Copy CSV'}</Button>
                <Button variant="ghost" size="sm" onClick={() => copy('json')}>{copied === 'json' ? 'Copied' : 'Copy JSON'}</Button>
              </>
            ) : null}
          </div>
        ) : null}

        {fields.length === 0 ? null : rows.length === 0 ? (
          <div className="px-3 py-6 text-center text-footnote text-foreground/65">{emptyMessage ?? 'No rows'}</div>
        ) : (
          <div className="bl-scroll max-h-(--result-max-h) min-h-0 overflow-auto">
            <parts.Grid aria-label={ariaLabel} className={cn(
              'min-w-full border-separate border-spacing-0 text-footnote',
              // Resizable, the columns share the table's width (equal parts until one is set), and a set width is
              // the column's width, whatever its cells hold.
              resizable ? 'w-min table-fixed' : 'w-max',
            )}>
              <thead>
                <parts.Row row={0}>
                  {columns.map((col, i) => (
                    <ResultColumn key={i} col={i} name={col.name} oid={col.oid} resizable={resizable} />
                  ))}
                </parts.Row>
              </thead>
              <tbody>
                {items.map((row, r) => (
                  <ResultRow key={r} row={r + 1} values={row} columns={columns} />
                ))}
              </tbody>
            </parts.Grid>
          </div>
        )}

        {rows.length > shown ? (
          <div className="flex shrink-0 justify-center px-3 py-1.5 shadow-hairline-t">
            <Button variant="ghost" size="sm" onClick={() => setShown((n) => n + maxRows)}>
              Show {Math.min(maxRows, rows.length - shown).toLocaleString('en-US')} more of {(rows.length - shown).toLocaleString('en-US')} remaining
            </Button>
          </div>
        ) : null}
      </>
    ),
  }, 'div');
}

function ResultColumn({ col, name, oid, resizable }: { col: number; name: string; oid?: number; resizable: boolean }) {
  return (
    <parts.Column value={`0:${col}`} row={0} col={col} className={columnClass}>
      <div className="flex items-baseline gap-1.5">
        <span className="truncate">{name}</span>
        <span className="text-caption2 font-normal text-foreground/65">{pgTypeName(oid)}</span>
        {resizable ? (
          <parts.Resizer
            value={String(col)}
            aria-label={`Resize ${name}`}
            className="absolute inset-y-0 end-0 w-1.5 cursor-col-resize touch-none data-dragging:bg-primary/40"
          />
        ) : null}
      </div>
    </parts.Column>
  );
}

function ResultRow({ row, values, columns }: { row: number; values: Record<string, unknown>; columns: readonly { name: string; oid?: number }[] }) {
  return (
    <parts.Row row={row} className="outline-none hover:bg-accent/50">
      {columns.map((col, c) => (
        <parts.Cell key={c} value={`${row}:${c}`} row={row} col={c} className={cellClass}>
          <ResultCell cell={formatCell(values[col.name], col.oid)} oid={col.oid} />
        </parts.Cell>
      ))}
    </parts.Row>
  );
}

export type { ResultTableColumnWidthsChangeReason } from '@/lib/result-table-primitive';

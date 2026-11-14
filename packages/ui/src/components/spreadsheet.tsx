'use client';
import { memo, useSyncExternalStore, type ReactNode } from 'react';
import type { ChangeDetails } from '@ui-sdk/core';
import { createParts, usePart, usePrimitive, type PartProps, type PrimitiveHandle } from '@ui-sdk/react/primitive';
import { Button as SdkButton } from '@ui-sdk/react/button';
import { cva, type VariantProps } from 'class-variance-authority';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/lib/icon';
import { columnResizerClass } from '@/lib/primitives';
import { cn, cx } from '@/lib/utils';
import { GPU_MIN_ROWS, type SpreadsheetEngine, type SpreadsheetHistogram, type SpreadsheetRanOn, type SpreadsheetSort } from '@/lib/spreadsheet-model';
import {
  HISTOGRAM_HEIGHT, spreadsheetColumnLetter, spreadsheet,
  type SpreadsheetColumnWidthsChangeReason, type SpreadsheetController, type SpreadsheetOptions, type SpreadsheetSortChangeReason,
  type SpreadsheetSortInfo, type SpreadsheetValueChangeReason, type SpreadsheetView,
} from '@/lib/spreadsheet-primitive';

/* ══ Spreadsheet — a grid of string cells, with the heavy work on the GPU ══
   Rows and columns are virtualized: only the cells in view (plus a few) are in the DOM, so a million-row CSV scrolls
   like a ten-row one. Sorting a number or date column runs as a bitonic sort of exact 64-bit keys in a WebGPU
   compute shader, and each number column's header draws a histogram tallied on the GPU; both fall back to the CPU
   with the same answers (see lib/spreadsheet-model). The status bar says which one ran and how long it took.

   It's the spreadsheet primitive (lib/spreadsheet-primitive), on UI SDK's grid focus, cell range, inline edit, undo
   stack, resize and virtualizer: one tab stop, where the arrow keys move (⇧ extends, ⌘/Ctrl jumps to the edge), Home/End
   and Page Up/Down too; Enter, F2 or typing edits the cell (Enter and Tab save and move, Esc cancels); Delete clears
   the selection; ⌘C / ⌘X / ⌘V copy, cut and paste tab-separated text; ⌘Z / ⇧⌘Z undo and redo; ⌥← / ⌥→ narrow and
   widen the column. Drag across cells to select, click a title to select its column, a row number its row. Sorting
   changes the view, not the data: `onValueChange` keeps the file's order. A column's sort button is UI SDK's Button
   (out of the Tab order: the header cell is the stop), Add Row the kit's. It shares DataTable's column edge
   (`columnResizerClass`) and `EmptyState`; it is not a DataTable because its unit is a cell that edits, not a row. */

export const spreadsheetVariants = cva(
  'relative flex min-h-0 min-w-0 flex-col overflow-hidden rounded-panel bg-card text-card-foreground shadow-hairline',
  {
    variants: {
      /** Row height: `compact` (default, 28 px), `default` (32 px) or `comfortable` (36 px, for touch). */
      density: { compact: '', default: '', comfortable: '' },
    },
    defaultVariants: { density: 'compact' },
  },
);

const ROW_HEIGHT = { compact: 28, default: 32, comfortable: 36 } as const;

export interface SpreadsheetProps
  extends Omit<PartProps<'div'>, 'children' | 'defaultValue'>, VariantProps<typeof spreadsheetVariants> {
  /** Rows of cells (rows may be ragged). With `header`, the first row holds the column titles. */
  value?: string[][];
  defaultValue?: string[][];
  /** Every edit, paste, cut, undo and added row, in the data's own order, with why it changed. */
  onValueChange?: (rows: string[][], details: ChangeDetails<SpreadsheetValueChangeReason>) => void;
  /** The first row is column titles (default `true`); without it the columns are lettered A, B, C… */
  header?: boolean;
  /** Cells can be selected and copied, not edited. */
  readOnly?: boolean;
  /** Where sorting and histograms run (default `auto`, see `SpreadsheetEngine`). */
  engine?: SpreadsheetEngine;
  /** `auto` uses the GPU from this many rows (default 20,000). */
  gpuMinRows?: number;
  /** A histogram under each number or date column's title (default `true`). */
  histograms?: boolean;
  /** The sort, by column index, controlled; `null` for the file's own order. Sorting changes the view, not the rows. */
  sort?: SpreadsheetSort | null;
  defaultSort?: SpreadsheetSort | null;
  /** A sort asked for (a column's sort button, the controller), before it runs: cancel it with `details.cancel()`. */
  onSortChange?: (sort: SpreadsheetSort | null, details: ChangeDetails<SpreadsheetSortChangeReason>) => void;
  /** A sort has run, with the engine that ran it and how long it took; `null` when it was cleared. */
  onSorted?: (info: SpreadsheetSortInfo | null) => void;
  /** `false` hides the status bar (row count, selection sum, sort timing, Add Row). */
  statusBar?: boolean;
  /** Extra controls at the end of the status bar. */
  actions?: ReactNode;
  /** Shown when there are no rows. Default `<EmptyState size="sm" title="No rows" description="Paste cells or add a row." />`
   *  (without the description when read-only). */
  emptyState?: ReactNode;
  /** Width in px of a column with no text to size it from. Other columns start at the widest of their title and first rows (≤ 320). */
  columnWidth?: number;
  /** Widths set so far, in px by column index (`"0"`, `"1"`, …), controlled. A column with none keeps its estimated size. */
  columnWidths?: Readonly<Record<string, number>>;
  defaultColumnWidths?: Readonly<Record<string, number>>;
  onColumnWidthsChange?: (widths: Readonly<Record<string, number>>, details: ChangeDetails<SpreadsheetColumnWidthsChangeReason>) => void;
  /** Drives the grid from outside: `createSpreadsheetController()`. */
  controller?: SpreadsheetController;
  'aria-label'?: string;
}

const numberFormat = typeof Intl !== 'undefined' ? new Intl.NumberFormat(undefined, { maximumFractionDigits: 4 }) : null;
const formatNumber = (n: number) => (numberFormat ? numberFormat.format(n) : String(n));
const isNumeric = (type: string | undefined) => type === 'number' || type === 'date';
const ranOnText = (r: SpreadsheetRanOn) => (r === 'gpu' ? 'on the GPU' : 'on the CPU');

function HistogramBars({ histogram, label }: { histogram: SpreadsheetHistogram; label: string }) {
  const bins = histogram.bins;
  let peak = 1;
  for (const b of bins) peak = Math.max(peak, b);
  const w = 100 / bins.length;
  return (
    <svg role="img" aria-label={`${label}: values from ${formatNumber(histogram.min)} to ${formatNumber(histogram.max)}`}
      data-slot="spreadsheet-histogram" data-engine={histogram.ranOn} viewBox={`0 0 100 ${HISTOGRAM_HEIGHT}`} preserveAspectRatio="none"
      className="block h-(--hist) w-full text-primary/55">
      {Array.from(bins, (b, i) => {
        const h = b ? Math.max(1.5, (b / peak) * HISTOGRAM_HEIGHT) : 0;
        return <rect key={i} x={i * w + w * 0.08} width={w * 0.84} y={HISTOGRAM_HEIGHT - h} height={h} fill="currentColor" />;
      })}
    </svg>
  );
}

const parts = createParts(spreadsheet, { grid: 'div', column: 'div', resizer: 'div', rowheader: 'div', cell: 'div', footer: 'div' });

// Keyed parts: a row by its index (-1 for the titles), a row group as `head` or `body`.
const SpreadsheetRow = ({ row, ...props }: { row: number } & PartProps<'div'>) =>
  usePart(spreadsheet, 'row', { id: row < 0 ? 'head' : String(row), row }, props, 'div');

const SpreadsheetRowGroup = ({ id, ...props }: { id: 'head' | 'body' } & PartProps<'div'>) => usePart(spreadsheet, 'rowgroup', { id }, props, 'div');

type Handle = PrimitiveHandle<typeof spreadsheet>;

const lines = 'box-border border-0 border-r border-b border-solid border-border';
// The selection's outline is drawn on the cells at its edges (`data-range-edge`), or around the active cell alone. It
// straddles the grid lines: one pixel over the line, one inside the cell (the box it is placed in stops short of the
// cell's own right and bottom lines).
const cellClass = cn(
  'absolute top-0 h-full px-2 leading-(--row) outline-none', lines,
  'before:pointer-events-none before:absolute before:-top-px before:-right-0.5 before:-left-px before:-bottom-0.5 before:border-0 before:border-solid before:border-primary',
  'data-active:bg-primary/10 data-active:not-data-selected:before:border-2 data-selected:bg-primary/10',
  // Over the cells after it, whose own backgrounds would hide its outer pixel; under the sticky row headers.
  'data-active:z-5 data-range-edge:z-5',
  'data-[range-edge~=top]:before:border-t-2 data-[range-edge~=right]:before:border-r-2 data-[range-edge~=bottom]:before:border-b-2 data-[range-edge~=left]:before:border-l-2',
  'data-editing:z-30 data-editing:overflow-visible',
);
const editorClass = 'absolute inset-y-0 start-0 z-30 m-0 box-border w-full min-w-30 rounded-none border-0 bg-card px-2 text-footnote text-foreground outline-2 -outline-offset-1 outline-primary';

// Keyed, like the cells, so the grid's own name names the component for agents.
const SpreadsheetEditor = ({ label, className }: { label: string; className?: string }) =>
  usePart(spreadsheet, 'editor', { id: 'editor' }, { 'aria-label': label, className: cn(editorClass, className) }, 'input');
const SpreadsheetCorner = () =>
  usePart(spreadsheet, 'corner', { id: 'corner' }, { className: cn('sticky left-0 z-10 h-full w-(--gutter) bg-secondary', lines) }, 'div');

const SpreadsheetCell = memo(function SpreadsheetCell({ row, col, text, left, width, numeric, label }: {
  row: number; col: number; text: string; left: number; width: number; numeric: boolean; label: string;
}) {
  return (
    <parts.Cell value={`${row}:${col}`} row={row} col={col} className={cn(cellClass, numeric && 'text-end tabular-nums')} style={{ left, width }}>
      {(state) => (state.editing ? <SpreadsheetEditor label={label} /> : <span className="block truncate">{text}</span>)}
    </parts.Cell>
  );
});

const SpreadsheetRowHeader = memo(function SpreadsheetRowHeader({ row }: { row: number }) {
  return (
    <parts.Rowheader
      value={String(row)}
      row={row}
      className={cn('sticky left-0 z-10 flex h-full w-(--gutter) cursor-default items-center justify-end bg-secondary pr-2 text-caption text-muted-foreground tabular-nums', lines,
        'data-selected:bg-secondary-strong data-selected:text-foreground')}
    >
      {row + 1}
    </parts.Rowheader>
  );
});

function SpreadsheetColumn({ col, title, left, width, histogram, bars, header, numeric, onSortPress }: {
  col: number; title: string; left: number; width: number; histogram: SpreadsheetHistogram | null | undefined; bars: boolean; header: boolean;
  numeric: boolean; onSortPress: (col: number, event?: Event) => void;
}) {
  return (
    <parts.Column value={String(col)} col={col} className={cn('group absolute top-0 flex h-full flex-col justify-center bg-secondary px-2', lines, 'data-selected:bg-secondary-strong')} style={{ left, width }}>
      {(state) => (
        <>
          {/* A number column's title lines up with its numbers, at the end; its sort button comes first. */}
          <div className={cn('flex min-w-0 items-center gap-1', numeric && 'flex-row-reverse')}>
            {state.editing ? null : <span className={cn('min-w-0 flex-1 truncate text-footnote font-semibold', numeric && 'text-end')} title={title}>{title}</span>}
            <SdkButton aria-label={`Sort by ${title}${state.sorted === 'ascending' ? ', descending' : state.sorted === 'descending' ? ', clear sort' : ''}`}
              tabIndex={-1} onClick={(event) => onSortPress(col, event.nativeEvent)}
              // Always there, quietly: touch can't hover to find it.
              className={cn('grid size-5 shrink-0 cursor-default place-items-center rounded-ctl border-0 bg-transparent p-0 text-muted-foreground outline-none hover:bg-secondary-strong hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring',
                numeric ? '-ml-1' : '-mr-1', state.sorted && 'text-primary')}>
              <Icon name={state.sorted === 'descending' ? 'arrow-down' : state.sorted === 'ascending' ? 'arrow-up' : 'chevron-up-down'} size={13} weight="semibold" />
            </SdkButton>
          </div>
          {bars ? <div className="mt-0.5 h-(--hist)">{histogram ? <HistogramBars histogram={histogram} label={`${title} histogram`} /> : null}</div> : null}
          {/* The grid places columns by `left`, so the edge is on the right in either direction. */}
          <parts.Resizer value={String(col)} aria-label={`Resize ${title}`} className={cn(columnResizerClass, 'end-auto -right-1 z-10')} />
          {state.editing && header ? <SpreadsheetEditor label={`Title of column ${spreadsheetColumnLetter(col)}`} className="h-7.5 font-semibold" /> : null}
        </>
      )}
    </parts.Column>
  );
}

/** The cells in view, from the two virtualizers, for the rows and sort the state holds. */
function SpreadsheetCells({ handle, state }: { handle: Handle; state: SpreadsheetView }) {
  const { internal } = handle.api;
  const rows = internal.rows;
  const columns = internal.columns;
  const rowItems = useSyncExternalStore(rows.subscribe, rows.items, rows.items);
  const colItems = useSyncExternalStore(columns.subscribe, columns.items, columns.items);
  const model = internal.modelOf(state);
  const { gutter, rowHeight, bars } = internal.layout(state);
  const totalWidth = columns.size();
  const title = (c: number) => internal.title(state, c);
  const numericAt = (c: number) => isNumeric(model.types[c]);

  return (
    <div className="relative" style={{ width: gutter + totalWidth, minHeight: '100%' }}>
      <SpreadsheetRowGroup id="head" className="sticky top-0 z-20 h-(--head)">
        <SpreadsheetRow row={-1} className="relative h-full" style={{ width: gutter + totalWidth }}>
          <SpreadsheetCorner />
          {colItems.map((c) => (
            <SpreadsheetColumn key={c.index} col={c.index} title={title(c.index)} left={gutter + c.start} width={c.size}
              histogram={numericAt(c.index) ? state.bins.byColumn.get(c.index) : undefined} bars={bars} header={state.header}
              numeric={numericAt(c.index)} onSortPress={internal.sortPress} />
          ))}
        </SpreadsheetRow>
      </SpreadsheetRowGroup>
      <SpreadsheetRowGroup id="body" className="relative" style={{ height: rows.size() }}>
        {rowItems.map((r) => {
          if (r.index >= model.body) return null;
          const data = state.value[internal.dataRow(state, r.index)] ?? [];
          return (
            <SpreadsheetRow key={r.index} row={r.index} className="absolute inset-x-0" style={{ top: r.start, height: rowHeight }}>
              <SpreadsheetRowHeader row={r.index} />
              {colItems.map((c) => {
                const text = data[c.index] ?? '';
                return (
                  <SpreadsheetCell key={c.index} row={r.index} col={c.index} text={text} left={gutter + c.start} width={c.size}
                    numeric={numericAt(c.index) && text !== ''} label={`${title(c.index)}, row ${r.index + 1}`} />
                );
              })}
            </SpreadsheetRow>
          );
        })}
      </SpreadsheetRowGroup>
    </div>
  );
}

export function Spreadsheet({
  value, defaultValue, onValueChange, header = true, readOnly = false, engine = 'auto', gpuMinRows = GPU_MIN_ROWS,
  histograms = true, sort, defaultSort, onSortChange, onSorted, statusBar = true, actions, emptyState, columnWidth = 120,
  columnWidths, defaultColumnWidths, onColumnWidthsChange, controller, density, className, style, 'aria-label': ariaLabel = 'Spreadsheet',
  ...props
}: SpreadsheetProps) {
  const options: SpreadsheetOptions = {
    value, defaultValue, onValueChange, header, readOnly, engine, gpuMinRows, histograms, sort, defaultSort, onSortChange, onSorted, columnWidth,
    columnWidths, defaultColumnWidths, onColumnWidthsChange, controller, rowHeight: ROW_HEIGHT[density ?? 'compact'],
  };
  const handle = usePrimitive(spreadsheet, options);
  const { api } = handle;

  return usePart(handle, 'root', {}, {
    ...({ 'data-density': density ?? 'compact' } as object),
    ...props,
    className: cx(spreadsheetVariants({ density }), className),
    style,
    children: (state: SpreadsheetView) => (
      <>
        <parts.Grid
          aria-label={ariaLabel}
          className="bl-scroll relative min-h-0 flex-1 overflow-auto overscroll-contain text-footnote outline-none select-none has-[[data-slot=spreadsheet-cell]:focus-visible]:ring-2 has-[[data-slot=spreadsheet-cell]:focus-visible]:ring-primary has-[[data-slot=spreadsheet-cell]:focus-visible]:ring-inset"
        >
          <SpreadsheetCells handle={handle} state={state} />
          {/* Over the body at the scroller's own width, not inside the columns' (two narrow columns would wrap it). */}
          {!api.internal.modelOf(state).body ? (
            <div data-slot="spreadsheet-empty" className="absolute inset-x-0 top-(--head)">
              {emptyState === undefined
                ? <EmptyState size="sm" title="No rows" description={state.readOnly ? undefined : 'Paste cells or add a row.'} />
                : emptyState}
            </div>
          ) : null}
        </parts.Grid>
        {statusBar ? (
          <parts.Footer className="flex min-h-9 shrink-0 flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1 text-caption text-foreground/70 shadow-hairline-t">
            {(status) => (
              <>
                <span className="tabular-nums">{formatNumber(status.rows)} {status.rows === 1 ? 'row' : 'rows'} × {status.columns} {status.columns === 1 ? 'column' : 'columns'}</span>
                <span data-slot="spreadsheet-sort-status" data-engine={status.sort?.ranOn} className="tabular-nums">
                  {status.sorting ? 'Sorting…' : status.sort ? `Sorted by ${status.sortedBy} ${ranOnText(status.sort.ranOn)} in ${status.sort.ms < 10 ? status.sort.ms.toFixed(1) : Math.round(status.sort.ms)} ms` : null}
                </span>
                <span className="min-w-0 flex-1" />
                {status.stats ? (
                  <span data-slot="spreadsheet-stats" className="tabular-nums">
                    {status.stats.numbers > 1 ? `Sum ${formatNumber(status.stats.sum)} · Average ${formatNumber(status.stats.average)} · ` : ''}Count {formatNumber(status.stats.count)}
                  </span>
                ) : null}
                {actions}
                {readOnly ? null : (
                  <Button variant="ghost" size="sm" className="-me-1.5 gap-1 text-caption" onClick={(event) => api.internal.addRow(event.nativeEvent)}>
                    <Icon name="plus" size={12} weight="semibold" className="text-primary" />Add Row
                  </Button>
                )}
              </>
            )}
          </parts.Footer>
        ) : null}
      </>
    ),
  }, 'div');
}

export { createSpreadsheetController } from '@/lib/spreadsheet-primitive';
export type {
  SpreadsheetColumnWidthsChangeReason, SpreadsheetController, SpreadsheetSortChangeReason, SpreadsheetSortInfo, SpreadsheetValueChangeReason,
} from '@/lib/spreadsheet-primitive';

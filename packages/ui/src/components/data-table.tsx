'use client';
import {
  createContext, memo, useContext, useId, useMemo, useSyncExternalStore,
  type ReactElement, type ReactNode,
} from 'react';
import type { ChangeDetails, VirtualItem } from '@ui-sdk/core';
import { createParts, usePart, usePrimitive, type PartProps, type PrimitiveHandle } from '@ui-sdk/react/primitive';
import { cva, type VariantProps } from 'class-variance-authority';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { renderEmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Icon } from '@/lib/icon';
import type { RowId } from '@/lib/log-list-model';
import type { DataTableColumnSize, DataTableSort, DataTableSortValue, DataTableTimeRange } from '@/lib/data-table-model';
import {
  dataTable, type DataTableActionDetails, type DataTableBreakpoints, type DataTableColumnWidthsChangeReason,
  type DataTableController, type DataTableOptions, type DataTableRow, type DataTableSortChangeReason, type DataTableValueChangeReason,
} from '@/lib/data-table-primitive';
import { columnResizerClass, dataRowLayers, tableHeaderCellClass } from '@/lib/primitives';
import { cn, cx } from '@/lib/utils';

/* ══ DataTable — rows of data under columns that sort and resize, 100,000 of them if need be ══
   <DataTable rows={rows} columns={[{ id: 'name', header: 'Name', flex: 2 }, { id: 'size', header: 'Size', align: 'end' }]} />

   Rows are plain objects with an `id`. A column says how wide it is (`width`, or a `flex` share with a `minWidth`), what
   its cells show (`cell`, else the row's field of the same name) and what it sorts by (`sortValue`, else that field),
   as a TanStack `ColumnDef` would. Only the rows in view are rendered, so a table of a hundred thousand rows scrolls
   like one of ten. While `loading` and still without rows it shows placeholder rows, not "No rows".

   It has a size class of its own (not the viewport's, so a side panel gets it too): compact, under 480 px, the rows
   stack (the first column's cell over the others', or `renderStackedRow`) and sorting moves into a menu; below 760 px
   the columns with `hideBelow: 'regular'` go.

   It's the data-table primitive (lib/data-table-primitive), built from UI SDK's virtualizer, grid focus and resize: an
   APG grid with one tab stop. ← → move between a row's cells and ↑ ↓ Page Up/Down to the same cell of another row, Home
   and End to the row's ends (with Ctrl or ⌘ to the first and last rows), Enter or Space presses the row, and Tab goes
   through the cell's own controls and on out; ↑ from the first row reaches the headers, where ← → move, Enter sorts and
   ⌥← ⌥→ resize. `focus="row"` keeps focus on whole rows instead (← → then scroll sideways); stacked rows always do.
   Presets build on it: RequestTable (a waterfall and the current time) and the SQL console's results. */

export const dataTableVariants = cva(
  // The hairline is drawn over the content, so the header's fill and a row's tint don't hide it.
  "group/table relative flex h-full w-full min-h-0 min-w-0 flex-col overflow-hidden rounded-panel bg-card text-card-foreground after:pointer-events-none after:absolute after:inset-0 after:z-3 after:rounded-[inherit] after:shadow-hairline after:content-['']",
  {
    variants: {
      /** Row height: `compact` (26 px) packs the most in, `default` (30 px) reads like a document, `comfortable` (34 px)
       *  suits touch. Stacked rows are 20 px taller. */
      density: { compact: 'text-caption', default: 'text-footnote', comfortable: 'text-footnote' },
    },
    defaultVariants: { density: 'default' },
  },
);

export type DataTableDensity = NonNullable<VariantProps<typeof dataTableVariants>['density']>;

const ROW_HEIGHT: Record<DataTableDensity, { table: number; stacked: number }> = {
  compact: { table: 26, stacked: 46 },
  default: { table: 30, stacked: 50 },
  comfortable: { table: 34, stacked: 54 },
};
const HEADER_HEIGHT: Record<DataTableDensity, number> = { compact: 28, default: 30, comfortable: 32 };

export interface DataTableColumn<T extends DataTableRow = DataTableRow> extends DataTableColumnSize {
  /** The header's content. Default: `label`, else the id. */
  header?: ReactNode;
  /** The column in plain words: what the stacked layout's sort menu calls it, and screen readers when `header` isn't a
   *  string. */
  label?: string;
  /** `end` lines the header and cells up at the end, in tabular figures: numbers, sizes, durations. */
  align?: 'start' | 'end';
  /** Pressing the header sorts by this column. Default true, unless the column has a `cell` and no `sortValue`. */
  sortable?: boolean;
  /** What it sorts by. Default: the row's field of the column's id. */
  sortValue?: (row: T) => DataTableSortValue;
  /** A cell's content. Default: the row's field of the column's id, as text. Must be stable: a row only renders again
   *  when its row object or the columns change. */
  cell?: (row: T) => ReactNode;
  /** The cells' classes, after the table's own: `text-muted-foreground`, `font-mono`. */
  className?: string;
  /** Shown at the header's end, after its sort arrow: a unit, a total. */
  headerEnd?: ReactNode;
}

export interface DataTableOverlayState<T extends DataTableRow = DataTableRow> {
  /** The columns shown, in order. */
  columns: readonly DataTableColumn<T>[];
  /** Whether the rows are stacked. */
  stacked: boolean;
}

/** `data-*` attributes for a row: a value of `undefined` or `false` leaves it out. */
export type DataTableRowAttributes = Readonly<Record<`data-${string}`, string | boolean | undefined>>;

interface Column<T extends DataTableRow> extends DataTableColumn<T> {
  sortable: boolean;
}

type DataTableHandle = PrimitiveHandle<typeof dataTable>;

const parts = createParts(dataTable, {
  grid: 'div', head: 'div', header: 'div', column: 'div', resizer: 'div', heading: 'span', rows: 'div', cell: 'div',
  overlay: 'div', empty: 'div', footer: 'div', toolbar: 'div',
});

/** The cell parts, for presets that draw a row of their own (`renderStackedRow`) and need a cell to put it in. */
export const DataTableCell = parts.Cell;

const HandleContext = createContext<DataTableHandle | null>(null);

function useDataTable(): DataTableHandle {
  const handle = useContext(HandleContext);
  if (!handle) throw new Error('DataTable parts must be inside a DataTable');
  return handle;
}

const ROW_CLASS = `group/row absolute inset-x-0 top-0 h-(--data-table-row) cursor-default ${dataRowLayers} has-[>[data-slot=data-table-cell]:focus-visible]:before:bg-foreground/4 data-future:*:opacity-45`;
const TABLE_ROW_CLASS = `${ROW_CLASS} grid grid-cols-(--data-table-cols) items-center`;
const STACKED_ROW_CLASS = `${ROW_CLASS} flex items-center gap-2 px-2`;

// With cell focus, the focused cell has the ring and its row the hover wash.
const CELL_CLASS = 'min-w-0 truncate px-2 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset';
const CELL_END_CLASS = `${CELL_CLASS} text-end tabular-nums`;

/** A column's words, for the sort menu and screen readers. */
function dataTableColumnName(column: Pick<DataTableColumn<never>, 'id' | 'label' | 'header'>): string {
  return column.label ?? (typeof column.header === 'string' ? column.header : column.id);
}

function fieldText(row: DataTableRow, id: string): ReactNode {
  const value = (row as unknown as Record<string, unknown>)[id];
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

function cellContent<T extends DataTableRow>(column: Column<T>, row: T): ReactNode {
  return column.cell ? column.cell(row) : fieldText(row, column.id);
}

/** The stacked row the table draws without `renderStackedRow`: the first column's cell, over the others' in a line. */
function DefaultStackedRow<T extends DataTableRow>({ row, columns }: { row: T; columns: readonly Column<T>[] }) {
  const [first, ...rest] = columns;
  return (
    <parts.Cell col={0} className="flex min-w-0 flex-1 flex-col gap-1">
      {first ? <span className="min-w-0 truncate leading-[18px] font-medium">{cellContent(first, row)}</span> : null}
      {rest.length ? (
        <span className="flex h-[18px] min-w-0 items-center gap-2 overflow-hidden text-caption2 whitespace-nowrap text-muted-foreground">
          {rest.map((column) => <span key={column.id} className={cn('min-w-0 truncate', column.align === 'end' && 'tabular-nums')}>{cellContent(column, row)}</span>)}
        </span>
      ) : null}
    </parts.Cell>
  );
}

interface RowViewProps<T extends DataTableRow> {
  row: T;
  index: number;
  start: number;
  stacked: boolean;
  columns: readonly Column<T>[];
  time: number | null;
  rowProps: ((row: T) => DataTableRowAttributes) | undefined;
  renderStackedRow: ((row: T) => ReactNode) | undefined;
}

function attrs(attributes: DataTableRowAttributes | undefined): object {
  if (!attributes) return {};
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(attributes)) if (value !== undefined && value !== false) out[name] = value === true ? '' : value;
  return out;
}

function RowViewInner<T extends DataTableRow>({ row, index, start, stacked, columns, time, rowProps, renderStackedRow }: RowViewProps<T>) {
  return usePart(dataTable, 'row', { id: String(index), index, value: row.id, time }, {
    ...attrs(rowProps?.(row)),
    className: stacked ? STACKED_ROW_CLASS : TABLE_ROW_CLASS,
    style: { transform: `translateY(${start}px)` },
    children: stacked
      ? (renderStackedRow ? renderStackedRow(row) : <DefaultStackedRow<T> row={row} columns={columns} />)
      : columns.map((column, at) => (
        <parts.Cell key={column.id} col={at + 1} row={index} data-column={column.id} className={cn(column.align === 'end' ? CELL_END_CLASS : CELL_CLASS, column.className)}>
          {cellContent(column, row)}
        </parts.Cell>
      )),
  }, 'div');
}

const RowView = memo(RowViewInner) as typeof RowViewInner;

function ColumnHeader<T extends DataTableRow>({ column, index, sort, nameId }: { column: Column<T>; index: number; sort: DataTableSort | null; nameId: string }) {
  const sorted = sort?.column === column.id ? sort.direction : null;
  // A header that isn't plain text is named by its `label`, when it has one; else by what it shows.
  const label = column.header != null && typeof column.header !== 'string' ? column.label : undefined;
  return (
    <parts.Column
      value={column.id}
      index={index}
      sortable={column.sortable}
      // Named by its header alone: the resize handle and the header's end are controls and extras, not its name.
      aria-labelledby={label ? undefined : nameId}
      aria-label={label}
      className={cn(
        tableHeaderCellClass,
        'group/column relative flex h-(--data-table-header) min-w-0 items-center gap-1 px-2',
        column.sortable && 'cursor-default hover:text-foreground',
        column.align === 'end' && 'justify-end',
      )}
    >
      <span id={nameId} className="min-w-0 truncate">{column.header ?? column.label ?? column.id}</span>
      {sorted ? <Icon name={sorted === 'ascending' ? 'arrow-up' : 'arrow-down'} size={10} sw={2.6} className="shrink-0 text-foreground" /> : null}
      {column.headerEnd != null ? <span data-slot="data-table-header-end" className="ms-auto shrink-0 font-normal tabular-nums">{column.headerEnd}</span> : null}
      {/* A column's edge, which a drag, the arrow keys or a double press resizes. */}
      <parts.Resizer value={column.id} aria-label={`Resize ${dataTableColumnName(column as never)}`} className={columnResizerClass} />
    </parts.Column>
  );
}

/** The sort menu's item for no sort. A column can't have this id, or not by accident. */
const ORIGINAL_ORDER = '$original-order';

function SortMenu<T extends DataTableRow>({ columns, allColumns, sort }: { columns: readonly Column<T>[]; allColumns: readonly Column<T>[]; sort: DataTableSort | null }) {
  const { api } = useDataTable();
  const sortable = columns.filter((column) => column.sortable);
  if (!sortable.length) return null;
  const sortedColumn = sort ? allColumns.find((column) => column.id === sort.column) : undefined;
  const arrow = sort ? <Icon name={sort.direction === 'ascending' ? 'arrow-up' : 'arrow-down'} size={12} sw={2.4} /> : null;
  return (
    <parts.Heading className="flex items-center">
      <DropdownMenu onAction={(id, { event }) => { api.internal.sortBy(id === ORIGINAL_ORDER ? null : id, { reason: 'item-press', event }); }}>
        <DropdownMenuTrigger
          aria-label="Sort by"
          render={<Button variant="quiet" size="sm" className="h-6 gap-1 rounded-md px-1.5 text-caption font-medium text-foreground/70" />}
        >
          <span>{sortedColumn ? dataTableColumnName(sortedColumn as never) : 'Sort'}</span>
          {sort ? <Icon name={sort.direction === 'ascending' ? 'arrow-up' : 'arrow-down'} size={10} sw={2.6} /> : <Icon name="chevron-up-down" size={12} sw={2} />}
        </DropdownMenuTrigger>
        <DropdownMenuContent aria-label="Sort by" side="bottom" align="end">
          <DropdownMenuItem value={ORIGINAL_ORDER}>Original order</DropdownMenuItem>
          {sortable.map((column) => (
            <DropdownMenuItem key={column.id} value={column.id} icon={sort?.column === column.id ? arrow : undefined}>{dataTableColumnName(column as never)}</DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </parts.Heading>
  );
}

export interface DataTableProps<T extends DataTableRow = DataTableRow>
  extends Omit<PartProps<'div'>, 'children' | 'defaultValue'>, VariantProps<typeof dataTableVariants> {
  rows: readonly T[];
  /** The columns, in order. */
  columns: readonly DataTableColumn<T>[];
  /** `single` (default): a press selects the row (`value`). `none`: rows press (`onAction`) but never stay selected. */
  mode?: 'single' | 'none';
  /** `cell` (default): the arrow keys move between cells, so one value can be reached and read on its own. `row`: focus
   *  stays on whole rows, and ← → scroll sideways. Stacked rows are always `row`. */
  focus?: 'cell' | 'row';
  /** The rows aren't here yet: while there are none, placeholder rows show instead of the empty state; the grid is
   *  `aria-busy` while it's true. */
  loading?: boolean;
  /** The selected row's id, controlled; `null` for none. A new value that's out of view is scrolled to. */
  value?: RowId | null;
  defaultValue?: RowId | null;
  onValueChange?: (value: RowId | null, details: ChangeDetails<DataTableValueChangeReason>) => void;
  /** A press on a row (or Enter or Space on it), with the row in `details.row`. Not called for presses on a control in it. */
  onAction?: (value: RowId, details: DataTableActionDetails<T>) => void;
  /** The sort, controlled; `null` for the rows' own order. */
  sort?: DataTableSort | null;
  defaultSort?: DataTableSort | null;
  onSortChange?: (sort: DataTableSort | null, details: ChangeDetails<DataTableSortChangeReason>) => void;
  /** Widths set so far by column id, controlled. A column with none keeps its own size. */
  columnWidths?: Readonly<Record<string, number>>;
  defaultColumnWidths?: Readonly<Record<string, number>>;
  onColumnWidthsChange?: (widths: Readonly<Record<string, number>>, details: ChangeDetails<DataTableColumnWidthsChangeReason>) => void;
  /** `auto` (default) stacks the rows while the table is compact. `table` and `stacked` stay as they are. */
  layout?: 'auto' | 'table' | 'stacked';
  /** Where the table's own size classes start, in px: `medium` (default 480) ends the stacked rows, `regular` (default
   *  760) shows the columns with `hideBelow: 'regular'`. */
  breakpoints?: DataTableBreakpoints;
  /** A stacked row's content, in a `DataTableCell` with `col={0}`. Default: the first column's cell over the others'. */
  renderStackedRow?: (row: T) => ReactNode;
  /** What the stacked layout's header says about the rows. Default "12 rows". */
  countLabel?: (count: number) => ReactNode;
  /** Where a recording is now, in ms on `timeRange` (as LogList's `currentTime`): rows whose `rowTime` is later are
   *  dimmed as the future (`data-future`), and the grid gets `data-current-time` and `--data-table-current-time` (its
   *  share of the range, 0…1) for an `overlay` to draw a line at. It changes no row's props, so it can move on every
   *  frame; the controller's `setCurrentTime` moves it with no render. */
  currentTime?: number | null;
  /** The range the current time moves on, in ms. */
  timeRange?: DataTableTimeRange;
  /** A row's time, for the current time. Must be stable. */
  rowTime?: (row: T) => number | null | undefined;
  /** Attributes for a row, from its data, for the cells' classes to read (`group-data-failed/row:text-destructive`).
   *  Must be stable. */
  rowProps?: (row: T) => DataTableRowAttributes;
  /** Drawn over the rows, sticky to the view and hidden from screen readers: the current time's line. */
  overlay?: (state: DataTableOverlayState<T>) => ReactNode;
  /** Shown when there are no rows: a string is the title of a small `EmptyState` (default "No rows"), `null` shows
   *  nothing, any other node is drawn as is (`renderEmptyState`). */
  emptyState?: ReactNode;
  /** Above the grid, outside the scroller: a summary, filters, actions. */
  toolbar?: ReactNode;
  /** After the last row, inside the scroller: "3 more later", a "Load more". */
  footer?: ReactNode;
  /** Scrolls, selects, sorts and moves the current time from outside: `createDataTableController()`. */
  controller?: DataTableController;
  'aria-label'?: string;
}

/** The columns as given, with `sortable` filled in. */
function useColumns<T extends DataTableRow>(columnsProp: readonly DataTableColumn<T>[]): readonly Column<T>[] {
  return useMemo(() => columnsProp.map((column) => ({ ...column, sortable: column.sortable ?? (!column.cell || !!column.sortValue) })), [columnsProp]);
}

interface BodyProps<T extends DataTableRow> {
  handle: DataTableHandle;
  allColumns: readonly Column<T>[];
  total: number;
  rowTime: ((row: T) => number | null | undefined) | undefined;
  rowProps: ((row: T) => DataTableRowAttributes) | undefined;
  renderStackedRow: ((row: T) => ReactNode) | undefined;
  countLabel: (count: number) => ReactNode;
  overlay: ((state: DataTableOverlayState<T>) => ReactNode) | undefined;
  emptyState: ReactNode;
  loading: boolean;
  toolbar: ReactNode;
  footer: ReactNode;
  density: DataTableDensity;
  ariaLabel: string;
  rootProps: Omit<PartProps<'div'>, 'children'>;
}

/** The table, rendered from what the root's state says: the rows in order, the columns its size class shows, the sort
 *  and the layout. A moving current time never reaches it. */
function BodyInner<T extends DataTableRow>({ handle, total, density, toolbar, rootProps, ...rest }: BodyProps<T>) {
  const { className, ...props } = rootProps;
  return usePart(handle, 'root', {}, {
    ...({ 'data-rows': total, 'data-density': density } as object),
    ...props,
    className: cx(dataTableVariants({ density }), className),
    children: ({ sort, rows, columns, stacked }) => (
      <HandleContext.Provider value={handle}>
        {toolbar != null ? (
          <parts.Toolbar className="relative z-1 flex min-h-9 shrink-0 items-center gap-2 px-3 py-1 shadow-hairline-b">{toolbar}</parts.Toolbar>
        ) : null}
        <Table<T>
          handle={handle}
          rows={rows as readonly T[]}
          columns={columns as readonly Column<T>[]}
          sort={sort}
          stacked={stacked}
          {...rest}
        />
      </HandleContext.Provider>
    ),
  }, 'div');
}

interface TableProps<T extends DataTableRow> extends Omit<BodyProps<T>, 'density' | 'rootProps' | 'total' | 'toolbar'> {
  rows: readonly T[];
  columns: readonly Column<T>[];
  sort: DataTableSort | null;
  stacked: boolean;
}

function TableInner<T extends DataTableRow>({
  handle, allColumns, rows, columns, sort, stacked, rowTime, rowProps, renderStackedRow, countLabel, overlay, emptyState, loading, footer, ariaLabel,
}: TableProps<T>) {
  const { virtual } = handle.api.internal.rows;
  const nameBase = useId();
  const items = useSyncExternalStore<readonly VirtualItem[]>(virtual.subscribe, virtual.items, virtual.items);

  const header = useMemo(() => (stacked ? (
    <parts.Header className={cn(tableHeaderCellClass, 'flex h-(--data-table-header) items-center justify-between gap-2 bg-secondary ps-2 pe-1 font-normal shadow-hairline-b')}>
      <parts.Heading className="tabular-nums">{loading && !rows.length ? 'Loading…' : countLabel(rows.length)}</parts.Heading>
      <SortMenu<T> columns={columns} allColumns={allColumns} sort={sort} />
    </parts.Header>
  ) : (
    <parts.Header className="grid h-(--data-table-header) grid-cols-(--data-table-cols) bg-secondary shadow-hairline-b">
      {columns.map((column, i) => <ColumnHeader<T> key={column.id} column={column} index={i} sort={sort} nameId={`${nameBase}-h${i}`} />)}
    </parts.Header>
  )), [stacked, columns, allColumns, sort, rows.length, countLabel, nameBase, loading]);

  const rowEls: ReactElement[] = [];
  for (const item of items) {
    const row = rows[item.index];
    if (!row) continue;
    rowEls.push(
      <RowView<T>
        key={item.index}
        row={row}
        index={item.index}
        start={item.start}
        stacked={stacked}
        columns={columns}
        time={rowTime?.(row) ?? null}
        rowProps={rowProps}
        renderStackedRow={renderStackedRow}
      />,
    );
  }

  const drawn = overlay?.({ columns, stacked });
  return (
    <parts.Grid
      aria-label={ariaLabel}
      aria-busy={loading || undefined}
      aria-colcount={stacked ? undefined : columns.length}
      className="group/grid bl-scroll relative min-h-0 flex-1 overflow-auto overscroll-contain outline-none [overflow-anchor:none]"
    >
      <div className={cn('min-h-full w-full', !stacked && 'min-w-(--data-table-min-width)')}>
        {drawn != null ? <parts.Overlay className="pointer-events-none sticky top-0 z-3 h-0">{drawn}</parts.Overlay> : null}
        <parts.Head className="sticky top-0 z-2 bg-card">{header}</parts.Head>
        <parts.Rows className="relative w-full">{rowEls}</parts.Rows>
        {loading && !rows.length
          ? <LoadingRows ends={columns.map((column) => column.align === 'end')} stacked={stacked} />
          : <parts.Empty>{renderEmptyState(emptyState, { title: 'No rows' })}</parts.Empty>}
        {footer != null ? <parts.Footer className="px-3 py-2 text-center text-caption text-muted-foreground">{footer}</parts.Footer> : null}
      </div>
    </parts.Grid>
  );
}

/** How wide each placeholder's bar is, by row and column: uneven, like text. */
const PLACEHOLDER_WIDTHS = ['72%', '48%', '60%', '36%', '54%', '66%', '42%'];
const PLACEHOLDER_ROWS = 6;

/** Rows to come, at the rows' own height and the columns' widths. Hidden from screen readers: the grid is `aria-busy`. */
function LoadingRows({ ends, stacked }: { ends: readonly boolean[]; stacked: boolean }) {
  return (
    <div data-slot="data-table-loading" aria-hidden="true">
      {Array.from({ length: PLACEHOLDER_ROWS }, (_, row) => (
        <div
          key={row}
          className={cn(
            "relative h-(--data-table-row) after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-border/60 after:content-['']",
            stacked ? 'flex flex-col justify-center gap-2 px-2' : 'grid grid-cols-(--data-table-cols) items-center',
          )}
        >
          {stacked ? (
            <>
              <Skeleton shape="text" className="h-2.5" style={{ width: PLACEHOLDER_WIDTHS[row % PLACEHOLDER_WIDTHS.length] }} />
              <Skeleton shape="text" className="h-2" style={{ width: PLACEHOLDER_WIDTHS[(row + 3) % PLACEHOLDER_WIDTHS.length] }} />
            </>
          ) : (ends.length ? ends : [false]).map((end, col) => (
            <div key={col} className={cn('flex min-w-0 px-2', end && 'justify-end')}>
              <Skeleton shape="text" className="h-2.5" style={{ width: PLACEHOLDER_WIDTHS[(row + col * 2) % PLACEHOLDER_WIDTHS.length] }} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

const Table = memo(TableInner) as typeof TableInner;
const Body = memo(BodyInner) as typeof BodyInner;

const defaultCountLabel = (count: number) => `${count.toLocaleString('en-US')} ${count === 1 ? 'row' : 'rows'}`;

export function DataTable<T extends DataTableRow = DataTableRow>({
  rows, columns: columnsProp, mode, focus, loading = false, value, defaultValue, onValueChange, onAction, sort, defaultSort, onSortChange,
  columnWidths, defaultColumnWidths, onColumnWidthsChange, layout = 'auto', breakpoints, renderStackedRow,
  countLabel = defaultCountLabel, currentTime = null, timeRange, rowTime, rowProps, overlay, emptyState, toolbar, footer, controller,
  density, 'aria-label': ariaLabel = 'Rows', ...rootProps
}: DataTableProps<T>) {
  const allColumns = useColumns(columnsProp);
  const d = density ?? 'default';
  const from = timeRange?.[0];
  const to = timeRange?.[1];
  const range = useMemo<DataTableTimeRange | null>(() => (from !== undefined && to !== undefined ? [from, to] : null), [from, to]);
  // As on LogList, this is why a moving current time costs no rows: its prop stops here, as an option the primitive
  // writes to the page.
  const options: DataTableOptions<T> = {
    rows, columns: allColumns, mode, focus, currentTime, timeRange: range, value, defaultValue, onValueChange, onAction, sort,
    defaultSort, onSortChange, columnWidths, defaultColumnWidths, onColumnWidthsChange, breakpoints, layout, controller,
    rowHeights: ROW_HEIGHT[d], headerHeight: HEADER_HEIGHT[d],
  };
  const handle = usePrimitive(dataTable, options as unknown as DataTableOptions);
  return (
    <Body<T>
      handle={handle}
      allColumns={allColumns}
      total={rows.length}
      rowTime={rowTime}
      rowProps={rowProps}
      renderStackedRow={renderStackedRow}
      countLabel={countLabel}
      overlay={overlay}
      emptyState={emptyState}
      loading={loading}
      toolbar={toolbar}
      footer={footer}
      density={d}
      ariaLabel={ariaLabel}
      rootProps={rootProps}
    />
  );
}

export {
  createDataTableController, type DataTableActionDetails, type DataTableBreakpoints, type DataTableColumnWidthsChangeReason,
  type DataTableController, type DataTableRow, type DataTableSortChangeReason, type DataTableValueChangeReason,
} from '@/lib/data-table-primitive';
export {
  type DataTableColumnSize, type DataTableSort, type DataTableSortDirection, type DataTableSortValue, type DataTableTimeRange,
} from '@/lib/data-table-model';

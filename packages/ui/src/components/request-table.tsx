'use client';
import {
  createContext, memo, useContext, useMemo, useSyncExternalStore,
  type ComponentProps, type CSSProperties, type ReactElement, type ReactNode,
} from 'react';
import type { ChangeDetails, VirtualItem } from '@ui-sdk/core';
import { Button as SdkButton } from '@ui-sdk/react/button';
import { createParts, usePart, usePrimitive, type PartProps, type PrimitiveHandle } from '@ui-sdk/react/primitive';
import { cva, type VariantProps } from 'class-variance-authority';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Icon } from '@/lib/icon';
import type { RowId } from '@/lib/log-list-model';
import {
  isRequestFailed, requestBar, requestDisplayName, requestDurationText, requestSizeText, requestStatusText,
  requestTimeRange, requestTone,
  type RequestColumnSize, type RequestRow, type RequestSort, type RequestSortValue, type RequestTimeRange,
} from '@/lib/request-table-model';
import {
  requestTable, type RequestTableActionDetails, type RequestTableBreakpoints, type RequestTableColumnWidthsChangeReason,
  type RequestTableController, type RequestTableOptions, type RequestTableSortChangeReason, type RequestTableValueChangeReason,
} from '@/lib/request-table-primitive';
import { formatDuration } from '@/lib/sql-format';
import { cn, cx } from '@/lib/utils';

/* ══ RequestTable — a network pane: 10,000 requests, a waterfall and a playhead ══
   <RequestTable rows={rows} playhead={t} value={id} onAction={(id, { row }) => seek(row.time)} />

   Rows are plain data. Columns are configurable, resizable by dragging an edge and sort when pressed. The waterfall's bars
   share one time range, and the optional playhead is a line across it with the rows after it dimmed: it writes one
   element's position and a few attributes and renders nothing, so it can follow a playhead on every frame. `renderLink`
   gives each row a place for links to the other end of the call, which `RequestLink` draws.

   It has a size class of its own (not the viewport's, so a side panel gets it too). Compact, under 480 px, it becomes
   two-line rows: the name, then status, method and duration, with a small waterfall beside them and sorting in a menu.
   Under 760 px, regular, the columns with `hideBelow: 'regular'` (`type` and `size`) go.

   It's the request-table primitive (lib/request-table-primitive), built from UI SDK's virtualizer, grid focus and
   resize: a grid with one tab stop, where ↑ ↓ Home End and Page Up/Down move between rows, Enter or Space presses one,
   ← → scroll sideways, and Tab goes through the row's links and on out; ↑ from the first row reaches the headers, where
   ← → move, Enter sorts and ⌥← ⌥→ resize. */

export const requestTableVariants = cva(
  // The hairline is drawn over the content, so the header's fill and a row's tint don't hide it.
  "group/table relative flex h-full w-full min-h-0 min-w-0 flex-col overflow-hidden rounded-panel bg-card text-card-foreground after:pointer-events-none after:absolute after:inset-0 after:z-3 after:rounded-[inherit] after:shadow-hairline after:content-['']",
  {
    variants: {
      /** Row height: `compact` (default, 26 px) packs the most in; `comfortable` (34 px) suits touch. */
      density: { compact: '', comfortable: '' },
    },
    defaultVariants: { density: 'compact' },
  },
);

const ROW_HEIGHT = {
  compact: { table: 26, stacked: 46 },
  comfortable: { table: 34, stacked: 54 },
} as const;
const HEADER_HEIGHT = 28;

export type RequestColumnId = 'name' | 'url' | 'method' | 'status' | 'type' | 'size' | 'duration' | 'waterfall';

export interface RequestColumn<T extends RequestRow = RequestRow> extends RequestColumnSize {
  /** The header's text. */
  title?: ReactNode;
  align?: 'start' | 'end';
  /** Pressing the header sorts by this column (default true, if there's something to sort by). */
  sortable?: boolean;
  /** What it sorts by. Built-in columns have one; for others the default is the row's field of the same name. */
  sortValue?: (row: T) => RequestSortValue;
  /** The cell. Must be stable, as the row is only re-rendered when its props change. */
  render?: (row: T) => ReactNode;
  /** The column in plain words: what the sort menu of two-line rows calls it, and screen readers when `title` isn't a string. */
  label?: string;
}

/** The built-in columns. `type` and `size` go first when the table is narrow: below its regular size class. */
export const REQUEST_COLUMNS: Record<RequestColumnId, RequestColumn> = {
  name: { id: 'name', title: 'Name', flex: 3, minWidth: 160 },
  url: { id: 'url', title: 'URL', flex: 3, minWidth: 200 },
  method: { id: 'method', title: 'Method', width: 66, minWidth: 48 },
  status: { id: 'status', title: 'Status', width: 76, minWidth: 48 },
  type: { id: 'type', title: 'Type', width: 72, minWidth: 48, hideBelow: 'regular' },
  size: { id: 'size', title: 'Size', width: 72, minWidth: 48, align: 'end', hideBelow: 'regular' },
  duration: { id: 'duration', title: 'Time', width: 72, minWidth: 48, align: 'end' },
  waterfall: { id: 'waterfall', title: 'Waterfall', label: 'Start time', flex: 2, minWidth: 120 },
};

const DEFAULT_COLUMNS: readonly RequestColumnId[] = ['name', 'method', 'status', 'type', 'size', 'duration', 'waterfall'];

const BAR_CLASS = [
  'absolute top-1/2 left-(--bar-left) h-2 w-(--bar-width) min-w-0.5 -translate-y-1/2 rounded-xs bg-primary',
  'data-[tone=accent]:bg-chart-5 data-[tone=danger]:bg-destructive data-[tone=neutral]:bg-muted-foreground/60 data-[tone=success]:bg-success data-[tone=warning]:bg-warning',
  'data-pending:opacity-50',
].join(' ');

const ROW_LAYERS = [
  'group/row absolute inset-x-0 top-0 isolate h-(--request-row) cursor-default text-caption outline-none',
  "before:absolute before:inset-0 before:-z-1 before:content-[''] hover:before:bg-foreground/4 active:before:bg-foreground/8",
  "after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-border/60 after:content-['']",
  'data-selected:before:bg-primary/16',
  'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
].join(' ');
const ROW_CLASS = `${ROW_LAYERS} grid grid-cols-(--request-cols) items-center data-future:*:opacity-45`;
const STACKED_ROW_CLASS = `${ROW_LAYERS} flex items-center gap-2 px-2 data-future:*:opacity-45`;

const CELL_CLASS = 'min-w-0 truncate px-2';
const CELL_END_CLASS = `${CELL_CLASS} text-end tabular-nums`;
const NAME_CLASS = 'min-w-0 truncate font-mono group-data-failed/row:text-destructive';
const STATUS_CLASS = 'tabular-nums group-data-failed/row:text-destructive group-data-pending/row:text-muted-foreground';
const STATUS_CELL_CLASS = `${CELL_CLASS} ${STATUS_CLASS}`;
const MUTED_CLASS = 'text-muted-foreground';
const METHOD_CLASS = `${CELL_CLASS} ${MUTED_CLASS}`;
const SIZE_CLASS = `${CELL_END_CLASS} ${MUTED_CLASS}`;
const WATERFALL_CELL_CLASS = 'relative mx-2 h-full min-w-0';
// Beside both lines rather than in the second, so the one playhead line goes through every row without crossing a name or a link.
const STACKED_WATERFALL_CLASS = 'relative h-3 w-24 shrink-0 rounded-sm bg-secondary';

export type RequestLinkProps = ComponentProps<typeof SdkButton> & {
  /** An Icon name after the text. Default `arrow-right`; null for none. */
  icon?: 'arrow-right' | 'arrow-up-right' | null;
};

/** A link to the other end of a call, for `renderLink`: UI SDK's Button, small enough for a row, and a press on it
 *  doesn't press the row. */
export function RequestLink({ icon = 'arrow-right', className, children, ...props }: RequestLinkProps) {
  return (
    <SdkButton
      data-slot="request-table-link"
      className={cx(
        'inline-flex h-[18px] max-w-40 shrink-0 cursor-pointer items-center gap-0.5 rounded-md border-0 bg-primary/10 px-1.5 [font-family:inherit] text-caption2 font-medium whitespace-nowrap text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring hover:bg-primary/16 active:bg-primary/24',
        className,
      )}
      {...props}
    >
      {(state) => (
        <>
          <span className="min-w-0 truncate">{typeof children === 'function' ? children(state) : children}</span>
          {icon ? <Icon name={icon} size={10} sw={2.4} /> : null}
        </>
      )}
    </SdkButton>
  );
}

interface Column<T extends RequestRow> extends RequestColumn<T> {
  sortable: boolean;
}

type RequestTableHandle = PrimitiveHandle<typeof requestTable>;

const parts = createParts(requestTable, {
  grid: 'div', head: 'div', header: 'div', column: 'div', resizer: 'div', heading: 'span', rows: 'div', cell: 'div', waterfall: 'div',
  playhead: 'div', empty: 'div', footer: 'div',
});

const HandleContext = createContext<RequestTableHandle | null>(null);

function useRequestTable(): RequestTableHandle {
  const handle = useContext(HandleContext);
  if (!handle) throw new Error('RequestTable parts must be inside a RequestTable');
  return handle;
}

function Waterfall({ row, range, className, col }: { row: RequestRow; range: RequestTimeRange; className: string; col: number }) {
  const bar = requestBar(row, range);
  return (
    <parts.Waterfall col={col} data-column={col ? 'waterfall' : undefined} className={className}>
      {bar ? (
        <div
          data-slot="request-table-bar"
          data-tone={requestTone(row)}
          data-pending={row.pending || undefined}
          className={BAR_CLASS}
          style={{ '--bar-left': `${bar.left}%`, '--bar-width': `${bar.width}%` } as CSSProperties}
        />
      ) : null}
    </parts.Waterfall>
  );
}

const nameTitle = (row: RequestRow) => (row.error ? `${row.url}\n${row.error}` : row.url);

function links(content: ReactNode) {
  if (content === null || content === undefined || content === false) return null;
  return <span data-slot="request-table-links" data-no-row-press="" className="ms-auto flex shrink-0 items-center gap-1">{content}</span>;
}

function cellFor<T extends RequestRow>(column: Column<T>, at: number, row: T, range: RequestTimeRange, renderLink: ((row: T) => ReactNode) | undefined) {
  const col = at + 1;
  const text = column.align === 'end' ? CELL_END_CLASS : CELL_CLASS;
  const cell = (className: string, content: ReactNode) => (
    <parts.Cell key={column.id} col={col} data-column={column.id} className={className}>{content}</parts.Cell>
  );
  if (column.render) return cell(text, column.render(row));
  switch (column.id) {
    case 'name':
    case 'url':
      return cell('flex min-w-0 items-center gap-1.5 px-2', (
        <>
          <span data-slot="request-table-name" title={nameTitle(row)} className={NAME_CLASS}>
            {column.id === 'url' ? row.url : requestDisplayName(row)}
          </span>
          {links(renderLink?.(row))}
        </>
      ));
    case 'method': return cell(METHOD_CLASS, row.method);
    case 'status': return cell(STATUS_CELL_CLASS, requestStatusText(row));
    case 'type': return cell(METHOD_CLASS, row.type);
    case 'size': return cell(SIZE_CLASS, requestSizeText(row));
    case 'duration': return cell(CELL_END_CLASS, requestDurationText(row));
    case 'waterfall': return <Waterfall key={column.id} row={row} range={range} className={WATERFALL_CELL_CLASS} col={col} />;
    default: return cell(text, String((row as unknown as Record<string, unknown>)[column.id] ?? ''));
  }
}

interface RowViewProps<T extends RequestRow> {
  row: T;
  index: number;
  start: number;
  stacked: boolean;
  columns: readonly Column<T>[];
  range: RequestTimeRange;
  renderLink: ((row: T) => ReactNode) | undefined;
}

function RowViewInner<T extends RequestRow>({ row, index, start, stacked, columns, range, renderLink }: RowViewProps<T>) {
  const has = (id: string) => columns.some((column) => column.id === id);
  return usePart(requestTable, 'row', { id: String(index), index, value: row.id, time: row.time ?? null }, {
    ...({ 'data-failed': isRequestFailed(row) || undefined, 'data-pending': row.pending || undefined } as object),
    className: stacked ? STACKED_ROW_CLASS : ROW_CLASS,
    style: { transform: `translateY(${start}px)` },
    children: stacked ? (
      <>
        <parts.Cell col={0} className="flex min-w-0 flex-1 flex-col gap-1">
          <span data-slot="request-table-name" title={nameTitle(row)} className={`${NAME_CLASS} leading-[18px]`}>{requestDisplayName(row)}</span>
          <div className="flex h-[18px] min-w-0 items-center gap-2 text-caption2 whitespace-nowrap">
            {has('status') ? <span className={STATUS_CLASS}>{requestStatusText(row)}</span> : null}
            {has('method') ? <span className={MUTED_CLASS}>{row.method}</span> : null}
            {has('duration') ? <span className="tabular-nums">{requestDurationText(row)}</span> : null}
            {links(renderLink?.(row))}
          </div>
        </parts.Cell>
        {has('waterfall') ? <Waterfall row={row} range={range} className={STACKED_WATERFALL_CLASS} col={0} /> : null}
      </>
    ) : columns.map((column, at) => cellFor(column, at, row, range, renderLink)),
  }, 'div');
}

const RowView = memo(RowViewInner) as typeof RowViewInner;

/** A column's words, for the sort menu and screen readers. */
function columnName(column: RequestColumn<never>): string {
  return column.label ?? (typeof column.title === 'string' ? column.title : column.id);
}

function ColumnHeader<T extends RequestRow>({ column, index, sort, span }: { column: Column<T>; index: number; sort: RequestSort | null; span: number }) {
  const sorted = sort?.column === column.id ? sort.direction : null;
  return (
    <parts.Column
      value={column.id}
      index={index}
      sortable={column.sortable}
      className={cn(
        'group/column relative flex h-(--request-header) min-w-0 items-center gap-1 px-2 text-caption font-semibold whitespace-nowrap text-foreground/65 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
        column.sortable && 'hover:text-foreground',
        column.align === 'end' && 'justify-end',
      )}
    >
      <span className="min-w-0 truncate">{column.title ?? column.label ?? column.id}</span>
      {sorted ? <Icon name={sorted === 'ascending' ? 'arrow-up' : 'arrow-down'} size={10} sw={2.6} className="shrink-0 text-foreground" /> : null}
      {column.id === 'waterfall' && span > 0 ? <span data-slot="request-table-span" className="ms-auto shrink-0 font-normal tabular-nums">{formatDuration(span)}</span> : null}
      {/* A column's edge, which a drag, the arrow keys or a double press resizes. */}
      <parts.Resizer
        value={column.id}
        aria-label={`Resize ${columnName(column as never)}`}
        className="absolute inset-y-0 -end-1 z-1 w-2 cursor-col-resize touch-none after:absolute after:inset-y-1.5 after:start-[3.5px] after:w-px after:bg-border after:content-[''] hover:after:bg-primary data-dragging:after:bg-primary"
      />
    </parts.Column>
  );
}

/** The sort menu's item for no sort. A column can't have this id, or not by accident. */
const ORIGINAL_ORDER = '$original-order';

function SortMenu<T extends RequestRow>({ columns, allColumns, sort }: { columns: readonly Column<T>[]; allColumns: readonly Column<T>[]; sort: RequestSort | null }) {
  const { api } = useRequestTable();
  const sortable = columns.filter((column) => column.sortable);
  if (!sortable.length) return null;
  const sortedColumn = sort ? allColumns.find((column) => column.id === sort.column) : undefined;
  const arrow = sort ? <Icon name={sort.direction === 'ascending' ? 'arrow-up' : 'arrow-down'} size={12} sw={2.4} /> : null;
  return (
    <parts.Heading className="flex items-center">
      <DropdownMenu onAction={(id, { event }) => { api.internal.sortBy(id === ORIGINAL_ORDER ? null : id, { reason: 'item-press', event }); }}>
        <DropdownMenuTrigger
          aria-label="Sort by"
          render={<Button variant="quiet" size="sm" className="h-6 gap-1 rounded-md px-1.5 text-caption font-medium" />}
        >
          <span>{sortedColumn ? columnName(sortedColumn as never) : 'Sort'}</span>
          {sort ? <Icon name={sort.direction === 'ascending' ? 'arrow-up' : 'arrow-down'} size={10} sw={2.6} /> : <Icon name="chevron-up-down" size={12} sw={2} />}
        </DropdownMenuTrigger>
        <DropdownMenuContent aria-label="Sort by" side="bottom" align="end">
          <DropdownMenuItem value={ORIGINAL_ORDER}>Original order</DropdownMenuItem>
          {sortable.map((column) => (
            <DropdownMenuItem key={column.id} value={column.id} icon={sort?.column === column.id ? arrow : undefined}>{columnName(column as never)}</DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </parts.Heading>
  );
}

export interface RequestTableProps<T extends RequestRow = RequestRow>
  extends Omit<PartProps<'div'>, 'children' | 'defaultValue'>, VariantProps<typeof requestTableVariants> {
  rows: readonly T[];
  /** Which columns, in order: a built-in's id, or a column of your own (with a built-in's `id` to adjust that one). */
  columns?: readonly (RequestColumnId | RequestColumn<T>)[];
  /** The waterfall's range, in ms. Default: from the first request to the last answer. Give the recording's own range if
   *  rows come and go with a playhead, or every bar moves when they do. */
  timeRange?: RequestTimeRange;
  /** The playhead's time, in ms: a line on the waterfall, and the rows sent after it dimmed. */
  playhead?: number | null;
  /** The selected row's id, controlled; `null` for none. A new value that's out of view is scrolled to. */
  value?: RowId | null;
  defaultValue?: RowId | null;
  onValueChange?: (value: RowId | null, details: ChangeDetails<RequestTableValueChangeReason>) => void;
  /** A press on a row (or Enter or Space on it), with the row in `details.row`. Not called for presses on its links. */
  onAction?: (value: RowId, details: RequestTableActionDetails<T>) => void;
  /** Links to the other end of a call, usually `RequestLink`s, after the name (or the second line of a two-line row).
   *  Must be stable (`useCallback`). */
  renderLink?: (row: T) => ReactNode;
  /** The sort, controlled; `null` for the rows' own order. */
  sort?: RequestSort | null;
  defaultSort?: RequestSort | null;
  onSortChange?: (sort: RequestSort | null, details: ChangeDetails<RequestTableSortChangeReason>) => void;
  /** Widths set so far by column id, controlled. A column with none keeps its own size. */
  columnWidths?: Readonly<Record<string, number>>;
  defaultColumnWidths?: Readonly<Record<string, number>>;
  onColumnWidthsChange?: (widths: Readonly<Record<string, number>>, details: ChangeDetails<RequestTableColumnWidthsChangeReason>) => void;
  /** `auto` (default) goes to two-line rows while the table is compact. `table` and `stacked` stay as they are. */
  layout?: 'auto' | 'table' | 'stacked';
  /** Where the table's own size classes start, in px: `medium` (default 480) ends the two-line rows, `regular`
   *  (default 760) shows the columns with `hideBelow: 'regular'`. */
  breakpoints?: RequestTableBreakpoints;
  /** Shown when there are no rows. */
  emptyState?: ReactNode;
  /** Shown after the last row. */
  footer?: ReactNode;
  /** Scrolls, selects, sorts and moves the playhead from outside: `createRequestTableController()`. */
  controller?: RequestTableController;
  'aria-label'?: string;
}

/** The columns as given, each filled in from the built-in of the same id. */
function useColumns<T extends RequestRow>(columnsProp: readonly (RequestColumnId | RequestColumn<T>)[]): readonly Column<T>[] {
  // A list of ids is the same list whenever it says the same thing, so writing one inline doesn't re-render the rows.
  const key = columnsProp.every((column) => typeof column === 'string') ? columnsProp.join() : columnsProp;
  // `key` stands for `columnsProp`.
  return useMemo(() => columnsProp.map((column) => {
    const spec = typeof column === 'string' ? { id: column } : column;
    const builtIn = (REQUEST_COLUMNS as Record<string, RequestColumn | undefined>)[spec.id] as RequestColumn<T> | undefined;
    const merged = { ...builtIn, ...spec };
    return { ...merged, sortable: merged.sortable ?? (!merged.render || !!merged.sortValue) };
  }), [key]);
}

interface BodyProps<T extends RequestRow> {
  handle: RequestTableHandle;
  allColumns: readonly Column<T>[];
  /** How many rows were given. */
  total: number;
  range: RequestTimeRange;
  renderLink: ((row: T) => ReactNode) | undefined;
  emptyState: ReactNode;
  footer: ReactNode;
  density: RequestTableProps['density'];
  ariaLabel: string;
  /** The root's own props: `className`, `style` and the rest. */
  rootProps: Omit<PartProps<'div'>, 'children'>;
}

/** The table, rendered from what the root's state says: the rows in order, the columns its size class shows, the sort
 *  and the layout. A moving playhead never reaches it. */
function BodyInner<T extends RequestRow>({ handle, allColumns, total, range, renderLink, emptyState, footer, density, ariaLabel, rootProps }: BodyProps<T>) {
  const { className, ...props } = rootProps;
  return usePart(handle, 'root', {}, {
    ...({ 'data-rows': total } as object),
    ...props,
    className: cx(requestTableVariants({ density }), className),
    children: ({ sort, rows, columns, stacked }) => (
      <HandleContext.Provider value={handle}>
        <Table<T>
          handle={handle}
          allColumns={allColumns}
          rows={rows as readonly T[]}
          columns={columns as readonly Column<T>[]}
          sort={sort}
          stacked={stacked}
          range={range}
          renderLink={renderLink}
          emptyState={emptyState}
          footer={footer}
          ariaLabel={ariaLabel}
        />
      </HandleContext.Provider>
    ),
  }, 'div');
}

interface TableProps<T extends RequestRow> extends Omit<BodyProps<T>, 'density' | 'rootProps' | 'total'> {
  /** The rows in the order they show. */
  rows: readonly T[];
  /** The columns shown. */
  columns: readonly Column<T>[];
  sort: RequestSort | null;
  stacked: boolean;
}

function TableInner<T extends RequestRow>({
  handle, allColumns, rows, columns, sort, stacked, range, renderLink, emptyState, footer, ariaLabel,
}: TableProps<T>) {
  const { api } = handle;
  const { virtual } = api.internal.rows;
  const items = useSyncExternalStore<readonly VirtualItem[]>(virtual.subscribe, virtual.items, virtual.items);

  const span = rows.length ? range[1] - range[0] : 0;
  const waterfallAt = columns.findIndex((column) => column.id === 'waterfall');
  const header = useMemo(() => (stacked ? (
    <parts.Header className="flex h-(--request-header) items-center justify-between gap-2 bg-secondary ps-2 pe-1 text-caption text-foreground/65 shadow-hairline-b">
      <parts.Heading className="tabular-nums">{rows.length.toLocaleString('en-US')} {rows.length === 1 ? 'request' : 'requests'}</parts.Heading>
      <SortMenu<T> columns={columns} allColumns={allColumns} sort={sort} />
    </parts.Header>
  ) : (
    <parts.Header className="grid h-(--request-header) grid-cols-(--request-cols) bg-secondary shadow-hairline-b">
      {columns.map((column, i) => <ColumnHeader<T> key={column.id} column={column} index={i} sort={sort} span={span} />)}
    </parts.Header>
  )), [stacked, columns, allColumns, sort, span, rows.length]);

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
        range={range}
        renderLink={renderLink}
      />,
    );
  }

  return (
    <parts.Grid
      aria-label={ariaLabel}
      aria-colcount={stacked ? undefined : columns.length}
      className="group/grid bl-scroll relative min-h-0 flex-1 overflow-auto overscroll-contain outline-none [overflow-anchor:none]"
    >
      <div className={cn('min-h-full w-full', !stacked && 'min-w-(--request-min-width)')}>
        {waterfallAt >= 0 || (stacked && columns.some((column) => column.id === 'waterfall')) ? (
          <parts.Playhead className="pointer-events-none sticky top-0 z-3 hidden h-0 group-data-playhead/grid:block">
            <div className={cn('absolute inset-x-0', stacked ? 'top-(--request-header) flex h-[calc(var(--request-view)-var(--request-header))] justify-end pe-2' : 'top-0 grid h-(--request-view) grid-cols-(--request-cols)')}>
              <div className={stacked ? 'relative w-24' : 'relative mx-2'} style={stacked ? undefined : { gridColumnStart: waterfallAt + 1 }}>
                <div className="absolute inset-y-0 left-[calc(var(--request-playhead,0)*100%)] w-px bg-primary" />
              </div>
            </div>
          </parts.Playhead>
        ) : null}
        <parts.Head className="sticky top-0 z-2 bg-card">{header}</parts.Head>
        <parts.Rows className="relative w-full">{rowEls}</parts.Rows>
        <parts.Empty className="px-3 py-6 text-center text-footnote text-muted-foreground">{emptyState ?? 'No requests'}</parts.Empty>
        {footer != null ? <parts.Footer className="px-3 py-2 text-center text-caption text-muted-foreground">{footer}</parts.Footer> : null}
      </div>
    </parts.Grid>
  );
}

const Table = memo(TableInner) as typeof TableInner;
const Body = memo(BodyInner) as typeof BodyInner;

export function RequestTable<T extends RequestRow = RequestRow>({
  rows, columns: columnsProp = DEFAULT_COLUMNS, timeRange, playhead = null, value, defaultValue, onValueChange, onAction, sort,
  defaultSort, onSortChange, columnWidths, defaultColumnWidths, onColumnWidthsChange, layout = 'auto', breakpoints, controller,
  renderLink, emptyState, footer, density, 'aria-label': ariaLabel = 'Requests', ...rootProps
}: RequestTableProps<T>) {
  const allColumns = useColumns(columnsProp);
  const from = timeRange?.[0];
  const to = timeRange?.[1];
  const range = useMemo<RequestTimeRange>(() => (from !== undefined && to !== undefined ? [from, to] : requestTimeRange(rows)), [from, to, rows]);
  // As on LogList, this is why a moving playhead costs no rows: its prop stops here, in the shell, as an option the
  // primitive writes to the page.
  const options: RequestTableOptions<T> = {
    rows, columns: allColumns, playhead, value, defaultValue, onValueChange, onAction, sort, defaultSort, onSortChange, columnWidths,
    defaultColumnWidths, onColumnWidthsChange, range, breakpoints, layout, controller, rowHeights: ROW_HEIGHT[density ?? 'compact'],
    headerHeight: HEADER_HEIGHT,
  };
  const handle = usePrimitive(requestTable, options as unknown as RequestTableOptions);
  return (
    <Body<T>
      handle={handle}
      allColumns={allColumns}
      total={rows.length}
      range={range}
      renderLink={renderLink}
      emptyState={emptyState}
      footer={footer}
      density={density}
      ariaLabel={ariaLabel}
      rootProps={rootProps}
    />
  );
}

export {
  createRequestTableController, type RequestTableActionDetails, type RequestTableBreakpoints, type RequestTableColumnWidthsChangeReason,
  type RequestTableController,
  type RequestTableSortChangeReason, type RequestTableValueChangeReason,
} from '@/lib/request-table-primitive';

'use client';
import {
  memo, useId, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState,
  type ComponentProps, type CSSProperties, type FocusEvent as ReactFocusEvent, type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent, type ReactElement, type ReactNode, type Ref,
} from 'react';
import { mergeProps, useFocusRing, useMove } from 'react-aria';
import { Button as AriaButton, type ButtonProps as AriaButtonProps, composeRenderProps } from 'react-aria-components';
import { cva, type VariantProps } from 'class-variance-authority';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { useControllableState } from '@/lib/controllable-state';
import { Icon } from '@/lib/icon';
import { rowKeyTarget, type RowId, type RowRange } from '@/lib/log-list';
import { RowWindow, isRowPress, tabThroughGrid, type RowAlign } from '@/lib/log-list-window';
import {
  clampColumnWidth, columnTemplate, isRequestFailed, nextRequestSort, playheadShare, requestBar, requestDisplayName, requestDurationText,
  requestSizeText, requestSortValue, requestStatusText, requestTimeRange, requestTone, sortRequests,
  type RequestColumnSize, type RequestRow, type RequestSort, type RequestSortValue, type RequestTimeRange,
} from '@/lib/request-table';
import { formatDuration } from '@/lib/sql-format';
import { cn } from '@/lib/utils';

/* ══ RequestTable — a network pane: 10,000 requests, a waterfall and a playhead ══
   <RequestTable rows={rows} playhead={t} selectedId={id} onRowPress={(row) => seek(row.time)} />

   Rows are plain data. Columns are configurable, resizable by dragging an edge and sort when pressed. The waterfall's bars
   share one time range, and the optional playhead is a line across it with the rows after it dimmed: it writes one
   element's position and a few attributes and renders nothing, so it can follow a playhead on every frame. `renderLink`
   gives each row a place for links to the other end of the call, which `RequestLink` draws.

   Under 480 px of its own width (not the viewport's, so a side panel gets it too) it becomes two-line rows: the name, then
   status, method and duration, with a small waterfall beside them and sorting in a menu.

   What it's built on: ResultTable pages its rows and Spreadsheet is a matrix of strings, and react-aria's Table on a
   Virtualizer took 400 ms to add one row to 10,000, which a list that grows with a playhead can't pay. So it shares
   LogList's RowWindow, with rows of a fixed height, and is a grid in the way Spreadsheet is: one tab stop, with ↑ ↓ Home End
   and Page Up/Down on the rows, Enter or Space to press one, Tab into the active row's links and on out; ↑ from the first
   row reaches the headers, where ← → move, Enter sorts and ⌥← ⌥→ resize. ← → on a row scroll sideways. A row's press is the
   grid's own click, as on LogList; sort buttons, links and the menu are react-aria's. */

export const requestTableVariants = cva(
  // The hairline is drawn over the content, so the header's fill and a row's tint don't hide it.
  "group/table relative flex h-full max-h-dvh w-full min-h-0 min-w-0 flex-col overflow-hidden rounded-panel bg-card text-card-foreground after:pointer-events-none after:absolute after:inset-0 after:z-3 after:rounded-[inherit] after:shadow-hairline after:content-['']",
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
const OVERSCAN = 360;

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

/** The built-in columns. `type` and `size` go first when the table is narrow. */
export const REQUEST_COLUMNS: Record<RequestColumnId, RequestColumn> = {
  name: { id: 'name', title: 'Name', flex: 3, minWidth: 160 },
  url: { id: 'url', title: 'URL', flex: 3, minWidth: 200 },
  method: { id: 'method', title: 'Method', width: 66, minWidth: 48 },
  status: { id: 'status', title: 'Status', width: 76, minWidth: 48 },
  type: { id: 'type', title: 'Type', width: 72, minWidth: 48, hideBelow: 760 },
  size: { id: 'size', title: 'Size', width: 72, minWidth: 48, align: 'end', hideBelow: 640 },
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
  'group-data-focus-visible/grid:data-active:ring-2 group-data-focus-visible/grid:data-active:ring-ring group-data-focus-visible/grid:data-active:ring-inset',
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

interface CellAttributes {
  role?: string;
  'aria-colindex'?: number;
  'data-column'?: string;
}

export interface RequestLinkProps extends AriaButtonProps {
  /** An Icon name after the text. Default `arrow-right`; null for none. */
  icon?: 'arrow-right' | 'arrow-up-right' | null;
}

/** A link to the other end of a call, for `renderLink`: small enough for a row, and a press on it doesn't press the row. */
export function RequestLink({ icon = 'arrow-right', className, children, ...props }: RequestLinkProps) {
  return (
    <AriaButton
      data-slot="request-table-link"
      className={composeRenderProps(className, (cls) => cn(
        'inline-flex h-[18px] max-w-40 shrink-0 cursor-pointer items-center gap-0.5 rounded-md border-0 bg-primary/10 px-1.5 [font-family:inherit] text-caption2 font-medium whitespace-nowrap text-primary outline-none data-focus-visible:ring-2 data-focus-visible:ring-ring data-hovered:bg-primary/16 data-pressed:bg-primary/24',
        cls,
      ))}
      {...props}
    >
      {composeRenderProps(children, (kids) => (
        <>
          <span className="min-w-0 truncate">{kids}</span>
          {icon ? <Icon name={icon} size={10} sw={2.4} /> : null}
        </>
      ))}
    </AriaButton>
  );
}

interface Column<T extends RequestRow> extends RequestColumn<T> {
  sortable: boolean;
}

function waterfall(row: RequestRow, range: RequestTimeRange, className: string, cell?: CellAttributes, key?: string) {
  const bar = requestBar(row, range);
  return (
    <div key={key} {...cell} data-slot="request-table-waterfall" className={className}>
      {bar ? (
        <div
          data-slot="request-table-bar"
          data-tone={requestTone(row)}
          data-pending={row.pending || undefined}
          className={BAR_CLASS}
          style={{ '--bar-left': `${bar.left}%`, '--bar-width': `${bar.width}%` } as CSSProperties}
        />
      ) : null}
    </div>
  );
}

const nameTitle = (row: RequestRow) => (row.error ? `${row.url}\n${row.error}` : row.url);

function links(content: ReactNode) {
  if (content === null || content === undefined || content === false) return null;
  return <span data-slot="request-table-links" data-no-row-press="" className="ms-auto flex shrink-0 items-center gap-1">{content}</span>;
}

function cellFor<T extends RequestRow>(column: Column<T>, at: number, row: T, range: RequestTimeRange, renderLink: ((row: T) => ReactNode) | undefined) {
  const cell: CellAttributes = { role: 'gridcell', 'aria-colindex': at + 1, 'data-column': column.id };
  const text = column.align === 'end' ? CELL_END_CLASS : CELL_CLASS;
  if (column.render) return <div key={column.id} {...cell} className={text}>{column.render(row)}</div>;
  switch (column.id) {
    case 'name':
    case 'url':
      return (
        <div key={column.id} {...cell} className="flex min-w-0 items-center gap-1.5 px-2">
          <span data-slot="request-table-name" title={nameTitle(row)} className={NAME_CLASS}>
            {column.id === 'url' ? row.url : requestDisplayName(row)}
          </span>
          {links(renderLink?.(row))}
        </div>
      );
    case 'method': return <div key={column.id} {...cell} className={METHOD_CLASS}>{row.method}</div>;
    case 'status': return <div key={column.id} {...cell} className={STATUS_CELL_CLASS}>{requestStatusText(row)}</div>;
    case 'type': return <div key={column.id} {...cell} className={METHOD_CLASS}>{row.type}</div>;
    case 'size': return <div key={column.id} {...cell} className={SIZE_CLASS}>{requestSizeText(row)}</div>;
    case 'duration': return <div key={column.id} {...cell} className={CELL_END_CLASS}>{requestDurationText(row)}</div>;
    case 'waterfall': return waterfall(row, range, WATERFALL_CELL_CLASS, cell, column.id);
    default: return <div key={column.id} {...cell} className={text}>{String((row as unknown as Record<string, unknown>)[column.id] ?? '')}</div>;
  }
}

interface RowViewProps<T extends RequestRow> {
  row: T;
  index: number;
  domId: string;
  selected: boolean;
  active: boolean;
  stacked: boolean;
  columns: readonly Column<T>[];
  range: RequestTimeRange;
  renderLink: ((row: T) => ReactNode) | undefined;
}

function RowViewInner<T extends RequestRow>({ row, index, domId, selected, active, stacked, columns, range, renderLink }: RowViewProps<T>) {
  const shared = {
    role: 'row',
    id: domId,
    'aria-rowindex': index + 2,
    'aria-selected': selected,
    'data-slot': 'request-table-row',
    'data-index': index,
    'data-selected': selected || undefined,
    'data-active': active || undefined,
    'data-failed': isRequestFailed(row) || undefined,
    'data-pending': row.pending || undefined,
  };
  if (stacked) {
    const has = (id: string) => columns.some((column) => column.id === id);
    return (
      <div {...shared} className={STACKED_ROW_CLASS}>
        <div role="gridcell" className="flex min-w-0 flex-1 flex-col gap-1">
          <span data-slot="request-table-name" title={nameTitle(row)} className={`${NAME_CLASS} leading-[18px]`}>{requestDisplayName(row)}</span>
          <div className="flex h-[18px] min-w-0 items-center gap-2 text-caption2 whitespace-nowrap">
            {has('status') ? <span className={STATUS_CLASS}>{requestStatusText(row)}</span> : null}
            {has('method') ? <span className={MUTED_CLASS}>{row.method}</span> : null}
            {has('duration') ? <span className="tabular-nums">{requestDurationText(row)}</span> : null}
            {links(renderLink?.(row))}
          </div>
        </div>
        {has('waterfall') ? waterfall(row, range, STACKED_WATERFALL_CLASS, { role: 'gridcell' }) : null}
      </div>
    );
  }
  return <div {...shared} className={ROW_CLASS}>{columns.map((column, at) => cellFor(column, at, row, range, renderLink))}</div>;
}

const RowView = memo(RowViewInner) as typeof RowViewInner;

function ColumnHeader<T extends RequestRow>({ column, index, domId, sort, active, width, span, onSort, onWidth }: {
  column: Column<T>; index: number; domId: string; sort: RequestSort | null; active: boolean; width: number | undefined; span: number;
  onSort: (id: string) => void; onWidth: (column: Column<T>, width: number) => void;
}) {
  const cell = useRef<HTMLDivElement>(null);
  const dragged = useRef(0);
  const { moveProps } = useMove({
    onMoveStart() { dragged.current = cell.current?.getBoundingClientRect().width ?? width ?? 80; },
    onMove(e) {
      dragged.current += e.deltaX;
      onWidth(column, clampColumnWidth(column, dragged.current));
    },
  });
  const sorted = sort?.column === column.id ? sort.direction : null;
  const isWaterfall = column.id === 'waterfall';
  const title = (
    <>
      <span className="min-w-0 truncate">{column.title ?? column.label ?? column.id}</span>
      {sorted ? <Icon name={sorted === 'ascending' ? 'arrow-up' : 'arrow-down'} size={10} sw={2.6} className="shrink-0 text-foreground" /> : null}
      {isWaterfall && span > 0 ? <span data-slot="request-table-span" className="ms-auto shrink-0 font-normal tabular-nums">{formatDuration(span)}</span> : null}
    </>
  );
  return (
    <div
      ref={cell}
      id={domId}
      role="columnheader"
      aria-colindex={index + 1}
      aria-sort={sorted ?? (column.sortable ? 'none' : undefined)}
      data-slot="request-table-column"
      data-column={column.id}
      data-active={active || undefined}
      className="group/column relative flex h-(--request-header) min-w-0 items-center text-caption font-semibold whitespace-nowrap text-foreground/65 outline-none group-data-focus-visible/grid:data-active:ring-2 group-data-focus-visible/grid:data-active:ring-ring group-data-focus-visible/grid:data-active:ring-inset"
    >
      {column.sortable ? (
        <AriaButton
          excludeFromTabOrder
          preventFocusOnPress
          onPress={() => onSort(column.id)}
          className={cn(
            'flex h-full min-w-0 flex-1 cursor-default items-center gap-1 border-0 bg-transparent px-2 [font-family:inherit] text-caption font-semibold text-foreground/65 outline-none data-hovered:text-foreground',
            column.align === 'end' && 'justify-end',
          )}
        >
          {title}
        </AriaButton>
      ) : <div className={cn('flex min-w-0 flex-1 items-center gap-1 px-2', column.align === 'end' && 'justify-end')}>{title}</div>}
      <div
        {...mergeProps(moveProps, { onDoubleClick: () => onWidth(column, -1) })}
        role="separator"
        aria-orientation="vertical"
        aria-label={`Resize ${typeof column.title === 'string' ? column.title : columnName(column as never)}`}
        aria-valuenow={width}
        data-slot="request-table-resizer"
        className="absolute inset-y-0 -end-1 z-1 w-2 cursor-col-resize touch-none after:absolute after:inset-y-1.5 after:start-[3.5px] after:w-px after:bg-border after:content-[''] hover:after:bg-primary"
      />
    </div>
  );
}

/** What the table does outside React: the playhead's line and which rows are after it. There's one line, over the whole
 *  table, so a tick writes a single element's position and restyles nothing else. A variable on the table for every row's
 *  own piece of a line was measured at 3.6 ms a frame in style recalculation alone. */
class RequestPlayhead<T extends RequestRow> {
  readonly win = new RowWindow<T>({ estimate: ROW_HEIGHT.compact.table, measure: false, overscan: OVERSCAN });
  root: HTMLElement | null = null;
  line: HTMLElement | null = null;
  time: number | null = null;
  range: RequestTimeRange = [0, 1];
  private drawnHeight = -1;

  constructor() {
    this.win.insetTop = HEADER_HEIGHT;
    this.win.decorate = this.decorate;
    this.win.onLayout = () => {
      const height = this.win.height;
      if (height === this.drawnHeight || !this.root) return;
      this.drawnHeight = height;
      this.root.style.setProperty('--request-view', `${height}px`);
    };
  }

  private decorate = (el: HTMLElement, index: number) => {
    const started = this.win.rows[index]?.time;
    el.toggleAttribute('data-future', this.time !== null && started !== undefined && started > this.time);
  };

  setLine = (el: HTMLElement | null) => {
    this.line = el;
    if (el) this.drawLine();
  };

  private drawLine(): void {
    const share = playheadShare(this.time, this.range);
    this.root?.toggleAttribute('data-playhead', share !== null);
    if (share !== null) this.line?.style.setProperty('--request-playhead', String(share));
  }

  /** Moves the line and dims the rows after it, in the DOM alone. */
  set(time: number | null, range: RequestTimeRange = this.range): void {
    const changed = time !== this.time;
    this.time = time;
    this.range = range;
    this.drawLine();
    if (changed) this.win.decorateAll();
  }
}

export interface RequestTableHandle {
  /** Focuses the table. */
  focus: () => void;
  /** Scrolls to a row by id. `center` by default; `nearest` moves only if it's out of view. */
  scrollToId: (id: RowId, align?: RowAlign) => void;
  /** Moves the playhead with no React at all, for a clock's every tick. The `playhead` prop takes over when it next changes. */
  setPlayhead: (time: number | null) => void;
}

export interface RequestTableProps<T extends RequestRow = RequestRow>
  extends Omit<ComponentProps<'div'>, 'children' | 'ref'>, VariantProps<typeof requestTableVariants> {
  rows: readonly T[];
  /** Which columns, in order: a built-in's id, or a column of your own (with a built-in's `id` to adjust that one). */
  columns?: readonly (RequestColumnId | RequestColumn<T>)[];
  /** The waterfall's range, in ms. Default: from the first request to the last answer. Give the recording's own range if
   *  rows come and go with a playhead, or every bar moves when they do. */
  timeRange?: RequestTimeRange;
  /** The playhead's time, in ms: a line on the waterfall, and the rows sent after it dimmed. */
  playhead?: number | null;
  /** The selected row, controlled; `null` for none. A new value that's out of view is scrolled to. */
  selectedId?: RowId | null;
  defaultSelectedId?: RowId | null;
  onSelectionChange?: (id: RowId | null) => void;
  /** A press on a row (or Enter or Space on the active one). Not called for presses on its links. */
  onRowPress?: (row: T, index: number) => void;
  /** Links to the other end of a call, usually `RequestLink`s, after the name (or the second line of a two-line row).
   *  Must be stable (`useCallback`). */
  renderLink?: (row: T) => ReactNode;
  /** The sort, controlled; `null` for the rows' own order. */
  sort?: RequestSort | null;
  defaultSort?: RequestSort | null;
  onSortChange?: (sort: RequestSort | null) => void;
  /** Widths dragged so far by column id, controlled. A column with none keeps its own size. */
  columnWidths?: Readonly<Record<string, number>>;
  defaultColumnWidths?: Readonly<Record<string, number>>;
  onColumnWidthsChange?: (widths: Readonly<Record<string, number>>) => void;
  /** `auto` (default) goes to two-line rows below `stackBelow`. `table` and `stacked` stay as they are. */
  layout?: 'auto' | 'table' | 'stacked';
  /** The table's own width, in px, below which `auto` stacks. Default 480. */
  stackBelow?: number;
  /** Shown when there are no rows. */
  emptyState?: ReactNode;
  /** Shown after the last row. */
  footer?: ReactNode;
  'aria-label'?: string;
  ref?: Ref<RequestTableHandle>;
}

const EMPTY_RANGE: RowRange = { start: 0, end: 0 };

interface RequestHandlers<T extends RequestRow> {
  onRowPress: RequestTableProps<T>['onRowPress'];
  onSelectionChange: RequestTableProps<T>['onSelectionChange'];
  onSortChange: RequestTableProps<T>['onSortChange'];
  onColumnWidthsChange: RequestTableProps<T>['onColumnWidthsChange'];
}

interface BodyProps<T extends RequestRow> extends Omit<RequestTableProps<T>, 'playhead' | 'timeRange' | 'onRowPress' | 'onSelectionChange' | 'onSortChange' | 'onColumnWidthsChange' | 'ref'> {
  playhead: RequestPlayhead<T>;
  handlers: { current: RequestHandlers<T> };
  gridRef: { current: HTMLDivElement | null };
  range: RequestTimeRange;
}

function BodyInner<T extends RequestRow>({
  playhead, handlers, gridRef, range, rows, columns: columnsProp = DEFAULT_COLUMNS, selectedId, defaultSelectedId, renderLink,
  sort: sortProp, defaultSort, columnWidths, defaultColumnWidths, layout = 'auto', stackBelow = 480, emptyState, footer,
  density, className, style, onKeyDown, onFocus, 'aria-label': ariaLabel = 'Requests', ...props
}: BodyProps<T>) {
  const { win } = playhead;
  const [mounted, setMounted] = useState(EMPTY_RANGE);
  const [width, setWidth] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const sizer = useRef<HTMLDivElement>(null);
  const baseId = useId();
  const { isFocusVisible, focusProps } = useFocusRing();

  const [selected, setSelected] = useControllableState<RowId | null>(selectedId, defaultSelectedId ?? null, (id) => handlers.current.onSelectionChange?.(id));
  const [sort, setSort] = useControllableState<RequestSort | null>(sortProp, defaultSort ?? null, (next) => handlers.current.onSortChange?.(next));
  const [widths, setWidths] = useControllableState<Readonly<Record<string, number>>>(columnWidths, defaultColumnWidths ?? NO_WIDTHS, (next) => handlers.current.onColumnWidthsChange?.(next));
  const [activeId, setActiveId] = useState<RowId | null>(null);
  const [headerAt, setHeaderColumn] = useState<number | null>(null);

  const stacked = layout === 'stacked' || (layout === 'auto' && width > 0 && width < stackBelow);
  // Two-line rows have no column headers to be on.
  const headerColumn = stacked ? null : headerAt;
  const rowHeight = ROW_HEIGHT[density ?? 'compact'][stacked ? 'stacked' : 'table'];

  // A list of ids is the same list whenever it says the same thing, so writing one inline doesn't re-render the rows.
  const columnsKey = columnsProp.every((column) => typeof column === 'string') ? columnsProp.join() : columnsProp;
  const allColumns = useMemo<readonly Column<T>[]>(() => columnsProp.map((column) => {
    const spec = typeof column === 'string' ? { id: column } : column;
    const builtIn = (REQUEST_COLUMNS as Record<string, RequestColumn | undefined>)[spec.id] as RequestColumn<T> | undefined;
    const merged = { ...builtIn, ...spec };
    return { ...merged, sortable: merged.sortable ?? (!merged.render || !!merged.sortValue) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [columnsKey]);
  // Only crossing a column's `hideBelow` changes this, so a drag of the window doesn't re-render rows until it does.
  const shownKey = allColumns.filter((column) => !column.hideBelow || !width || width >= column.hideBelow).map((column) => column.id).join();
  const columns = useMemo(() => {
    const shown = new Set(shownKey.split(','));
    return allColumns.filter((column) => shown.has(column.id));
  }, [allColumns, shownKey]);
  const { template, minWidth } = useMemo(() => columnTemplate(columns, widths), [columns, widths]);

  const sorted = useMemo(() => {
    const by = sort && allColumns.find((column) => column.id === sort.column)?.sortValue;
    return sortRequests(rows, sort, by ?? requestSortValue);
  }, [rows, sort, allColumns]);

  useLayoutEffect(() => {
    win.onRange = setMounted;
    win.onWidth = (next) => setWidth(next);
    playhead.root = root.current;
    const scroller = gridRef.current;
    if (!scroller || !sizer.current) return undefined;
    const detach = win.attach(scroller, sizer.current);
    setWidth(scroller.clientWidth);
    return detach;
  }, [win, gridRef, playhead]);
  useLayoutEffect(() => { win.setFixedHeight(rowHeight); }, [win, rowHeight]);
  useLayoutEffect(() => { win.setRows(sorted); }, [win, sorted]);
  useLayoutEffect(() => { win.sync(); });
  // A new sort starts from the selected row, or the top: holding on to whichever row happened to be at the top means nothing.
  const lastSort = useRef(sort);
  useLayoutEffect(() => {
    if (lastSort.current === sort) return;
    lastSort.current = sort;
    const at = selected === null ? -1 : win.ids.indexOf(selected);
    if (at >= 0) win.scrollToIndex(at, 'center', 'effect');
    else win.scrollToIndex(0, 'start', 'effect');
  }, [sort, selected, win]);
  // A selection from outside (the other end of a call) comes into view. A press's row is in view already.
  const lastSelected = useRef<RowId | null>(null);
  useLayoutEffect(() => {
    if (selected === lastSelected.current) return;
    lastSelected.current = selected;
    if (selected === null) return;
    const at = win.ids.indexOf(selected);
    if (at >= 0 && !win.isVisible(at)) win.scrollToIndex(at, 'center', 'effect');
  }, [selected, win]);

  const domId = (index: number) => `${baseId}-${index}`;
  const headerId = (index: number) => `${baseId}-h${index}`;
  const activeIndex = activeId === null ? -1 : win.indexIn(sorted, activeId);
  const selectedIndex = selected === null ? -1 : win.indexIn(sorted, selected);
  const isMounted = (index: number) => index >= mounted.start && index < Math.min(mounted.end, sorted.length);

  const press = (index: number) => {
    const row = sorted[index];
    setActiveId(row.id);
    setHeaderColumn(null);
    setSelected(row.id);
    handlers.current.onRowPress?.(row, index);
  };

  const onClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    const index = win.indexFrom(e.target);
    if (index >= 0 && isRowPress(e)) press(index);
  };

  const startRow = () => {
    if (selectedIndex >= 0 && win.isVisible(selectedIndex)) return selectedIndex;
    return win.heights.indexAt(win.scrollTop);
  };

  const onHeaderKey = (e: ReactKeyboardEvent<HTMLDivElement>, at: number) => {
    const column = columns[at];
    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowRight': {
        const direction = e.key === 'ArrowLeft' ? -1 : 1;
        if (e.altKey) {
          const now = gridRef.current?.querySelector<HTMLElement>(`[role=columnheader][data-column="${column.id}"]`)?.getBoundingClientRect().width ?? 80;
          setColumnWidth(widths, setWidths, column.id, clampColumnWidth(column, now + direction * (e.shiftKey ? 48 : 12)));
        } else setHeaderColumn(Math.max(0, Math.min(columns.length - 1, at + direction)));
        break;
      }
      case 'Escape': setHeaderColumn(null); break;
      case 'Home': setHeaderColumn(0); break;
      case 'End': setHeaderColumn(columns.length - 1); break;
      case 'Enter':
      case ' ':
        if (column.sortable) setSort(nextRequestSort(sort, column.id));
        break;
      case 'ArrowDown':
        if (sorted.length) {
          setHeaderColumn(null);
          const to = activeIndex >= 0 ? activeIndex : startRow();
          setActiveId(sorted[to].id);
          win.scrollToIndex(to);
        }
        break;
      default:
        return;
    }
    e.preventDefault();
  };

  const onGridKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented) return;
    if (e.key === 'Tab') {
      tabThroughGrid(e, headerColumn === null && activeIndex >= 0 ? win.elementAt(activeIndex) : undefined);
      return;
    }
    const grid = e.currentTarget;
    if (e.target !== grid) {
      if (e.key === 'Escape') { grid.focus(); e.preventDefault(); }
      return;
    }
    if (headerColumn !== null) { onHeaderKey(e, Math.min(headerColumn, columns.length - 1)); return; }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      win.scrollLeftBy(e.key === 'ArrowLeft' ? -48 : 48);
      e.preventDefault();
      return;
    }
    if (!sorted.length) {
      if (e.key === 'ArrowUp' && !stacked) { setHeaderColumn(0); e.preventDefault(); }
      return;
    }
    const from = activeIndex >= 0 ? activeIndex : startRow();
    if (e.key === 'Enter' || e.key === ' ') {
      press(from);
      e.preventDefault();
      return;
    }
    if (e.key === 'ArrowUp' && from === 0 && activeIndex === 0 && !stacked) {
      setHeaderColumn(0);
      e.preventDefault();
      return;
    }
    const to = activeIndex < 0 && (e.key === 'ArrowDown' || e.key === 'ArrowUp')
      ? from
      : rowKeyTarget(e.key, from, sorted.length, (direction) => win.heights.indexAt(win.heights.offsetOf(from) + direction * win.view));
    if (to === null) return;
    e.preventDefault();
    setActiveId(sorted[to].id);
    win.scrollToIndex(to);
  };

  const onGridFocus = (e: ReactFocusEvent<HTMLDivElement>) => {
    focusProps.onFocus?.(e);
    onFocus?.(e);
    if (e.target === e.currentTarget && activeId === null && headerColumn === null && sorted.length) setActiveId(sorted[startRow()].id);
  };

  // Its own element, so a new range of rows doesn't render the headers again: only what's in this list does.
  const count = rows.length;
  const span = count ? range[1] - range[0] : 0;
  const header = useMemo(() => {
    if (stacked) {
      const sortable = columns.filter((column) => column.sortable);
      const sortedColumn = sort ? allColumns.find((column) => column.id === sort.column) : undefined;
      return (
        <div role="row" aria-rowindex={1} data-slot="request-table-header" className="flex h-(--request-header) items-center justify-between gap-2 bg-secondary ps-2 pe-1 text-caption text-foreground/65 shadow-hairline-b">
          <span role="columnheader" className="tabular-nums">{count.toLocaleString('en-US')} {count === 1 ? 'request' : 'requests'}</span>
          {sortable.length ? (
            <span role="columnheader" className="flex items-center">
              <DropdownMenu>
                <Button variant="quiet" size="sm" aria-label="Sort by" data-slot="request-table-sort" className="h-6 gap-1 rounded-md px-1.5 text-caption font-medium">
                  <span>{sortedColumn ? columnName(sortedColumn as never) : 'Sort'}</span>
                  {sort ? <Icon name={sort.direction === 'ascending' ? 'arrow-up' : 'arrow-down'} size={10} sw={2.6} /> : <Icon name="chevron-up-down" size={12} sw={2} />}
                </Button>
                <DropdownMenuContent
                  aria-label="Sort by"
                  placement="bottom end"
                  selectionMode="single"
                  selectedKeys={[sort?.column ?? ORIGINAL_ORDER]}
                  onAction={(id) => setSort(id === ORIGINAL_ORDER ? null : nextRequestSort(sort, String(id)))}
                >
                  <DropdownMenuItem id={ORIGINAL_ORDER}>Original order</DropdownMenuItem>
                  {sortable.map((column) => <DropdownMenuItem key={column.id} id={column.id}>{columnName(column as never)}</DropdownMenuItem>)}
                </DropdownMenuContent>
              </DropdownMenu>
            </span>
          ) : null}
        </div>
      );
    }
    return (
      <div role="row" aria-rowindex={1} data-slot="request-table-header" className="grid h-(--request-header) grid-cols-(--request-cols) bg-secondary shadow-hairline-b">
        {columns.map((column, i) => (
          <ColumnHeader<T>
            key={column.id}
            column={column}
            index={i}
            domId={`${baseId}-h${i}`}
            sort={sort}
            active={headerColumn === i}
            width={widths[column.id]}
            span={span}
            onSort={(id) => setSort(nextRequestSort(sort, id))}
            onWidth={(which, next) => setColumnWidth(widths, setWidths, which.id, next)}
          />
        ))}
      </div>
    );
    // Its setters are read fresh from the controllable state, and change with the values listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stacked, columns, allColumns, sort, headerColumn, widths, span, count, baseId]);

  const rowEls: ReactElement[] = [];
  for (let i = mounted.start; i < Math.min(mounted.end, sorted.length); i++) {
    const row = sorted[i];
    rowEls.push(
      <RowView<T>
        key={row.id}
        row={row}
        index={i}
        domId={domId(i)}
        selected={row.id === selected}
        active={row.id === activeId && headerColumn === null}
        stacked={stacked}
        columns={columns}
        range={range}
        renderLink={renderLink}
      />,
    );
  }

  return (
    <div
      ref={root}
      data-slot="request-table"
      data-rows={rows.length}
      data-layout={stacked ? 'stacked' : 'table'}
      className={cn(requestTableVariants({ density }), className)}
      style={{
        '--request-cols': template,
        '--request-min-width': `${stacked ? 0 : minWidth}px`,
        '--request-row': `${rowHeight}px`,
        '--request-header': `${HEADER_HEIGHT}px`,
        ...style,
      } as CSSProperties}
      {...props}
    >
      <div
        ref={gridRef}
        role="grid"
        tabIndex={0}
        aria-label={ariaLabel}
        aria-rowcount={sorted.length + 1}
        aria-colcount={stacked ? undefined : columns.length}
        aria-activedescendant={headerColumn !== null ? headerId(headerColumn) : activeIndex >= 0 && isMounted(activeIndex) ? domId(activeIndex) : undefined}
        data-slot="request-table-grid"
        data-focus-visible={isFocusVisible || undefined}
        onClick={onClick}
        onKeyDown={onGridKeyDown}
        onFocus={onGridFocus}
        onBlur={focusProps.onBlur}
        className="group/grid bl-scroll relative min-h-0 flex-1 overflow-auto overscroll-contain outline-none [overflow-anchor:none]"
      >
        <div className="min-h-full w-full min-w-(--request-min-width)">
          {columns.some((column) => column.id === 'waterfall') ? (
            <div aria-hidden="true" data-slot="request-table-playhead" className="pointer-events-none sticky top-0 z-3 hidden h-0 group-data-playhead/table:block">
              <div className={cn('absolute inset-x-0', stacked ? 'top-(--request-header) flex h-[calc(var(--request-view)-var(--request-header))] justify-end pe-2' : 'top-0 grid h-(--request-view) grid-cols-(--request-cols)')}>
                <div className={stacked ? 'relative w-24' : 'relative mx-2'} style={stacked ? undefined : { gridColumnStart: columns.findIndex((column) => column.id === 'waterfall') + 1 }}>
                  <div ref={playhead.setLine} className="absolute inset-y-0 left-[calc(var(--request-playhead,0)*100%)] w-px bg-primary" />
                </div>
              </div>
            </div>
          ) : null}
          <div role="rowgroup" className="sticky top-0 z-2 bg-card">
            {header}
          </div>
          <div ref={sizer} role="rowgroup" data-slot="request-table-rows" className="relative w-full">
            {rowEls}
          </div>
          {!sorted.length ? <div data-slot="request-table-empty" className="px-3 py-6 text-center text-footnote text-muted-foreground">{emptyState ?? 'No requests'}</div> : null}
          {footer != null ? <div data-slot="request-table-footer" className="px-3 py-2 text-center text-caption text-muted-foreground">{footer}</div> : null}
        </div>
      </div>
    </div>
  );
}

const NO_WIDTHS: Readonly<Record<string, number>> = {};

/** The sort menu's item for no sort. A column can't have this id, or not by accident. */
const ORIGINAL_ORDER = '$original-order';

/** A column's words, for the sort menu and screen readers. */
function columnName(column: RequestColumn<never>): string {
  return column.label ?? (typeof column.title === 'string' ? column.title : column.id);
}

/** A column's new width, or -1 to go back to its own size. */
function setColumnWidth(widths: Readonly<Record<string, number>>, set: (next: Readonly<Record<string, number>>) => void, id: string, width: number) {
  const next = { ...widths };
  if (width < 0) delete next[id];
  else next[id] = width;
  set(next);
}

const Body = memo(BodyInner) as typeof BodyInner;

export function RequestTable<T extends RequestRow = RequestRow>({
  playhead = null, timeRange, onRowPress, onSelectionChange, onSortChange, onColumnWidthsChange, ref, ...props
}: RequestTableProps<T>) {
  const [line] = useState(() => new RequestPlayhead<T>());
  const grid = useRef<HTMLDivElement | null>(null);
  const handlers = useRef<RequestHandlers<T>>({ onRowPress, onSelectionChange, onSortChange, onColumnWidthsChange });
  useLayoutEffect(() => { handlers.current = { onRowPress, onSelectionChange, onSortChange, onColumnWidthsChange }; });
  const { rows } = props;
  const from = timeRange?.[0];
  const to = timeRange?.[1];
  const range = useMemo<RequestTimeRange>(() => (from !== undefined && to !== undefined ? [from, to] : requestTimeRange(rows)), [from, to, rows]);
  // As on LogList, this is why a moving playhead costs no rows: its prop stops here, in the shell.
  useLayoutEffect(() => { line.set(playhead, range); }, [line, playhead, range]);
  useImperativeHandle(ref, () => ({
    focus: () => grid.current?.focus(),
    scrollToId: (id, align = 'center') => line.win.scrollToIndex(line.win.ids.indexOf(id), align, 'micro'),
    setPlayhead: (time) => line.set(time),
  }), [line]);
  return <Body<T> playhead={line} handlers={handlers} gridRef={grid} range={range} {...props} />;
}

'use client';
import { useMemo, type ComponentProps, type CSSProperties, type ReactNode } from 'react';
import { Button as SdkButton } from '@ui-sdk/react/button';
import { DataTable, DataTableCell, type DataTableColumn, type DataTableOverlayState, type DataTableProps } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import type { DataTableTimeRange } from '@/lib/data-table-model';
import { Icon } from '@/lib/icon';
import {
  isRequestFailed, requestBar, requestDisplayName, requestDurationText, requestSizeText, requestSortValue, requestStatusText,
  requestTimeRange, requestTone, type RequestRow,
} from '@/lib/request-table-model';
import { formatDuration } from '@/lib/sql-format';
import { cn, cx } from '@/lib/utils';

/* ══ RequestTable — a network pane: 10,000 requests, a waterfall and a playhead ══
   <RequestTable rows={rows} playhead={t} value={id} onAction={(id, { row }) => seek(row.time)} />

   A preset of DataTable: the request columns (name, method, status, type, size, time and a waterfall), the playhead's
   line across the waterfall with the rows sent after it dimmed, and `renderLink` for links to the other end of a call
   (`RequestLink`). Everything else, sorting, resizing, the keyboard, virtual rows, its own size class and the props
   for them, is DataTable's. The waterfall's bars share one time range. The playhead writes one element's position and
   a few attributes and renders nothing, so it can follow a clock on every frame.

   Compact (under 480 px of its own width) it becomes two-line rows: the name, then status, method and duration, with a
   small waterfall beside them and sorting in a menu. Under 760 px the columns with `hideBelow: 'regular'` (`type` and
   `size`) go. */

export type RequestColumnId = 'name' | 'url' | 'method' | 'status' | 'type' | 'size' | 'duration' | 'waterfall';

/** The built-in columns' sizes and titles. `type` and `size` go first when the table is narrow: below its regular size
 *  class. Their cells and sort values come with them when you name one by id in `columns`. */
export const REQUEST_COLUMNS: Record<RequestColumnId, DataTableColumn<RequestRow>> = {
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

const NAME_CLASS = 'min-w-0 truncate font-mono group-data-failed/row:text-destructive';
const STATUS_CLASS = 'tabular-nums group-data-failed/row:text-destructive group-data-pending/row:text-muted-foreground';
const MUTED_CLASS = 'text-muted-foreground';
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

function Bar({ row, range }: { row: RequestRow; range: DataTableTimeRange }) {
  const bar = requestBar(row, range);
  if (!bar) return null;
  return (
    <div
      data-slot="request-table-bar"
      data-tone={requestTone(row)}
      data-pending={row.pending || undefined}
      className={BAR_CLASS}
      style={{ '--bar-left': `${bar.left}%`, '--bar-width': `${bar.width}%` } as CSSProperties}
    />
  );
}

const nameTitle = (row: RequestRow) => (row.error ? `${row.url}\n${row.error}` : row.url);

function links(content: ReactNode) {
  if (content === null || content === undefined || content === false) return null;
  return <span data-slot="request-table-links" data-no-row-press="" className="ms-auto flex shrink-0 items-center gap-1">{content}</span>;
}

/** A built-in column's cell, class and sort value, for the table's time range and links. */
function builtIn<T extends RequestRow>(id: RequestColumnId, range: DataTableTimeRange, renderLink: ((row: T) => ReactNode) | undefined): Partial<DataTableColumn<T>> {
  const sortValue = (row: T) => requestSortValue(row, id);
  switch (id) {
    case 'name':
    case 'url':
      return {
        sortValue,
        className: 'flex items-center gap-1.5',
        render: (row) => (
          <>
            <span data-slot="request-table-name" title={nameTitle(row)} className={NAME_CLASS}>{id === 'url' ? row.url : requestDisplayName(row)}</span>
            {links(renderLink?.(row))}
          </>
        ),
      };
    case 'method': return { sortValue, className: MUTED_CLASS, render: (row) => row.method };
    case 'status': return { sortValue, className: STATUS_CLASS, render: requestStatusText };
    case 'type': return { sortValue, className: MUTED_CLASS, render: (row) => row.type };
    case 'size': return { sortValue, className: MUTED_CLASS, render: requestSizeText };
    case 'duration': return { sortValue, render: requestDurationText };
    case 'waterfall': {
      const span = range[1] - range[0];
      return {
        sortValue,
        className: 'relative mx-2 h-full px-0',
        headerEnd: span > 0 ? formatDuration(span) : undefined,
        render: (row) => <Bar row={row} range={range} />,
      };
    }
  }
}

export interface RequestTableProps<T extends RequestRow = RequestRow>
  extends Omit<DataTableProps<T>, 'columns' | 'rowTime' | 'overlay' | 'renderStackedRow' | 'countLabel' | 'timeRange'> {
  /** Which columns, in order: a built-in's id, or a column of your own (with a built-in's `id` to adjust that one). */
  columns?: readonly (RequestColumnId | DataTableColumn<T>)[];
  /** The waterfall's range, in ms. Default: from the first request to the last answer. Give the recording's own range if
   *  rows come and go with a playhead, or every bar moves when they do. */
  timeRange?: DataTableTimeRange;
  /** Links to the other end of a call, usually `RequestLink`s, after the name (or the second line of a two-line row).
   *  Must be stable (`useCallback`). */
  renderLink?: (row: T) => ReactNode;
}

const rowTime = (row: RequestRow) => row.time;
const countLabel = (count: number) => `${count.toLocaleString('en-US')} ${count === 1 ? 'request' : 'requests'}`;

/** The playhead's line: across the waterfall column in a table, across the small waterfall of a two-line row. */
function playheadLine<T extends RequestRow>({ columns, stacked }: DataTableOverlayState<T>): ReactNode {
  const at = columns.findIndex((column) => column.id === 'waterfall');
  if (at < 0) return null;
  // Shown only while the playhead is on the range (the grid's `data-playhead`).
  return (
    <div data-slot="request-table-playhead" className="hidden group-data-playhead/grid:block">
      <div
        className={cn(
          'absolute inset-x-0',
          stacked ? 'top-(--data-table-header) flex h-[calc(var(--data-table-view)-var(--data-table-header))] justify-end pe-2' : 'top-0 grid h-(--data-table-view) grid-cols-(--data-table-cols)',
        )}
      >
        <div className={stacked ? 'relative w-24' : 'relative mx-2'} style={stacked ? undefined : { gridColumnStart: at + 1 }}>
          <div className="absolute inset-y-0 left-[calc(var(--data-table-playhead,0)*100%)] w-px bg-primary" />
        </div>
      </div>
    </div>
  );
}

export function RequestTable<T extends RequestRow = RequestRow>({
  rows, columns: columnsProp = DEFAULT_COLUMNS, timeRange, renderLink, density = 'compact', emptyState, 'aria-label': ariaLabel = 'Requests', ...props
}: RequestTableProps<T>) {
  const from = timeRange?.[0];
  const to = timeRange?.[1];
  const range = useMemo<DataTableTimeRange>(() => (from !== undefined && to !== undefined ? [from, to] : requestTimeRange(rows)), [from, to, rows]);
  // A list of ids is the same list whenever it says the same thing, so writing one inline doesn't re-render the rows.
  const key = columnsProp.every((column) => typeof column === 'string') ? columnsProp.join() : columnsProp;
  const columns = useMemo(() => columnsProp.map((column): DataTableColumn<T> => {
    const spec = typeof column === 'string' ? { id: column } : column;
    const known = (REQUEST_COLUMNS as Record<string, DataTableColumn<RequestRow> | undefined>)[spec.id] as DataTableColumn<T> | undefined;
    if (!known) return spec;
    // A column of your own with a built-in's id keeps the built-in's cell unless it brings one.
    return { ...known, ...builtIn<T>(spec.id as RequestColumnId, range, renderLink), ...spec };
  }), [key, range, renderLink]);

  const has = useMemo(() => new Set(columns.map((column) => column.id)), [columns]);
  const renderStackedRow = useMemo(() => (row: T) => (
    <>
      <DataTableCell col={0} className="flex min-w-0 flex-1 flex-col gap-1">
        <span data-slot="request-table-name" title={nameTitle(row)} className={`${NAME_CLASS} leading-[18px]`}>{requestDisplayName(row)}</span>
        <div className="flex h-[18px] min-w-0 items-center gap-2 text-caption2 whitespace-nowrap">
          {has.has('status') ? <span className={STATUS_CLASS}>{requestStatusText(row)}</span> : null}
          {has.has('method') ? <span className={MUTED_CLASS}>{row.method}</span> : null}
          {has.has('duration') ? <span className="tabular-nums">{requestDurationText(row)}</span> : null}
          {links(renderLink?.(row))}
        </div>
      </DataTableCell>
      {has.has('waterfall') ? (
        <DataTableCell col={0} className={STACKED_WATERFALL_CLASS}>
          <span data-slot="request-table-waterfall" className="absolute inset-0"><Bar row={row} range={range} /></span>
        </DataTableCell>
      ) : null}
    </>
  ), [has, range, renderLink]);

  return (
    <DataTable<T>
      {...props}
      aria-label={ariaLabel}
      rows={rows}
      columns={columns}
      density={density}
      timeRange={range}
      rowTime={rowTime}
      overlay={playheadLine}
      renderStackedRow={renderStackedRow}
      countLabel={countLabel}
      emptyState={emptyState === undefined ? <EmptyState size="sm" title="No requests" /> : emptyState}
      rowProps={rowProps}
    />
  );
}

/** A row's state as attributes the cells' classes read: failed and pending. */
function rowProps(row: RequestRow) {
  return { 'data-failed': isRequestFailed(row) || undefined, 'data-pending': row.pending || undefined };
}

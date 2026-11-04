import { formatBytes } from '@/lib/format-bytes';
import type { RowId } from '@/lib/log-list-model';
import { formatDuration } from '@/lib/sql-format';

/* ══ RequestTable's pure logic ══
   What a row says (status, duration, size, its name from its URL), where its bar goes on the shared time range, how rows
   sort, and how columns turn into a CSS grid. No React and no DOM. */

/** A bar's color. */
export type RequestTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'accent';

export interface RequestRow {
  id: RowId;
  /** The full URL, or an IPC channel. */
  url: string;
  /** What the Name column shows. Default: the last part of the URL (`requestName`). */
  name?: string;
  method?: string;
  /** An HTTP status; 0 means it failed without one. A string is shown as it is, like an IPC call's result. */
  status?: number | string;
  statusText?: string;
  /** `fetch`, `xhr`, `script`, `ipc`… */
  type?: string;
  /** Bytes. */
  size?: number;
  /** When it was sent, in ms on the table's time range. A row without one has no bar and is never dimmed. */
  time?: number;
  /** How long it took, in ms. */
  duration?: number;
  /** The bar's color. Default: `danger` if it failed, else `primary`. */
  tone?: RequestTone;
  /** Still waiting: says so in Status and Time, and the bar runs on to the end of the range when it has no `duration`. */
  pending?: boolean;
  /** It failed, whatever its status. A status of 0 or from 400 up counts without this. */
  failed?: boolean;
  /** Why it failed. */
  error?: string;
}

/* ── What a row says ── */

/** DevTools' Name column: the last path segment plus the query, or the host for a bare origin. */
export function requestName(url: string): string {
  const clean = url.replace(/#.*$/, '');
  const at = clean.indexOf('?');
  const path = at < 0 ? clean : clean.slice(0, at);
  const segment = path.replace(/\/+$/, '').split('/').pop() || '/';
  return at < 0 ? segment : `${segment}${clean.slice(at)}`;
}

export function requestDisplayName(row: Pick<RequestRow, 'name' | 'url'>): string {
  return row.name ?? requestName(row.url);
}

export function isRequestFailed(row: Pick<RequestRow, 'failed' | 'status' | 'pending'>): boolean {
  if (row.pending) return false;
  return !!row.failed || row.status === 0 || (typeof row.status === 'number' && row.status >= 400);
}

/** `200`, `(pending)`, `(failed)`, or a dash when the recording doesn't say. */
export function requestStatusText(row: Pick<RequestRow, 'failed' | 'status' | 'pending'>): string {
  if (row.pending) return '(pending)';
  if (row.status === undefined) return row.failed ? '(failed)' : '—';
  return row.status === 0 ? '(failed)' : String(row.status);
}

export function requestDurationText(row: Pick<RequestRow, 'duration' | 'pending'>): string {
  if (row.pending && row.duration === undefined) return 'Pending';
  return row.duration === undefined ? '—' : formatDuration(row.duration);
}

export function requestSizeText(row: Pick<RequestRow, 'size'>): string {
  return row.size === undefined ? '—' : formatBytes(row.size);
}

export function requestTone(row: Pick<RequestRow, 'tone' | 'failed' | 'status' | 'pending'>): RequestTone {
  return row.tone ?? (isRequestFailed(row) ? 'danger' : 'primary');
}

/* ── The waterfall ── */

export type RequestTimeRange = readonly [start: number, end: number];

/** From the first request sent to the last answer. Never empty, so a bar's share of it is always a number. */
export function requestTimeRange(rows: readonly Pick<RequestRow, 'time' | 'duration'>[]): RequestTimeRange {
  let start = Infinity;
  let end = -Infinity;
  for (const row of rows) {
    if (row.time === undefined) continue;
    if (row.time < start) start = row.time;
    const stop = row.time + (row.duration ?? 0);
    if (stop > end) end = stop;
  }
  if (start === Infinity) return [0, 1];
  return [start, Math.max(end, start + 1)];
}

/** A row's bar, as percentages of the range, cut to it; null when it has no time or falls outside it. A bar with no width
 *  still draws (the part gives it a minimum). A pending row with no duration runs to the end of the range. */
export function requestBar(row: Pick<RequestRow, 'time' | 'duration' | 'pending'>, [start, end]: RequestTimeRange): { left: number; width: number } | null {
  if (row.time === undefined) return null;
  const span = end - start;
  const stop = row.duration === undefined && row.pending ? end : row.time + (row.duration ?? 0);
  if (span <= 0 || stop < start || row.time > end) return null;
  const from = Math.max(row.time, start);
  const to = Math.min(stop, end);
  return { left: ((from - start) / span) * 100, width: ((to - from) / span) * 100 };
}

/** The playhead's place on the range, 0…1, or null when it isn't on it. */
export function playheadShare(time: number | null | undefined, [start, end]: RequestTimeRange): number | null {
  if (time === null || time === undefined || !Number.isFinite(time) || time < start || time > end || end <= start) return null;
  return (time - start) / (end - start);
}

/* ── Sorting ── */

export type RequestSortDirection = 'ascending' | 'descending';

export interface RequestSort {
  column: string;
  direction: RequestSortDirection;
}

/** The next sort when a column is pressed: ascending, descending, then back to the rows' own order. */
export function nextRequestSort(sort: RequestSort | null, column: string): RequestSort | null {
  if (sort?.column !== column) return { column, direction: 'ascending' };
  return sort.direction === 'ascending' ? { column, direction: 'descending' } : null;
}

export type RequestSortValue = number | string | null | undefined;

/** What a built-in column sorts by. */
export function requestSortValue(row: RequestRow, column: string): RequestSortValue {
  switch (column) {
    case 'name': return requestDisplayName(row);
    case 'url': return row.url;
    case 'method': return row.method;
    case 'status': return row.pending ? undefined : row.status;
    case 'type': return row.type;
    case 'size': return row.size;
    case 'duration': return row.duration;
    case 'waterfall': case 'time': return row.time;
    default: return (row as unknown as Record<string, RequestSortValue>)[column];
  }
}

const missing = (value: RequestSortValue) => value === undefined || value === null || value === '' || (typeof value === 'number' && Number.isNaN(value));

/** The rows in a column's order, a new array. It's stable, ties keep the rows' own order, and rows with nothing in the
 *  column stay at the end in both directions. Strings compare case-insensitively by code unit, not by locale, which is
 *  ten times faster at 10,000 rows and right for URLs and methods. */
export function sortRequests<T>(rows: readonly T[], sort: RequestSort | null, valueOf: (row: T, column: string) => RequestSortValue): readonly T[] {
  if (!sort) return rows;
  const sign = sort.direction === 'ascending' ? 1 : -1;
  const keys = rows.map((row) => {
    const value = valueOf(row, sort.column);
    return typeof value === 'string' ? value.toLowerCase() : value;
  });
  const order = rows.map((_, i) => i);
  order.sort((a, b) => {
    const x = keys[a];
    const y = keys[b];
    const noX = missing(x);
    const noY = missing(y);
    if (noX || noY) return noX === noY ? a - b : noX ? 1 : -1;
    if (x === y) return a - b;
    // A column of numbers with a few words among them (an IPC call's "ok") keeps numbers first.
    if (typeof x !== typeof y) return (typeof x === 'number' ? -1 : 1) * sign;
    return ((x as number | string) < (y as number | string) ? -1 : 1) * sign;
  });
  return order.map((i) => rows[i]);
}

/* ── Columns ── */

export interface RequestColumnSize {
  id: string;
  /** Fixed width in px, for a column with no `flex`. Default 80. */
  width?: number;
  /** Smallest width in px, also the floor for a resize. Default 40. */
  minWidth?: number;
  /** Largest width a resize can reach, in px. */
  maxWidth?: number;
  /** Share of the spare width, like `fr`. Without it the column keeps `width`. */
  flex?: number;
  /** Hidden when the table is narrower than this, in px. */
  hideBelow?: number;
}

const COLUMN_MIN = 40;

export function clampColumnWidth(column: RequestColumnSize, width: number): number {
  return Math.round(Math.max(column.minWidth ?? COLUMN_MIN, Math.min(column.maxWidth ?? Infinity, width)));
}

/** The CSS grid for the columns, and the width under which the table scrolls sideways. A column dragged to a width keeps
 *  it; the others share what's left; and if every column has a fixed width, an empty track takes the rest. */
export function columnTemplate(columns: readonly RequestColumnSize[], widths: Readonly<Record<string, number>>): { template: string; minWidth: number } {
  let minWidth = 0;
  let flexible = false;
  const tracks = columns.map((column) => {
    const set = widths[column.id];
    if (set !== undefined) {
      minWidth += set;
      return `${set}px`;
    }
    if (column.flex) {
      const least = column.minWidth ?? COLUMN_MIN;
      minWidth += least;
      flexible = true;
      return `minmax(${least}px,${column.flex}fr)`;
    }
    const width = column.width ?? 80;
    minWidth += width;
    return `${width}px`;
  });
  if (!flexible) tracks.push('minmax(0,1fr)');
  return { template: tracks.join(' '), minWidth };
}

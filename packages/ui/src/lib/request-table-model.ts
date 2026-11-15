import { formatFileSize } from '@/lib/file-size';
import type { DataTableSortValue, DataTableTimeRange } from '@/lib/data-table-model';
import type { RowId } from '@/lib/log-list-model';
import { formatDuration } from '@/lib/sql-format';

/* ══ RequestTable's pure logic ══
   What a row says (status, duration, size, its name from its URL), where its bar goes on the shared time range, and
   what each built-in column sorts by. How rows sort and how columns turn into a CSS grid is DataTable's
   (lib/data-table-model). No React and no DOM. */

/** A bar's meaning, on the kit's one tone set: `default` is the primary color, `muted` a quiet gray. A color of your own
 *  (a category: scripts, fonts, IPC) is a row's `tint`. */
export type RequestTone = 'default' | 'muted' | 'success' | 'warning' | 'destructive';

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
  /** The bar's tone. Default: `destructive` if it failed, else `default`. */
  tone?: RequestTone;
  /** The bar's color, any CSS color (`var(--chart-5)`), for a category of your own: wins over `tone`. */
  tint?: string;
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

/** DevTools' Size column: "280 B", "1.7 kB" (the kit's formatFileSize). */
export function requestSizeText(row: Pick<RequestRow, 'size'>): string {
  if (row.size === undefined) return '—';
  return formatFileSize(row.size);
}

export function requestTone(row: Pick<RequestRow, 'tone' | 'failed' | 'status' | 'pending'>): RequestTone {
  return row.tone ?? (isRequestFailed(row) ? 'destructive' : 'default');
}

/* ── The waterfall ── */

/** From the first request sent to the last answer. Never empty, so a bar's share of it is always a number. */
export function requestTimeRange(rows: readonly Pick<RequestRow, 'time' | 'duration'>[]): DataTableTimeRange {
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
export function requestBar(row: Pick<RequestRow, 'time' | 'duration' | 'pending'>, [start, end]: DataTableTimeRange): { left: number; width: number } | null {
  if (row.time === undefined) return null;
  const span = end - start;
  const stop = row.duration === undefined && row.pending ? end : row.time + (row.duration ?? 0);
  if (span <= 0 || stop < start || row.time > end) return null;
  const from = Math.max(row.time, start);
  const to = Math.min(stop, end);
  return { left: ((from - start) / span) * 100, width: ((to - from) / span) * 100 };
}

/* ── Sorting ── */

/** What a built-in column sorts by. */
export function requestSortValue(row: RequestRow, column: string): DataTableSortValue {
  switch (column) {
    case 'name': return requestDisplayName(row);
    case 'url': return row.url;
    case 'method': return row.method;
    case 'status': return row.pending ? undefined : row.status;
    case 'type': return row.type;
    case 'size': return row.size;
    case 'duration': return row.duration;
    case 'waterfall': case 'time': return row.time;
    default: return (row as unknown as Record<string, DataTableSortValue>)[column];
  }
}

import type { ReactNode } from 'react';

/* ══ LogList's pure logic, and what RequestTable shares with it ══
   Levels, a row's text, how a list of rows changed, rows by id, the first row after a time, and how a followed marker
   scrolls. No React and no DOM: `lib/grid-behaviors` and the primitives use these. */

export type RowId = string | number;

/* ── Levels ── */

export type LogLevel = 'log' | 'info' | 'warn' | 'error' | 'debug';

/** Most severe first: the order to show level filters in. */
export const LOG_LEVELS: readonly LogLevel[] = ['error', 'warn', 'info', 'log', 'debug'];

/** A console's level as one of the five: `warning` is `warn`, `assert` is `error`, `trace` is `debug`, and anything
 *  else (`group`, a typo) is `log`. */
export function normalizeLogLevel(level: string | undefined): LogLevel {
  switch (level?.toLowerCase()) {
    case 'warn': case 'warning': return 'warn';
    case 'error': case 'assert': return 'error';
    case 'info': return 'info';
    case 'debug': case 'trace': return 'debug';
    default: return 'log';
  }
}

export interface LogRow {
  id: RowId;
  /** `log` (default), `info`, `warn`, `error` or `debug`; other console names are mapped by `normalizeLogLevel`. */
  level?: LogLevel | (string & {});
  /** When it was logged, in ms from the start. Rows without one belong with the row before them. */
  time?: number;
  /** Where it came from, like `app.js:42`. */
  source?: ReactNode;
  /** A string, or any node for rich values. Nodes must keep their state outside: a row unmounts when it scrolls away. */
  message: ReactNode;
  /** How many times it repeated, shown as a badge above 1. */
  count?: number;
  /** The row as plain text, for copying. Without one the text is read out of `message`. */
  text?: string;
  /** More to show when the row is expanded, like a stack trace. */
  detail?: ReactNode;
}

export type LogLevelCounts = Record<LogLevel | 'total', number>;

/** How many rows there are of each level. */
export function countLogLevels(rows: readonly Pick<LogRow, 'level'>[]): LogLevelCounts {
  const counts: LogLevelCounts = { total: rows.length, error: 0, warn: 0, info: 0, log: 0, debug: 0 };
  for (const row of rows) counts[normalizeLogLevel(row.level)]++;
  return counts;
}

/* ── Text ── */

/** `m:ss.mmm`, or `h:mm:ss.mmm` from an hour up. */
export function formatLogTime(ms: number): string {
  if (!Number.isFinite(ms)) return '';
  const sign = ms < 0 ? '-' : '';
  const total = Math.round(Math.abs(ms));
  const millis = total % 1000;
  const seconds = Math.floor(total / 1000) % 60;
  const minutes = Math.floor(total / 60000) % 60;
  const hours = Math.floor(total / 3600000);
  const tail = `${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
  return hours ? `${sign}${hours}:${String(minutes).padStart(2, '0')}:${tail}` : `${sign}${minutes}:${tail}`;
}

/** The text in a node: strings and numbers, through elements' children. A value drawn by a component with no text
 *  children has none, which is what a row's `text` is for. */
export function nodeText(node: ReactNode): string {
  if (typeof node === 'string') return node;
  if (typeof node === 'number' || typeof node === 'bigint') return String(node);
  if (!node || typeof node !== 'object') return '';
  if (Array.isArray(node)) return node.map(nodeText).join('');
  if ('props' in node) return nodeText((node.props as { children?: ReactNode }).children);
  return '';
}

/** A row as one piece of text: `0:01.204 [warn] The message (app.js:42)`, then its detail on the lines after. */
export function logRowText(row: LogRow, formatTime: (ms: number) => string = formatLogTime): string {
  const time = row.time === undefined ? '' : `${formatTime(row.time)} `;
  const source = nodeText(row.source);
  const detail = row.detail == null ? '' : `\n${nodeText(row.detail)}`;
  return `${time}[${normalizeLogLevel(row.level)}] ${row.text ?? nodeText(row.message)}${source ? ` (${source})` : ''}${detail}`;
}

/* ── How a list changed ── */

export type RowsChange = 'same' | 'append' | 'truncate' | 'replace';

/** What a new `rows` did, read from its ends in O(1): a log growing or being cut back keeps what was measured, and
 *  anything else (a filter, a sort) starts over. Compares ids, as a host can rebuild its row objects on every tick. */
export function rowsChange(prev: readonly { id: RowId }[], next: readonly { id: RowId }[]): RowsChange {
  if (prev === next) return 'same';
  if (!prev.length) return next.length ? 'append' : 'same';
  if (!next.length) return 'truncate';
  const shared = Math.min(prev.length, next.length);
  if (prev[0].id !== next[0].id || prev[shared - 1].id !== next[shared - 1].id) return 'replace';
  if (next.length > prev.length) return 'append';
  return next.length < prev.length ? 'truncate' : 'same';
}

/** A row's index by id. It reads no further than it has to, and an appended list carries on from where it got to, so a
 *  log growing under a selection doesn't rebuild a map of 100,000 ids. */
export class RowIdIndex {
  private rows: readonly { id: RowId }[] = [];
  private map = new Map<RowId, number>();
  private built = 0;

  update(rows: readonly { id: RowId }[], change: RowsChange): void {
    if (change === 'replace') {
      this.map.clear();
      this.built = 0;
    } else if (change === 'truncate') {
      this.built = Math.min(this.built, rows.length);
    }
    this.rows = rows;
  }

  /** The row's index, or -1. */
  indexOf(id: RowId): number {
    const known = this.map.get(id);
    if (known !== undefined && this.rows[known]?.id === id) return known;
    while (this.built < this.rows.length) {
      const at = this.built++;
      const rowId = this.rows[at].id;
      this.map.set(rowId, at);
      if (rowId === id) return at;
    }
    return -1;
  }
}

/* ── The position marker ── */

/** Finds the first row after a time, on a running maximum of the rows' times: it's sorted whatever order the rows are
 *  in, so a late row among earlier ones, or a row with no time, can't throw off the binary search. */
export class RowTimes {
  private rows: readonly { time?: number }[] = [];
  private peaks = new Float64Array(0);
  private built = 0;

  update(rows: readonly { time?: number }[], change: RowsChange): void {
    if (change === 'replace') this.built = 0;
    else if (change === 'truncate') this.built = Math.min(this.built, rows.length);
    if (rows.length > this.peaks.length) {
      const peaks = new Float64Array(Math.max(rows.length, this.peaks.length * 2));
      peaks.set(this.peaks.subarray(0, this.built));
      this.peaks = peaks;
    }
    this.rows = rows;
  }

  /** The first row logged after `time`, or the row count when none was. */
  firstAfter(time: number): number {
    const { rows, peaks } = this;
    let peak = this.built ? peaks[this.built - 1] : -Infinity;
    for (let i = this.built; i < rows.length; i++) {
      const t = rows[i].time;
      if (t !== undefined && t > peak) peak = t;
      peaks[i] = peak;
    }
    this.built = rows.length;
    let lo = 0;
    let hi = rows.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (peaks[mid] > time) hi = mid;
      else lo = mid + 1;
    }
    return lo;
  }
}

export interface FollowInput {
  /** Where the marker is, from the top of the rows. */
  y: number;
  /** The scroll position. */
  top: number;
  /** How much of the rows can be seen. */
  view: number;
  /** The height of all the rows. */
  total: number;
  /** How far in from each edge the marker is kept, as a share of the view. */
  band?: number;
}

/** Where to scroll to keep a marker in view. It doesn't scroll while the marker is inside the band; just past it, it
 *  moves only as far as it must, so the marker rides the edge of the band and rows go by it; and when the marker has
 *  gone somewhere out of sight, a seek, it centers it. */
export function followTop({ y, top, view, total, band = 0.15 }: FollowInput): number {
  const pad = view * band;
  if (y >= top + pad && y <= top + view - pad) return top;
  const next = y < top - view || y > top + 2 * view ? y - view / 2 : y < top + pad ? y - pad : y - view + pad;
  return Math.max(0, Math.min(Math.max(0, total - view), next));
}

import type { ReactNode } from 'react';

/* ══ LogList's pure logic, and what RequestTable shares with it ══
   Row heights in a Fenwick tree (a row's offset and the row at an offset, both O(log n), so 100,000 measured rows cost
   nothing to scroll), the first row after a time, which rows to mount, how a followed marker scrolls, and the text of a
   row. No React and no DOM: `lib/log-list-window` drives these from a scroller. */

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

/* ── Row heights ── */

/** Every row's height, measured or estimated, in a Fenwick tree over a typed array. Reading a row's offset, finding the
 *  row at an offset and changing a height are O(log n); so 100,000 rows have no per-row object, and a measurement
 *  doesn't walk the rows above it. Heights of 0 aren't stored: `set` ignores them (a hidden row has no height to learn). */
export class RowHeights {
  count = 0;
  estimate: number;
  private capacity = 0;
  private tree = new Float64Array(1);
  private values = new Float32Array(0);
  private known = new Uint8Array(0);
  private knownSum = 0;
  private knownCount = 0;
  private sum = 0;
  private top = 1;

  constructor(count = 0, estimate = 24) {
    this.estimate = estimate;
    this.reset(count);
  }

  /** Forgets every measurement: all rows are `estimate` tall. */
  reset(count: number, estimate = this.estimate): void {
    this.estimate = estimate;
    this.allocate(Math.max(count, this.capacity >= count && this.capacity <= count * 4 ? this.capacity : count));
    this.values.fill(0);
    this.values.fill(estimate, 0, count);
    this.known.fill(0);
    this.knownSum = 0;
    this.knownCount = 0;
    this.count = count;
    this.rebuild();
  }

  /** A longer or shorter list with the same first rows: what's measured stays, new rows are `estimate` tall. */
  resize(count: number): void {
    if (count === this.count) return;
    if (count > this.capacity) {
      const values = this.values;
      const known = this.known;
      this.allocate(Math.max(count, this.capacity * 2));
      this.values.set(values);
      this.known.set(known);
      this.values.fill(this.estimate, this.count, count);
      this.count = count;
      this.rebuild();
      return;
    }
    // A log gaining or losing a few rows shouldn't touch all the others.
    const few = Math.abs(count - this.count) * 32 < this.capacity;
    for (let i = count; i < this.count; i++) {
      if (this.known[i]) { this.knownSum -= this.values[i]; this.knownCount--; this.known[i] = 0; }
      if (few) this.add(i, -this.values[i]);
      this.values[i] = 0;
    }
    for (let i = this.count; i < count; i++) {
      this.values[i] = this.estimate;
      if (few) this.add(i, this.values[i]);
    }
    this.count = count;
    if (!few) this.rebuild();
  }

  /** The new estimate for every row not measured yet. O(n), so only when the estimate was well off. */
  rebase(estimate: number): void {
    this.estimate = estimate;
    for (let i = 0; i < this.count; i++) if (!this.known[i]) this.values[i] = estimate;
    this.rebuild();
  }

  /** The average of what's been measured, or the estimate before anything has. */
  get average(): number {
    return this.knownCount ? this.knownSum / this.knownCount : this.estimate;
  }

  get measured(): number {
    return this.knownCount;
  }

  /** The height of all the rows. */
  get total(): number {
    return this.sum;
  }

  get(index: number): number {
    return this.values[index] ?? 0;
  }

  isMeasured(index: number): boolean {
    return !!this.known[index];
  }

  /** Records a row's real height. Returns whether anything changed. */
  set(index: number, height: number): boolean {
    if (index < 0 || index >= this.count || height <= 0) return false;
    const before = this.values[index];
    if (this.known[index]) this.knownSum -= before;
    else { this.known[index] = 1; this.knownCount++; }
    this.knownSum += height;
    if (before === height) return false;
    this.values[index] = height;
    // Float32Array rounds, so the delta is taken from what was really stored.
    this.add(index, this.values[index] - before);
    return true;
  }

  /** The top of a row: the height of the rows before it. `offsetOf(count)` is the total. */
  offsetOf(index: number): number {
    let sum = 0;
    for (let i = Math.min(index, this.count); i > 0; i -= i & -i) sum += this.tree[i];
    return sum;
  }

  /** The row at an offset: the last whose top is at or above it, within 0…count-1 (0 when there are none). */
  indexAt(offset: number): number {
    if (offset <= 0 || !this.count) return 0;
    let at = 0;
    let rest = offset;
    for (let bit = this.top; bit > 0; bit >>= 1) {
      const next = at + bit;
      if (next <= this.capacity && this.tree[next] <= rest) {
        at = next;
        rest -= this.tree[next];
      }
    }
    return Math.min(at, this.count - 1);
  }

  private add(index: number, delta: number): void {
    this.sum += delta;
    for (let i = index + 1; i <= this.capacity; i += i & -i) this.tree[i] += delta;
  }

  private allocate(capacity: number): void {
    if (capacity === this.capacity && this.values.length) return;
    this.capacity = capacity;
    this.values = new Float32Array(capacity);
    this.known = new Uint8Array(capacity);
    this.tree = new Float64Array(capacity + 1);
    let top = 1;
    while (top * 2 <= capacity) top *= 2;
    this.top = top;
  }

  private rebuild(): void {
    const { tree, values, capacity } = this;
    tree.fill(0);
    let sum = 0;
    for (let i = 1; i <= capacity; i++) {
      sum += values[i - 1];
      tree[i] += values[i - 1];
      const parent = i + (i & -i);
      if (parent <= capacity) tree[parent] += tree[i];
    }
    this.sum = sum;
  }
}

/* ── Which rows to mount ── */

export interface RowRange {
  start: number;
  /** One past the last. */
  end: number;
}

/** The rows that touch the view from `top` for `view` px, with `overscan` px more on each side. */
export function rowRange(heights: RowHeights, top: number, view: number, overscan: number): RowRange {
  if (!heights.count) return { start: 0, end: 0 };
  return {
    start: heights.indexAt(top - overscan),
    end: Math.min(heights.count, heights.indexAt(top + view + overscan) + 1),
  };
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

/* ── Keyboard ── */

/** The row a navigation key moves to from `index` (-1 when none is active yet), or null for any other key.
 *  `page` is the row a viewport further on in that direction. */
export function rowKeyTarget(key: string, index: number, count: number, page: (direction: 1 | -1) => number): number | null {
  if (!count) return null;
  const last = count - 1;
  switch (key) {
    case 'ArrowDown': return Math.min(last, index + 1);
    case 'ArrowUp': return index < 0 ? 0 : Math.max(0, index - 1);
    case 'Home': return 0;
    case 'End': return last;
    case 'PageDown': return Math.min(last, Math.max(index + 1, page(1)));
    case 'PageUp': return Math.max(0, Math.min(index < 0 ? 0 : index - 1, page(-1)));
    default: return null;
  }
}

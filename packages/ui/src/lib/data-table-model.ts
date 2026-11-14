/* ══ DataTable's pure logic ══
   How rows sort, how columns turn into a CSS grid, and where a time falls on a range. No React and no DOM: the
   data-table primitive and its presets (RequestTable, the SQL console's results) use it, and a host can too. */

/* ── Sorting ── */

export type DataTableSortDirection = 'ascending' | 'descending';

export interface DataTableSort {
  /** The id of the column the rows are sorted by. */
  column: string;
  direction: DataTableSortDirection;
}

/** What a column sorts by: a number, a string, or nothing (rows with nothing stay at the end). */
export type DataTableSortValue = number | string | null | undefined;

/** The next sort when a column is pressed: ascending, descending, then back to the rows' own order. */
export function nextDataTableSort(sort: DataTableSort | null, column: string): DataTableSort | null {
  if (sort?.column !== column) return { column, direction: 'ascending' };
  return sort.direction === 'ascending' ? { column, direction: 'descending' } : null;
}

const missing = (value: DataTableSortValue) => value === undefined || value === null || value === '' || (typeof value === 'number' && Number.isNaN(value));

/** The rows in a column's order, a new array. It's stable, ties keep the rows' own order, and rows with nothing in the
 *  column stay at the end in both directions. Strings compare case-insensitively by code unit, not by locale, which is
 *  ten times faster at 10,000 rows and right for URLs, ids and methods. */
export function sortDataTableRows<T>(rows: readonly T[], sort: DataTableSort | null, valueOf: (row: T, column: string) => DataTableSortValue): readonly T[] {
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

/** A row's field of a column's name, as something to sort by: numbers and strings as they are, a date by its time,
 *  a boolean as 0 or 1, anything else as nothing. */
export function fieldSortValue(row: unknown, column: string): DataTableSortValue {
  const value = (row as Record<string, unknown> | null | undefined)?.[column];
  if (typeof value === 'number' || typeof value === 'string') return value;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (value instanceof Date) return value.getTime();
  return undefined;
}

/* ── Columns ── */

export interface DataTableColumnSize {
  id: string;
  /** Fixed width in px, for a column with no `flex`. Default 80. */
  width?: number;
  /** Smallest width in px, also the floor for a resize. Default 40. */
  minWidth?: number;
  /** Largest width a resize can reach, in px. */
  maxWidth?: number;
  /** Share of the spare width, like `fr`. Without it the column keeps `width`. */
  flex?: number;
  /** Hidden while the table's own size class is below this one: `'regular'` leaves the column out of a medium or
   *  compact table. */
  hideBelow?: 'medium' | 'regular';
}

const COLUMN_MIN = 40;

export function clampColumnWidth(column: DataTableColumnSize, width: number): number {
  return Math.round(Math.max(column.minWidth ?? COLUMN_MIN, Math.min(column.maxWidth ?? Infinity, width)));
}

/** The CSS grid for the columns, and the width under which the table scrolls sideways. A column dragged to a width keeps
 *  it; the others share what's left; and if every column has a fixed width, an empty track takes the rest. */
export function columnTemplate(columns: readonly DataTableColumnSize[], widths: Readonly<Record<string, number>>): { template: string; minWidth: number } {
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

/* ── Time ── */

/** A span of time, in ms: where the playhead can be, and what a timeline column draws. */
export type DataTableTimeRange = readonly [start: number, end: number];

/** A time's place on a range, 0…1, or null when it isn't on it. */
export function timeShare(time: number | null | undefined, [start, end]: DataTableTimeRange): number | null {
  if (time === null || time === undefined || !Number.isFinite(time) || time < start || time > end || end <= start) return null;
  return (time - start) / (end - start);
}

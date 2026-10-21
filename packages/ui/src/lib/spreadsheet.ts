/* The data side of Spreadsheet, with no UI: column types, reading a cell as a number, the exact sort keys and the
   CPU sort, selection statistics and column histograms. The WebGPU versions of the sort and the histogram live in
   lib/spreadsheet-gpu and give the same answers; `sortRows` and `columnHistogram` choose between the two.

   Cells are strings, as in the CSV they came from: nothing is reformatted. A column is `number` or `date` when every
   value in it that isn't empty reads as one (checked on a sample of the first values), else `text`. */

import { gpuHistogram, gpuSortPermutation, gpuSortLimit, resetSpreadsheetGpu } from '@/lib/spreadsheet-gpu';
import { navigatorGpu, probeWebGPU, webgpuProbeResult } from '@/lib/webgpu';

export type SpreadsheetColumnType = 'number' | 'date' | 'text' | 'empty';
export type SpreadsheetSortDirection = 'ascending' | 'descending';
export interface SpreadsheetSort {
  column: number;
  direction: SpreadsheetSortDirection;
}

/** Where the sort and histograms run. `auto` (default): WebGPU on a hardware adapter for work of at least
    `gpuMinRows` rows, the CPU otherwise (and where the only adapter is a software one, there is none, or the probe
    times out). `gpu`: WebGPU whenever there is any adapter, whatever the size. `fallback`: always the CPU. */
export type SpreadsheetEngine = 'auto' | 'gpu' | 'fallback';
/** Which one answered. */
export type SpreadsheetRanOn = 'gpu' | 'cpu';

/** Below this many rows, `auto` stays on the CPU: an upload, dispatch and readback cost more than they save. */
export const GPU_MIN_ROWS = 20_000;

/* ── Reading cells ── */

const NUMBER = /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[-+]?\d+)?$/i;
const GROUPED = /^[-+]?\d{1,3}(?:,\d{3})+(?:\.\d*)?$/;
const CURRENCY = /^[$€£¥₹]/;

/** A cell as a number: plain and scientific notation, thousands commas ("1,234.5"), a leading currency sign, a
    trailing `%` (as a fraction: "12%" → 0.12) and accounting negatives ("(12)"). `NaN` for anything else, empty
    included. */
export function parseCellNumber(cell: string): number {
  let s = cell.trim();
  if (!s) return NaN;
  let sign = 1;
  if (s[0] === '(' && s[s.length - 1] === ')') { sign = -1; s = s.slice(1, -1).trim(); }
  if (s[0] === '-' && CURRENCY.test(s.slice(1))) { sign = -sign; s = s.slice(1); }
  if (CURRENCY.test(s)) s = s.slice(1).trim();
  let scale = 1;
  if (s.endsWith('%')) { scale = 0.01; s = s.slice(0, -1).trim(); }
  if (GROUPED.test(s)) s = s.replaceAll(',', '');
  if (!NUMBER.test(s)) return NaN;
  return sign * Number(s) * scale;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

/** An ISO 8601 date or date-time ("2026-10-21", "2026-10-21T09:30Z") as milliseconds since the epoch, else `NaN`. */
export function parseCellDate(cell: string): number {
  const s = cell.trim();
  return ISO_DATE.test(s) ? Date.parse(s.length === 10 ? `${s}T00:00:00Z` : s.replace(' ', 'T')) : NaN;
}

/** How many of a column's first non-empty values decide its type. */
const TYPE_SAMPLE = 1000;

/** `number` or `date` when every sampled non-empty value reads as one, `empty` when there are none, else `text`. */
export function inferColumnType(rows: readonly (readonly string[])[], column: number, from = 0): SpreadsheetColumnType {
  let seen = 0;
  let numbers = 0;
  let dates = 0;
  for (let r = from; r < rows.length && seen < TYPE_SAMPLE; r++) {
    const cell = rows[r][column];
    if (!cell || !cell.trim()) continue;
    seen++;
    if (!Number.isNaN(parseCellNumber(cell))) numbers++;
    else if (!Number.isNaN(parseCellDate(cell))) dates++;
    else return 'text';
  }
  if (!seen) return 'empty';
  return numbers === seen ? 'number' : dates === seen ? 'date' : 'text';
}

/** A column read as numbers (dates as milliseconds): `NaN` where a cell is empty or doesn't read. */
export function columnNumbers(rows: readonly (readonly string[])[], column: number, from = 0, type: SpreadsheetColumnType = 'number'): Float64Array {
  const out = new Float64Array(Math.max(0, rows.length - from));
  for (let r = from; r < rows.length; r++) {
    const cell = rows[r][column] ?? '';
    let v = parseCellNumber(cell);
    if (type === 'date' && Number.isNaN(v)) v = parseCellDate(cell);
    out[r - from] = v;
  }
  return out;
}

/* ── Sorting ── */

/** Exact sort keys: each value's 64 bits as two unsigned words, in an order-preserving encoding (a positive number
    has its sign bit flipped, a negative one all its bits), so comparing (high, low) as unsigned integers orders the
    doubles exactly — no rounding to 32-bit floats. Descending inverts the words. A missing value (`NaN`) gets the
    largest key in either direction, so empty cells always sort last. */
export function sortKeys(values: Float64Array, direction: SpreadsheetSortDirection = 'ascending'): Uint32Array {
  const n = values.length;
  const keys = new Uint32Array(n * 2);
  const view = new DataView(new ArrayBuffer(8));
  const flip = direction === 'descending';
  for (let i = 0; i < n; i++) {
    const v = values[i];
    if (Number.isNaN(v)) { keys[2 * i] = 0xffffffff; keys[2 * i + 1] = 0xffffffff; continue; }
    view.setFloat64(0, v === 0 ? 0 : v); // -0 and 0 are the same key
    let hi = view.getUint32(0);
    let lo = view.getUint32(4);
    if (hi & 0x80000000) { hi = ~hi >>> 0; lo = ~lo >>> 0; } else hi = (hi | 0x80000000) >>> 0;
    if (flip) { hi = ~hi >>> 0; lo = ~lo >>> 0; }
    keys[2 * i] = hi;
    keys[2 * i + 1] = lo;
  }
  return keys;
}

/** The permutation that sorts `keys` (pairs from `sortKeys`), ties kept in their original order. The CPU half of
    the GPU's bitonic sort: both return the same array. */
export function sortPermutationCpu(keys: Uint32Array): Uint32Array {
  const n = keys.length / 2;
  const order = new Uint32Array(n);
  for (let i = 0; i < n; i++) order[i] = i;
  return order.sort((a, b) => keys[2 * a] - keys[2 * b] || keys[2 * a + 1] - keys[2 * b + 1] || a - b);
}

const collator = typeof Intl !== 'undefined' ? new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' }) : null;

/** Text order: natural ("file 2" before "file 10"), case- and accent-insensitive, empty cells last, ties stable. */
export function sortTextPermutation(rows: readonly (readonly string[])[], column: number, from = 0, direction: SpreadsheetSortDirection = 'ascending'): Uint32Array {
  const n = Math.max(0, rows.length - from);
  const order = new Uint32Array(n);
  for (let i = 0; i < n; i++) order[i] = i;
  const sign = direction === 'descending' ? -1 : 1;
  const cell = (i: number) => rows[i + from][column] ?? '';
  return order.sort((a, b) => {
    const x = cell(a);
    const y = cell(b);
    if (!x !== !y) return x ? -1 : 1;
    return (collator ? collator.compare(x, y) : x < y ? -1 : x > y ? 1 : 0) * sign || a - b;
  });
}

export interface SpreadsheetSortResult {
  /** Row indexes (counted from `from`) in display order. */
  order: Uint32Array;
  ranOn: SpreadsheetRanOn;
  /** Wall-clock time of the sort itself, including GPU upload and readback. */
  ms: number;
}

export interface SpreadsheetEngineOptions {
  engine?: SpreadsheetEngine;
  /** `auto` uses the GPU from this many rows (default `GPU_MIN_ROWS`). */
  gpuMinRows?: number;
}

/** Whether this work should go to the GPU. Waits for the one-time adapter probe. */
async function gpuFits(rows: number, { engine = 'auto', gpuMinRows = GPU_MIN_ROWS }: SpreadsheetEngineOptions): Promise<boolean> {
  if (engine === 'fallback' || !navigatorGpu()) return false;
  if (engine === 'auto' && rows < gpuMinRows) return false;
  const probe = webgpuProbeResult() ?? (await probeWebGPU());
  return probe === 'hardware' || (engine === 'gpu' && probe === 'software');
}

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/** The display order for `sort`: number and date columns by their exact keys (on the GPU when the engine allows),
    text columns by natural text order on the CPU. A GPU failure falls back to the CPU and says so in `ranOn`. */
export async function sortRows(
  rows: readonly (readonly string[])[], sort: SpreadsheetSort, { from = 0, type, ...options }: SpreadsheetEngineOptions & { from?: number; type?: SpreadsheetColumnType } = {},
): Promise<SpreadsheetSortResult> {
  const start = now();
  const kind = type ?? inferColumnType(rows, sort.column, from);
  if (kind !== 'number' && kind !== 'date') {
    return { order: sortTextPermutation(rows, sort.column, from, sort.direction), ranOn: 'cpu', ms: now() - start };
  }
  const keys = sortKeys(columnNumbers(rows, sort.column, from, kind), sort.direction);
  const n = keys.length / 2;
  if (n <= gpuSortLimit() && (await gpuFits(n, options))) {
    try {
      const order = await gpuSortPermutation(keys);
      return { order, ranOn: 'gpu', ms: now() - start };
    } catch {
      resetSpreadsheetGpu();
    }
  }
  return { order: sortPermutationCpu(keys), ranOn: 'cpu', ms: now() - start };
}

/* ── Statistics ── */

export interface SelectionStats {
  /** Cells that aren't empty. */
  count: number;
  /** Cells that read as numbers. */
  numbers: number;
  sum: number;
  average: number;
  min: number;
  max: number;
}

/** Count, and sum / average / min / max of the cells that read as numbers (in 64-bit floats, so they are exact
    to the usual double precision). */
export function selectionStats(cells: Iterable<string>): SelectionStats {
  let count = 0;
  let numbers = 0;
  let sum = 0;
  let min = Infinity;
  let max = -Infinity;
  for (const cell of cells) {
    if (!cell || !cell.trim()) continue;
    count++;
    const v = parseCellNumber(cell);
    if (Number.isNaN(v)) continue;
    numbers++;
    sum += v;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return { count, numbers, sum, average: numbers ? sum / numbers : NaN, min: numbers ? min : NaN, max: numbers ? max : NaN };
}

/** Most bins a histogram has (the GPU kernel's workgroup tally holds this many). */
export const MAX_BINS = 64;

export interface SpreadsheetHistogram {
  /** Values per bin, lowest first. */
  bins: Uint32Array;
  min: number;
  max: number;
  ranOn: SpreadsheetRanOn;
}

/** The finite values of a column as 32-bit floats, and their exact range. */
function finite(values: Float64Array) {
  let n = 0;
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (!Number.isFinite(v)) continue;
    n++;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const out = new Float32Array(n);
  for (let i = 0, j = 0; i < values.length; i++) if (Number.isFinite(values[i])) out[j++] = values[i];
  return { values: out, min, max };
}

/** The scale that maps [min, max] onto `bins` equal bins (0 when every value is the same). Shared by both paths. */
export const binScale = (min: number, max: number, bins: number) => (max > min ? Math.fround(bins / Math.fround(Math.fround(max) - Math.fround(min))) : 0);

/** The bin of each value, in the same 32-bit float steps the GPU kernel takes. */
export function histogramCpu(values: Float32Array, min: number, max: number, bins: number): Uint32Array {
  const out = new Uint32Array(bins);
  const fmin = Math.fround(min);
  const scale = binScale(min, max, bins);
  for (let i = 0; i < values.length; i++) {
    const b = Math.floor(Math.fround(Math.fround(values[i] - fmin) * scale));
    out[b < 0 ? 0 : b >= bins ? bins - 1 : b]++;
  }
  return out;
}

/** A histogram of a column's numbers in `bins` equal-width bins (at most `MAX_BINS`), on the GPU when the engine
    allows. `null` when the column has no numbers. Bin edges are computed in 32-bit floats on both paths. */
export async function columnHistogram(values: Float64Array, bins = 16, options: SpreadsheetEngineOptions = {}): Promise<SpreadsheetHistogram | null> {
  const count = Math.min(Math.max(1, Math.floor(bins)), MAX_BINS);
  const { values: data, min, max } = finite(values);
  if (!data.length) return null;
  if (await gpuFits(data.length, options)) {
    try {
      return { bins: await gpuHistogram(data, Math.fround(min), binScale(min, max, count), count), min, max, ranOn: 'gpu' };
    } catch {
      resetSpreadsheetGpu();
    }
  }
  return { bins: histogramCpu(data, min, max, count), min, max, ranOn: 'cpu' };
}

/* ══ Trace timeline — the math behind TraceTimeline ══
   A long session on one clock: how a time becomes a fraction of the timeline and back (an axis), which marks fall in
   which device pixel (pooled by binary search over sorted arrays, so the cost follows the pixels and not the marks),
   which landmarks fit on a rail (stops and clusters), how a scrub slows as the pointer pulls away, and where the ruler's
   ticks go. Plain data in, plain data out: no DOM and no React, so all of it is tested here. lib/trace-timeline-draw puts
   it on a canvas and components/trace-timeline handles the gestures.

   Times are numbers on the shared clock, in milliseconds as far as formatting and ruler ticks are concerned. A lane's
   own data stays in its own time, and its `offset` puts it on the shared clock. ══ */
import type { ReactNode } from 'react';

/* ── Data ── */

export interface TraceRange {
  start: number;
  end: number;
}

/** A stretch of the axis, as fractions of its whole length (0…1). */
export interface TraceWindow {
  from: number;
  to: number;
}

/** Turns a time into a fraction of the timeline's length and back. Both are clamped to the axis. */
export interface TraceAxis {
  fraction(time: number): number;
  timeAt(fraction: number): number;
  /** Equal fractions are equal times, so the ruler can land on round times. Without it ticks are evenly spaced and show
   *  whatever time they land on. */
  uniform?: boolean;
}

export type TraceTone = 'default' | 'info' | 'success' | 'warning' | 'error';
export type TraceKey = string | number;

/** A landmark on the timeline: an `IndexBarItem` plus a time and a tone. */
export interface TraceStop<K extends TraceKey = TraceKey> {
  key?: K;
  time: number;
  label?: string;
  caption?: string | null;
  preview?: ReactNode;
  /** Colours the dash. A cluster wears its most severe member's. */
  tone?: TraceTone;
  /** 1 (default) and up: lower levels win the room when there's too little, and level 2 and up get a shorter dash. */
  level?: number;
  /** Preview card: something at the end of the title line (a badge, a glyph). */
  trailing?: ReactNode;
  dim?: boolean;
}

/** A row of diamonds, each with a faint guide down the rest of the timeline. `times` are sorted. */
export interface TraceDiamonds {
  label?: string;
  times: ArrayLike<number>;
  /** Any CSS colour. Default: the warning token. */
  color?: string;
}

/** Per pixel, how much happened (opacity) and how deep it went (reach across the row). `times` are sorted, and `depths`
 *  runs parallel to them. */
export interface TraceDensity {
  label?: string;
  times: ArrayLike<number>;
  depths?: ArrayLike<number>;
  /** Any CSS colour. Default: the lane's. */
  color?: string;
}

/** Marks drawn over a lane's density row. `bar` runs the full height of the row, `dot` sits along its far edge. */
export interface TraceMarkSeries {
  key: string;
  label?: string;
  /** Sorted is cheapest, but unsorted is fine: a sorted copy is made once and kept. */
  times: ArrayLike<number>;
  shape?: 'bar' | 'dot';
  tone?: TraceTone;
  /** Any CSS colour; wins over `tone`. */
  color?: string;
}

export interface TraceThread {
  id: TraceKey;
  label?: string;
  /** Any CSS colour. Default: one of the chart tokens, by id. */
  color?: string;
}

export interface TraceLane {
  key: string;
  /** Shown as a row above the lane when there are several lanes. */
  title?: string;
  /** Added to this lane's own times to put them on the shared clock. */
  offset?: number;
  /** Any CSS colour for this lane's density. Default: one of the chart tokens. */
  color?: string;
  diamonds?: TraceDiamonds;
  density?: TraceDensity;
  marks?: TraceMarkSeries[];
  /** A row of activity each, fetched for the current view through `fetchActivity`. */
  threads?: TraceThread[];
}

/** One thread's answer to `fetchActivity`: a count per bucket. */
export interface TraceActivity {
  id: TraceKey;
  counts: ArrayLike<number>;
}

/** On the shared clock: a dot at `time`, a band over `from`…`to` (a range, when that's all that's known), a line between. */
export interface TraceRequest {
  id: TraceKey;
  time: number;
  from?: number;
  to?: number;
  /** Any CSS colour; wins over `tone`. */
  color?: string;
  tone?: TraceTone;
}

/* ── Search ── */

/** The first index whose value is at or after `value`. */
export function lowerBound(sorted: ArrayLike<number>, value: number, lo = 0, hi = sorted.length): number {
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (sorted[mid] < value) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** The first index whose value is after `value`. */
export function upperBound(sorted: ArrayLike<number>, value: number, lo = 0, hi = sorted.length): number {
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (sorted[mid] <= value) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** `lowerBound` from a position known to be at or before the answer, doubling its way forward first: cheap when the
 *  answer is close, and never worse than twice a plain search. */
export function seekForward(sorted: ArrayLike<number>, value: number, from: number): number {
  const n = sorted.length;
  if (from >= n || sorted[from] >= value) return from;
  let step = 1;
  let lo = from;
  let hi = from + 1;
  while (hi < n && sorted[hi] < value) {
    lo = hi;
    step *= 2;
    hi += step;
  }
  return lowerBound(sorted, value, lo + 1, Math.min(n, hi + 1));
}

const SORTED = new WeakMap<object, ArrayLike<number>>();

/** The times themselves when they're already sorted, otherwise a sorted copy. Remembered per array. */
export function sortedTimes(times: ArrayLike<number>): ArrayLike<number> {
  const known = SORTED.get(times as object);
  if (known) return known;
  let sorted = true;
  for (let i = 1; i < times.length; i++) {
    if (times[i] < times[i - 1]) {
      sorted = false;
      break;
    }
  }
  const out = sorted ? times : Float64Array.from(times as ArrayLike<number>).sort();
  SORTED.set(times as object, out);
  return out;
}

/* ── Axes ── */

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Plain time: equal times get equal length. */
export function linearAxis(range: TraceRange): TraceAxis {
  const { start, end } = range;
  const span = end - start;
  if (!(span > 0)) return { uniform: true, fraction: () => 0, timeAt: () => start };
  return {
    uniform: true,
    fraction: (t) => clamp01((t - start) / span),
    timeAt: (f) => (f >= 1 ? end : start + clamp01(f) * span),
  };
}

/** An axis by what happened: each gap between consecutive stops gets an equal share of the length, so stops sit evenly,
 *  bursts open out and idle time closes up, while the timeline stays continuous between them. Stops outside the range
 *  and duplicate times count once at most, so it is strictly increasing. */
export function stopAxis(stops: ReadonlyArray<{ time: number }>, range: TraceRange): TraceAxis {
  const { start, end } = range;
  if (!(end > start)) return linearAxis(range);
  const inside = new Float64Array(stops.length);
  let n = 0;
  for (const s of stops) if (s.time > start && s.time < end) inside[n++] = s.time;
  const sorted = inside.subarray(0, n).sort();
  const anchors = new Float64Array(n + 2);
  let count = 0;
  anchors[count++] = start;
  for (let i = 0; i < n; i++) if (sorted[i] !== anchors[count - 1]) anchors[count++] = sorted[i];
  anchors[count++] = end;
  const gaps = count - 1;
  return {
    fraction(t) {
      if (t <= start) return 0;
      if (t >= end) return 1;
      const i = upperBound(anchors, t, 0, count) - 1;
      return (i + (t - anchors[i]) / (anchors[i + 1] - anchors[i])) / gaps;
    },
    timeAt(f) {
      if (f <= 0) return start;
      if (f >= 1) return end;
      const at = f * gaps;
      const i = Math.min(gaps - 1, Math.floor(at));
      return anchors[i] + (at - i) * (anchors[i + 1] - anchors[i]);
    },
  };
}

/** Where a playhead ends up after `elapsed` of playing: an even rate along the axis, so playing gives room on a
 *  non-linear axis to whatever it gives room to. */
export function advanceAlong(axis: TraceAxis, time: number, elapsed: number, range: TraceRange): number {
  const span = range.end - range.start;
  return span > 0 ? axis.timeAt(axis.fraction(time) + elapsed / span) : time;
}

/* ── The view ── */

/** The smallest stretch of time the view can show (ten nanoseconds, in milliseconds). */
export const TRACE_MIN_SPAN = 1e-5;

/** A view that fits in the range and isn't shorter than `minSpan`. */
export function clampView(view: TraceRange, range: TraceRange, minSpan = TRACE_MIN_SPAN): TraceRange {
  const full = range.end - range.start;
  const span = Math.max(Math.min(minSpan, full), Math.min(view.end - view.start, full));
  const start = clamp(view.start, range.start, range.end - span);
  const end = span >= full ? range.end : start + span;
  return start === view.start && end === view.end ? view : { start, end };
}

export function viewWindow(axis: TraceAxis, view: TraceRange): TraceWindow {
  const from = axis.fraction(view.start);
  const to = axis.fraction(view.end);
  return to > from ? { from, to } : { from: 0, to: 1 };
}

export function windowView(axis: TraceAxis, win: TraceWindow): TraceRange {
  return { start: axis.timeAt(win.from), end: axis.timeAt(win.to) };
}

/** Shifts a window by `delta` of the axis, keeping its length and staying on the axis. */
export function panWindow(win: TraceWindow, delta: number): TraceWindow {
  const span = win.to - win.from;
  const from = clamp(win.from + delta, 0, 1 - span);
  return { from, to: span >= 1 ? 1 : from + span };
}

/** Scales a window by `factor`, keeping what's `anchor` (0…1) of the way along it where it is. */
export function zoomWindow(win: TraceWindow, anchor: number, factor: number): TraceWindow {
  const span = win.to - win.from;
  const next = Math.min(1, span * factor);
  const from = clamp(win.from + anchor * span - anchor * next, 0, 1 - next);
  return { from, to: next >= 1 ? 1 : from + next };
}

/** A pinch: the window from when it started, scaled by how far the fingers have spread, with what was under their
 *  midpoint kept under it. `mid`s are along the timeline, `length` long. */
export function pinchWindow(start: TraceWindow, startSeparation: number, startMid: number, separation: number, mid: number, length: number): TraceWindow {
  const span = start.to - start.from;
  const next = Math.min(1, span * (Math.max(1, startSeparation) / Math.max(1, separation)));
  const anchor = start.from + (startMid / length) * span;
  const from = clamp(anchor - (mid / length) * next, 0, 1 - next);
  return { from, to: next >= 1 ? 1 : from + next };
}

/* ── Ruler ── */

export interface TraceTick {
  /** Px along the plot. */
  along: number;
  time: number;
  /** How far apart the times worth telling apart here are, for the label. */
  resolution: number;
}

const CLOCK_STEPS = [1e3, 2e3, 5e3, 1e4, 15e3, 3e4, 6e4, 12e4, 3e5, 6e5, 9e5, 18e5, 36e5, 72e5, 144e5];

/** The round step at or above `target`: 1, 2 and 5 under a second, then steps a clock would use. */
export function tickStep(target: number): number {
  if (!(target > 0)) return 1;
  if (target >= 1000) {
    for (const step of CLOCK_STEPS) if (step >= target) return step;
    return Math.ceil(target / 36e5) * 36e5;
  }
  const pow = 10 ** Math.floor(Math.log10(target));
  for (const m of [1, 2, 5]) if (m * pow >= target) return m * pow;
  return 10 * pow;
}

/** The ruler for a view: round times at least `minGap` px apart on a uniform axis, otherwise every `evenGap` px. */
export function chooseTicks(axis: TraceAxis, win: TraceWindow, view: TraceRange, length: number, { minGap = 90, evenGap = 110 }: { minGap?: number; evenGap?: number } = {}): TraceTick[] {
  if (!(length > 0)) return [];
  const span = win.to - win.from;
  const ticks: TraceTick[] = [];
  if (axis.uniform) {
    const step = tickStep((view.end - view.start) / Math.max(1, length / minGap));
    const last = Math.floor(view.end / step);
    for (let k = Math.ceil(view.start / step); k <= last; k++) {
      const time = k * step;
      ticks.push({ along: ((axis.fraction(time) - win.from) / span) * length, time, resolution: step });
    }
    return ticks;
  }
  for (let along = 0; along < length; along += evenGap) {
    ticks.push({ along, time: axis.timeAt(win.from + (along / length) * span), resolution: resolutionAt(axis, win, length, along, 40) });
  }
  return ticks;
}

/** How much time `pixels` px cover at a spot along the plot. */
export function resolutionAt(axis: TraceAxis, win: TraceWindow, length: number, along: number, pixels = 1): number {
  if (!(length > 0)) return 1;
  const span = win.to - win.from;
  const at = win.from + (along / length) * span;
  const d = (pixels / length) * span;
  const here = axis.timeAt(at);
  const res = axis.timeAt(at + d) - here || here - axis.timeAt(at - d);
  return res > 0 ? res : TRACE_MIN_SPAN;
}

/** A time at the precision that tells it apart from `resolution` away: `1:02:03` over an hour, `12:34.5` nearer,
 *  `8.25 s`, then `312.5 ms` under a second. */
export function formatTraceTime(ms: number, resolution = 1): string {
  if (!Number.isFinite(ms)) return '—';
  const sign = ms < 0 ? '−' : '';
  const res = resolution > 0 ? resolution : 1;
  // Decimals of a second. Whole units first, so 59.9996 at three digits carries into the minute instead of showing 60.
  const digits = clamp(Math.ceil(3 - Math.log10(res) - 1e-9), 0, 9);
  const scale = 10 ** digits;
  const units = Math.round((Math.abs(ms) / 1000) * scale);
  const whole = Math.floor(units / scale);
  const part = digits ? '.' + String(units - whole * scale).padStart(digits, '0') : '';
  if (res < 1000) {
    if (whole === 0 && res < 100) return `${sign}${((units / scale) * 1000).toFixed(Math.max(0, digits - 3))} ms`;
    if (whole < 60) return `${sign}${whole}${part} s`;
  }
  const h = Math.floor(whole / 3600);
  const m = Math.floor(whole / 60) % 60;
  const s = String(whole % 60).padStart(2, '0');
  return h ? `${sign}${h}:${String(m).padStart(2, '0')}:${s}${part}` : `${sign}${m}:${s}${part}`;
}

/* ── Pooling: at most one thing per device pixel, whatever the number of marks ── */

/** The time at each of `columns + 1` column boundaries across a window. */
export function pixelEdges(axis: TraceAxis, win: TraceWindow, columns: number, reuse?: Float64Array): Float64Array {
  const edges = reuse?.length === columns + 1 ? reuse : new Float64Array(columns + 1);
  const span = win.to - win.from;
  for (let c = 0; c <= columns; c++) edges[c] = axis.timeAt(win.from + (c / columns) * span);
  return edges;
}

/** Answers "the largest value in this slice" without walking it: a max tree over blocks of 16, so an hour of samples
 *  costs an eighth of its length to index, once, and a question costs a few dozen reads at most. */
class DepthIndex {
  readonly deepest: number;
  private readonly tree: Uint16Array;
  private readonly leaves: number;
  private readonly values: ArrayLike<number>;
  constructor(values: ArrayLike<number>) {
    const n = values.length;
    const leaves = Math.max(1, Math.ceil(n / 16));
    const tree = new Uint16Array(leaves * 2);
    for (let i = 0; i < n; i++) {
      const leaf = leaves + (i >> 4);
      const v = values[i] > 65535 ? 65535 : values[i];
      if (v > tree[leaf]) tree[leaf] = v;
    }
    for (let i = leaves - 1; i >= 1; i--) tree[i] = Math.max(tree[i * 2], tree[i * 2 + 1]);
    this.tree = tree;
    this.leaves = leaves;
    this.values = values;
    this.deepest = tree[1];
  }
  /** The largest value in [lo, hi). */
  max(lo: number, hi: number): number {
    const { values, tree, leaves } = this;
    let best = 0;
    const firstBlock = (lo + 15) >> 4;
    const lastBlock = hi >> 4;
    if (firstBlock >= lastBlock) {
      for (let i = lo; i < hi; i++) if (values[i] > best) best = values[i];
      return best;
    }
    for (let i = lo; i < firstBlock << 4; i++) if (values[i] > best) best = values[i];
    for (let i = lastBlock << 4; i < hi; i++) if (values[i] > best) best = values[i];
    for (let l = firstBlock + leaves, r = lastBlock + leaves; l < r; l >>= 1, r >>= 1) {
      if (l & 1 && tree[l] > best) best = tree[l];
      if (l & 1) l++;
      if (r & 1 && tree[r - 1] > best) best = tree[r - 1];
      if (r & 1) r--;
    }
    return best;
  }
}

const DEPTHS = new WeakMap<object, DepthIndex>();
function depthIndexOf(depths: ArrayLike<number>): DepthIndex {
  let index = DEPTHS.get(depths as object);
  if (!index) {
    index = new DepthIndex(depths);
    DEPTHS.set(depths as object, index);
  }
  return index;
}

export interface DensityPool {
  /** How many samples fall in each column. */
  counts: Uint32Array;
  /** The deepest sample in each column. */
  depths: Uint16Array;
  /** The busiest column in this view (at least 1). */
  maxCount: number;
  /** The deepest sample anywhere, so a depth reads the same at every zoom. */
  deepest: number;
}

/** How many samples fall in each column and how deep the deepest one is. A search per column, so it costs the same for
 *  a thousand samples or a hundred million. */
export function poolDensity(density: Pick<TraceDensity, 'times' | 'depths'>, offset: number, edges: Float64Array, reuse?: DensityPool): DensityPool {
  const columns = edges.length - 1;
  const pool = reuse?.counts.length === columns ? reuse : { counts: new Uint32Array(columns), depths: new Uint16Array(columns), maxCount: 1, deepest: 0 };
  const { times, depths } = density;
  const index = depths ? depthIndexOf(depths) : null;
  let i = lowerBound(times, edges[0] - offset);
  let maxCount = 1;
  for (let c = 0; c < columns; c++) {
    // Columns are half open, except the last, which has what's exactly at the end of the view.
    const end = c === columns - 1 ? upperBound(times, edges[columns] - offset, i) : seekForward(times, edges[c + 1] - offset, i);
    const count = end - i;
    pool.counts[c] = count;
    pool.depths[c] = count && index ? Math.min(65535, index.max(i, end)) : 0;
    if (count > maxCount) maxCount = count;
    i = end;
  }
  pool.maxCount = maxCount;
  pool.deepest = index ? index.deepest : 0;
  return pool;
}

/** Sets `bit` in each column holding at least one of the times. Jumps from occupied column to occupied column, so it
 *  costs what's visible and not what's there. */
export function poolPresence(times: ArrayLike<number>, offset: number, edges: Float64Array, flags: Uint8Array, bit: number): void {
  const columns = edges.length - 1;
  const n = times.length;
  const stop = edges[columns] - offset;
  let i = lowerBound(times, edges[0] - offset);
  while (i < n && times[i] <= stop) {
    const col = clamp(upperBound(edges, times[i] + offset) - 1, 0, columns - 1);
    flags[col] |= bit;
    if (col === columns - 1) return;
    i = seekForward(times, edges[col + 1] - offset, i + 1);
  }
}

/** The largest count among the buckets overlapping each column, for activity fetched at another zoom than the one on
 *  screen. `bucketEdges` are in the lane's own time. */
export function poolBuckets(bucketEdges: ArrayLike<number>, counts: ArrayLike<number>, offset: number, edges: Float64Array, out: Float64Array): void {
  const columns = edges.length - 1;
  out.fill(0);
  const buckets = Math.min(counts.length, bucketEdges.length - 1);
  for (let b = 0; b < buckets; b++) {
    const count = counts[b];
    if (!count) continue;
    const from = bucketEdges[b] + offset;
    const to = bucketEdges[b + 1] + offset;
    if (to <= edges[0] || from > edges[columns]) continue;
    const c0 = Math.max(0, upperBound(edges, from) - 1);
    const c1 = Math.max(c0 + 1, Math.min(columns, lowerBound(edges, to, c0)));
    for (let c = c0; c < c1 && c < columns; c++) if (count > out[c]) out[c] = count;
  }
}

/* ── Stops: which fit, and which merge ── */

const SEVERITY: Record<TraceTone, number> = { default: 0, success: 1, info: 2, warning: 3, error: 4 };

export function mostSevere(a: TraceTone, b: TraceTone): TraceTone {
  return SEVERITY[b] > SEVERITY[a] ? b : a;
}

export interface TraceStopMark<K extends TraceKey = TraceKey> {
  /** The stop this dash stands for: the lowest level in the cluster, then the most severe, then the earliest. */
  stop: TraceStop<K>;
  /** Px along the plot. */
  along: number;
  /** How many stops it stands for. */
  count: number;
  /** The most severe in the cluster. */
  tone: TraceTone;
  /** The earliest and latest stops in the cluster. */
  first: number;
  last: number;
  /** Every stop in the cluster is dim. */
  dim: boolean;
}

interface PreparedStops<K extends TraceKey> {
  /** By time. */
  sorted: Array<TraceStop<K>>;
  /** Indexes into `sorted`, most important first. */
  order: Int32Array;
  fractions: WeakMap<TraceAxis, Float64Array>;
}

const PREPARED = new WeakMap<object, PreparedStops<TraceKey>>();

function prepareStops<K extends TraceKey>(stops: ReadonlyArray<TraceStop<K>>): PreparedStops<K> {
  let prepared = PREPARED.get(stops) as PreparedStops<K> | undefined;
  if (!prepared) {
    const sorted = stops.slice().sort((a, b) => a.time - b.time);
    const level = (s: TraceStop<K>) => s.level ?? 1;
    const severity = (s: TraceStop<K>) => SEVERITY[s.tone ?? 'default'];
    const order = Int32Array.from(sorted.keys()).sort((a, b) => level(sorted[a]) - level(sorted[b]) || severity(sorted[b]) - severity(sorted[a]) || a - b);
    prepared = { sorted, order, fractions: new WeakMap() };
    PREPARED.set(stops, prepared as unknown as PreparedStops<TraceKey>);
  }
  return prepared;
}

/** The stops in time order. Remembered per array. */
export function stopsByTime<K extends TraceKey>(stops: ReadonlyArray<TraceStop<K>>): Array<TraceStop<K>> {
  return prepareStops(stops).sorted;
}

/** The fewest px between two dashes. */
export const TRACE_STOP_GAP = 10;

/** What a rail can show of `stops` for this view and length: the lowest `level` first, then the rest, each merging into
 *  the nearest dash already placed when it'd land closer than `minGap`. Dashes are at least `minGap` apart and in order
 *  along the plot; zooming in spreads them out, so more fit. The most important stops don't move when others appear. */
export function selectStops<K extends TraceKey>(
  stops: ReadonlyArray<TraceStop<K>>,
  { axis, win, length, minGap = TRACE_STOP_GAP }: { axis: TraceAxis; win: TraceWindow; length: number; minGap?: number },
): Array<TraceStopMark<K>> {
  if (!stops.length || !(length > 0)) return [];
  const prepared = prepareStops(stops);
  const { sorted, order } = prepared;
  let fractions = prepared.fractions.get(axis);
  if (!fractions) {
    fractions = Float64Array.from(sorted, (s) => axis.fraction(s.time));
    prepared.fractions.set(axis, fractions);
  }
  const span = win.to - win.from;
  // A grid of cells minGap long: two dashes can't share one, and a neighbour within minGap is at most one cell over.
  const grid = new Int32Array(Math.ceil(length / minGap) + 3).fill(-1);
  const marks: Array<TraceStopMark<K>> = [];
  for (let o = 0; o < order.length; o++) {
    const i = order[o];
    const f = fractions[i];
    if (f < win.from || f > win.to) continue;
    const along = ((f - win.from) / span) * length;
    const cell = Math.floor(along / minGap) + 1;
    let near = -1;
    let nearest = minGap;
    for (let g = cell - 1; g <= cell + 1; g++) {
      const m = grid[g];
      if (m < 0) continue;
      const d = Math.abs(marks[m].along - along);
      if (d < nearest) {
        nearest = d;
        near = m;
      }
    }
    const stop = sorted[i];
    const tone = stop.tone ?? 'default';
    if (near >= 0) {
      const mark = marks[near];
      mark.count++;
      mark.tone = mostSevere(mark.tone, tone);
      if (stop.time < mark.first) mark.first = stop.time;
      if (stop.time > mark.last) mark.last = stop.time;
      mark.dim = mark.dim && !!stop.dim;
    } else {
      grid[cell] = marks.length;
      marks.push({ stop, along, count: 1, tone, first: stop.time, last: stop.time, dim: !!stop.dim });
    }
  }
  return marks.sort((a, b) => a.along - b.along);
}

/** The dash nearest a spot along the plot, within `reach` px. `marks` are in order. */
export function nearestMark<K extends TraceKey>(marks: ReadonlyArray<TraceStopMark<K>>, along: number, reach: number): TraceStopMark<K> | null {
  let lo = 0;
  let hi = marks.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (marks[mid].along < along) lo = mid + 1;
    else hi = mid;
  }
  let best: TraceStopMark<K> | null = null;
  let nearest = reach;
  for (const i of [lo - 1, lo]) {
    const mark = marks[i];
    if (!mark) continue;
    const d = Math.abs(mark.along - along);
    if (d <= nearest) {
      nearest = d;
      best = mark;
    }
  }
  return best;
}

/** The next stop after a time (`direction` 1) or the last one before it (-1). `tolerance` keeps a playhead that's
 *  a rounding error off a stop from landing on that stop again. `sorted` are in time order. */
export function adjacentStop<K extends TraceKey>(sorted: ReadonlyArray<TraceStop<K>>, time: number, direction: 1 | -1, tolerance = 0): TraceStop<K> | null {
  let lo = 0;
  let hi = sorted.length;
  const target = direction > 0 ? time + tolerance : time - tolerance;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (direction > 0 ? sorted[mid].time <= target : sorted[mid].time < target) lo = mid + 1;
    else hi = mid;
  }
  return sorted[direction > 0 ? lo : lo - 1] ?? null;
}

/* ── Scrubbing: pull away from the rail to slow down ── */

export interface TraceScrubSpeed {
  /** This speed lasts until the pointer is this many px from the rail. */
  within: number;
  /** How far the playhead moves per px the pointer moves. */
  gain: number;
  label: string;
}

/** Full speed near the rail, then slower further out. The last starts 240 px out, so all of them fit in a 390 px window
 *  with a rail on its edge. */
export const TRACE_SCRUB_SPEEDS: readonly TraceScrubSpeed[] = [
  { within: 40, gain: 1, label: 'Full speed' },
  { within: 140, gain: 1 / 4, label: 'Quarter speed' },
  { within: 240, gain: 1 / 16, label: 'Sixteenth speed' },
  { within: Infinity, gain: 1 / 64, label: 'Fine, 1/64 speed' },
];

/** How far past a speed's boundary the pointer has to go to change speed, so it doesn't flicker on the line. */
const SPEED_SLOP = 4;

/** The speed for a distance from the rail, given the current one. */
export function speedTier(distance: number, current = 0): number {
  let tier = current;
  while (tier < TRACE_SCRUB_SPEEDS.length - 1 && distance >= TRACE_SCRUB_SPEEDS[tier].within + SPEED_SLOP) tier++;
  while (tier > 0 && distance < TRACE_SCRUB_SPEEDS[tier - 1].within - SPEED_SLOP) tier--;
  return tier;
}

/** A soft snap holds the playhead on a stop for about this many px of pointer travel, at any speed. */
export const TRACE_SNAP_REACH = 6;

/** A scrub in progress: where the pointer and the playhead were when the speed last changed. */
export interface TraceScrub {
  along: number;
  fraction: number;
  tier: number;
  /** Fraction of the axis per px of pointer travel at full speed. */
  scale: number;
}

/** What a scrub is looking at: the snap targets and how they lie along the plot. */
export interface TraceScrubContext<K extends TraceKey = TraceKey> {
  axis: TraceAxis;
  win: TraceWindow;
  length: number;
  marks: ReadonlyArray<TraceStopMark<K>>;
}

export function startScrub(along: number, fraction: number, scale: number): TraceScrub {
  return { along, fraction, tier: 0, scale };
}

/** Where a scrub puts the playhead with the pointer `along`: the fraction, and the stop when it's snapped to one. The
 *  raw position isn't clamped to the axis until here, so going past an end and coming back takes as long as going. */
export function scrubPosition<K extends TraceKey>(s: TraceScrub, along: number, { axis, win, length, marks }: TraceScrubContext<K>): { fraction: number; mark: TraceStopMark<K> | null } {
  const gain = TRACE_SCRUB_SPEEDS[s.tier].gain;
  const fraction = clamp01(s.fraction + (along - s.along) * s.scale * gain);
  const mark = nearestMark(marks, ((fraction - win.from) / (win.to - win.from)) * length, TRACE_SNAP_REACH * gain);
  return mark ? { fraction: axis.fraction(mark.stop.time), mark } : { fraction, mark: null };
}

/** Takes in a pointer move. When the speed changes, the scrub re-anchors where the playhead is now, snap and all, so the
 *  change itself moves nothing. */
export function moveScrub<K extends TraceKey>(s: TraceScrub, along: number, distance: number, context: TraceScrubContext<K>): TraceScrub {
  const tier = speedTier(distance, s.tier);
  return tier === s.tier ? s : { along, fraction: scrubPosition(s, along, context).fraction, tier, scale: s.scale };
}

/** Takes in a zoom in the middle of a scrub: from `fraction`, where the playhead is showing, with the pointer `along`, one
 *  px now means something else. */
export function rescaleScrub(s: TraceScrub, along: number, fraction: number, scale: number): TraceScrub {
  return { along, fraction, tier: s.tier, scale };
}

/* ── Layout ── */

const RULER = 22;
const DIAMONDS = 14;
const DENSITY = 26;
const TITLE = 16;
const REQUESTS = 20;
const STOPS = 14;
const THREAD_MAX = 14;
const THREAD_MIN = 4;
const LANE_GAP = 2;

/** The strip's ruler height, and the default width of its label gutter. */
export const TRACE_RULER = RULER;
export const TRACE_GUTTER = 64;

/** The rail: thin columns along the outer edge, in `zone` px, after `outer` px for the view's position. */
const RAIL_OUTER = 3;
const RAIL_ZONE = 16;
const RAIL_COLUMN_GAP = 1;
const RAIL_DASH_GAP = 2;

export type TraceRowType = 'title' | 'diamonds' | 'density' | 'thread' | 'requests' | 'stops';

export interface TraceRow {
  type: TraceRowType;
  /** Px across the timeline: down the strip, or in from the rail's outer edge. */
  at: number;
  size: number;
  lane?: TraceLane;
  /** Which lane in order. */
  laneIndex?: number;
  thread?: TraceThread;
}

interface RowOptions {
  requests?: boolean;
  stops?: boolean;
}

const hasDensityRow = (lane: TraceLane) => !!lane.density || !!lane.marks?.length;

/** The strip's height with every thread row at its fullest. */
export function stripHeight(lanes: readonly TraceLane[], { requests, stops }: RowOptions = {}): number {
  let height = RULER + (requests ? REQUESTS : 0) + (stops ? STOPS : 0) + 4;
  for (const lane of lanes) {
    height += (lane.diamonds ? DIAMONDS : 0) + (hasDensityRow(lane) ? DENSITY : 0) + (lanes.length > 1 ? TITLE : 0) + LANE_GAP;
    height += (lane.threads?.length ?? 0) * THREAD_MAX;
  }
  return height;
}

/** Every row of the strip, top to bottom. Thread rows share what height is left, from 4 to 14 px each. */
export function layoutStrip(lanes: readonly TraceLane[], height: number, { requests, stops }: RowOptions = {}): TraceRow[] {
  const several = lanes.length > 1;
  let fixed = RULER + (requests ? REQUESTS : 0) + (stops ? STOPS : 0);
  let threads = 0;
  for (const lane of lanes) {
    fixed += (lane.diamonds ? DIAMONDS : 0) + (hasDensityRow(lane) ? DENSITY : 0) + (several ? TITLE : 0) + LANE_GAP;
    threads += lane.threads?.length ?? 0;
  }
  const threadSize = clamp(Math.floor((height - fixed - 4) / Math.max(1, threads)), THREAD_MIN, THREAD_MAX);
  const rows: TraceRow[] = [];
  let at = RULER;
  const add = (type: TraceRowType, size: number, lane?: TraceLane, laneIndex?: number, thread?: TraceThread) => {
    rows.push({ type, at, size, lane, laneIndex, thread });
    at += size;
  };
  if (stops) add('stops', STOPS);
  lanes.forEach((lane, i) => {
    if (several) add('title', TITLE, lane, i);
    if (lane.diamonds) add('diamonds', DIAMONDS, lane, i);
    if (hasDensityRow(lane)) add('density', DENSITY, lane, i);
    at += LANE_GAP;
    for (const thread of lane.threads ?? []) add('thread', threadSize, lane, i, thread);
  });
  if (requests) add('requests', REQUESTS);
  return rows;
}

/** The rail: each lane a thin column (its density and marks, or failing that all its threads' activity together), in
 *  from the outer edge. */
export function layoutRail(lanes: readonly TraceLane[]): TraceRow[] {
  const shown = lanes.filter((lane) => hasDensityRow(lane) || lane.threads?.length);
  if (!shown.length) return [];
  const size = clamp(Math.floor((RAIL_ZONE - RAIL_COLUMN_GAP * (shown.length - 1)) / shown.length), 2, 6);
  return shown.map((lane, i) => ({ type: hasDensityRow(lane) ? 'density' : 'thread', at: RAIL_OUTER + i * (size + RAIL_COLUMN_GAP), size, lane, laneIndex: lanes.indexOf(lane) }));
}

/** Where a rail's dashes start, in px from its outer edge. */
export function railDashInset(rows: readonly TraceRow[]): number {
  const last = rows[rows.length - 1];
  return (last ? last.at + last.size : RAIL_OUTER) + RAIL_DASH_GAP;
}

/** Where a row's lane ends across the timeline: the end of the lane's last row. */
export function laneEnd(rows: readonly TraceRow[], lane: TraceLane | undefined): number {
  let end = 0;
  for (const row of rows) if (row.lane === lane && row.at + row.size > end) end = row.at + row.size;
  return end;
}

/** The row at a spot across the timeline. */
export function rowAt(rows: readonly TraceRow[], across: number): TraceRow | null {
  for (const row of rows) if (across >= row.at && across < row.at + row.size) return row;
  return null;
}

/** The request whose dot or band ends are nearest a spot along the plot, within `reach` px. */
export function requestAt<R extends TraceRequest>(requests: readonly R[], alongOf: (time: number) => number, along: number, reach = 8): R | null {
  let best: R | null = null;
  let nearest = reach;
  for (const r of requests) {
    const spots = r.from === undefined ? [r.time] : [r.time, r.from, r.to ?? r.from];
    for (const time of spots) {
      const d = Math.abs(alongOf(time) - along);
      if (d < nearest) {
        nearest = d;
        best = r;
      }
    }
  }
  return best;
}

/* ── The preview card ── */

export interface TraceCardSpot {
  /** Px from the rail's outer edge to the card's near edge. */
  inset: number;
  /** Px from the top of the rail to the top of the card. */
  top: number;
}

/** Where the preview card goes beside a rail, in the rail's parent: on the inner side of the pointer, moving out with it
 *  as it pulls away so the pointer never covers it. When that runs out of window it goes above the pointer instead (or
 *  below, at the top), where a finger doesn't cover it either. */
export function placeRailCard({ along, pull, railWidth, railTop, hostWidth, hostHeight, cardWidth, cardHeight, margin = 8 }: {
  along: number;
  /** How far the pointer is past the rail's inner edge. */
  pull: number;
  railWidth: number;
  railTop: number;
  hostWidth: number;
  hostHeight: number;
  cardWidth: number;
  cardHeight: number;
  margin?: number;
}): TraceCardSpot {
  const minTop = margin - railTop;
  const maxTop = Math.max(minTop, hostHeight - railTop - cardHeight - margin);
  const beside = railWidth + (pull > 0 ? pull + 12 : 4);
  if (hostWidth - beside - margin >= cardWidth) return { inset: beside, top: clamp(along - cardHeight / 2, minTop, maxTop) };
  const inset = clamp(railWidth + pull - cardWidth / 2, margin, Math.max(margin, hostWidth - cardWidth - margin));
  const above = along - cardHeight - 18;
  return { inset, top: clamp(above >= minTop ? above : along + 18, minTop, maxTop) };
}

/** Where the preview card goes on a strip, in px from its left and top: centred on the pointer and kept on the strip,
 *  above it if its parent has room there, otherwise under it, otherwise over its rows. */
export function placeStripCard({ along, width, height, above, below, cardWidth, cardHeight, margin = 6 }: {
  along: number;
  width: number;
  height: number;
  /** The room in the strip's parent over it and under it. */
  above: number;
  below: number;
  cardWidth: number;
  cardHeight: number;
  margin?: number;
}): { left: number; top: number } {
  const left = clamp(along - cardWidth / 2, margin, Math.max(margin, width - cardWidth - margin));
  const needed = cardHeight + margin;
  if (above >= needed) return { left, top: -needed };
  if (below >= needed) return { left, top: height + margin };
  return { left, top: RULER + margin };
}

/* ── The wave: the same dash and falloff as IndexBar's ── */

export const TRACE_WAVE_REST = 9;
export const TRACE_WAVE_PEAK = 28;
const WAVE_REACH = 3.2;

/** Raised-cosine falloff: 1 at the pointer, 0 at 3.2 stops away, with a stop's room being `TRACE_STOP_GAP` px. */
export const traceSwell = (px: number) => {
  const d = Math.abs(px) / TRACE_STOP_GAP;
  return d >= WAVE_REACH ? 0 : (1 + Math.cos((Math.PI * d) / WAVE_REACH)) / 2;
};

/** Whether two lane lists draw the same, so a host that rebuilds them on every render doesn't cost a redraw. */
export function sameLanes(a: readonly TraceLane[], b: readonly TraceLane[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (x === y) continue;
    if (x.key !== y.key || x.title !== y.title || x.offset !== y.offset || x.color !== y.color) return false;
    if (x.diamonds?.times !== y.diamonds?.times || x.diamonds?.label !== y.diamonds?.label || x.diamonds?.color !== y.diamonds?.color) return false;
    if (x.density?.times !== y.density?.times || x.density?.depths !== y.density?.depths || x.density?.label !== y.density?.label || x.density?.color !== y.density?.color) return false;
    const xm = x.marks ?? [];
    const ym = y.marks ?? [];
    if (xm.length !== ym.length || xm.some((m, k) => m.key !== ym[k].key || m.times !== ym[k].times || m.shape !== ym[k].shape || m.tone !== ym[k].tone || m.color !== ym[k].color)) return false;
    const xt = x.threads ?? [];
    const yt = y.threads ?? [];
    if (xt.length !== yt.length || xt.some((t, k) => t.id !== yt[k].id || t.label !== yt[k].label || t.color !== yt[k].color)) return false;
  }
  return true;
}

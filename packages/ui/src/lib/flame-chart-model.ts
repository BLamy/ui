/* ══ Flame chart — the math behind FlameChart ══
   A distributed trace on one clock: lanes (a process, a service, a host), and in each lane spans packed into rows, each
   one under the span that caused it, with links where the cause was in another lane. Spans are columns of typed arrays
   (`FlameData`), so a million of them is a few typed arrays and not a million objects.

   What drawing needs is here: an index of each row's spans sorted by start, with the furthest end so far beside them
   (`FlameIndex`), so a view finds what it shows by binary search, long spans that started off-screen included; the
   lanes' heights (`layoutLanes`); and hit testing (`spanAt`). What a reader asks about a span is here too: its self
   time (duration minus the union of its children), its family, its critical path. Plain data in, plain data out: no DOM
   and no React. lib/flame-chart-draw puts it on a canvas and components/flame-chart handles the gestures.

   Times are numbers on the shared clock, in milliseconds as far as formatting and the ruler are concerned. ══ */
import { lowerBound, tickStep, upperBound, type TraceRange, type TraceTick } from '@/lib/trace-timeline-model';

/* ── Data ── */

/** A stretch of time, in ms on the shared clock. */
export type FlameRange = TraceRange;

/** A lane: a process, a service or a host. `tint` is any CSS colour (variables too) for its header and default spans. */
export interface FlameLane {
  key: string;
  title: string;
  subtitle?: string;
  tint?: string;
}

/** Bits of `FlameData.flags`. */
export const FLAME_ERROR = 1;
/** Not finished when the trace was taken: drawn outlined, with a dashed edge. */
export const FLAME_PENDING = 2;
/** Waiting on something elsewhere rather than running here: drawn outlined. */
export const FLAME_WAITING = 4;

/** Columnar spans: index i is one span. All typed arrays have the same length. Times are ms on one shared clock. */
export interface FlameData {
  lanes: FlameLane[];
  start: Float64Array;
  end: Float64Array;
  /** Index into `lanes`. */
  lane: Uint16Array;
  /** Row within its lane (0 = top). `packRows` works it out. */
  depth: Uint16Array;
  /** Span index of its cause, -1 for a root; may be in another lane. */
  parent: Int32Array;
  /** Index into `names`. */
  name: Uint32Array;
  names: string[];
  /** Index into `colors`. */
  color: Uint16Array;
  /** CSS colours, variables allowed. */
  colors: string[];
  /** `FLAME_ERROR` (1), `FLAME_PENDING` (2), `FLAME_WAITING` (4). */
  flags: Uint8Array;
  /** Cross-lane causal links. Default: from each span's parent, where the two are in different lanes. */
  links?: { from: Int32Array; to: Int32Array };
  /** The id each span had in `flameData`'s input, by index. */
  ids?: string[];
}

/** One span as an object, for `flameData`. */
export interface FlameSpanInput {
  id: string;
  parent?: string | null;
  /** A lane's `key`. */
  lane: string;
  name: string;
  start: number;
  end: number;
  /** Any CSS colour. Default: the lane's `tint`, or a chart colour by lane. */
  color?: string;
  error?: boolean;
  pending?: boolean;
  waiting?: boolean;
}

/** The chart colours lanes take in turn when they have no `tint`. */
export const FLAME_PALETTE = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'] as const;

/** A lane's colour: its `tint`, else a chart colour by position. */
export function laneTint(lanes: readonly FlameLane[], index: number): string {
  return lanes[index]?.tint ?? FLAME_PALETTE[index % FLAME_PALETTE.length];
}

/** Packs spans given as objects into `FlameData`, keeping their order (index i is `spans[i]`, and `ids[i]` its id). A
 *  span's parent is found by id, and a span whose lane isn't among `lanes` gets a lane of its own. Rows are worked out
 *  by `packRows`, and links come from parents in other lanes. */
export function flameData(lanes: FlameLane[], spans: readonly FlameSpanInput[]): FlameData {
  const n = spans.length;
  const allLanes = lanes.slice();
  const laneIndex = new Map<string, number>();
  allLanes.forEach((lane, i) => laneIndex.set(lane.key, i));
  const byId = new Map<string, number>();
  spans.forEach((span, i) => byId.set(span.id, i));
  const names: string[] = [];
  const nameIndex = new Map<string, number>();
  const colors: string[] = [];
  const colorIndex = new Map<string, number>();
  const intern = (list: string[], map: Map<string, number>, value: string) => {
    let at = map.get(value);
    if (at === undefined) {
      at = list.length;
      list.push(value);
      map.set(value, at);
    }
    return at;
  };
  const start = new Float64Array(n);
  const end = new Float64Array(n);
  const lane = new Uint16Array(n);
  const parent = new Int32Array(n);
  const name = new Uint32Array(n);
  const color = new Uint16Array(n);
  const flags = new Uint8Array(n);
  const ids: string[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const span = spans[i];
    let l = laneIndex.get(span.lane);
    if (l === undefined) {
      l = allLanes.length;
      allLanes.push({ key: span.lane, title: span.lane });
      laneIndex.set(span.lane, l);
    }
    ids[i] = span.id;
    start[i] = span.start;
    end[i] = Math.max(span.start, span.end);
    lane[i] = l;
    const p = span.parent == null ? undefined : byId.get(span.parent);
    parent[i] = p === undefined || p === i ? -1 : p;
    name[i] = intern(names, nameIndex, span.name);
    color[i] = intern(colors, colorIndex, span.color ?? laneTint(allLanes, l));
    flags[i] = (span.error ? FLAME_ERROR : 0) | (span.pending ? FLAME_PENDING : 0) | (span.waiting ? FLAME_WAITING : 0);
  }
  const depth = packRows(start, end, lane, parent);
  const data: FlameData = { lanes: allLanes, start, end, lane, depth, parent, name, names, color, colors, flags, ids };
  data.links = deriveLinks(data);
  return data;
}

/** Span indices in order of `values`: the identity when they're already in order, which costs one pass. */
export function argsort(values: ArrayLike<number>): Int32Array {
  const n = values.length;
  const order = new Int32Array(n);
  let sorted = true;
  for (let i = 0; i < n; i++) {
    order[i] = i;
    if (sorted && i > 0 && values[i] < values[i - 1]) sorted = false;
  }
  if (!sorted) order.sort((a, b) => values[a] - values[b] || a - b);
  return order;
}

/** How deep each span is in its tree, and when it can start at the earliest: never before its cause, so a child whose
 *  clock ran early is still placed after its parent. A cycle in `parent` is broken where it closes. */
function generations(start: ArrayLike<number>, parent: ArrayLike<number>) {
  const n = start.length;
  const gen = new Int32Array(n).fill(-1);
  const earliest = new Float64Array(n);
  const stack = new Int32Array(n);
  const VISITING = -2;
  for (let i = 0; i < n; i++) {
    if (gen[i] >= 0) continue;
    let top = 0;
    let at = i;
    // Up to a known ancestor or a root, then back down.
    while (at >= 0 && gen[at] === -1) {
      gen[at] = VISITING;
      stack[top++] = at;
      at = parent[at];
    }
    let g = at >= 0 && gen[at] >= 0 ? gen[at] : -1;
    let floor = at >= 0 && gen[at] >= 0 ? earliest[at] : -Infinity;
    while (top > 0) {
      const k = stack[--top];
      g += 1;
      floor = Math.max(floor, start[k]);
      gen[k] = g;
      earliest[k] = floor;
    }
  }
  return { gen, earliest };
}

/** The row of each span within its lane: under its parent when the parent is in the same lane, and otherwise as high as
 *  it fits without overlapping a span already there. Spans are placed in order of start, so packing costs a pass and a
 *  sort (no sort when they're already in order). */
export function packRows(start: ArrayLike<number>, end: ArrayLike<number>, lane: ArrayLike<number>, parent: ArrayLike<number>): Uint16Array {
  const n = start.length;
  const { gen, earliest } = generations(start, parent);
  // In order of when each can start, a parent before its children.
  const order = argsort(earliest);
  let ties = false;
  for (let k = 1; k < n && !ties; k++) ties = earliest[order[k]] === earliest[order[k - 1]] && gen[order[k]] < gen[order[k - 1]];
  if (ties) order.sort((a, b) => earliest[a] - earliest[b] || gen[a] - gen[b] || a - b);
  const depth = new Uint16Array(n);
  const rowEnds: number[][] = [];
  for (let k = 0; k < n; k++) {
    const i = order[k];
    const l = lane[i];
    const rows = rowEnds[l] ?? (rowEnds[l] = []);
    const p = parent[i];
    const s = earliest[i];
    let r = p >= 0 && lane[p] === l ? depth[p] + 1 : 0;
    while (r < rows.length && rows[r] > s) r++;
    if (r > 65535) r = 65535;
    depth[i] = r;
    const e = Math.max(s, end[i]);
    rows[r] = rows[r] === undefined ? e : Math.max(rows[r], e);
  }
  return depth;
}

/** A link from each span's parent where the two are in different lanes. */
export function deriveLinks(data: Pick<FlameData, 'lane' | 'parent'>): { from: Int32Array; to: Int32Array } {
  const n = data.parent.length;
  let count = 0;
  for (let i = 0; i < n; i++) {
    const p = data.parent[i];
    if (p >= 0 && data.lane[p] !== data.lane[i]) count++;
  }
  const from = new Int32Array(count);
  const to = new Int32Array(count);
  let k = 0;
  for (let i = 0; i < n; i++) {
    const p = data.parent[i];
    if (p >= 0 && data.lane[p] !== data.lane[i]) {
      from[k] = p;
      to[k] = i;
      k++;
    }
  }
  return { from, to };
}

/** The earliest start and latest end, or 0…1 for no spans. A zero-length trace is given a millisecond. */
export function flameExtent(data: Pick<FlameData, 'start' | 'end'>): FlameRange {
  let start = Infinity;
  let end = -Infinity;
  for (let i = 0; i < data.start.length; i++) {
    if (data.start[i] < start) start = data.start[i];
    if (data.end[i] > end) end = data.end[i];
  }
  if (!Number.isFinite(start)) return { start: 0, end: 1 };
  return { start, end: end > start ? end : start + 1 };
}

/* ── The tree ── */

/** Each span's children, in order of start: `children[offsets[i]…offsets[i + 1])` are span i's. The roots are the
 *  last group, `offsets[n]…offsets[n + 1]`. */
export interface FlameTree {
  offsets: Int32Array;
  children: Int32Array;
}

const trees = new WeakMap<FlameData, FlameTree>();

/** The tree of a data set, built once and remembered. */
export function flameTree(data: FlameData): FlameTree {
  let tree = trees.get(data);
  if (tree) return tree;
  const n = data.start.length;
  const byStart = argsort(data.start);
  const offsets = new Int32Array(n + 2);
  const slotOf = (i: number) => (data.parent[i] >= 0 && data.parent[i] < n ? data.parent[i] : n);
  for (let i = 0; i < n; i++) offsets[slotOf(i) + 1]++;
  for (let g = 0; g <= n; g++) offsets[g + 1] += offsets[g];
  const fill = offsets.slice(0, n + 1);
  const children = new Int32Array(n);
  for (let k = 0; k < n; k++) {
    const i = byStart[k];
    children[fill[slotOf(i)]++] = i;
  }
  tree = { offsets, children };
  trees.set(data, tree);
  return tree;
}

/** The length of the union of some intervals: overlaps count once. */
export function unionMs(intervals: ArrayLike<{ start: number; end: number }>): number {
  const list: Array<{ start: number; end: number }> = [];
  for (let i = 0; i < intervals.length; i++) if (intervals[i].end > intervals[i].start) list.push(intervals[i]);
  list.sort((a, b) => a.start - b.start);
  let total = 0;
  let from = 0;
  let to = 0;
  let open = false;
  for (const next of list) {
    if (!open || next.start > to) {
      if (open) total += to - from;
      from = next.start;
      to = next.end;
      open = true;
    } else if (next.end > to) {
      to = next.end;
    }
  }
  return open ? total + to - from : 0;
}

/** One span's self time: its duration minus the union of its children's intervals, clipped to it. */
export function selfTime(data: FlameData, index: number): number {
  const { offsets, children } = flameTree(data);
  const s = data.start[index];
  const e = data.end[index];
  let covered = 0;
  let from = 0;
  let to = 0;
  let open = false;
  // Children are in order of start, so one sweep merges them.
  for (let k = offsets[index]; k < offsets[index + 1]; k++) {
    const c = children[k];
    const cs = Math.max(s, data.start[c]);
    const ce = Math.min(e, data.end[c]);
    if (ce <= cs) continue;
    if (!open || cs > to) {
      if (open) covered += to - from;
      from = cs;
      to = ce;
      open = true;
    } else if (ce > to) {
      to = ce;
    }
  }
  if (open) covered += to - from;
  return Math.max(0, e - s - covered);
}

/** Every span's self time. */
export function selfTimes(data: FlameData): Float64Array {
  const n = data.start.length;
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = selfTime(data, i);
  return out;
}

/** A span, everything above it and everything under it: what a request went through to get there and what it set off. */
export function familyOf(data: FlameData, index: number): Set<number> {
  const family = new Set<number>();
  if (index < 0 || index >= data.start.length) return family;
  family.add(index);
  for (let up = data.parent[index]; up >= 0 && !family.has(up); up = data.parent[up]) family.add(up);
  const { offsets, children } = flameTree(data);
  const pending = [index];
  while (pending.length) {
    const at = pending.pop() as number;
    for (let k = offsets[at]; k < offsets[at + 1]; k++) {
      const c = children[k];
      if (!family.has(c)) {
        family.add(c);
        pending.push(c);
      }
    }
  }
  return family;
}

/** From the root down to a span, across lanes. */
export function pathTo(data: FlameData, index: number): number[] {
  const path: number[] = [];
  const seen = new Set<number>();
  for (let at = index; at >= 0 && !seen.has(at); at = data.parent[at]) {
    seen.add(at);
    path.unshift(at);
  }
  return path;
}

/** What a span was waiting on, going back from when it finished: the child that finished last before then (its end
 *  held to the parent's, for clocks that disagree), what that child was waiting on, and so on; then the child that
 *  finished before the first one started. The gaps between are the span's own time. It's the chain that made the span
 *  take as long as it did. Pending children never finished, so they're left out. Returned in the order it's walked:
 *  the span first, each span before what it waited on. */
export function criticalPath(data: FlameData, index: number): number[] {
  const path: number[] = [];
  if (index < 0 || index >= data.start.length) return path;
  const { offsets, children } = flameTree(data);
  const seen = new Set<number>();
  const walk = (at: number) => {
    seen.add(at);
    path.push(at);
    const spanEnd = data.end[at];
    const kids: number[] = [];
    for (let k = offsets[at]; k < offsets[at + 1]; k++) {
      const c = children[k];
      if (!(data.flags[c] & FLAME_PENDING) && data.end[c] > data.start[c] && !seen.has(c)) kids.push(c);
    }
    kids.sort((a, b) => Math.min(data.end[b], spanEnd) - Math.min(data.end[a], spanEnd));
    let cursor = spanEnd;
    for (const c of kids) {
      if (Math.min(data.end[c], spanEnd) > cursor || seen.has(c)) continue;
      walk(c);
      cursor = data.start[c];
    }
  };
  walk(index);
  return path;
}

/** The value at or under which `p` (0…1) of them fall: the nearest rank, from a sorted copy. 0 for none. */
export function percentile(values: ArrayLike<number>, p: number): number {
  if (!values.length) return 0;
  const sorted = Float64Array.from(values as ArrayLike<number>).sort();
  return sorted[Math.max(0, Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1))];
}

/* ── The index: each row's spans by start, for culling and hit testing ── */

/** Each lane's rows, and each row's spans in order of start. Row `r` of lane `l` is `laneBase[l] + r`, and its spans are
 *  `order[rowOffsets[row]…rowOffsets[row + 1])`, with their `starts` and `ends` beside them and `reach`, the furthest
 *  end so far in the row, which never goes down: a binary search on it finds the first span still showing at a time, a
 *  long one that started far before the view included. */
export interface FlameIndex {
  /** Rows across all lanes. */
  rows: number;
  /** How many rows each lane has. */
  laneRows: Uint16Array;
  /** Each lane's first row. */
  laneBase: Int32Array;
  rowOffsets: Int32Array;
  order: Int32Array;
  starts: Float64Array;
  ends: Float64Array;
  reach: Float64Array;
  /** Where each span is in `order`. */
  slot: Int32Array;
  /** Links in order of where they arrive (`start` of `to`), for finding the ones in a view. */
  links: { from: Int32Array; to: Int32Array; at: Float64Array };
}

const indexes = new WeakMap<FlameData, FlameIndex>();

/** The index of a data set, built once and remembered (a counting sort by row; spans in start order need no sort). */
export function flameIndex(data: FlameData): FlameIndex {
  let index = indexes.get(data);
  if (index) return index;
  index = buildIndex(data, null);
  indexes.set(data, index);
  return index;
}

/** The same index over only some of the spans (`keep[i]` set): what a highlight or the errors draw on top from. */
export function subIndex(data: FlameData, keep: Uint8Array): FlameIndex {
  return buildIndex(data, keep);
}

function buildIndex(data: FlameData, keep: Uint8Array | null): FlameIndex {
  const n = data.start.length;
  const laneCount = data.lanes.length;
  const laneRows = new Uint16Array(laneCount);
  for (let i = 0; i < n; i++) {
    const l = data.lane[i];
    if (l < laneCount && data.depth[i] + 1 > laneRows[l]) laneRows[l] = data.depth[i] + 1;
  }
  if (keep) {
    // A subset keeps the full set's rows, so its row numbers mean the same.
    const full = flameIndex(data);
    laneRows.set(full.laneRows);
  }
  const laneBase = new Int32Array(laneCount + 1);
  for (let l = 0; l < laneCount; l++) laneBase[l + 1] = laneBase[l] + laneRows[l];
  const rows = laneBase[laneCount];
  const rowOf = (i: number) => laneBase[data.lane[i]] + data.depth[i];
  const rowOffsets = new Int32Array(rows + 1);
  let count = 0;
  for (let i = 0; i < n; i++) {
    if ((keep && !keep[i]) || data.lane[i] >= laneCount) continue;
    rowOffsets[rowOf(i) + 1]++;
    count++;
  }
  for (let r = 0; r < rows; r++) rowOffsets[r + 1] += rowOffsets[r];
  const byStart = argsort(data.start);
  const fill = rowOffsets.slice(0, rows);
  const order = new Int32Array(count);
  const slot = new Int32Array(keep ? 0 : n).fill(-1);
  for (let k = 0; k < n; k++) {
    const i = byStart[k];
    if ((keep && !keep[i]) || data.lane[i] >= laneCount) continue;
    const at = fill[rowOf(i)]++;
    order[at] = i;
    if (!keep) slot[i] = at;
  }
  const starts = new Float64Array(count);
  const ends = new Float64Array(count);
  const reach = new Float64Array(count);
  for (let r = 0; r < rows; r++) {
    let furthest = -Infinity;
    for (let k = rowOffsets[r]; k < rowOffsets[r + 1]; k++) {
      const i = order[k];
      starts[k] = data.start[i];
      ends[k] = data.end[i];
      if (ends[k] > furthest) furthest = ends[k];
      reach[k] = furthest;
    }
  }
  return { rows, laneRows, laneBase, rowOffsets, order, starts, ends, reach, slot, links: keep ? emptyLinks() : linkIndex(data) };
}

function emptyLinks() {
  return { from: new Int32Array(0), to: new Int32Array(0), at: new Float64Array(0) };
}

function linkIndex(data: FlameData) {
  const links = data.links ?? deriveLinks(data);
  const n = data.start.length;
  const valid: number[] = [];
  for (let k = 0; k < links.from.length; k++) {
    const a = links.from[k];
    const b = links.to[k];
    if (a >= 0 && a < n && b >= 0 && b < n) valid.push(k);
  }
  const arrive = Float64Array.from(valid, (k) => data.start[links.to[k]]);
  const by = argsort(arrive);
  const from = new Int32Array(valid.length);
  const to = new Int32Array(valid.length);
  const at = new Float64Array(valid.length);
  for (let j = 0; j < valid.length; j++) {
    const k = valid[by[j]];
    from[j] = links.from[k];
    to[j] = links.to[k];
    at[j] = arrive[by[j]];
  }
  return { from, to, at };
}

/** The positions in `order` of a row's spans that show in `from`…`to`: `[lo, hi)`. Some in between may have ended before
 *  `from` when rows overlap (depths a host set), so check each one's end. */
export function rowWindow(index: FlameIndex, row: number, from: number, to: number): [number, number] {
  const rs = index.rowOffsets[row];
  const re = index.rowOffsets[row + 1];
  return [lowerBound(index.reach, from, rs, re), upperBound(index.starts, to, rs, re)];
}

/** The span in a lane's row at a time, within `slop` ms either side: the one containing it, else the nearest. -1 if
 *  none. */
export function spanAt(index: FlameIndex, lane: number, depth: number, time: number, slop = 0): number {
  if (lane < 0 || lane >= index.laneRows.length || depth < 0 || depth >= index.laneRows[lane]) return -1;
  const row = index.laneBase[lane] + depth;
  const rs = index.rowOffsets[row];
  let k = upperBound(index.starts, time + slop, rs, index.rowOffsets[row + 1]) - 1;
  let best = -1;
  let bestGap = Infinity;
  // Back from the last to start before the time: the furthest end so far says when nothing earlier can reach it.
  for (let steps = 0; k >= rs && index.reach[k] >= time - slop && steps < 256; k--, steps++) {
    const s = index.starts[k];
    const e = index.ends[k];
    const gap = time < s ? s - time : time > e ? time - e : 0;
    if (gap <= slop && gap < bestGap) {
      best = index.order[k];
      bestGap = gap;
      if (gap === 0) break;
    }
  }
  return best;
}

/* ── Lanes on the page ── */

/** The lane header's height, px: its title in the gutter and a tinted band over the plot. */
export const FLAME_HEADER = 22;
/** Space under a lane's last row, px. */
export const FLAME_LANE_PAD = 4;
export const FLAME_ROW_HEIGHT = 18;
/** The minimap's height and the ruler's, px. */
export const FLAME_MINIMAP = 34;
export const FLAME_RULER = 22;
export const FLAME_GUTTER = 148;

/** Where each lane is in the scrolled body, px from its top. */
export interface FlameLayout {
  tops: Float64Array;
  heights: Float64Array;
  /** The body's whole height. */
  total: number;
  rowHeight: number;
  header: number;
  collapsed: Uint8Array;
}

export function layoutLanes(index: Pick<FlameIndex, 'laneRows'>, collapsed: ReadonlySet<string> | readonly string[], lanes: readonly FlameLane[], rowHeight = FLAME_ROW_HEIGHT, header = FLAME_HEADER): FlameLayout {
  const shut = collapsed instanceof Set ? collapsed : new Set(collapsed as readonly string[]);
  const count = lanes.length;
  const tops = new Float64Array(count);
  const heights = new Float64Array(count);
  const isCollapsed = new Uint8Array(count);
  let y = 0;
  for (let l = 0; l < count; l++) {
    isCollapsed[l] = shut.has(lanes[l].key) ? 1 : 0;
    const h = header + (isCollapsed[l] ? 0 : (index.laneRows[l] ?? 0) * rowHeight + FLAME_LANE_PAD);
    tops[l] = y;
    heights[l] = h;
    y += h;
  }
  return { tops, heights, total: y, rowHeight, header, collapsed: isCollapsed };
}

/** What's at a height in the scrolled body: a lane and its row, `-1` for the lane's header, or null below the last. */
export function rowAtY(layout: FlameLayout, y: number): { lane: number; row: number } | null {
  if (y < 0 || y >= layout.total) return null;
  const lane = Math.max(0, upperBound(layout.tops, y) - 1);
  const inside = y - layout.tops[lane];
  if (inside < layout.header || layout.collapsed[lane]) return { lane, row: -1 };
  return { lane, row: Math.floor((inside - layout.header) / layout.rowHeight) };
}

/** Where a span's bar is in the scrolled body, px: its top and height, or null when its lane is collapsed. */
export function rowTop(layout: FlameLayout, lane: number, depth: number): number | null {
  if (layout.collapsed[lane]) return null;
  return layout.tops[lane] + layout.header + depth * layout.rowHeight;
}

/* ── Moving between spans ── */

/** The span before or after one under the same parent (in order of start), or failing that its neighbour in the row.
 *  -1 at the end. */
export function siblingOf(data: FlameData, index: number, direction: 1 | -1): number {
  const n = data.start.length;
  if (index < 0 || index >= n) return -1;
  const { offsets, children } = flameTree(data);
  const group = data.parent[index] >= 0 && data.parent[index] < n ? data.parent[index] : n;
  for (let k = offsets[group]; k < offsets[group + 1]; k++) {
    if (children[k] !== index) continue;
    const next = k + direction;
    if (next >= offsets[group] && next < offsets[group + 1]) return children[next];
    break;
  }
  const idx = flameIndex(data);
  const at = idx.slot[index];
  const row = idx.laneBase[data.lane[index]] + data.depth[index];
  const next = at + direction;
  return at >= 0 && next >= idx.rowOffsets[row] && next < idx.rowOffsets[row + 1] ? idx.order[next] : -1;
}

/** A span's first child (by start), or -1. */
export function firstChild(data: FlameData, index: number): number {
  if (index < 0 || index >= data.start.length) return -1;
  const { offsets, children } = flameTree(data);
  return offsets[index + 1] > offsets[index] ? children[offsets[index]] : -1;
}

/** The first span to start, or -1 for none. */
export function firstRoot(data: FlameData): number {
  const n = data.start.length;
  if (!n) return -1;
  const { offsets, children } = flameTree(data);
  return offsets[n + 1] > offsets[n] ? children[offsets[n]] : 0;
}

/* ── The ruler ── */

/** Ticks for a view, at round offsets from the start of `range` (a trace on an epoch clock still gets 0, 50 ms, 100 ms),
 *  at least `minGap` px apart over a plot `length` px wide. */
export function flameTicks(range: FlameRange, view: FlameRange, length: number, minGap = 90): TraceTick[] {
  const span = view.end - view.start;
  if (!(length > 0) || !(span > 0)) return [];
  const step = tickStep(span / Math.max(1, length / minGap));
  const ticks: TraceTick[] = [];
  const first = Math.ceil((view.start - range.start) / step);
  const last = Math.floor((view.end - range.start) / step);
  for (let k = first; k <= last && ticks.length < 1000; k++) {
    const time = range.start + k * step;
    ticks.push({ along: ((time - view.start) / span) * length, time, resolution: step });
  }
  return ticks;
}

/* ── Words ── */

/** A duration, short: `850 µs`, `12.4 ms`, `1.25 s`, `2m 05s`. */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms)) return '—';
  const a = Math.abs(ms);
  const sign = ms < 0 ? '−' : '';
  if (a === 0) return '0 ms';
  if (a < 1) return `${sign}${Number((a * 1000).toPrecision(3))} µs`;
  if (a < 1000) return `${sign}${a < 10 ? a.toFixed(2) : a < 100 ? a.toFixed(1) : a.toFixed(0)} ms`;
  if (a < 60_000) return `${sign}${(a / 1000).toFixed(a < 10_000 ? 2 : 1)} s`;
  const m = Math.floor(a / 60_000);
  const s = Math.round((a % 60_000) / 1000);
  return `${sign}${m}m ${String(s).padStart(2, '0')}s`;
}

/* ══ Trace timeline — on a canvas ══
   One drawing for both orientations: everything here is in (along, across) px, and `orient` turns that into a canvas
   transform. The strip's along is x and its across is y. The rail swaps them, and mirrors on a right-hand rail, so across
   always starts at the outer edge and a depth bar reaches inward on either side.

   Rows draw at most one thing per device pixel along them (a run of equal pixels is one rectangle), by pooling first
   (lib/trace-timeline), so a redraw costs the pixels and not the marks. Colours come in resolved: the component reads
   them from the theme's CSS variables, and re-reads them when the theme changes. ══ */
import {
  TRACE_RULER, TRACE_WAVE_REST, laneEnd, poolBuckets, poolDensity, poolPresence, sortedTimes,
  type DensityPool, type TraceAxis, type TraceKey, type TraceLane, type TraceRequest, type TraceRow, type TraceStopMark, type TraceTick, type TraceTone, type TraceWindow,
} from '@/lib/trace-timeline-model';

export interface TraceColors {
  foreground: string;
  muted: string;
  faint: string;
  border: string;
  primary: string;
  background: string;
  surface: string;
  ruler: string;
  card: string;
  warning: string;
  success: string;
  error: string;
  chart: readonly string[];
}

export function toneColor(colors: TraceColors, tone: TraceTone | undefined): string {
  switch (tone) {
    case 'error': return colors.error;
    case 'warning': return colors.warning;
    case 'success': return colors.success;
    case 'info': return colors.primary;
    default: return colors.muted;
  }
}

export interface TraceFrame {
  ctx: CanvasRenderingContext2D;
  dpr: number;
  vertical: boolean;
  side: 'left' | 'right';
  /** The canvas, in CSS px. */
  width: number;
  height: number;
  /** Where the plot starts along the timeline, and how long it is, in CSS px. */
  start: number;
  length: number;
  /** Device pixels along the plot. */
  columns: number;
  axis: TraceAxis;
  win: TraceWindow;
  colors: TraceColors;
  font: string;
}

/** What one lane's threads answered, for the view it was fetched for. */
export interface TraceLaneActivity {
  /** Bucket edges, in the lane's own time. */
  edges: ArrayLike<number>;
  threads: ReadonlyMap<TraceKey, { counts: ArrayLike<number>; max: number }>;
  /** All the lane's threads together, for a rail column. */
  total: { counts: ArrayLike<number>; max: number };
}

/** Requests with the same colour, with their times as fractions of the axis: positions cost nothing per frame this way. */
export interface TraceRequestGroup {
  color: string;
  items: Array<{ request: TraceRequest; time: number; from: number; to: number }>;
}

/** Puts requests on an axis, grouped by colour. Their positions only change when the axis does. */
export function groupRequests(requests: readonly TraceRequest[], axis: TraceAxis, colorOf: (r: TraceRequest) => string): TraceRequestGroup[] {
  const groups = new Map<string, TraceRequestGroup>();
  for (const request of requests) {
    const color = colorOf(request);
    let group = groups.get(color);
    if (!group) groups.set(color, (group = { color, items: [] }));
    const hasBand = request.from !== undefined;
    group.items.push({
      request,
      time: axis.fraction(request.time),
      from: hasBand ? axis.fraction(request.from as number) : NaN,
      to: hasBand ? axis.fraction(request.to ?? (request.from as number)) : NaN,
    });
  }
  return [...groups.values()];
}

export interface TraceScene {
  rows: readonly TraceRow[];
  lanes: readonly TraceLane[];
  ticks: readonly TraceTick[];
  format: (time: number, resolution: number) => string;
  activity: ReadonlyMap<string, TraceLaneActivity>;
  focusedLane: string | null;
  selectedThread: TraceKey | null;
  selectedRequest: TraceKey | null;
  requests: readonly TraceRequestGroup[];
  requestsLabel?: string;
  stopsLabel?: string;
  stopMarks: ReadonlyArray<TraceStopMark>;
  /** Resolves any CSS colour a host passes to one a canvas takes. */
  color: (css: string) => string;
}

/** Scratch space sized to the plot, kept between redraws so scrubbing and zooming allocate nothing. */
export class TraceBuffers {
  columns = 0;
  edges = new Float64Array(1);
  alpha = new Uint8Array(0);
  reach = new Uint8Array(0);
  flags = new Uint8Array(0);
  buckets = new Float64Array(0);
  lines = new Int32Array(1);
  bands = new Int32Array(1);
  pools = new Map<string, DensityPool>();
  resize(columns: number) {
    if (columns === this.columns) return;
    this.columns = columns;
    this.edges = new Float64Array(columns + 1);
    this.alpha = new Uint8Array(columns);
    this.reach = new Uint8Array(columns);
    this.flags = new Uint8Array(columns);
    this.buckets = new Float64Array(columns);
    this.lines = new Int32Array(columns + 1);
    this.bands = new Int32Array(columns + 1);
    this.pools.clear();
  }
}

/** Opacity comes in this many steps, so neighbouring columns merge into one rectangle more often. */
const ALPHA_STEPS = 32;
const TAU = Math.PI * 2;

/** Makes the canvas's coordinates (along, across). */
function orient({ ctx, dpr, vertical, side, width }: TraceFrame) {
  if (!vertical) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  else if (side === 'left') ctx.setTransform(0, dpr, dpr, 0, 0, 0);
  else ctx.setTransform(0, dpr, -dpr, 0, width * dpr, 0);
}

function clear(f: TraceFrame) {
  f.ctx.setTransform(1, 0, 0, 1, 0, 0);
  f.ctx.clearRect(0, 0, Math.ceil(f.width * f.dpr), Math.ceil(f.height * f.dpr));
  orient(f);
  f.ctx.globalAlpha = 1;
}

/** A rail has no room for words: labels are the strip's, in its gutter. */
function label(f: TraceFrame, text: string | undefined, row: TraceRow, color = f.colors.muted) {
  if (f.vertical || !f.start || !text || row.size < 9) return;
  f.ctx.fillStyle = color;
  f.ctx.fillText(text, 6, row.at + row.size / 2, f.start - 12);
}

function background(f: TraceFrame, row: TraceRow, color = f.colors.surface) {
  if (f.vertical) return;
  f.ctx.fillStyle = color;
  f.ctx.fillRect(0, row.at, f.width, row.size);
}

/** Fills columns as runs of equal opacity and reach: `alpha` in ALPHA_STEPS, `reach` in device px, from `at` across. */
function fillRuns(f: TraceFrame, at: number, alpha: Uint8Array, reach: Uint8Array, base = 1) {
  const { ctx, dpr, start, columns } = f;
  let current = -1;
  for (let c = 0; c < columns;) {
    const a = alpha[c];
    if (!a) {
      c++;
      continue;
    }
    const r = reach[c];
    let end = c + 1;
    while (end < columns && alpha[end] === a && reach[end] === r) end++;
    if (a !== current) {
      current = a;
      ctx.globalAlpha = (a / ALPHA_STEPS) * base;
    }
    ctx.fillRect(start + c / dpr, at, (end - c) / dpr, r / dpr);
    c = end;
  }
  ctx.globalAlpha = 1;
}

/** Each lane's own colour: what the host passed, or else a chart token by position. A rail's columns have no labels for
 *  colours to tell apart, so there it's the tint for the lane in focus and gray for the rest, as calm as the dashes. */
function laneColor(f: TraceFrame, s: TraceScene, lane: TraceLane, index: number): string {
  if (lane.color) return s.color(lane.color);
  if (f.vertical) return lane.key === s.focusedLane ? f.colors.primary : f.colors.muted;
  return f.colors.chart[index % f.colors.chart.length];
}

function hashKey(key: TraceKey): number {
  if (typeof key === 'number') return Math.abs(Math.trunc(key));
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return h;
}

/* ── Rows ── */

function drawRuler(f: TraceFrame, s: TraceScene, bottom: number) {
  const { ctx, colors, start, width, length, dpr } = f;
  ctx.fillStyle = colors.ruler;
  ctx.fillRect(0, 0, width, TRACE_RULER);
  ctx.fillStyle = colors.border;
  for (const tick of s.ticks) ctx.fillRect(Math.round((start + tick.along) * dpr) / dpr, TRACE_RULER - 6, 1, bottom - TRACE_RULER + 6);
  ctx.fillStyle = colors.muted;
  for (const tick of s.ticks) if (tick.along + 3 < length) ctx.fillText(s.format(tick.time, tick.resolution), start + tick.along + 3, TRACE_RULER / 2);
}

function drawDiamonds(f: TraceFrame, s: TraceScene, row: TraceRow, b: TraceBuffers) {
  const { ctx, colors, dpr, start, columns } = f;
  const lane = row.lane as TraceLane;
  const bottom = laneEnd(s.rows, lane);
  const diamonds = lane.diamonds;
  if (!diamonds) return;
  background(f, row);
  label(f, diamonds.label, row);
  b.flags.fill(0);
  poolPresence(sortedTimes(diamonds.times), lane.offset ?? 0, b.edges, b.flags, 1);
  const color = diamonds.color ? s.color(diamonds.color) : colors.warning;
  const mid = row.at + row.size / 2;
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.18;
  for (let c = 0; c < columns; c++) if (b.flags[c]) ctx.fillRect(start + c / dpr, row.at + row.size, 1, bottom - row.at - row.size);
  ctx.globalAlpha = 1;
  ctx.beginPath();
  for (let c = 0; c < columns; c++) {
    if (!b.flags[c]) continue;
    const x = start + c / dpr;
    ctx.moveTo(x, row.at + 2);
    ctx.lineTo(x + 5, mid);
    ctx.lineTo(x, row.at + row.size - 2);
    ctx.lineTo(x - 5, mid);
    ctx.closePath();
  }
  ctx.fill();
}

/** The faint track behind a rail column, stronger on the focused lane. */
function track(f: TraceFrame, row: TraceRow, focused: boolean) {
  if (!f.vertical) return;
  f.ctx.fillStyle = f.colors.foreground;
  f.ctx.globalAlpha = focused ? 0.14 : 0.07;
  f.ctx.fillRect(f.start, row.at, f.length, row.size);
  f.ctx.globalAlpha = 1;
}

function drawDensity(f: TraceFrame, s: TraceScene, row: TraceRow, b: TraceBuffers) {
  const { ctx, dpr, columns } = f;
  const lane = row.lane as TraceLane;
  const focused = lane.key === s.focusedLane;
  background(f, row);
  track(f, row, focused);
  label(f, lane.density?.label, row);
  const base = f.vertical && !focused && s.lanes.length > 1 ? 0.6 : 1;
  const inset = row.size >= 8 ? 1 : 0;
  const offset = lane.offset ?? 0;
  const density = lane.density;
  if (density) {
    const pool = poolDensity(density, offset, b.edges, b.pools.get(lane.key));
    b.pools.set(lane.key, pool);
    const logMax = Math.log1p(pool.maxCount);
    // A deeper stack reaches further across the row, from at least a little. A rail's column is too thin for that to
    // read as anything but noise, so there it's opacity alone.
    const least = row.size >= 8 ? 4 : row.size;
    const room = row.size >= 8 ? row.size - inset * 2 - least : 0;
    const deepest = Math.max(1, pool.deepest);
    for (let c = 0; c < columns; c++) {
      const count = pool.counts[c];
      if (!count) {
        b.alpha[c] = 0;
        continue;
      }
      b.alpha[c] = Math.round((0.45 + (0.55 * Math.log1p(count)) / logMax) * ALPHA_STEPS);
      b.reach[c] = Math.round((density.depths ? least + (room * pool.depths[c]) / deepest : least + room) * dpr);
    }
    ctx.fillStyle = density.color ? s.color(density.color) : laneColor(f, s, lane, row.laneIndex ?? 0);
    fillRuns(f, row.at + inset, b.alpha, b.reach, base);
  }
  drawMarks(f, s, row, b);
}

function drawMarks(f: TraceFrame, s: TraceScene, row: TraceRow, b: TraceBuffers) {
  const { ctx, colors, dpr, start, columns } = f;
  const lane = row.lane as TraceLane;
  const offset = lane.offset ?? 0;
  const thin = row.size < 8;
  const inset = thin ? 0 : 1;
  for (const series of lane.marks ?? []) {
    const dot = series.shape === 'dot';
    // A dot needs a row to be round in. On a rail's column it has no room, and stops say what dots would.
    if (dot && thin) continue;
    b.flags.fill(0);
    poolPresence(sortedTimes(series.times), offset, b.edges, b.flags, 1);
    ctx.fillStyle = series.color ? s.color(series.color) : toneColor(colors, series.tone);
    if (dot) ctx.beginPath();
    for (let c = 0; c < columns; c++) {
      if (!b.flags[c]) continue;
      let end = c + 1;
      while (end < columns && b.flags[end]) end++;
      const x = start + c / dpr;
      const run = (end - c) / dpr;
      // Neighbouring dots run together into one bar with round ends, along the row's far edge.
      if (dot) ctx.roundRect(x - 2.5, row.at + row.size - 6.5, run + 5, 5, 2.5);
      else ctx.fillRect(x, row.at + inset, Math.max(thin ? 1 : 1.5, run), row.size - inset * 2);
      c = end;
    }
    if (dot) ctx.fill();
  }
}

function drawThread(f: TraceFrame, s: TraceScene, row: TraceRow, b: TraceBuffers) {
  const { ctx, colors, dpr, start, columns } = f;
  const lane = row.lane as TraceLane;
  const thread = row.thread;
  const focused = lane.key === s.focusedLane;
  const selected = !!thread && focused && thread.id === s.selectedThread;
  if (selected && !f.vertical) {
    ctx.fillStyle = colors.foreground;
    ctx.globalAlpha = 0.06;
    ctx.fillRect(0, row.at, f.width, row.size);
    ctx.globalAlpha = 1;
  }
  track(f, row, focused);
  label(f, thread?.label, row, selected ? colors.foreground : colors.muted);
  const color = thread
    ? thread.color ? s.color(thread.color) : colors.chart[hashKey(thread.id) % colors.chart.length]
    : laneColor(f, s, lane, row.laneIndex ?? 0);
  if (thread && !f.vertical && start >= 6) {
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.9;
    ctx.fillRect(start - 6, row.at + 1, 3, Math.max(0, row.size - 2));
    ctx.globalAlpha = 1;
  }
  const activity = s.activity.get(lane.key);
  const entry = thread ? activity?.threads.get(thread.id) : activity?.total;
  if (!activity || !entry) return;
  poolBuckets(activity.edges, entry.counts, lane.offset ?? 0, b.edges, b.buckets);
  // On a log scale, so sparse threads stay visible next to busy ones.
  const logMax = Math.log1p(Math.max(1, entry.max));
  const inset = row.size >= 4 && !f.vertical ? 1 : 0;
  const reach = Math.round((row.size - inset * 2) * dpr);
  for (let c = 0; c < columns; c++) {
    const count = b.buckets[c];
    b.alpha[c] = count ? Math.round((0.25 + (0.75 * Math.log1p(count)) / logMax) * ALPHA_STEPS) : 0;
    b.reach[c] = reach;
  }
  ctx.fillStyle = color;
  fillRuns(f, row.at + inset, b.alpha, b.reach, f.vertical && !focused && s.lanes.length > 1 ? 0.6 : 1);
}

/** Fills the runs a difference array describes, one rectangle each: `lines[c]` is how many spans start minus end at c. */
function fillSpans(f: TraceFrame, spans: Int32Array, at: number, size: number) {
  const { ctx, dpr, start, columns } = f;
  let depth = 0;
  let open = -1;
  for (let c = 0; c <= columns; c++) {
    depth += spans[c];
    if (depth > 0 && open < 0) open = c;
    else if ((depth <= 0 || c === columns) && open >= 0) {
      ctx.fillRect(start + open / dpr, at, (c - open) / dpr, size);
      open = -1;
    }
  }
}

function drawRequests(f: TraceFrame, s: TraceScene, row: TraceRow, b: TraceBuffers) {
  const { ctx, colors, dpr, start, columns, win } = f;
  background(f, row);
  track(f, row, false);
  label(f, s.requestsLabel, row);
  const mid = row.at + row.size / 2;
  const bandSize = Math.min(8, row.size);
  const r = Math.min(3, row.size / 2 + 0.5);
  const lineSize = Math.min(1, row.size);
  const perFraction = columns / (win.to - win.from);
  const columnOf = (fraction: number) => Math.floor((fraction - win.from) * perFraction);
  const fit = (c: number) => (c < 0 ? 0 : c > columns ? columns : c);
  const minBand = Math.max(1, Math.round(2 * dpr));
  let selected: { item: TraceRequestGroup['items'][number]; color: string } | null = null;
  for (const group of s.requests) {
    b.lines.fill(0);
    b.bands.fill(0);
    b.flags.fill(0);
    for (const item of group.items) {
      if (item.request.id === s.selectedRequest) selected = { item, color: group.color };
      const dot = columnOf(item.time);
      if (dot >= 0 && dot < columns) b.flags[dot] = 1;
      if (Number.isNaN(item.from)) continue;
      const from = columnOf(item.from);
      const to = Math.max(from + minBand, columnOf(item.to));
      const lineFrom = fit(Math.min(dot, from));
      const lineTo = fit(Math.max(dot, from));
      if (lineTo > lineFrom) {
        b.lines[lineFrom]++;
        b.lines[lineTo]--;
      }
      const bandFrom = fit(from);
      const bandTo = fit(to);
      if (bandTo > bandFrom) {
        b.bands[bandFrom]++;
        b.bands[bandTo]--;
      }
    }
    ctx.fillStyle = group.color;
    ctx.globalAlpha = 0.6;
    fillSpans(f, b.lines, mid - lineSize / 2, lineSize);
    fillSpans(f, b.bands, mid - bandSize / 2, bandSize);
    ctx.globalAlpha = 1;
    ctx.beginPath();
    for (let c = 0; c < columns; c++) {
      if (!b.flags[c]) continue;
      const x = start + (c + 0.5) / dpr;
      ctx.moveTo(x + r, mid);
      ctx.arc(x, mid, r, 0, TAU);
    }
    ctx.fill();
  }
  if (selected) {
    const { item, color } = selected as { item: TraceRequestGroup['items'][number]; color: string };
    const dot = columnOf(item.time);
    ctx.fillStyle = color;
    if (!Number.isNaN(item.from)) {
      const from = columnOf(item.from);
      const to = Math.max(from + minBand, columnOf(item.to));
      const lineFrom = fit(Math.min(dot, from));
      const lineTo = fit(Math.max(dot, from));
      ctx.fillRect(start + lineFrom / dpr, mid - lineSize / 2, (lineTo - lineFrom) / dpr, lineSize);
      ctx.fillRect(start + fit(from) / dpr, mid - bandSize / 2, (fit(to) - fit(from)) / dpr, bandSize);
    }
    if (dot >= 0 && dot < columns) {
      ctx.fillStyle = colors.foreground;
      ctx.beginPath();
      ctx.arc(start + (dot + 0.5) / dpr, mid, r + 1, 0, TAU);
      ctx.fill();
    }
  }
}

/** The strip's row of stops: the rail's dashes, standing up. The rail's own are in the DOM, where they can swell. */
function drawStops(f: TraceFrame, s: TraceScene, row: TraceRow) {
  const { ctx, colors, start } = f;
  background(f, row);
  label(f, s.stopsLabel, row);
  const mid = row.at + row.size / 2;
  for (const mark of s.stopMarks) {
    const length = (mark.stop.level ?? 1) > 1 ? TRACE_WAVE_REST - 3 : TRACE_WAVE_REST;
    ctx.fillStyle = mark.tone === 'default' ? colors.faint : toneColor(colors, mark.tone);
    ctx.globalAlpha = mark.dim ? 0.55 : 1;
    ctx.fillRect(start + mark.along - 1, mid - length / 2, 2, length);
  }
  ctx.globalAlpha = 1;
}

function drawTitle(f: TraceFrame, s: TraceScene, row: TraceRow) {
  const lane = row.lane as TraceLane;
  const focused = lane.key === s.focusedLane;
  f.ctx.fillStyle = focused ? f.colors.ruler : f.colors.surface;
  f.ctx.fillRect(0, row.at, f.width, row.size);
  f.ctx.fillStyle = focused ? f.colors.foreground : f.colors.muted;
  f.ctx.fillText(lane.title ?? lane.key, 6, row.at + row.size / 2);
}

/** Every row, from the column edges in `b.edges`. This is the part that follows the view: hovering and scrubbing only
 *  touch the overlay above it. */
export function drawTraceData(f: TraceFrame, s: TraceScene, b: TraceBuffers): void {
  const { ctx } = f;
  clear(f);
  ctx.font = f.font;
  ctx.textBaseline = 'middle';
  const bottom = f.vertical ? f.width : f.height;
  if (!f.vertical) drawRuler(f, s, bottom);
  for (const row of s.rows) {
    switch (row.type) {
      case 'title': drawTitle(f, s, row); break;
      case 'diamonds': drawDiamonds(f, s, row, b); break;
      case 'density': drawDensity(f, s, row, b); break;
      case 'thread': drawThread(f, s, row, b); break;
      case 'requests': drawRequests(f, s, row, b); break;
      case 'stops': drawStops(f, s, row); break;
    }
  }
}

/* ── The overlay ── */

export interface TraceOverlay {
  /** Px along the timeline, or null when it's off the view. Past the plot's end is fine: it dims nothing. */
  playhead: number;
  hover: { along: number; label?: string } | null;
  /** Which stretch across the timeline the plot covers: what's dimmed and what the hover line crosses. */
  from: number;
  to: number;
  /** A rail shows where the view sits on the whole axis, along its outer edge, when zoomed in. */
  thumb?: TraceWindow | null;
}

/** The future dimmed, the hover line and its time, the playhead. */
export function drawTraceOverlay(f: TraceFrame, o: TraceOverlay): void {
  const { ctx, colors, dpr, start, length, vertical, width, height } = f;
  clear(f);
  const end = start + length;
  const extent = vertical ? width : height;
  // On a device pixel, so the lines stay crisp as they move.
  const px = Math.round(o.playhead * dpr) / dpr;
  if (px < end) {
    const from = Math.max(start, px);
    ctx.fillStyle = colors.background;
    ctx.globalAlpha = 0.5;
    ctx.fillRect(from, o.from, end - from, o.to - o.from);
    ctx.globalAlpha = 1;
  }
  if (o.hover) {
    ctx.fillStyle = colors.foreground;
    ctx.globalAlpha = 0.25;
    ctx.fillRect(Math.round(o.hover.along * dpr) / dpr, o.from, 1, o.to - o.from);
    ctx.globalAlpha = 1;
  }
  if (px >= start && px <= end) {
    ctx.fillStyle = colors.primary;
    ctx.fillRect(px - 1, 0, 2, extent);
    if (!vertical) {
      ctx.beginPath();
      ctx.moveTo(px - 6, 0);
      ctx.lineTo(px + 6, 0);
      ctx.lineTo(px, 8);
      ctx.fill();
    }
  }
  // Over the playhead, so it can be read when the two meet.
  if (o.hover?.label && !vertical) {
    ctx.font = f.font;
    ctx.textBaseline = 'middle';
    const w = ctx.measureText(o.hover.label).width + 8;
    const lx = Math.min(width - w, o.hover.along + 4);
    ctx.fillStyle = colors.card;
    ctx.fillRect(lx, 2, w, 16);
    ctx.fillStyle = colors.foreground;
    ctx.fillText(o.hover.label, lx + 4, 10);
  }
  if (o.thumb) {
    const from = start + o.thumb.from * length;
    const size = Math.max(14, (o.thumb.to - o.thumb.from) * length);
    ctx.fillStyle = colors.muted;
    ctx.fillRect(Math.min(from, end - size), 0, size, 2);
  }
}

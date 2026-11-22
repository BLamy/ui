/* ══ Flame chart — on a canvas ══ @internal: FlameChart's drawing, not package API.
   Two layers. The data layer (`drawFlameData`) is the minimap, the ruler, the lanes and their spans, the links and the
   selection: it's drawn again only when the view, the scroll, the data, the selection or the highlight change. The
   overlay (`drawFlameOverlay`) is the playhead and what the pointer is over, which change far more often and cost
   almost nothing.

   A row costs what its pixels cost, not what its spans do. Its spans are found by binary search (lib/flame-chart-model's
   index), a span at least a device pixel wide is a bar, and narrower ones run together into one fill per run of
   neighbouring pixels of the same colour: after the first span in a pixel, a search jumps to the first span past it, so
   a million spans in a row are a few thousand steps. Errors and a highlight are drawn again on top from indexes of
   their own, so a red sliver or a search match never hides inside a run. Labels go on bars wide enough for them, with
   their widths measured once per name and font. Nothing here allocates per span. ══ */
import {
  FLAME_ERROR, FLAME_PENDING, FLAME_WAITING, rowWindow,
  type FlameData, type FlameIndex, type FlameLayout, type FlameRange,
} from '@/lib/flame-chart-model';
import type { TraceTick } from '@/lib/trace-timeline-model';

export interface FlameColors {
  foreground: string;
  muted: string;
  faint: string;
  border: string;
  primary: string;
  background: string;
  surface: string;
  ruler: string;
  card: string;
  destructive: string;
  warning: string;
}

export interface FlameFrame {
  ctx: CanvasRenderingContext2D;
  dpr: number;
  /** The canvas, in CSS px. */
  width: number;
  height: number;
  /** The label gutter's width; the plot starts there. */
  gutter: number;
  /** The plot's width, px. */
  plot: number;
  /** Where the body (the lanes) starts down the canvas: under the minimap and the ruler. */
  bodyTop: number;
  minimapHeight: number;
  rulerHeight: number;
  view: FlameRange;
  /** How far the lanes are scrolled, px. */
  scroll: number;
  colors: FlameColors;
  font: string;
  boldFont: string;
}

/** What the data layer draws. Colours come in resolved, by index. */
export interface FlameScene {
  data: FlameData;
  index: FlameIndex;
  layout: FlameLayout;
  range: FlameRange;
  /** `data.colors`, resolved. */
  spanColors: readonly string[];
  /** The text colour that reads on each of `spanColors`. */
  spanInk: readonly string[];
  /** Each lane's tint, resolved. */
  laneColors: readonly string[];
  ticks: readonly TraceTick[];
  format: (time: number, resolution: number) => string;
  selected: number;
  /** The highlighted spans' own index, and which spans they are; everything else is drawn dim. */
  lit: FlameIndex | null;
  litMask: Uint8Array | null;
  /** The errors' own index, drawn over everything so none hides in a run. */
  errors: FlameIndex | null;
  showLinks: boolean;
  /** The minimap's per-lane activity, or null for none. */
  minimap: FlameMinimap | null;
}

/** How busy each lane is at each minimap column: `values[lane * columns + c]`, with each lane's peak. */
export interface FlameMinimap {
  columns: number;
  values: Float32Array;
  peaks: Float32Array;
}

/** Scratch kept between redraws: label widths per name, and shortened labels. */
export class FlameBuffers {
  font = '';
  widths = new Float64Array(0);
  short = new Map<number, string>();
  ellipsis = 0;
  reset(font: string, names: number) {
    if (font === this.font && this.widths.length === names) return;
    this.font = font;
    this.widths = new Float64Array(names).fill(-1);
    this.short.clear();
    this.ellipsis = 0;
  }
}

/** What a data redraw did. */
export interface FlameDrawCounts {
  /** Spans drawn as bars of their own. */
  bars: number;
  /** Runs of spans too thin for a bar, one fill each. */
  runs: number;
  labels: number;
  links: number;
}

/** A bar this many CSS px wide or more gets a label. */
const LABEL_MIN = 28;
/** Spans not in a highlight are drawn this faint. */
const DIM = 0.22;
/** At most this many links are drawn in a view; past it they're sampled evenly. */
const MAX_LINKS = 1500;

/** Makes a minimap: how many spans are running at each of `columns` columns over `range`, per lane. A difference array,
 *  so it costs one pass over the spans and one over the columns. */
export function flameMinimap(data: FlameData, range: FlameRange, columns: number): FlameMinimap {
  const lanes = data.lanes.length;
  const cols = Math.max(1, Math.floor(columns));
  const diff = new Float32Array(lanes * (cols + 1));
  const scale = cols / (range.end - range.start || 1);
  for (let i = 0; i < data.start.length; i++) {
    const l = data.lane[i];
    if (l >= lanes) continue;
    const a = Math.max(0, Math.min(cols - 1, Math.floor((data.start[i] - range.start) * scale)));
    const b = Math.max(a + 1, Math.min(cols, Math.ceil((data.end[i] - range.start) * scale)));
    diff[l * (cols + 1) + a] += 1;
    diff[l * (cols + 1) + b] -= 1;
  }
  const values = new Float32Array(lanes * cols);
  const peaks = new Float32Array(lanes);
  for (let l = 0; l < lanes; l++) {
    let running = 0;
    for (let c = 0; c < cols; c++) {
      running += diff[l * (cols + 1) + c];
      values[l * cols + c] = running;
      if (running > peaks[l]) peaks[l] = running;
    }
  }
  return { columns: cols, values, peaks };
}

/** The relative luminance of a resolved CSS colour (`rgb()`, `oklch()`, `#hex`), 0…1, or null when it can't tell. */
export function luminance(css: string): number | null {
  const s = css.trim().toLowerCase();
  const nums = (s.match(/-?[\d.]+%?/g) ?? []).map((v) => (v.endsWith('%') ? parseFloat(v) / 100 : parseFloat(v)));
  if (s.startsWith('oklch(') || s.startsWith('oklab(')) {
    // OKLab lightness is perceptual; cubed it's close to relative luminance.
    return nums.length ? Math.max(0, Math.min(1, nums[0])) ** 3 : null;
  }
  let rgb: number[] | null = null;
  if (s.startsWith('#')) {
    const h = s.slice(1);
    const full = h.length === 3 || h.length === 4 ? h.split('').map((c) => c + c).join('') : h;
    rgb = [0, 2, 4].map((k) => parseInt(full.slice(k, k + 2), 16));
  } else if (s.startsWith('rgb')) {
    rgb = nums.slice(0, 3);
  } else if (s.startsWith('color(srgb')) {
    rgb = nums.slice(0, 3).map((v) => v * 255);
  }
  if (!rgb || rgb.some((v) => !Number.isFinite(v))) return null;
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** The ink that reads on a bar: the darker or the lighter of the theme's foreground and background. */
export function inkFor(bar: string, colors: Pick<FlameColors, 'foreground' | 'background'>): string {
  const lb = luminance(bar);
  const lf = luminance(colors.foreground) ?? 0;
  const lg = luminance(colors.background) ?? 1;
  const dark = lf < lg ? colors.foreground : colors.background;
  const light = lf < lg ? colors.background : colors.foreground;
  if (lb == null) return light;
  // Whichever has the larger contrast ratio.
  const ratio = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  return ratio(lb, Math.min(lf, lg)) >= ratio(lb, Math.max(lf, lg)) ? dark : light;
}

/** Draws the minimap, the ruler, the lanes, their spans and links, and the selection. */
export function drawFlameData(f: FlameFrame, s: FlameScene, b: FlameBuffers): FlameDrawCounts {
  const { ctx, dpr, width, height } = f;
  const counts: FlameDrawCounts = { bars: 0, runs: 0, labels: 0, links: 0 };
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, Math.ceil(width * dpr), Math.ceil(height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalAlpha = 1;
  ctx.font = f.font;
  ctx.textBaseline = 'middle';
  b.reset(f.font, s.data.names.length);
  if (!b.ellipsis) b.ellipsis = ctx.measureText('…').width;

  if (f.minimapHeight > 0) drawMinimap(f, s);
  drawLanes(f, s, b, counts);
  drawRuler(f, s);
  return counts;
}

function drawMinimap(f: FlameFrame, s: FlameScene) {
  const { ctx, colors, gutter, plot, minimapHeight: h, view } = f;
  ctx.fillStyle = colors.surface;
  ctx.fillRect(0, 0, f.width, h);
  ctx.fillStyle = colors.muted;
  ctx.textAlign = 'left';
  if (gutter > 40) ctx.fillText('Overview', 8, h / 2, gutter - 16);
  const m = s.minimap;
  const lanes = s.data.lanes.length;
  if (m && lanes) {
    const band = (h - 6) / lanes;
    const step = plot / m.columns;
    for (let l = 0; l < lanes; l++) {
      const peak = m.peaks[l];
      if (!peak) continue;
      const base = 3 + band * (l + 1);
      ctx.fillStyle = s.laneColors[l];
      ctx.globalAlpha = 0.75;
      ctx.beginPath();
      ctx.moveTo(gutter, base);
      for (let c = 0; c < m.columns; c++) {
        const v = m.values[l * m.columns + c];
        // A square root, so a quiet lane next to a busy one still shows.
        const y = base - (v > 0 ? Math.max(1, Math.sqrt(v / peak) * (band - 1)) : 0);
        ctx.lineTo(gutter + c * step, y);
        ctx.lineTo(gutter + (c + 1) * step, y);
      }
      ctx.lineTo(gutter + plot, base);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  // The view, as a window: outside it dimmed.
  const span = s.range.end - s.range.start || 1;
  const x0 = gutter + ((view.start - s.range.start) / span) * plot;
  const x1 = gutter + ((view.end - s.range.start) / span) * plot;
  if (x0 > gutter + 0.5 || x1 < gutter + plot - 0.5) {
    ctx.fillStyle = colors.background;
    ctx.globalAlpha = 0.6;
    ctx.fillRect(gutter, 0, Math.max(0, x0 - gutter), h);
    ctx.fillRect(x1, 0, Math.max(0, gutter + plot - x1), h);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = colors.primary;
    ctx.lineWidth = 1.5;
    const w = Math.max(3, x1 - x0);
    ctx.strokeRect(Math.min(x0, gutter + plot - w) + 0.75, 1.25, w - 1.5, h - 2.5);
  }
  ctx.fillStyle = colors.border;
  ctx.fillRect(0, h - 1, f.width, 1);
}

function drawRuler(f: FlameFrame, s: FlameScene) {
  const { ctx, colors, gutter, plot, minimapHeight: top, rulerHeight: h, width } = f;
  ctx.fillStyle = colors.ruler;
  ctx.fillRect(0, top, width, h);
  ctx.fillStyle = colors.border;
  ctx.fillRect(0, top + h - 1, width, 1);
  ctx.save();
  ctx.beginPath();
  ctx.rect(gutter, top, plot, h);
  ctx.clip();
  ctx.textAlign = 'left';
  for (const tick of s.ticks) {
    const x = Math.round((gutter + tick.along) * f.dpr) / f.dpr;
    ctx.fillStyle = colors.border;
    ctx.fillRect(x, top + h - 6, 1, 6);
    ctx.fillStyle = colors.muted;
    ctx.fillText(s.format(tick.time, tick.resolution), x + 3, top + h / 2);
  }
  ctx.restore();
  ctx.fillStyle = colors.border;
  ctx.fillRect(gutter - 1, top, 1, h);
}

/** The lanes: their headers and gutter, the grid, the spans, the links and the selection, clipped to the body. */
function drawLanes(f: FlameFrame, s: FlameScene, b: FlameBuffers, counts: FlameDrawCounts) {
  const { ctx, colors, gutter, plot, bodyTop, scroll, width, height } = f;
  const { layout, data } = s;
  const bodyHeight = height - bodyTop;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, bodyTop, width, bodyHeight);
  ctx.clip();
  // Lane bands, under everything.
  for (let l = 0; l < data.lanes.length; l++) {
    const y = bodyTop + layout.tops[l] - scroll;
    const h = layout.heights[l];
    if (y > height || y + h < bodyTop) continue;
    ctx.fillStyle = s.laneColors[l];
    ctx.globalAlpha = 0.05;
    ctx.fillRect(gutter, y, plot, h);
    ctx.globalAlpha = 0.12;
    ctx.fillRect(gutter, y, plot, layout.header);
    ctx.globalAlpha = 1;
  }
  // The grid.
  ctx.fillStyle = colors.border;
  ctx.globalAlpha = 0.6;
  for (const tick of s.ticks) ctx.fillRect(Math.round((gutter + tick.along) * f.dpr) / f.dpr, bodyTop, 1, bodyHeight);
  ctx.globalAlpha = 1;

  // Spans, clipped to the plot.
  ctx.save();
  ctx.beginPath();
  ctx.rect(gutter, bodyTop, plot, bodyHeight);
  ctx.clip();
  drawSpans(f, s, b, s.index, s.lit ? DIM : 1, !s.lit, counts);
  if (s.lit) drawSpans(f, s, b, s.lit, 1, true, counts);
  if (s.errors) drawSpans(f, s, b, s.errors, 1, false, counts, true);
  if (s.showLinks) drawLinks(f, s, counts);
  drawSelection(f, s);
  ctx.restore();

  // The gutter: each lane's title, and its separators.
  ctx.fillStyle = colors.background;
  ctx.fillRect(0, bodyTop, gutter, bodyHeight);
  for (let l = 0; l < data.lanes.length; l++) {
    const y = bodyTop + layout.tops[l] - scroll;
    const h = layout.heights[l];
    if (y > height || y + h < bodyTop) continue;
    const lane = data.lanes[l];
    // The lane's colour as a swatch, and a chevron that says whether it's open.
    ctx.fillStyle = s.laneColors[l];
    ctx.fillRect(0, y, 3, h);
    ctx.fillStyle = colors.muted;
    ctx.beginPath();
    const cx = 13;
    const cy = y + layout.header / 2;
    if (layout.collapsed[l]) {
      ctx.moveTo(cx - 2, cy - 4);
      ctx.lineTo(cx + 3, cy);
      ctx.lineTo(cx - 2, cy + 4);
    } else {
      ctx.moveTo(cx - 4, cy - 2);
      ctx.lineTo(cx + 4, cy - 2);
      ctx.lineTo(cx, cy + 3);
    }
    ctx.closePath();
    ctx.fill();
    ctx.textAlign = 'left';
    ctx.font = f.boldFont;
    ctx.fillStyle = colors.foreground;
    fitText(ctx, lane.title, 22, cy, gutter - 30);
    ctx.font = f.font;
    if (lane.subtitle && !layout.collapsed[l] && h >= layout.header + 14) {
      ctx.fillStyle = colors.muted;
      fitText(ctx, lane.subtitle, 22, y + layout.header + 8, gutter - 30);
    }
    ctx.fillStyle = colors.border;
    ctx.fillRect(0, y + h - 1, width, 1);
  }
  ctx.fillStyle = colors.border;
  ctx.fillRect(gutter - 1, bodyTop, 1, bodyHeight);
  // How far down the lanes are, when they don't all fit.
  if (layout.total > bodyHeight) {
    const thumb = Math.max(18, (bodyHeight / layout.total) * bodyHeight);
    const at = bodyTop + (scroll / (layout.total - bodyHeight)) * (bodyHeight - thumb);
    ctx.fillStyle = colors.muted;
    ctx.globalAlpha = 0.45;
    ctx.fillRect(width - 4, at, 3, thumb);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

/** A label shortened with an ellipsis to fit `max` px (gutter titles: few, so measured each time). */
function fitText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, max: number) {
  if (max <= 8) return;
  let shown = text;
  if (ctx.measureText(shown).width > max) {
    let lo = 0;
    let hi = text.length;
    while (lo < hi) {
      const mid = (lo + hi + 1) >>> 1;
      if (ctx.measureText(text.slice(0, mid) + '…').width <= max) lo = mid;
      else hi = mid - 1;
    }
    shown = lo ? text.slice(0, lo) + '…' : '';
  }
  if (shown) ctx.fillText(shown, x, y);
}

/** Every visible row of an index: bars, runs and labels. `errorsOnly` draws in the error colour, as thin as a pixel. */
function drawSpans(f: FlameFrame, s: FlameScene, b: FlameBuffers, index: FlameIndex, alpha: number, labels: boolean, counts: FlameDrawCounts, errorsOnly = false) {
  const { ctx, dpr, gutter, plot, bodyTop, scroll, height, view, colors } = f;
  const { layout, data } = s;
  const t0 = view.start;
  const t1 = view.end;
  const scale = (plot * dpr) / (t1 - t0 || 1); // device px per ms
  const columns = Math.ceil(plot * dpr);
  const rowHeight = layout.rowHeight;
  const barHeight = Math.max(2, rowHeight - 2);
  ctx.globalAlpha = alpha;
  let style = '';
  for (let l = 0; l < data.lanes.length; l++) {
    const laneY = bodyTop + layout.tops[l] - scroll;
    if (laneY > height || laneY + layout.heights[l] < bodyTop) continue;
    const collapsed = !!layout.collapsed[l];
    const rows = collapsed ? Math.min(1, index.laneRows[l]) : index.laneRows[l];
    for (let r = 0; r < rows; r++) {
      // A collapsed lane shows its top row as a thin strip along its header.
      const y = collapsed ? laneY + layout.header - 6 : laneY + layout.header + r * rowHeight + 1;
      const h = collapsed ? 4 : barHeight;
      if (y > height || y + h < bodyTop) continue;
      const row = index.laneBase[l] + r;
      const [lo, hi] = rowWindow(index, row, t0, t1);
      // The run of thin spans being gathered: device columns, and its colour.
      let runFrom = -1;
      let runTo = -1;
      let runStyle = '';
      let k = lo;
      while (k < hi) {
        const e = index.ends[k];
        if (e < t0) {
          k++;
          continue;
        }
        const i = index.order[k];
        const x0 = (index.starts[k] - t0) * scale;
        const x1 = (e - t0) * scale;
        const fl = data.flags[i];
        const color = errorsOnly || fl & FLAME_ERROR ? colors.destructive : s.spanColors[data.color[i]];
        if (x1 - x0 >= 1 && !collapsed) {
          if (runFrom >= 0) {
            if (runStyle !== style) ctx.fillStyle = style = runStyle;
            ctx.fillRect(gutter + runFrom / dpr, y, (runTo - runFrom + 1) / dpr, h);
            counts.runs++;
            runFrom = -1;
          }
          const left = Math.max(-2, x0);
          const right = Math.min(columns + 2, x1);
          const bx = gutter + left / dpr;
          const bw = Math.max(1 / dpr, (right - left) / dpr);
          if (fl & (FLAME_WAITING | FLAME_PENDING)) {
            // Outlined: it was waiting, or hadn't finished.
            if (color !== style) ctx.fillStyle = style = color;
            ctx.globalAlpha = alpha * 0.16;
            ctx.fillRect(bx, y, bw, h);
            ctx.globalAlpha = alpha;
            ctx.strokeStyle = color;
            ctx.lineWidth = 1;
            if (fl & FLAME_PENDING) ctx.setLineDash([3, 2]);
            ctx.strokeRect(bx + 0.5, y + 0.5, Math.max(0, bw - 1), h - 1);
            if (fl & FLAME_PENDING) ctx.setLineDash([]);
          } else {
            if (color !== style) ctx.fillStyle = style = color;
            ctx.fillRect(bx, y, bw, h);
          }
          counts.bars++;
          if (labels && bw >= LABEL_MIN && h >= 10) {
            const ink = fl & (FLAME_WAITING | FLAME_PENDING) ? colors.foreground : errorsOnly || fl & FLAME_ERROR ? colors.background : s.spanInk[data.color[i]];
            if (label(ctx, b, data, i, bx, bw, y + h / 2, ink)) {
              counts.labels++;
              ctx.fillStyle = style;
            }
          }
          k++;
          continue;
        }
        // Thin: into the run, then past every other span that starts in this pixel.
        const col = Math.max(0, Math.floor(x0));
        if (runFrom >= 0 && color === runStyle && col <= runTo + 1) {
          if (col > runTo) runTo = col;
        } else {
          if (runFrom >= 0) {
            if (runStyle !== style) ctx.fillStyle = style = runStyle;
            ctx.fillRect(gutter + runFrom / dpr, y, (runTo - runFrom + 1) / dpr, h);
            counts.runs++;
            runFrom = -1;
          }
          runFrom = col;
          runTo = Math.min(columns - 1, Math.max(col, Math.floor(x1)));
          runStyle = color;
        }
        if (collapsed) {
          // A collapsed lane's strip is all runs; a long span is one too.
          runTo = Math.max(runTo, Math.min(columns - 1, Math.floor(x1)));
        }
        const next = t0 + (col + 1) / scale;
        const j = lowerFrom(index.starts, next, k + 1, hi);
        if (j > k + 1 && index.reach[j - 1] > next) {
          // Something that starts in this pixel runs past it: the last one does when the row doesn't overlap itself.
          k = index.ends[j - 1] === index.reach[j - 1] ? j - 1 : k + 1;
        } else {
          k = j;
        }
      }
      if (runFrom >= 0) {
        if (runStyle !== style) ctx.fillStyle = style = runStyle;
        ctx.fillRect(gutter + runFrom / dpr, y, (runTo - runFrom + 1) / dpr, h);
        counts.runs++;
        runFrom = -1;
      }
    }
  }
  ctx.globalAlpha = 1;
}

/** The first position at or after `from` whose start is at least `value`: a gallop, then a binary search, so a step to
 *  the next pixel costs what the gap costs. */
function lowerFrom(sorted: Float64Array, value: number, from: number, hi: number): number {
  if (from >= hi || sorted[from] >= value) return from;
  let step = 1;
  let lo = from;
  let probe = from + 1;
  while (probe < hi && sorted[probe] < value) {
    lo = probe;
    step *= 2;
    probe = from + step;
  }
  let top = Math.min(probe, hi);
  lo += 1;
  while (lo < top) {
    const mid = (lo + top) >>> 1;
    if (sorted[mid] < value) lo = mid + 1;
    else top = mid;
  }
  return lo;
}

/** A span's name on its bar, held at the plot's left edge while the bar runs off it. Its width is measured once per name
 *  and font; a shortened one is kept per length. */
function label(ctx: CanvasRenderingContext2D, b: FlameBuffers, data: FlameData, i: number, bx: number, bw: number, cy: number, ink: string): boolean {
  const n = data.name[i];
  const text = data.names[n];
  if (!text) return false;
  let w = b.widths[n];
  if (w < 0) w = b.widths[n] = ctx.measureText(text).width;
  const room = bw - 8;
  if (room < 14) return false;
  let shown = text;
  if (w > room) {
    const chars = Math.floor(((room - b.ellipsis) / w) * text.length);
    if (chars < 4) return false;
    const key = n * 1024 + Math.min(1023, chars);
    let cut = b.short.get(key);
    if (cut === undefined) {
      cut = text.slice(0, chars) + '…';
      if (b.short.size > 20_000) b.short.clear();
      b.short.set(key, cut);
    }
    shown = cut;
  }
  ctx.fillStyle = ink;
  ctx.fillText(shown, bx + 4, cy);
  return true;
}

/** Where a span's bar edge is in the body, for a link: its top or bottom, or its lane's header when collapsed. */
function anchorY(f: FlameFrame, s: FlameScene, i: number, bottom: boolean): number {
  const { layout } = s;
  const l = s.data.lane[i];
  const top = f.bodyTop + layout.tops[l] - f.scroll;
  if (layout.collapsed[l]) return top + layout.header / 2;
  const y = top + layout.header + s.data.depth[i] * layout.rowHeight + 1;
  return bottom ? y + layout.rowHeight - 2 : y;
}

/** Curves from a caller to what it caused in another lane: from where the caller was when the other side started on it,
 *  to that start. Only links arriving in the view, at most MAX_LINKS of them, sampled evenly past that. */
function drawLinks(f: FlameFrame, s: FlameScene, counts: FlameDrawCounts) {
  const { ctx, view, gutter, plot, bodyTop, height, colors } = f;
  const { links } = s.index;
  const { data } = s;
  const span = view.end - view.start || 1;
  const pad = span * 0.02;
  let lo = 0;
  let hi = links.at.length;
  // Binary searches on when each link arrives.
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (links.at[mid] < view.start - pad) lo = mid + 1;
    else hi = mid;
  }
  const first = lo;
  hi = links.at.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (links.at[mid] <= view.end + pad) lo = mid + 1;
    else hi = mid;
  }
  const last = lo;
  const total = last - first;
  if (total <= 0) return;
  const stride = total > MAX_LINKS ? total / MAX_LINKS : 1;
  const crowded = total > 300;
  const xOf = (t: number) => gutter + ((t - view.start) / span) * plot;
  const strongOf = (a: number, b: number) => a === s.selected || b === s.selected;
  ctx.lineWidth = crowded ? 1 : 1.5;
  for (let pass = 0; pass < 2; pass++) {
    for (let q = 0; q < total; q += stride) {
      const k = first + Math.floor(q);
      const a = links.from[k];
      const b = links.to[k];
      const strong = strongOf(a, b);
      if ((pass === 1) !== strong) continue;
      drawLink(a, b, strong);
    }
    // The selected span's own links, even when sampling skipped them.
    if (pass === 1 && stride > 1 && s.selected >= 0) {
      const p = data.parent[s.selected];
      if (p >= 0 && data.lane[p] !== data.lane[s.selected]) drawLink(p, s.selected, true);
    }
  }
  ctx.globalAlpha = 1;

  function drawLink(a: number, b: number, strong: boolean) {
    const down = data.lane[b] > data.lane[a] || (data.lane[b] === data.lane[a] && data.depth[b] > data.depth[a]);
    const fromY = anchorY(f, s, a, down);
    const toY = anchorY(f, s, b, !down);
    if ((fromY < bodyTop && toY < bodyTop) || (fromY > height && toY > height)) return;
    const fromX = xOf(Math.min(Math.max(data.start[b], data.start[a]), data.end[a]));
    const toX = xOf(data.start[b]);
    const lit = !s.litMask || strong || (!!s.litMask[a] && !!s.litMask[b]);
    const bend = Math.max(12, Math.abs(toY - fromY) * 0.45) * (down ? 1 : -1);
    const tint = s.laneColors[data.lane[a]];
    ctx.strokeStyle = strong ? colors.foreground : tint;
    ctx.globalAlpha = strong ? 1 : !lit ? 0.08 : crowded ? 0.3 : 0.75;
    ctx.lineWidth = strong ? 2 : crowded ? 1 : 1.5;
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.bezierCurveTo(fromX, fromY + bend, toX, toY - bend, toX, toY);
    ctx.stroke();
    counts.links++;
    if (crowded && !strong) return;
    // A dot where it left, an arrowhead where it arrived.
    ctx.fillStyle = ctx.strokeStyle;
    ctx.beginPath();
    ctx.arc(fromX, fromY, strong ? 2.75 : 2, 0, Math.PI * 2);
    ctx.fill();
    const head = strong ? 6 : 5;
    const dir = down ? 1 : -1;
    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(toX - head * 0.65, toY - head * dir);
    ctx.lineTo(toX + head * 0.65, toY - head * dir);
    ctx.closePath();
    ctx.fill();
  }
}

function drawSelection(f: FlameFrame, s: FlameScene) {
  const i = s.selected;
  const { data, layout } = s;
  if (i < 0 || i >= data.start.length) return;
  const l = data.lane[i];
  if (l >= data.lanes.length) return;
  const { ctx, view, gutter, plot, bodyTop, colors } = f;
  const span = view.end - view.start || 1;
  const x0 = gutter + ((data.start[i] - view.start) / span) * plot;
  const x1 = gutter + ((data.end[i] - view.start) / span) * plot;
  const collapsed = layout.collapsed[l];
  const y = bodyTop + layout.tops[l] - f.scroll + (collapsed ? layout.header - 7 : layout.header + data.depth[i] * layout.rowHeight);
  const h = collapsed ? 6 : layout.rowHeight;
  const w = Math.max(3, x1 - x0);
  ctx.strokeStyle = colors.foreground;
  ctx.lineWidth = 2;
  ctx.strokeRect(Math.max(gutter - 2, x0 - 1), y, Math.min(w + 2, gutter + plot + 2 - Math.max(gutter - 2, x0 - 1)), h);
}

/* ── The overlay ── */

export interface FlameOverlay {
  /** The playhead's x, px, or null when it's off the plot. */
  playhead: number | null;
  /** The hover line's x and its time, or null. */
  hover: { x: number; label: string } | null;
  /** The hovered span's box, px. */
  box: { x: number; y: number; w: number; h: number } | null;
}

/** The playhead (through the ruler and the lanes, with a head), the hover line with its time in the ruler, and an
 *  outline round the span under the pointer. */
export function drawFlameOverlay(f: FlameFrame, o: FlameOverlay): void {
  const { ctx, dpr, width, height, colors, gutter, plot, minimapHeight, rulerHeight } = f;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, Math.ceil(width * dpr), Math.ceil(height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalAlpha = 1;
  const rulerTop = minimapHeight;
  if (o.box) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(gutter, f.bodyTop, plot, height - f.bodyTop);
    ctx.clip();
    ctx.strokeStyle = colors.foreground;
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = 1;
    ctx.strokeRect(o.box.x - 0.5, o.box.y - 0.5, Math.max(2, o.box.w + 1), o.box.h + 1);
    ctx.restore();
    ctx.globalAlpha = 1;
  }
  if (o.hover) {
    const x = Math.round(o.hover.x * dpr) / dpr;
    ctx.fillStyle = colors.foreground;
    ctx.globalAlpha = 0.25;
    ctx.fillRect(x, rulerTop, 1, height - rulerTop);
    ctx.globalAlpha = 1;
  }
  if (o.playhead != null) {
    const px = Math.round(o.playhead * dpr) / dpr;
    ctx.fillStyle = colors.primary;
    ctx.fillRect(px - 1, 0, 2, height);
    ctx.beginPath();
    ctx.moveTo(px - 6, rulerTop);
    ctx.lineTo(px + 6, rulerTop);
    ctx.lineTo(px, rulerTop + 8);
    ctx.fill();
  }
  if (o.hover?.label) {
    ctx.font = f.font;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    const w = ctx.measureText(o.hover.label).width + 8;
    const lx = Math.max(gutter, Math.min(width - w, o.hover.x + 4));
    ctx.fillStyle = colors.card;
    ctx.fillRect(lx, rulerTop + 3, w, rulerHeight - 6);
    ctx.fillStyle = colors.foreground;
    ctx.fillText(o.hover.label, lx + 4, rulerTop + rulerHeight / 2);
  }
}


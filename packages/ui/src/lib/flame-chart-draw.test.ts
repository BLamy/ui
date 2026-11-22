import { describe, expect, it } from 'vitest';
import {
  FLAME_ERROR, FLAME_MINIMAP, FLAME_RULER, FLAME_WAITING, flameData, flameIndex, flameTicks, layoutLanes, subIndex,
  type FlameData, type FlameLane, type FlameRange,
} from '@/lib/flame-chart-model';
import { FlameBuffers, drawFlameData, drawFlameOverlay, flameMinimap, inkFor, luminance, type FlameColors, type FlameFrame, type FlameScene } from '@/lib/flame-chart-draw';

const COLORS: FlameColors = {
  foreground: 'rgb(10, 10, 10)', muted: 'muted', faint: 'faint', border: 'border', primary: 'primary', background: 'rgb(255, 255, 255)',
  surface: 'surface', ruler: 'ruler', card: 'card', destructive: 'red', warning: 'warning',
};

/** Records what a canvas is told to do. */
function fakeContext() {
  const ops = { fillRect: 0, strokeRect: 0, stroke: 0, fill: 0, text: [] as string[], measured: 0, rects: [] as Array<{ x: number; y: number; w: number; h: number; style: string; alpha: number }> };
  const ctx = {
    fillStyle: '' as string,
    strokeStyle: '' as string,
    globalAlpha: 1,
    lineWidth: 1,
    font: '',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    setTransform: () => {},
    clearRect: () => {},
    save: () => {},
    restore: () => {},
    clip: () => {},
    rect: () => {},
    fillRect(x: number, y: number, w: number, h: number) {
      ops.fillRect++;
      if (ops.rects.length < 200_000) ops.rects.push({ x, y, w, h, style: String(ctx.fillStyle), alpha: ctx.globalAlpha });
    },
    strokeRect: () => { ops.strokeRect++; },
    fillText: (text: string) => { ops.text.push(text); },
    measureText: (text: string) => {
      ops.measured++;
      return { width: text.length * 6 };
    },
    setLineDash: () => {},
    beginPath: () => {},
    closePath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    bezierCurveTo: () => {},
    arc: () => {},
    stroke: () => { ops.stroke++; },
    fill: () => { ops.fill++; },
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, ops };
}

function frame(ctx: CanvasRenderingContext2D, view: FlameRange, over: Partial<FlameFrame> = {}): FlameFrame {
  return {
    ctx, dpr: 2, width: 1348, height: 600, gutter: 148, plot: 1200, bodyTop: FLAME_MINIMAP + FLAME_RULER, minimapHeight: FLAME_MINIMAP, rulerHeight: FLAME_RULER,
    view, scroll: 0, colors: COLORS, font: '11px sans-serif', boldFont: '600 11px sans-serif', ...over,
  };
}

function scene(data: FlameData, range: FlameRange, view: FlameRange, over: Partial<FlameScene> = {}): FlameScene {
  const index = flameIndex(data);
  return {
    data, index, layout: layoutLanes(index, [], data.lanes), range,
    spanColors: data.colors.map((c) => `resolved(${c})`), spanInk: data.colors.map(() => 'ink'), laneColors: data.lanes.map((_, l) => `lane${l}`),
    ticks: flameTicks(range, view, 1200), format: (t) => `${t}`, selected: -1, lit: null, litMask: null, errors: null, showLinks: true, minimap: null,
    ...over,
  };
}

/** `n` spans in requests of 41 (a root, 8 children, 4 grandchildren each), one lane in four per request, every 15 ms;
 *  one span in 97 failed, and each request's first child is answered in the next lane. In order of start, as a tracer
 *  writes them. */
function synthetic(n: number, laneCount = 4): FlameData {
  const lanes: FlameLane[] = Array.from({ length: laneCount }, (_, l) => ({ key: `svc-${l}`, title: `Service ${l}` }));
  const start = new Float64Array(n);
  const end = new Float64Array(n);
  const lane = new Uint16Array(n);
  const depth = new Uint16Array(n);
  const parent = new Int32Array(n);
  const name = new Uint32Array(n);
  const color = new Uint16Array(n);
  const flags = new Uint8Array(n);
  let i = 0;
  const put = (s: number, e: number, l: number, d: number, p: number, kind: number) => {
    if (i >= n) return -1;
    start[i] = s;
    end[i] = e;
    lane[i] = l;
    depth[i] = d;
    parent[i] = p;
    name[i] = kind;
    color[i] = l;
    flags[i] = i % 97 === 0 ? FLAME_ERROR : i % 89 === 0 ? FLAME_WAITING : 0;
    return i++;
  };
  for (let r = 0; i < n; r++) {
    const t = r * 15;
    const l = r % laneCount;
    const root = put(t, t + 50, l, 0, -1, 0);
    for (let c = 0; c < 8 && i < n; c++) {
      const cs = t + 1 + c * 6;
      // The first child ran in the next lane: a cross-lane link. It starts its own rows there.
      const cl = c === 0 ? (l + 1) % laneCount : l;
      const child = put(cs, cs + 5, cl, c === 0 ? 3 : 1, root, 1 + c);
      for (let g = 0; g < 4 && i < n; g++) put(cs + g * 1.2, cs + g * 1.2 + 1, cl, c === 0 ? 4 : 2, child, 9 + g);
    }
  }
  const names = ['request', ...Array.from({ length: 8 }, (_, c) => `step ${c}`), ...Array.from({ length: 4 }, (_, g) => `query ${g}`)];
  const data: FlameData = { lanes, start, end, lane, depth, parent, name, names, color, colors: lanes.map((_, l) => `var(--chart-${l + 1})`), flags };
  return data;
}

describe('a million spans', () => {
  const data = synthetic(1_000_000);
  const range = { start: 0, end: data.end[data.end.length - 1] };

  it('draws the whole view with far fewer fills than spans, fast', () => {
    const index = flameIndex(data);
    const errorMask = new Uint8Array(data.flags.length);
    for (let i = 0; i < errorMask.length; i++) errorMask[i] = data.flags[i] & FLAME_ERROR;
    const errors = subIndex(data, errorMask);
    const { ctx, ops } = fakeContext();
    const f = frame(ctx, range);
    const s = scene(data, range, range, { errors, minimap: flameMinimap(data, range, 600) });
    const b = new FlameBuffers();
    drawFlameData(f, s, b); // warm up
    ops.fillRect = 0;
    const began = performance.now();
    const counts = drawFlameData(f, s, b);
    const ms = performance.now() - began;
    // Each visible row is at most one fill per device column (2400), and runs merge most of those.
    const rows = index.rows;
    expect(ops.fillRect).toBeLessThan(rows * 2400 + 500);
    expect(ops.fillRect).toBeLessThan(60_000);
    expect(counts.bars + counts.runs).toBeLessThan(data.start.length / 20);
    // Generous for a slow CI machine; on a laptop it's a few milliseconds.
    expect(ms).toBeLessThan(250);
  });

  it('draws a zoomed view as bars with labels, and only links that arrive in it', () => {
    const view = { start: range.end / 2, end: range.end / 2 + 120 };
    const { ctx, ops } = fakeContext();
    const counts = drawFlameData(frame(ctx, view), scene(data, range, view), new FlameBuffers());
    expect(counts.bars).toBeGreaterThan(20);
    expect(counts.labels).toBeGreaterThan(5);
    expect(counts.links).toBeGreaterThan(0);
    expect(counts.links).toBeLessThan(20);
    expect(ops.text.some((t) => t.startsWith('request') || t.startsWith('step'))).toBe(true);
  });
});

describe('drawing', () => {
  const lanes: FlameLane[] = [{ key: 'web', title: 'Web', subtitle: 'pod-1' }, { key: 'api', title: 'API' }];
  const data = flameData(lanes, [
    { id: 'root', lane: 'web', name: 'GET /checkout and a name too long to fit on its bar', start: 0, end: 100 },
    { id: 'call', parent: 'root', lane: 'web', name: 'fetch', start: 10, end: 90, waiting: true },
    { id: 'svc', parent: 'call', lane: 'api', name: 'POST /cart', start: 12, end: 80 },
    { id: 'bad', parent: 'svc', lane: 'api', name: 'db', start: 20, end: 20.01, error: true },
  ]);
  const range = { start: 0, end: 100 };

  it('fills solid spans, outlines waiting ones, and labels what fits with an ellipsis', () => {
    const { ctx, ops } = fakeContext();
    const counts = drawFlameData(frame(ctx, range, { plot: 300 }), scene(data, range, range), new FlameBuffers());
    expect(counts.bars).toBe(3);
    expect(ops.strokeRect).toBeGreaterThanOrEqual(1);
    expect(ops.text).toContain('Web');
    expect(ops.text).toContain('pod-1');
    expect(ops.text.some((t) => t.startsWith('GET /checkout') && t.endsWith('…'))).toBe(true);
    // The thin error is a run, in the error colour.
    expect(ops.rects.some((r) => r.style === 'red')).toBe(true);
  });

  it('measures a name once per font', () => {
    const { ctx, ops } = fakeContext();
    const b = new FlameBuffers();
    drawFlameData(frame(ctx, range), scene(data, range, range), b);
    const first = ops.measured;
    drawFlameData(frame(ctx, range), scene(data, range, range), b);
    // The second draw only measures the gutter's titles again.
    expect(ops.measured - first).toBeLessThan(first);
  });

  it('dims what isn\'t lit and draws the lit spans again at full strength', () => {
    const { ctx, ops } = fakeContext();
    const mask = Uint8Array.of(0, 0, 1, 0);
    drawFlameData(frame(ctx, range), scene(data, range, range, { lit: subIndex(data, mask), litMask: mask }), new FlameBuffers());
    const spans = ops.rects.filter((r) => r.style.startsWith('resolved('));
    expect(spans.some((r) => r.alpha < 0.5)).toBe(true);
    expect(spans.filter((r) => r.alpha === 1)).toHaveLength(1);
  });

  it('draws a collapsed lane as a strip along its header', () => {
    const { ctx, ops } = fakeContext();
    const s = scene(data, range, range);
    s.layout = layoutLanes(s.index, ['api'], data.lanes);
    drawFlameData(frame(ctx, range), s, new FlameBuffers());
    expect(ops.rects.some((r) => r.h === 4 && r.style.startsWith('resolved('))).toBe(true);
  });

  it('draws the minimap with the view as a window', () => {
    const { ctx, ops } = fakeContext();
    const view = { start: 40, end: 60 };
    drawFlameData(frame(ctx, view), scene(data, range, view, { minimap: flameMinimap(data, range, 100) }), new FlameBuffers());
    expect(ops.fill).toBeGreaterThanOrEqual(2);
    expect(ops.strokeRect).toBeGreaterThanOrEqual(1);
  });

  it('draws the playhead, the hover line with its time, and the hovered span', () => {
    const { ctx, ops } = fakeContext();
    drawFlameOverlay(frame(ctx, range), { playhead: 400, hover: { x: 500, label: '12 ms' }, box: { x: 200, y: 80, w: 50, h: 16 } });
    expect(ops.text).toEqual(['12 ms']);
    expect(ops.strokeRect).toBe(1);
    expect(ops.rects.some((r) => r.style === 'primary')).toBe(true);
  });
});

describe('minimap and ink', () => {
  it('counts the spans running in each column, per lane', () => {
    const data = flameData([{ key: 'a', title: 'A' }], [
      { id: '1', lane: 'a', name: 'x', start: 0, end: 50 },
      { id: '2', parent: '1', lane: 'a', name: 'y', start: 0, end: 25 },
    ]);
    const m = flameMinimap(data, { start: 0, end: 100 }, 4);
    expect(Array.from(m.values)).toEqual([2, 1, 0, 0]);
    expect(m.peaks[0]).toBe(2);
  });

  it('reads luminance from rgb, hex and oklch, and picks the ink that reads', () => {
    expect(luminance('rgb(255, 255, 255)')).toBeCloseTo(1);
    expect(luminance('#000')).toBe(0);
    expect(luminance('oklch(0.9 0.1 200)')).toBeCloseTo(0.729);
    expect(luminance('var(--x)')).toBeNull();
    expect(inkFor('rgb(250, 230, 120)', COLORS)).toBe(COLORS.foreground);
    expect(inkFor('rgb(30, 60, 160)', COLORS)).toBe(COLORS.background);
  });
});

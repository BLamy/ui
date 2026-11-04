import { describe, expect, it } from 'vitest';
import { TRACE_RULER, layoutRail, layoutStrip, linearAxis, pixelEdges, selectStops, type TraceLane, type TraceRange, type TraceRow } from '@/lib/trace-timeline-model';
import { TraceBuffers, drawTraceData, drawTraceOverlay, groupRequests, toneColor, type TraceColors, type TraceFrame, type TraceScene } from '@/lib/trace-timeline-draw';

const COLORS: TraceColors = {
  foreground: 'fg', muted: 'muted', faint: 'faint', border: 'border', primary: 'primary', background: 'bg', surface: 'surface', ruler: 'ruler', card: 'card',
  warning: 'warning', success: 'success', error: 'error', chart: ['c1', 'c2', 'c3', 'c4', 'c5'],
};
const HOUR = 3_600_000;
const RANGE: TraceRange = { start: 0, end: HOUR };

/** Records what a canvas is told to do. */
function fakeContext() {
  const ops = { fillRect: 0, arc: 0, roundRect: 0, moveTo: 0, fill: 0, text: [] as string[], transforms: [] as number[][], rects: [] as Array<{ x: number; y: number; w: number; h: number; style: string; alpha: number }> };
  const ctx = {
    fillStyle: '',
    globalAlpha: 1,
    font: '',
    textBaseline: 'alphabetic',
    setTransform: (...m: number[]) => ops.transforms.push(m),
    clearRect: () => {},
    fillRect(x: number, y: number, w: number, h: number) {
      ops.fillRect++;
      ops.rects.push({ x, y, w, h, style: String(ctx.fillStyle), alpha: ctx.globalAlpha });
    },
    fillText: (text: string) => ops.text.push(text),
    measureText: (text: string) => ({ width: text.length * 6 }),
    beginPath: () => {},
    closePath: () => {},
    moveTo: () => { ops.moveTo++; },
    lineTo: () => {},
    arc: () => { ops.arc++; },
    roundRect: () => { ops.roundRect++; },
    fill: () => { ops.fill++; },
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, ops };
}

function frame(ctx: CanvasRenderingContext2D, over: Partial<TraceFrame> = {}): TraceFrame {
  const length = over.length ?? 1200;
  const dpr = over.dpr ?? 2;
  return { ctx, dpr, vertical: false, side: 'right', width: 1264, height: 300, start: 64, length, columns: length * dpr, axis: linearAxis(RANGE), win: { from: 0, to: 1 }, colors: COLORS, font: '11px sans-serif', ...over };
}

function scene(rows: TraceRow[], lanes: TraceLane[], over: Partial<TraceScene> = {}): TraceScene {
  return { rows, lanes, ticks: [], format: (t) => `${t}`, activity: new Map(), focusedLane: lanes[0]?.key ?? null, selectedThread: null, selectedRequest: null, requests: [], stopMarks: [], color: (c) => `resolved(${c})`, ...over };
}

function buffers(f: TraceFrame) {
  const b = new TraceBuffers();
  b.resize(f.columns);
  pixelEdges(f.axis, f.win, f.columns, b.edges);
  return b;
}

function dense(n: number): Float64Array {
  return Float64Array.from({ length: n }, (_, i) => ((i + 0.5) / n) * HOUR);
}

describe('at most one thing per device pixel, whatever the number of marks', () => {
  const lane = (n: number): TraceLane => ({
    key: 'a',
    diamonds: { times: dense(n) },
    density: { times: dense(n), depths: Uint16Array.from({ length: n }, (_, i) => i % 37) },
    marks: [{ key: 'bar', times: dense(n), shape: 'bar', tone: 'warning' }, { key: 'dot', times: dense(n), shape: 'dot' }],
  });

  it('draws the same count for 10,000 marks or 1,000,000', () => {
    const count = (n: number) => {
      const { ctx, ops } = fakeContext();
      const f = frame(ctx);
      const lanes = [lane(n)];
      drawTraceData(f, scene(layoutStrip(lanes, 300), lanes), buffers(f));
      return ops;
    };
    const small = count(10_000);
    const large = count(1_000_000);
    // Dense marks fill every column, so these are the worst case for the pixels on hand.
    const columns = 2400;
    for (const ops of [small, large]) {
      expect(ops.fillRect).toBeLessThanOrEqual(columns * 4);
      expect(ops.roundRect).toBeLessThanOrEqual(columns);
      expect(ops.moveTo).toBeLessThanOrEqual(columns);
    }
    expect(large.fillRect).toBeLessThanOrEqual(small.fillRect + 10);
  });

  it('merges a run of equal pixels into one rectangle', () => {
    const { ctx, ops } = fakeContext();
    const f = frame(ctx);
    const lanes: TraceLane[] = [{ key: 'a', density: { times: dense(240_000) } }];
    drawTraceData(f, scene(layoutStrip(lanes, 100), lanes), buffers(f));
    // Every column has the same count and no depths, so it's the row's background and very few runs.
    expect(ops.fillRect).toBeLessThan(40);
  });

  it('pools requests too, per colour', () => {
    const { ctx, ops } = fakeContext();
    const f = frame(ctx);
    const axis = f.axis;
    const requests = Array.from({ length: 50_000 }, (_, i) => ({ id: i, time: (i / 50_000) * HOUR, from: (i / 50_000) * HOUR + 10, to: (i / 50_000) * HOUR + 20 }));
    const rows = layoutStrip([], 100, { requests: true });
    drawTraceData(f, scene(rows, [], { requests: groupRequests(requests, axis, () => 'c1'), selectedRequest: 7 }), buffers(f));
    expect(ops.arc).toBeLessThanOrEqual(f.columns + 1);
    expect(ops.fillRect).toBeLessThan(f.columns);
  });

  it('skips what is outside the view', () => {
    const { ctx, ops } = fakeContext();
    const f = frame(ctx, { win: { from: 0.5, to: 0.5001 } });
    const lanes: TraceLane[] = [{ key: 'a', diamonds: { times: [10] }, density: { times: [10] }, marks: [{ key: 'm', times: [10] }] }];
    drawTraceData(f, scene(layoutStrip(lanes, 100), lanes), buffers(f));
    expect(ops.moveTo).toBe(0);
    expect(ops.rects.filter((r) => r.style === 'c1' || r.style === 'muted')).toHaveLength(0);
  });
});

describe('one drawing for two orientations', () => {
  const lanes: TraceLane[] = [{ key: 'a', title: 'A', diamonds: { label: 'dia', times: [1000] }, density: { label: 'JS', times: dense(100) }, threads: [{ id: 1, label: 'T1' }] }];

  it('draws the strip in x and y, with its labels', () => {
    const { ctx, ops } = fakeContext();
    const f = frame(ctx, { dpr: 2 });
    drawTraceData(f, scene(layoutStrip(lanes, 200), lanes, { ticks: [{ along: 10, time: 1000, resolution: 1000 }] }), buffers(f));
    expect(ops.transforms[ops.transforms.length - 1]).toEqual([2, 0, 0, 2, 0, 0]);
    expect(ops.text).toContain('JS');
    expect(ops.text).toContain('dia');
    expect(ops.text).toContain('T1');
    expect(ops.text).toContain('1000');
  });

  it('swaps x and y on a left rail, and mirrors them on a right rail, with no words', () => {
    for (const side of ['left', 'right'] as const) {
      const { ctx, ops } = fakeContext();
      const f = frame(ctx, { vertical: true, side, width: 44, height: 600, start: 0, length: 600, columns: 1200 });
      drawTraceData(f, scene(layoutRail(lanes), lanes), buffers(f));
      expect(ops.transforms[ops.transforms.length - 1]).toEqual(side === 'left' ? [0, 2, 2, 0, 0, 0] : [0, 2, -2, 0, 88, 0]);
      expect(ops.text).toEqual([]);
    }
  });

  it('draws the density from the same code in a rail column, from the column it is given', () => {
    const { ctx, ops } = fakeContext();
    const f = frame(ctx, { vertical: true, width: 44, height: 600, start: 0, length: 600, columns: 1200 });
    const rows = layoutRail(lanes);
    drawTraceData(f, scene(rows, lanes), buffers(f));
    const density = ops.rects.filter((r) => r.style === 'primary');
    expect(density.length).toBeGreaterThan(0);
    for (const r of density) {
      expect(r.y).toBe(rows[0].at);
      expect(r.h).toBe(rows[0].size);
    }
  });

  it('leaves dot marks to the stops on a rail, where they would have no room', () => {
    const withDots: TraceLane[] = [{ key: 'a', marks: [{ key: 'bar', times: [1000], shape: 'bar', tone: 'error' }, { key: 'dot', times: [2000], shape: 'dot', tone: 'success' }] }];
    const { ctx, ops } = fakeContext();
    const f = frame(ctx, { vertical: true, width: 44, height: 600, start: 0, length: 600, columns: 1200 });
    drawTraceData(f, scene(layoutRail(withDots), withDots), buffers(f));
    expect(ops.rects.some((r) => r.style === 'error')).toBe(true);
    expect(ops.rects.some((r) => r.style === 'success')).toBe(false);
    expect(ops.roundRect).toBe(0);
  });
});

describe('colours', () => {
  it('takes a host colour for its own lanes and threads, through the resolver', () => {
    const lanes: TraceLane[] = [{ key: 'a', color: 'red', density: { times: dense(10) }, threads: [{ id: 1, color: 'blue' }] }];
    const { ctx, ops } = fakeContext();
    const f = frame(ctx);
    const activity = new Map([['a', { edges: [0, HOUR], threads: new Map([[1, { counts: [5], max: 5 }]]), total: { counts: [5], max: 5 } }]]);
    drawTraceData(f, scene(layoutStrip(lanes, 200), lanes, { activity }), buffers(f));
    expect(ops.rects.some((r) => r.style === 'resolved(red)')).toBe(true);
    expect(ops.rects.some((r) => r.style === 'resolved(blue)')).toBe(true);
    expect(ops.rects.some((r) => r.style === 'c1')).toBe(false);
  });

  it('falls back to chart tokens by position on the strip', () => {
    const lanes: TraceLane[] = [{ key: 'a', density: { times: dense(10) } }, { key: 'b', density: { times: dense(10) } }];
    const { ctx, ops } = fakeContext();
    const f = frame(ctx);
    drawTraceData(f, scene(layoutStrip(lanes, 200), lanes), buffers(f));
    expect(ops.rects.some((r) => r.style === 'c1')).toBe(true);
    expect(ops.rects.some((r) => r.style === 'c2')).toBe(true);
  });

  it('tints the lane in focus on a rail and grays the rest', () => {
    const lanes: TraceLane[] = [{ key: 'a', density: { times: dense(10) } }, { key: 'b', density: { times: dense(10) } }];
    const { ctx, ops } = fakeContext();
    const f = frame(ctx, { vertical: true, width: 44, height: 600, start: 0, length: 600, columns: 1200 });
    drawTraceData(f, scene(layoutRail(lanes), lanes, { focusedLane: 'b' }), buffers(f));
    expect(ops.rects.filter((r) => r.style === 'primary').every((r) => r.y === layoutRail(lanes)[1].at)).toBe(true);
    expect(ops.rects.filter((r) => r.style === 'muted').every((r) => r.y === layoutRail(lanes)[0].at)).toBe(true);
  });

  it('maps tones to tokens', () => {
    expect(toneColor(COLORS, 'error')).toBe('error');
    expect(toneColor(COLORS, 'warning')).toBe('warning');
    expect(toneColor(COLORS, 'success')).toBe('success');
    expect(toneColor(COLORS, 'info')).toBe('primary');
    expect(toneColor(COLORS, undefined)).toBe('muted');
  });
});

describe('rows', () => {
  it('stops a diamond guide at the end of its own lane', () => {
    const lanes: TraceLane[] = [{ key: 'a', diamonds: { times: [1000] }, threads: [{ id: 1 }] }, { key: 'b', density: { times: [] } }];
    const rows = layoutStrip(lanes, 300);
    const { ctx, ops } = fakeContext();
    const f = frame(ctx);
    drawTraceData(f, scene(rows, lanes), buffers(f));
    const guide = ops.rects.find((r) => r.style === 'warning' && r.alpha < 1);
    const threadRow = rows.find((r) => r.type === 'thread') as TraceRow;
    expect(guide).toBeTruthy();
    expect((guide as { y: number; h: number }).y + (guide as { y: number; h: number }).h).toBe(threadRow.at + threadRow.size);
  });

  it('highlights the selected thread only in the lane in focus', () => {
    const lanes: TraceLane[] = [{ key: 'a', threads: [{ id: 1, label: 'T1' }] }, { key: 'b', threads: [{ id: 1, label: 'T1' }] }];
    const highlighted = (focusedLane: string) => {
      const { ctx, ops } = fakeContext();
      const f = frame(ctx);
      drawTraceData(f, scene(layoutStrip(lanes, 300), lanes, { focusedLane, selectedThread: 1 }), buffers(f));
      return ops.rects.filter((r) => r.style === 'fg' && r.alpha === 0.06).map((r) => r.y);
    };
    const rows = layoutStrip(lanes, 300).filter((r) => r.type === 'thread');
    expect(highlighted('a')).toEqual([rows[0].at]);
    expect(highlighted('b')).toEqual([rows[1].at]);
  });

  it('draws the selected request over the rest, with its dot in the foreground colour', () => {
    const axis = linearAxis(RANGE);
    const requests = [{ id: 'x', time: 1000, from: 2000, to: 3000 }, { id: 'y', time: 2000 }];
    const rows = layoutStrip([], 100, { requests: true });
    const { ctx, ops } = fakeContext();
    const f = frame(ctx);
    drawTraceData(f, scene(rows, [], { requests: groupRequests(requests, axis, () => 'c3'), selectedRequest: 'x' }), buffers(f));
    expect(ops.arc).toBeGreaterThanOrEqual(3);
  });

  it('draws the strip stops from what selectStops chose', () => {
    const stops = [{ key: 'a', time: 1000, tone: 'error' as const }, { key: 'b', time: 1_800_000, level: 2 }];
    const axis = linearAxis(RANGE);
    const marks = selectStops(stops, { axis, win: { from: 0, to: 1 }, length: 1200 });
    const rows = layoutStrip([], 100, { stops: true });
    const { ctx, ops } = fakeContext();
    const f = frame(ctx);
    drawTraceData(f, scene(rows, [], { stopMarks: marks }), buffers(f));
    const dashes = ops.rects.filter((r) => r.w === 2);
    expect(dashes.map((r) => r.style)).toEqual(['error', 'faint']);
    expect(dashes[0].h).toBe(9);
    expect(dashes[1].h).toBe(6);
  });
});

describe('the overlay', () => {
  it('dims the future, from the playhead to the end of the plot', () => {
    const { ctx, ops } = fakeContext();
    const f = frame(ctx);
    drawTraceOverlay(f, { playhead: 400, hover: null, from: TRACE_RULER, to: 300 });
    const dim = ops.rects.find((r) => r.style === 'bg');
    expect(dim).toEqual({ x: 400, y: TRACE_RULER, w: 64 + 1200 - 400, h: 300 - TRACE_RULER, style: 'bg', alpha: 0.5 });
    expect(ops.rects.some((r) => r.style === 'primary' && r.x === 399 && r.w === 2)).toBe(true);
    expect(ops.moveTo).toBe(1);
  });

  it('draws a hover line with its time on the strip, and just a line on a rail', () => {
    const strip = fakeContext();
    drawTraceOverlay(frame(strip.ctx), { playhead: 400, hover: { along: 500, label: '12:34' }, from: TRACE_RULER, to: 300 });
    expect(strip.ops.text).toEqual(['12:34']);
    expect(strip.ops.rects.some((r) => r.x === 500 && r.w === 1 && r.alpha === 0.25)).toBe(true);
    const rail = fakeContext();
    drawTraceOverlay(frame(rail.ctx, { vertical: true, width: 44, height: 600, start: 0, length: 600, columns: 1200 }), { playhead: 100, hover: { along: 300 }, from: 3, to: 20 });
    expect(rail.ops.text).toEqual([]);
    expect(rail.ops.rects.some((r) => r.x === 300 && r.w === 1)).toBe(true);
  });

  it('draws the hover time over the playhead, so it can be read when they meet', () => {
    const { ctx, ops } = fakeContext();
    const order: string[] = [];
    const fillRect = ctx.fillRect.bind(ctx);
    ctx.fillRect = (x, y, w, h) => {
      order.push(String(ctx.fillStyle));
      fillRect(x, y, w, h);
    };
    drawTraceOverlay(frame(ctx), { playhead: 400, hover: { along: 400, label: '12:34' }, from: TRACE_RULER, to: 300 });
    expect(order.indexOf('primary')).toBeLessThan(order.indexOf('card'));
    expect(ops.text).toEqual(['12:34']);
  });

  it('leaves the playhead off when it is out of view, dimming all or nothing', () => {
    const before = fakeContext();
    drawTraceOverlay(frame(before.ctx), { playhead: 10, hover: null, from: TRACE_RULER, to: 300 });
    expect(before.ops.rects.find((r) => r.style === 'bg')?.x).toBe(64);
    expect(before.ops.rects.some((r) => r.style === 'primary')).toBe(false);
    const after = fakeContext();
    drawTraceOverlay(frame(after.ctx), { playhead: 2000, hover: null, from: TRACE_RULER, to: 300 });
    expect(after.ops.rects.some((r) => r.style === 'bg')).toBe(false);
    expect(after.ops.rects.some((r) => r.style === 'primary')).toBe(false);
  });

  it('crosses the whole rail with the playhead, and dims just the columns', () => {
    const { ctx, ops } = fakeContext();
    const f = frame(ctx, { vertical: true, width: 44, height: 600, start: 0, length: 600, columns: 1200 });
    drawTraceOverlay(f, { playhead: 300, hover: null, from: 3, to: 18 });
    expect(ops.rects.find((r) => r.style === 'bg')).toMatchObject({ x: 300, y: 3, h: 15, w: 300 });
    expect(ops.rects.find((r) => r.style === 'primary')).toMatchObject({ x: 299, y: 0, w: 2, h: 44 });
    expect(ops.moveTo).toBe(0);
  });

  it('shows where a zoomed rail sits on the whole axis', () => {
    const { ctx, ops } = fakeContext();
    const f = frame(ctx, { vertical: true, width: 44, height: 600, start: 0, length: 600, columns: 1200 });
    drawTraceOverlay(f, { playhead: 300, hover: null, from: 3, to: 18, thumb: { from: 0.5, to: 0.6 } });
    expect(ops.rects.find((r) => r.style === 'muted')).toMatchObject({ x: 300, y: 0, h: 2 });
    expect((ops.rects.find((r) => r.style === 'muted') as { w: number }).w).toBeCloseTo(60, 9);
  });
});

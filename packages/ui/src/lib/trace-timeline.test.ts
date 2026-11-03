import { describe, expect, it } from 'vitest';
import {
  TRACE_SCRUB_SPEEDS, TRACE_WAVE_PEAK, TRACE_WAVE_REST,
  adjacentStop, advanceAlong, chooseTicks, clampView, formatTraceTime, laneEnd, layoutRail, layoutStrip, linearAxis, lowerBound, moveScrub, mostSevere, nearestMark, panWindow,
  pinchWindow, pixelEdges, placeRailCard, placeStripCard, poolBuckets, poolDensity, poolPresence, railDashInset, requestAt, rescaleScrub, resolutionAt, rowAt, sameLanes, scrubPosition, seekForward,
  selectStops, sortedTimes, speedTier, startScrub, stopAxis, stopsByTime, stripHeight, tickStep, traceSwell, upperBound, viewWindow, windowView, zoomWindow,
  type TraceLane, type TraceRange, type TraceScrub, type TraceScrubContext, type TraceStop, type TraceTone, type TraceWindow,
} from '@/lib/trace-timeline';

const HOUR = 3_600_000;
const RANGE: TraceRange = { start: 0, end: HOUR };
const FULL: TraceWindow = { from: 0, to: 1 };

function seeded(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Counts reads, so a test can say what a search costs. */
function counting(values: ArrayLike<number>) {
  const counter = { reads: 0 };
  const proxy = new Proxy(values as object, {
    get(target, key) {
      if (typeof key === 'string' && /^\d+$/.test(key)) counter.reads++;
      return (target as Record<string | symbol, unknown>)[key];
    },
  }) as ArrayLike<number>;
  return { proxy, counter };
}

describe('search', () => {
  it('lowerBound and upperBound agree with a walk, duplicates included', () => {
    const a = [1, 2, 2, 2, 5, 9];
    for (const v of [0, 1, 2, 3, 5, 9, 10]) {
      expect(lowerBound(a, v)).toBe(a.findIndex((x) => x >= v) === -1 ? a.length : a.findIndex((x) => x >= v));
      expect(upperBound(a, v)).toBe(a.findIndex((x) => x > v) === -1 ? a.length : a.findIndex((x) => x > v));
    }
  });

  it('seekForward gives what lowerBound gives, from any earlier position', () => {
    const random = seeded(3);
    const a = Float64Array.from({ length: 2000 }, () => random() * 1000).sort();
    for (let i = 0; i < 300; i++) {
      const from = Math.floor(random() * a.length);
      const v = a[from] + random() * 200;
      expect(seekForward(a, v, from)).toBe(lowerBound(a, v, from));
    }
    expect(seekForward(a, 1e9, 0)).toBe(a.length);
    expect(seekForward(a, -1, 5)).toBe(5);
    expect(seekForward(a, 1, a.length)).toBe(a.length);
  });

  it('sortedTimes keeps a sorted array, copies an unsorted one and remembers either', () => {
    const sorted = new Float64Array([1, 2, 3]);
    expect(sortedTimes(sorted)).toBe(sorted);
    const unsorted = [3, 1, 2];
    const out = sortedTimes(unsorted);
    expect(Array.from(out)).toEqual([1, 2, 3]);
    expect(unsorted).toEqual([3, 1, 2]);
    expect(sortedTimes(unsorted)).toBe(out);
  });
});

describe('linearAxis', () => {
  it('turns times into fractions and back, clamped', () => {
    const axis = linearAxis({ start: 100, end: 300 });
    expect(axis.uniform).toBe(true);
    expect(axis.fraction(200)).toBe(0.5);
    expect(axis.timeAt(0.25)).toBe(150);
    expect(axis.fraction(50)).toBe(0);
    expect(axis.fraction(400)).toBe(1);
    expect(axis.timeAt(-1)).toBe(100);
    expect(axis.timeAt(2)).toBe(300);
  });

  it('survives an empty range', () => {
    const axis = linearAxis({ start: 5, end: 5 });
    expect(axis.fraction(5)).toBe(0);
    expect(axis.timeAt(0.5)).toBe(5);
  });
});

describe('stopAxis', () => {
  it('gives each gap between consecutive stops an equal share', () => {
    const axis = stopAxis([{ time: 10 }, { time: 11 }, { time: 500 }], { start: 0, end: 1000 });
    expect(axis.uniform).toBeUndefined();
    expect(axis.fraction(0)).toBe(0);
    expect(axis.fraction(10)).toBeCloseTo(0.25, 12);
    expect(axis.fraction(11)).toBeCloseTo(0.5, 12);
    expect(axis.fraction(500)).toBeCloseTo(0.75, 12);
    expect(axis.fraction(1000)).toBe(1);
    // A burst opens out, and idle time closes up.
    expect(axis.fraction(10.5)).toBeCloseTo(0.375, 12);
    expect(axis.fraction(750)).toBeCloseTo(0.875, 12);
  });

  it('counts duplicates and stops at the ends or outside the range once at most', () => {
    const axis = stopAxis([{ time: 0 }, { time: 40 }, { time: 40 }, { time: 40 }, { time: 60 }, { time: 100 }, { time: -5 }, { time: 500 }, { time: NaN }], { start: 0, end: 100 });
    expect(axis.fraction(40)).toBeCloseTo(1 / 3, 12);
    expect(axis.fraction(60)).toBeCloseTo(2 / 3, 12);
    expect(axis.timeAt(1 / 3)).toBeCloseTo(40, 9);
  });

  it('is plain time with no stops, and survives an empty range', () => {
    const axis = stopAxis([], { start: 0, end: 100 });
    expect(axis.fraction(25)).toBeCloseTo(0.25, 12);
    expect(axis.timeAt(0.25)).toBeCloseTo(25, 12);
    const empty = stopAxis([{ time: 5 }], { start: 5, end: 5 });
    expect(empty.fraction(5)).toBe(0);
    expect(empty.timeAt(1)).toBe(5);
  });

  it('is strictly increasing, and fraction and timeAt are inverses, on bursty stops with duplicates', () => {
    const random = seeded(17);
    const stops: Array<{ time: number }> = [];
    for (let burst = 0; burst < 30; burst++) {
      const at = random() * HOUR;
      for (let i = 0; i < 40; i++) {
        const time = Math.min(HOUR, at + random() * 2_000);
        stops.push({ time });
        if (i % 5 === 0) stops.push({ time });
      }
    }
    const axis = stopAxis(stops, RANGE);
    let last = -1;
    const samples = Float64Array.from({ length: 4000 }, () => random() * HOUR).sort();
    for (const t of samples) {
      const f = axis.fraction(t);
      expect(f).toBeGreaterThan(last);
      last = f;
      expect(Math.abs(axis.timeAt(f) - t)).toBeLessThan(1e-6);
    }
    let lastTime = -1;
    for (let i = 0; i <= 5000; i++) {
      const f = i / 5000;
      const t = axis.timeAt(f);
      expect(t).toBeGreaterThan(lastTime);
      lastTime = t;
      expect(Math.abs(axis.fraction(t) - f)).toBeLessThan(1e-9);
    }
    for (const s of stops) expect(Math.abs(axis.timeAt(axis.fraction(s.time)) - s.time)).toBeLessThan(1e-6);
  });

  it('holds its inverse at the ends', () => {
    const axis = stopAxis([{ time: 1 }, { time: 2 }], { start: 0, end: 3 });
    expect(axis.timeAt(0)).toBe(0);
    expect(axis.timeAt(1)).toBe(3);
    expect(axis.fraction(-1)).toBe(0);
    expect(axis.fraction(9)).toBe(1);
  });
});

describe('advanceAlong', () => {
  it('moves at an even rate along the axis', () => {
    const axis = stopAxis([{ time: 10 }, { time: 11 }], { start: 0, end: 100 });
    // A third of the axis is the second between the stops, so a third of the range's length of playing crosses just it.
    expect(advanceAlong(axis, 10, 100 / 3, { start: 0, end: 100 })).toBeCloseTo(11, 9);
    expect(advanceAlong(linearAxis(RANGE), 1000, 500, RANGE)).toBe(1500);
    expect(advanceAlong(linearAxis(RANGE), HOUR, 500, RANGE)).toBe(HOUR);
  });
});

describe('the view', () => {
  it('clampView keeps a view on the range and off the minimum', () => {
    expect(clampView({ start: -50, end: 50 }, { start: 0, end: 1000 })).toEqual({ start: 0, end: 100 });
    expect(clampView({ start: 950, end: 1050 }, { start: 0, end: 1000 })).toEqual({ start: 900, end: 1000 });
    expect(clampView({ start: -1, end: 2000 }, { start: 0, end: 1000 })).toEqual({ start: 0, end: 1000 });
    expect(clampView({ start: 5, end: 5 }, { start: 0, end: 1000 }, 2)).toEqual({ start: 5, end: 7 });
    const fine = { start: 1, end: 2 };
    expect(clampView(fine, { start: 0, end: 10 })).toBe(fine);
  });

  it('viewWindow and windowView are inverses on any axis', () => {
    const axis = stopAxis([{ time: 300 }, { time: 700 }], { start: 0, end: 1000 });
    const win = viewWindow(axis, { start: 100, end: 800 });
    const back = windowView(axis, win);
    expect(back.start).toBeCloseTo(100, 9);
    expect(back.end).toBeCloseTo(800, 9);
  });

  it('panWindow keeps its length and stays on the axis', () => {
    expect(panWindow({ from: 0.2, to: 0.4 }, 0.1).from).toBeCloseTo(0.3, 12);
    expect(panWindow({ from: 0.2, to: 0.4 }, -1)).toEqual({ from: 0, to: 0.2 });
    const end = panWindow({ from: 0.2, to: 0.4 }, 1);
    expect(end.to).toBeCloseTo(1, 12);
    expect(end.to - end.from).toBeCloseTo(0.2, 12);
    expect(panWindow(FULL, 0.5)).toEqual(FULL);
  });

  it('zoomWindow keeps what is under the anchor where it is', () => {
    const win = { from: 0.2, to: 0.6 };
    const under = (w: TraceWindow, anchor: number) => w.from + anchor * (w.to - w.from);
    const next = zoomWindow(win, 0.75, 0.5);
    expect(next.to - next.from).toBeCloseTo(0.2, 12);
    expect(under(next, 0.75)).toBeCloseTo(under(win, 0.75), 12);
    expect(zoomWindow(win, 0.5, 100)).toEqual(FULL);
  });

  it('pinchWindow scales by the spread and keeps what was under the fingers under them', () => {
    const start = { from: 0.25, to: 0.75 };
    const length = 500;
    const twice = pinchWindow(start, 100, 250, 200, 250, length);
    expect(twice.to - twice.from).toBeCloseTo(0.25, 12);
    expect(twice.from + 0.5 * 0.25).toBeCloseTo(0.5, 12);
    // The midpoint moved 50 px, and what was under it came along.
    const moved = pinchWindow(start, 100, 250, 100, 300, length);
    expect(moved.from + (300 / length) * (moved.to - moved.from)).toBeCloseTo(0.25 + (250 / length) * 0.5, 12);
    expect(pinchWindow(start, 200, 250, 10, 250, length)).toEqual(FULL);
  });
});

describe('ticks', () => {
  it('tickStep picks round steps, on a clock from a second up', () => {
    expect(tickStep(0.3)).toBe(0.5);
    expect(tickStep(1.2)).toBe(2);
    expect(tickStep(700)).toBe(1000);
    expect(tickStep(1100)).toBe(2000);
    expect(tickStep(12_000)).toBe(15_000);
    expect(tickStep(200_000)).toBe(300_000);
    expect(tickStep(4_000_000)).toBe(7_200_000);
    expect(tickStep(15_000_000)).toBe(18_000_000);
    expect(tickStep(0)).toBe(1);
  });

  it('chooseTicks lands on round times, at least minGap apart, inside the view', () => {
    const axis = linearAxis(RANGE);
    const ticks = chooseTicks(axis, FULL, RANGE, 1200);
    expect(ticks[0].time).toBe(0);
    expect(ticks[1].time).toBe(300_000);
    expect(ticks.length).toBe(13);
    expect(ticks[12].along).toBe(1200);
    for (let i = 1; i < ticks.length; i++) expect(ticks[i].along - ticks[i - 1].along).toBeGreaterThanOrEqual(90);

    const view = { start: 123_456, end: 125_678 };
    const zoomed = chooseTicks(axis, viewWindow(axis, view), view, 800);
    for (const t of zoomed) {
      expect(t.time).toBeGreaterThanOrEqual(view.start);
      expect(t.time).toBeLessThanOrEqual(view.end);
      expect(t.along).toBeGreaterThanOrEqual(0);
      expect(t.along).toBeLessThanOrEqual(800 + 1e-6);
    }
    expect(zoomed.length).toBeGreaterThan(3);
  });

  it('chooseTicks spaces ticks evenly on a non-uniform axis, saying what time they landed on', () => {
    const axis = stopAxis([{ time: 1000 }, { time: 1001 }], RANGE);
    const ticks = chooseTicks(axis, FULL, RANGE, 660);
    expect(ticks.map((t) => t.along)).toEqual([0, 110, 220, 330, 440, 550]);
    for (const t of ticks) expect(t.time).toBeCloseTo(axis.timeAt(t.along / 660), 9);
    expect(chooseTicks(axis, FULL, RANGE, 0)).toEqual([]);
  });

  it('resolutionAt is the time a few px cover there, at both ends too', () => {
    const axis = linearAxis(RANGE);
    expect(resolutionAt(axis, FULL, 600, 300)).toBeCloseTo(6000, 6);
    expect(resolutionAt(axis, FULL, 600, 600)).toBeCloseTo(6000, 6);
    expect(resolutionAt(axis, FULL, 600, 0, 10)).toBeCloseTo(60_000, 6);
  });
});

describe('formatTraceTime', () => {
  it('prints to the precision asked for', () => {
    expect(formatTraceTime(3_723_000, 1000)).toBe('1:02:03');
    expect(formatTraceTime(754_000, 6000)).toBe('12:34');
    expect(formatTraceTime(754_500, 100)).toBe('12:34.5');
    expect(formatTraceTime(754_567, 1)).toBe('12:34.567');
    expect(formatTraceTime(8_250, 10)).toBe('8.25 s');
    expect(formatTraceTime(312.5, 0.1)).toBe('312.5 ms');
    expect(formatTraceTime(0, 300_000)).toBe('0:00');
    expect(formatTraceTime(0, 5)).toBe('0 ms');
    expect(formatTraceTime(300_000, 300_000)).toBe('5:00');
    expect(formatTraceTime(3_600_000, 300_000)).toBe('1:00:00');
    expect(formatTraceTime(-1500, 100)).toBe('−1.5 s');
    expect(formatTraceTime(NaN)).toBe('—');
  });

  it('carries rounding into the next unit', () => {
    expect(formatTraceTime(59_999.6, 1)).toBe('1:00.000');
    expect(formatTraceTime(3_599_999.6, 1)).toBe('1:00:00.000');
    expect(formatTraceTime(59_600, 1000)).toBe('1:00');
    expect(formatTraceTime(999.6, 1)).toBe('1.000 s');
  });

  it('keeps precision a deep zoom into an hour needs', () => {
    expect(formatTraceTime(3_599_123.456789, 1e-5)).toBe('59:59.12345679');
    expect(formatTraceTime(3_599_123.456789, 1e-3)).toBe('59:59.123457');
  });
});

describe('pooling', () => {
  const axis = linearAxis(RANGE);

  it('pixelEdges gives each column boundary, reusing the array it is given', () => {
    const edges = pixelEdges(axis, FULL, 4);
    expect(Array.from(edges)).toEqual([0, 900_000, 1_800_000, 2_700_000, 3_600_000]);
    expect(pixelEdges(axis, { from: 0, to: 0.5 }, 4, edges)).toBe(edges);
    expect(edges[4]).toBe(1_800_000);
  });

  it('poolDensity counts and finds the deepest per column, as a walk would, at any zoom', () => {
    const random = seeded(5);
    const n = 200_000;
    const times = new Float64Array(n);
    const depths = new Uint16Array(n);
    let t = 0;
    for (let i = 0; i < n; i++) {
      t += random() * 2 * (HOUR / n) * 0.99;
      times[i] = t;
      depths[i] = Math.floor(random() * 300);
    }
    const walk = (edges: Float64Array) => {
      const columns = edges.length - 1;
      const counts = new Uint32Array(columns);
      const deepest = new Uint16Array(columns);
      let c = 0;
      for (let i = 0; i < n; i++) {
        if (times[i] < edges[0]) continue;
        if (times[i] > edges[columns]) break;
        while (c < columns - 1 && times[i] >= edges[c + 1]) c++;
        counts[c]++;
        if (depths[i] > deepest[c]) deepest[c] = depths[i];
      }
      return { counts, deepest };
    };
    for (const win of [FULL, { from: 0.3, to: 0.31 }, { from: 0.5, to: 0.50001 }, { from: 0.999, to: 1 }]) {
      for (const columns of [1, 7, 16, 256, 1800]) {
        const edges = pixelEdges(axis, win, columns);
        const pool = poolDensity({ times, depths }, 0, edges);
        const expected = walk(edges);
        expect(Array.from(pool.counts)).toEqual(Array.from(expected.counts));
        expect(Array.from(pool.depths)).toEqual(Array.from(expected.deepest));
        expect(pool.maxCount).toBe(Math.max(1, ...expected.counts));
      }
    }
  });

  it('poolDensity scores a sample exactly on the end of the view, and none outside', () => {
    const times = new Float64Array([-5, 0, 50, 100, 150]);
    const pool = poolDensity({ times }, 0, new Float64Array([0, 50, 100]));
    expect(Array.from(pool.counts)).toEqual([1, 2]);
    expect(pool.deepest).toBe(0);
  });

  it('poolDensity applies a lane offset', () => {
    const times = new Float64Array([0, 10, 20]);
    // On the shared clock these are 100, 110 and 120.
    const pool = poolDensity({ times }, 100, new Float64Array([100, 110, 120]));
    expect(Array.from(pool.counts)).toEqual([1, 2]);
  });

  it('poolDensity costs what the pixels cost, not what the samples cost', () => {
    const cost = (n: number) => {
      const times = Float64Array.from({ length: n }, (_, i) => (i / n) * HOUR);
      const depths = Uint16Array.from({ length: n }, (_, i) => i % 40);
      const c = counting(times);
      const d = counting(depths);
      poolDensity({ times, depths: d.proxy }, 0, pixelEdges(axis, FULL, 8)); // Indexing the depths happens once.
      d.counter.reads = 0;
      poolDensity({ times: c.proxy, depths: d.proxy }, 0, pixelEdges(axis, FULL, 2400));
      return c.counter.reads + d.counter.reads;
    };
    const some = cost(250_000);
    const many = cost(2_000_000);
    // About 2,400 searches of a few dozen reads each, a tiny part of the samples.
    expect(many).toBeLessThan(2400 * 60);
    // Eight times the samples costs a few more reads per search.
    expect(many).toBeLessThan(some * 1.5);
  });

  it('poolPresence marks each column with a time, as a walk would', () => {
    const random = seeded(9);
    const times = Float64Array.from({ length: 5000 }, () => random() * HOUR).sort();
    for (const win of [FULL, { from: 0.2, to: 0.21 }, { from: 0.4, to: 0.400001 }]) {
      const edges = pixelEdges(axis, win, 512);
      const flags = new Uint8Array(512);
      poolPresence(times, 0, edges, flags, 1);
      const expected = new Uint8Array(512);
      for (const t of times) {
        if (t < edges[0] || t > edges[512]) continue;
        expected[Math.min(511, upperBound(edges, t) - 1)] = 1;
      }
      expect(Array.from(flags)).toEqual(Array.from(expected));
    }
  });

  it('poolPresence applies an offset and sets just its bit', () => {
    const flags = new Uint8Array(2).fill(2);
    poolPresence([0, 15], 10, new Float64Array([10, 20, 30]), flags, 1);
    expect(Array.from(flags)).toEqual([3, 3]);
  });

  it('poolPresence costs what is visible when the marks are dense', () => {
    const n = 1_000_000;
    const times = Float64Array.from({ length: n }, (_, i) => (i / n) * HOUR);
    const c = counting(times);
    poolPresence(c.proxy, 0, pixelEdges(axis, FULL, 2400), new Uint8Array(2400), 1);
    expect(c.counter.reads).toBeLessThan(2400 * 40);
  });

  it('poolBuckets moves activity fetched at one zoom to the columns of another', () => {
    const counts = [3, 0, 9, 1];
    const out = new Float64Array(2);
    // Zoomed out from four buckets to two columns: the largest of what each column holds.
    poolBuckets([0, 10, 20, 30, 40], counts, 0, new Float64Array([0, 20, 40]), out);
    expect(Array.from(out)).toEqual([3, 9]);
    // Zoomed in: one bucket runs across several columns.
    const fine = new Float64Array(4);
    poolBuckets([0, 40], [7], 0, new Float64Array([10, 15, 20, 25, 30]), fine);
    expect(Array.from(fine)).toEqual([7, 7, 7, 7]);
    // In the lane's own time, so the offset applies. Outside the view is nothing.
    const off = new Float64Array(2);
    poolBuckets([0, 10], [5], 100, new Float64Array([100, 105, 110]), off);
    expect(Array.from(off)).toEqual([5, 5]);
    poolBuckets([0, 10], [5], 500, new Float64Array([100, 105, 110]), off);
    expect(Array.from(off)).toEqual([0, 0]);
  });
});

describe('selectStops', () => {
  const axis = linearAxis({ start: 0, end: 1000 });
  const stop = (time: number, level = 1, tone?: TraceTone, dim?: boolean): TraceStop<string> => ({ key: `${time}`, time, level, tone, dim });

  it('places what fits and keeps at least the gap between dashes', () => {
    const random = seeded(21);
    const stops = Array.from({ length: 3000 }, (_, i) => stop(random() * 1000, 1 + (i % 3)));
    const marks = selectStops(stops, { axis, win: FULL, length: 600 });
    expect(marks.length).toBeGreaterThan(30);
    expect(marks.length).toBeLessThanOrEqual(61);
    for (let i = 1; i < marks.length; i++) expect(marks[i].along - marks[i - 1].along).toBeGreaterThanOrEqual(10);
    expect(marks.reduce((n, m) => n + m.count, 0)).toBe(3000);
  });

  it('gives the lowest level the room first', () => {
    // A low-importance stop a pixel earlier in time doesn't push out the higher one.
    const marks = selectStops([stop(500, 3), stop(502, 1), stop(504, 2)], { axis, win: FULL, length: 600 });
    expect(marks).toHaveLength(1);
    expect(marks[0].stop.time).toBe(502);
    expect(marks[0].count).toBe(3);
    expect(marks[0].first).toBe(500);
    expect(marks[0].last).toBe(504);
  });

  it('gives a cluster its most severe tone and stands it for its most severe stop', () => {
    const marks = selectStops([stop(500, 1, 'info'), stop(501, 1, 'error'), stop(502, 1, 'warning'), stop(503, 2)], { axis, win: FULL, length: 600 });
    expect(marks).toHaveLength(1);
    expect(marks[0].tone).toBe('error');
    expect(marks[0].stop.time).toBe(501);
    expect(mostSevere('warning', 'info')).toBe('warning');
    expect(mostSevere('default', 'success')).toBe('success');
  });

  it('dims a cluster only when everything in it is dim', () => {
    expect(selectStops([stop(500, 1, undefined, true), stop(501, 2, undefined, true)], { axis, win: FULL, length: 600 })[0].dim).toBe(true);
    expect(selectStops([stop(500, 1, undefined, true), stop(501, 2)], { axis, win: FULL, length: 600 })[0].dim).toBe(false);
  });

  it('reveals more as you zoom in, and leaves out what is out of view', () => {
    const random = seeded(33);
    const stops = Array.from({ length: 2000 }, (_, i) => stop(random() * 1000, 1 + (i % 4)));
    const counts: number[] = [];
    for (const span of [1, 0.2, 0.04]) {
      const from = 0.5 - span / 2;
      const win = { from, to: from + span };
      const marks = selectStops(stops, { axis, win, length: 700 });
      for (const m of marks) {
        expect(m.along).toBeGreaterThanOrEqual(0);
        expect(m.along).toBeLessThanOrEqual(700);
        expect(m.stop.time).toBeGreaterThanOrEqual(win.from * 1000);
        expect(m.stop.time).toBeLessThanOrEqual(win.to * 1000);
      }
      const inView = stops.filter((s) => s.time >= win.from * 1000 && s.time <= win.to * 1000).length;
      expect(marks.reduce((n, m) => n + m.count, 0)).toBe(inView);
      // What matters is one stretch of time: the same 40 ms in the middle shows more dashes at each zoom.
      counts.push(marks.filter((m) => m.stop.time >= 480 && m.stop.time <= 520).length);
    }
    for (let i = 1; i < counts.length; i++) expect(counts[i]).toBeGreaterThan(counts[i - 1]);
    // Zoomed all the way into a stretch with few stops, each stands alone.
    const few = [stop(100), stop(101), stop(102)];
    expect(selectStops(few, { axis, win: FULL, length: 700 })).toHaveLength(1);
    expect(selectStops(few, { axis, win: { from: 0.099, to: 0.103 }, length: 700 })).toHaveLength(3);
  });

  it('never lets an important stop go missing from a zoom it fits in', () => {
    const random = seeded(45);
    const landmarks = Array.from({ length: 12 }, (_, i) => stop(40 + i * 80, 1, 'info'));
    const noise = Array.from({ length: 4000 }, () => stop(random() * 1000, 3));
    const stops = [...noise, ...landmarks];
    const marks = selectStops(stops, { axis, win: FULL, length: 600 });
    for (const landmark of landmarks) expect(marks.some((m) => m.stop === landmark)).toBe(true);
  });

  it('works on an axis by what happened, where bursts open out', () => {
    const burst = Array.from({ length: 50 }, (_, i) => stop(500 + i * 0.01));
    const stops = [stop(10), ...burst, stop(990)];
    const onTime = selectStops(stops, { axis, win: FULL, length: 600 });
    const onStops = selectStops(stops, { axis: stopAxis(stops, { start: 0, end: 1000 }), win: FULL, length: 600 });
    expect(onTime.length).toBe(3);
    expect(onStops.length).toBeGreaterThan(30);
  });

  it('is fine with nothing to do', () => {
    expect(selectStops([], { axis, win: FULL, length: 600 })).toEqual([]);
    expect(selectStops([stop(1)], { axis, win: FULL, length: 0 })).toEqual([]);
  });

  it('nearestMark finds the closest dash within reach', () => {
    const marks = selectStops([stop(100), stop(200), stop(300)], { axis, win: FULL, length: 1000 });
    expect(nearestMark(marks, 104, 6)?.stop.time).toBe(100);
    expect(nearestMark(marks, 196, 6)?.stop.time).toBe(200);
    expect(nearestMark(marks, 150, 6)).toBeNull();
    expect(nearestMark(marks, 106, 6)?.stop.time).toBe(100);
    expect(nearestMark([], 1, 6)).toBeNull();
  });

  it('adjacentStop steps between stops in time order, over duplicates', () => {
    const sorted = stopsByTime([stop(30), stop(10), stop(20), stop(20)]);
    expect(sorted.map((s) => s.time)).toEqual([10, 20, 20, 30]);
    expect(adjacentStop(sorted, 0, 1)?.time).toBe(10);
    expect(adjacentStop(sorted, 10, 1)?.time).toBe(20);
    expect(adjacentStop(sorted, 20, 1)?.time).toBe(30);
    expect(adjacentStop(sorted, 30, 1)).toBeNull();
    expect(adjacentStop(sorted, 30, -1)?.time).toBe(20);
    expect(adjacentStop(sorted, 20, -1)?.time).toBe(10);
    expect(adjacentStop(sorted, 10, -1)).toBeNull();
    // A playhead a rounding error off a stop doesn't land on it again.
    expect(adjacentStop(sorted, 19.9999999999, 1, 1e-6)?.time).toBe(30);
    expect(adjacentStop(sorted, 20.0000000001, -1, 1e-6)?.time).toBe(10);
  });
});

describe('scrubbing', () => {
  const axis = linearAxis(RANGE);
  const length = 600;
  const scale = 1 / length;
  const context = (marks: TraceScrubContext['marks'] = []): TraceScrubContext => ({ axis, win: FULL, length, marks });
  const position = (s: TraceScrub, along: number, c = context()) => scrubPosition(s, along, c).fraction;

  it('slows from full speed to 1/4, 1/16 and 1/64 further out, all inside 340 px', () => {
    expect(TRACE_SCRUB_SPEEDS.map((s) => s.gain)).toEqual([1, 1 / 4, 1 / 16, 1 / 64]);
    expect(speedTier(0)).toBe(0);
    expect(speedTier(30)).toBe(0);
    expect(speedTier(60)).toBe(1);
    expect(speedTier(160)).toBe(2);
    expect(speedTier(260)).toBe(3);
    expect(speedTier(340)).toBe(3);
    expect(TRACE_SCRUB_SPEEDS[TRACE_SCRUB_SPEEDS.length - 2].within).toBeLessThan(340 - 44);
    expect(new Set(TRACE_SCRUB_SPEEDS.map((s) => s.label)).size).toBe(4);
  });

  it('does not flicker on a boundary', () => {
    expect(speedTier(41, 0)).toBe(0);
    expect(speedTier(39, 1)).toBe(1);
    expect(speedTier(44, 0)).toBe(1);
    expect(speedTier(36, 1)).toBe(1);
    expect(speedTier(35, 1)).toBe(0);
    // It can skip tiers both ways on one move.
    expect(speedTier(300, 0)).toBe(3);
    expect(speedTier(0, 3)).toBe(0);
  });

  it('follows the pointer at full speed', () => {
    const s = startScrub(100, 100 * scale, scale);
    expect(position(s, 100)).toBeCloseTo(100 * scale, 12);
    expect(position(s, 400)).toBeCloseTo(400 * scale, 12);
  });

  it('does not move the playhead when the speed changes, and each speed moves it at its gain', () => {
    let s = startScrub(100, 100 * scale, scale);
    let at = position(s, 300);
    s = moveScrub(s, 300, 0, context());
    expect(position(s, 300)).toBe(at);
    let along = 300;
    for (const [distance, gain] of [[60, 1 / 4], [160, 1 / 16], [260, 1 / 64]] as const) {
      // Pull straight out: the playhead stays exactly where it is, at every step of the way.
      s = moveScrub(s, along, distance, context());
      expect(TRACE_SCRUB_SPEEDS[s.tier].gain).toBe(gain);
      expect(s.along).toBe(along);
      expect(position(s, along)).toBeCloseTo(at, 14);
      // Now move along it.
      const next = along + 64;
      expect(position(s, next) - position(s, along)).toBeCloseTo(64 * gain * scale, 12);
      at = position(s, next);
      along = next;
      s = moveScrub(s, along, distance, context());
    }
    // And all the way back in, still without a jump.
    const fast = moveScrub(s, along, 0, context());
    expect(fast.tier).toBe(0);
    expect(position(fast, along)).toBeCloseTo(at, 14);
    expect(position(fast, along + 10) - position(fast, along)).toBeCloseTo(10 * scale, 12);
  });

  it('keeps moving across a boundary in one diagonal step by only that step', () => {
    let s = startScrub(100, 100 * scale, scale);
    const before = position(s, 100);
    s = moveScrub(s, 110, 80, context());
    // The step that crossed is charged at the old speed; nothing else moves.
    expect(position(s, 110) - before).toBeCloseTo(10 * scale, 12);
    expect(s.tier).toBe(1);
  });

  it('goes on from where the playhead shows when the zoom changes mid-scrub', () => {
    const s = startScrub(100, 0.5, scale);
    const here = position(s, 120);
    const finer = scale / 8;
    const next = rescaleScrub(s, 120, here, finer);
    expect(position(next, 120)).toBe(here);
    expect(position(next, 128) - position(next, 120)).toBeCloseTo(8 * finer, 12);
    expect(next.tier).toBe(s.tier);
  });

  it('stops at the ends of the axis, and takes the same way back', () => {
    const s = startScrub(590, 590 * scale, scale);
    expect(position(s, 800)).toBe(1);
    expect(position(s, 600)).toBeCloseTo(1, 12);
    expect(position(s, 590)).toBeCloseTo(590 * scale, 12);
    expect(position(startScrub(5, 5 * scale, scale), -100)).toBe(0);
  });

  it('snaps softly to a dash within about 6 px of pointer travel, at any speed', () => {
    const stops: Array<TraceStop<string>> = [{ key: 'a', time: 0.5 * HOUR }];
    const marks = selectStops(stops, { axis, win: FULL, length });
    expect(marks[0].along).toBeCloseTo(300, 9);
    const c = context(marks);
    const s = startScrub(290, 290 * scale, scale);
    expect(scrubPosition(s, 293, c).mark).toBeNull();
    expect(scrubPosition(s, 295, c).mark?.stop.key).toBe('a');
    expect(scrubPosition(s, 295, c).fraction).toBe(0.5);
    expect(scrubPosition(s, 305, c).mark?.stop.key).toBe('a');
    expect(scrubPosition(s, 307, c).mark).toBeNull();

    // At 1/64 the same pointer travel is a sliver of the rail: it doesn't stick for hundreds of px.
    let slow = startScrub(290, 290 * scale, scale);
    slow = moveScrub(slow, 290, 260, c);
    expect(slow.tier).toBe(3);
    const reach = (along: number) => scrubPosition(slow, along, c).mark;
    // 10 rail px off is 640 px of pointer travel; within 6 of those it snaps.
    expect(reach(290 + 640 - 7)).toBeNull();
    expect(reach(290 + 640 - 5)?.stop.key).toBe('a');
    expect(reach(290 + 640 + 5)?.stop.key).toBe('a');
    expect(reach(290 + 640 + 7)).toBeNull();
  });

  it('does not move the playhead off a stop when the speed changes while snapped to it', () => {
    const marks = selectStops([{ key: 'a', time: 0.5 * HOUR }], { axis, win: FULL, length });
    const c = context(marks);
    const s = startScrub(290, 290 * scale, scale);
    // At 303 it's snapped, 3 px past the stop; that much at a quarter speed would be out of reach.
    expect(scrubPosition(s, 303, c).fraction).toBe(0.5);
    const slower = moveScrub(s, 303, 60, c);
    expect(slower.tier).toBe(1);
    expect(scrubPosition(slower, 303, c).fraction).toBe(0.5);
    expect(scrubPosition(slower, 303, c).mark?.stop.key).toBe('a');
  });

  it('returns the same state when nothing changes, so a move is cheap', () => {
    const s = startScrub(100, 0.2, scale);
    expect(moveScrub(s, 130, 0, context())).toBe(s);
  });
});

describe('layout', () => {
  const lane = (key: string, threads = 2): TraceLane => ({
    key,
    title: key,
    diamonds: { times: [] },
    density: { times: [] },
    threads: Array.from({ length: threads }, (_, i) => ({ id: i })),
  });

  it('lays out a single lane with no title row, and thread rows from what is left', () => {
    const rows = layoutStrip([lane('a')], 200);
    expect(rows.map((r) => r.type)).toEqual(['diamonds', 'density', 'thread', 'thread']);
    expect(rows[0].at).toBe(22);
    expect(rows[1].at).toBe(36);
    expect(rows[2].at).toBe(64);
    expect(rows[2].size).toBe(14);
  });

  it('gives each of several lanes a title, then requests at the bottom and stops at the top', () => {
    const rows = layoutStrip([lane('a'), lane('b')], 400, { requests: true, stops: true });
    expect(rows[0].type).toBe('stops');
    expect(rows[rows.length - 1].type).toBe('requests');
    expect(rows.filter((r) => r.type === 'title').map((r) => r.lane?.key)).toEqual(['a', 'b']);
  });

  it('squeezes thread rows between 4 and 14 px, and sizes itself at the fullest', () => {
    const many = [lane('a', 40)];
    expect(layoutStrip(many, 100).find((r) => r.type === 'thread')?.size).toBe(4);
    const one = [lane('a', 1)];
    expect(layoutStrip(one, 1000).find((r) => r.type === 'thread')?.size).toBe(14);
    const full = stripHeight(one);
    expect(layoutStrip(one, full).find((r) => r.type === 'thread')?.size).toBe(14);
  });

  it('finds the row at a spot, and where a lane ends', () => {
    const lanes = [lane('a'), lane('b')];
    const rows = layoutStrip(lanes, 400);
    expect(rowAt(rows, 0)).toBeNull();
    const first = rows[0];
    expect(rowAt(rows, first.at)).toBe(first);
    expect(rowAt(rows, first.at + first.size - 1)).toBe(first);
    const lastOfA = rows.filter((r) => r.lane === lanes[0]).pop() as (typeof rows)[number];
    expect(laneEnd(rows, lanes[0])).toBe(lastOfA.at + lastOfA.size);
  });

  it('makes each lane a thin column on a rail, with 3 or 4 fitting beside the dashes', () => {
    for (const n of [1, 2, 3, 4]) {
      const rows = layoutRail(Array.from({ length: n }, (_, i) => lane(`l${i}`)));
      expect(rows).toHaveLength(n);
      for (let i = 1; i < rows.length; i++) expect(rows[i].at).toBeGreaterThanOrEqual(rows[i - 1].at + rows[i - 1].size);
      const dash = railDashInset(rows);
      // A dash at rest stays on a 44 px rail, and at its peak it doesn't go more than a few px past it.
      expect(dash + TRACE_WAVE_REST).toBeLessThanOrEqual(44);
      expect(dash + TRACE_WAVE_PEAK).toBeLessThanOrEqual(44 + 6);
      expect(rows[0].size).toBeGreaterThanOrEqual(3);
    }
    expect(railDashInset([])).toBe(5);
  });

  it('shows a lane with only threads on a rail as all of them together', () => {
    const rows = layoutRail([{ key: 'a', threads: [{ id: 1 }] }, { key: 'b' }]);
    expect(rows).toHaveLength(1);
    expect(rows[0].type).toBe('thread');
    expect(rows[0].thread).toBeUndefined();
  });

  it('requestAt finds the nearest dot or band end, within reach', () => {
    const requests = [{ id: 'a', time: 100 }, { id: 'b', time: 200, from: 240, to: 280 }];
    const alongOf = (t: number) => t;
    expect(requestAt(requests, alongOf, 104)?.id).toBe('a');
    expect(requestAt(requests, alongOf, 110)).toBeNull();
    expect(requestAt(requests, alongOf, 237)?.id).toBe('b');
    expect(requestAt(requests, alongOf, 285)?.id).toBe('b');
    expect(requestAt(requests, alongOf, 195)?.id).toBe('b');
  });
});

describe('the preview card', () => {
  const base = { railWidth: 44, railTop: 0, hostWidth: 390, hostHeight: 844, cardWidth: 200, cardHeight: 80 };

  it('sits beside the rail while the pointer is on it, as IndexBar does', () => {
    const spot = placeRailCard({ ...base, along: 400, pull: 0 });
    expect(spot.inset).toBe(48);
    expect(spot.top).toBe(360);
  });

  it('moves out with the pointer so the pointer never covers it', () => {
    const near = placeRailCard({ ...base, along: 400, pull: 30 });
    expect(near.inset).toBeGreaterThan(44 + 30);
    expect(near.top).toBe(360);
  });

  it('goes above the pointer when it runs out of room on the inner side, and stays on the window', () => {
    const far = placeRailCard({ ...base, along: 400, pull: 180 });
    expect(far.top + 80).toBeLessThan(400);
    expect(far.inset).toBeGreaterThanOrEqual(8);
    expect(far.inset + 200).toBeLessThanOrEqual(390 - 8);
    const farther = placeRailCard({ ...base, along: 400, pull: 330 });
    expect(farther.inset + 200).toBeLessThanOrEqual(390 - 8);
  });

  it('goes under the pointer when there is no room above it', () => {
    const spot = placeRailCard({ ...base, along: 40, pull: 180 });
    expect(spot.top).toBe(58);
  });

  it('stays on the window at the ends of the rail, which may not start at its top', () => {
    expect(placeRailCard({ ...base, along: 0, pull: 0 }).top).toBe(8);
    expect(placeRailCard({ ...base, along: 844, pull: 0 }).top).toBe(844 - 80 - 8);
    expect(placeRailCard({ ...base, along: 0, pull: 0, railTop: 60 }).top).toBe(-40);
    expect(placeRailCard({ ...base, along: 770, pull: 0, railTop: 60 }).top).toBe(844 - 60 - 80 - 8);
  });

  it('sits above a strip when its parent has room, then under it, then over its rows, and stays on it', () => {
    const strip = { width: 1200, height: 300, cardWidth: 200, cardHeight: 100 };
    expect(placeStripCard({ ...strip, along: 600, above: 400, below: 0 })).toEqual({ left: 500, top: -106 });
    expect(placeStripCard({ ...strip, along: 600, above: 40, below: 400 })).toEqual({ left: 500, top: 306 });
    expect(placeStripCard({ ...strip, along: 600, above: 0, below: 0 })).toEqual({ left: 500, top: 28 });
    expect(placeStripCard({ ...strip, along: 10, above: 400, below: 0 }).left).toBe(6);
    expect(placeStripCard({ ...strip, along: 1195, above: 400, below: 0 }).left).toBe(994);
  });
});

describe('the wave', () => {
  // IndexBar's falloff, in stops: rest 9, peak 28, reach 3.2 stops, with a stop's room being 10 px.
  const indexBarSwell = (d: number) => (d >= 3.2 ? 0 : (1 + Math.cos((Math.PI * d) / 3.2)) / 2);

  it('uses the same dash and falloff as IndexBar', () => {
    expect(TRACE_WAVE_REST).toBe(9);
    expect(TRACE_WAVE_PEAK).toBe(28);
    for (const d of [0, 0.5, 1, 2, 3, 3.19, 3.2, 5]) {
      expect(traceSwell(d * 10)).toBeCloseTo(indexBarSwell(d), 12);
      expect(traceSwell(-d * 10)).toBeCloseTo(indexBarSwell(d), 12);
    }
  });
});

describe('sameLanes', () => {
  const times = new Float64Array([1]);
  const lane = (): TraceLane => ({ key: 'a', title: 'A', offset: 2, density: { times }, marks: [{ key: 'm', times }], threads: [{ id: 1 }] });

  it('sees through a rebuilt list', () => {
    expect(sameLanes([lane()], [lane()])).toBe(true);
    const same = [lane()];
    expect(sameLanes(same, same)).toBe(true);
  });

  it('notices what changes the drawing', () => {
    expect(sameLanes([lane()], [])).toBe(false);
    expect(sameLanes([lane()], [{ ...lane(), offset: 3 }])).toBe(false);
    expect(sameLanes([lane()], [{ ...lane(), title: 'B' }])).toBe(false);
    expect(sameLanes([lane()], [{ ...lane(), color: 'red' }])).toBe(false);
    expect(sameLanes([lane()], [{ ...lane(), density: { times: new Float64Array([1]) } }])).toBe(false);
    expect(sameLanes([lane()], [{ ...lane(), marks: [] }])).toBe(false);
    expect(sameLanes([lane()], [{ ...lane(), marks: [{ key: 'm', times, tone: 'error' }] }])).toBe(false);
    expect(sameLanes([lane()], [{ ...lane(), threads: [{ id: 2 }] }])).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import {
  FLAME_ERROR, FLAME_PENDING, FLAME_WAITING,
  argsort, criticalPath, familyOf, firstChild, firstRoot, flameData, flameExtent, flameIndex, flameTicks, flameTree, formatDuration,
  layoutLanes, packRows, pathTo, percentile, rowAtY, rowWindow, selfTime, selfTimes, siblingOf, spanAt, subIndex, unionMs,
  type FlameLane, type FlameSpanInput,
} from '@/lib/flame-chart-model';

const LANES: FlameLane[] = [
  { key: 'web', title: 'web' },
  { key: 'api', title: 'api', tint: 'var(--primary)' },
];

// web: root 0…100 with two children; api: called from web's child, with a child of its own.
const SPANS: FlameSpanInput[] = [
  { id: 'root', lane: 'web', name: 'GET /checkout', start: 0, end: 100 },
  { id: 'render', parent: 'root', lane: 'web', name: 'render', start: 5, end: 30 },
  { id: 'fetch', parent: 'root', lane: 'web', name: 'fetch /api/cart', start: 20, end: 90, waiting: true },
  { id: 'cart', parent: 'fetch', lane: 'api', name: 'POST /cart', start: 25, end: 85 },
  { id: 'db', parent: 'cart', lane: 'api', name: 'SELECT cart', start: 30, end: 60, error: true },
  { id: 'cache', parent: 'cart', lane: 'api', name: 'cache.get', start: 62, end: 80, pending: true },
];

describe('flameData', () => {
  const data = flameData(LANES, SPANS);

  it('packs objects into columns, keeping their order and ids', () => {
    expect(data.ids).toEqual(SPANS.map((s) => s.id));
    expect(Array.from(data.start)).toEqual([0, 5, 20, 25, 30, 62]);
    expect(Array.from(data.lane)).toEqual([0, 0, 0, 1, 1, 1]);
    expect(Array.from(data.parent)).toEqual([-1, 0, 0, 2, 3, 3]);
    expect(data.names[data.name[4]]).toBe('SELECT cart');
    expect(data.flags[2]).toBe(FLAME_WAITING);
    expect(data.flags[4]).toBe(FLAME_ERROR);
    expect(data.flags[5]).toBe(FLAME_PENDING);
  });

  it('colours spans by lane: its tint, else a chart colour', () => {
    expect(data.colors[data.color[0]]).toBe('var(--chart-1)');
    expect(data.colors[data.color[3]]).toBe('var(--primary)');
  });

  it('puts a child under its parent, and overlapping siblings on rows of their own', () => {
    expect(data.depth[0]).toBe(0);
    // render and fetch overlap (20…30), so fetch goes a row further down.
    expect(data.depth[1]).toBe(1);
    expect(data.depth[2]).toBe(2);
    // The api lane starts again at the top: its cause is in another lane.
    expect(data.depth[3]).toBe(0);
    expect(data.depth[4]).toBe(1);
    expect(data.depth[5]).toBe(1);
  });

  it('links spans whose cause is in another lane', () => {
    expect(Array.from(data.links!.from)).toEqual([2]);
    expect(Array.from(data.links!.to)).toEqual([3]);
  });

  it('gives an unknown lane a lane of its own, and survives a missing parent and a cycle', () => {
    const odd = flameData([], [
      { id: 'a', parent: 'b', lane: 'x', name: 'a', start: 0, end: 5 },
      { id: 'b', parent: 'a', lane: 'x', name: 'b', start: 1, end: 4 },
      { id: 'c', parent: 'nobody', lane: 'y', name: 'c', start: 2, end: 3 },
    ]);
    expect(odd.lanes.map((l) => l.key)).toEqual(['x', 'y']);
    expect(odd.parent[2]).toBe(-1);
    expect(odd.depth.length).toBe(3);
  });

  it('places a child whose clock ran early under its parent anyway', () => {
    const skew = flameData(LANES, [
      { id: 'p', lane: 'web', name: 'p', start: 10, end: 50 },
      { id: 'c', parent: 'p', lane: 'web', name: 'c', start: 8, end: 20 },
    ]);
    expect(skew.depth[1]).toBe(1);
  });
});

describe('packRows', () => {
  it('stacks overlapping roots and reuses a row once it is free', () => {
    const depth = packRows([0, 5, 20], [10, 15, 30], [0, 0, 0], [-1, -1, -1]);
    expect(Array.from(depth)).toEqual([0, 1, 0]);
  });
});

describe('argsort', () => {
  it('is the identity for sorted values and sorts the rest stably', () => {
    expect(Array.from(argsort([1, 2, 3]))).toEqual([0, 1, 2]);
    expect(Array.from(argsort([3, 1, 1, 0]))).toEqual([3, 1, 2, 0]);
  });
});

describe('the tree', () => {
  const data = flameData(LANES, SPANS);

  it('lists children by start, with the roots last', () => {
    const { offsets, children } = flameTree(data);
    expect(Array.from(children.slice(offsets[0], offsets[1]))).toEqual([1, 2]);
    expect(Array.from(children.slice(offsets[6], offsets[7]))).toEqual([0]);
  });

  it('works out self time as duration minus the union of the children', () => {
    // Children 5…30 and 20…90 cover 5…90: 15 of 100 left.
    expect(selfTime(data, 0)).toBe(15);
    expect(selfTime(data, 3)).toBe(60 - 30 - 18);
    expect(Array.from(selfTimes(data))).toEqual([15, 25, 10, 12, 30, 18]);
  });

  it('finds a family: ancestors and descendants, across lanes', () => {
    expect([...familyOf(data, 3)].sort()).toEqual([0, 2, 3, 4, 5]);
    expect(familyOf(data, -1).size).toBe(0);
    expect(pathTo(data, 4)).toEqual([0, 2, 3, 4]);
  });

  it('follows the critical path, leaving pending spans out', () => {
    // root waited on fetch (ends 90), which waited on cart, which waited on db (cache is pending).
    expect(criticalPath(data, 0)).toEqual([0, 2, 3, 4]);
  });

  it('moves between siblings, to parents and to children', () => {
    expect(siblingOf(data, 1, 1)).toBe(2);
    expect(siblingOf(data, 2, 1)).toBe(-1);
    expect(siblingOf(data, 4, 1)).toBe(5);
    expect(firstChild(data, 3)).toBe(4);
    expect(firstChild(data, 4)).toBe(-1);
    expect(firstRoot(data)).toBe(0);
  });
});

describe('the index', () => {
  const data = flameData(LANES, SPANS);
  const index = flameIndex(data);

  it('has each lane\'s rows and each row\'s spans by start', () => {
    expect(Array.from(index.laneRows)).toEqual([3, 2]);
    expect(index.rows).toBe(5);
    const apiRow1 = index.laneBase[1] + 1;
    expect(Array.from(index.order.slice(index.rowOffsets[apiRow1], index.rowOffsets[apiRow1 + 1]))).toEqual([4, 5]);
    expect(index.slot[5]).toBe(index.rowOffsets[apiRow1] + 1);
  });

  it('finds a long span that started before the view', () => {
    const long = flameData(LANES, [
      { id: 'a', lane: 'web', name: 'long', start: 0, end: 1000 },
      { id: 'b', lane: 'web', name: 'later', start: 1100, end: 1200 },
    ]);
    const idx = flameIndex(long);
    const [lo, hi] = rowWindow(idx, 0, 500, 600);
    expect(Array.from(idx.order.slice(lo, hi))).toEqual([0]);
  });

  it('hits the span under a time, within slop', () => {
    expect(spanAt(index, 1, 1, 45)).toBe(4);
    expect(spanAt(index, 1, 1, 61)).toBe(-1);
    expect(spanAt(index, 1, 1, 61, 1.5)).toBe(5);
    expect(spanAt(index, 0, 9, 10)).toBe(-1);
  });

  it('keeps row numbers in a subset', () => {
    const keep = new Uint8Array(6);
    keep[4] = 1;
    const sub = subIndex(data, keep);
    expect(sub.rows).toBe(index.rows);
    expect(Array.from(sub.order)).toEqual([4]);
    expect(spanAt(sub, 1, 1, 45)).toBe(4);
  });

  it('lays out lanes, collapsed ones as their header', () => {
    const open = layoutLanes(index, [], data.lanes, 18, 22);
    expect(Array.from(open.heights)).toEqual([22 + 3 * 18 + 4, 22 + 2 * 18 + 4]);
    const shut = layoutLanes(index, ['web'], data.lanes, 18, 22);
    expect(shut.heights[0]).toBe(22);
    expect(rowAtY(open, 10)).toEqual({ lane: 0, row: -1 });
    expect(rowAtY(open, 22 + 18 + 2)).toEqual({ lane: 0, row: 1 });
    expect(rowAtY(shut, 23)).toEqual({ lane: 1, row: -1 });
    expect(rowAtY(open, 10_000)).toBeNull();
  });
});

describe('numbers', () => {
  it('unions intervals', () => {
    expect(unionMs([{ start: 0, end: 10 }, { start: 5, end: 15 }, { start: 20, end: 25 }, { start: 3, end: 3 }])).toBe(20);
    expect(unionMs([])).toBe(0);
  });

  it('takes percentiles by nearest rank', () => {
    expect(percentile([5, 1, 4, 2, 3], 0.5)).toBe(3);
    expect(percentile(Float64Array.of(1, 2, 3, 4), 0.95)).toBe(4);
    expect(percentile([], 0.5)).toBe(0);
  });

  it('finds the extent', () => {
    expect(flameExtent(flameData(LANES, SPANS))).toEqual({ start: 0, end: 100 });
    expect(flameExtent({ start: new Float64Array(0), end: new Float64Array(0) })).toEqual({ start: 0, end: 1 });
  });

  it('puts ticks at round offsets from the start of the range', () => {
    const ticks = flameTicks({ start: 1_700_000_000_123, end: 1_700_000_000_623 }, { start: 1_700_000_000_123, end: 1_700_000_000_623 }, 500);
    expect(ticks[0].time - 1_700_000_000_123).toBe(0);
    expect(ticks[1].time - ticks[0].time).toBe(100);
  });

  it('formats durations', () => {
    expect(formatDuration(0.85)).toBe('850 µs');
    expect(formatDuration(12.44)).toBe('12.4 ms');
    expect(formatDuration(1250)).toBe('1.25 s');
    expect(formatDuration(125_000)).toBe('2m 05s');
  });
});

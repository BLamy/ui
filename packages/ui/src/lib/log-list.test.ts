import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import {
  RowHeights, RowIdIndex, RowTimes, countLogLevels, followTop, formatLogTime, logRowText, nodeText, normalizeLogLevel, rowKeyTarget, rowRange, rowsChange,
} from '@/lib/log-list';

describe('RowHeights', () => {
  /** The same answers as adding up an array by hand. */
  const check = (heights: RowHeights, values: number[]) => {
    let y = 0;
    expect(heights.count).toBe(values.length);
    values.forEach((h, i) => {
      expect(heights.offsetOf(i)).toBe(y);
      expect(heights.get(i)).toBe(h);
      expect(heights.indexAt(y)).toBe(i);
      if (h > 1) expect(heights.indexAt(y + h - 1)).toBe(i);
      y += h;
    });
    expect(heights.total).toBe(y);
    expect(heights.offsetOf(values.length)).toBe(y);
  };

  it('starts with every row at the estimate', () => {
    const heights = new RowHeights(5, 24);
    check(heights, [24, 24, 24, 24, 24]);
    expect(heights.measured).toBe(0);
  });

  it('keeps offsets right through measurements in any order', () => {
    const heights = new RowHeights(100, 24);
    const values = new Array<number>(100).fill(24);
    for (const [i, h] of [[50, 72], [0, 18], [99, 400], [51, 24], [7, 36], [50, 40]] as const) {
      heights.set(i, h);
      values[i] = h;
      check(heights, values);
    }
    expect(heights.isMeasured(50)).toBe(true);
    expect(heights.isMeasured(1)).toBe(false);
  });

  it('clamps out-of-range offsets to the first and last rows', () => {
    const heights = new RowHeights(3, 10);
    expect(heights.indexAt(-5)).toBe(0);
    expect(heights.indexAt(29)).toBe(2);
    expect(heights.indexAt(1000)).toBe(2);
    expect(new RowHeights(0, 10).indexAt(50)).toBe(0);
  });

  it("ignores a height of 0, which is a hidden row's, not its real height", () => {
    const heights = new RowHeights(2, 10);
    expect(heights.set(0, 0)).toBe(false);
    expect(heights.get(0)).toBe(10);
    expect(heights.isMeasured(0)).toBe(false);
  });

  it('grows and shrinks, keeping what was measured', () => {
    const heights = new RowHeights(4, 10);
    heights.set(1, 30);
    heights.resize(6);
    check(heights, [10, 30, 10, 10, 10, 10]);
    heights.resize(2);
    check(heights, [10, 30]);
    heights.resize(3);
    check(heights, [10, 30, 10]);
    // Past its capacity, and through a large change that rebuilds rather than walks.
    heights.resize(5000);
    expect(heights.total).toBe(10 + 30 + 4998 * 10);
    expect(heights.offsetOf(4999)).toBe(10 + 30 + 4997 * 10);
    expect(heights.get(1)).toBe(30);
    heights.resize(2);
    check(heights, [10, 30]);
  });

  it('forgets everything on reset, and a rebase only changes what was not measured', () => {
    const heights = new RowHeights(3, 10);
    heights.set(1, 50);
    heights.rebase(20);
    check(heights, [20, 50, 20]);
    expect(heights.average).toBe(50);
    heights.reset(2, 30);
    check(heights, [30, 30]);
    expect(heights.measured).toBe(0);
    expect(heights.average).toBe(30);
  });

  it('holds 100,000 rows and answers without a per-row walk', () => {
    const heights = new RowHeights(100_000, 24);
    heights.set(99_999, 100);
    heights.set(0, 48);
    expect(heights.total).toBe(99_998 * 24 + 100 + 48);
    expect(heights.indexAt(48)).toBe(1);
    expect(heights.indexAt(heights.total - 1)).toBe(99_999);
  });
});

describe('rowRange', () => {
  it('covers the view and the overscan, and stays in the list', () => {
    const heights = new RowHeights(100, 10);
    expect(rowRange(heights, 200, 50, 20)).toEqual({ start: 18, end: 28 });
    expect(rowRange(heights, 0, 50, 20)).toEqual({ start: 0, end: 8 });
    expect(rowRange(heights, 950, 50, 20)).toEqual({ start: 93, end: 100 });
    expect(rowRange(new RowHeights(0, 10), 0, 50, 20)).toEqual({ start: 0, end: 0 });
  });
});

describe('rowsChange', () => {
  const rows = (...ids: number[]) => ids.map((id) => ({ id }));
  it('reads a list growing, being cut back, or replaced', () => {
    const a = rows(1, 2, 3);
    expect(rowsChange(a, a)).toBe('same');
    expect(rowsChange(a, rows(1, 2, 3))).toBe('same');
    expect(rowsChange(a, rows(1, 2, 3, 4))).toBe('append');
    expect(rowsChange(a, rows(1, 2))).toBe('truncate');
    expect(rowsChange(a, rows(2, 3))).toBe('replace');
    expect(rowsChange(a, rows(1, 3))).toBe('replace');
    expect(rowsChange([], a)).toBe('append');
    expect(rowsChange([], [])).toBe('same');
    expect(rowsChange(a, [])).toBe('truncate');
  });
});

describe('RowIdIndex', () => {
  const rows = (...ids: (string | number)[]) => ids.map((id) => ({ id }));
  it('finds rows, and a row that is gone is -1', () => {
    const index = new RowIdIndex();
    index.update(rows('a', 'b', 'c'), 'append');
    expect(index.indexOf('b')).toBe(1);
    expect(index.indexOf('c')).toBe(2);
    expect(index.indexOf('nope')).toBe(-1);
    expect(index.indexOf('a')).toBe(0);
  });
  it('follows a list as it grows, is cut back and is replaced', () => {
    const index = new RowIdIndex();
    index.update(rows('a', 'b'), 'append');
    expect(index.indexOf('b')).toBe(1);
    index.update(rows('a', 'b', 'c'), 'append');
    expect(index.indexOf('c')).toBe(2);
    index.update(rows('a'), 'truncate');
    expect(index.indexOf('c')).toBe(-1);
    expect(index.indexOf('b')).toBe(-1);
    index.update(rows('a', 'x'), 'append');
    expect(index.indexOf('x')).toBe(1);
    index.update(rows('x', 'a'), 'replace');
    expect(index.indexOf('a')).toBe(1);
    expect(index.indexOf('x')).toBe(0);
  });
});

describe('RowTimes', () => {
  it('finds the first row after a time', () => {
    const times = new RowTimes();
    times.update([{ time: 10 }, { time: 20 }, { time: 20 }, { time: 30 }], 'append');
    expect(times.firstAfter(5)).toBe(0);
    expect(times.firstAfter(10)).toBe(1);
    expect(times.firstAfter(20)).toBe(3);
    expect(times.firstAfter(29)).toBe(3);
    expect(times.firstAfter(30)).toBe(4);
  });
  it("isn't thrown off by rows with no time, or out of order", () => {
    const times = new RowTimes();
    times.update([{ time: 10 }, {}, { time: 40 }, { time: 15 }, {}, { time: 50 }], 'append');
    expect(times.firstAfter(10)).toBe(2);
    expect(times.firstAfter(39)).toBe(2);
    expect(times.firstAfter(40)).toBe(5);
    const none = new RowTimes();
    none.update([{}, {}], 'append');
    expect(none.firstAfter(0)).toBe(2);
    expect(new RowTimes().firstAfter(0)).toBe(0);
  });
  it('picks up rows added later and forgets rows taken away', () => {
    const times = new RowTimes();
    times.update([{ time: 10 }], 'append');
    expect(times.firstAfter(10)).toBe(1);
    times.update([{ time: 10 }, { time: 20 }], 'append');
    expect(times.firstAfter(10)).toBe(1);
    expect(times.firstAfter(20)).toBe(2);
    times.update([{ time: 10 }], 'truncate');
    expect(times.firstAfter(10)).toBe(1);
    times.update([{ time: 90 }], 'replace');
    expect(times.firstAfter(10)).toBe(0);
    // Grows past what it had room for.
    times.update(Array.from({ length: 5000 }, (_, i) => ({ time: i })), 'append');
    expect(times.firstAfter(4000)).toBe(4001);
  });
});

describe('followTop', () => {
  const base = { view: 100, total: 10_000, band: 0.15 };
  it("doesn't move while the marker is inside the band", () => {
    expect(followTop({ ...base, y: 550, top: 500 })).toBe(500);
    expect(followTop({ ...base, y: 515, top: 500 })).toBe(500);
    expect(followTop({ ...base, y: 585, top: 500 })).toBe(500);
  });
  it('rides the edge of the band just past it', () => {
    expect(followTop({ ...base, y: 590, top: 500 })).toBe(505);
    expect(followTop({ ...base, y: 510, top: 500 })).toBe(495);
  });
  it('centers a marker that has gone somewhere out of sight', () => {
    expect(followTop({ ...base, y: 5000, top: 500 })).toBe(4950);
    expect(followTop({ ...base, y: 100, top: 500 })).toBe(50);
  });
  it('stays inside the list', () => {
    expect(followTop({ ...base, y: 0, top: 0 })).toBe(0);
    expect(followTop({ ...base, y: 10_000, top: 9900 })).toBe(9900);
    expect(followTop({ view: 500, total: 100, y: 80, top: 0 })).toBe(0);
  });
});

describe('rowKeyTarget', () => {
  const page = (direction: 1 | -1) => (direction > 0 ? 30 : 5);
  it('moves within the list', () => {
    expect(rowKeyTarget('ArrowDown', 3, 10, page)).toBe(4);
    expect(rowKeyTarget('ArrowDown', 9, 10, page)).toBe(9);
    expect(rowKeyTarget('ArrowUp', 3, 10, page)).toBe(2);
    expect(rowKeyTarget('ArrowUp', 0, 10, page)).toBe(0);
    expect(rowKeyTarget('Home', 3, 10, page)).toBe(0);
    expect(rowKeyTarget('End', 3, 10, page)).toBe(9);
    expect(rowKeyTarget('PageDown', 3, 100, page)).toBe(30);
    expect(rowKeyTarget('PageDown', 3, 10, page)).toBe(9);
    expect(rowKeyTarget('PageUp', 20, 100, page)).toBe(5);
  });
  it('always moves on Page keys, even if a row is taller than the view', () => {
    expect(rowKeyTarget('PageDown', 3, 10, () => 3)).toBe(4);
    expect(rowKeyTarget('PageUp', 3, 10, () => 3)).toBe(2);
  });
  it('ignores other keys and empty lists', () => {
    expect(rowKeyTarget('a', 3, 10, page)).toBeNull();
    expect(rowKeyTarget('ArrowDown', 0, 0, page)).toBeNull();
  });
});

describe('text', () => {
  it('maps console levels onto the five', () => {
    expect(normalizeLogLevel('warning')).toBe('warn');
    expect(normalizeLogLevel('WARN')).toBe('warn');
    expect(normalizeLogLevel('assert')).toBe('error');
    expect(normalizeLogLevel('trace')).toBe('debug');
    expect(normalizeLogLevel('info')).toBe('info');
    expect(normalizeLogLevel('group')).toBe('log');
    expect(normalizeLogLevel(undefined)).toBe('log');
  });
  it('counts levels', () => {
    expect(countLogLevels([{ level: 'error' }, { level: 'warning' }, { level: 'warn' }, {}, { level: 'trace' }])).toEqual({
      total: 5, error: 1, warn: 2, info: 0, log: 1, debug: 1,
    });
  });
  it('formats time', () => {
    expect(formatLogTime(0)).toBe('0:00.000');
    expect(formatLogTime(1204)).toBe('0:01.204');
    expect(formatLogTime(61_005)).toBe('1:01.005');
    expect(formatLogTime(3_600_000)).toBe('1:00:00.000');
    expect(formatLogTime(3_725_250)).toBe('1:02:05.250');
    expect(formatLogTime(-1500)).toBe('-0:01.500');
    expect(formatLogTime(Number.NaN)).toBe('');
  });
  it('reads the text out of a node', () => {
    const node = createElement('span', null, 'a ', createElement('b', null, 1), [' c', null], false);
    expect(nodeText(node)).toBe('a 1 c');
    expect(nodeText(null)).toBe('');
    expect(nodeText(7)).toBe('7');
    expect(nodeText(true)).toBe('');
  });
  it('writes a row as text', () => {
    expect(logRowText({ id: 1, level: 'warning', time: 1204, source: 'app.js:42', message: 'Slow' })).toBe('0:01.204 [warn] Slow (app.js:42)');
    expect(logRowText({ id: 1, message: 'Plain' })).toBe('[log] Plain');
    expect(logRowText({ id: 1, level: 'error', message: createElement('b', null, 'Rich'), text: 'As text', detail: 'at a\nat b' })).toBe('[error] As text\nat a\nat b');
    expect(logRowText({ id: 1, time: 5, message: 'x' }, () => 'T')).toBe('T [log] x');
  });
});

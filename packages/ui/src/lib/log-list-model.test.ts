import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import {
  RowIdIndex, RowTimes, countLogLevels, followTop, formatLogTime, logRowText, nodeText, normalizeLogLevel, rowsChange,
} from '@/lib/log-list-model';

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

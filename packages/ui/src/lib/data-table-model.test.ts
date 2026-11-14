import { describe, expect, it } from 'vitest';
import { clampColumnWidth, columnTemplate, fieldSortValue, nextDataTableSort, sortDataTableRows, timeShare } from '@/lib/data-table-model';

describe('sorting', () => {
  const rows = [
    { id: 1, name: 'Beta', n: 30 },
    { id: 2, name: 'alpha', n: 10 },
    { id: 3, name: 'gamma', n: null },
    { id: 4, name: 'delta', n: 20 },
  ];
  const ids = (sorted: readonly { id: number }[]) => sorted.map((row) => row.id);

  it('keeps the rows as they are with no sort', () => {
    expect(sortDataTableRows(rows, null, fieldSortValue)).toBe(rows);
  });
  it('sorts by a field, strings without regard to case, empty cells last both ways', () => {
    expect(ids(sortDataTableRows(rows, { column: 'name', direction: 'ascending' }, fieldSortValue))).toEqual([2, 1, 4, 3]);
    expect(ids(sortDataTableRows(rows, { column: 'n', direction: 'ascending' }, fieldSortValue))).toEqual([2, 4, 1, 3]);
    expect(ids(sortDataTableRows(rows, { column: 'n', direction: 'descending' }, fieldSortValue))).toEqual([1, 4, 2, 3]);
  });
  it('reads dates, booleans and bigints as numbers, and objects as nothing', () => {
    expect(fieldSortValue({ d: new Date(5) }, 'd')).toBe(5);
    expect(fieldSortValue({ b: true }, 'b')).toBe(1);
    expect(fieldSortValue({ b: 7n }, 'b')).toBe(7);
    expect(fieldSortValue({ o: { a: 1 } }, 'o')).toBeUndefined();
  });
  it('cycles ascending, descending, off', () => {
    expect(nextDataTableSort(null, 'a')).toEqual({ column: 'a', direction: 'ascending' });
    expect(nextDataTableSort({ column: 'a', direction: 'ascending' }, 'a')).toEqual({ column: 'a', direction: 'descending' });
    expect(nextDataTableSort({ column: 'a', direction: 'descending' }, 'a')).toBeNull();
    expect(nextDataTableSort({ column: 'a', direction: 'descending' }, 'b')).toEqual({ column: 'b', direction: 'ascending' });
  });
});

describe('columns', () => {
  it('shares the spare width among flexible columns', () => {
    const { template, minWidth } = columnTemplate([{ id: 'a', flex: 2, minWidth: 100 }, { id: 'b', width: 60 }, { id: 'c', flex: 1, minWidth: 80 }], {});
    expect(template).toBe('minmax(100px,2fr) 60px minmax(80px,1fr)');
    expect(minWidth).toBe(240);
  });
  it('gives a dragged column its width', () => {
    const { template, minWidth } = columnTemplate([{ id: 'a', flex: 2, minWidth: 100 }, { id: 'b', width: 60 }, { id: 'c', flex: 1, minWidth: 80 }], { a: 300, b: 90 });
    expect(template).toBe('300px 90px minmax(80px,1fr)');
    expect(minWidth).toBe(470);
  });
  it('adds an empty track when nothing can take the spare width', () => {
    expect(columnTemplate([{ id: 'a', width: 60 }], {}).template).toBe('60px minmax(0,1fr)');
    expect(columnTemplate([{ id: 'a', flex: 1 }], { a: 200 }).template).toBe('200px minmax(0,1fr)');
  });
  it('clamps a resize', () => {
    expect(clampColumnWidth({ id: 'a', minWidth: 50, maxWidth: 100 }, 10)).toBe(50);
    expect(clampColumnWidth({ id: 'a', minWidth: 50, maxWidth: 100 }, 500)).toBe(100);
    expect(clampColumnWidth({ id: 'a' }, 12)).toBe(40);
    expect(clampColumnWidth({ id: 'a' }, 123.4)).toBe(123);
  });
});

describe('time', () => {
  it('places a time only when it is on the range', () => {
    expect(timeShare(25, [0, 100])).toBe(0.25);
    expect(timeShare(150, [100, 200])).toBe(0.5);
    expect(timeShare(-1, [0, 100])).toBeNull();
    expect(timeShare(101, [0, 100])).toBeNull();
    expect(timeShare(null, [0, 100])).toBeNull();
    expect(timeShare(undefined, [0, 100])).toBeNull();
    expect(timeShare(Number.NaN, [0, 100])).toBeNull();
  });
});

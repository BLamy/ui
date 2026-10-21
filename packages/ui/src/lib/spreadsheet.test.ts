import { describe, expect, it } from 'vitest';
import {
  binScale, columnHistogram, columnNumbers, histogramCpu, inferColumnType, parseCellDate, parseCellNumber, selectionStats,
  sortKeys, sortPermutationCpu, sortRows,
} from '@/lib/spreadsheet';

describe('parseCellNumber', () => {
  it('reads the ways spreadsheets write numbers', () => {
    expect(parseCellNumber('42')).toBe(42);
    expect(parseCellNumber(' -3.5e2 ')).toBe(-350);
    expect(parseCellNumber('1,234.5')).toBe(1234.5);
    expect(parseCellNumber('$1,200')).toBe(1200);
    expect(parseCellNumber('-$5')).toBe(-5);
    expect(parseCellNumber('(12)')).toBe(-12);
    expect(parseCellNumber('12%')).toBeCloseTo(0.12);
    expect(parseCellNumber('.5')).toBe(0.5);
  });

  it('is NaN for text, empties and odd groupings', () => {
    for (const s of ['', ' ', 'abc', '1,23', '12abc', '1.2.3', '--1']) expect(parseCellNumber(s)).toBeNaN();
  });
});

describe('column types', () => {
  const rows = [['n', 'd', 't', 'e'], ['1', '2026-01-02', 'x', ''], ['', '2026-01-03T10:00Z', '3', ''], ['2.5', '', 'y', '']];
  it('infers number, date, text and empty, skipping the header', () => {
    expect([0, 1, 2, 3].map((c) => inferColumnType(rows, c, 1))).toEqual(['number', 'date', 'text', 'empty']);
  });
  it('reads dates as UTC milliseconds', () => {
    expect(parseCellDate('2026-01-02')).toBe(Date.UTC(2026, 0, 2));
    expect([...columnNumbers(rows, 1, 1, 'date')].map((v) => Number.isNaN(v))).toEqual([false, false, true]);
  });
});

describe('sortKeys', () => {
  const values = new Float64Array([3, -1, NaN, 0, -0, 1e-300, -Infinity, Infinity, 2 ** 53, 2 ** 53 + 2, -2.5]);
  const sorted = (direction: 'ascending' | 'descending') => [...sortPermutationCpu(sortKeys(values, direction))].map((i) => values[i]);

  it('orders doubles exactly, empties last, ties stable', () => {
    expect(sorted('ascending')).toEqual([-Infinity, -2.5, -1, 0, -0, 1e-300, 3, 2 ** 53, 2 ** 53 + 2, Infinity, NaN]);
    expect(sorted('descending')).toEqual([Infinity, 2 ** 53 + 2, 2 ** 53, 3, 1e-300, 0, -0, -1, -2.5, -Infinity, NaN]);
  });

  it('keeps equal values in their original order', () => {
    const order = sortPermutationCpu(sortKeys(new Float64Array([2, 1, 2, 1])));
    expect([...order]).toEqual([1, 3, 0, 2]);
  });
});

describe('sortRows (CPU)', () => {
  const rows = [['name', 'size'], ['file 10', '10'], ['File 2', ''], ['file 1', '2'], ['', '1,000']];
  it('sorts numbers by value with empty cells last', async () => {
    const r = await sortRows(rows, { column: 1, direction: 'ascending' }, { from: 1, engine: 'fallback' });
    expect([...r.order].map((i) => rows[i + 1][1])).toEqual(['2', '10', '1,000', '']);
    expect(r.ranOn).toBe('cpu');
  });
  it('sorts text naturally, ignoring case, empty last', async () => {
    const r = await sortRows(rows, { column: 0, direction: 'descending' }, { from: 1, engine: 'fallback' });
    expect([...r.order].map((i) => rows[i + 1][0])).toEqual(['file 10', 'File 2', 'file 1', '']);
  });
});

describe('statistics', () => {
  it('sums, averages and bounds the numeric cells', () => {
    expect(selectionStats(['1', '2', 'x', '', '3.5'])).toEqual({ count: 4, numbers: 3, sum: 6.5, average: 6.5 / 3, min: 1, max: 3.5 });
  });

  it('bins values evenly and puts the maximum in the last bin', async () => {
    const values = Float32Array.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect([...histogramCpu(values, 0, 10, 5)]).toEqual([2, 2, 2, 2, 3]);
    expect(binScale(4, 4, 8)).toBe(0);
    const h = await columnHistogram(new Float64Array([NaN, 5, 5, 5]), 4, { engine: 'fallback' });
    expect(h && [...h.bins]).toEqual([3, 0, 0, 0]);
    expect(await columnHistogram(new Float64Array([NaN]), 4, { engine: 'fallback' })).toBeNull();
  });
});

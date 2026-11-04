import { describe, expect, it } from 'vitest';
import {
  clampColumnWidth, columnTemplate, isRequestFailed, nextRequestSort, playheadShare, requestBar, requestDisplayName, requestDurationText, requestName,
  requestSizeText, requestSortValue, requestStatusText, requestTimeRange, requestTone, sortRequests,
} from '@/lib/request-table-model';

describe('what a row says', () => {
  it('names a request by the end of its URL', () => {
    expect(requestName('https://a.com/api/cart?user=1#top')).toBe('cart?user=1');
    expect(requestName('https://a.com/api/cart/')).toBe('cart');
    expect(requestName('https://a.com')).toBe('a.com');
    expect(requestName('https://a.com/?q=1?2')).toBe('a.com?q=1?2');
    expect(requestName('cart:add')).toBe('cart:add');
    expect(requestName('/')).toBe('/');
    expect(requestDisplayName({ url: 'https://a.com/x', name: 'Mine' })).toBe('Mine');
    expect(requestDisplayName({ url: 'https://a.com/x' })).toBe('x');
  });
  it('says what became of it', () => {
    expect(requestStatusText({ status: 200 })).toBe('200');
    expect(requestStatusText({ status: 0 })).toBe('(failed)');
    expect(requestStatusText({ failed: true })).toBe('(failed)');
    expect(requestStatusText({})).toBe('—');
    expect(requestStatusText({ status: 200, pending: true })).toBe('(pending)');
    expect(requestStatusText({ status: 'ok' })).toBe('ok');
  });
  it('knows what failed, and a pending request has not', () => {
    expect(isRequestFailed({ status: 404 })).toBe(true);
    expect(isRequestFailed({ status: 0 })).toBe(true);
    expect(isRequestFailed({ status: 'threw', failed: true })).toBe(true);
    expect(isRequestFailed({ status: 200 })).toBe(false);
    expect(isRequestFailed({ status: 'ok' })).toBe(false);
    expect(isRequestFailed({ status: 500, pending: true })).toBe(false);
  });
  it('says how long and how big', () => {
    expect(requestDurationText({ duration: 34 })).toBe('34 ms');
    expect(requestDurationText({ duration: 1500 })).toBe('1.5 s');
    expect(requestDurationText({})).toBe('—');
    expect(requestDurationText({ pending: true })).toBe('Pending');
    expect(requestSizeText({ size: 1536 })).toBe('1.5 KB');
    expect(requestSizeText({})).toBe('—');
  });
  it('picks a tone', () => {
    expect(requestTone({})).toBe('primary');
    expect(requestTone({ status: 500 })).toBe('danger');
    expect(requestTone({ status: 500, tone: 'accent' })).toBe('accent');
  });
});

describe('the waterfall', () => {
  it('spans the first request to the last answer', () => {
    expect(requestTimeRange([{ time: 100, duration: 50 }, { time: 120, duration: 400 }, { time: 300 }, {}])).toEqual([100, 520]);
    expect(requestTimeRange([])).toEqual([0, 1]);
    expect(requestTimeRange([{ time: 5 }])).toEqual([5, 6]);
  });
  it('places a bar on the range', () => {
    expect(requestBar({ time: 25, duration: 50 }, [0, 100])).toEqual({ left: 25, width: 50 });
    expect(requestBar({ time: 25 }, [0, 100])).toEqual({ left: 25, width: 0 });
    expect(requestBar({}, [0, 100])).toBeNull();
  });
  it('cuts a bar to the range, and drops one outside it', () => {
    expect(requestBar({ time: 90, duration: 50 }, [0, 100])).toEqual({ left: 90, width: 10 });
    expect(requestBar({ time: -10, duration: 20 }, [0, 100])).toEqual({ left: 0, width: 10 });
    expect(requestBar({ time: 200, duration: 5 }, [0, 100])).toBeNull();
    expect(requestBar({ time: -10, duration: 5 }, [0, 100])).toBeNull();
  });
  it('runs a pending bar with no duration to the end', () => {
    expect(requestBar({ time: 50, pending: true }, [0, 100])).toEqual({ left: 50, width: 50 });
    expect(requestBar({ time: 50, pending: true, duration: 10 }, [0, 100])).toEqual({ left: 50, width: 10 });
  });
  it('places the playhead only when it is on the range', () => {
    expect(playheadShare(25, [0, 100])).toBe(0.25);
    expect(playheadShare(150, [100, 200])).toBe(0.5);
    expect(playheadShare(-1, [0, 100])).toBeNull();
    expect(playheadShare(101, [0, 100])).toBeNull();
    expect(playheadShare(null, [0, 100])).toBeNull();
    expect(playheadShare(undefined, [0, 100])).toBeNull();
    expect(playheadShare(Number.NaN, [0, 100])).toBeNull();
  });
});

describe('sorting', () => {
  const rows = [
    { id: 1, url: 'https://a.com/Beta', status: 200, duration: 30 },
    { id: 2, url: 'https://a.com/alpha', status: 500, duration: 10 },
    { id: 3, url: 'https://a.com/gamma', status: 200 },
    { id: 4, url: 'https://a.com/delta', status: 'ok', duration: 20 },
    { id: 5, url: 'https://a.com/epsilon', pending: true, status: 200, duration: 10 },
  ];
  const ids = (sorted: readonly { id: number }[]) => sorted.map((row) => row.id);
  const by = (column: string, direction: 'ascending' | 'descending') => sortRequests(rows, { column, direction }, requestSortValue);

  it('keeps the rows as they are with no sort', () => {
    expect(sortRequests(rows, null, requestSortValue)).toBe(rows);
  });
  it('sorts names without regard to case', () => {
    expect(ids(by('name', 'ascending'))).toEqual([2, 1, 4, 5, 3]);
    expect(ids(by('name', 'descending'))).toEqual([3, 5, 4, 1, 2]);
  });
  it('sorts numbers, keeps ties in order, and leaves empty cells at the end both ways', () => {
    expect(ids(by('duration', 'ascending'))).toEqual([2, 5, 4, 1, 3]);
    expect(ids(by('duration', 'descending'))).toEqual([1, 4, 2, 5, 3]);
  });
  it('sorts statuses with words after numbers, and pending rows last', () => {
    expect(ids(by('status', 'ascending'))).toEqual([1, 3, 2, 4, 5]);
    expect(ids(by('status', 'descending'))).toEqual([4, 2, 1, 3, 5]);
  });
  it('cycles ascending, descending, off', () => {
    expect(nextRequestSort(null, 'a')).toEqual({ column: 'a', direction: 'ascending' });
    expect(nextRequestSort({ column: 'a', direction: 'ascending' }, 'a')).toEqual({ column: 'a', direction: 'descending' });
    expect(nextRequestSort({ column: 'a', direction: 'descending' }, 'a')).toBeNull();
    expect(nextRequestSort({ column: 'a', direction: 'descending' }, 'b')).toEqual({ column: 'b', direction: 'ascending' });
  });
  it('takes a custom field by name', () => {
    expect(requestSortValue({ id: 1, url: 'x', from: 'main' } as never, 'from')).toBe('main');
    expect(requestSortValue({ id: 1, url: 'x', time: 5 }, 'waterfall')).toBe(5);
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

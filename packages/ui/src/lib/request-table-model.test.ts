import { describe, expect, it } from 'vitest';
import { sortDataTableRows } from '@/lib/data-table-model';
import {
  isRequestFailed, requestBar, requestDisplayName, requestDurationText, requestName, requestSizeText, requestSortValue,
  requestStatusText, requestTimeRange, requestTone,
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
    expect(requestSizeText({ size: 1536 })).toBe('1.5 kB');
    expect(requestSizeText({ size: 280 })).toBe('280 B');
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
  const by = (column: string, direction: 'ascending' | 'descending') => sortDataTableRows(rows, { column, direction }, requestSortValue);

  it('keeps the rows as they are with no sort', () => {
    expect(sortDataTableRows(rows, null, requestSortValue)).toBe(rows);
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
  it('takes a custom field by name', () => {
    expect(requestSortValue({ id: 1, url: 'x', from: 'main' } as never, 'from')).toBe('main');
    expect(requestSortValue({ id: 1, url: 'x', time: 5 }, 'waterfall')).toBe(5);
  });
});

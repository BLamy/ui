// @vitest-environment happy-dom
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { RequestLink, RequestTable, type RequestColumn, type RequestTableHandle } from '@/components/ui/request-table';
import type { RowId } from '@/lib/log-list-model';
import type { RequestRow } from '@/lib/request-table-model';

afterEach(cleanup);

const makeRows = (count: number): RequestRow[] => Array.from({ length: count }, (_, i) => ({
  id: `r${i}`, url: `https://a.com/api/thing/${i}?v=1`, method: i % 2 ? 'POST' : 'GET', status: i === 3 ? 500 : 200, type: 'fetch', size: 1000 + i, time: i * 100, duration: 50 + (count - i),
}));

const grid = () => screen.getByRole('grid');
const row = (index: number) => document.querySelector<HTMLElement>(`[data-slot=request-table-row][data-index="${index}"]`) as HTMLElement;
const allRows = () => [...document.querySelectorAll<HTMLElement>('[data-slot=request-table-row]')];
const column = (id: string) => document.querySelector<HTMLElement>(`[role=columnheader][data-column="${id}"]`) as HTMLElement;
const line = () => document.querySelector('[data-slot=request-table-playhead] [class*=request-playhead]') as HTMLElement;
const firstName = () => row(0).querySelector('[data-slot=request-table-name]')?.textContent;

describe('RequestTable', () => {
  it('is a grid with a slot, taking className and style, and mounts only a window of the rows', () => {
    render(<RequestTable rows={makeRows(10_000)} aria-label="Network" className="my-table" style={{ height: 300 }} data-testid="root" />);
    const root = screen.getByTestId('root');
    expect(root.getAttribute('data-slot')).toBe('request-table');
    expect(root.classList.contains('my-table')).toBe(true);
    expect(root.style.height).toBe('300px');
    expect(grid().getAttribute('aria-label')).toBe('Network');
    expect(grid().getAttribute('aria-rowcount')).toBe('10001');
    expect(allRows().length).toBeGreaterThan(5);
    expect(allRows().length).toBeLessThan(120);
    expect(row(0).getAttribute('aria-rowindex')).toBe('2');
  });

  it('says what each column says', () => {
    render(<RequestTable rows={makeRows(5)} />);
    const cells = within(row(3));
    expect(row(3).querySelector('[data-column=name]')?.textContent).toBe('3?v=1');
    expect(row(3).querySelector('[data-slot=request-table-name]')?.getAttribute('title')).toBe('https://a.com/api/thing/3?v=1');
    expect(cells.getByText('POST')).toBeTruthy();
    expect(row(3).querySelector('[data-column=status]')?.textContent).toBe('500');
    expect(row(3).hasAttribute('data-failed')).toBe(true);
    expect(row(0).hasAttribute('data-failed')).toBe(false);
    expect(row(3).querySelector('[data-column=size]')?.textContent).toBe('1003 B');
    expect(row(3).querySelector('[data-column=duration]')?.textContent).toBe('52 ms');
  });

  it('shows the columns it is given, a built-in adjusted or one of your own', () => {
    const own: RequestColumn<RequestRow & { from: string }> = { id: 'from', title: 'From', width: 90, render: (r) => `from ${r.from}` };
    render(<RequestTable rows={[{ id: 1, url: 'cart:add', from: 'renderer', status: 'ok' }]} columns={[{ id: 'url', title: 'Channel' }, own, 'status']} />);
    expect(screen.getAllByRole('columnheader').map((c) => c.textContent)).toEqual(['Channel', 'From', 'Status']);
    expect(row(0).querySelector('[data-column=url]')?.textContent).toBe('cart:add');
    expect(row(0).querySelector('[data-column=from]')?.textContent).toBe('from renderer');
    expect(row(0).querySelector('[data-column=status]')?.textContent).toBe('ok');
  });

  it('draws bars on the shared range, and a pending one to the end', () => {
    render(<RequestTable rows={[{ id: 1, url: 'a', time: 0, duration: 50 }, { id: 2, url: 'b', time: 50, pending: true }, { id: 3, url: 'c' }]} timeRange={[0, 100]} />);
    const bar = (i: number) => row(i).querySelector<HTMLElement>('[data-slot=request-table-bar]');
    expect(bar(0)?.style.getPropertyValue('--bar-left')).toBe('0%');
    expect(bar(0)?.style.getPropertyValue('--bar-width')).toBe('50%');
    expect(bar(1)?.style.getPropertyValue('--bar-left')).toBe('50%');
    expect(bar(1)?.style.getPropertyValue('--bar-width')).toBe('50%');
    expect(bar(1)?.hasAttribute('data-pending')).toBe(true);
    expect(bar(2)).toBeNull();
    expect(row(1).querySelector('[data-column=status]')?.textContent).toBe('(pending)');
  });

  it('shows the empty state and footer', () => {
    const { rerender } = render(<RequestTable rows={[]} emptyState="No requests yet" />);
    expect(screen.getByText('No requests yet')).toBeTruthy();
    rerender(<RequestTable rows={makeRows(1)} footer="3 more later" />);
    expect(screen.getByText('3 more later')).toBeTruthy();
  });
});

describe('the playhead', () => {
  it('is one line, however many rows there are', () => {
    render(<RequestTable rows={makeRows(50)} timeRange={[0, 1000]} playhead={250} />);
    expect(document.querySelectorAll('[data-slot=request-table-playhead]').length).toBe(1);
    expect(line()).toBeTruthy();
  });

  it('has none without a waterfall to be on', () => {
    render(<RequestTable rows={makeRows(5)} columns={['name', 'status']} playhead={100} />);
    expect(document.querySelector('[data-slot=request-table-playhead]')).toBeNull();
  });

  it('has none without one', () => {
    render(<RequestTable rows={makeRows(5)} />);
    expect(screen.getByRole('grid').closest('[data-slot=request-table]')?.hasAttribute('data-playhead')).toBe(false);
    expect(allRows().some((el) => el.hasAttribute('data-future'))).toBe(false);
  });

  it('draws a line at its share of the range and dims rows sent after it', () => {
    render(<RequestTable rows={makeRows(11)} timeRange={[0, 1000]} playhead={250} />);
    const root = document.querySelector<HTMLElement>('[data-slot=request-table]') as HTMLElement;
    expect(root.hasAttribute('data-playhead')).toBe(true);
    expect(line().style.getPropertyValue('--request-playhead')).toBe('0.25');
    expect(row(2).hasAttribute('data-future')).toBe(false);
    expect(row(3).hasAttribute('data-future')).toBe(true);
  });

  it('moves without rendering a single row', () => {
    const renders = vi.fn();
    const columns: (RequestColumn | 'waterfall')[] = [{ id: 'name', title: 'Name', render: (r) => { renders(); return r.url; } }, 'waterfall'];
    const rows = makeRows(100);
    const { rerender } = render(<RequestTable rows={rows} columns={columns} timeRange={[0, 10_000]} playhead={100} />);
    renders.mockClear();
    for (const playhead of [500, 900, 2000, 5000]) rerender(<RequestTable rows={rows} columns={columns} timeRange={[0, 10_000]} playhead={playhead} onRowPress={() => {}} />);
    expect(renders).not.toHaveBeenCalled();
    expect(row(5).hasAttribute('data-future')).toBe(false);
    expect(line().style.getPropertyValue('--request-playhead')).toBe('0.5');
  });

  it('moves with no React at all through the handle, and hides off the range', () => {
    const ref = { current: null as RequestTableHandle | null };
    render(<RequestTable ref={ref} rows={makeRows(11)} timeRange={[0, 1000]} />);
    const root = document.querySelector<HTMLElement>('[data-slot=request-table]') as HTMLElement;
    act(() => { ref.current?.setPlayhead(500); });
    expect(line().style.getPropertyValue('--request-playhead')).toBe('0.5');
    expect(row(6).hasAttribute('data-future')).toBe(true);
    act(() => { ref.current?.setPlayhead(5000); });
    expect(root.hasAttribute('data-playhead')).toBe(false);
    act(() => { ref.current?.setPlayhead(null); });
    expect(row(6).hasAttribute('data-future')).toBe(false);
  });

  it('dims the right rows when sorted, as they are no longer in time order', () => {
    render(<RequestTable rows={makeRows(11)} timeRange={[0, 1000]} playhead={250} defaultSort={{ column: 'time', direction: 'descending' }} columns={['name', 'waterfall']} />);
    // Sent latest first: the first rows are the ones after the playhead.
    expect(row(0).hasAttribute('data-future')).toBe(true);
    expect(row(10).hasAttribute('data-future')).toBe(false);
  });
});

describe('sorting', () => {
  it('cycles a header through ascending, descending and off', () => {
    const onSortChange = vi.fn();
    render(<RequestTable rows={makeRows(5)} onSortChange={onSortChange} />);
    expect(column('duration').getAttribute('aria-sort')).toBe('none');
    expect(firstName()).toBe('0?v=1');
    const press = () => fireEvent.click(within(column('duration')).getByRole('button'));
    press();
    // Duration falls as the index rises, so ascending puts the last row first.
    expect(column('duration').getAttribute('aria-sort')).toBe('ascending');
    expect(onSortChange).toHaveBeenLastCalledWith({ column: 'duration', direction: 'ascending' });
    expect(firstName()).toBe('4?v=1');
    press();
    expect(column('duration').getAttribute('aria-sort')).toBe('descending');
    expect(firstName()).toBe('0?v=1');
    press();
    expect(column('duration').getAttribute('aria-sort')).toBe('none');
    expect(onSortChange).toHaveBeenLastCalledWith(null);
  });

  it('is the parent\'s when controlled', () => {
    const { rerender } = render(<RequestTable rows={makeRows(5)} sort={null} />);
    fireEvent.click(within(column('duration')).getByRole('button'));
    expect(column('duration').getAttribute('aria-sort')).toBe('none');
    rerender(<RequestTable rows={makeRows(5)} sort={{ column: 'duration', direction: 'ascending' }} />);
    expect(firstName()).toBe('4?v=1');
  });

  it('a column can sort by a value of its own, or not at all', () => {
    const rows = makeRows(3);
    const columns: RequestColumn[] = [
      { id: 'mine', title: 'Mine', render: (r) => r.method, sortValue: (r) => -(r.time ?? 0) },
      { id: 'plain', title: 'Plain', render: (r) => r.method },
    ];
    render(<RequestTable rows={rows} columns={columns} />);
    expect(within(column('plain')).queryByRole('button')).toBeNull();
    expect(column('plain').getAttribute('aria-sort')).toBeNull();
    fireEvent.click(within(column('mine')).getByRole('button'));
    expect(row(0).querySelector('[data-column=mine]')?.textContent).toBe('GET');
    expect(row(1).querySelector('[data-column=mine]')?.textContent).toBe('POST');
  });
});

describe('press, selection and links', () => {
  it('a press selects and calls onRowPress', () => {
    const onRowPress = vi.fn();
    const onSelectionChange = vi.fn();
    const rows = makeRows(5);
    render(<RequestTable rows={rows} onRowPress={onRowPress} onSelectionChange={onSelectionChange} />);
    fireEvent.click(row(2).querySelector('[data-column=method]') as Element);
    expect(onRowPress).toHaveBeenCalledWith(rows[2], 2);
    expect(onSelectionChange).toHaveBeenCalledWith('r2');
    expect(row(2).hasAttribute('data-selected')).toBe(true);
    expect(row(2).getAttribute('aria-selected')).toBe('true');
  });

  it('a link goes to the other end of the call: selected, in view, and not a press of its own row', () => {
    const onRowPress = vi.fn();
    const rows = makeRows(3000);
    function Host() {
      const [selected, setSelected] = useState<RowId | null>(null);
      return (
        <RequestTable
          rows={rows}
          selectedId={selected}
          onSelectionChange={setSelected}
          onRowPress={onRowPress}
          renderLink={(row) => (row.id === 'r1' ? <RequestLink onPress={() => setSelected('r2000')}>Server function</RequestLink> : null)}
        />
      );
    }
    render(<Host />);
    fireEvent.click(screen.getByRole('button', { name: 'Server function' }));
    expect(onRowPress).not.toHaveBeenCalled();
    expect(row(2000).hasAttribute('data-selected')).toBe(true);
    expect(grid().scrollTop).toBeGreaterThan(40_000);
  });
});

describe('keyboard', () => {
  it('moves through the rows and presses', () => {
    const onRowPress = vi.fn();
    const rows = makeRows(100);
    render(<RequestTable rows={rows} onRowPress={onRowPress} />);
    const el = grid();
    const active = () => document.getElementById(el.getAttribute('aria-activedescendant') ?? '');
    fireEvent.focus(el);
    expect(active()?.getAttribute('data-index')).toBe('0');
    fireEvent.keyDown(el, { key: 'ArrowDown' });
    expect(active()?.getAttribute('data-index')).toBe('1');
    fireEvent.keyDown(el, { key: 'Enter' });
    expect(onRowPress).toHaveBeenCalledWith(rows[1], 1);
    fireEvent.keyDown(el, { key: 'End' });
    expect(active()?.getAttribute('data-index')).toBe('99');
  });

  it('goes up into the headers, which sort and resize from the keyboard', () => {
    const onColumnWidthsChange = vi.fn();
    render(<RequestTable rows={makeRows(5)} onColumnWidthsChange={onColumnWidthsChange} />);
    const el = grid();
    const active = () => document.getElementById(el.getAttribute('aria-activedescendant') ?? '');
    fireEvent.focus(el);
    fireEvent.keyDown(el, { key: 'ArrowUp' });
    expect(active()?.getAttribute('role')).toBe('columnheader');
    expect(active()?.getAttribute('data-column')).toBe('name');
    fireEvent.keyDown(el, { key: 'ArrowRight' });
    expect(active()?.getAttribute('data-column')).toBe('method');
    fireEvent.keyDown(el, { key: 'Enter' });
    expect(column('method').getAttribute('aria-sort')).toBe('ascending');
    fireEvent.keyDown(el, { key: 'ArrowRight', altKey: true });
    expect(onColumnWidthsChange).toHaveBeenCalled();
    expect(onColumnWidthsChange.mock.lastCall?.[0].method).toBeGreaterThan(0);
    fireEvent.keyDown(el, { key: 'ArrowDown' });
    expect(active()?.getAttribute('role')).toBe('row');
  });
});

describe('stacked rows', () => {
  it('has two lines and a sort menu instead of column headers', () => {
    render(<RequestTable rows={makeRows(5)} layout="stacked" />);
    expect(document.querySelector('[data-slot=request-table]')?.getAttribute('data-layout')).toBe('stacked');
    expect(column('name')).toBeNull();
    expect(screen.getByRole('button', { name: 'Sort by' })).toBeTruthy();
    expect(screen.getByText('5 requests')).toBeTruthy();
    const text = row(3).textContent ?? '';
    expect(text).toContain('3?v=1');
    expect(text).toContain('500');
    expect(text).toContain('POST');
    expect(text).toContain('52 ms');
    expect(row(3).querySelector('[data-slot=request-table-waterfall]')).toBeTruthy();
  });

  it('leaves out what the columns leave out', () => {
    render(<RequestTable rows={makeRows(2)} layout="stacked" columns={['name', 'status']} />);
    const text = row(1).textContent ?? '';
    expect(text).toContain('200');
    expect(text).not.toContain('POST');
    expect(row(1).querySelector('[data-slot=request-table-waterfall]')).toBeNull();
  });
});

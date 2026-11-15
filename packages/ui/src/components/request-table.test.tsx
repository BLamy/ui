// @vitest-environment happy-dom
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { createDataTableController, type DataTableColumn } from '@/components/ui/data-table';
import { RequestTableLink, RequestTable } from '@/components/ui/request-table';
import type { RowId } from '@/lib/log-list-model';
import type { RequestRow } from '@/lib/request-table-model';

declare global { var __UI_SDK_STRICT__: boolean | undefined }
globalThis.__UI_SDK_STRICT__ = true;
// happy-dom lays nothing out. The table is `tableWidth` wide (regular, unless a test narrows it), and the ResizeObservers
// watching it hear about a new width from `resizeTable`.
let tableWidth = 1024;
const isTable = (el: Element) => el.getAttribute('data-slot') === 'data-table';
Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get(this: HTMLElement) { return isTable(this) ? tableWidth : 0; } });
const watching = new Map<ResizeObserver, { callback: ResizeObserverCallback; targets: Set<Element> }>();
class TestResizeObserver {
  constructor(callback: ResizeObserverCallback) { watching.set(this as unknown as ResizeObserver, { callback, targets: new Set() }); }
  observe(target: Element) { watching.get(this as unknown as ResizeObserver)?.targets.add(target); }
  unobserve(target: Element) { watching.get(this as unknown as ResizeObserver)?.targets.delete(target); }
  disconnect() { watching.delete(this as unknown as ResizeObserver); }
}
window.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver;
const resizeTable = (width: number) => act(() => {
  tableWidth = width;
  for (const [observer, { callback, targets }] of watching) {
    const entries = [...targets].filter(isTable).map((target) => ({ target }) as ResizeObserverEntry);
    if (entries.length) callback(entries, observer);
  }
});
afterEach(() => {
  cleanup();
  tableWidth = 1024;
});
const tick = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));

const makeRows = (count: number): RequestRow[] => Array.from({ length: count }, (_, i) => ({
  id: `r${i}`, url: `https://a.com/api/thing/${i}?v=1`, method: i % 2 ? 'POST' : 'GET', status: i === 3 ? 500 : 200, type: 'fetch', size: 1000 + i, time: i * 100, duration: 50 + (count - i),
}));

const grid = () => screen.getByRole('grid');
const row = (index: number) => document.querySelector<HTMLElement>(`[data-slot=data-table-row][data-index="${index}"]`) as HTMLElement;
const allRows = () => [...document.querySelectorAll<HTMLElement>('[data-slot=data-table-row]')];
const column = (id: string) => document.querySelector<HTMLElement>(`[role=columnheader][data-column="${id}"]`) as HTMLElement;
/** The current time's line is placed by the grid's `--data-table-current-time`. */
const line = () => grid();
const firstName = () => row(0).querySelector('[data-slot=request-table-name]')?.textContent;

describe('RequestTable', () => {
  it('is a grid with a slot, taking className and style, and mounts only a window of the rows', () => {
    render(<RequestTable rows={makeRows(10_000)} aria-label="Network" className="my-table" style={{ height: 300 }} data-testid="root" />);
    const root = screen.getByTestId('root');
    expect(root.getAttribute('data-slot')).toBe('data-table');
    expect(root.classList.contains('my-table')).toBe(true);
    expect(root.style.height).toBe('300px');
    expect(root.getAttribute('data-rows')).toBe('10000');
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
    expect(row(3).querySelector('[data-column=size]')?.textContent).toBe('1 kB');
    expect(row(3).querySelector('[data-column=duration]')?.textContent).toBe('52 ms');
  });

  it('shows the columns it is given, a built-in adjusted or one of your own', () => {
    const own: DataTableColumn<RequestRow & { from: string }> = { id: 'from', header: 'From', width: 90, cell: (r) => `from ${r.from}` };
    render(<RequestTable rows={[{ id: 1, url: 'cart:add', from: 'renderer', status: 'ok' }]} columns={[{ id: 'url', header: 'Channel' }, own, 'status']} />);
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

  it('says when each request started, for screen readers, and colors a bar by its tone or tint', () => {
    render(<RequestTable rows={[{ id: 1, url: 'a', time: 0, duration: 50 }, { id: 2, url: 'b', time: 1500, status: 500 }, { id: 3, url: 'c', time: 40, tint: 'var(--chart-5)' }]} timeRange={[0, 2000]} />);
    const waterfall = (i: number) => row(i).querySelector<HTMLElement>('[data-column=waterfall]') as HTMLElement;
    const bar = (i: number) => waterfall(i).querySelector<HTMLElement>('[data-slot=request-table-bar]') as HTMLElement;
    expect(waterfall(0).textContent).toBe('Starts at 0 ms');
    expect(waterfall(1).textContent).toBe('Starts at 1.5 s');
    expect(bar(0).getAttribute('aria-hidden')).toBe('true');
    expect(bar(0).getAttribute('data-tone')).toBe('default');
    expect(bar(1).getAttribute('data-tone')).toBe('destructive');
    expect(bar(2).hasAttribute('data-tint')).toBe(true);
    expect(bar(2).style.getPropertyValue('--bar-tint')).toBe('var(--chart-5)');
  });

  it('keeps a caller\'s rowProps beside its own', () => {
    render(<RequestTable rows={[{ id: 1, url: 'a', status: 500 }, { id: 2, url: 'b' }]} rowProps={(r) => ({ 'data-mine': r.id === 2 })} />);
    expect(row(0).hasAttribute('data-failed')).toBe(true);
    expect(row(0).hasAttribute('data-mine')).toBe(false);
    expect(row(1).hasAttribute('data-mine')).toBe(true);
  });

  it('shows the empty state and footer', () => {
    const { rerender } = render(<RequestTable rows={[]} emptyState="No requests yet" />);
    expect(screen.getByText('No requests yet')).toBeTruthy();
    // No rows, no time: the waterfall header states no made-up duration.
    expect(document.querySelector('[data-slot=data-table-header-end]')).toBeNull();
    rerender(<RequestTable rows={makeRows(1)} footer="3 more later" />);
    expect(screen.getByText('3 more later')).toBeTruthy();
  });
});

describe('the current time', () => {
  it('is one line, however many rows there are', () => {
    render(<RequestTable rows={makeRows(50)} timeRange={[0, 1000]} currentTime={250} />);
    expect(document.querySelectorAll('[data-slot=request-table-current-time]').length).toBe(1);
    expect(line()).toBeTruthy();
  });

  it('has none without a waterfall to be on', () => {
    render(<RequestTable rows={makeRows(5)} columns={['name', 'status']} currentTime={100} />);
    expect(document.querySelector('[data-slot=request-table-current-time]')).toBeNull();
  });

  it('has none without one', () => {
    render(<RequestTable rows={makeRows(5)} />);
    expect(grid().hasAttribute('data-current-time')).toBe(false);
    expect(allRows().some((el) => el.hasAttribute('data-future'))).toBe(false);
  });

  it('draws a line at its share of the range and dims rows sent after it', () => {
    render(<RequestTable rows={makeRows(11)} timeRange={[0, 1000]} currentTime={250} />);
    expect(grid().hasAttribute('data-current-time')).toBe(true);
    expect(line().style.getPropertyValue('--data-table-current-time')).toBe('0.25');
    expect(row(2).hasAttribute('data-future')).toBe(false);
    expect(row(3).hasAttribute('data-future')).toBe(true);
  });

  it('moves without rendering a single row', () => {
    const renders = vi.fn();
    const columns: (DataTableColumn | 'waterfall')[] = [{ id: 'name', header: 'Name', cell: (r) => { renders(); return r.url; } }, 'waterfall'];
    const rows = makeRows(100);
    const { rerender } = render(<RequestTable rows={rows} columns={columns} timeRange={[0, 10_000]} currentTime={100} />);
    renders.mockClear();
    for (const playhead of [500, 900, 2000, 5000]) rerender(<RequestTable rows={rows} columns={columns} timeRange={[0, 10_000]} currentTime={playhead} onAction={() => {}} />);
    expect(renders).not.toHaveBeenCalled();
    expect(row(5).hasAttribute('data-future')).toBe(false);
    expect(line().style.getPropertyValue('--data-table-current-time')).toBe('0.5');
  });

  it('moves with no React at all through the controller, and hides off the range', () => {
    const controller = createDataTableController();
    render(<RequestTable controller={controller} rows={makeRows(11)} timeRange={[0, 1000]} />);
    act(() => { controller.setCurrentTime(500); });
    expect(line().style.getPropertyValue('--data-table-current-time')).toBe('0.5');
    expect(row(6).hasAttribute('data-future')).toBe(true);
    act(() => { controller.setCurrentTime(5000); });
    expect(grid().hasAttribute('data-current-time')).toBe(false);
    act(() => { controller.setCurrentTime(null); });
    expect(row(6).hasAttribute('data-future')).toBe(false);
  });

  it('dims the right rows when sorted, as they are no longer in time order', () => {
    render(<RequestTable rows={makeRows(11)} timeRange={[0, 1000]} currentTime={250} defaultSort={{ column: 'time', direction: 'descending' }} columns={['name', 'waterfall']} />);
    // Sent latest first: the first rows are the ones after the current time.
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
    const press = () => fireEvent.click(column('duration'));
    press();
    // Duration falls as the index rises, so ascending puts the last row first.
    expect(column('duration').getAttribute('aria-sort')).toBe('ascending');
    expect(onSortChange).toHaveBeenLastCalledWith({ column: 'duration', direction: 'ascending' }, expect.objectContaining({ reason: 'trigger-press' }));
    expect(firstName()).toBe('4?v=1');
    press();
    expect(column('duration').getAttribute('aria-sort')).toBe('descending');
    expect(firstName()).toBe('0?v=1');
    press();
    expect(column('duration').getAttribute('aria-sort')).toBe('none');
    expect(onSortChange).toHaveBeenLastCalledWith(null, expect.objectContaining({ reason: 'trigger-press' }));
  });

  it('is the parent\'s when controlled', () => {
    const { rerender } = render(<RequestTable rows={makeRows(5)} sort={null} />);
    fireEvent.click(column('duration'));
    expect(column('duration').getAttribute('aria-sort')).toBe('none');
    rerender(<RequestTable rows={makeRows(5)} sort={{ column: 'duration', direction: 'ascending' }} />);
    expect(firstName()).toBe('4?v=1');
  });

  it('each header and edge is its own part, keyed by its column id with no DOM id', () => {
    const onSortChange = vi.fn();
    const onColumnWidthsChange = vi.fn();
    render(<RequestTable rows={makeRows(5)} onSortChange={onSortChange} onColumnWidthsChange={onColumnWidthsChange} />);
    // Every header shares one slot: a press sorts by the header pressed, not by the last one rendered.
    for (const id of ['method', 'duration', 'status']) {
      fireEvent.click(column(id));
      expect(onSortChange).toHaveBeenLastCalledWith({ column: id, direction: 'ascending' }, expect.anything());
    }
    const edge = within(column('method')).getByRole('separator');
    act(() => { edge.focus(); fireEvent.keyDown(edge, { key: 'ArrowRight' }); });
    expect(Object.keys(onColumnWidthsChange.mock.lastCall?.[0] ?? {})).toEqual(['method']);
    expect(document.querySelectorAll('[role=columnheader][id], [role=separator][id]').length).toBe(0);
  });

  it('a column can sort by a value of its own, or not at all', () => {
    const rows = makeRows(3);
    const columns: DataTableColumn[] = [
      { id: 'mine', header: 'Mine', cell: (r) => r.method, sortValue: (r) => -(r.time ?? 0) },
      { id: 'plain', header: 'Plain', cell: (r) => r.method },
    ];
    render(<RequestTable rows={rows} columns={columns} />);
    fireEvent.click(column('plain'));
    expect(column('plain').getAttribute('aria-sort')).toBeNull();
    fireEvent.click(column('mine'));
    expect(row(0).querySelector('[data-column=mine]')?.textContent).toBe('GET');
    expect(row(1).querySelector('[data-column=mine]')?.textContent).toBe('POST');
  });
});

describe('press, selection and links', () => {
  it('a press selects and calls onAction', () => {
    const onAction = vi.fn();
    const onValueChange = vi.fn();
    const rows = makeRows(5);
    render(<RequestTable rows={rows} onAction={onAction} onValueChange={onValueChange} />);
    fireEvent.click(row(2).querySelector('[data-column=method]') as Element);
    expect(onAction).toHaveBeenCalledWith('r2', expect.objectContaining({ reason: 'item-press', row: rows[2], index: 2 }));
    expect(onValueChange).toHaveBeenCalledWith('r2', expect.objectContaining({ reason: 'item-press' }));
    expect(row(2).hasAttribute('data-selected')).toBe(true);
    expect(row(2).getAttribute('aria-selected')).toBe('true');
  });

  it('a link goes to the other end of the call: selected, in view, and not a press of its own row', () => {
    const onAction = vi.fn();
    const rows = makeRows(3000);
    function Host() {
      const [selected, setSelected] = useState<RowId | null>(null);
      return (
        <RequestTable
          rows={rows}
          value={selected}
          onValueChange={setSelected}
          onAction={onAction}
          renderLink={(row) => (row.id === 'r1' ? <RequestTableLink onClick={() => setSelected('r2000')}>Server function</RequestTableLink> : null)}
        />
      );
    }
    render(<Host />);
    fireEvent.click(screen.getByRole('button', { name: 'Server function' }));
    expect(onAction).not.toHaveBeenCalled();
    expect(row(2000).hasAttribute('data-selected')).toBe(true);
    expect(grid().scrollTop).toBeGreaterThan(40_000);
  });
});

describe('keyboard', () => {
  const press = (key: string, init: KeyboardEventInit = {}) => act(() => { fireEvent.keyDown(document.activeElement as Element, { key, ...init }); });
  /** Tabs into the grid, as the keyboard does. */
  const tabIn = () => act(() => {
    fireEvent.keyDown(document.body, { key: 'Tab' });
    grid().focus();
  });

  it('is one tab stop that moves through the rows and presses', async () => {
    const onAction = vi.fn();
    const rows = makeRows(100);
    render(<RequestTable rows={rows} onAction={onAction} />);
    expect(grid().getAttribute('tabindex')).toBe('0');
    tabIn();
    expect(document.activeElement).toBe(row(0));
    expect(row(0).getAttribute('tabindex')).toBe('0');
    expect(grid().getAttribute('tabindex')).toBe('-1');
    press('ArrowDown');
    expect(document.activeElement).toBe(row(1));
    expect(row(0).getAttribute('tabindex')).toBe('-1');
    press('Enter');
    expect(onAction).toHaveBeenCalledWith('r1', expect.objectContaining({ reason: 'item-press', row: rows[1], index: 1 }));
    expect(row(1).getAttribute('aria-selected')).toBe('true');
    // A far row renders first, and takes focus when it's there.
    await act(async () => { fireEvent.keyDown(document.activeElement as Element, { key: 'End' }); });
    await tick();
    expect(document.activeElement?.getAttribute('data-index')).toBe('99');
    await act(async () => { fireEvent.keyDown(document.activeElement as Element, { key: 'Home' }); });
    await tick();
    expect(document.activeElement).toBe(row(0));
  });

  it('goes up into the headers, which move, sort and resize from the keyboard', () => {
    const onColumnWidthsChange = vi.fn();
    render(<RequestTable rows={makeRows(5)} onColumnWidthsChange={onColumnWidthsChange} />);
    tabIn();
    press('ArrowUp');
    expect(document.activeElement).toBe(column('name'));
    press('ArrowRight');
    expect(document.activeElement).toBe(column('method'));
    press('Enter');
    expect(column('method').getAttribute('aria-sort')).toBe('ascending');
    press('ArrowRight', { altKey: true });
    expect(onColumnWidthsChange).toHaveBeenCalledWith(expect.objectContaining({ method: expect.any(Number) }), expect.objectContaining({ reason: 'resize-key' }));
    press('ArrowDown');
    expect(document.activeElement?.getAttribute('role')).toBe('row');
    press('ArrowUp');
    expect(document.activeElement).toBe(column('method'));
    press('Escape');
    expect(document.activeElement?.getAttribute('role')).toBe('row');
  });

  it('a column edge is a separator that keys and a double press resize', () => {
    const onColumnWidthsChange = vi.fn();
    render(<RequestTable rows={makeRows(5)} defaultColumnWidths={{ method: 80 }} onColumnWidthsChange={onColumnWidthsChange} />);
    const edge = within(column('method')).getByRole('separator', { name: 'Resize Method' });
    expect(edge.getAttribute('aria-valuenow')).toBe('80');
    // A pointer puts focus on the edge; the keyboard can't Tab to it.
    act(() => { fireEvent.pointerDown(edge, { pointerType: 'mouse' }); fireEvent.pointerUp(edge, { pointerType: 'mouse' }); edge.focus(); });
    press('ArrowRight');
    expect(onColumnWidthsChange).toHaveBeenLastCalledWith({ method: 92 }, expect.objectContaining({ reason: 'resize-key' }));
    expect(edge.getAttribute('aria-valuenow')).toBe('92');
    expect(column('method').getAttribute('aria-sort')).toBe('none');
    act(() => { fireEvent.doubleClick(edge); });
    expect(onColumnWidthsChange).toHaveBeenLastCalledWith({}, expect.objectContaining({ reason: 'handle-press' }));
  });

  it('a column edge has a value before any width is set: the width its header shows', () => {
    const spy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 96.6, 20));
    render(<RequestTable rows={makeRows(5)} />);
    const edges = screen.getAllByRole('separator');
    expect(edges.length).toBeGreaterThan(1);
    expect(edges.map((e) => e.getAttribute('aria-valuenow'))).toEqual(edges.map(() => '97'));
    spy.mockRestore();
  });

  it('Tab from a row goes through its links, and Escape comes back', () => {
    render(<RequestTable rows={makeRows(5)} renderLink={(r) => (r.id === 'r0' ? <RequestTableLink onClick={() => {}}>Server</RequestTableLink> : null)} />);
    tabIn();
    const link = screen.getByRole('button', { name: 'Server' });
    act(() => { link.focus(); });
    press('Escape');
    expect(document.activeElement).toBe(row(0));
  });
});

describe('its own size class', () => {
  const root = () => document.querySelector('[data-slot=data-table]') as HTMLElement;
  const headers = () => [...document.querySelectorAll('[role=columnheader][data-column]')].map((el) => el.getAttribute('data-column'));

  it('follows the table\'s width, not the window\'s: columns go below regular, rows stack when compact', () => {
    render(<RequestTable rows={makeRows(5)} />);
    expect(root().getAttribute('data-size-class')).toBe('regular');
    expect(headers()).toEqual(['name', 'method', 'status', 'type', 'size', 'duration', 'waterfall']);
    resizeTable(600);
    expect(root().getAttribute('data-size-class')).toBe('medium');
    expect(headers()).toEqual(['name', 'method', 'status', 'duration', 'waterfall']);
    expect(grid().getAttribute('aria-colcount')).toBe('5');
    expect(row(0).querySelector('[data-column=type]')).toBeNull();
    expect(root().getAttribute('data-presentation')).toBe('table');
    resizeTable(400);
    expect(root().getAttribute('data-presentation')).toBe('stacked');
    expect(headers()).toEqual([]);
    expect(screen.getByRole('button', { name: 'Sort' })).toBeTruthy();
    expect(grid().style.getPropertyValue('--data-table-row')).toBe('46px');
    resizeTable(900);
    expect(root().getAttribute('data-presentation')).toBe('table');
    expect(headers()).toContain('type');
    expect(grid().style.getPropertyValue('--data-table-row')).toBe('26px');
  });

  it('takes breakpoints of its own, and a fixed presentation ignores them', () => {
    const { rerender } = render(<RequestTable rows={makeRows(5)} breakpoints={{ medium: 700, regular: 1200 }} />);
    expect(root().getAttribute('data-size-class')).toBe('medium');
    expect(headers()).not.toContain('type');
    resizeTable(650);
    expect(root().getAttribute('data-presentation')).toBe('stacked');
    rerender(<RequestTable rows={makeRows(5)} breakpoints={{ medium: 600, regular: 1200 }} />);
    expect(root().getAttribute('data-presentation')).toBe('table');
    rerender(<RequestTable rows={makeRows(5)} breakpoints={{ medium: 600, regular: 1200 }} presentation="stacked" />);
    expect(root().getAttribute('data-presentation')).toBe('stacked');
  });

  it('keeps the selection and the row at the top through a change of presentation', () => {
    render(<RequestTable rows={makeRows(500)} defaultValue="r40" />);
    expect(row(40).getAttribute('aria-selected')).toBe('true');
    resizeTable(400);
    expect(row(40).getAttribute('aria-selected')).toBe('true');
    expect(row(40).hasAttribute('data-selected')).toBe(true);
  });
});

describe('rows given as they come', () => {
  it('sorts new rows by the sort it already has', () => {
    const sort = { column: 'duration', direction: 'ascending' } as const;
    const { rerender } = render(<RequestTable rows={makeRows(3)} defaultSort={sort} />);
    // `duration` is 50 + (count - i): the last row is the quickest.
    expect(firstName()).toBe('2?v=1');
    rerender(<RequestTable rows={makeRows(6)} defaultSort={sort} />);
    expect(firstName()).toBe('5?v=1');
    expect(grid().getAttribute('aria-rowcount')).toBe('7');
  });

  it('a controlled sort sorts on the parent\'s say, not before', () => {
    const onSortChange = vi.fn();
    const { rerender } = render(<RequestTable rows={makeRows(3)} sort={null} onSortChange={onSortChange} />);
    fireEvent.click(column('duration'));
    expect(onSortChange).toHaveBeenLastCalledWith({ column: 'duration', direction: 'ascending' }, expect.objectContaining({ reason: 'trigger-press' }));
    expect(firstName()).toBe('0?v=1');
    rerender(<RequestTable rows={makeRows(3)} sort={{ column: 'duration', direction: 'ascending' }} onSortChange={onSortChange} />);
    expect(firstName()).toBe('2?v=1');
    expect(column('duration').getAttribute('aria-sort')).toBe('ascending');
  });

  it('a canceled sort keeps the order', () => {
    render(<RequestTable rows={makeRows(3)} onSortChange={(_sort, details) => details.cancel()} />);
    fireEvent.click(column('duration'));
    expect(firstName()).toBe('0?v=1');
    expect(column('duration').getAttribute('aria-sort')).toBe('none');
  });
});

describe('stacked rows', () => {
  it('has two lines and a sort menu instead of column headers', () => {
    render(<RequestTable rows={makeRows(5)} presentation="stacked" />);
    expect(document.querySelector('[data-slot=data-table]')?.getAttribute('data-presentation')).toBe('stacked');
    expect(column('name')).toBeNull();
    expect(screen.getByRole('button', { name: 'Sort' })).toBeTruthy();
    expect(screen.getByText('5 requests')).toBeTruthy();
    const text = row(3).textContent ?? '';
    expect(text).toContain('3?v=1');
    expect(text).toContain('500');
    expect(text).toContain('POST');
    expect(text).toContain('52 ms');
    expect(row(3).querySelector('[data-slot=request-table-waterfall]')).toBeTruthy();
  });

  it('leaves out what the columns leave out', () => {
    render(<RequestTable rows={makeRows(2)} presentation="stacked" columns={['name', 'status']} />);
    const text = row(1).textContent ?? '';
    expect(text).toContain('200');
    expect(text).not.toContain('POST');
    expect(row(1).querySelector('[data-slot=request-table-waterfall]')).toBeNull();
  });
});

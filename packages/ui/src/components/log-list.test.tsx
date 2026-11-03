// @vitest-environment happy-dom
import { useState, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { getReplayDevtools, replayDevtoolsAt } from '@brett_lamy/docstream/replay';
import { LogList, LogRowContent, type LogListHandle, type LogRowState } from '@/components/ui/log-list';
import { RequestTable } from '@/components/ui/request-table';
import type { LogRow } from '@/lib/log-list';

afterEach(cleanup);

const makeRows = (count: number, patch?: (i: number) => Partial<LogRow>): LogRow[] =>
  Array.from({ length: count }, (_, i) => ({ id: `r${i}`, level: 'log', time: i * 100, source: `app.js:${i}`, message: `Message ${i}`, ...patch?.(i) }));

const grid = () => screen.getByRole('grid');
const row = (index: number) => document.querySelector<HTMLElement>(`[data-slot=log-list-row][data-index="${index}"]`) as HTMLElement;
const allRows = () => [...document.querySelectorAll<HTMLElement>('[data-slot=log-list-row]')];
const marker = () => document.querySelector('[data-slot=log-list-marker]') as HTMLElement;
const offset = (el: HTMLElement) => Number(/translateY\((-?[\d.]+)px\)/.exec(el.style.transform)?.[1]);

describe('LogList', () => {
  it('is a grid with a slot, taking className and style, and mounts only a window of the rows', () => {
    render(<LogList rows={makeRows(100_000)} aria-label="Console" className="my-list" style={{ height: 300 }} data-testid="root" />);
    const root = screen.getByTestId('root');
    expect(root.getAttribute('data-slot')).toBe('log-list');
    expect(root.classList.contains('my-list')).toBe(true);
    expect(root.style.height).toBe('300px');
    expect(grid().getAttribute('aria-label')).toBe('Console');
    expect(grid().getAttribute('aria-rowcount')).toBe('100000');
    const mounted = allRows().length;
    expect(mounted).toBeGreaterThan(10);
    expect(mounted).toBeLessThan(200);
    expect(row(0).getAttribute('aria-rowindex')).toBe('1');
  });

  it('places rows by their heights, one after another', () => {
    render(<LogList rows={makeRows(50)} />);
    expect(offset(row(0))).toBe(0);
    expect(offset(row(1))).toBe(24);
    expect(offset(row(5))).toBe(120);
    const sizer = document.querySelector<HTMLElement>('[data-slot=log-list-rows]');
    expect(sizer?.style.height).toBe('1200px');
  });

  it('shows the level, message, source, time and count', () => {
    render(<LogList rows={[{ id: 1, level: 'warning', time: 1204, source: 'api.ts:31', message: 'Slow', count: 3 }]} />);
    const el = row(0);
    expect(el.getAttribute('data-level')).toBe('warn');
    expect(el.querySelector('[data-slot=log-list-message]')?.textContent).toBe('3Slow');
    expect(el.querySelector('[data-slot=log-list-source]')?.textContent).toBe('api.ts:31');
    expect(el.querySelector('[data-slot=log-list-time]')?.textContent).toBe('0:01.204');
    expect(el.querySelector('[data-slot=log-list-count]')?.textContent).toBe('3');
  });

  it('shows empty state and footer', () => {
    const { rerender } = render(<LogList rows={[]} emptyState="Nothing logged yet" />);
    expect(screen.getByText('Nothing logged yet')).toBeTruthy();
    rerender(<LogList rows={makeRows(2)} emptyState="Nothing logged yet" footer="12 more later" />);
    expect(screen.queryByText('Nothing logged yet')).toBeNull();
    expect(screen.getByText('12 more later')).toBeTruthy();
  });
});

describe('the position marker', () => {
  it('has none, and dims nothing, without a position', () => {
    render(<LogList rows={makeRows(20)} />);
    expect(marker().style.display).toBe('none');
    expect(allRows().some((el) => el.hasAttribute('data-future'))).toBe(false);
  });

  it('currentTime goes before the first row logged later, and dims from there', () => {
    render(<LogList rows={makeRows(20)} currentTime={350} />);
    expect(marker().style.display).toBe('');
    expect(offset(marker())).toBe(4 * 24);
    expect(row(3).hasAttribute('data-future')).toBe(false);
    expect(row(4).hasAttribute('data-future')).toBe(true);
    expect(row(19).hasAttribute('data-future')).toBe(true);
    expect(allRows().some((el) => el.hasAttribute('data-current'))).toBe(false);
  });

  it('tints a row at exactly that time as current', () => {
    render(<LogList rows={makeRows(20)} currentTime={300} />);
    expect(row(3).hasAttribute('data-current')).toBe(true);
    expect(row(3).getAttribute('aria-current')).toBe('true');
    expect(row(3).hasAttribute('data-future')).toBe(false);
    expect(row(4).hasAttribute('data-future')).toBe(true);
  });

  it('currentId goes right after its row, and falls back to currentTime when that row is filtered out', () => {
    const { rerender } = render(<LogList rows={makeRows(20)} currentId="r5" />);
    expect(offset(marker())).toBe(6 * 24);
    expect(row(5).hasAttribute('data-current')).toBe(true);
    expect(row(6).hasAttribute('data-future')).toBe(true);
    rerender(<LogList rows={makeRows(20)} currentId="gone" currentTime={250} />);
    expect(offset(marker())).toBe(3 * 24);
    expect(row(5).hasAttribute('data-current')).toBe(false);
    rerender(<LogList rows={makeRows(20)} currentId="gone" />);
    expect(marker().style.display).toBe('none');
  });

  it('moves without rendering a single row, through currentTime', () => {
    const renders = vi.fn();
    const renderRow = (r: LogRow, state: LogRowState): ReactNode => {
      renders(state.index);
      return <LogRowContent row={r} />;
    };
    const rows = makeRows(1000);
    const { rerender } = render(<LogList rows={rows} currentTime={1000} renderRow={renderRow} />);
    renders.mockClear();
    for (const time of [1100, 1200, 1500, 1700, 2500]) {
      rerender(<LogList rows={rows} currentTime={time} renderRow={renderRow} onRowPress={() => {}} />);
      expect(offset(marker())).toBe((time / 100 + 1) * 24);
    }
    expect(renders).not.toHaveBeenCalled();
    // And the rows it passed are dimmed or not, as the time says.
    expect(row(26).hasAttribute('data-future')).toBe(true);
    expect(row(25).hasAttribute('data-future')).toBe(false);
  });

  it('moves with no React at all through the handle', () => {
    const renders = vi.fn();
    const renderRow = (r: LogRow): ReactNode => { renders(); return <LogRowContent row={r} />; };
    const ref = { current: null as LogListHandle | null };
    render(<LogList ref={ref} rows={makeRows(1000)} renderRow={renderRow} />);
    renders.mockClear();
    act(() => { ref.current?.setCurrentTime(500); });
    expect(offset(marker())).toBe(6 * 24);
    expect(row(6).hasAttribute('data-future')).toBe(true);
    expect(row(5).hasAttribute('data-future')).toBe(false);
    expect(renders).not.toHaveBeenCalled();
    act(() => { ref.current?.setCurrentTime(null); });
    expect(marker().style.display).toBe('none');
    expect(row(6).hasAttribute('data-future')).toBe(false);
  });

  it('dims rows mounted later as well', async () => {
    render(<LogList rows={makeRows(5000)} currentTime={0} follow={false} />);
    const el = grid();
    await act(async () => {
      el.scrollTop = 60_000;
      fireEvent.scroll(el);
    });
    const far = allRows().find((r) => Number(r.getAttribute('data-index')) > 2000);
    expect(far?.hasAttribute('data-future')).toBe(true);
  });

  it('scrolls to it, and stops following once the user scrolls away, with a way back', async () => {
    const onFollowChange = vi.fn();
    render(<LogList rows={makeRows(5000)} currentTime={250_000} onFollowChange={onFollowChange} />);
    const el = grid();
    const y = 2501 * 24;
    expect(Math.abs(el.scrollTop - (y - 240))).toBeLessThan(2);
    expect(document.querySelector('[data-slot=log-list-jump]')).toBeNull();

    await act(async () => {
      el.scrollTop = 0;
      fireEvent.scroll(el);
    });
    expect(onFollowChange).toHaveBeenLastCalledWith(false);
    const jump = screen.getByRole('button', { name: /Back to current/ });
    expect(jump.closest('[data-side]')?.getAttribute('data-side')).toBe('below');

    await act(async () => { fireEvent.click(jump); });
    expect(onFollowChange).toHaveBeenLastCalledWith(true);
    expect(Math.abs(el.scrollTop - (y - 240))).toBeLessThan(2);
    expect(document.querySelector('[data-slot=log-list-jump]')).toBeNull();
  });

  it('leaves the view alone while the user is away from it', async () => {
    const rows = makeRows(5000);
    const { rerender } = render(<LogList rows={rows} currentTime={250_000} />);
    const el = grid();
    await act(async () => {
      el.scrollTop = 100;
      fireEvent.scroll(el);
    });
    rerender(<LogList rows={rows} currentTime={300_000} />);
    expect(el.scrollTop).toBe(100);
    expect(screen.getByRole('button', { name: /Back to current/ })).toBeTruthy();
  });

  it('with followTail stays on the newest row until the user scrolls up', async () => {
    const { rerender } = render(<LogList rows={makeRows(1000)} followTail />);
    const el = grid();
    rerender(<LogList rows={makeRows(1100)} followTail />);
    await act(async () => {
      el.scrollTop = 0;
      fireEvent.scroll(el);
    });
    rerender(<LogList rows={makeRows(1200)} followTail />);
    expect(el.scrollTop).toBe(0);
    expect(screen.getByRole('button', { name: /Back to latest/ })).toBeTruthy();
  });
});

describe('press, selection and keyboard', () => {
  it('a press selects the row and calls onRowPress', () => {
    const onRowPress = vi.fn();
    const onSelectionChange = vi.fn();
    const rows = makeRows(10);
    render(<LogList rows={rows} onRowPress={onRowPress} onSelectionChange={onSelectionChange} />);
    fireEvent.click(row(3).querySelector('[data-slot=log-list-message]') as Element);
    expect(onRowPress).toHaveBeenCalledWith(rows[3], 3);
    expect(onSelectionChange).toHaveBeenCalledWith('r3');
    expect(row(3).hasAttribute('data-selected')).toBe(true);
    expect(row(3).getAttribute('aria-selected')).toBe('true');
  });

  it('a controlled selection is the parent\'s', () => {
    const { rerender } = render(<LogList rows={makeRows(10)} selectedId="r2" />);
    expect(row(2).hasAttribute('data-selected')).toBe(true);
    fireEvent.click(row(3));
    expect(row(3).hasAttribute('data-selected')).toBe(false);
    rerender(<LogList rows={makeRows(10)} selectedId={null} />);
    expect(row(2).hasAttribute('data-selected')).toBe(false);
  });

  it('a press on a control inside a row is not a press of the row', () => {
    const onRowPress = vi.fn();
    const onInner = vi.fn();
    render(<LogList rows={makeRows(3, (i) => ({ message: <button type="button" onClick={onInner}>Inner {i}</button> }))} onRowPress={onRowPress} />);
    fireEvent.click(screen.getByText('Inner 1'));
    expect(onInner).toHaveBeenCalled();
    expect(onRowPress).not.toHaveBeenCalled();
  });

  it('the arrow keys move the active row, Enter and Space press it', () => {
    const onRowPress = vi.fn();
    const rows = makeRows(100);
    render(<LogList rows={rows} onRowPress={onRowPress} />);
    const el = grid();
    const active = () => document.getElementById(el.getAttribute('aria-activedescendant') ?? '')?.getAttribute('data-index');
    fireEvent.focus(el);
    expect(active()).toBe('0');
    fireEvent.keyDown(el, { key: 'ArrowDown' });
    fireEvent.keyDown(el, { key: 'ArrowDown' });
    expect(active()).toBe('2');
    expect(row(2).hasAttribute('data-active')).toBe(true);
    fireEvent.keyDown(el, { key: 'ArrowUp' });
    expect(active()).toBe('1');
    fireEvent.keyDown(el, { key: 'Enter' });
    expect(onRowPress).toHaveBeenLastCalledWith(rows[1], 1);
    fireEvent.keyDown(el, { key: ' ' });
    expect(onRowPress).toHaveBeenCalledTimes(2);
    fireEvent.keyDown(el, { key: 'Home' });
    expect(active()).toBe('0');
    fireEvent.keyDown(el, { key: 'End' });
    expect(row(99)).toBeTruthy();
    expect(active()).toBe('99');
  });

  it('copies a row: ⌘C on the active one, with what the host says its text is', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const onRowCopy = vi.fn();
    const rows = makeRows(5);
    const { rerender } = render(<LogList rows={rows} onRowCopy={onRowCopy} />);
    const el = grid();
    fireEvent.focus(el);
    fireEvent.keyDown(el, { key: 'ArrowDown' });
    fireEvent.keyDown(el, { key: 'c', metaKey: true });
    expect(writeText).toHaveBeenLastCalledWith('0:00.100 [log] Message 1 (app.js:1)');
    expect(onRowCopy).toHaveBeenLastCalledWith(rows[1], '0:00.100 [log] Message 1 (app.js:1)');
    rerender(<LogList rows={rows} getRowText={(r) => `row ${r.id}`} />);
    fireEvent.keyDown(el, { key: 'c', ctrlKey: true });
    expect(writeText).toHaveBeenLastCalledWith('row r1');
  });

  it('has one Copy button, on the active row, and none when not copyable', () => {
    const { rerender } = render(<LogList rows={makeRows(5)} />);
    fireEvent.click(row(2));
    expect(within(row(2)).getByRole('button', { name: 'Copy this row' })).toBeTruthy();
    expect(document.querySelectorAll('[data-slot=log-list-actions]').length).toBe(1);
    rerender(<LogList rows={makeRows(5)} copyable={false} />);
    expect(document.querySelectorAll('[data-slot=log-list-actions]').length).toBe(0);
  });
});

describe('open rows', () => {
  const rows = makeRows(10, (i) => (i === 2 ? { detail: 'at readPrice (cart.tsx:118)' } : {}));

  it('a row with a detail opens from its chevron, or →, and that is not a press', () => {
    const onRowPress = vi.fn();
    const onExpandedChange = vi.fn();
    render(<LogList rows={rows} onRowPress={onRowPress} onExpandedChange={onExpandedChange} />);
    expect(row(2).getAttribute('aria-expanded')).toBe('false');
    expect(row(1).getAttribute('aria-expanded')).toBeNull();
    expect(screen.queryByText(/readPrice/)).toBeNull();
    fireEvent.click(row(2).querySelector('[data-row-toggle]') as Element);
    expect(screen.getByText(/readPrice/)).toBeTruthy();
    expect(row(2).getAttribute('aria-expanded')).toBe('true');
    expect(onRowPress).not.toHaveBeenCalled();
    expect([...(onExpandedChange.mock.lastCall?.[0] as Set<string>)]).toEqual(['r2']);

    const el = grid();
    fireEvent.keyDown(el, { key: 'ArrowLeft' });
    expect(screen.queryByText(/readPrice/)).toBeNull();
    fireEvent.keyDown(el, { key: 'ArrowRight' });
    expect(screen.getByText(/readPrice/)).toBeTruthy();
  });

  it('a press does not open it unless asked', () => {
    const { rerender } = render(<LogList rows={rows} />);
    fireEvent.click(row(2).querySelector('[data-slot=log-list-message]') as Element);
    expect(screen.queryByText(/readPrice/)).toBeNull();
    rerender(<LogList rows={rows} expandOnPress />);
    fireEvent.click(row(2).querySelector('[data-slot=log-list-message]') as Element);
    expect(screen.getByText(/readPrice/)).toBeTruthy();
  });

  it('a row stays open after scrolling away and back: that is held by id', async () => {
    render(<LogList rows={makeRows(3000, (i) => (i === 2 ? { detail: 'the trace' } : {}))} defaultExpandedIds={['r2']} />);
    const el = grid();
    expect(screen.getByText('the trace')).toBeTruthy();
    await act(async () => {
      el.scrollTop = 50_000;
      fireEvent.scroll(el);
    });
    expect(screen.queryByText('the trace')).toBeNull();
    await act(async () => {
      el.scrollTop = 0;
      fireEvent.scroll(el);
    });
    expect(screen.getByText('the trace')).toBeTruthy();
  });

  it('with overflow="expand" cuts messages to a line until open', () => {
    render(<LogList rows={rows} overflow="expand" defaultExpandedIds={['r2']} />);
    expect(row(1).querySelector('[data-slot=log-list-message]')?.className).toContain('truncate');
    expect(row(2).querySelector('[data-slot=log-list-message]')?.className).not.toContain('truncate');
  });
});

describe('changing rows', () => {
  it('keeps the row at the top of the view through a filter', async () => {
    const all = makeRows(3000);
    function Host() {
      const [rows, setRows] = useState(all);
      return (
        <>
          <button type="button" onClick={() => setRows(all.filter((_, i) => i % 2 === 0))}>Filter</button>
          <LogList rows={rows} />
        </>
      );
    }
    render(<Host />);
    const el = grid();
    await act(async () => {
      el.scrollTop = 1000 * 24;
      fireEvent.scroll(el);
    });
    await act(async () => { fireEvent.click(screen.getByText('Filter')); });
    // Row 1000 is index 500 now.
    expect(Math.abs(el.scrollTop - 500 * 24)).toBeLessThan(2);
  });

  it('finds the next surviving row when the one at the top is filtered out', async () => {
    const all = makeRows(3000);
    const { rerender } = render(<LogList rows={all} />);
    const el = grid();
    await act(async () => {
      el.scrollTop = 1001 * 24;
      fireEvent.scroll(el);
    });
    rerender(<LogList rows={all.filter((_, i) => i % 2 === 0)} />);
    expect(Math.abs(el.scrollTop - 501 * 24)).toBeLessThan(2);
  });

  it('the active row keeps its place in a new list, even if nothing else about the view changes', () => {
    const all = makeRows(50);
    const { rerender } = render(<LogList rows={all} />);
    const el = grid();
    fireEvent.focus(el);
    for (let i = 0; i < 10; i++) fireEvent.keyDown(el, { key: 'ArrowDown' });
    const active = () => document.getElementById(el.getAttribute('aria-activedescendant') ?? '')?.getAttribute('data-index');
    expect(active()).toBe('10');
    rerender(<LogList rows={all.slice(5)} />);
    expect(active()).toBe('5');
    expect(row(5).hasAttribute('data-active')).toBe(true);
  });

  it('a new selection out of view is scrolled to', () => {
    const rows = makeRows(3000);
    const { rerender } = render(<LogList rows={rows} selectedId={null} />);
    const el = grid();
    expect(el.scrollTop).toBe(0);
    rerender(<LogList rows={rows} selectedId="r2000" />);
    expect(Math.abs(el.scrollTop - (2000 * 24 - (480 - 24) / 2))).toBeLessThan(2);
    expect(row(2000).hasAttribute('data-selected')).toBe(true);
  });
});

describe('ReplayDevtools\' data, which these parts are meant to share', () => {
  // rrweb's event types: 5 is a custom event, 6 a plugin's.
  const events = [
    { type: 6, timestamp: 1000, data: { plugin: 'rrweb/console@1', payload: { level: 'log', payload: ['"Hello"'] } } },
    { type: 6, timestamp: 1500, data: { plugin: 'rrweb/console@1', payload: { level: 'warn', payload: ['"Slow"'], trace: ['at readPrice (cart.tsx:118:24)'] } } },
    { type: 5, timestamp: 2000, data: { tag: 'error', payload: { label: 'TypeError', message: 'oops', stack: ['at a', 'at b'] } } },
    { type: 5, timestamp: 2500, data: { tag: 'network', payload: { method: 'POST', url: 'https://a.com/api/cart?user=1', status: 500, duration: 200, initiatorType: 'fetch' } } },
    { type: 5, timestamp: 2600, data: { tag: 'network', payload: { method: 'GET', url: 'https://a.com/app.js', status: 200, duration: 5000, initiatorType: 'script' } } },
    { type: 5, timestamp: 9000, data: { tag: 'console', payload: { level: 'info', message: 'Later' } } },
  ];
  const state = () => replayDevtoolsAt(getReplayDevtools(events as never), 2200);

  it('LogList shows its console entries just as they are', () => {
    const { console: entries, counts } = state();
    render(<LogList rows={entries} />);
    expect(allRows().length).toBe(entries.length);
    expect(entries.length).toBe(3);
    expect(counts.laterMessages).toBe(1);
    expect(row(0).querySelector('[data-slot=log-list-message]')?.textContent).toBe('Hello');
    expect(row(1).getAttribute('data-level')).toBe('warn');
    expect(row(2).getAttribute('data-level')).toBe('error');
    expect(row(2).querySelector('[data-slot=log-list-message]')?.textContent).toBe('Uncaught TypeError: oops');
    expect(row(1).querySelector('[data-slot=log-list-time]')?.textContent).toBe('0:00.500');
  });

  it('its traces open when mapped to a detail', () => {
    const rows = state().console.map((entry) => ({ ...entry, source: undefined, detail: entry.trace?.join('\n') }));
    render(<LogList rows={rows} defaultExpandedIds={[rows[1].id]} />);
    expect(screen.getByText('at readPrice (cart.tsx:118:24)')).toBeTruthy();
    expect(row(0).querySelector('[data-slot=log-list-source]')).toBeNull();
  });

  it('RequestTable shows its network rows just as they are, pending and failed', () => {
    const { network } = replayDevtoolsAt(getReplayDevtools(events as never), 7000);
    render(<RequestTable rows={network} />);
    const cell = (index: number, column: string) => document.querySelector(`[data-slot=request-table-row][data-index="${index}"] [data-column=${column}]`)?.textContent;
    // A request is sent as long before its event as it took, so these sort by when they were sent.
    const app = network.findIndex((request) => request.url.endsWith('app.js'));
    const cart = network.findIndex((request) => request.url.includes('cart'));
    expect(cell(cart, 'name')).toBe('cart?user=1');
    expect(cell(cart, 'status')).toBe('500');
    expect(cell(cart, 'method')).toBe('POST');
    expect(cell(cart, 'type')).toBe('fetch');
    expect(cell(cart, 'duration')).toBe('200 ms');
    expect(cell(app, 'status')).toBe('200');
    expect(document.querySelector(`[data-slot=request-table-row][data-index="${cart}"]`)?.hasAttribute('data-failed')).toBe(true);
    cleanup();
    const early = replayDevtoolsAt(getReplayDevtools(events as never), 1000).network;
    render(<RequestTable rows={early} />);
    const pending = early.findIndex((request) => request.pending);
    expect(pending).toBeGreaterThanOrEqual(0);
    expect(cell(pending, 'status')).toBe('(pending)');
  });
});

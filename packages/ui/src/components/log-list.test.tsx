// @vitest-environment happy-dom
import { useState, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { getReplayDevtools, replayDevtoolsAt } from '@brett_lamy/ui/docstream/replay';
import { LogList, LogListRowContent, createLogListController, type LogRowState } from '@/components/ui/log-list';
import { RequestTable } from '@/components/ui/request-table';
import type { LogRow } from '@/lib/log-list-model';

declare global { var __UI_SDK_STRICT__: boolean | undefined }
globalThis.__UI_SDK_STRICT__ = true;

// happy-dom lays nothing out: the list's scroller is 480 px tall, and as tall inside as its rows say.
const isScroller = (el: HTMLElement) => el.getAttribute('data-slot') === 'log-list-grid' || el.getAttribute('data-slot') === 'data-table-grid';
Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get(this: HTMLElement) { return isScroller(this) ? 480 : 0; } });
Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
  configurable: true,
  get(this: HTMLElement) { return isScroller(this) ? parseFloat(this.querySelector<HTMLElement>('[data-slot$=-rows]')?.style.height ?? '') || 0 : 0; },
});

// A RequestTable here is regular: as wide as a desktop pane. A message is 100 px wide, and as wide inside as `cutMessages`
// says: 200 px for the ones cut, and every read of that is counted.
const cutMessages = new Set<string>();
let messageReads = 0;
const isMessage = (el: HTMLElement) => el.getAttribute('data-slot') === 'log-list-message';
Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
  configurable: true,
  get(this: HTMLElement) { return this.getAttribute('data-slot') === 'data-table' ? 1024 : isMessage(this) ? 100 : 0; },
});
Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
  configurable: true,
  get(this: HTMLElement) {
    if (!isMessage(this)) return 0;
    messageReads++;
    return cutMessages.has(this.textContent ?? '') ? 200 : 100;
  },
});

afterEach(cleanup);

const makeRows = (count: number, patch?: (i: number) => Partial<LogRow>): LogRow[] =>
  Array.from({ length: count }, (_, i) => ({ id: `r${i}`, level: 'log', time: i * 100, source: `app.js:${i}`, message: `Message ${i}`, ...patch?.(i) }));

const grid = () => screen.getByRole('treegrid');
const row = (index: number) => document.querySelector<HTMLElement>(`[data-slot=log-list-row][data-index="${index}"]`) as HTMLElement;
const allRows = () => [...document.querySelectorAll<HTMLElement>('[data-slot=log-list-row]')];
const marker = () => document.querySelector('[data-slot=log-list-marker]') as HTMLElement;
const offset = (el: HTMLElement) => Number(/translateY\((-?[\d.]+)px\)/.exec(el.style.transform)?.[1]);
const focused = () => document.activeElement as HTMLElement;
const key = (init: KeyboardEventInit) => act(async () => { fireEvent.keyDown(focused(), init); });
const scrollTo = (top: number) => act(async () => {
  grid().scrollTop = top;
  fireEvent.scroll(grid());
});

describe('LogList', () => {
  it('is a treegrid with a slot, taking className and style, and mounts only a window of the rows', () => {
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
    expect(row(0).getAttribute('role')).toBe('row');
    expect(row(0).querySelector('[role=gridcell]')?.getAttribute('data-slot')).toBe('log-list-cell');
  });

  it('places rows by their heights, one after another', () => {
    render(<LogList rows={makeRows(50)} />);
    expect(offset(row(0))).toBe(0);
    expect(offset(row(1))).toBe(24);
    expect(offset(row(5))).toBe(120);
    const sizer = document.querySelector<HTMLElement>('[data-slot=log-list-rows]');
    expect(sizer?.style.height).toBe('1200px');
    expect(sizer?.getAttribute('role')).toBe('rowgroup');
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
    // A string is the title of the shared EmptyState, inside the list's empty part.
    const title = screen.getByText('Nothing logged yet');
    expect(title.getAttribute('data-slot')).toBe('empty-state-title');
    expect(title.closest('[data-slot=log-list-empty]')).toBeTruthy();
    rerender(<LogList rows={makeRows(2)} emptyState="Nothing logged yet" footer="12 more later" />);
    expect(screen.queryByText('Nothing logged yet')).toBeNull();
    expect(screen.getByText('12 more later')).toBeTruthy();
    rerender(<LogList rows={[]} />);
    expect(screen.getByText('No messages')).toBeTruthy();
    rerender(<LogList rows={[]} emptyState={null} />);
    expect(screen.queryByText('No messages')).toBeNull();
  });
});

describe('the position marker', () => {
  it('has none, and dims nothing, without a position', () => {
    render(<LogList rows={makeRows(20)} />);
    expect(marker().style.display).toBe('none');
    expect(marker().getAttribute('aria-hidden')).toBe('true');
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
    expect(row(4).hasAttribute('aria-current')).toBe(false);
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
      return <LogListRowContent row={r} />;
    };
    const rows = makeRows(1000);
    const { rerender } = render(<LogList rows={rows} currentTime={1000} renderRow={renderRow} />);
    const mounted = new Set(renders.mock.calls.map(([index]) => index));
    renders.mockClear();
    for (const time of [1100, 1200, 1300, 1500]) {
      rerender(<LogList rows={rows} currentTime={time} renderRow={renderRow} onAction={() => {}} />);
      expect(offset(marker())).toBe((time / 100 + 1) * 24);
    }
    expect(renders).not.toHaveBeenCalled();
    expect(grid().scrollTop).toBe(0);
    // Further on the view follows it, which mounts the rows that come into view and renders none of the others.
    rerender(<LogList rows={rows} currentTime={2500} renderRow={renderRow} />);
    expect(grid().scrollTop).toBeGreaterThan(0);
    expect(renders).toHaveBeenCalled();
    expect(renders.mock.calls.some(([index]) => mounted.has(index))).toBe(false);
    // And the rows it passed are dimmed or not, as the time says.
    expect(row(26).hasAttribute('data-future')).toBe(true);
    expect(row(25).hasAttribute('data-future')).toBe(false);
  });

  it('moves with no React at all through the controller', () => {
    const renders = vi.fn();
    const renderRow = (r: LogRow): ReactNode => { renders(); return <LogListRowContent row={r} />; };
    const controller = createLogListController();
    render(<LogList controller={controller} rows={makeRows(1000)} renderRow={renderRow} />);
    renders.mockClear();
    act(() => { controller.setCurrentTime(500); });
    expect(offset(marker())).toBe(6 * 24);
    expect(row(6).hasAttribute('data-future')).toBe(true);
    expect(row(5).hasAttribute('data-future')).toBe(false);
    expect(renders).not.toHaveBeenCalled();
    act(() => { controller.setCurrentTime(null); });
    expect(marker().style.display).toBe('none');
    expect(row(6).hasAttribute('data-future')).toBe(false);
  });

  it('dims rows mounted later as well', async () => {
    render(<LogList rows={makeRows(5000)} currentTime={0} follow={false} />);
    await scrollTo(60_000);
    const far = allRows().find((r) => Number(r.getAttribute('data-index')) > 2000);
    expect(far?.hasAttribute('data-future')).toBe(true);
  });

  it('scrolls to it, and stops following once the user scrolls away, with a way back', async () => {
    const onFollowingChange = vi.fn();
    render(<LogList rows={makeRows(5000)} currentTime={250_000} onFollowingChange={onFollowingChange} />);
    const el = grid();
    const y = 2501 * 24;
    expect(Math.abs(el.scrollTop - (y - 240))).toBeLessThan(2);
    expect(document.querySelector('[data-slot=log-list-jump]')).toBeNull();

    await scrollTo(0);
    expect(onFollowingChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: 'scroll' }));
    const jump = screen.getByRole('button', { name: /Back to current/ });
    expect(jump.closest('[data-slot=log-list-jump]')?.getAttribute('data-side')).toBe('below');

    await act(async () => { fireEvent.click(jump); });
    expect(onFollowingChange).toHaveBeenLastCalledWith(true, expect.objectContaining({ reason: 'trigger-press' }));
    expect(Math.abs(el.scrollTop - (y - 240))).toBeLessThan(2);
    expect(document.querySelector('[data-slot=log-list-jump]')).toBeNull();
  });

  it('its own scrolls fire no scroll event, yet render the rows they reach', async () => {
    const rows = makeRows(5000);
    const { rerender } = render(<LogList rows={rows} currentTime={0} />);
    const el = grid();
    const heard = vi.fn();
    el.addEventListener('scroll', heard);
    // Following the marker far down moves the view from code: no listener on the viewport hears a scroll.
    rerender(<LogList rows={rows} currentTime={400_000} />);
    expect(el.scrollTop).toBeGreaterThan(3000 * 24);
    expect(row(4001)).toBeTruthy();
    expect(row(0)).toBeNull();
    expect(heard).not.toHaveBeenCalled();
  });

  it('jumping back to the newest row fires no scroll event, yet renders it', async () => {
    const { rerender } = render(<LogList rows={makeRows(1000)} followTail />);
    const el = grid();
    await scrollTo(0);
    rerender(<LogList rows={makeRows(1200)} followTail />);
    const heard = vi.fn();
    el.addEventListener('scroll', heard);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Back to latest/ })); });
    expect(el.scrollTop).toBe(1200 * 24 - 480);
    expect(row(1199)).toBeTruthy();
    expect(heard).not.toHaveBeenCalled();
  });

  it('points the way back up when the marker is above', async () => {
    render(<LogList rows={makeRows(5000)} currentTime={250_000} />);
    await scrollTo(100_000);
    expect(screen.getByRole('button', { name: /Back to current/ }).closest('[data-side]')?.getAttribute('data-side')).toBe('above');
  });

  it('leaves the view alone while the user is away from it', async () => {
    const rows = makeRows(5000);
    const { rerender } = render(<LogList rows={rows} currentTime={250_000} />);
    await scrollTo(100);
    rerender(<LogList rows={rows} currentTime={300_000} />);
    expect(grid().scrollTop).toBe(100);
    expect(screen.getByRole('button', { name: /Back to current/ })).toBeTruthy();
  });

  it('does not follow with follow={false}, but still offers the way back', () => {
    render(<LogList rows={makeRows(5000)} currentTime={250_000} follow={false} />);
    expect(grid().scrollTop).toBe(0);
    expect(screen.getByRole('button', { name: /Back to current/ })).toBeTruthy();
  });

  it('with followTail starts on the newest row, and stays put once the user scrolls up', async () => {
    const onFollowingChange = vi.fn();
    const { rerender } = render(<LogList rows={makeRows(1000)} followTail onFollowingChange={onFollowingChange} />);
    const el = grid();
    expect(el.scrollTop).toBe(1000 * 24 - 480);
    expect(row(999)).toBeTruthy();
    rerender(<LogList rows={makeRows(1100)} followTail onFollowingChange={onFollowingChange} />);
    await scrollTo(0);
    expect(onFollowingChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: 'scroll' }));
    rerender(<LogList rows={makeRows(1200)} followTail onFollowingChange={onFollowingChange} />);
    expect(el.scrollTop).toBe(0);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Back to latest/ })); });
    expect(el.scrollTop).toBe(1200 * 24 - 480);
    expect(onFollowingChange).toHaveBeenLastCalledWith(true, expect.anything());
  });
});

describe('press and selection', () => {
  it('a press selects the row and calls onAction with it', () => {
    const onAction = vi.fn();
    const onValueChange = vi.fn();
    const rows = makeRows(10);
    render(<LogList rows={rows} onAction={onAction} onValueChange={onValueChange} />);
    fireEvent.click(row(3).querySelector('[data-slot=log-list-message]') as Element);
    expect(onAction).toHaveBeenCalledWith('r3', expect.objectContaining({ row: rows[3], index: 3, reason: 'item-press' }));
    expect(onValueChange).toHaveBeenCalledWith('r3', expect.objectContaining({ reason: 'item-press' }));
    expect(row(3).hasAttribute('data-selected')).toBe(true);
    expect(row(3).getAttribute('aria-selected')).toBe('true');
    expect(row(2).getAttribute('aria-selected')).toBe('false');
  });

  it('a controlled selection is the parent\'s', () => {
    const { rerender } = render(<LogList rows={makeRows(10)} value="r2" />);
    expect(row(2).hasAttribute('data-selected')).toBe(true);
    fireEvent.click(row(3));
    expect(row(3).hasAttribute('data-selected')).toBe(false);
    rerender(<LogList rows={makeRows(10)} value={null} />);
    expect(row(2).hasAttribute('data-selected')).toBe(false);
  });

  it('a change can be refused', () => {
    render(<LogList rows={makeRows(10)} onValueChange={(_value, details) => details.cancel()} />);
    fireEvent.click(row(3));
    expect(row(3).hasAttribute('data-selected')).toBe(false);
  });

  it('a press on a control inside a row is not a press of the row', () => {
    const onAction = vi.fn();
    const onInner = vi.fn();
    render(<LogList rows={makeRows(3, (i) => ({ message: <button type="button" onClick={onInner}>Inner {i}</button> }))} onAction={onAction} />);
    fireEvent.click(screen.getByText('Inner 1'));
    expect(onInner).toHaveBeenCalled();
    expect(onAction).not.toHaveBeenCalled();
  });

  it('has one Copy button, on the active row, and none when not copyable', () => {
    const { rerender } = render(<LogList rows={makeRows(5)} />);
    fireEvent.click(row(2));
    expect(within(row(2)).getByRole('button', { name: 'Copy this row' })).toBeTruthy();
    expect(document.querySelectorAll('[data-slot=log-list-actions]').length).toBe(1);
    expect(document.querySelector('[data-slot=log-list-actions]')?.getAttribute('role')).toBe('gridcell');
    rerender(<LogList rows={makeRows(5)} copyable={false} />);
    expect(document.querySelectorAll('[data-slot=log-list-actions]').length).toBe(0);
  });

  it('moves Copy to the row under a mouse, and copies it', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const onAction = vi.fn();
    render(<LogList rows={makeRows(5)} onAction={onAction} />);
    fireEvent.click(row(1));
    fireEvent.pointerOver(row(3), { pointerType: 'mouse' });
    expect(within(row(3)).getByRole('button', { name: 'Copy this row' })).toBeTruthy();
    expect(document.querySelectorAll('[data-slot=log-list-actions]').length).toBe(1);
    onAction.mockClear();
    await act(async () => { fireEvent.click(within(row(3)).getByRole('button', { name: 'Copy this row' })); });
    expect(writeText).toHaveBeenLastCalledWith('0:00.300 [log] Message 3 (app.js:3)');
    expect(onAction).not.toHaveBeenCalled();
    expect(within(row(3)).getByRole('button', { name: 'Copied' })).toBeTruthy();
    // Screen readers hear it too (UI SDK's live region, filled after 100ms).
    await act(async () => { await new Promise((r) => setTimeout(r, 150)); });
    expect(document.querySelector('[data-ui-sdk-announcer]')?.textContent).toBe('Copied');
  });
});

describe('keyboard', () => {
  it('is one tab stop: the list until a row is active, then that row', () => {
    render(<LogList rows={makeRows(20)} />);
    const stops = () => [grid(), ...allRows()].filter((el) => el.tabIndex === 0);
    expect(stops()).toEqual([grid()]);
    act(() => { row(3).focus(); });
    expect(stops()).toEqual([row(3)]);
    expect(row(3).hasAttribute('data-active')).toBe(true);
  });

  it('the controller focuses the row focus starts on: the selected one, if it is in view', () => {
    const controller = createLogListController();
    render(<LogList controller={controller} rows={makeRows(20)} defaultValue="r4" />);
    act(() => { controller.focus(); });
    expect(focused()).toBe(row(4));
  });

  it('the arrow keys move between rows, Enter and Space press one', async () => {
    const onAction = vi.fn();
    const rows = makeRows(100);
    render(<LogList rows={rows} onAction={onAction} />);
    const active = () => focused().getAttribute('data-index');
    act(() => { row(0).focus(); });
    await key({ key: 'ArrowDown' });
    await key({ key: 'ArrowDown' });
    expect(active()).toBe('2');
    expect(row(2).hasAttribute('data-active')).toBe(true);
    expect(row(1).hasAttribute('data-active')).toBe(false);
    await key({ key: 'ArrowUp' });
    expect(active()).toBe('1');
    await key({ key: 'Enter' });
    expect(onAction).toHaveBeenLastCalledWith('r1', expect.objectContaining({ row: rows[1], index: 1 }));
    await key({ key: ' ' });
    expect(onAction).toHaveBeenCalledTimes(2);
    await key({ key: 'End' });
    expect(active()).toBe('99');
    expect(grid().scrollTop).toBe(100 * 24 - 480);
    await key({ key: 'PageUp' });
    expect(Number(active())).toBeLessThan(90);
    expect(Number(active())).toBeGreaterThan(70);
    await key({ key: 'Home' });
    expect(active()).toBe('0');
    expect(grid().scrollTop).toBe(0);
  });

  it('a host can take a key first', async () => {
    const onAction = vi.fn();
    render(<LogList rows={makeRows(5)} onAction={onAction} onKeyDown={(event) => { if (event.key === 'Enter') event.preventDefault(); }} />);
    act(() => { row(1).focus(); });
    await key({ key: 'Enter' });
    expect(onAction).not.toHaveBeenCalled();
    await key({ key: ' ' });
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('copies a row: ⌘C on the active one, with what the host says its text is', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const onRowCopy = vi.fn();
    const rows = makeRows(5);
    const { rerender } = render(<LogList rows={rows} onRowCopy={onRowCopy} />);
    act(() => { row(1).focus(); });
    await key({ key: 'c', metaKey: true });
    expect(writeText).toHaveBeenLastCalledWith('0:00.100 [log] Message 1 (app.js:1)');
    expect(onRowCopy).toHaveBeenLastCalledWith('0:00.100 [log] Message 1 (app.js:1)', rows[1]);
    rerender(<LogList rows={rows} getRowText={(r) => `row ${r.id}`} />);
    await key({ key: 'c', ctrlKey: true });
    expect(writeText).toHaveBeenLastCalledWith('row r1');
    writeText.mockClear();
    rerender(<LogList rows={rows} copyable={false} />);
    await key({ key: 'c', metaKey: true });
    expect(writeText).not.toHaveBeenCalled();
  });

  it('Tab goes through the row\'s own controls and then out, and Escape comes back to the row', async () => {
    render(
      <>
        <LogList rows={makeRows(4, (i) => ({ message: <button type="button">Inner {i}</button> }))} copyable={false} />
        <button type="button">After</button>
      </>,
    );
    act(() => { row(1).focus(); });
    // From the row, the browser's own Tab reaches its control: nothing is taken from it.
    expect(fireEvent.keyDown(row(1), { key: 'Tab' })).toBe(true);
    expect(focused()).toBe(row(1));
    // From its last control, focus is put at the end of the list, for the browser to move on from.
    act(() => { screen.getByText('Inner 1').focus(); });
    expect(fireEvent.keyDown(focused(), { key: 'Tab' })).toBe(true);
    expect(focused()).toBe(screen.getByText('Inner 3'));
    act(() => { screen.getByText('Inner 1').focus(); });
    await key({ key: 'Escape' });
    expect(focused()).toBe(row(1));
    // Back from the row, focus is put at the start of the list.
    expect(fireEvent.keyDown(row(1), { key: 'Tab', shiftKey: true })).toBe(true);
    expect(focused()).toBe(screen.getByText('Inner 0'));
  });
});

describe('open rows', () => {
  const rows = makeRows(10, (i) => (i === 2 ? { detail: 'at readPrice (cart.tsx:118)' } : {}));

  it('a row with a detail opens from its chevron, or →, and that is not a press', async () => {
    const onAction = vi.fn();
    const onExpandedChange = vi.fn();
    render(<LogList rows={rows} onAction={onAction} onExpandedChange={onExpandedChange} />);
    expect(row(2).getAttribute('aria-expanded')).toBe('false');
    expect(row(1).getAttribute('aria-expanded')).toBeNull();
    expect(screen.queryByText(/readPrice/)).toBeNull();
    fireEvent.click(row(2).querySelector('[data-row-toggle]') as Element);
    expect(screen.getByText(/readPrice/)).toBeTruthy();
    expect(row(2).getAttribute('aria-expanded')).toBe('true');
    expect(row(2).hasAttribute('data-expanded')).toBe(true);
    expect(onAction).not.toHaveBeenCalled();
    expect(onExpandedChange).toHaveBeenLastCalledWith(['r2'], expect.objectContaining({ reason: 'trigger-press' }));

    act(() => { row(2).focus(); });
    await key({ key: 'ArrowLeft' });
    expect(screen.queryByText(/readPrice/)).toBeNull();
    expect(onExpandedChange).toHaveBeenLastCalledWith([], expect.objectContaining({ reason: 'list-navigation' }));
    await key({ key: 'ArrowRight' });
    expect(screen.getByText(/readPrice/)).toBeTruthy();
  });

  it('the open rows can be the parent\'s', () => {
    const { rerender } = render(<LogList rows={rows} expanded={[]} />);
    fireEvent.click(row(2).querySelector('[data-row-toggle]') as Element);
    expect(screen.queryByText(/readPrice/)).toBeNull();
    rerender(<LogList rows={rows} expanded={['r2']} />);
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
    render(<LogList rows={makeRows(3000, (i) => (i === 2 ? { detail: 'the trace' } : {}))} defaultExpanded={['r2']} />);
    expect(screen.getByText('the trace')).toBeTruthy();
    await scrollTo(50_000);
    expect(screen.queryByText('the trace')).toBeNull();
    await scrollTo(0);
    expect(screen.getByText('the trace')).toBeTruthy();
  });

  it('with overflow="expand" cuts messages to a line until open', () => {
    render(<LogList rows={rows} overflow="expand" defaultExpanded={['r2']} />);
    expect(row(1).querySelector('[data-slot=log-list-message]')?.className).toContain('truncate');
    expect(row(2).querySelector('[data-slot=log-list-message]')?.className).not.toContain('truncate');
  });
});

describe('cut messages, with overflow="expand"', () => {
  // The rows' ResizeObserver, run by hand: `resizeRows()` is every watched row changing size.
  const watching = new Map<ResizeObserver, { callback: ResizeObserverCallback; targets: Set<Element> }>();
  class TestResizeObserver {
    constructor(callback: ResizeObserverCallback) { watching.set(this as unknown as ResizeObserver, { callback, targets: new Set() }); }
    observe(target: Element) { watching.get(this as unknown as ResizeObserver)?.targets.add(target); }
    unobserve(target: Element) { watching.get(this as unknown as ResizeObserver)?.targets.delete(target); }
    disconnect() { watching.delete(this as unknown as ResizeObserver); }
  }
  const resizeRows = () => act(() => {
    for (const [observer, { callback, targets }] of watching) {
      const entries = [...targets].filter((el) => el.matches('[data-slot=log-list-row]')).map((target) => ({ target }) as ResizeObserverEntry);
      if (entries.length) callback(entries, observer);
    }
  });
  const original = window.ResizeObserver;
  beforeEach(() => {
    window.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver;
    cutMessages.clear();
    messageReads = 0;
  });
  afterEach(() => {
    window.ResizeObserver = original;
    watching.clear();
  });

  it('a row whose message is cut says it opens, and a press opens it', () => {
    cutMessages.add('Message 4');
    const onExpandedChange = vi.fn();
    render(<LogList rows={makeRows(10)} overflow="expand" onExpandedChange={onExpandedChange} />);
    resizeRows();
    expect(row(4).hasAttribute('data-clipped')).toBe(true);
    expect(row(4).getAttribute('aria-expanded')).toBe('false');
    expect(row(5).hasAttribute('data-clipped')).toBe(false);
    expect(row(5).getAttribute('aria-expanded')).toBeNull();
    fireEvent.click(row(4).querySelector('[data-slot=log-list-message]') as Element);
    expect(onExpandedChange).toHaveBeenLastCalledWith(['r4'], expect.objectContaining({ reason: 'item-press' }));
    expect(row(4).getAttribute('aria-expanded')).toBe('true');
    // A row that isn't cut has nothing to open.
    fireEvent.click(row(5).querySelector('[data-slot=log-list-message]') as Element);
    expect(onExpandedChange).toHaveBeenCalledTimes(1);
  });

  it('a row that is no longer cut once it is wider says so', () => {
    cutMessages.add('Message 4');
    render(<LogList rows={makeRows(10)} overflow="expand" />);
    resizeRows();
    expect(row(4).getAttribute('aria-expanded')).toBe('false');
    cutMessages.clear();
    resizeRows();
    expect(row(4).hasAttribute('data-clipped')).toBe(false);
    expect(row(4).getAttribute('aria-expanded')).toBeNull();
  });

  it('reads the messages when the rows or their sizes change, never on a render that changes neither', () => {
    const rows = makeRows(10);
    const { rerender } = render(<LogList rows={rows} overflow="expand" />);
    resizeRows();
    expect(messageReads).toBeGreaterThan(0);
    messageReads = 0;
    for (const time of [100, 200, 300]) rerender(<LogList rows={rows} overflow="expand" currentTime={time} markerLabel="Paused" />);
    expect(messageReads).toBe(0);
    cutMessages.add('Message 1');
    rerender(<LogList rows={makeRows(10)} overflow="expand" currentTime={300} markerLabel="Paused" />);
    expect(messageReads).toBeGreaterThan(0);
    expect(row(1).hasAttribute('data-clipped')).toBe(true);
  });

  it('reads none of them when messages wrap', () => {
    cutMessages.add('Message 4');
    render(<LogList rows={makeRows(10)} />);
    resizeRows();
    expect(messageReads).toBe(0);
    expect(row(4).hasAttribute('data-clipped')).toBe(false);
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
    await scrollTo(1000 * 24);
    await act(async () => { fireEvent.click(screen.getByText('Filter')); });
    // Row 1000 is index 500 now.
    expect(Math.abs(grid().scrollTop - 500 * 24)).toBeLessThan(2);
    expect(row(500).textContent).toContain('Message 1000');
  });

  it('finds the next surviving row when the one at the top is filtered out', async () => {
    const all = makeRows(3000);
    const { rerender } = render(<LogList rows={all} />);
    await scrollTo(1001 * 24);
    rerender(<LogList rows={all.filter((_, i) => i % 2 === 0)} />);
    expect(Math.abs(grid().scrollTop - 501 * 24)).toBeLessThan(2);
  });

  it('the active row keeps its place in a new list, and its focus', async () => {
    const all = makeRows(50);
    const { rerender } = render(<LogList rows={all} />);
    act(() => { row(0).focus(); });
    for (let i = 0; i < 10; i++) await key({ key: 'ArrowDown' });
    expect(focused().getAttribute('data-index')).toBe('10');
    await act(async () => { rerender(<LogList rows={all.slice(5)} />); });
    expect(row(5).hasAttribute('data-active')).toBe(true);
    expect(row(5).textContent).toContain('Message 10');
    expect(focused()).toBe(row(5));
  });

  it('a new selection out of view is scrolled to', () => {
    const rows = makeRows(3000);
    const { rerender } = render(<LogList rows={rows} value={null} />);
    const el = grid();
    expect(el.scrollTop).toBe(0);
    rerender(<LogList rows={rows} value="r2000" />);
    expect(Math.abs(el.scrollTop - (2000 * 24 - (480 - 24) / 2))).toBeLessThan(2);
    expect(row(2000).hasAttribute('data-selected')).toBe(true);
  });

  it('the controller scrolls to a row by id', () => {
    const controller = createLogListController();
    render(<LogList controller={controller} rows={makeRows(3000)} />);
    act(() => { controller.scrollToId('r1500', { align: 'start' }); });
    expect(grid().scrollTop).toBe(1500 * 24);
    expect(row(1500)).toBeTruthy();
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
    render(<LogList rows={rows} defaultExpanded={[rows[1].id]} />);
    expect(screen.getByText('at readPrice (cart.tsx:118:24)')).toBeTruthy();
    expect(row(0).querySelector('[data-slot=log-list-source]')).toBeNull();
  });

  it('RequestTable shows its network rows just as they are, pending and failed', () => {
    const { network } = replayDevtoolsAt(getReplayDevtools(events as never), 7000);
    render(<RequestTable rows={network} />);
    const cell = (index: number, column: string) => document.querySelector(`[data-slot=data-table-row][data-index="${index}"] [data-column=${column}]`)?.textContent;
    // A request is sent as long before its event as it took, so these sort by when they were sent.
    const app = network.findIndex((request) => request.url.endsWith('app.js'));
    const cart = network.findIndex((request) => request.url.includes('cart'));
    expect(cell(cart, 'name')).toBe('cart?user=1');
    expect(cell(cart, 'status')).toBe('500');
    expect(cell(cart, 'method')).toBe('POST');
    expect(cell(cart, 'type')).toBe('fetch');
    expect(cell(cart, 'duration')).toBe('200 ms');
    expect(cell(app, 'status')).toBe('200');
    expect(document.querySelector(`[data-slot=data-table-row][data-index="${cart}"]`)?.hasAttribute('data-failed')).toBe(true);
    cleanup();
    const early = replayDevtoolsAt(getReplayDevtools(events as never), 1000).network;
    render(<RequestTable rows={early} />);
    const pending = early.findIndex((request) => request.pending);
    expect(pending).toBeGreaterThanOrEqual(0);
    expect(cell(pending, 'status')).toBe('(pending)');
  });
});

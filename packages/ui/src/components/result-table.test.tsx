// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ResultTable, type ResultSet } from '@/components/ui/result-table';

declare global { var __UI_SDK_STRICT__: boolean | undefined }
globalThis.__UI_SDK_STRICT__ = true;
afterEach(cleanup);
// The toolbar's labels morph with framer-motion, whose canceled animations reject under happy-dom.
// What the table hands UI SDK's announcer (the real one still runs).
const said = vi.hoisted(() => [] as string[]);
vi.mock('@ui-sdk/core', async (load) => {
  const core = await load<typeof import('@ui-sdk/core')>();
  return { ...core, announce: (text: string, options?: Parameters<typeof core.announce>[1]) => { said.push(text); core.announce(text, options); } };
});
vi.mock('@/components/ui/text-morph', () => ({ TextMorph: ({ children }: { children: string }) => children }));

const result: ResultSet = {
  command: 'SELECT',
  fields: [{ name: 'id', dataTypeID: 23 }, { name: 'title', dataTypeID: 25 }, { name: 'meta', dataTypeID: 3802 }],
  rows: [
    { id: 1, title: 'A Wizard of Earthsea', meta: { pages: 183 } },
    { id: 2, title: null, meta: { pages: 304, blurb: 'A lone human envoy on a planet where people have no fixed sex, and a winter that never ends.' } },
  ],
};

const grid = () => screen.getByRole('grid');
const cell = (row: number, col: number) => screen.getAllByRole('row')[row].querySelectorAll<HTMLElement>('[role=gridcell],[role=columnheader]')[col];
const summary = () => document.querySelector('[data-slot=result-table-summary]') as HTMLElement;
const press = (key: string, init: KeyboardEventInit = {}) => act(() => { fireEvent.keyDown(document.activeElement as Element, { key, ...init }); });

describe('ResultTable', () => {
  it('is a grid of the fields and rows, with a summary', () => {
    render(<ResultTable result={result} durationMs={3.2} aria-label="Books" className="mine" data-testid="root" />);
    const root = screen.getByTestId('root');
    expect(root.getAttribute('data-slot')).toBe('result-table');
    expect(root.classList.contains('mine')).toBe(true);
    expect(grid().getAttribute('aria-label')).toBe('Books');
    expect(grid().getAttribute('aria-rowcount')).toBe('3');
    expect(screen.getAllByRole('columnheader').map((c) => c.textContent)).toEqual(['idint4', 'titletext', 'metajsonb']);
    expect(cell(2, 1).textContent).toBe('NULL');
    expect(summary().textContent).toContain('2 rows');
    // No live region of its own: a new result goes through UI SDK's announcer.
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('is one tab stop that moves between cells, headers included', () => {
    render(<ResultTable result={result} />);
    expect(cell(0, 0).getAttribute('tabindex')).toBe('0');
    expect(cell(1, 0).getAttribute('tabindex')).toBe('-1');
    act(() => { cell(0, 0).focus(); });
    press('ArrowDown');
    expect(document.activeElement).toBe(cell(1, 0));
    press('ArrowRight');
    expect(document.activeElement).toBe(cell(1, 1));
    expect(cell(1, 1).getAttribute('tabindex')).toBe('0');
    press('End');
    expect(document.activeElement).toBe(cell(1, 2));
    press('ArrowUp');
    expect(document.activeElement).toBe(cell(0, 2));
    // A header takes roving focus like a cell: it holds the one tab stop while it is active.
    expect(cell(0, 2).getAttribute('role')).toBe('columnheader');
    expect(cell(0, 2).getAttribute('tabindex')).toBe('0');
    expect(cell(1, 2).getAttribute('tabindex')).toBe('-1');
  });

  it('says Copied for a while, restarting on a second copy, and leaves no timer behind', async () => {
    const writeText = vi.fn(async () => {});
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    const setTimer = vi.spyOn(globalThis, 'setTimeout');
    const clearTimer = vi.spyOn(globalThis, 'clearTimeout');
    const copiedTimers = () => setTimer.mock.results.filter((_, i) => setTimer.mock.calls[i]![1] === 1500).map((r) => r.value);
    const onCopy = vi.fn();
    const { unmount } = render(<ResultTable result={result} onCopy={onCopy} />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Copy CSV' })); });
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(onCopy).toHaveBeenCalledWith('csv', expect.stringContaining('id,title,meta'));
    expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Copy JSON' })); });
    const [first, second] = copiedTimers();
    expect(clearTimer).toHaveBeenCalledWith(first);
    unmount();
    expect(clearTimer).toHaveBeenCalledWith(second);
    vi.unstubAllGlobals();
    setTimer.mockRestore();
    clearTimer.mockRestore();
  });

  it('expands a long value from its button, and Escape goes back to the cell', () => {
    render(<ResultTable result={result} />);
    const expand = within(cell(2, 2)).getByRole('button', { name: 'Expand value' });
    act(() => { fireEvent.click(expand); });
    expect(within(cell(2, 2)).getByRole('button', { name: 'Collapse value' }).getAttribute('aria-expanded')).toBe('true');
    // On the cell, Tab's next stop is its button.
    act(() => { fireEvent.pointerDown(cell(2, 2), { pointerType: 'mouse' }); });
    expect(document.activeElement).toBe(cell(2, 2));
    expect(cell(2, 2).getAttribute('tabindex')).toBe('0');
    act(() => { within(cell(2, 2)).getByRole('button').focus(); });
    press('Escape');
    expect(document.activeElement).toBe(cell(2, 2));
  });

  it('resizes a column from its edge and from its header', () => {
    const onColumnWidthsChange = vi.fn();
    render(<ResultTable result={result} resizable defaultColumnWidths={{ 1: 200 }} onColumnWidthsChange={onColumnWidthsChange} />);
    const edge = screen.getByRole('separator', { name: 'Resize title' });
    expect(edge.getAttribute('aria-valuenow')).toBe('200');
    expect(cell(0, 1).style.width).toBe('200px');
    act(() => { cell(0, 1).focus(); });
    press('ArrowRight', { altKey: true });
    expect(onColumnWidthsChange).toHaveBeenLastCalledWith({ 1: 212 }, expect.objectContaining({ reason: 'resize-key' }));
    expect(cell(0, 1).style.width).toBe('212px');
    act(() => { fireEvent.doubleClick(edge); });
    expect(onColumnWidthsChange).toHaveBeenLastCalledWith({}, expect.objectContaining({ reason: 'handle-press' }));
  });

  it('gives a separator the width its column shows while none is set', () => {
    const spy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 137.4, 20));
    render(<ResultTable result={result} resizable />);
    expect(screen.getByRole('separator', { name: 'Resize title' }).getAttribute('aria-valuenow')).toBe('137');
    spy.mockRestore();
  });

  it('pages long results', () => {
    render(<ResultTable result={{ fields: [{ name: 'n' }], rows: Array.from({ length: 12 }, (_, n) => ({ n })) }} maxRows={5} />);
    expect(screen.getAllByRole('row').length).toBe(6);
    act(() => { fireEvent.click(screen.getByRole('button', { name: /Show 5 more/ })); });
    expect(screen.getAllByRole('row').length).toBe(11);
  });

  it('says what a write did, with no grid', () => {
    render(<ResultTable result={{ command: 'INSERT', rowCount: 2, fields: [], rows: [] }} />);
    expect(screen.queryByRole('grid')).toBeNull();
    expect(summary().textContent).toBe('INSERT · 2 rows affected');
  });

  it('reads a new result out once, through UI SDK\'s announcer, and not the one it mounts with', () => {
    said.length = 0;
    const { rerender } = render(<ResultTable result={result} durationMs={3} />);
    expect(said).toEqual([]);
    rerender(<ResultTable result={result} durationMs={3} toolbar />);
    expect(said).toEqual([]);
    const next: ResultSet = { ...result, rows: result.rows.slice(0, 1) };
    rerender(<ResultTable result={next} durationMs={8} />);
    expect(said).toEqual(['1 row · 8 ms']);
  });

  it('keys each header, resizer and cell part by its own value', () => {
    const onColumnWidthsChange = vi.fn();
    render(<ResultTable result={result} resizable onColumnWidthsChange={onColumnWidthsChange} />);
    // A press on a cell focuses that cell, not the last one rendered.
    act(() => { fireEvent.pointerDown(cell(1, 1)); });
    expect(cell(1, 1).getAttribute('tabindex')).toBe('0');
    expect(cell(2, 2).getAttribute('tabindex')).toBe('-1');
    act(() => { fireEvent.pointerDown(cell(0, 0)); });
    expect(cell(0, 0).getAttribute('tabindex')).toBe('0');
    // Each separator resizes its own column, and no part writes its key as a DOM id.
    const [first, second] = screen.getAllByRole('separator');
    act(() => { first.focus(); fireEvent.keyDown(first, { key: 'ArrowRight' }); });
    act(() => { second.focus(); fireEvent.keyDown(second, { key: 'ArrowRight' }); });
    const columns = onColumnWidthsChange.mock.calls.map(([widths]) => Object.keys(widths as object));
    expect(columns[0]).toEqual(['0']);
    expect(columns[1]).toEqual(expect.arrayContaining(['0', '1']));
    expect(grid().querySelectorAll('[id]').length).toBe(0);
  });
});

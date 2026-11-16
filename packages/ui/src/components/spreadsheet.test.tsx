// @vitest-environment happy-dom
import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createAgent } from '@ui-sdk/react/agent';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Spreadsheet, createSpreadsheetController, type SpreadsheetProps } from '@/components/ui/spreadsheet';
import { spreadsheetColumnLetter } from '@/lib/spreadsheet-primitive';

declare global {
  var __UI_SDK_STRICT__: boolean | undefined;
}
globalThis.__UI_SDK_STRICT__ = true;

afterEach(cleanup);

const agent = createAgent();
const DATA = [['Name', 'Qty'], ['pear', '3'], ['apple', '10'], ['fig', '']];

function Harness({ onRows, ...props }: Partial<SpreadsheetProps> & { onRows?: SpreadsheetProps['onValueChange'] }) {
  const [rows, setRows] = useState(DATA);
  return <Spreadsheet engine="fallback" aria-label="Fruit" value={rows} onValueChange={(r, details) => { setRows(r); onRows?.(r, details); }} {...props} />;
}

const flush = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
const grid = () => screen.getByRole('grid');
function cellAt(row: number, col: number) {
  const rowEl = screen.getAllByRole('row').find((r) => r.getAttribute('aria-rowindex') === String(row + 2));
  return rowEl?.querySelector<HTMLElement>(`[role=gridcell][aria-colindex="${col + 2}"]`) ?? null;
}
const focused = () => document.activeElement as HTMLElement;
const key = (k: string, init: Record<string, unknown> = {}) => fireEvent.keyDown(focused(), { key: k, ...init });
const column = (c: number) => [...document.querySelectorAll(`[role=gridcell][aria-colindex="${c + 2}"]`)].map((n) => n.textContent);
/** Focuses the first cell, as Tab into the grid does. */
const enter = async () => {
  await act(async () => cellAt(0, 0)!.focus());
};

describe('Spreadsheet', () => {
  it('names columns like other spreadsheets', () => {
    expect([0, 25, 26, 701, 702].map(spreadsheetColumnLetter)).toEqual(['A', 'Z', 'AA', 'ZZ', 'AAA']);
  });

  it('is an ARIA grid with titles, row numbers and counts, and one tab stop', () => {
    render(<Harness />);
    expect(grid().getAttribute('aria-rowcount')).toBe('4');
    expect(grid().getAttribute('aria-colcount')).toBe('3');
    expect(grid().getAttribute('aria-multiselectable')).toBe('true');
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Row number', 'Name', 'Qty']);
    expect(screen.getAllByRole('rowheader').map((h) => h.textContent)).toEqual(['1', '2', '3']);
    expect(column(0)).toEqual(['pear', 'apple', 'fig']);
    expect(screen.getByText('3 rows × 2 columns')).toBeTruthy();
    // Before the grid is entered, the first cell has the tab stop.
    const stops = screen.getAllByRole('gridcell').filter((c) => c.tabIndex === 0);
    expect(stops).toEqual([cellAt(0, 0)]);
  });

  it('moves with the arrow keys, roving the tab stop, and edits by typing', async () => {
    const onRows = vi.fn();
    render(<Harness onRows={onRows} />);
    await enter();
    key('ArrowDown');
    key('ArrowRight');
    expect(focused()).toBe(cellAt(1, 1));
    expect(focused().textContent).toBe('10');
    expect(cellAt(1, 1)!.tabIndex).toBe(0);
    expect(cellAt(0, 0)!.tabIndex).toBe(-1);
    key('4');
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe('4');
    fireEvent.input(input, { target: { value: '42' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onRows).toHaveBeenLastCalledWith([['Name', 'Qty'], ['pear', '3'], ['apple', '42'], ['fig', '']], expect.objectContaining({ reason: 'cell-edit' }));
    await flush();
    expect(focused()).toBe(cellAt(2, 1)); // moved down to fig's empty Qty
  });

  it('cancels an edit with Escape and goes back to the cell', async () => {
    const onRows = vi.fn();
    render(<Harness onRows={onRows} />);
    await enter();
    key('Enter');
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe('pear');
    fireEvent.input(input, { target: { value: 'banana' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    await flush();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(onRows).not.toHaveBeenCalled();
    expect(focused()).toBe(cellAt(0, 0));
  });

  it('names the cell editor after its column and row, and commits on Tab, moving right', async () => {
    const onRows = vi.fn();
    render(<Harness onRows={onRows} />);
    await enter();
    key('F2');
    const input = screen.getByRole('textbox', { name: 'Name, row 1' }) as HTMLInputElement;
    fireEvent.input(input, { target: { value: 'plum' } });
    fireEvent.keyDown(input, { key: 'Tab' });
    expect(onRows).toHaveBeenLastCalledWith([['Name', 'Qty'], ['plum', '3'], ['apple', '10'], ['fig', '']], expect.objectContaining({ reason: 'cell-edit' }));
    await flush();
    expect(focused()).toBe(cellAt(0, 1));
  });

  it('extends a range with Shift, announces it, copies it as tab-separated text, and Escape collapses it', async () => {
    render(<Harness />);
    await enter();
    key('ArrowRight', { shiftKey: true });
    key('ArrowDown', { shiftKey: true });
    expect(cellAt(1, 1)!.getAttribute('aria-selected')).toBe('true');
    expect(cellAt(0, 0)!.getAttribute('data-range-edge')).toBe('top left');
    expect(cellAt(2, 0)!.getAttribute('aria-selected')).toBe('false');
    await waitFor(() => expect(document.body.textContent).toContain('2 rows by 2 columns selected'));
    const setData = vi.fn();
    fireEvent.copy(focused(), { clipboardData: { setData } });
    expect(setData).toHaveBeenCalledWith('text/plain', 'pear\t3\napple\t10');
    expect(screen.getByText(/Sum 13 · Average 6\.5 · Count 4/)).toBeTruthy();
    key('Escape');
    expect(cellAt(1, 1)!.getAttribute('aria-selected')).toBe('false');
    expect(screen.queryByText(/Sum 13/)).toBeNull();
  });

  it('jumps to the edges with ⌘ and the arrows, and selects all with ⌘A', async () => {
    render(<Harness />);
    await enter();
    key('ArrowDown', { metaKey: true });
    expect(focused()).toBe(cellAt(2, 0));
    key('ArrowRight', { metaKey: true });
    expect(focused()).toBe(cellAt(2, 1));
    key('Home', { ctrlKey: true });
    expect(focused()).toBe(cellAt(0, 0));
    key('a', { metaKey: true });
    expect(screen.getAllByRole('gridcell').every((c) => c.getAttribute('aria-selected') === 'true')).toBe(true);
  });

  it('mirrors the arrows in right-to-left text', async () => {
    render(<div dir="rtl" style={{ direction: 'rtl' }}><Harness /></div>);
    await enter();
    key('ArrowLeft');
    expect(focused()).toBe(cellAt(0, 1));
    key('ArrowRight');
    expect(focused()).toBe(cellAt(0, 0));
    key('ArrowLeft', { shiftKey: true });
    expect(cellAt(0, 1)!.getAttribute('aria-selected')).toBe('true');
  });

  it('pastes tab-separated text, growing the table and selecting what landed, and undoes and redoes it', async () => {
    const onRows = vi.fn();
    render(<Harness onRows={onRows} />);
    await enter();
    key('ArrowDown', { metaKey: true });
    fireEvent.paste(focused(), { clipboardData: { getData: () => 'kiwi\t1\nlime\t2\n' } });
    expect(onRows).toHaveBeenLastCalledWith([['Name', 'Qty'], ['pear', '3'], ['apple', '10'], ['kiwi', '1'], ['lime', '2']], expect.objectContaining({ reason: 'paste' }));
    await flush();
    expect(cellAt(3, 1)!.getAttribute('aria-selected')).toBe('true');
    key('z', { metaKey: true });
    expect(onRows).toHaveBeenLastCalledWith(DATA, expect.objectContaining({ reason: 'undo' }));
    key('z', { metaKey: true, shiftKey: true });
    expect(onRows).toHaveBeenLastCalledWith([['Name', 'Qty'], ['pear', '3'], ['apple', '10'], ['kiwi', '1'], ['lime', '2']], expect.objectContaining({ reason: 'redo' }));
  });

  it('fills a selection with one pasted value, and clears it with Delete', async () => {
    const onRows = vi.fn();
    render(<Harness onRows={onRows} />);
    await enter();
    key('ArrowDown', { shiftKey: true });
    fireEvent.paste(focused(), { clipboardData: { getData: () => 'x' } });
    expect(onRows).toHaveBeenLastCalledWith([['Name', 'Qty'], ['x', '3'], ['x', '10'], ['fig', '']], expect.objectContaining({ reason: 'paste' }));
    key('Delete');
    expect(onRows).toHaveBeenLastCalledWith([['Name', 'Qty'], ['', '3'], ['', '10'], ['fig', '']], expect.objectContaining({ reason: 'clear' }));
  });

  it('cuts the selection to the clipboard', async () => {
    const onRows = vi.fn();
    render(<Harness onRows={onRows} />);
    await enter();
    const setData = vi.fn();
    fireEvent.cut(focused(), { clipboardData: { setData } });
    expect(setData).toHaveBeenCalledWith('text/plain', 'pear');
    expect(onRows).toHaveBeenLastCalledWith([['Name', 'Qty'], ['', '3'], ['apple', '10'], ['fig', '']], expect.objectContaining({ reason: 'cut' }));
  });

  it('sorts a number column as a view, empty cells last, and clears the sort', async () => {
    const onSort = vi.fn();
    const onSortChange = vi.fn();
    const onRows = vi.fn();
    render(<Harness onSorted={onSort} onSortChange={onSortChange} onRows={onRows} />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Sort by Qty' })); });
    await waitFor(() => expect(column(1)).toEqual(['3', '10', '']));
    expect(onSortChange).toHaveBeenLastCalledWith({ column: 1, direction: 'ascending' }, expect.objectContaining({ reason: 'trigger-press' }));
    expect(onSort).toHaveBeenLastCalledWith(expect.objectContaining({ column: 1, direction: 'ascending', ranOn: 'cpu', rows: 3 }));
    expect(screen.getAllByRole('columnheader')[2].getAttribute('aria-sort')).toBe('ascending');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Sort by Qty, descending' })); });
    await waitFor(() => expect(column(1)).toEqual(['10', '3', '']));
    expect(screen.getByText(/Sorted by Qty on the CPU in/)).toBeTruthy();
    // An edit in the sorted view lands on the right data row.
    await enter();
    key('ArrowRight');
    key('Enter');
    const input = screen.getByRole('textbox') as HTMLInputElement;
    fireEvent.input(input, { target: { value: '11' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onRows).toHaveBeenLastCalledWith([['Name', 'Qty'], ['pear', '3'], ['apple', '11'], ['fig', '']], expect.anything());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Sort by Qty, clear sort' })); });
    expect(onSort).toHaveBeenLastCalledWith(null);
    expect(column(1)).toEqual(['3', '11', '']);
  });

  it('takes a controlled sort: a press asks, the host decides, and a default sort runs at the start', async () => {
    const onSortChange = vi.fn();
    const { rerender } = render(<Harness sort={null} onSortChange={onSortChange} />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Sort by Qty' })); });
    expect(onSortChange).toHaveBeenLastCalledWith({ column: 1, direction: 'ascending' }, expect.objectContaining({ reason: 'trigger-press' }));
    // Not until the host says so.
    expect(column(1)).toEqual(['3', '10', '']);
    rerender(<Harness sort={{ column: 1, direction: 'descending' }} onSortChange={onSortChange} />);
    await waitFor(() => expect(column(1)).toEqual(['10', '3', '']));
    expect(screen.getAllByRole('columnheader')[2].getAttribute('aria-sort')).toBe('descending');
    cleanup();
    render(<Harness defaultSort={{ column: 1, direction: 'ascending' }} onSortChange={(_sort, details) => details.cancel()} />);
    await waitFor(() => expect(column(1)).toEqual(['3', '10', '']));
    // A canceled press keeps the sort.
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Sort by Qty, descending' })); });
    expect(column(1)).toEqual(['3', '10', '']);
  });

  it('shows an EmptyState under the titles, beside the grid, or the one it is given', () => {
    const { rerender } = render(<Spreadsheet aria-label="Empty" defaultValue={[['Name', 'Qty']]} />);
    expect(document.querySelector('[data-slot=spreadsheet-empty]')?.textContent).toBe('No rowsPaste cells or add a row.');
    // A grid owns only rows: the status region is not inside it.
    expect(grid().contains(document.querySelector('[data-slot=spreadsheet-empty]'))).toBe(false);
    rerender(<Spreadsheet aria-label="Empty" defaultValue={[['Name', 'Qty']]} emptyState="Nothing yet" statusBar={false} />);
    expect(document.querySelector('[data-slot=spreadsheet-empty]')?.textContent).toBe('Nothing yet');
    expect(document.querySelector('[data-slot=spreadsheet-footer]')).toBeNull();
  });

  it('keeps the sort buttons out of the Tab order, and Add Row adds a row and moves to it', async () => {
    const onRows = vi.fn();
    render(<Harness onRows={onRows} />);
    for (const name of ['Sort by Name', 'Sort by Qty']) {
      const sort = screen.getByRole('button', { name }) as HTMLButtonElement;
      expect(sort.tabIndex).toBe(-1);
      expect(sort.type).toBe('button');
    }
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Add Row/ })); });
    expect(onRows).toHaveBeenLastCalledWith([...DATA, ['']], expect.objectContaining({ reason: 'add-row' }));
    await flush();
    expect(focused()).toBe(cellAt(3, 0));
  });

  it('selects a column from its title, a row from its number, and everything from the corner', async () => {
    render(<Harness />);
    const [corner, name] = screen.getAllByRole('columnheader');
    fireEvent.pointerDown(name, { button: 0 });
    expect(column(0).length).toBe(3);
    expect([0, 1, 2].every((r) => cellAt(r, 0)!.getAttribute('aria-selected') === 'true')).toBe(true);
    expect(cellAt(0, 1)!.getAttribute('aria-selected')).toBe('false');
    expect(name.hasAttribute('data-selected')).toBe(true);
    fireEvent.pointerDown(screen.getAllByRole('rowheader')[1], { button: 0 });
    expect([0, 1].every((c) => cellAt(1, c)!.getAttribute('aria-selected') === 'true')).toBe(true);
    expect(cellAt(0, 0)!.getAttribute('aria-selected')).toBe('false');
    fireEvent.pointerDown(corner, { button: 0 });
    expect(screen.getAllByRole('gridcell').every((c) => c.getAttribute('aria-selected') === 'true')).toBe(true);
  });

  it('selects with a press, and stretches the range from the active cell with Shift', async () => {
    render(<Harness />);
    const at = { pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, buttons: 1 };
    fireEvent.pointerDown(cellAt(0, 0)!, at);
    fireEvent.pointerUp(cellAt(0, 0)!, { ...at, buttons: 0 });
    expect(focused()).toBe(cellAt(0, 0));
    fireEvent.pointerDown(cellAt(1, 1)!, { ...at, shiftKey: true });
    expect([[0, 0], [0, 1], [1, 0], [1, 1]].every(([r, c]) => cellAt(r, c)!.getAttribute('aria-selected') === 'true')).toBe(true);
    expect(cellAt(2, 0)!.getAttribute('aria-selected')).toBe('false');
  });

  it('draws a histogram under each number column title', async () => {
    render(<Harness />);
    const bars = await screen.findByRole('img', { name: /^Qty histogram: values from 3 to 10$/ });
    expect(bars.getAttribute('data-engine')).toBe('cpu');
    expect(screen.queryByRole('img', { name: /^Name histogram/ })).toBeNull();
  });

  it('names a column by its title alone, and says a date column\'s range in days', async () => {
    render(<Spreadsheet engine="fallback" aria-label="Dates" defaultValue={[['Name', 'Due'], ['a', '2026-05-03'], ['b', '2026-10-12']]} />);
    expect(screen.getByRole('columnheader', { name: 'Due' })).toBeTruthy();
    await screen.findByRole('img', { name: 'Due histogram: values from 2026-05-03 to 2026-10-12' });
  });

  it('renames a column by double-clicking its title', async () => {
    const onRows = vi.fn();
    render(<Harness onRows={onRows} />);
    fireEvent.doubleClick(screen.getAllByRole('columnheader')[1]);
    const input = screen.getByRole('textbox', { name: 'Title of column A' }) as HTMLInputElement;
    expect(input.value).toBe('Name');
    fireEvent.input(input, { target: { value: 'Fruit' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onRows).toHaveBeenLastCalledWith([['Fruit', 'Qty'], ['pear', '3'], ['apple', '10'], ['fig', '']], expect.objectContaining({ reason: 'cell-edit' }));
  });

  it('widens and narrows the column with ⌥→ and ⌥←, and resizes from its edge', async () => {
    const onColumnWidthsChange = vi.fn();
    render(<Harness onColumnWidthsChange={onColumnWidthsChange} />);
    await enter();
    const before = parseFloat(cellAt(0, 0)!.style.width);
    key('ArrowRight', { altKey: true });
    expect(onColumnWidthsChange).toHaveBeenLastCalledWith({ 0: before + 16 }, expect.objectContaining({ reason: 'resize-key' }));
    await flush();
    expect(parseFloat(cellAt(0, 0)!.style.width)).toBe(before + 16);
    expect(parseFloat(cellAt(0, 1)!.style.left)).toBe(parseFloat(cellAt(0, 0)!.style.left) + before + 16);
    key('ArrowLeft', { altKey: true, shiftKey: true });
    // No narrower than 48 px.
    expect(onColumnWidthsChange).toHaveBeenLastCalledWith({ 0: 48 }, expect.objectContaining({ reason: 'resize-key' }));
    const edge = screen.getByRole('separator', { name: 'Resize Name' });
    expect(edge.getAttribute('aria-orientation')).toBe('vertical');
    fireEvent.keyDown(edge, { key: 'ArrowRight' });
    expect(onColumnWidthsChange).toHaveBeenLastCalledWith({ 0: 64 }, expect.objectContaining({ reason: 'resize-key' }));
    fireEvent.doubleClick(edge);
    expect(onColumnWidthsChange).toHaveBeenLastCalledWith({}, expect.objectContaining({ reason: 'handle-press' }));    // Each edge is its own part, keyed by its column's index, which never becomes a DOM id.
    fireEvent.keyDown(screen.getByRole('separator', { name: 'Resize Qty' }), { key: 'ArrowRight' });
    expect(Object.keys(onColumnWidthsChange.mock.lastCall?.[0] ?? {})).toEqual(['1']);
    expect(grid().querySelectorAll('[id]').length).toBe(0);
  });

  it('a column edge has a value before any width is set: the width the column shows', async () => {
    render(<Harness />);
    await flush();
    const edge = screen.getByRole('separator', { name: 'Resize Name' });
    expect(edge.getAttribute('aria-valuenow')).toBe(String(Math.round(parseFloat(cellAt(0, 0)!.style.width))));
    expect(screen.getByRole('separator', { name: 'Resize Qty' }).getAttribute('aria-valuenow')).toMatch(/^\d+$/);
  });

  it('resizes a column by dragging its edge, showing the draft as it goes and asking once on release', async () => {
    const onColumnWidthsChange = vi.fn();
    render(<Harness onColumnWidthsChange={onColumnWidthsChange} />);
    const before = parseFloat(cellAt(0, 0)!.style.width);
    const edge = screen.getByRole('separator', { name: 'Resize Name' });
    const at = { pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, buttons: 1 };
    fireEvent.pointerDown(edge, { ...at, clientX: 100, clientY: 10 });
    fireEvent.pointerMove(edge, { ...at, clientX: 120, clientY: 10 });
    fireEvent.pointerMove(edge, { ...at, clientX: 140, clientY: 10 });
    await flush();
    expect(parseFloat(cellAt(0, 0)!.style.width)).toBe(before + 40);
    expect(onColumnWidthsChange).not.toHaveBeenCalled();
    fireEvent.pointerUp(edge, { ...at, clientX: 140, clientY: 10, buttons: 0 });
    expect(onColumnWidthsChange).toHaveBeenCalledTimes(1);
    expect(onColumnWidthsChange).toHaveBeenLastCalledWith({ 0: before + 40 }, expect.objectContaining({ reason: 'drag' }));
    // Selecting the column isn't what a press on its edge does.
    expect(cellAt(1, 0)!.getAttribute('aria-selected')).toBe('false');
  });

  it('is read-only on request', async () => {
    const onRows = vi.fn();
    render(<Harness onRows={onRows} readOnly />);
    expect(grid().getAttribute('aria-readonly')).toBe('true');
    await enter();
    key('x');
    key('Enter');
    key('Delete');
    fireEvent.paste(focused(), { clipboardData: { getData: () => 'a\tb' } });
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button', { name: /Add Row/ })).toBeNull();
    expect(onRows).not.toHaveBeenCalled();
  });

  it('renders only the rows in view and reaches the others by keyboard', async () => {
    const rows = [['n'], ...Array.from({ length: 5000 }, (_, i) => [String(i)])];
    render(<Spreadsheet engine="fallback" aria-label="Numbers" defaultValue={rows} histograms={false} />);
    expect(screen.getAllByRole('gridcell').length).toBeLessThan(50);
    await enter();
    key('ArrowDown', { metaKey: true });
    await flush();
    expect(focused().textContent).toBe('4999');
    expect(focused().closest('[role=row]')!.getAttribute('aria-rowindex')).toBe('5001');
  });

  it('keeps the active cell rendered, with focus, while it scrolls out of view', async () => {
    const rows = [['n'], ...Array.from({ length: 5000 }, (_, i) => [String(i)])];
    render(<Spreadsheet engine="fallback" aria-label="Numbers" defaultValue={rows} histograms={false} />);
    const scroller = grid();
    Object.defineProperty(scroller, 'clientHeight', { configurable: true, value: 300 });
    Object.defineProperty(scroller, 'scrollHeight', { configurable: true, value: 5000 * 28 + 30 });
    await enter();
    await act(async () => {
      scroller.scrollTop = 28 * 2000;
      scroller.dispatchEvent(new Event('scroll'));
    });
    await flush();
    expect(screen.getAllByRole('gridcell').some((c) => c.textContent === '2005')).toBe(true);
    expect(cellAt(0, 0)).not.toBeNull();
    expect(focused()).toBe(cellAt(0, 0));
  });

  it('keeps edits in its own state without `value`', async () => {
    render(<Spreadsheet engine="fallback" aria-label="Fruit" defaultValue={DATA} />);
    await enter();
    key('k');
    const input = screen.getByRole('textbox') as HTMLInputElement;
    fireEvent.input(input, { target: { value: 'kiwi' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await flush();
    expect(column(0)).toEqual(['kiwi', 'apple', 'fig']);
    key('z', { ctrlKey: true });
    await flush();
    expect(column(0)).toEqual(['pear', 'apple', 'fig']);
  });

  it('is driven by its controller', async () => {
    const controller = createSpreadsheetController();
    const onRows = vi.fn();
    render(<Harness onRows={onRows} controller={controller} />);
    await act(async () => { controller.select({ row: 0, col: 0 }, { row: 1, col: 1 }); });
    expect(controller.copy()).toBe('pear\t3\napple\t10');
    await act(async () => { controller.edit({ row: 2, col: 1 }, '7'); });
    expect(onRows).toHaveBeenLastCalledWith([['Name', 'Qty'], ['pear', '3'], ['apple', '10'], ['fig', '7']], expect.objectContaining({ reason: 'imperative' }));
    await act(async () => { controller.undo(); });
    expect(onRows).toHaveBeenLastCalledWith(DATA, expect.objectContaining({ reason: 'undo' }));
    await act(async () => { await controller.sort(0, 'descending'); });
    expect(column(0)).toEqual(['pear', 'fig', 'apple']);
  });

  it('is named for agents, which can select, edit and sort it', async () => {
    const onRows = vi.fn();
    render(<Harness onRows={onRows} />);
    const entry = agent.snapshot().find((e) => !e.offPage && e.component === 'spreadsheet');
    expect(entry?.label).toBe('Fruit');
    expect(entry?.actions).toEqual(expect.arrayContaining(['select', 'edit', 'paste', 'sort', 'undo']));
    const result = await act(() => agent.act({ steps: [{ ref: 'Fruit', action: 'edit', args: [{ row: 0, col: 1 }, '5'] }] }));
    expect(result.ok, result.error?.message).toBe(true);
    expect(onRows).toHaveBeenLastCalledWith([['Name', 'Qty'], ['pear', '5'], ['apple', '10'], ['fig', '']], expect.objectContaining({ source: 'agent' }));
  });
});

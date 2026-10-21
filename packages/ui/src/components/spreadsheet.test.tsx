// @vitest-environment happy-dom
import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Spreadsheet, columnName, type SpreadsheetProps } from '@/components/ui/spreadsheet';

afterEach(cleanup);

const DATA = [['Name', 'Qty'], ['pear', '3'], ['apple', '10'], ['fig', '']];

function Harness({ onRows, ...props }: Partial<SpreadsheetProps> & { onRows?: (rows: string[][]) => void }) {
  const [rows, setRows] = useState(DATA);
  return <Spreadsheet engine="fallback" value={rows} onChange={(r) => { setRows(r); onRows?.(r); }} {...props} />;
}

const grid = () => screen.getByRole('grid');
const active = () => document.getElementById(grid().getAttribute('aria-activedescendant')!)!;
const key = (k: string, init: Record<string, unknown> = {}) => fireEvent.keyDown(grid(), { key: k, ...init });
const column = (c: number) => [...document.querySelectorAll(`[role=gridcell][aria-colindex="${c + 2}"]`)].map((n) => n.textContent);

describe('Spreadsheet', () => {
  it('names columns like other spreadsheets', () => {
    expect([0, 25, 26, 701, 702].map(columnName)).toEqual(['A', 'Z', 'AA', 'ZZ', 'AAA']);
  });

  it('is an ARIA grid with titles, row numbers and counts', () => {
    render(<Harness />);
    expect(grid().getAttribute('aria-rowcount')).toBe('4');
    expect(grid().getAttribute('aria-colcount')).toBe('3');
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['', 'Name', 'Qty']);
    expect(column(0)).toEqual(['pear', 'apple', 'fig']);
    expect(screen.getByText('3 rows × 2 columns')).toBeTruthy();
  });

  it('moves with the arrow keys and edits by typing', async () => {
    const onRows = vi.fn();
    render(<Harness onRows={onRows} />);
    key('ArrowDown');
    key('ArrowRight');
    expect(active().textContent).toBe('10');
    key('4');
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe('4');
    fireEvent.change(input, { target: { value: '42' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onRows).toHaveBeenLastCalledWith([['Name', 'Qty'], ['pear', '3'], ['apple', '42'], ['fig', '']]);
    await waitFor(() => expect(active().textContent).toBe('')); // moved down to fig's empty Qty
  });

  it('cancels an edit with Escape', () => {
    const onRows = vi.fn();
    render(<Harness onRows={onRows} />);
    key('Enter');
    const input = screen.getByRole('textbox') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'banana' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    fireEvent.blur(input);
    expect(onRows).not.toHaveBeenCalled();
  });

  it('pastes tab-separated text, growing the table, and undoes it', () => {
    const onRows = vi.fn();
    render(<Harness onRows={onRows} />);
    key('ArrowDown', { metaKey: true });
    fireEvent.paste(grid(), { clipboardData: { getData: () => 'kiwi\t1\nlime\t2\n' } });
    expect(onRows).toHaveBeenLastCalledWith([['Name', 'Qty'], ['pear', '3'], ['apple', '10'], ['kiwi', '1'], ['lime', '2']]);
    key('z', { metaKey: true });
    expect(onRows).toHaveBeenLastCalledWith(DATA);
  });

  it('copies the selection as tab-separated text', () => {
    render(<Harness />);
    key('ArrowRight', { shiftKey: true });
    key('ArrowDown', { shiftKey: true });
    const setData = vi.fn();
    fireEvent.copy(grid(), { clipboardData: { setData } });
    expect(setData).toHaveBeenCalledWith('text/plain', 'pear\t3\napple\t10');
    expect(screen.getByText(/Sum 13 · Average 6\.5 · Count 4/)).toBeTruthy();
  });

  it('sorts a number column as a view, empty cells last, and clears the sort', async () => {
    const onSort = vi.fn();
    const onRows = vi.fn();
    render(<Harness onSort={onSort} onRows={onRows} />);
    const sort = screen.getByRole('button', { name: 'Sort by Qty' });
    await act(async () => { fireEvent.click(sort); });
    await waitFor(() => expect(column(1)).toEqual(['3', '10', '']));
    expect(onSort).toHaveBeenLastCalledWith(expect.objectContaining({ column: 1, direction: 'ascending', ranOn: 'cpu', rows: 3 }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Sort by Qty, descending' })); });
    await waitFor(() => expect(column(1)).toEqual(['10', '3', '']));
    // An edit in the sorted view lands on the right data row.
    key('ArrowRight');
    key('Enter');
    const input = screen.getByRole('textbox') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '11' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onRows).toHaveBeenLastCalledWith([['Name', 'Qty'], ['pear', '3'], ['apple', '11'], ['fig', '']]);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Sort by Qty, clear sort' })); });
    expect(onSort).toHaveBeenLastCalledWith(null);
    expect(column(1)).toEqual(['3', '11', '']);
  });

  it('is read-only on request', () => {
    const onRows = vi.fn();
    render(<Harness onRows={onRows} isReadOnly />);
    key('x');
    key('Delete');
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button', { name: /Add Row/ })).toBeNull();
    expect(onRows).not.toHaveBeenCalled();
  });
});

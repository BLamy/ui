// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { DataTable, DataTableCell, createDataTableController, type DataTableColumn } from '@/components/ui/data-table';

declare global { var __UI_SDK_STRICT__: boolean | undefined }
globalThis.__UI_SDK_STRICT__ = true;
// happy-dom lays nothing out: the table is `tableWidth` wide, and its ResizeObservers hear about a new one from `resizeTable`.
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

interface Book { id: string; title: string; author: string; pages: number | null; year: number }
const books: Book[] = [
  { id: 'b1', title: 'Solaris', author: 'Lem', pages: 204, year: 1961 },
  { id: 'b2', title: 'Kindred', author: 'Butler', pages: null, year: 1979 },
  { id: 'b3', title: 'A Wizard of Earthsea', author: 'Le Guin', pages: 183, year: 1968 },
];
const COLUMNS: DataTableColumn<Book>[] = [
  { id: 'title', title: 'Title', flex: 2, minWidth: 120 },
  { id: 'author', title: 'Author', width: 100 },
  { id: 'pages', title: 'Pages', width: 64, align: 'end' },
  { id: 'year', title: 'Year', width: 64, align: 'end', hideBelow: 'regular' },
];

const grid = () => screen.getByRole('grid');
const row = (index: number) => document.querySelector<HTMLElement>(`[data-slot=data-table-row][data-index="${index}"]`) as HTMLElement;
const cell = (index: number, column: string) => row(index).querySelector(`[data-column=${column}]`)?.textContent;
const column = (id: string) => document.querySelector<HTMLElement>(`[role=columnheader][data-column="${id}"]`) as HTMLElement;
const press = (key: string, init: KeyboardEventInit = {}) => act(() => { fireEvent.keyDown(document.activeElement as Element, { key, ...init }); });
const tabIn = () => act(() => {
  fireEvent.keyDown(document.body, { key: 'Tab' });
  grid().focus();
});

describe('DataTable', () => {
  it('is a named grid of the rows, with headers, taking className, style and data props', () => {
    render(<DataTable rows={books} columns={COLUMNS} aria-label="Books" className="mine" style={{ height: 200 }} data-testid="root" />);
    const root = screen.getByTestId('root');
    expect(root.getAttribute('data-slot')).toBe('data-table');
    expect(root.getAttribute('data-density')).toBe('default');
    expect(root.classList.contains('mine')).toBe(true);
    expect(root.style.height).toBe('200px');
    expect(grid().getAttribute('aria-label')).toBe('Books');
    expect(grid().getAttribute('aria-rowcount')).toBe('4');
    expect(grid().getAttribute('aria-colcount')).toBe('4');
    expect(screen.getAllByRole('columnheader').map((c) => c.textContent)).toEqual(['Title', 'Author', 'Pages', 'Year']);
    expect(cell(0, 'title')).toBe('Solaris');
    expect(cell(1, 'pages')).toBe('');
    expect(row(0).getAttribute('aria-rowindex')).toBe('2');
  });

  it('lines an end column up at the end, header and cells', () => {
    render(<DataTable rows={books} columns={COLUMNS} />);
    expect(column('pages').className).toContain('justify-end');
    expect(row(0).querySelector('[data-column=pages]')?.className).toContain('text-end');
  });

  it('renders a cell with `render`, classes from the column, and row attributes from `rowProps`', () => {
    const columns: DataTableColumn<Book>[] = [{ id: 'title', title: 'Title', render: (b) => <em>{b.title}</em>, className: 'font-mono' }];
    render(<DataTable rows={books} columns={columns} rowProps={(b) => ({ 'data-old': b.year < 1965, 'data-author': b.author })} />);
    expect(row(0).querySelector('[data-column=title] em')?.textContent).toBe('Solaris');
    expect(row(0).querySelector('[data-column=title]')?.className).toContain('font-mono');
    expect(row(0).getAttribute('data-old')).toBe('');
    expect(row(1).hasAttribute('data-old')).toBe(false);
    expect(row(1).getAttribute('data-author')).toBe('Butler');
  });

  it('sorts by a field when its header is pressed, empty cells last', () => {
    const onSortChange = vi.fn();
    render(<DataTable rows={books} columns={COLUMNS} onSortChange={onSortChange} />);
    expect(column('pages').getAttribute('aria-sort')).toBe('none');
    fireEvent.click(column('pages'));
    expect(onSortChange).toHaveBeenLastCalledWith({ column: 'pages', direction: 'ascending' }, expect.objectContaining({ reason: 'trigger-press' }));
    expect([0, 1, 2].map((i) => cell(i, 'title'))).toEqual(['A Wizard of Earthsea', 'Solaris', 'Kindred']);
    fireEvent.click(column('pages'));
    expect(column('pages').getAttribute('aria-sort')).toBe('descending');
    expect([0, 1, 2].map((i) => cell(i, 'title'))).toEqual(['Solaris', 'A Wizard of Earthsea', 'Kindred']);
  });

  it('a column with a render and no sortValue does not sort', () => {
    const columns: DataTableColumn<Book>[] = [{ id: 'title', title: 'Title', render: (b) => b.title }, { id: 'year', title: 'Year', render: (b) => b.year, sortValue: (b) => -b.year }];
    render(<DataTable rows={books} columns={columns} />);
    expect(column('title').getAttribute('aria-sort')).toBeNull();
    fireEvent.click(column('year'));
    expect(cell(0, 'title')).toBe('Kindred');
  });

  it('selects on press with `single`, and only presses with `none`', () => {
    const onAction = vi.fn();
    const onValueChange = vi.fn();
    const { unmount } = render(<DataTable rows={books} columns={COLUMNS} onAction={onAction} onValueChange={onValueChange} />);
    fireEvent.click(row(1).querySelector('[data-column=author]') as Element);
    expect(onAction).toHaveBeenCalledWith('b2', expect.objectContaining({ reason: 'item-press', row: books[1], index: 1 }));
    expect(onValueChange).toHaveBeenCalledWith('b2', expect.objectContaining({ reason: 'item-press' }));
    expect(row(1).getAttribute('aria-selected')).toBe('true');
    unmount();
    onAction.mockClear();
    onValueChange.mockClear();
    render(<DataTable rows={books} columns={COLUMNS} selectionMode="none" onAction={onAction} onValueChange={onValueChange} />);
    fireEvent.click(row(1).querySelector('[data-column=author]') as Element);
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onValueChange).not.toHaveBeenCalled();
    expect(row(1).hasAttribute('aria-selected')).toBe(false);
    expect(row(1).hasAttribute('data-selected')).toBe(false);
  });

  it('is one tab stop: rows by arrow, headers above, Enter presses and sorts', () => {
    const onAction = vi.fn();
    render(<DataTable rows={books} columns={COLUMNS} onAction={onAction} />);
    expect(grid().getAttribute('tabindex')).toBe('0');
    tabIn();
    expect(document.activeElement).toBe(row(0));
    press('ArrowDown');
    expect(document.activeElement).toBe(row(1));
    press('Enter');
    expect(onAction).toHaveBeenCalledWith('b2', expect.anything());
    press('ArrowUp');
    press('ArrowUp');
    expect(document.activeElement).toBe(column('title'));
    press('ArrowRight');
    expect(document.activeElement).toBe(column('author'));
    press('Enter');
    expect(column('author').getAttribute('aria-sort')).toBe('ascending');
    press('Escape');
    expect(document.activeElement?.getAttribute('role')).toBe('row');
  });

  it('resizes a column from its edge, by key and back by a double press', () => {
    const onColumnWidthsChange = vi.fn();
    render(<DataTable rows={books} columns={COLUMNS} defaultColumnWidths={{ author: 100 }} onColumnWidthsChange={onColumnWidthsChange} />);
    const edge = within(column('author')).getByRole('separator', { name: 'Resize Author' });
    expect(edge.getAttribute('aria-valuenow')).toBe('100');
    act(() => { fireEvent.pointerDown(edge, { pointerType: 'mouse' }); fireEvent.pointerUp(edge, { pointerType: 'mouse' }); edge.focus(); });
    press('ArrowRight');
    expect(onColumnWidthsChange).toHaveBeenLastCalledWith({ author: 112 }, expect.objectContaining({ reason: 'resize-key' }));
    act(() => { fireEvent.doubleClick(edge); });
    expect(onColumnWidthsChange).toHaveBeenLastCalledWith({}, expect.objectContaining({ reason: 'handle-press' }));
  });

  it('shows an EmptyState by default, or the one it is given, and a toolbar and footer', () => {
    const { rerender } = render(<DataTable rows={[]} columns={COLUMNS} />);
    expect(document.querySelector('[data-slot=data-table-empty] [data-slot=empty-state]')?.textContent).toBe('No rows');
    rerender(<DataTable rows={[]} columns={COLUMNS} emptyState="Nothing here" />);
    expect(screen.getByText('Nothing here')).toBeTruthy();
    rerender(<DataTable rows={books} columns={COLUMNS} toolbar={<span>3 books</span>} footer="That's all" />);
    expect(document.querySelector('[data-slot=data-table-empty]')).toBeNull();
    expect(document.querySelector('[data-slot=data-table-toolbar]')?.textContent).toBe('3 books');
    expect(screen.getByText("That's all")).toBeTruthy();
  });

  it('follows its own width: columns go below regular, rows stack when compact, with a sort menu', () => {
    render(<DataTable rows={books} columns={COLUMNS} />);
    const root = document.querySelector('[data-slot=data-table]') as HTMLElement;
    expect(root.getAttribute('data-size-class')).toBe('regular');
    resizeTable(600);
    expect(column('year')).toBeNull();
    resizeTable(400);
    expect(root.getAttribute('data-layout')).toBe('stacked');
    expect(screen.getByText('3 rows')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sort by' })).toBeTruthy();
    // The first column's cell over the others'.
    expect(row(0).textContent).toBe('SolarisLem204');
    expect(grid().style.getPropertyValue('--data-table-row')).toBe('50px');
  });

  it('draws a stacked row of its own with `renderStackedRow`', () => {
    render(<DataTable rows={books} columns={COLUMNS} layout="stacked" countLabel={(n) => `${n} books`} renderStackedRow={(b) => <DataTableCell col={0}>{b.title} by {b.author}</DataTableCell>} />);
    expect(screen.getByText('3 books')).toBeTruthy();
    expect(row(2).textContent).toBe('A Wizard of Earthsea by Le Guin');
    expect(row(2).querySelector('[role=gridcell]')).toBeTruthy();
  });

  it('dims the rows after the playhead and writes its share for an overlay, with the controller too', () => {
    const controller = createDataTableController();
    render(
      <DataTable
        rows={books}
        columns={COLUMNS}
        controller={controller}
        timeRange={[1950, 1990]}
        rowTime={(b) => b.year}
        playhead={1970}
        overlay={() => <div data-testid="line" />}
      />,
    );
    expect(grid().hasAttribute('data-playhead')).toBe(true);
    expect(grid().style.getPropertyValue('--data-table-playhead')).toBe('0.5');
    expect(row(1).hasAttribute('data-future')).toBe(true);
    expect(row(0).hasAttribute('data-future')).toBe(false);
    expect(document.querySelector('[data-slot=data-table-overlay]')?.getAttribute('aria-hidden')).toBe('true');
    act(() => { controller.setPlayhead(1960); });
    expect(row(2).hasAttribute('data-future')).toBe(true);
    act(() => { controller.setPlayhead(null); });
    expect(grid().hasAttribute('data-playhead')).toBe(false);
  });

  it('takes the density scale', () => {
    const { rerender } = render(<DataTable rows={books} columns={COLUMNS} density="compact" />);
    expect(grid().style.getPropertyValue('--data-table-row')).toBe('26px');
    rerender(<DataTable rows={books} columns={COLUMNS} density="comfortable" />);
    expect(document.querySelector('[data-slot=data-table]')?.getAttribute('data-density')).toBe('comfortable');
  });
});

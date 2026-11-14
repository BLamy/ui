// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SchemaTree } from '@/components/ui/schema-tree';
import type { SchemaColumn, SchemaInfo, SchemaTable } from '@/lib/pglite-schema';

declare global { var __UI_SDK_STRICT__: boolean | undefined }
globalThis.__UI_SDK_STRICT__ = true;

// The rows are virtualized: give the tree a size to lay them out in.
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(400);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(1200);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const col = (name: string, o: Partial<SchemaColumn> = {}): SchemaColumn => ({
  name, type: 'integer', typeOid: 0, nullable: true, default: null, isPrimaryKey: false, references: null, ...o,
});
const table = (schema: string, name: string, columns = [col('id', { isPrimaryKey: true, nullable: false })]): SchemaTable => ({
  schema, name, kind: 'table', comment: null, rowCount: 3, columns,
});
const books = table('public', 'books', [col('id', { isPrimaryKey: true, nullable: false }), col('title', { type: 'text' })]);
const PUBLIC: SchemaInfo = { schemas: [{ name: 'public', tables: [books] }] };
const WITH_AUDIT: SchemaInfo = { schemas: [...PUBLIC.schemas, { name: 'audit', tables: [table('audit', 'log')] }] };

const rows = () => screen.queryAllByRole('treeitem');
const row = (start: string) => rows().find((r) => r.textContent?.startsWith(start)) as HTMLElement;
const label = (start: string) => row(start).querySelector('[data-slot="tree-label"]') as HTMLElement ?? row(start);

describe('SchemaTree', () => {
  it('names its tree, and opens schemas at first', () => {
    render(<SchemaTree schema={PUBLIC} />);
    expect(screen.getByRole('tree', { name: 'Database schema' })).toBeTruthy();
    expect(row('public').getAttribute('aria-expanded')).toBe('true');
    expect(row('books').getAttribute('aria-expanded')).toBe('false');
    expect(row('id')).toBeUndefined();
  });

  it('opens tables too with defaultExpandAll', () => {
    render(<SchemaTree schema={PUBLIC} defaultExpandAll />);
    expect(row('books').getAttribute('aria-expanded')).toBe('true');
    expect(row('title')).toBeTruthy();
  });

  it('calls onAction with the table on a press or Return', () => {
    const onAction = vi.fn();
    render(<SchemaTree schema={PUBLIC} onAction={onAction} />);
    fireEvent.click(label('books'));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction.mock.calls[0]![0]).toBe('table:public.books');
    expect(onAction.mock.calls[0]![1]).toMatchObject({ table: books });
    expect(onAction.mock.calls[0]![1].column).toBeUndefined();
    expect(onAction.mock.calls[0]![1].event?.type).toBe('click');
    row('books').focus();
    fireEvent.keyDown(row('books'), { key: 'Enter' });
    expect(onAction).toHaveBeenCalledTimes(2);
    expect(onAction.mock.calls[1]![1]).toMatchObject({ table: books });
    expect(onAction.mock.calls[1]![1].event?.type).toBe('keydown');
  });

  it('calls onAction with the column for a column, and not for a schema', () => {
    const onAction = vi.fn();
    render(<SchemaTree schema={PUBLIC} defaultExpandAll onAction={onAction} />);
    fireEvent.click(label('title'));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction.mock.calls[0]![0]).toBe('column:public.books.title');
    expect(onAction.mock.calls[0]![1]).toMatchObject({ table: books, column: books.columns[1] });
    fireEvent.click(label('public'));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('is one tab stop, and the arrow keys move, open and close', () => {
    render(<SchemaTree schema={PUBLIC} />);
    expect(rows().map((r) => r.getAttribute('tabindex'))).toEqual(['0', '-1']);
    row('public').focus();
    fireEvent.keyDown(row('public'), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(row('books'));
    fireEvent.keyDown(row('books'), { key: 'ArrowRight' });
    expect(row('books').getAttribute('aria-expanded')).toBe('true');
    fireEvent.keyDown(row('books'), { key: 'ArrowLeft' });
    expect(row('books').getAttribute('aria-expanded')).toBe('false');
  });

  it('opens a schema that appears later, and keeps one the user closed closed', async () => {
    const { rerender } = render(<SchemaTree schema={PUBLIC} />);
    row('public').focus();
    fireEvent.keyDown(row('public'), { key: 'ArrowLeft' });
    expect(row('public').getAttribute('aria-expanded')).toBe('false');
    await act(async () => { rerender(<SchemaTree schema={WITH_AUDIT} />); });
    expect(row('audit').getAttribute('aria-expanded')).toBe('true');
    expect(row('log')).toBeTruthy();
    expect(row('public').getAttribute('aria-expanded')).toBe('false');
    // A schema it has already seen doesn't reopen on a later refresh either.
    await act(async () => { rerender(<SchemaTree schema={{ schemas: [...WITH_AUDIT.schemas] }} />); });
    expect(row('public').getAttribute('aria-expanded')).toBe('false');
  });

  it('is busy while it loads, with a named placeholder, and says when there are no tables', () => {
    const { container, rerender } = render(<SchemaTree schema={null} loading aria-label="DB" />);
    const root = container.querySelector('[data-slot="schema-tree"]') as HTMLElement;
    expect(root.getAttribute('aria-busy')).toBe('true');
    expect(screen.getByRole('group', { name: 'DB loading' })).toBeTruthy();
    rerender(<SchemaTree schema={{ schemas: [] }} aria-label="DB" />);
    expect(root.hasAttribute('aria-busy')).toBe(false);
    expect(screen.getByText('No tables yet')).toBeTruthy();
  });
});

// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Tree, type TreeNodeActionDetails } from '@/components/ui/tree';
import { schemaTreeItems, type SchemaColumn, type SchemaInfo, type SchemaTable, type SchemaTreeNode } from '@/lib/pglite-schema';

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

/** The SQL console's schema tree: schemas open as they appear, tables closed. */
function SchemaBrowser({ schema, loading, onAction, all }: {
  schema: SchemaInfo | null; loading?: boolean; all?: boolean; onAction?: (value: string, details: TreeNodeActionDetails) => void;
}) {
  const items = schemaTreeItems(schema);
  return (
    <Tree aria-label="Database schema" items={items} icons={false} density="compact" loading={loading} emptyState="No tables yet"
      defaultExpanded={all ? 'all' : undefined} autoExpand={items.map((n) => n.value)} onAction={onAction} />
  );
}

describe('schemaTreeItems', () => {
  it('maps schemas, tables and columns, with what each row stands for', () => {
    const [schema] = schemaTreeItems(PUBLIC);
    expect(schema).toMatchObject({ value: 'schema:public', kind: 'schema', label: 'public', trailing: '1' });
    const [tableNode] = schema!.children!;
    expect(tableNode).toMatchObject({ value: 'table:public.books', kind: 'table', table: books, trailing: '3', description: '3 rows' });
    const [id, title] = tableNode!.children!;
    expect(id).toMatchObject({ value: 'column:public.books.id', kind: 'column', column: books.columns[0], icon: 'key', trailing: 'integer not null' });
    expect(title).toMatchObject({ kind: 'column', trailing: 'text' });
    expect(title!.icon).toBeUndefined();
  });

  it('gives the same items for the same schema, and none while it loads', () => {
    expect(schemaTreeItems(PUBLIC)).toBe(schemaTreeItems(PUBLIC));
    expect(schemaTreeItems(null)).toEqual([]);
  });

  it('spells out a foreign key and a view', () => {
    const view = { ...table('public', 'recent'), kind: 'view' as const, rowCount: null };
    const ref = col('author_id', { references: { schema: 'public', table: 'authors', column: 'id' } });
    const [schema] = schemaTreeItems({ schemas: [{ name: 'public', tables: [view, { ...books, columns: [ref] }] }] });
    expect(schema!.children![0]!.trailing).toBe('view');
    expect(schema!.children![1]!.children![0]).toMatchObject({ trailing: '→ authors.id integer', description: 'References public.authors(id)' });
  });
});

describe('Tree of a database schema', () => {
  it('names its tree, and opens schemas at first', () => {
    render(<SchemaBrowser schema={PUBLIC} />);
    expect(screen.getByRole('tree', { name: 'Database schema' })).toBeTruthy();
    expect(row('public').getAttribute('aria-expanded')).toBe('true');
    expect(row('books').getAttribute('aria-expanded')).toBe('false');
    expect(row('id')).toBeUndefined();
  });

  it('opens tables too with defaultExpanded="all"', () => {
    render(<SchemaBrowser schema={PUBLIC} all />);
    expect(row('books').getAttribute('aria-expanded')).toBe('true');
    expect(row('title')).toBeTruthy();
  });

  it('runs onAction with the table\'s node on a press or Return', () => {
    const onAction = vi.fn();
    render(<SchemaBrowser schema={PUBLIC} onAction={onAction} />);
    fireEvent.click(label('books'));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction.mock.calls[0]![0]).toBe('table:public.books');
    const node = onAction.mock.calls[0]![1].node as SchemaTreeNode;
    expect(node.kind === 'table' && node.table).toBe(books);
    expect(onAction.mock.calls[0]![1].event?.type).toBe('click');
    row('books').focus();
    fireEvent.keyDown(row('books'), { key: 'Enter' });
    expect(onAction).toHaveBeenCalledTimes(2);
    expect(onAction.mock.calls[1]![1].node).toBe(node);
    expect(onAction.mock.calls[1]![1].event?.type).toBe('keydown');
  });

  it('gives a column\'s node, with its table and column', () => {
    const onAction = vi.fn();
    render(<SchemaBrowser schema={PUBLIC} all onAction={onAction} />);
    fireEvent.click(label('title'));
    expect(onAction.mock.calls[0]![0]).toBe('column:public.books.title');
    expect(onAction.mock.calls[0]![1].node).toMatchObject({ kind: 'column', table: books, column: books.columns[1] });
  });

  it('is one tab stop, and the arrow keys move, open and close', () => {
    render(<SchemaBrowser schema={PUBLIC} />);
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
    const { rerender } = render(<SchemaBrowser schema={PUBLIC} />);
    row('public').focus();
    fireEvent.keyDown(row('public'), { key: 'ArrowLeft' });
    expect(row('public').getAttribute('aria-expanded')).toBe('false');
    await act(async () => { rerender(<SchemaBrowser schema={WITH_AUDIT} />); });
    expect(row('audit').getAttribute('aria-expanded')).toBe('true');
    expect(row('log')).toBeTruthy();
    expect(row('public').getAttribute('aria-expanded')).toBe('false');
    // A schema it has already seen doesn't reopen on a later refresh either.
    await act(async () => { rerender(<SchemaBrowser schema={{ schemas: [...WITH_AUDIT.schemas] }} />); });
    expect(row('public').getAttribute('aria-expanded')).toBe('false');
  });

  it('is busy while it loads, with a named placeholder, and says when there are no tables', () => {
    const { container, rerender } = render(<SchemaBrowser schema={null} loading />);
    const root = container.querySelector('[data-slot="tree-view"]') as HTMLElement;
    expect(root.getAttribute('aria-busy')).toBe('true');
    expect(screen.getByRole('group', { name: 'Loading Database schema' })).toBeTruthy();
    expect(screen.queryByRole('tree')).toBeNull();
    rerender(<SchemaBrowser schema={{ schemas: [] }} />);
    expect(root.hasAttribute('aria-busy')).toBe(false);
    expect(screen.getByText('No tables yet')).toBeTruthy();
  });
});

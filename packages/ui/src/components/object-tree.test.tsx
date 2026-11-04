// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectTree } from '@/components/ui/object-tree';
import { nodeFromValue, type ObjectTreeNode } from '@/lib/object-tree-model';

// The rows are virtualized: give the tree a size to lay them out in.
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(600);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(1200);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const leaf = (name: string, value = 1): ObjectTreeNode => ({ id: name, name, value: { type: 'number', value } });
const branch = (name: string, extra: Partial<ObjectTreeNode> = {}): ObjectTreeNode => ({ id: name, name, value: { type: 'object', className: 'Thing' }, hasChildren: true, ...extra });

const rowText = () => screen.getAllByRole('row').map((r) => r.textContent ?? '');
const row = (start: string) => screen.getAllByRole('row').find((r) => r.textContent?.startsWith(start)) as HTMLElement;
const chevron = (start: string) => row(start).querySelector('[slot="chevron"]') as HTMLElement;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

describe('ObjectTree', () => {
  it('marks its parts, so a host can find them', () => {
    render(<ObjectTree aria-label="T" root={[{ id: 's', name: 'Local', section: true, children: [leaf('a')] }]} />);
    expect(row('Local').getAttribute('data-slot')).toBe('object-tree-row');
    expect(row('Local').getAttribute('data-kind')).toBe('section');
    expect(row('a').getAttribute('data-kind')).toBe('node');
    expect(row('a').querySelector('[data-slot="object-value"]')?.getAttribute('data-type')).toBe('number');
  });

  it('names itself, and takes a class and style on its root', () => {
    const { container } = render(<ObjectTree aria-label="Scopes" root={[leaf('a')]} className="w-40" style={{ color: 'red' }} data-testid="tree" />);
    const el = container.querySelector('[data-slot="object-tree"]') as HTMLElement;
    expect(el.className).toContain('w-40');
    expect(el.style.color).toBe('red');
    expect(el.getAttribute('data-testid')).toBe('tree');
    expect(screen.getByRole('treegrid', { name: 'Scopes' })).toBeTruthy();
  });

  it('shows a value\'s name and preview, and only openable rows are openable', () => {
    render(<ObjectTree aria-label="T" root={[leaf('a', 7), branch('b')]} />);
    expect(row('a').textContent).toBe('a:7');
    expect(row('a').getAttribute('aria-expanded')).toBeNull();
    expect(row('b').getAttribute('aria-expanded')).toBe('false');
    expect(chevron('b')).toBeTruthy();
  });

  it('takes one node as well as a list, and says when there is nothing', () => {
    const { unmount } = render(<ObjectTree aria-label="T" root={leaf('solo')} />);
    expect(rowText()).toEqual(['solo:1']);
    unmount();
    render(<ObjectTree aria-label="T" root={[]} emptyMessage="No JS here" />);
    expect(screen.getByText('No JS here')).toBeTruthy();
  });

  it('loads children when a row opens, showing Loading until they come', async () => {
    const load = deferred<ObjectTreeNode[]>();
    const loadChildren = vi.fn(() => load.promise);
    render(<ObjectTree aria-label="T" root={[branch('a')]} loadChildren={loadChildren} />);
    expect(loadChildren).not.toHaveBeenCalled();
    fireEvent.click(chevron('a'));
    expect(row('a').getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('Loading…')).toBeTruthy();
    expect(loadChildren).toHaveBeenCalledTimes(1);
    expect(loadChildren.mock.calls[0]![0 as never]).toMatchObject({ id: 'a' });
    await act(async () => { load.resolve([leaf('kid')]); });
    expect(screen.queryByText('Loading…')).toBeNull();
    expect(row('kid').getAttribute('aria-level')).toBe('2');
  });

  it('keeps what it loaded when a row closes and opens', async () => {
    const loadChildren = vi.fn(async () => [leaf('kid')]);
    render(<ObjectTree aria-label="T" root={[branch('a')]} loadChildren={loadChildren} />);
    fireEvent.click(chevron('a'));
    await waitFor(() => expect(row('kid')).toBeTruthy());
    fireEvent.click(chevron('a'));
    await waitFor(() => expect(row('kid')).toBeUndefined());
    fireEvent.click(chevron('a'));
    expect(row('kid')).toBeTruthy();
    expect(screen.queryByText('Loading…')).toBeNull();
    expect(loadChildren).toHaveBeenCalledTimes(1);
  });

  it('never shows Loading for a loader that answers at once', () => {
    const loadChildren = vi.fn(() => [leaf('kid')]);
    render(<ObjectTree aria-label="T" root={[branch('a', { defaultExpanded: true })]} loadChildren={loadChildren} />);
    expect(screen.queryByText('Loading…')).toBeNull();
    expect(row('kid')).toBeTruthy();
    expect(loadChildren).toHaveBeenCalledTimes(1);
  });

  it('shows a failure on its node, and retries', async () => {
    const loadChildren = vi.fn<(n: ObjectTreeNode) => Promise<ObjectTreeNode[]>>()
      .mockRejectedValueOnce(new Error('The engine has no object 8'))
      .mockResolvedValueOnce([leaf('kid')]);
    render(<ObjectTree aria-label="T" root={[branch('a', { defaultExpanded: true }), leaf('z')]} loadChildren={loadChildren} />);
    await screen.findByText('The engine has no object 8');
    expect(row('z')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(row('kid')).toBeTruthy());
    expect(screen.queryByText('The engine has no object 8')).toBeNull();
    expect(loadChildren).toHaveBeenCalledTimes(2);
  });

  it('copes with a loader that throws', async () => {
    render(<ObjectTree aria-label="T" root={[branch('a', { defaultExpanded: true })]} loadChildren={() => { throw new Error('at once'); }} />);
    await screen.findByText('at once');
  });

  it('drops an answer when root changes, and keeps open rows open', async () => {
    const first = deferred<ObjectTreeNode[]>();
    const second = deferred<ObjectTreeNode[]>();
    const answers = [first, second];
    const loadChildren = vi.fn(() => answers[loadChildren.mock.calls.length - 1]!.promise);
    const rootA = [branch('a')];
    const rootB = [branch('a', { data: 2 })];
    const { rerender } = render(<ObjectTree aria-label="T" root={rootA} loadChildren={loadChildren} />);
    fireEvent.click(chevron('a'));
    expect(loadChildren).toHaveBeenCalledTimes(1);
    rerender(<ObjectTree aria-label="T" root={rootB} loadChildren={loadChildren} />);
    expect(row('a').getAttribute('aria-expanded')).toBe('true');
    expect(loadChildren).toHaveBeenCalledTimes(2);
    expect(loadChildren.mock.calls[1]![0 as never]).toMatchObject({ data: 2 });
    await act(async () => { first.resolve([leaf('old')]); });
    expect(row('old')).toBeUndefined();
    expect(screen.getByText('Loading…')).toBeTruthy();
    await act(async () => { second.resolve([leaf('new')]); });
    expect(row('new')).toBeTruthy();
    expect(row('old')).toBeUndefined();
  });

  it('takes the newest root while new ones keep coming, skipping those between', async () => {
    const loadChildren = vi.fn((node: ObjectTreeNode) => [leaf('kid', node.data as number)]);
    const roots = Array.from({ length: 30 }, (_, step) => [branch('a', { defaultExpanded: true, data: step })]);
    const { rerender } = render(<ObjectTree aria-label="T" root={roots[0]!} loadChildren={loadChildren} />);
    for (const root of roots.slice(1)) rerender(<ObjectTree aria-label="T" root={root} loadChildren={loadChildren} />);
    await waitFor(() => expect(row('kid').textContent).toBe('kid:29'));
    expect(loadChildren.mock.calls.length).toBeLessThan(10);
  });

  it('keeps the last children, faded, while a new root\'s load', async () => {
    const second = deferred<ObjectTreeNode[]>();
    const answers: Promise<ObjectTreeNode[]>[] = [Promise.resolve([leaf('kid', 1)]), second.promise];
    let call = 0;
    const loadChildren = () => answers[call++]!;
    const { rerender } = render(<ObjectTree aria-label="T" root={[branch('a', { defaultExpanded: true })]} loadChildren={loadChildren} />);
    await waitFor(() => expect(row('kid')).toBeTruthy());
    rerender(<ObjectTree aria-label="T" root={[branch('a', { defaultExpanded: true })]} loadChildren={loadChildren} />);
    expect(row('kid').className).toContain('opacity-60');
    expect(screen.queryByText('Loading…')).toBeNull();
    await act(async () => { second.resolve([leaf('kid', 2)]); });
    expect(row('kid').textContent).toBe('kid:2');
    expect(row('kid').className).not.toContain('opacity-60');
  });

  it('calls a getter on press and shows what comes back', async () => {
    const answer = deferred<{ value: { type: 'string'; value: string } }>();
    const onInvokeGetter = vi.fn(() => answer.promise);
    render(<ObjectTree aria-label="T" root={[{ id: 'g', name: 'g', value: { type: 'accessor' } }]} onInvokeGetter={onInvokeGetter} />);
    expect(row('g').textContent).toBe('g:(...)');
    fireEvent.click(screen.getByRole('button', { name: 'Call the getter g' }));
    expect(onInvokeGetter).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Call the getter g' })).toBeNull();
    await act(async () => { answer.resolve({ value: { type: 'string', value: 'got it' } }); });
    expect(row('g').textContent).toContain('"got it"');
  });

  it('lets a getter fail, and try again', async () => {
    const onInvokeGetter = vi.fn(async () => ({ value: { type: 'number' as const, value: 3 } }));
    onInvokeGetter.mockRejectedValueOnce(new Error('threw'));
    render(<ObjectTree aria-label="T" root={[{ id: 'g', name: 'g', value: { type: 'accessor' } }]} onInvokeGetter={onInvokeGetter} />);
    fireEvent.click(screen.getByRole('button', { name: 'Call the getter g' }));
    await screen.findByText('threw');
    fireEvent.click(screen.getByRole('button', { name: 'Call the getter g' }));
    await waitFor(() => expect(row('g').textContent).toBe('g:3'));
  });

  it('leaves (...) disabled when nothing can call it', () => {
    render(<ObjectTree aria-label="T" root={[{ id: 'g', name: 'g', value: { type: 'accessor' } }]} />);
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Call the getter g' }).disabled).toBe(true);
  });

  it('drops a getter\'s answer when root changes', async () => {
    const answer = deferred<{ value: { type: 'number'; value: number } }>();
    const node: ObjectTreeNode = { id: 'g', name: 'g', value: { type: 'accessor' } };
    const { rerender } = render(<ObjectTree aria-label="T" root={[node]} onInvokeGetter={() => answer.promise} />);
    fireEvent.click(screen.getByRole('button', { name: 'Call the getter g' }));
    rerender(<ObjectTree aria-label="T" root={[{ ...node }]} onInvokeGetter={() => answer.promise} />);
    await act(async () => { answer.resolve({ value: { type: 'number', value: 3 } }); });
    expect(row('g').textContent).toBe('g:(...)');
  });

  it('opens sections by default, and a section can start closed', () => {
    render(
      <ObjectTree
        aria-label="T"
        root={[
          { id: 'local', name: 'Local', section: true, children: [leaf('x')] },
          { id: 'global', name: 'Global', section: true, defaultExpanded: false, children: [leaf('window')] },
        ]}
      />,
    );
    expect(rowText()).toEqual(['Local', 'x:1', 'Global']);
    fireEvent.click(chevron('Global'));
    expect(row('window')).toBeTruthy();
    fireEvent.click(chevron('Local'));
    expect(row('x')).toBeUndefined();
  });

  it('groups a large array in ranges and only draws what fits', async () => {
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(480);
    const many = Array.from({ length: 100_000 }, (_, i) => leaf(String(i), i));
    render(<ObjectTree aria-label="T" root={[branch('list', { defaultExpanded: true, children: many })]} />);
    expect(rowText().slice(0, 3)).toEqual(['list:Thing', '[0 … 9999]', '[10000 … 19999]']);
    fireEvent.click(chevron('[0 … 9999]'));
    fireEvent.click(chevron('[0 … 99]'));
    expect(row('0:')).toBeTruthy();
    expect(screen.getAllByRole('row').length).toBeLessThan(60);
  });

  it('takes any JSON-like value with no loader', async () => {
    render(<ObjectTree aria-label="T" root={nodeFromValue({ a: 1, list: [true] }, { defaultExpanded: true })} />);
    expect(row('a')).toBeTruthy();
    fireEvent.click(chevron('list'));
    expect(row('0').textContent).toBe('0:true');
    expect(row('length').textContent).toBe('length:1');
  });

  it('calls a live value\'s getter by itself', async () => {
    render(<ObjectTree aria-label="T" root={nodeFromValue({ get computed() { return 42; } }, { defaultExpanded: true })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Call the getter computed' }));
    await waitFor(() => expect(row('computed').textContent).toBe('computed:42'));
  });

  it('hears about selection only when asked, and only for values', () => {
    const onSelect = vi.fn();
    render(<ObjectTree aria-label="T" root={[{ id: 's', name: 'Local', section: true, children: [leaf('x')] }]} onSelect={onSelect} />);
    fireEvent.click(row('x'));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0]![0]).toMatchObject({ id: 'x' });
    expect(row('x').getAttribute('aria-selected')).toBe('true');
    fireEvent.click(row('Local'));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(row('Local').getAttribute('aria-expanded')).toBe('false');
  });

  it('copies the focused value with the keyboard', async () => {
    const writeText = vi.fn(async () => {});
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    render(<ObjectTree aria-label="T" root={[{ id: 's', name: 's', value: { type: 'string', value: 'a"b' } }]} />);
    const target = row('s');
    target.focus();
    await act(async () => { fireEvent.keyDown(target, { key: 'c', metaKey: true }); });
    expect(writeText).toHaveBeenCalledWith('a"b');
  });

  it('leaves copying to the browser when text is selected', async () => {
    const writeText = vi.fn(async () => {});
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    vi.spyOn(window, 'getSelection').mockReturnValue({ isCollapsed: false } as Selection);
    render(<ObjectTree aria-label="T" root={[leaf('s')]} />);
    await act(async () => { fireEvent.keyDown(row('s'), { key: 'c', metaKey: true }); });
    expect(writeText).not.toHaveBeenCalled();
  });

  it('copies with your own text', async () => {
    const writeText = vi.fn(async () => {});
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    render(<ObjectTree aria-label="T" root={[leaf('s')]} copyValue={async (node) => `from ${node.name}`} />);
    await act(async () => { fireEvent.keyDown(row('s'), { key: 'c', ctrlKey: true }); });
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('from s'));
  });

  it('makes a duplicate id in another parent its own row', async () => {
    const shared = branch('same');
    const loadChildren = vi.fn(async () => [leaf('inner')]);
    render(
      <ObjectTree
        aria-label="T"
        loadChildren={loadChildren}
        root={[branch('p', { defaultExpanded: true, children: [shared] }), branch('q', { defaultExpanded: true, children: [shared] })]}
      />,
    );
    const both = screen.getAllByRole('row').filter((r) => r.textContent?.startsWith('same'));
    expect(both).toHaveLength(2);
    fireEvent.click(both[1]!.querySelector('[slot="chevron"]') as HTMLElement);
    await waitFor(() => expect(row('inner')).toBeTruthy());
    expect(rowText().map((t) => t.split(':')[0])).toEqual(['p', 'same', 'q', 'same', 'inner']);
  });
});

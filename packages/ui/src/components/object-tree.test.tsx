// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectTree } from '@/components/ui/object-tree';
import { nodeFromValue, objectTreeKey, type ObjectTreeNode } from '@/lib/object-tree-model';

declare global { var __UI_SDK_STRICT__: boolean | undefined }
globalThis.__UI_SDK_STRICT__ = true;

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

const rows = () => screen.queryAllByRole('treeitem');
const rowText = () => rows().map((r) => r.textContent ?? '');
const row = (start: string) => rows().find((r) => r.textContent?.startsWith(start)) as HTMLElement;
const label = (start: string) => row(start).querySelector('[data-slot="tree-label"]') as HTMLElement;
const chevron = (start: string) => row(start).querySelector('[data-slot="tree-indicator"]') as HTMLElement;
const focused = () => document.activeElement?.textContent ?? '';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

/** What UI SDK's polite live region says once its announcements have settled. */
const announced = async () => {
  await act(async () => { await new Promise((r) => setTimeout(r, 450)); });
  return (document.querySelector('[data-ui-sdk-announcer=""]')?.textContent ?? '').trim();
};

describe('ObjectTree', () => {
  it('marks its parts, so a host can find them', () => {
    render(<ObjectTree aria-label="T" root={[{ id: 's', name: 'Local', section: true, children: [leaf('a')] }]} />);
    expect(row('Local').getAttribute('data-slot')).toBe('tree-item');
    expect(label('Local').getAttribute('data-kind')).toBe('section');
    expect(label('a').getAttribute('data-kind')).toBe('node');
    expect(row('a').querySelector('[data-slot="object-value"]')?.getAttribute('data-type')).toBe('number');
  });

  it('names itself, and takes a class and style on its root', () => {
    const { container } = render(<ObjectTree aria-label="Scopes" root={[leaf('a')]} className="w-40" style={{ color: 'red' }} data-testid="tree" />);
    const el = container.querySelector('[data-slot="object-tree"]') as HTMLElement;
    expect(el.className).toContain('w-40');
    expect(el.style.color).toBe('red');
    expect(el.getAttribute('data-testid')).toBe('tree');
    expect(screen.getByRole('tree', { name: 'Scopes' })).toBeTruthy();
  });

  it('shows a value\'s name and preview, and only openable rows are openable', () => {
    render(<ObjectTree aria-label="T" root={[leaf('a', 7), branch('b')]} />);
    expect(row('a').textContent).toBe('a:7');
    expect(row('a').getAttribute('aria-expanded')).toBeNull();
    expect(row('b').getAttribute('aria-expanded')).toBe('false');
    expect(chevron('b')).toBeTruthy();
  });

  it('caps a row\'s indent at a quarter of the row, over Tree\'s own logical indent', () => {
    render(<ObjectTree aria-label="T" root={[leaf('a', 7)]} />);
    const classes = label('a').className.split(/\s+/);
    // One inline-start padding wins: the capped one. A physical padding would sit beside it and win in the stylesheet.
    expect(classes.filter((c) => /^(ps|pl)-/.test(c))).toEqual(['ps-[min(calc(var(--tree-pad-x)+(var(--tree-level,1)-1)*var(--tree-indent)),25%)]']);
  });

  it('takes one node as well as a list, and says when there is nothing', () => {
    const { unmount } = render(<ObjectTree aria-label="T" root={leaf('solo')} />);
    expect(rowText()).toEqual(['solo:1']);
    unmount();
    render(<ObjectTree aria-label="T" root={[]} emptyState="No JS here" />);
    expect(screen.getByText('No JS here')).toBeTruthy();
  });

  it('is named "Values" by default, and takes Tree\'s densities', () => {
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(240);
    render(<ObjectTree root={Array.from({ length: 90 }, (_, i) => leaf(`n${i}`, i))} density="comfortable" />);
    expect(screen.getByRole('tree', { name: 'Values' })).toBeTruthy();
    expect(screen.getByRole('tree').style.height).toBe(`${90 * 36}px`);
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
    expect(label('kid').hasAttribute('data-stale')).toBe(true);
    expect(screen.queryByText('Loading…')).toBeNull();
    await act(async () => { second.resolve([leaf('kid', 2)]); });
    expect(row('kid').textContent).toBe('kid:2');
    expect(label('kid').hasAttribute('data-stale')).toBe(false);
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
    expect(rows().length).toBeLessThan(60);
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
    render(<ObjectTree aria-label="T" root={[{ id: 's', name: 'Local', section: true, children: [leaf('x'), branch('b', { children: [leaf('kid')] })] }]} onValueChange={onSelect} />);
    expect(row('x').getAttribute('aria-selected')).toBe('false');
    fireEvent.click(row('x'));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0]![0]).toBe(objectTreeKey(['s', 'x']));
    expect(onSelect.mock.calls[0]![1]).toMatchObject({ reason: 'item-press', node: { id: 'x' } });
    expect(row('x').getAttribute('aria-selected')).toBe('true');
    // A press on a value that can open selects it and no more: a double press or Return opens it.
    fireEvent.click(row('b'));
    expect(onSelect).toHaveBeenCalledTimes(2);
    expect(row('b').getAttribute('aria-expanded')).toBe('false');
    fireEvent.doubleClick(label('b'));
    expect(row('b').getAttribute('aria-expanded')).toBe('true');
    fireEvent.keyDown(row('b'), { key: 'Enter' });
    expect(row('b').getAttribute('aria-expanded')).toBe('false');
    // A section is never selected: a press opens and closes it.
    fireEvent.click(row('Local'));
    expect(onSelect).toHaveBeenCalledTimes(2);
    expect(row('Local').getAttribute('aria-selected')).toBe('false');
    expect(row('Local').getAttribute('aria-expanded')).toBe('false');
  });

  it('has no selection unless asked, and a press opens a row', () => {
    render(<ObjectTree aria-label="T" root={[branch('b', { children: [leaf('kid')] })]} />);
    expect(row('b').hasAttribute('aria-selected')).toBe(false);
    fireEvent.click(row('b'));
    expect(row('b').getAttribute('aria-expanded')).toBe('true');
    expect(row('kid')).toBeTruthy();
    fireEvent.click(row('b'));
    expect(row('b').getAttribute('aria-expanded')).toBe('false');
  });

  it('is one tab stop, and the arrow keys move, open and close', async () => {
    const loadChildren = vi.fn(async () => [leaf('kid')]);
    render(<ObjectTree aria-label="T" root={[leaf('a'), branch('b'), leaf('c')]} loadChildren={loadChildren} />);
    expect(rows().map((r) => r.getAttribute('tabindex'))).toEqual(['0', '-1', '-1']);
    row('a').focus();
    fireEvent.keyDown(row('a'), { key: 'ArrowDown' });
    expect(focused()).toBe('b:Thing');
    // Right opens a closed row, then steps into it; Left steps back out, then closes it.
    fireEvent.keyDown(row('b'), { key: 'ArrowRight' });
    expect(row('b').getAttribute('aria-expanded')).toBe('true');
    await waitFor(() => expect(row('kid')).toBeTruthy());
    expect(row('kid').getAttribute('aria-level')).toBe('2');
    fireEvent.keyDown(row('b'), { key: 'ArrowRight' });
    expect(focused()).toBe('kid:1');
    fireEvent.keyDown(row('kid'), { key: 'ArrowLeft' });
    expect(focused()).toBe('b:Thing');
    fireEvent.keyDown(row('b'), { key: 'ArrowLeft' });
    expect(row('b').getAttribute('aria-expanded')).toBe('false');
    fireEvent.keyDown(row('b'), { key: 'End' });
    expect(focused()).toBe('c:1');
    fireEvent.keyDown(row('c'), { key: 'Home' });
    expect(focused()).toBe('a:1');
    // Typing finds the next row that starts with it.
    fireEvent.keyDown(row('a'), { key: 'c' });
    expect(focused()).toBe('c:1');
  });

  it('reaches a row that is not in the DOM with the keyboard', async () => {
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(240);
    const many = Array.from({ length: 90 }, (_, i) => leaf(`n${i}`, i));
    render(<ObjectTree aria-label="T" root={many} />);
    expect(row('n89')).toBeUndefined();
    row('n0').focus();
    fireEvent.keyDown(row('n0'), { key: 'End' });
    const scroller = screen.getByRole('tree').parentElement as HTMLElement;
    expect(scroller.scrollTop).toBe(90 * 24 - 240);
    await act(async () => { fireEvent.scroll(scroller); });
    expect(focused()).toBe('n89:89');
    expect(row('n89').getAttribute('aria-posinset')).toBe('90');
    expect(row('n89').getAttribute('aria-setsize')).toBe('90');
    // Scrolled away, the row with focus stays in the DOM, so focus doesn't drop to the page.
    scroller.scrollTop = 0;
    await act(async () => { fireEvent.scroll(scroller); });
    expect(row('n40:')).toBeUndefined();
    expect(focused()).toBe('n89:89');
  });

  it('keeps a row\'s own buttons from pressing the row', async () => {
    const onSelect = vi.fn();
    const writeText = vi.fn(async () => {});
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    render(<ObjectTree aria-label="T" root={[leaf('s', 5)]} onValueChange={onSelect} />);
    const copy = screen.getByRole('button', { name: 'Copy the value', hidden: true });
    expect(copy.getAttribute('tabindex')).toBe('-1');
    await act(async () => { fireEvent.click(copy); });
    expect(writeText).toHaveBeenCalledWith('5');
    expect(onSelect).not.toHaveBeenCalled();
    expect(await screen.findByRole('button', { name: 'Copied', hidden: true })).toBeTruthy();
    // For the pointer only: out of the focused row's name.
    expect(copy.closest('[aria-hidden=true]')).not.toBeNull();
    expect(await announced()).toBe('Copied');
    // No live region of its own: UI SDK's shared announcer says it.
    expect(document.querySelector('[data-slot="object-tree"] [role="status"]')).toBeNull();
  });

  it('is controlled by value, and onValueChange can refuse a change', () => {
    const root = [leaf('a'), leaf('b')];
    const onValueChange = vi.fn((_key: string | null, details: { cancel: () => void; node: ObjectTreeNode | null }) => {
      if (details.node?.id === 'b') details.cancel();
    });
    const { rerender } = render(<ObjectTree aria-label="T" root={root} value="a" onValueChange={onValueChange} />);
    expect(row('a').getAttribute('aria-selected')).toBe('true');
    // Controlled: a press asks, and the owner decides.
    fireEvent.click(row('b'));
    expect(onValueChange).toHaveBeenLastCalledWith('b', expect.objectContaining({ reason: 'item-press' }));
    expect(row('a').getAttribute('aria-selected')).toBe('true');
    rerender(<ObjectTree aria-label="T" root={root} value="b" onValueChange={onValueChange} />);
    expect(row('b').getAttribute('aria-selected')).toBe('true');
    rerender(<ObjectTree aria-label="T" root={root} value={null} onValueChange={onValueChange} />);
    expect(rows().some((r) => r.getAttribute('aria-selected') === 'true')).toBe(false);
  });

  it('remembers its own selection from defaultValue, and a canceled change keeps it', () => {
    const root = [leaf('a'), leaf('b'), leaf('c')];
    render(<ObjectTree aria-label="T" root={root} defaultValue="a" onValueChange={(key, details) => { if (key === 'c') details.cancel(); }} />);
    expect(row('a').getAttribute('aria-selected')).toBe('true');
    fireEvent.click(row('b'));
    expect(row('b').getAttribute('aria-selected')).toBe('true');
    fireEvent.click(row('c'));
    expect(row('b').getAttribute('aria-selected')).toBe('true');
    expect(row('c').getAttribute('aria-selected')).toBe('false');
  });

  it('does not take the end of a drag that selected text in a row as a press', () => {
    render(<ObjectTree aria-label="T" root={[branch('b', { children: [leaf('kid')] })]} />);
    const text = label('b');
    vi.spyOn(window, 'getSelection').mockReturnValue({ isCollapsed: false, anchorNode: text.firstChild ?? text } as unknown as Selection);
    fireEvent.click(text);
    expect(row('b').getAttribute('aria-expanded')).toBe('false');
    vi.restoreAllMocks();
    fireEvent.click(label('b'));
    expect(row('b').getAttribute('aria-expanded')).toBe('true');
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

  it('shows the whole of a long value in a popover', async () => {
    const long = 'x'.repeat(60);
    render(<ObjectTree aria-label="T" root={[{ id: 's', name: 's', value: { type: 'string', value: long } }]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Show the whole value', hidden: true }));
    const dialog = await screen.findByRole('dialog', { name: 'The value of s' });
    expect(dialog.textContent).toContain(long);
    expect(row('s').hasAttribute('aria-selected')).toBe(false);
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
    const both = rows().filter((r) => r.textContent?.startsWith('same'));
    expect(both).toHaveLength(2);
    fireEvent.click(both[1]!.querySelector('[data-slot="tree-indicator"]') as HTMLElement);
    await waitFor(() => expect(row('inner')).toBeTruthy());
    expect(rowText().map((t) => t.split(':')[0])).toEqual(['p', 'same', 'q', 'same', 'inner']);
  });
});

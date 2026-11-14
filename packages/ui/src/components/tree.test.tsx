// @vitest-environment happy-dom
import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAgent } from '@ui-sdk/react/agent';
import { DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import {
  Tree, TreeGroup, TreeItem, TreeItemIndicator, TreeItemLabel, createTreeController, type TreeEditDetails, type TreeEditingChangeDetails, type TreeNode,
} from '@/components/ui/tree';

declare global { var __UI_SDK_STRICT__: boolean | undefined }
globalThis.__UI_SDK_STRICT__ = true;

// The rows are virtualized: give the tree a size to lay them out in.
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(320);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const FILES: TreeNode[] = [
  { value: 'src', label: 'src', children: [
    { value: 'src/lib', label: 'lib', children: [{ value: 'src/lib/utils.ts', label: 'utils.ts' }] },
    { value: 'src/app.tsx', label: 'app.tsx', detail: '2 KB', detailTitle: '2,048 bytes' },
    { value: 'src/Button.tsx', label: 'Button.tsx' },
  ] },
  { value: 'README.md', label: 'README.md' },
  { value: 'docs', label: 'docs', children: [] },
];

const rows = () => screen.queryAllByRole('treeitem');
const names = () => rows().map((r) => r.getAttribute('data-key'));
const row = (value: string) => rows().find((r) => r.getAttribute('data-key') === value) as HTMLElement;
const focused = () => document.activeElement?.getAttribute('data-key');
const tick = () => act(async () => { await new Promise((resolve) => { setTimeout(resolve, 30); }); });

describe('Tree, drawn from its data', () => {
  it('is a named tree with one tab stop, and takes a class and style on its root', () => {
    const { container } = render(<Tree aria-label="Files" items={FILES} className="h-96" style={{ color: 'red' }} data-testid="files" />);
    const root = container.querySelector('[data-slot="tree-view"]') as HTMLElement;
    expect(root.className).toContain('h-96');
    expect(root.style.color).toBe('red');
    expect(root.getAttribute('data-testid')).toBe('files');
    expect(screen.getByRole('tree', { name: 'Files' })).toBeTruthy();
    expect(names()).toEqual(['src', 'README.md', 'docs']);
    expect(rows().filter((r) => r.getAttribute('tabindex') === '0')).toHaveLength(1);
    expect(row('src').getAttribute('aria-expanded')).toBe('false');
    expect(row('docs').getAttribute('aria-expanded')).toBe('false');
    expect(row('README.md').hasAttribute('aria-expanded')).toBe(false);
  });

  it('opens, closes and moves with the arrow keys, and finds a row by typing', () => {
    const onExpandedChange = vi.fn();
    render(<Tree aria-label="Files" items={FILES} onExpandedChange={onExpandedChange} />);
    row('src').focus();
    fireEvent.keyDown(row('src'), { key: 'ArrowRight' });
    expect(onExpandedChange).toHaveBeenLastCalledWith(['src'], expect.objectContaining({ reason: 'list-navigation' }));
    expect(names()).toEqual(['src', 'src/lib', 'src/app.tsx', 'src/Button.tsx', 'README.md', 'docs']);
    expect(row('src/lib').getAttribute('aria-level')).toBe('2');
    expect(row('src/app.tsx').getAttribute('aria-posinset')).toBe('2');
    fireEvent.keyDown(row('src'), { key: 'ArrowRight' });
    expect(focused()).toBe('src/lib');
    fireEvent.keyDown(row('src/lib'), { key: 'ArrowDown' });
    expect(focused()).toBe('src/app.tsx');
    fireEvent.keyDown(row('src/app.tsx'), { key: 'End' });
    expect(focused()).toBe('docs');
    fireEvent.keyDown(row('docs'), { key: 'r' });
    expect(focused()).toBe('README.md');
    fireEvent.keyDown(row('README.md'), { key: 'Home' });
    fireEvent.keyDown(row('src'), { key: 'ArrowLeft' });
    expect(names()).toEqual(['src', 'README.md', 'docs']);
  });

  it('selects one row, and reports why', () => {
    const onValueChange = vi.fn();
    const onAction = vi.fn();
    render(<Tree aria-label="Files" items={FILES} defaultExpanded={['src']} onValueChange={onValueChange} onAction={onAction} />);
    fireEvent.click(row('src/app.tsx'));
    expect(onValueChange).toHaveBeenLastCalledWith('src/app.tsx', expect.objectContaining({ reason: 'item-press' }));
    expect(row('src/app.tsx').getAttribute('aria-selected')).toBe('true');
    expect(onAction).toHaveBeenLastCalledWith('src/app.tsx', expect.anything());
    row('README.md').focus();
    fireEvent.keyDown(row('README.md'), { key: 'Enter' });
    expect(onAction).toHaveBeenLastCalledWith('README.md', expect.anything());
    fireEvent.click(row('README.md'));
    expect(rows().filter((r) => r.getAttribute('aria-selected') === 'true').map((r) => r.getAttribute('data-key'))).toEqual(['README.md']);
  });

  it('runs onAction on a double press only with actionOn="double-press"; a single press still selects, Return still acts', () => {
    const onValueChange = vi.fn();
    const onAction = vi.fn();
    render(<Tree aria-label="Files" items={FILES} defaultExpanded={['src']} actionOn="double-press" onValueChange={onValueChange} onAction={onAction} />);
    fireEvent.click(row('src/app.tsx'), { detail: 1 });
    expect(onValueChange).toHaveBeenLastCalledWith('src/app.tsx', expect.objectContaining({ reason: 'item-press' }));
    expect(onAction).not.toHaveBeenCalled();
    fireEvent.click(row('src/app.tsx'), { detail: 2 });
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenLastCalledWith('src/app.tsx', expect.objectContaining({ event: expect.objectContaining({ type: 'click' }) }));
    fireEvent.keyDown(row('src/app.tsx'), { key: 'ArrowDown' });
    expect(onAction).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(row('src/Button.tsx'), { key: 'Enter' });
    expect(onAction).toHaveBeenLastCalledWith('src/Button.tsx', expect.anything());
  });

  it('acts on the row a press started on, even when a search reshapes the rows under it', async () => {
    const onAction = vi.fn();
    render(<Tree aria-label="Files" items={FILES} defaultExpanded="all" search onAction={onAction} />);
    const pressed = row('src/Button.tsx');
    fireEvent.pointerDown(pressed);
    // The search drops rows above it: a different row now sits where the press began.
    fireEvent.input(screen.getByRole('searchbox', { name: 'Search Files' }), { target: { value: 'Button' } });
    await tick();
    expect(names()).toEqual(['src', 'src/Button.tsx']);
    fireEvent.pointerUp(pressed);
    fireEvent.click(pressed);
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenLastCalledWith('src/Button.tsx', expect.anything());
  });

  it('selects several rows with mode="multiple", and none with mode="none"', () => {
    const onValueChange = vi.fn();
    const { unmount } = render(<Tree aria-label="Files" items={FILES} mode="multiple" defaultExpanded="all" onValueChange={onValueChange} />);
    expect(screen.getByRole('tree').getAttribute('aria-multiselectable')).toBe('true');
    fireEvent.click(row('src/app.tsx'));
    fireEvent.click(row('README.md'), { metaKey: true });
    expect(onValueChange).toHaveBeenLastCalledWith(['src/app.tsx', 'README.md'], expect.anything());
    unmount();
    render(<Tree aria-label="Files" items={FILES} mode="none" />);
    expect(row('README.md').hasAttribute('aria-selected')).toBe(false);
  });

  it('starts with every folder open, or with the ones asked for and those above them', () => {
    const { unmount } = render(<Tree aria-label="Files" items={FILES} defaultExpanded="all" />);
    expect(names()).toEqual(['src', 'src/lib', 'src/lib/utils.ts', 'src/app.tsx', 'src/Button.tsx', 'README.md', 'docs']);
    unmount();
    const view = render(<Tree aria-label="Files" items={FILES} autoExpand={[]} />);
    expect(names()).toEqual(['src', 'README.md', 'docs']);
    view.rerender(<Tree aria-label="Files" items={FILES} autoExpand={['src/lib']} />);
    expect(names()).toContain('src/lib/utils.ts');
    // The user can still close what it opened.
    fireEvent.click(row('src').querySelector('[data-slot="tree-indicator"]') as HTMLElement);
    expect(names()).toEqual(['src', 'README.md', 'docs']);
  });

  it('is controlled by `expanded`, and by a controller', () => {
    const controller = createTreeController();
    function Controlled() {
      const [expanded, setExpanded] = useState<string[]>([]);
      return <Tree aria-label="Files" items={FILES} expanded={expanded} onExpandedChange={setExpanded} controller={controller} />;
    }
    render(<Controlled />);
    act(() => { controller.expand('src'); });
    expect(names()).toContain('src/app.tsx');
    act(() => { controller.collapseAll(); });
    expect(names()).toEqual(['src', 'README.md', 'docs']);
  });

  it('sorts folders first, flattens single-folder chains, and shows a detail', () => {
    const nested: TreeNode[] = [
      { value: 'z.ts', label: 'z.ts' },
      { value: 'a', label: 'a', children: [{ value: 'a/b', label: 'b', children: [{ value: 'a/b/c.ts', label: 'c.ts' }, { value: 'a/b/B.ts', label: 'B.ts' }] }] },
    ];
    render(<Tree aria-label="Files" items={nested} sort flatten defaultExpanded="all" />);
    expect(names()).toEqual(['a/b', 'a/b/B.ts', 'a/b/c.ts', 'z.ts']);
    expect(screen.getByRole('treeitem', { name: 'a / b' })).toBe(row('a/b'));
    cleanup();
    render(<Tree aria-label="Files" items={FILES} defaultExpanded={['src']} icons={false} />);
    expect(screen.getByRole('treeitem', { name: 'app.tsx' })).toBe(row('src/app.tsx'));
    expect(row('src/app.tsx').textContent).toContain('2 KB');
    expect(screen.getByTitle('2,048 bytes')).toBeTruthy();
  });

  it('draws a file-type icon that stays out of a row\'s name and of typing', () => {
    render(<Tree aria-label="Files" items={FILES} defaultExpanded={['src']} />);
    expect(row('src/app.tsx').querySelector('[data-slot="file-type-icon"]')!.getAttribute('data-type')).toBe('typescript');
    // The name is the label; the detail describes the row.
    expect(screen.getByRole('treeitem', { name: 'app.tsx' })).toBe(row('src/app.tsx'));
    expect(row('src/app.tsx').getAttribute('aria-description')).toBe('2,048 bytes');
    row('src').focus();
    fireEvent.keyDown(row('src'), { key: 'a' });
    expect(focused()).toBe('src/app.tsx');
  });

  it('picks a type icon by whole name, then by extension, and reads a long name whole', () => {
    const items = [{ value: '.gitignore', label: '.gitignore' }, { value: 'README.md', label: 'README.md' }, { value: 'LICENSE', label: 'LICENSE' },
      { value: 'page.mdx.tsx', label: 'page.mdx.tsx' }, { value: 'notes', label: 'Release notes for May' }];
    render(<Tree aria-label="Files" items={items} />);
    const type = (v: string) => row(v).querySelector('[data-slot="file-type-icon"]')!.getAttribute('data-type');
    expect([type('.gitignore'), type('README.md'), type('LICENSE'), type('page.mdx.tsx')]).toEqual(['git', 'markdown', 'default', 'markdown']);
    // Shown in two pieces that give way on their own, read as one name.
    expect(screen.getByRole('treeitem', { name: 'Release notes for May' })).toBe(row('notes'));
    expect([...row('notes').querySelectorAll('[aria-hidden="true"] > span')].map((el) => el.textContent)).toEqual(['Release not', 'es for May']);
  });

  it('filters to the matches and the folders above them', async () => {
    render(<Tree aria-label="Files" items={FILES} search />);
    const field = screen.getByRole('searchbox', { name: 'Search Files' });
    fireEvent.input(field, { target: { value: 'util' } });
    await waitFor(() => expect(names()).toEqual(['src', 'src/lib', 'src/lib/utils.ts']));
    fireEvent.input(field, { target: { value: 'nothing like it' } });
    await waitFor(() => expect(screen.getByText('No matches')).toBeTruthy());
    expect(screen.queryByRole('tree')).toBeNull();
    fireEvent.input(field, { target: { value: '' } });
    await waitFor(() => expect(names()).toEqual(['src', 'README.md', 'docs']));
  });

  it('says when there is nothing, in the kit\'s EmptyState, or in what it is given', () => {
    const { rerender } = render(<Tree aria-label="Files" items={[]} />);
    expect(document.querySelector('[data-slot="empty-state"]')?.textContent).toBe('No items');
    rerender(<Tree aria-label="Files" items={[]} emptyState="No files yet" />);
    expect(document.querySelector('[data-slot="empty-state"]')?.textContent).toBe('No files yet');
    rerender(<Tree aria-label="Files" items={[]} emptyState={<p>Drop files here</p>} />);
    expect(screen.getByText('Drop files here').tagName).toBe('P');
    rerender(<Tree aria-label="Files" items={[]} emptyState={null} />);
    expect(document.querySelector('[data-slot="empty-state"]')).toBeNull();
  });

  it('shows placeholder rows while it loads, and is busy until the rows come', () => {
    const { container, rerender } = render(<Tree aria-label="Files" loading />);
    const root = container.querySelector('[data-slot="tree-view"]') as HTMLElement;
    expect(root.getAttribute('aria-busy')).toBe('true');
    expect(screen.getByRole('group', { name: 'Loading Files' }).querySelectorAll('[data-slot="skeleton"]').length).toBe(5);
    expect(screen.queryByRole('tree')).toBeNull();
    // Rows that are already there show while more load.
    rerender(<Tree aria-label="Files" items={FILES} loading />);
    expect(screen.getByRole('tree')).toBeTruthy();
    rerender(<Tree aria-label="Files" items={FILES} />);
    expect(root.hasAttribute('aria-busy')).toBe(false);
  });

  it('gives onAction the node that ran', () => {
    const onAction = vi.fn();
    render(<Tree aria-label="Files" items={FILES} defaultExpanded={['src']} onAction={onAction} />);
    fireEvent.click(row('src/app.tsx').querySelector('[data-slot="tree-label"]') as HTMLElement);
    expect(onAction).toHaveBeenCalledWith('src/app.tsx', expect.objectContaining({ node: FILES[0]!.children![1] }));
  });

  it('draws rows of your own with renderRow, on the same items and keyboard', () => {
    const renderRow = vi.fn((node: TreeNode, state: { level: number; branch: boolean; expanded: boolean }) => (
      <TreeItemLabel data-own="">
        {state.branch ? <TreeItemIndicator /> : null}
        {node.label} @{state.level}{state.expanded ? ' open' : ''}
      </TreeItemLabel>
    ));
    render(<Tree aria-label="Files" items={FILES} defaultExpanded={['src']} renderRow={renderRow} />);
    expect(row('src').textContent).toBe('src @1 open');
    expect(row('src/app.tsx').textContent).toBe('app.tsx @2');
    expect(row('src/app.tsx').querySelector('[data-slot="tree-label"]')!.hasAttribute('data-own')).toBe(true);
    expect(row('src/app.tsx').querySelector('[data-slot="file-type-icon"]')).toBeNull();
    row('src').focus();
    fireEvent.keyDown(row('src'), { key: 'ArrowLeft' });
    expect(row('src').getAttribute('aria-expanded')).toBe('false');
    expect(names()).toEqual(['src', 'README.md', 'docs']);
  });

  it('sets its row height by density', () => {
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(300);
    const many = Array.from({ length: 100 }, (_, i): TreeNode => ({ value: `f${i}`, label: `file-${i}.ts` }));
    const { rerender } = render(<Tree aria-label="Files" items={many} density="compact" />);
    expect(screen.getByRole('tree').style.height).toBe(`${100 * 24}px`);
    rerender(<Tree aria-label="Files" items={many} density="comfortable" />);
    expect(screen.getByRole('tree').style.height).toBe(`${100 * 36}px`);
  });

  it('brings a row selected from outside into view: a step to the edge, a jump mid-list', async () => {
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(300);
    const many = Array.from({ length: 1000 }, (_, i): TreeNode => ({ value: `f${i}`, label: `file-${i}.ts` }));
    const { rerender } = render(<Tree aria-label="Files" items={many} value="f0" />);
    const list = screen.getByRole('tree').parentElement as HTMLElement;
    rerender(<Tree aria-label="Files" items={many} value="f500" />);
    await waitFor(() => expect(list.scrollTop).toBe(500 * 30 - (300 - 30) / 2));
    rerender(<Tree aria-label="Files" items={many} value="f510" />);
    await waitFor(() => expect(list.scrollTop).toBe(510 * 30 + 30 - 300));
  });

  it('marks Git status on a row, and on the folders above a change', () => {
    render(<Tree aria-label="Files" items={FILES} defaultExpanded={['src']} gitStatus={{ 'src/app.tsx': 'modified', 'src/lib/utils.ts': 'added' }} />);
    expect(row('src/app.tsx').textContent).toContain('M, Modified');
    expect(row('src').textContent).toContain('changes inside');
    expect(row('src/lib').textContent).toContain('changes inside');
    expect(screen.getByRole('treeitem', { name: 'docs' })).toBe(row('docs'));
    expect(row('docs').textContent).not.toContain('changes inside');
  });

  it('only draws the rows in view, and still reaches the last one with the keyboard', async () => {
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(300);
    const many = Array.from({ length: 2000 }, (_, i): TreeNode => ({ value: `f${i}`, label: `file-${i}.ts` }));
    render(<Tree aria-label="Files" items={many} />);
    expect(rows().length).toBeLessThan(40);
    expect(screen.getByRole('tree').style.height).toBe(`${2000 * 30}px`);
    expect(row('f0').getAttribute('aria-setsize')).toBe('2000');
    row('f0').focus();
    fireEvent.keyDown(row('f0'), { key: 'End' });
    const scroller = screen.getByRole('tree').parentElement as HTMLElement;
    expect(scroller.scrollTop).toBe(2000 * 30 - 300);
    await act(async () => { fireEvent.scroll(scroller); });
    expect(focused()).toBe('f1999');
  });

  it('renames in place: F2 or `editing` starts, Return saves, Escape cancels', async () => {
    const onRename = vi.fn<(node: TreeNode, label: string, details: TreeEditDetails) => boolean | void>();
    const onEditingChange = vi.fn();
    function Renaming() {
      const [editing, setEditing] = useState<string | null>(null);
      return (
        <>
          <button type="button" onClick={() => setEditing('docs')}>Rename docs</button>
          <Tree aria-label="Files" items={FILES} editing={editing} onRename={onRename}
            onEditingChange={(next, details) => { onEditingChange(next, details.reason); setEditing(next); }} />
        </>
      );
    }
    render(<Renaming />);
    row('README.md').focus();
    fireEvent.keyDown(row('README.md'), { key: 'F2' });
    const field = await screen.findByRole<HTMLInputElement>('textbox', { name: 'Rename README.md' });
    expect(onEditingChange).toHaveBeenLastCalledWith('README.md', 'edit-key');
    expect(field.value).toBe('README.md');
    expect(document.activeElement).toBe(field);
    // Typing in the field is not typing in the tree.
    fireEvent.keyDown(field, { key: 's' });
    expect(document.activeElement).toBe(field);
    // An empty name keeps the field open.
    field.value = '  ';
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(onRename).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox')).toBeTruthy();
    field.value = 'NOTES.md';
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(onRename).toHaveBeenCalledTimes(1);
    expect(onRename.mock.calls[0]![0]).toMatchObject({ value: 'README.md' });
    expect(onRename.mock.calls[0]![1]).toBe('NOTES.md');
    expect(onRename.mock.calls[0]![2].reason).toBe('enter-key');
    expect(onEditingChange).toHaveBeenLastCalledWith(null, 'enter-key');
    await waitFor(() => expect(screen.queryByRole('textbox')).toBeNull());
    expect(focused()).toBe('README.md');
    // From outside (a menu's Rename), and cancelled.
    fireEvent.click(screen.getByText('Rename docs'));
    const second = await screen.findByRole<HTMLInputElement>('textbox', { name: 'Rename docs' });
    second.value = 'guides';
    fireEvent.keyDown(second, { key: 'Escape' });
    expect(onEditingChange).toHaveBeenLastCalledWith(null, 'escape-key');
    expect(onRename).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('textbox')).toBeNull());
  });

  it('lets `onEditingChange` refuse a rename with `details.cancel()`, and says who started it', async () => {
    const onRename = vi.fn();
    const seen: TreeEditingChangeDetails[] = [];
    render(
      <Tree aria-label="Files" items={FILES} onRename={onRename}
        onEditingChange={(next, details) => { seen.push(details); if (next === 'README.md') details.cancel(); }} />,
    );
    // Uncontrolled: a refused start never opens the field.
    row('README.md').focus();
    fireEvent.keyDown(row('README.md'), { key: 'F2' });
    expect(seen.at(-1)).toMatchObject({ reason: 'edit-key', canceled: true });
    expect(seen.at(-1)!.event?.type).toBe('keydown');
    expect(typeof seen.at(-1)!.cancel).toBe('function');
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(focused()).toBe('README.md');
    // Another row goes through, and its details carry a source.
    row('docs').focus();
    fireEvent.keyDown(row('docs'), { key: 'F2' });
    const field = await screen.findByRole<HTMLInputElement>('textbox', { name: 'Rename docs' });
    expect(seen.at(-1)).toMatchObject({ reason: 'edit-key', canceled: false });
    expect(seen.at(-1)!.source).toBeDefined();
    fireEvent.keyDown(field, { key: 'Escape' });
    expect(seen.at(-1)).toMatchObject({ reason: 'escape-key' });
    await waitFor(() => expect(screen.queryByRole('textbox')).toBeNull());
  });

  it('offers rename to agents while no field is open: start opens one, rename saves through onRename', async () => {
    const agent = createAgent();
    const onRename = vi.fn<(node: TreeNode, label: string, details: TreeEditDetails) => boolean | void>();
    render(<Tree aria-label="Files" items={FILES} onRename={onRename} />);
    // The group around the tree has the tree's name: it holds the tree, it doesn't perform a rename.
    expect(screen.getByRole('group', { name: 'Files' }).contains(screen.getByRole('tree', { name: 'Files' }))).toBe(true);
    const entry = () => agent.snapshot().find((e) => !e.offPage && e.component === 'inline-edit');
    expect(entry()).toMatchObject({ label: 'Files', actions: ['start', 'rename', 'cancel'] });

    const renamed = await act(() => agent.act({ steps: [{ ref: 'Files', action: 'rename', args: ['README.md', 'NOTES.md'] }] }));
    expect(renamed.ok).toBe(true);
    expect(onRename).toHaveBeenCalledTimes(1);
    expect(onRename.mock.calls[0]![0]).toMatchObject({ value: 'README.md' });
    expect(onRename.mock.calls[0]![1]).toBe('NOTES.md');
    expect(screen.queryByRole('textbox')).toBeNull();
    // An empty name is refused, as it is when typed.
    const empty = await act(() => agent.act({ steps: [{ ref: 'Files', action: 'rename', args: ['README.md', ' '] }] }));
    expect(empty.steps[0]!.result).toBe(false);
    expect(onRename).toHaveBeenCalledTimes(1);

    await act(() => agent.act({ steps: [{ ref: 'Files', action: 'start', args: ['docs'] }] }));
    const field = await screen.findByRole<HTMLInputElement>('textbox', { name: 'Rename docs' });
    expect(field.value).toBe('docs');
    await act(() => agent.act({ steps: [{ ref: 'Files', action: 'cancel' }] }));
    await waitFor(() => expect(screen.queryByRole('textbox')).toBeNull());
    expect(onRename).toHaveBeenCalledTimes(1);
  });

  it('keeps the field open when a controlled owner keeps `editing`, and when an end is refused', async () => {
    const onRename = vi.fn(() => true);
    function Locked() {
      const [editing, setEditing] = useState<string | null>('docs');
      return (
        <Tree aria-label="Files" items={FILES} editing={editing} onRename={onRename}
          onEditingChange={(next, details) => {
            // Escape is refused: the rename must be finished, not dropped.
            if (details.reason === 'escape-key') details.cancel();
            else setEditing(next);
          }} />
      );
    }
    render(<Locked />);
    const field = await screen.findByRole<HTMLInputElement>('textbox', { name: 'Rename docs' });
    fireEvent.keyDown(field, { key: 'Escape' });
    expect(await screen.findByRole('textbox', { name: 'Rename docs' })).toBeTruthy();
    const again = screen.getByRole<HTMLInputElement>('textbox');
    again.value = 'guides';
    fireEvent.keyDown(again, { key: 'Enter' });
    expect(onRename).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('textbox')).toBeNull());
  });

  it('does not rename without `onRename`', () => {
    render(<Tree aria-label="Files" items={FILES} />);
    row('README.md').focus();
    fireEvent.keyDown(row('README.md'), { key: 'F2' });
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('opens the context menu of the row that was right-clicked, and none for a row without one', async () => {
    const onSelect = vi.fn();
    render(
      <Tree aria-label="Files" items={FILES} contextMenu={(node) => (node.children ? null : (
        <DropdownMenuContent aria-label={`${node.label} actions`}>
          <DropdownMenuItem value="open" onSelect={() => onSelect(node.value)}>Open {node.label}</DropdownMenuItem>
        </DropdownMenuContent>
      ))} />,
    );
    fireEvent.contextMenu(row('README.md'), { clientX: 10, clientY: 10 });
    const item = await screen.findByRole('menuitem', { name: 'Open README.md' });
    expect(screen.getByRole('menu', { name: 'README.md actions' })).toBeTruthy();
    fireEvent.click(item);
    expect(onSelect).toHaveBeenCalledWith('README.md');
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    // A folder has no menu here: nothing opens, and the browser's own menu stays away too.
    expect(fireEvent.contextMenu(row('docs'), { clientX: 10, clientY: 10 })).toBe(false);
    await tick();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('renames from a row\'s menu, opening the folders above the row', async () => {
    const onRename = vi.fn();
    function FromMenu() {
      const [editing, setEditing] = useState<string | null>(null);
      return (
        <>
          <button type="button" onClick={() => setEditing('src/lib/utils.ts')}>Rename utils</button>
          <Tree aria-label="Files" items={FILES} editing={editing} onEditingChange={setEditing} onRename={onRename}
            contextMenu={(node) => (
              <DropdownMenuContent aria-label={`${node.label} actions`}>
                <DropdownMenuItem value="rename" onSelect={() => setEditing(node.value)}>Rename</DropdownMenuItem>
              </DropdownMenuContent>
            )} />
        </>
      );
    }
    render(<FromMenu />);
    row('README.md').focus();
    fireEvent.contextMenu(row('README.md'), { clientX: 10, clientY: 10 });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Rename' }));
    const field = await screen.findByRole<HTMLInputElement>('textbox', { name: 'Rename README.md' });
    await tick();
    await tick();
    // The menu has closed and handed focus back: the field still has it.
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(field);
    field.value = 'GUIDE.md';
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(onRename.mock.calls[0]![1]).toBe('GUIDE.md');
    await waitFor(() => expect(screen.queryByRole('textbox')).toBeNull());
    fireEvent.click(screen.getByText('Rename utils'));
    expect((await screen.findByRole<HTMLInputElement>('textbox', { name: 'Rename utils.ts' })).value).toBe('utils.ts');
    expect(row('src/lib').getAttribute('aria-expanded')).toBe('true');
  });

  it('previews the row the pointer rests on', async () => {
    render(<Tree aria-label="Files" items={FILES} preview={(node) => (node.children ? null : <p>About {node.label}</p>)} />);
    expect(rows().filter((r) => r.getAttribute('tabindex') === '0')).toHaveLength(1);
    fireEvent.pointerEnter(row('README.md'), { pointerType: 'mouse' });
    fireEvent.pointerMove(row('README.md'), { pointerType: 'mouse' });
    expect(await screen.findByText('About README.md', {}, { timeout: 2000 })).toBeTruthy();
  });

  it('drags rows out with their path, and takes a drop from outside on a folder', () => {
    const data = { types: ['Files'] as string[], effectAllowed: '', dropEffect: '', setData: vi.fn() };
    const onDragStart = vi.fn();
    const onDrop = vi.fn();
    const accepts = vi.fn((types: readonly string[]) => types.includes('Files'));
    render(
      <Tree aria-label="Files" items={FILES} defaultExpanded={['src']} canDrag={(nodes) => nodes.every((n) => !n.children)}
        onDragStart={onDragStart} externalDrop={{ accepts, onDrop }} />,
    );
    const label = (value: string) => row(value).querySelector('[data-slot="tree-label"]') as HTMLElement;
    expect(label('src/app.tsx').getAttribute('draggable')).toBe('true');
    expect(label('src').hasAttribute('draggable')).toBe(false);
    fireEvent.dragStart(label('src/app.tsx'), { dataTransfer: data });
    expect(data.setData).toHaveBeenCalledWith('text/plain', 'src/app.tsx');
    expect(data.setData).toHaveBeenCalledTimes(1);
    expect(onDragStart.mock.calls[0]![0]).toMatchObject([{ value: 'src/app.tsx' }]);
    fireEvent.dragEnd(label('src/app.tsx'), { dataTransfer: data });
    // A file's row stands for the folder it is in.
    fireEvent.dragOver(label('src/app.tsx'), { dataTransfer: data });
    expect(row('src').hasAttribute('data-drop-target')).toBe(true);
    fireEvent.drop(label('src/app.tsx'), { dataTransfer: data });
    expect(onDrop.mock.calls[0]![1]).toMatchObject({ value: 'src' });
    expect(row('src').hasAttribute('data-drop-target')).toBe(false);
    // A row at the top level stands for the tree itself.
    fireEvent.drop(label('README.md'), { dataTransfer: data });
    expect(onDrop.mock.calls[1]![1]).toBeNull();
    // What `accepts` refuses is not dropped.
    fireEvent.drop(label('README.md'), { dataTransfer: { ...data, types: ['text/plain'] } });
    expect(onDrop).toHaveBeenCalledTimes(2);
  });

  it('moves rows dropped on a folder inside the tree, but never into themselves', () => {
    const data = { types: [] as string[], effectAllowed: '', dropEffect: '', setData: vi.fn() };
    const onMove = vi.fn();
    render(<Tree aria-label="Files" items={FILES} defaultExpanded={['src']} canDrag={() => true} onMove={onMove} />);
    const label = (value: string) => row(value).querySelector('[data-slot="tree-label"]') as HTMLElement;
    fireEvent.dragStart(label('src'), { dataTransfer: data });
    fireEvent.drop(label('src/lib'), { dataTransfer: data });
    expect(onMove).not.toHaveBeenCalled();
    fireEvent.drop(label('docs'), { dataTransfer: data });
    expect(onMove.mock.calls[0]![0]).toMatchObject([{ value: 'src' }]);
    expect(onMove.mock.calls[0]![1]).toMatchObject({ value: 'docs' });
  });
});

describe('Tree, composed from parts', () => {
  it('nests items in groups, with the kit\'s rows', () => {
    render(
      <Tree aria-label="Outline" defaultExpanded={['intro']} current="setup">
        <TreeItem value="intro">
          <TreeItemLabel><TreeItemIndicator />Introduction</TreeItemLabel>
          <TreeGroup>
            <TreeItem value="setup"><TreeItemLabel>Setup</TreeItemLabel></TreeItem>
          </TreeGroup>
        </TreeItem>
        <TreeItem value="api"><TreeItemLabel>API</TreeItemLabel></TreeItem>
      </Tree>,
    );
    expect(screen.getByRole('tree', { name: 'Outline' })).toBeTruthy();
    const setup = screen.getByRole('treeitem', { name: 'Setup' });
    expect(setup.getAttribute('aria-level')).toBe('2');
    expect(setup.getAttribute('aria-current')).toBe('page');
    expect(setup.querySelector('[data-slot="tree-label"]')!.className).toContain('rounded-ctl');
    // The kit's TreeGroup makes its item a branch, as UI SDK's own does: expanded state, and the chevron's turn.
    const intro = screen.getByRole('treeitem', { name: 'Introduction' });
    expect(intro.getAttribute('aria-expanded')).toBe('true');
    expect(intro.hasAttribute('data-expanded')).toBe(true);
    expect(screen.getByRole('treeitem', { name: 'API' }).hasAttribute('aria-expanded')).toBe(false);
    fireEvent.click(intro.querySelector('[data-slot="tree-indicator"]') as HTMLElement);
    expect(screen.queryByRole('treeitem', { name: 'Setup' })).toBeNull();
    expect(intro.getAttribute('aria-expanded')).toBe('false');
  });

  it('takes actionOn too', () => {
    const onAction = vi.fn();
    render(
      <Tree aria-label="Outline" actionOn="double-press" onAction={onAction}>
        <TreeItem value="api"><TreeItemLabel>API</TreeItemLabel></TreeItem>
      </Tree>,
    );
    const api = screen.getByRole('treeitem', { name: 'API' });
    fireEvent.click(api, { detail: 1 });
    expect(onAction).not.toHaveBeenCalled();
    fireEvent.click(api, { detail: 2 });
    expect(onAction).toHaveBeenCalledWith('api', expect.anything());
  });
});

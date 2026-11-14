import { describe, expect, it } from 'vitest';
import {
  addTab,
  closeTab,
  closeTabset,
  maximizeTabset,
  minSizeOf,
  moveTab,
  normalizeLayout,
  resizeSplit,
  restoreTabset,
  selectTab,
  splitSizes,
  updateTab,
  workspaceTabsets,
  type SplitNode,
  type WorkspaceLayoutInput,
} from './workspace-model';

const tab = (id: string) => ({ id, title: id.toUpperCase(), data: null });
const input: WorkspaceLayoutInput = {
  version: 1,
  root: {
    type: 'split',
    orientation: 'horizontal',
    children: [
      { type: 'tabset', id: 'files', size: 30, tabs: [tab('a'), tab('b')] },
      {
        type: 'split',
        orientation: 'vertical',
        children: [
          { type: 'tabset', id: 'editor', selectedId: 'd', tabs: [tab('c'), tab('d')] },
          { type: 'tabset', tabs: [tab('e')] },
        ],
      },
    ],
  },
};
const ids = (layout: { root: unknown }) => workspaceTabsets(layout as never).map((tabset) => `${tabset.id}:${tabset.tabs.map((t) => t.id).join('')}`);
const root = (layout: { root: unknown }) => layout.root as SplitNode;

describe('normalizeLayout', () => {
  it('names what has no id by its place, and shows a tab in every tabset', () => {
    const layout = normalizeLayout(input);
    expect(layout.root.id).toBe('split-root');
    expect(root(layout).children[1].id).toBe('split-1');
    expect(ids(layout)).toEqual(['files:ab', 'editor:cd', 'tabset-1-1:e']);
    expect(workspaceTabsets(layout).map((tabset) => tabset.selectedId)).toEqual(['a', 'd', 'e']);
  });

  it('returns the same object for the same input, and a layout in order as it is', () => {
    const layout = normalizeLayout(input);
    expect(normalizeLayout(input)).toBe(layout);
    expect(normalizeLayout(layout)).toBe(layout);
  });

  it('drops an empty tabset unless it is kept, and a split left with one child', () => {
    const layout = normalizeLayout({
      version: 1,
      root: {
        type: 'split',
        orientation: 'horizontal',
        children: [
          { type: 'tabset', id: 'gone', tabs: [] },
          { type: 'split', orientation: 'vertical', children: [{ type: 'tabset', id: 'kept', keepWhenEmpty: true, tabs: [] }, { type: 'tabset', id: 'full', tabs: [tab('a')] }] },
        ],
      },
    });
    expect(layout.root).toMatchObject({ type: 'split', orientation: 'vertical' });
    expect(ids(layout)).toEqual(['kept:', 'full:a']);
  });

  it('flattens a split inside one that runs the same way, keeping each share', () => {
    const layout = normalizeLayout({
      version: 1,
      root: {
        type: 'split',
        orientation: 'horizontal',
        children: [
          { type: 'tabset', id: 'one', size: 40, tabs: [tab('a')] },
          { type: 'split', orientation: 'horizontal', size: 60, children: [{ type: 'tabset', id: 'two', tabs: [tab('b')] }, { type: 'tabset', id: 'three', tabs: [tab('c')] }] },
        ],
      },
    });
    expect(root(layout).children.map((child) => [child.id, child.size])).toEqual([['one', 40], ['two', 30], ['three', 30]]);
  });

  it('leaves an empty workspace as one tabset, and forgets a maximized tabset that is gone or alone', () => {
    expect(normalizeLayout({ version: 1, root: { type: 'split', orientation: 'horizontal', children: [] } }).root).toEqual({ type: 'tabset', id: 'tabset-root', tabs: [] });
    expect(normalizeLayout({ ...input, maximizedTabsetId: 'nowhere' }).maximizedTabsetId).toBeUndefined();
    expect(normalizeLayout({ version: 1, maximizedTabsetId: 'only', root: { type: 'tabset', id: 'only', tabs: [tab('a')] } }).maximizedTabsetId).toBeUndefined();
  });
});

describe('sizes', () => {
  it('shares what is left between children without a size', () => {
    expect(splitSizes(root(normalizeLayout(input)))).toEqual([30, 70]);
    expect(splitSizes({ children: [{ type: 'tabset', id: 'a', tabs: [] }, { type: 'tabset', id: 'b', tabs: [] }, { type: 'tabset', id: 'c', size: 50, tabs: [] }] })).toEqual([25, 25, 50]);
  });

  it('resizes a split and keeps the nodes that did not change', () => {
    const layout = normalizeLayout(input);
    const next = resizeSplit(layout, 'split-root', [45, 55]);
    expect(root(next).children.map((child) => child.size)).toEqual([45, 55]);
    expect((root(next).children[1] as SplitNode).children).toBe((root(layout).children[1] as SplitNode).children);
    expect(resizeSplit(next, 'split-root', [45, 55])).toBe(next);
  });

  it('adds bounds up along a split and takes the largest across it', () => {
    const layout = normalizeLayout({
      version: 1,
      root: {
        type: 'split',
        orientation: 'horizontal',
        children: [
          { type: 'tabset', id: 'a', minWidth: '120px', tabs: [tab('a')] },
          { type: 'split', orientation: 'vertical', children: [{ type: 'tabset', id: 'b', minWidth: '200px', tabs: [tab('b')] }, { type: 'tabset', id: 'c', tabs: [tab('c')] }] },
        ],
      },
    });
    expect(minSizeOf(layout.root, 'horizontal')).toBe('320px');
    expect(minSizeOf(layout.root, 'horizontal', { width: '300px' })).toBe('420px');
    expect(minSizeOf(layout.root, 'vertical')).toBeUndefined();
    expect(minSizeOf(layout.root, 'vertical', { height: '10rem' })).toBe('20rem');
  });
});

describe('tabs', () => {
  it('adds a tab at the end of a tabset and shows it, or selects the one already open', () => {
    const layout = normalizeLayout(input);
    const added = addTab(layout, tab('z'), { tabsetId: 'editor' });
    expect(ids(added)).toEqual(['files:ab', 'editor:cdz', 'tabset-1-1:e']);
    expect(workspaceTabsets(added)[1].selectedId).toBe('z');
    expect(workspaceTabsets(addTab(layout, tab('b')))[0].selectedId).toBe('b');
    expect(workspaceTabsets(addTab(layout, tab('y'), { tabsetId: 'files', index: 0, select: false }))[0]).toMatchObject({ selectedId: 'a', tabs: [{ id: 'y' }, { id: 'a' }, { id: 'b' }] });
  });

  it('selects, updates and closes a tab, showing the one that takes its place', () => {
    const layout = normalizeLayout(input);
    expect(selectTab(layout, 'a')).toBe(layout);
    expect(workspaceTabsets(selectTab(layout, 'b'))[0].selectedId).toBe('b');
    expect(workspaceTabsets(updateTab(layout, 'a', { title: 'Renamed' }))[0].tabs[0]).toEqual({ id: 'a', title: 'Renamed', data: null });
    expect(workspaceTabsets(closeTab(layout, 'a'))[0]).toMatchObject({ selectedId: 'b', tabs: [{ id: 'b' }] });
    expect(workspaceTabsets(closeTab(layout, 'd'))[1]).toMatchObject({ selectedId: 'c' });
  });

  it('takes a tabset out with its last tab, and its split with it', () => {
    const layout = closeTab(normalizeLayout(input), 'e');
    expect(ids(layout)).toEqual(['files:ab', 'editor:cd']);
    expect(root(layout).children.map((child) => child.type)).toEqual(['tabset', 'tabset']);
    expect(ids(closeTabset(layout, 'files'))).toEqual(['editor:cd']);
    expect(closeTabset(closeTabset(layout, 'files'), 'editor').root).toEqual({ type: 'tabset', id: 'tabset-root', tabs: [] });
  });

  it('maximizes a tabset, but not the only one, and restores', () => {
    const layout = normalizeLayout(input);
    const maximized = maximizeTabset(layout, 'editor');
    expect(maximized.maximizedTabsetId).toBe('editor');
    expect(maximizeTabset(maximized, 'editor')).toBe(maximized);
    expect(restoreTabset(maximized).maximizedTabsetId).toBeUndefined();
    const alone = normalizeLayout({ version: 1, root: { type: 'tabset', id: 'only', tabs: [tab('a')] } });
    expect(maximizeTabset(alone, 'only')).toBe(alone);
  });
});

describe('moveTab', () => {
  it('moves a tab among its tabset, counting the tabs without it', () => {
    const layout = normalizeLayout(input);
    expect(ids(moveTab(layout, 'a', { tabsetId: 'files', index: 1 }))[0]).toBe('files:ba');
    expect(moveTab(layout, 'a', { tabsetId: 'files', index: 0 })).toBe(layout);
  });

  it('moves a tab to another tabset, on show there, and leaves a neighbor on show behind', () => {
    const layout = moveTab(normalizeLayout(input), 'd', { tabsetId: 'files', index: 1 });
    expect(ids(layout)).toEqual(['files:adb', 'editor:c', 'tabset-1-1:e']);
    expect(workspaceTabsets(layout).map((tabset) => tabset.selectedId)).toEqual(['d', 'c', 'e']);
    expect(ids(moveTab(layout, 'c', { tabsetId: 'files', region: 'center' }))).toEqual(['files:adbc', 'tabset-1-1:e']);
  });

  it('joins a split that runs the same way as a sibling, with half of the room', () => {
    const layout = moveTab(normalizeLayout(input), 'b', { tabsetId: 'files', region: 'right' });
    expect(root(layout).children.map((child) => [child.id, child.size])).toEqual([['files', 15], ['tabset-1', 15], ['split-1', 70]]);
    expect(ids(layout)).toEqual(['files:a', 'tabset-1:b', 'editor:cd', 'tabset-1-1:e']);
  });

  it('splits across the split around it, and takes the tabset it emptied away', () => {
    const layout = moveTab(normalizeLayout(input), 'e', { tabsetId: 'files', region: 'top' });
    expect(root(layout).children.map((child) => [child.type, child.size])).toEqual([['split', 30], ['tabset', 70]]);
    expect(root(layout).children[0]).toMatchObject({ orientation: 'vertical', children: [{ tabs: [{ id: 'e' }], size: 50 }, { id: 'files', size: 50 }] });
    expect(ids(layout)).toEqual(['tabset-1:e', 'files:ab', 'editor:cd']);
  });

  it('splits the only tabset, and leaves a tabset with one tab alone', () => {
    const alone = normalizeLayout({ version: 1, root: { type: 'tabset', id: 'only', tabs: [tab('a'), tab('b')] } });
    const split = moveTab(alone, 'b', { tabsetId: 'only', region: 'bottom' });
    expect(split.root).toMatchObject({ type: 'split', orientation: 'vertical', children: [{ id: 'only', tabs: [{ id: 'a' }] }, { tabs: [{ id: 'b' }] }] });
    const layout = normalizeLayout(input);
    expect(moveTab(layout, 'e', { tabsetId: 'tabset-1-1', region: 'left' })).toBe(layout);
  });

  it('shows every tabset again when a split opens behind a maximized one', () => {
    const layout = maximizeTabset(normalizeLayout(input), 'editor');
    expect(moveTab(layout, 'a', { tabsetId: 'files', index: 1 }).maximizedTabsetId).toBe('editor');
    expect(moveTab(layout, 'a', { tabsetId: 'editor', region: 'left' }).maximizedTabsetId).toBeUndefined();
  });
});

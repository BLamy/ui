/* ══ Workspace's layout, as plain data and plain functions ══
   A layout is a tree: splits lay their children out side by side or stacked, tabsets hold tabs and show one of
   them. It is JSON all the way down, so an app saves it as it is. Every function here returns a new layout and
   leaves the one it was given alone; what did not change keeps its identity, so a view re-renders only the part
   that did. A function that has nothing to change returns the layout it was given. */

export type WorkspaceOrientation = 'horizontal' | 'vertical';
export type WorkspaceTabSide = 'top' | 'bottom' | 'start' | 'end';
/** A lower bound for a tabset, in pixels or rems. */
export type WorkspaceMinSize = `${number}px` | `${number}rem`;

/** A tab within a tabset. */
export type WorkspaceTabNode<TabData = unknown> = {
  /** Unique in the workspace, and chosen by the app: it usually names something real, like a file path. */
  id: string;
  /** What the tab reads, wherever the workspace writes it: the default tab, its close button, what a screen reader
   *  hears as it moves. Falls back to `id`. */
  title?: string;
  /** The app's own data. Keep it serializable if the layout is saved. */
  data: TabData;
  /** The user cannot close this tab. A controller still can. */
  disableClose?: boolean;
  /** The user cannot move this tab. Others still move around it. */
  disableDrag?: boolean;
};

/** A set of tabs, one of them showing. */
export type WorkspaceTabsetNode<TabData = unknown, TabsetData = unknown> = {
  type: 'tabset';
  /** Unique in the workspace. Left out of an input, it comes from the tabset's place in the tree (`tabset-0-1`);
   *  a tabset the workspace makes, by a drop on an edge, gets a generated one. */
  id: string;
  /** Its share of the split around it, in percent. Siblings without one share what is left evenly. */
  size?: number;
  /** The narrowest it gets. Overrides the workspace's `tabsetMinWidth`. */
  minWidth?: WorkspaceMinSize;
  /** The shortest it gets. Overrides the workspace's `tabsetMinHeight`. */
  minHeight?: WorkspaceMinSize;
  /** Where its tabs sit around its content. Overrides the workspace's `tabSide`. */
  tabSide?: WorkspaceTabSide;
  /** Stays when its last tab leaves, showing `renderEmptyTabset`, until `closeTabset` removes it. */
  keepWhenEmpty?: boolean;
  /** The tab on show. */
  selectedId?: string;
  /** The app's own data. */
  data?: TabsetData;
  tabs: WorkspaceTabNode<TabData>[];
};

/** Lays its children out side by side (`horizontal`) or stacked (`vertical`), with a handle between each pair. */
export type WorkspaceSplitNode<TabData = unknown, TabsetData = unknown> = {
  type: 'split';
  /** Unique in the workspace. Left out of an input, it comes from the split's place in the tree (`split-root`). */
  id: string;
  orientation: WorkspaceOrientation;
  /** Its share of the split around it, in percent. */
  size?: number;
  children: WorkspaceNode<TabData, TabsetData>[];
};

export type WorkspaceNode<TabData = unknown, TabsetData = unknown> = WorkspaceSplitNode<TabData, TabsetData> | WorkspaceTabsetNode<TabData, TabsetData>;

/** A workspace's whole arrangement. An empty workspace is one tabset with no tabs. */
export type WorkspaceLayout<TabData = unknown, TabsetData = unknown> = {
  version: 1;
  root: WorkspaceNode<TabData, TabsetData>;
  /** The tabset that covers the others, if one does. */
  maximizedTabsetId?: string;
};

export type WorkspaceTabsetNodeInput<TabData = unknown, TabsetData = unknown> = Omit<WorkspaceTabsetNode<TabData, TabsetData>, 'id'> & { id?: string };
export type WorkspaceSplitNodeInput<TabData = unknown, TabsetData = unknown> = Omit<WorkspaceSplitNode<TabData, TabsetData>, 'id' | 'children'> & {
  id?: string;
  children: WorkspaceNodeInput<TabData, TabsetData>[];
};
export type WorkspaceNodeInput<TabData = unknown, TabsetData = unknown> = WorkspaceSplitNodeInput<TabData, TabsetData> | WorkspaceTabsetNodeInput<TabData, TabsetData>;
/** A layout whose splits and tabsets may leave out their ids: what `layout`, `defaultLayout` and `setLayout` take. */
export type WorkspaceLayoutInput<TabData = unknown, TabsetData = unknown> = Omit<WorkspaceLayout<TabData, TabsetData>, 'root'> & {
  root: WorkspaceNodeInput<TabData, TabsetData>;
};

/** An edge of a tabset's content, or its middle. */
export type WorkspaceDropRegion = 'center' | 'start' | 'end' | 'top' | 'bottom';
/** Where a tab can go: a place among a tabset's tabs, or a region of its content. An edge splits the tabset there,
 *  the middle adds the tab to it. */
export type WorkspaceDropTarget = { tabsetId: string; index: number } | { tabsetId: string; region: WorkspaceDropRegion };

type AnyNode = WorkspaceNode<any, any>;
type AnyTabset = WorkspaceTabsetNode<any, any>;
type AnySplit = WorkspaceSplitNode<any, any>;
type AnyLayout = WorkspaceLayout<any, any>;

const EMPTY_ROOT = 'tabset-root';

/* ── Reading ── */

/** Every tabset, in reading order. */
export function workspaceTabsets<TabData, TabsetData>(
  from: WorkspaceLayout<TabData, TabsetData> | WorkspaceNode<TabData, TabsetData>,
  out: WorkspaceTabsetNode<TabData, TabsetData>[] = [],
): WorkspaceTabsetNode<TabData, TabsetData>[] {
  const node = 'root' in from ? from.root : from;
  if (node.type === 'tabset') out.push(node);
  else for (const child of node.children) workspaceTabsets(child, out);
  return out;
}

export function findTabset<TabData, TabsetData>(layout: WorkspaceLayout<TabData, TabsetData>, tabsetId: string) {
  return workspaceTabsets(layout).find((tabset) => tabset.id === tabsetId);
}

/** The tabset holding a tab. */
export function tabsetOfTab<TabData, TabsetData>(layout: WorkspaceLayout<TabData, TabsetData>, tabId: string) {
  return workspaceTabsets(layout).find((tabset) => tabset.tabs.some((tab) => tab.id === tabId));
}

export function findTab<TabData, TabsetData>(layout: WorkspaceLayout<TabData, TabsetData>, tabId: string) {
  for (const tabset of workspaceTabsets(layout)) {
    const tab = tabset.tabs.find((candidate) => candidate.id === tabId);
    if (tab) return tab;
  }
  return undefined;
}

/** Each child's share of a split, in percent, adding up to 100: the sizes written on them, the rest shared evenly. */
export function splitSizes(split: Pick<WorkspaceSplitNode<any, any>, 'children'>): number[] {
  const given = split.children.map((child) => (typeof child.size === 'number' && child.size > 0 ? child.size : undefined));
  const taken = given.reduce<number>((sum, size) => sum + (size ?? 0), 0);
  const open = given.filter((size) => size === undefined).length;
  const share = open ? Math.max(100 - taken, 0) / open || 100 / given.length : 0;
  const sizes = given.map((size) => size ?? share);
  const total = sizes.reduce((sum, size) => sum + size, 0) || 1;
  return Math.abs(total - 100) < 1e-6 ? sizes : sizes.map((size) => (size / total) * 100);
}

const UNIT = /^(-?\d*\.?\d+)(px|rem)$/;

/** The least room a node needs along an axis: a tabset's own bound, a split's children added up along its own
 *  direction and the largest of them across it. Bounds in different units can't be added, so they give none. */
export function minSizeOf(
  node: WorkspaceNode<any, any>,
  axis: WorkspaceOrientation,
  fallback: { width?: WorkspaceMinSize; height?: WorkspaceMinSize } = {},
): WorkspaceMinSize | undefined {
  if (node.type === 'tabset') return axis === 'horizontal' ? (node.minWidth ?? fallback.width) : (node.minHeight ?? fallback.height);
  let total = 0;
  let unit: string | undefined;
  for (const child of node.children) {
    const match = UNIT.exec(minSizeOf(child, axis, fallback) ?? '');
    if (!match) continue;
    if (unit && unit !== match[2]) return undefined;
    unit = match[2];
    total = node.orientation === axis ? total + Number(match[1]) : Math.max(total, Number(match[1]));
  }
  return unit ? (`${total}${unit}` as WorkspaceMinSize) : undefined;
}

/* ── Normalizing ── */

const ids = (node: AnyNode, out = new Set<string>()) => {
  out.add(node.id);
  if (node.type === 'split') for (const child of node.children) ids(child, out);
  return out;
};

const freshId = (taken: Set<string>, prefix: string) => {
  let n = 1;
  while (taken.has(`${prefix}-${n}`)) n += 1;
  taken.add(`${prefix}-${n}`);
  return `${prefix}-${n}`;
};

const percent = (size: unknown): number | undefined => {
  if (typeof size === 'number') return Number.isFinite(size) ? size : undefined;
  // A size saved as "30" or "30%" is still a share. Sizes in other units were only ever a starting point.
  if (typeof size === 'string' && /^\d*\.?\d+%?$/.test(size.trim())) return Number.parseFloat(size);
  return undefined;
};

const same = <T>(a: readonly T[], b: readonly T[]) => a.length === b.length && a.every((item, index) => item === b[index]);

/** Gives every node an id, a tabset a tab on show, and takes out what holds nothing: an empty tabset that isn't
 *  kept, a split of one, a split inside a split that runs the same way. */
function tidy(node: AnyNode | WorkspaceNodeInput<any, any>, path: string, taken: Set<string>, isRoot: boolean): AnyNode | null {
  const size = percent(node.size);
  if (node.type === 'tabset') {
    if (!node.tabs.length && !node.keepWhenEmpty && !isRoot) return null;
    let id = node.id ?? `tabset-${path}`;
    if (taken.has(id)) id = freshId(taken, 'tabset');
    taken.add(id);
    const selectedId = node.tabs.some((tab) => tab.id === node.selectedId) ? node.selectedId : node.tabs[0]?.id;
    if (id === node.id && selectedId === node.selectedId && size === node.size) return node as AnyTabset;
    return { ...node, id, selectedId, size };
  }
  let id = node.id ?? `split-${path}`;
  if (taken.has(id)) id = freshId(taken, 'split');
  taken.add(id);
  const kept: AnyNode[] = [];
  node.children.forEach((child, index) => {
    const next = tidy(child, path === 'root' ? String(index) : `${path}-${index}`, taken, false);
    if (next) kept.push(next);
  });
  if (!kept.length) return null;
  if (kept.length === 1) return kept[0].size === size ? kept[0] : { ...kept[0], size };
  const nested = (child: AnyNode): child is AnySplit => child.type === 'split' && child.orientation === node.orientation;
  let children = kept;
  if (kept.some(nested)) {
    // A split inside one that runs the same way: its children take its place, each with its part of its share.
    const shares = splitSizes({ children: kept });
    children = kept.flatMap((child, index): AnyNode[] => {
      if (!nested(child)) return [{ ...child, size: shares[index] }];
      const inner = splitSizes(child);
      return child.children.map((grandchild, at) => ({ ...grandchild, size: (shares[index] * inner[at]) / 100 }));
    });
  }
  if (id === node.id && size === node.size && same(children, node.children as AnyNode[])) return node as AnySplit;
  return { type: 'split', id, orientation: node.orientation, size, children };
}

const normalized = new WeakMap<object, AnyLayout>();

/** A layout ready to render, from one that may leave ids out or hold what a view can't show. The same input gives
 *  the same object, and a layout that is already in order comes back as it is. */
export function normalizeLayout<TabData = unknown, TabsetData = unknown>(
  input: WorkspaceLayoutInput<TabData, TabsetData>,
): WorkspaceLayout<TabData, TabsetData> {
  const known = normalized.get(input);
  if (known) return known;
  const root = tidy(input.root, 'root', new Set(), true) ?? { type: 'tabset', id: EMPTY_ROOT, tabs: [] };
  // The only tabset already fills the workspace, so it can't cover anything.
  const maximizedTabsetId =
    root.type === 'split' && input.maximizedTabsetId && workspaceTabsets(root).some((tabset) => tabset.id === input.maximizedTabsetId)
      ? input.maximizedTabsetId
      : undefined;
  const layout: AnyLayout =
    root === input.root && maximizedTabsetId === input.maximizedTabsetId && input.version === 1
      ? (input as AnyLayout)
      : { version: 1, root, ...(maximizedTabsetId ? { maximizedTabsetId } : {}) };
  normalized.set(input, layout);
  normalized.set(layout, layout);
  return layout;
}

/* ── Changing ── */

/** Replaces the nodes `change` returns something else for, keeping the rest. `null` takes a node out. */
function mapNodes(node: AnyNode, change: (node: AnyNode) => AnyNode | null): AnyNode | null {
  const next = change(node);
  if (next !== node || node.type === 'tabset') return next;
  const children = node.children.map((child) => mapNodes(child, change));
  if (same(children, node.children)) return node;
  return { ...node, children: children.filter((child): child is AnyNode => child !== null) };
}

function withRoot<TabData, TabsetData>(layout: WorkspaceLayout<TabData, TabsetData>, root: AnyNode | null, patch: Partial<AnyLayout> = {}) {
  if (root === layout.root && !Object.keys(patch).length) return layout;
  return normalizeLayout<TabData, TabsetData>({ ...layout, ...patch, root: root ?? { type: 'tabset', id: EMPTY_ROOT, tabs: [] } });
}

const mapTabset = <TabData, TabsetData>(layout: WorkspaceLayout<TabData, TabsetData>, tabsetId: string, change: (tabset: AnyTabset) => AnyTabset) =>
  withRoot(layout, mapNodes(layout.root, (node) => (node.type === 'tabset' && node.id === tabsetId ? change(node) : node)));

/** Selects a tab within its tabset. */
export function selectTab<TabData, TabsetData>(layout: WorkspaceLayout<TabData, TabsetData>, tabId: string) {
  const tabset = tabsetOfTab(layout, tabId);
  if (!tabset || tabset.selectedId === tabId) return layout;
  return mapTabset(layout, tabset.id, (node) => ({ ...node, selectedId: tabId }));
}

/** Adds a tab to a tabset: at `index`, else at the end, and on show unless `select` is false. A tab whose id is
 *  already there is selected instead, as it is. */
export function addTab<TabData, TabsetData>(
  layout: WorkspaceLayout<TabData, TabsetData>,
  tab: WorkspaceTabNode<TabData>,
  { tabsetId, index, select = true }: { tabsetId?: string; index?: number; select?: boolean } = {},
) {
  if (findTab(layout, tab.id)) return select ? selectTab(layout, tab.id) : layout;
  const tabsets = workspaceTabsets(layout);
  const target = tabsets.find((tabset) => tabset.id === tabsetId) ?? tabsets[0];
  return mapTabset(layout, target.id, (node) => {
    const tabs = [...node.tabs];
    tabs.splice(Math.max(0, Math.min(tabs.length, index ?? tabs.length)), 0, tab);
    return { ...node, tabs, selectedId: select || !node.selectedId ? tab.id : node.selectedId };
  });
}

/** A tabset without one of its tabs. The tab that takes its place is on show, else the one before. */
const without = (tabset: AnyTabset, tabId: string): AnyTabset => {
  const at = tabset.tabs.findIndex((tab) => tab.id === tabId);
  const tabs = tabset.tabs.filter((tab) => tab.id !== tabId);
  return { ...tabset, tabs, selectedId: tabset.selectedId === tabId ? (tabs[at] ?? tabs[at - 1])?.id : tabset.selectedId };
};

/** Closes a tab. A tabset left empty goes with it, unless it is kept or the last one. */
export function closeTab<TabData, TabsetData>(layout: WorkspaceLayout<TabData, TabsetData>, tabId: string) {
  const tabset = tabsetOfTab(layout, tabId);
  return tabset ? mapTabset(layout, tabset.id, (node) => without(node, tabId)) : layout;
}

/** Closes a tabset with every tab in it. Closing the last one leaves an empty workspace. */
export function closeTabset<TabData, TabsetData>(layout: WorkspaceLayout<TabData, TabsetData>, tabsetId: string) {
  if (!findTabset(layout, tabsetId)) return layout;
  return withRoot(layout, mapNodes(layout.root, (node) => (node.type === 'tabset' && node.id === tabsetId ? null : node)));
}

/** Changes a tab's title, data or flags. `data` is replaced, not merged. */
export function updateTab<TabData, TabsetData>(
  layout: WorkspaceLayout<TabData, TabsetData>,
  tabId: string,
  changes: Partial<Omit<WorkspaceTabNode<TabData>, 'id'>>,
) {
  const tabset = tabsetOfTab(layout, tabId);
  if (!tabset) return layout;
  return mapTabset(layout, tabset.id, (node) => ({ ...node, tabs: node.tabs.map((tab) => (tab.id === tabId ? { ...tab, ...changes } : tab)) }));
}

/** Changes a tabset's data, bounds, tab placement or whether it is kept when empty. */
export function updateTabset<TabData, TabsetData>(
  layout: WorkspaceLayout<TabData, TabsetData>,
  tabsetId: string,
  changes: Partial<Pick<WorkspaceTabsetNode<TabData, TabsetData>, 'data' | 'keepWhenEmpty' | 'minHeight' | 'minWidth' | 'tabSide'>>,
) {
  return findTabset(layout, tabsetId) ? mapTabset(layout, tabsetId, (node) => ({ ...node, ...changes })) : layout;
}

/** Sets the shares of a split's children, in percent and in order. */
export function resizeSplit<TabData, TabsetData>(layout: WorkspaceLayout<TabData, TabsetData>, splitId: string, sizes: readonly number[]) {
  return withRoot(
    layout,
    mapNodes(layout.root, (node) => {
      if (node.type !== 'split' || node.id !== splitId || node.children.length !== sizes.length) return node;
      if (node.children.every((child, index) => child.size === sizes[index])) return node;
      return { ...node, children: node.children.map((child, index) => (child.size === sizes[index] ? child : { ...child, size: sizes[index] })) };
    }),
  );
}

/** Lets a tabset cover the others. The only tabset already does, so nothing changes for it. */
export function maximizeTabset<TabData, TabsetData>(layout: WorkspaceLayout<TabData, TabsetData>, tabsetId: string) {
  if (layout.root.type === 'tabset' || layout.maximizedTabsetId === tabsetId || !findTabset(layout, tabsetId)) return layout;
  return normalizeLayout<TabData, TabsetData>({ ...layout, maximizedTabsetId: tabsetId });
}

/** Shows every tabset again. */
export function restoreTabset<TabData, TabsetData>(layout: WorkspaceLayout<TabData, TabsetData>) {
  if (!layout.maximizedTabsetId) return layout;
  return normalizeLayout<TabData, TabsetData>({ version: 1, root: layout.root });
}

const EDGES: Record<Exclude<WorkspaceDropRegion, 'center'>, { orientation: WorkspaceOrientation; before: boolean }> = {
  start: { orientation: 'horizontal', before: true },
  end: { orientation: 'horizontal', before: false },
  top: { orientation: 'vertical', before: true },
  bottom: { orientation: 'vertical', before: false },
};

/** Moves a tab to a place among a tabset's tabs, or to a region of its content: an edge puts it in a new tabset
 *  there, which takes half of the room, and the middle adds it to the tabset. The tab is on show where it lands.
 *  `index` counts the tabs without the one moving. */
export function moveTab<TabData, TabsetData>(layout: WorkspaceLayout<TabData, TabsetData>, tabId: string, target: WorkspaceDropTarget) {
  const source = tabsetOfTab(layout, tabId);
  const destination = findTabset(layout, target.tabsetId);
  const tab = source?.tabs.find((candidate) => candidate.id === tabId);
  if (!source || !destination || !tab) return layout;

  if ('index' in target || target.region === 'center') {
    const others = destination.tabs.filter((candidate) => candidate.id !== tabId);
    const index = 'index' in target ? Math.max(0, Math.min(others.length, target.index)) : others.length;
    if (source === destination && source.tabs.indexOf(tab) === index) return selectTab(layout, tabId);
    const placed = (node: AnyTabset): AnyTabset => {
      const tabs = node.tabs.filter((candidate) => candidate.id !== tabId);
      tabs.splice(index, 0, tab);
      return { ...node, tabs, selectedId: tabId };
    };
    return withRoot(
      layout,
      mapNodes(layout.root, (node) => {
        if (node.type !== 'tabset') return node;
        if (node.id === destination.id) return placed(node);
        return node.id === source.id ? without(node, tabId) : node;
      }),
    );
  }

  // Its only tab can't leave a tabset to split it.
  if (source === destination && source.tabs.length === 1) return layout;
  const { orientation, before } = EDGES[target.region];
  const taken = ids(layout.root);
  const created: AnyTabset = { type: 'tabset', id: freshId(taken, 'tabset'), tabs: [tab], selectedId: tabId };
  const leave = (node: AnyNode): AnyNode => (node.type === 'tabset' && node.id === source.id ? without(node, tabId) : node);
  const halves = (stays: AnyNode, size: number): AnyNode[] => {
    const pair = [{ ...created, size }, { ...stays, size }];
    return before ? pair : pair.reverse();
  };
  const split = (stays: AnyNode, size?: number): AnySplit => ({ type: 'split', id: freshId(taken, 'split'), orientation, size, children: halves(stays, 50) });
  const root =
    layout.root.type === 'tabset'
      ? split(leave(layout.root))
      : mapNodes(layout.root, (node) => {
          if (node.type === 'tabset') return leave(node);
          const at = node.children.findIndex((child) => child.id === destination.id);
          if (at < 0) return node;
          const sizes = splitSizes(node);
          const children = node.children.flatMap((child, index): AnyNode[] => {
            if (index !== at) return [{ ...(mapNodes(child, leave) ?? child), size: sizes[index] }];
            // Along the split it joins as a sibling; across it, the tabset becomes a split of the two.
            return node.orientation === orientation ? halves(leave(child), sizes[index] / 2) : [split(leave(child), sizes[index])];
          });
          return { ...node, children };
        });
  // Leaves a maximized tabset: the new one would open behind it.
  return normalizeLayout<TabData, TabsetData>({ version: 1, root: root ?? layout.root });
}

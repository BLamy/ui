'use client';
import {
  Children, isValidElement, useEffect, useMemo, useRef, useState,
  type CSSProperties, type DragEvent, type FocusEvent, type HTMLAttributes, type KeyboardEvent, type MouseEvent, type ReactNode,
} from 'react';
import {
  Tree as SdkTree, TreeGroup as SdkTreeGroup, TreeItem as SdkTreeItem, TreeItemCheckbox as SdkTreeItemCheckbox,
  TreeItemIndicator as SdkTreeItemIndicator, TreeItemLabel as SdkTreeItemLabel,
  createTreeController, treeFromPaths, visibleTreeRows,
  type TreeController, type TreeExpandedChangeReason, type TreeItemData, type TreeMode, type TreeProps as SdkTreeProps,
} from '@ui-sdk/react/tree';
import { createParts } from '@ui-sdk/react/primitive';
import type { ChangeDetails } from '@ui-sdk/core';
import { cva, type VariantProps } from 'class-variance-authority';
import { ContextMenu, ContextMenuTrigger } from '@/components/ui/context-menu';
import { HoverCard, HoverCardContent, HoverCardTrigger, createHoverCardController, type HoverCardController } from '@/components/ui/hover-card';
import { SearchField } from '@/components/ui/search-field';
import { Icon, type IconName } from '@/lib/icon';
import { inlineEdit, type InlineEditChangeDetails, type InlineEditDetails } from '@/lib/inline-edit-primitive';
import { useVirtualRows } from '@/lib/use-virtual-rows';
import { cn, cx } from '@/lib/utils';

/* ══ Tree — UI SDK's Tree with the kit's rows ══
   UI SDK owns the behavior: one tab stop, arrow keys between rows (Right and Left open, close and step in and out),
   Home and End, typing to find a row, selection (`mode`, `value`, `onValueChange`), expansion (`expanded`,
   `onExpandedChange`), checkboxes (`checkable`), `onAction` for a press or Return, `current` for a page in a
   navigation tree, and a controller (`createTreeController`) to drive it from outside.

   Compose it from parts, for a short tree whose rows are yours:
   <Tree aria-label="Files">
     <TreeItem value="src">
       <TreeItemLabel><TreeItemIndicator />src</TreeItemLabel>
       <TreeGroup><TreeItem value="src/app.tsx"><TreeItemLabel>app.tsx</TreeItemLabel></TreeItem></TreeGroup>
     </TreeItem>
   </Tree>

   Or hand it the data and it draws the rows, only the ones in view (UI SDK's virtualizer), with what a file browser
   has: indent guides, file-type icons, a detail after the label, search, Git status, rename in place, a context menu
   and a hover preview per row, and drag and drop. A node with `children` (even an empty array) is a folder.
   <Tree aria-label="Files" items={[{ value: 'src', label: 'src', children: [{ value: 'src/app.tsx', label: 'app.tsx' }] }]}
     defaultExpanded="all" onAction={(value) => open(value)} /> ══ */

export { createTreeController, treeFromPaths, visibleTreeRows };
export type { TreeController, TreeItemData, TreeMode };

/* ── The look ── */

/** The tree's own metrics by density: a row's height, its inline padding, the gap between its parts, the indent of each
 *  level, how far the chevron sits below center, and the margin either side of a drawn row (inside a 16px inset). */
export const treeVariants = cva('text-footnote text-foreground', {
  variants: {
    density: {
      compact: '[--tree-row-height:24px] [--tree-pad-x:6.4px] [--tree-gap:4.8px] [--tree-indent:18.6875px] [--tree-nudge:0.8px] [--tree-inset:1.6px]',
      default: '[--tree-row-height:30px] [--tree-pad-x:8px] [--tree-gap:6px] [--tree-indent:21.5px] [--tree-nudge:1px] [--tree-inset:2px]',
      relaxed: '[--tree-row-height:36px] [--tree-pad-x:9.6px] [--tree-gap:7.2px] [--tree-indent:24.28125px] [--tree-nudge:1.2px] [--tree-inset:2.4px]',
    },
  },
  defaultVariants: { density: 'default' },
});

export type TreeDensity = NonNullable<VariantProps<typeof treeVariants>['density']>;
const ROW_HEIGHT: Record<TreeDensity, number> = { compact: 24, default: 30, relaxed: 36 };

/** A row: the label inside an item. Selection, the current page and a disabled row show here; keyboard focus is on the
 *  item around it (`group/tree-item`). Each level moves the row's content in by `--tree-indent`. */
export const treeRowVariants = cva([
  'group/tree-row relative box-border flex h-(--tree-row-height) w-full min-w-0 cursor-default items-center gap-(--tree-gap) rounded-ctl pr-(--tree-pad-x) leading-(--tree-row-height) select-none',
  'pl-[calc(var(--tree-pad-x)+(var(--tree-level,1)-1)*var(--tree-indent))]',
  'hover:not-data-disabled:not-data-selected:bg-secondary data-selected:bg-primary/16 data-current:font-medium data-disabled:opacity-50 data-pending:cursor-progress',
  'group-focus-visible/tree-item:[box-shadow:inset_0_0_0_1px_var(--ring)]',
  'group-data-dimmed/tree-item:opacity-60 group-data-drop-target/tree-item:bg-secondary group-data-drop-target/tree-item:[box-shadow:inset_0_0_0_2px_var(--primary)]',
]);

/** The chevron's path: drawn pointing down, turned to point at the label while its branch is closed. */
const CHEVRON = 'M12.4697 5.46973C12.7626 5.17684 13.2374 5.17684 13.5303 5.46973C13.8232 5.76262 13.8232 6.23738 13.5303 6.53028L8.53028 11.5303C8.23738 11.8232 7.76262 11.8232 7.46973 11.5303L2.46973 6.53028C2.17684 6.23738 2.17684 5.76262 2.46973 5.46973C2.76262 5.17684 3.23738 5.17684 3.53028 5.46973L8 9.93946L12.4697 5.46973Z';

/* ── Parts ── */

/** An item. Put its text in a `TreeItemLabel` and its children in a `TreeGroup`, which makes it a branch. */
export function TreeItem({ className, branch, children, ...props }: Parameters<typeof SdkTreeItem>[0]) {
  // UI SDK finds its own group among an item's children; ours is a component of the kit's, so the item says so.
  const isBranch = branch ?? (typeof children === 'function' ? undefined : holdsGroup(children) || undefined);
  return <SdkTreeItem className={cx('group/tree-item outline-none', className)} branch={isBranch} {...props}>{children}</SdkTreeItem>;
}

/** Whether a TreeGroup (the kit's or UI SDK's) is among these children, at any depth of elements. */
function holdsGroup(children: ReactNode): boolean {
  return Children.toArray(children).some((child) => isValidElement<{ children?: ReactNode }>(child)
    && (child.type === TreeGroup || child.type === SdkTreeGroup || holdsGroup(child.props.children)));
}

/** The item's row and its name. Render it as a link (`render={<a href />}`) to make the item one. */
export function TreeItemLabel({ className, ...props }: Parameters<typeof SdkTreeItemLabel>[0]) {
  return <SdkTreeItemLabel className={cx(treeRowVariants(), className)} {...props} />;
}

/** The arrow that opens and closes a branch: a chevron that turns, unless you give it children. */
export function TreeItemIndicator({ className, children, ...props }: Parameters<typeof SdkTreeItemIndicator>[0]) {
  return (
    <SdkTreeItemIndicator
      className={cx('group/tree-indicator grid size-4 shrink-0 place-items-center text-muted-foreground group-data-selected/tree-row:text-foreground', className)}
      {...props}
    >
      {children ?? (
        <svg
          aria-hidden="true" width="16" height="16" viewBox="0 0 16 16"
          className={cn(
            '[transform:rotate(-90deg)_translate(calc(var(--tree-nudge)/-2),calc(var(--tree-nudge)/2))] rtl:[transform:rotate(90deg)_translate(calc(var(--tree-nudge)/2),calc(var(--tree-nudge)/2))]',
            'group-data-expanded/tree-indicator:[transform:translate(0,var(--tree-nudge))] rtl:group-data-expanded/tree-indicator:[transform:translate(0,var(--tree-nudge))]',
          )}
        >
          <path d={CHEVRON} fill="currentColor" />
        </svg>
      )}
    </SdkTreeItemIndicator>
  );
}

/** The item's checkbox, in a `checkable` tree: a check when its item is checked, a dash while only some of what is
 *  inside it is. */
export function TreeItemCheckbox({ className, children, ...props }: Parameters<typeof SdkTreeItemCheckbox>[0]) {
  return (
    <SdkTreeItemCheckbox
      className={cx(
        'grid size-4 shrink-0 place-items-center rounded-sm border border-border bg-card text-transparent data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground data-indeterminate:border-primary data-indeterminate:bg-primary data-indeterminate:text-primary-foreground',
        className,
      )}
      {...props}
    >
      {children ?? ((state) => <Icon name={state.checked === 'indeterminate' ? 'minus' : 'check'} size={11} sw={3} />)}
    </SdkTreeItemCheckbox>
  );
}

/** A branch's children. */
export function TreeGroup({ className, ...props }: Parameters<typeof SdkTreeGroup>[0]) {
  return <SdkTreeGroup className={cx('flex flex-col', className)} {...props} />;
}

/* ── Data ── */

/** A node of the tree's data: UI SDK's `TreeItemData`, with what the kit's rows add. */
export interface TreeNode extends Omit<TreeItemData, 'children'> {
  /** A folder's children. An empty array is an empty folder; leave it out for a leaf. */
  children?: readonly TreeNode[];
  /** After the label: a count, a kind, a short status. */
  detail?: string;
  /** The detail's tooltip. */
  detailTitle?: string;
  /** A leaf's icon, from the icon set (folders show their chevron). Overrides the file-type icon. */
  icon?: IconName;
  /** Shown faded: listed, but not the kind of thing this tree opens. */
  dimmed?: boolean;
}

export type TreeGitStatus = 'added' | 'modified' | 'deleted' | 'renamed' | 'untracked' | 'ignored';

/** Where a drag would land: a folder, or the tree itself (`null`). */
export type TreeDropTarget = TreeNode | null;

/** Why a rename was saved (`enter-key`, `tab-key`, `focus-out`…), and the event behind it. */
export type TreeEditDetails = InlineEditDetails;

/** Why a rename started or ended (`edit-key`, `enter-key`, `escape-key`, `focus-out`…), the event, who caused it, and
 *  `cancel()` to refuse it. */
export type TreeEditingChangeDetails = InlineEditChangeDetails;

type RootProps = Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'defaultValue' | 'defaultChecked' | 'onChange' | 'onSelect' | 'onDrop' | 'onDragStart' | 'contextMenu'>;

export type TreeProps<Mode extends TreeMode = 'single'> = Omit<SdkTreeProps<Mode>, 'items' | 'defaultExpanded' | 'className' | 'style' | 'contextMenu' | 'onDragStart' | 'onDrop'> & {
  className?: string;
  style?: CSSProperties;
  /** The whole hierarchy as data. With no children of its own, the tree draws the rows, virtualized. */
  items?: readonly TreeNode[];
  /** The branches open at first: these, or every one (`'all'`, which also opens branches that arrive later). */
  defaultExpanded?: string[] | 'all';
  /** Row height and indent. */
  density?: TreeDensity;

  /* What follows is for a tree drawn from `items` (or `paths`). */

  /** Branches to open, with the branches above them, whenever they appear in this list. The user can still close
   *  them. Left alone when `expanded` controls the tree. */
  autoExpand?: readonly string[];
  /** Folders first, then A→Z, as a file browser lists them. Default: the order of `items`. */
  sort?: boolean;
  /** A search field over the rows; typing keeps only the matches and the folders above them. */
  search?: boolean;
  /** Show a chain of folders that each hold only one folder as one row (`src / app / ui`), as code editors do. */
  flatten?: boolean;
  /** A leaf's file-type icon, from its label's extension (default `true`). Without it, only a node's own `icon` shows. */
  icons?: boolean;
  /** Git-style status by value; folders show a dot when something inside them changed. */
  gitStatus?: Readonly<Record<string, TreeGitStatus>>;
  /** A `ContextMenuContent` for the node, opened by right-click, long-press or the menu key. Return nothing for a row
   *  without one. Its items act through their own `onSelect`. */
  contextMenu?: (node: TreeNode) => ReactNode;
  /** What a HoverCard shows about the node (a file's size and last change, a folder's contents), beside its row while
   *  the pointer rests on it or keyboard focus stays on it. Return nothing for rows without one. */
  preview?: (node: TreeNode) => ReactNode;
  /** The row being renamed in place, or `null`. F2 starts one when `onRename` is set; pass this to start one from a
   *  menu. */
  editing?: string | null;
  /** A rename started (a value) or ended (`null`); `details.reason` says how: `escape-key` is a cancel.
   *  `details.cancel()` refuses it: a read-only row stays as it is. */
  onEditingChange?: (editing: string | null, details: TreeEditingChangeDetails) => void;
  /** Return (or leaving the field) with a new name. Return `false` to keep the field open: the name isn't valid. */
  onRename?: (node: TreeNode, label: string, details: TreeEditDetails) => boolean | void;
  /** Rows you can drag (default: none). They carry their path as text; add your own data in `onDragStart`. */
  canDrag?: (nodes: TreeNode[]) => boolean;
  onDragStart?: (nodes: TreeNode[], data: DataTransfer) => void;
  /** Rows dragged onto a folder (or the tree) in this tree. Without it, nothing moves. */
  onMove?: (nodes: TreeNode[], target: TreeDropTarget) => void;
  canMove?: (nodes: TreeNode[], target: TreeDropTarget) => boolean;
  /** Something from outside the tree — files from the computer, another list's rows — dropped on a folder or the tree.
      `accepts` decides from the drag's types; the target folder lights up while it would be accepted. */
  externalDrop?: {
    accepts: (types: readonly string[], target: TreeDropTarget) => boolean;
    onDrop: (data: DataTransfer, target: TreeDropTarget) => void;
  };
  /** Shown instead of the rows when there are none. Default: "No matches" while searching, nothing otherwise. */
  emptyMessage?: ReactNode;
};

export function Tree<Mode extends TreeMode = 'single'>(props: TreeProps<Mode>) {
  if (props.children === undefined && (props.items || props.paths)) return <DataTree {...(props as TreeProps<TreeMode>)} />;
  const { items, defaultExpanded, density, className, ...rest } = props as TreeProps<TreeMode>;
  return (
    <SdkTree
      items={items as TreeItemData[] | undefined}
      defaultExpanded={defaultExpanded === 'all' ? branchValues(items ?? []) : defaultExpanded}
      className={cn(treeVariants({ density }), 'flex flex-col outline-none', className)}
      {...(rest as SdkTreeProps<TreeMode>)}
    />
  );
}

function branchValues(nodes: readonly TreeNode[], out: string[] = []): string[] {
  for (const node of nodes) {
    if (!node.children) continue;
    out.push(node.value);
    branchValues(node.children, out);
  }
  return out;
}

/* ── A tree drawn from its data ── */

interface Shape {
  /** What the Tree is given: sorted, flattened and filtered. */
  items: TreeItemData[];
  nodeOf: Map<string, TreeNode>;
  parentOf: Map<string, string | null>;
  /** A folder shown inside a flattened row answers to that row's value. */
  alias: Map<string, string>;
  /** The names in a flattened row (`src`, `app`, `ui`), by its value. */
  segments: Map<string, string[]>;
  branches: string[];
}

const byFolderThenName = (a: TreeNode, b: TreeNode) =>
  Number(!!b.children) - Number(!!a.children) || a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' });

/** The folder that is all a folder holds, if that is so. */
const onlyFolderIn = (node: TreeNode) => (node.children?.length === 1 && node.children[0]?.children ? node.children[0] : undefined);

function shapeOf(nodes: readonly TreeNode[], { sort, flatten, query }: { sort?: boolean; flatten?: boolean; query: string }): Shape {
  const shape: Shape = { items: [], nodeOf: new Map(), parentOf: new Map(), alias: new Map(), segments: new Map(), branches: [] };
  const find = query.trim().toLowerCase();
  const walk = (list: readonly TreeNode[], parent: string | null): TreeItemData[] => {
    const out: TreeItemData[] = [];
    for (const first of sort ? [...list].sort(byFolderThenName) : list) {
      let node = first;
      const names = [node.label];
      const inside: string[] = [];
      for (let only = flatten ? onlyFolderIn(node) : undefined; only; only = onlyFolderIn(node)) {
        inside.push(node.value);
        node = only;
        names.push(node.label);
      }
      const label = names.join(' / ');
      for (const value of inside) shape.alias.set(value, node.value);
      if (inside.length) shape.segments.set(node.value, names);
      shape.nodeOf.set(node.value, node);
      shape.parentOf.set(node.value, parent);
      const children = node.children ? walk(node.children, node.value) : undefined;
      // A search keeps the matches and the folders above them.
      if (find && !label.toLowerCase().includes(find) && !children?.length) continue;
      if (children) shape.branches.push(node.value);
      out.push({ value: node.value, label, ...(children ? { children } : {}), ...(node.disabled ? { disabled: true } : {}), ...(node.href ? { href: node.href } : {}) });
    }
    return out;
  };
  shape.items = walk(nodes, null);
  return shape;
}

/* Git inks: each status's hue leaned toward the text color, so it keeps text contrast in light and dark. */
const ADDED_INK = 'color-mix(in oklab, #16A994 60%, var(--foreground))';
const MODIFIED_INK = 'color-mix(in oklab, #1CA1C7 60%, var(--foreground))';
const RENAMED_INK = 'color-mix(in oklab, #D5A910 55%, var(--foreground))';
const DELETED_INK = 'color-mix(in oklab, #FF2E3F 70%, var(--foreground))';
const IGNORED_INK = '#ADADB1';

const STATUS: Record<TreeGitStatus, { letter: string; label: string; ink: string }> = {
  added: { letter: 'A', label: 'Added', ink: ADDED_INK },
  untracked: { letter: 'U', label: 'Untracked', ink: ADDED_INK },
  modified: { letter: 'M', label: 'Modified', ink: MODIFIED_INK },
  renamed: { letter: 'R', label: 'Renamed', ink: RENAMED_INK },
  deleted: { letter: 'D', label: 'Deleted', ink: DELETED_INK },
  ignored: { letter: 'I', label: 'Ignored', ink: IGNORED_INK },
};

const Edit = createParts(inlineEdit, { root: 'div', input: 'input' });

/** A row holds a field while it is renamed: its keys and presses aren't the row's. */
const own = (e: KeyboardEvent | MouseEvent) => e.stopPropagation();

/** The tree itself as a drop target. */
const ROOT = '\u0000root';

function DataTree({
  items: itemsProp, paths, defaultExpanded, expanded: expandedProp, onExpandedChange, autoExpand, density = 'default',
  sort, search, flatten, icons = true, gitStatus, contextMenu, preview, editing, onEditingChange, onRename,
  canDrag, onDragStart, onMove, canMove, externalDrop, emptyMessage,
  mode, value, defaultValue, onValueChange, activation, expandOnPress, checkable, checked, defaultChecked, onCheckedChange, checkStrategy,
  onAction, pendingAnnouncement, loadChildren, current, onHighlight, disabled, focusableWhenDisabled, announcement, controller: controllerProp, debug,
  keepMounted, hiddenUntilFound,
  'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledBy, className, style, ...rootProps
}: TreeProps<TreeMode>) {
  const [query, setQuery] = useState('');
  const source = useMemo<readonly TreeNode[]>(() => itemsProp ?? treeFromPaths(paths ?? []), [itemsProp, paths]);
  const shape = useMemo(() => shapeOf(source, { sort, flatten, query }), [source, sort, flatten, query]);
  const { nodeOf } = shape;

  /* Which branches are open: the owner's (`expanded`), or the tree's own. */
  const openAll = defaultExpanded === 'all';
  const [ownExpanded, setOwnExpanded] = useState<string[]>(() => (openAll ? shape.branches : defaultExpanded ?? []));
  const [seen] = useState(() => new Set(shape.branches));
  useEffect(() => {
    // With `defaultExpanded="all"`, a branch that arrives later starts open too.
    if (!openAll || query) return;
    const fresh = shape.branches.filter((v) => !seen.has(v));
    for (const v of fresh) seen.add(v);
    if (fresh.length) setOwnExpanded((open) => [...open, ...fresh]);
  }, [shape, openAll, query, seen]);
  const autoKey = autoExpand ? JSON.stringify(autoExpand) : null;
  const live = useRef({ shape, autoExpand });
  live.current = { shape, autoExpand };
  useEffect(() => {
    const { shape: at, autoExpand: list } = live.current;
    if (!list?.length) return;
    const wanted: string[] = [];
    for (const id of list) {
      for (let v: string | null | undefined = at.alias.get(id) ?? id; v != null && at.nodeOf.has(v); v = at.parentOf.get(v)) wanted.push(v);
    }
    setOwnExpanded((open) => {
      const add = wanted.filter((v) => !open.includes(v));
      return add.length ? [...open, ...add] : open;
    });
  }, [autoKey]);
  // A row renamed from outside shows first: the folders above it open.
  useEffect(() => {
    if (editing == null) return;
    const at = live.current.shape;
    const above: string[] = [];
    for (let v = at.parentOf.get(editing); v != null; v = at.parentOf.get(v)) above.push(v);
    setOwnExpanded((open) => {
      const add = above.filter((v) => !open.includes(v));
      return add.length ? [...open, ...add] : open;
    });
  }, [editing]);
  // While searching, every folder that is left shows what it holds.
  const expanded = useMemo(() => (query ? shape.branches : expandedProp ?? ownExpanded), [query, shape, expandedProp, ownExpanded]);

  const flat = useMemo(() => visibleTreeRows(shape.items, expanded), [shape, expanded]);
  const indexOf = useMemo(() => new Map(flat.map((r, i) => [r.item.value, i])), [flat]);
  /** Folders with a change somewhere inside them. */
  const changed = useMemo(() => {
    const set = new Set<string>();
    for (const [id, status] of Object.entries(gitStatus ?? {})) {
      if (status === 'ignored') continue;
      for (let v = shape.parentOf.get(shape.alias.get(id) ?? id); v != null && !set.has(v); v = shape.parentOf.get(v)) set.add(v);
    }
    return set;
  }, [gitStatus, shape]);

  const rowHeight = ROW_HEIGHT[density];
  /** The row with keyboard focus, and the one being renamed, stay in the DOM while they are scrolled away. */
  const focusedKey = useRef<string | null>(null);
  const renamingKey = useRef<string | null>(null);
  const virtual = useVirtualRows({
    rows: flat,
    count: flat.length,
    rowHeight,
    keyOf: (index) => flat[index]?.item.value ?? String(index),
    keep: () => [focusedKey.current, renamingKey.current].flatMap((key) => (key == null ? [] : indexOf.get(key) ?? [])),
  });
  const editingIndex = editing == null ? undefined : indexOf.get(editing);
  const { scrollToIndex } = virtual;
  useEffect(() => {
    if (editingIndex !== undefined) scrollToIndex(editingIndex);
  }, [editingIndex, scrollToIndex]);

  const [ownController] = useState(createTreeController);
  const controller = controllerProp ?? ownController;

  /* The row with the tree's tab stop: the indent guide beside it and its siblings shows. */
  const [highlighted, setHighlighted] = useState<string | null>(null);
  // It starts on the selected row if that row shows; a selection made from outside later on doesn't move it, as that
  // isn't where the keyboard is.
  const [picked, setPicked] = useState<string | null>(() => {
    const first = value !== undefined ? value : defaultValue;
    return typeof first === 'string' && indexOf.has(first) ? first : null;
  });
  const activeKey = [highlighted, picked].find((k) => k != null && indexOf.has(k)) ?? null;
  const guideParent = activeKey == null ? null : flat[indexOf.get(activeKey) ?? -1]?.parent ?? null;

  /* A selection set from outside comes into view. */
  const revealKey = typeof value === 'string' ? value : null;
  const reveal = useRef({ indexOf, scrollToIndex: virtual.scrollToIndex });
  reveal.current = { indexOf, scrollToIndex: virtual.scrollToIndex };
  useEffect(() => {
    const index = revealKey == null ? undefined : reveal.current.indexOf.get(revealKey);
    if (index !== undefined) reveal.current.scrollToIndex(index);
  }, [revealKey]);

  const nodeAt = (target: EventTarget | null) => {
    const key = target instanceof Element ? target.closest('[data-key]')?.getAttribute('data-key') : null;
    return key == null ? undefined : nodeOf.get(key);
  };

  /* The context menu belongs to the row it opened on. */
  const [menuNode, setMenuNode] = useState<TreeNode | null>(null);

  /* The preview belongs to the row the pointer rests on: one card serves every row. */
  const [card] = useState(() => createHoverCardController<TreeNode>());
  const [previewNode, setPreviewNode] = useState<TreeNode | null>(null);

  /* Drags. A row dragged inside the tree moves (`onMove`); anything else that is dropped is `externalDrop`'s. */
  const dragging = useRef<TreeNode[] | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const pathOf = (node: TreeNode) => {
    const parts = [node.label];
    for (let v = shape.parentOf.get(node.value); v != null; v = shape.parentOf.get(v)) parts.unshift(nodeOf.get(v)?.label ?? v);
    return parts.join('/');
  };
  /** The folder a drop on this row goes to: a file's row stands for the folder it is in. */
  const folderAt = (target: EventTarget | null): TreeDropTarget => {
    const node = nodeAt(target);
    if (!node) return null;
    return node.children ? node : nodeOf.get(shape.parentOf.get(node.value) ?? '') ?? null;
  };
  const accepts = (e: DragEvent, target: TreeDropTarget) => {
    const nodes = dragging.current;
    if (!nodes) return !!externalDrop?.accepts([...e.dataTransfer.types], target);
    if (!onMove) return false;
    // Not into itself, or into something inside it.
    for (let v: string | null | undefined = target?.value; v != null; v = shape.parentOf.get(v)) if (nodes.some((n) => n.value === v)) return false;
    return canMove?.(nodes, target) ?? true;
  };
  const dropHandlers = onMove || externalDrop ? {
    onDragOver: (e: DragEvent<HTMLDivElement>) => {
      const target = folderAt(e.target);
      if (!accepts(e, target)) return setDropTarget(null);
      e.preventDefault();
      e.dataTransfer.dropEffect = dragging.current ? 'move' : 'copy';
      setDropTarget(target?.value ?? ROOT);
    },
    onDragLeave: (e: DragEvent<HTMLDivElement>) => {
      if (!(e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget))) setDropTarget(null);
    },
    onDrop: (e: DragEvent<HTMLDivElement>) => {
      setDropTarget(null);
      const target = folderAt(e.target);
      if (!accepts(e, target)) return;
      e.preventDefault();
      if (dragging.current) onMove?.(dragging.current, target);
      else externalDrop?.onDrop(e.dataTransfer, target);
    },
  } : {};
  const dragHandlers = (node: TreeNode) => (canDrag?.([node]) ? {
    draggable: true,
    onDragStart: (e: DragEvent<HTMLElement>) => {
      // Dragging one of several selected rows takes them all.
      const selected = controller.getValue();
      const picked = Array.isArray(selected) && selected.includes(node.value) ? selected.flatMap((v) => nodeOf.get(v) ?? []) : [node];
      if (!canDrag(picked)) return e.preventDefault();
      dragging.current = picked;
      e.dataTransfer.setData('text/plain', picked.map(pathOf).join('\n'));
      e.dataTransfer.effectAllowed = 'copyMove';
      onDragStart?.(picked, e.dataTransfer);
    },
    onDragEnd: () => {
      dragging.current = null;
      setDropTarget(null);
    },
  } : {});

  const row = (index: number, top: number, renaming: string | null) => {
    const shown = flat[index];
    const node = shown && nodeOf.get(shown.item.value);
    if (!shown || !node) return null;
    const { value: key, label } = shown.item;
    const branch = !!shown.item.children;
    const status = gitStatus?.[key];
    const ink = status ? STATUS[status].ink : undefined;
    const leafIcon = node.icon ? <Icon name={node.icon} size={16} />
      : icons ? <TreeTypeIcon name={node.label} />
      : null;
    // One guide per level above the row; the one beside the active row's siblings shows.
    const guides = [];
    for (let level = shown.level - 1, at = shown.parent; level >= 1 && at != null; level--, at = shape.parentOf.get(at) ?? null) {
      guides.push(
        <span
          key={level}
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute inset-y-0 border-l border-border [transform:translateX(-0.25px)] transition-opacity duration-150 rtl:[transform:translateX(0.25px)]',
            at === guideParent ? 'opacity-100' : 'opacity-0 group-hover/tree:opacity-75',
          )}
          style={{ insetInlineStart: `calc(var(--tree-pad-x) + 7.5px + ${level - 1} * var(--tree-indent))` }}
        />,
      );
    }
    const names = shape.segments.get(key);
    const content = (
      <SdkTreeItemLabel className={treeRowVariants()} {...dragHandlers(node)}>
        {guides}
        {checkable ? <TreeItemCheckbox /> : null}
        {branch ? <TreeItemIndicator /> : (
          <span className={cn('flex w-4 shrink-0 items-center justify-center text-muted-foreground', status === 'ignored' && 'opacity-50')} style={{ color: ink }}>
            {leafIcon}
          </span>
        )}
        {renaming === key ? (
          <Edit.Input
            aria-label={`Rename ${node.label}`}
            onKeyDown={own}
            onClick={own}
            onDoubleClick={own}
            className="-my-px min-w-0 flex-1 rounded-sm border-0 bg-card px-1 py-px [font-family:inherit] text-footnote text-foreground ring-2 ring-ring outline-none select-text"
          />
        ) : (
          <span className="min-w-0 truncate" style={{ color: ink }}>
            {/* The name is read whole; what shows is cut in pieces that each give way on their own. */}
            <span className="sr-only">{label}</span>
            {names ? (
              // A flattened row: each folder's name, with a slash between.
              <span aria-hidden="true" className="inline-flex items-center gap-0.5">
                {names.map((name, i) => <span key={i} className="contents">{i ? <span> / </span> : null}<span className="truncate">{name}</span></span>)}
              </span>
            ) : <RowName name={label} />}
          </span>
        )}
        {/* The detail describes the row (`aria-description` on the item); the row's name stays its label. */}
        {node.detail || gitStatus ? (
          <span aria-hidden="true" title={node.detailTitle} className="flex min-w-0 flex-1 basis-0 justify-end overflow-hidden text-end text-foreground/72">
            {/* Too long, it gives way at its start: its end (the part that tells rows apart) stays. */}
            {node.detail ? <span className="inline-flex max-w-full min-w-0 justify-end overflow-hidden whitespace-nowrap">{node.detail}</span> : null}
          </span>
        ) : null}
        {gitStatus ? (
          <span className={cn('flex w-3 shrink-0 items-center justify-center', !status && changed.has(key) && 'opacity-50')} style={{ color: ink ?? (changed.has(key) ? MODIFIED_INK : undefined) }}>
            {status ? (
              <span title={STATUS[status].label} className="inline-flex w-full items-center justify-center font-semibold">
                {STATUS[status].letter}<span className="sr-only">, {STATUS[status].label}</span>
              </span>
            ) : branch && changed.has(key) ? (
              <span title="Changes inside" className="inline-flex w-full items-center justify-center">
                <svg aria-hidden="true" width="6" height="6" viewBox="0 0 6 6" fill="currentColor" className="[transform:translateY(calc(0.65ex-50%))]"><circle cx="3" cy="3" r="3" /></svg>
                <span className="sr-only">, changes inside</span>
              </span>
            ) : null}
          </span>
        ) : null}
      </SdkTreeItemLabel>
    );
    const item = {
      value: key,
      'data-key': key,
      'aria-description': node.detail ? (node.detailTitle ?? node.detail) : undefined,
      'data-edit-id': onRename ? key : undefined,
      'data-dimmed': node.dimmed ? '' : undefined,
      'data-drop-target': dropTarget === key ? '' : undefined,
      className: 'group/tree-item absolute inset-x-(--tree-inset) outline-none',
      style: { top, height: rowHeight },
    };
    // A row with a preview is the card's trigger as well: the pointer or keyboard focus resting on it opens the card.
    return preview?.(node) != null
      ? <HoverCardTrigger key={key} controller={card as HoverCardController<TreeNode>} payload={node} render={<SdkTreeItem {...item} />}>{content}</HoverCardTrigger>
      : <SdkTreeItem key={key} {...item}>{content}</SdkTreeItem>;
  };

  const body = (renaming: string | null) => {
        renamingKey.current = renaming;
        return flat.length ? (
        <SdkTree
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          items={shape.items}
          {...({ mode, value, defaultValue } as object)}
          onValueChange={(next: unknown, details: ChangeDetails<string>) => {
            (onValueChange as ((next: unknown, details: ChangeDetails<string>) => void) | undefined)?.(next, details);
            if (!details.canceled && typeof next === 'string') setPicked(next);
          }}
          activation={activation}
          expanded={expanded}
          onExpandedChange={(next: string[], details: ChangeDetails<TreeExpandedChangeReason>) => {
            // A search opens every folder itself: what opens and closes meanwhile isn't kept.
            if (query) return;
            onExpandedChange?.(next, details);
            if (!details.canceled && expandedProp === undefined) setOwnExpanded(next);
          }}
          expandOnPress={expandOnPress}
          checkable={checkable}
          checked={checked}
          defaultChecked={defaultChecked}
          onCheckedChange={onCheckedChange}
          checkStrategy={checkStrategy}
          onAction={onAction}
          pendingAnnouncement={pendingAnnouncement}
          loadChildren={loadChildren}
          current={current}
          onHighlight={(key, details) => {
            setHighlighted(key);
            virtual.scrollToIndex(details.index);
            onHighlight?.(key, details);
          }}
          disabled={disabled}
          focusableWhenDisabled={focusableWhenDisabled}
          announcement={announcement}
          keepMounted={keepMounted}
          hiddenUntilFound={hiddenUntilFound}
          controller={controller}
          debug={debug}
          // Its own layer, so the rows paint on the same pixel grid while the list scrolls under them.
          className="relative isolate w-full outline-none will-change-transform"
          style={{ height: virtual.size }}
        >
          {virtual.items.map(({ index, start }) => row(index, start, renaming))}
        </SdkTree>
        ) : emptyMessage ?? (query ? <div className="px-3 py-6 text-center text-footnote text-muted-foreground">No matches</div> : null);
  };
  const scroller = {
    ref: virtual.scrollerRef,
    'data-drop-target': dropTarget === ROOT ? '' : undefined,
    // Rows sit 16px in from both sides; a thin scrollbar keeps its own gutter inside the right one, shown on hover.
    className: cn(
      'group/tree min-h-0 flex-1 overflow-auto rounded-ctl [scrollbar-color:auto] ps-[calc(16px-var(--tree-inset))] pe-[calc(10px-var(--tree-inset))] [scrollbar-gutter:stable] data-drop-target:[box-shadow:inset_0_0_0_2px_var(--primary)]',
      '[&::-webkit-scrollbar]:size-1.5 [&::-webkit-scrollbar-corner]:bg-transparent [&::-webkit-scrollbar-track]:bg-transparent',
      '[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border [&::-webkit-scrollbar-thumb]:border-transparent [&::-webkit-scrollbar-thumb]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-clip-content hover:[&::-webkit-scrollbar-thumb]:bg-secondary-strong',
    ),
    onFocusCapture: (e: FocusEvent<HTMLDivElement>) => { focusedKey.current = (e.target as Element).closest?.('[data-key]')?.getAttribute('data-key') ?? null; },
    onBlurCapture: (e: FocusEvent<HTMLDivElement>) => { if (!e.currentTarget.contains(e.relatedTarget)) focusedKey.current = null; },
    ...dropHandlers,
  };
  // Rename in place exists only with `onRename`: without it the scroller is a plain element and no rename field is
  // offered to agents. The group holds the tree, so it has the tree's name; an agent's `rename` step finds it by that
  // name too, since it is the one of the two that renames.
  const name = ariaLabel ?? 'tree';
  const tree = onRename ? (
    <Edit.Root
      aria-label={ariaLabelledBy ? undefined : name}
      aria-labelledby={ariaLabelledBy}
      editing={editing}
      onEditingChange={onEditingChange}
      textOf={(id) => nodeOf.get(id)?.label ?? ''}
      onCommit={(id, text, details) => {
        const node = nodeOf.get(id);
        const label = text.trim();
        if (!node || !label) return false;
        return onRename(node, label, details);
      }}
      {...scroller}
    >
      {({ editing: renaming }) => body(renaming)}
    </Edit.Root>
  ) : (
    <div {...scroller}>{body(null)}</div>
  );

  return (
    <div data-slot="tree-view" className={cn(treeVariants({ density }), 'flex min-h-0 flex-col', className)} style={style} {...(rootProps as RootProps)}>
      {search ? <SearchField aria-label={`Search ${name}`} placeholder="Search" className="mb-1.5 shrink-0" value={query} onValueChange={(next) => setQuery(next)} /> : null}
      {contextMenu ? (
        <ContextMenu
          onOpenChange={(isOpen, details) => {
            if (!isOpen) return;
            // The row under the pointer, or the row with focus for the menu key.
            const node = nodeAt(details.event?.target ?? null) ?? nodeAt(document.activeElement);
            if (!node || contextMenu(node) == null) return details.cancel();
            setMenuNode(node);
          }}
        >
          <ContextMenuTrigger className="flex min-h-0 flex-1 flex-col">{tree}</ContextMenuTrigger>
          {menuNode ? contextMenu(menuNode) : null}
        </ContextMenu>
      ) : tree}
      {preview ? (
        <HoverCard controller={card} onPayloadChange={(payload) => setPreviewNode((payload as TreeNode | undefined) ?? null)}>
          <HoverCardContent side="right" align="start">{previewNode ? preview(previewNode) : null}</HoverCardContent>
        </HoverCard>
      ) : null}
    </div>
  );
}

/* ── The tree's own file-type icons ──
   One-color glyphs in the row's icon ink, picked by a file's name or extension. The glyphs are the "standard" set of
   Trees (@pierre/trees, Apache-2.0, https://trees.software). */

type Glyph = readonly { d: string; o?: number; evenodd?: boolean }[];

const TYPE_GLYPHS: Record<string, Glyph> = {
  bash: [{ d: 'M8 1C2.24 1 1 2.24 1 8s1.24 7 7 7 7-1.24 7-7-1.24-7-7-7', o: 0.2 }, { d: 'M11.5 11a.5.5 0 0 1 0 1h-3a.5.5 0 0 1 0-1zM7 6.75C7 6.42 6.64 6 6 6s-1 .42-1 .75q-.01.25.22.41.26.21.89.35.74.14 1.28.53c.37.29.61.7.61 1.21 0 .87-.68 1.5-1.5 1.7v.55a.5.5 0 0 1-1 0v-.56c-.82-.18-1.5-.82-1.5-1.69a.5.5 0 0 1 1 0c0 .33.36.75 1 .75s1-.42 1-.75q.01-.25-.22-.41a2 2 0 0 0-.89-.35q-.74-.14-1.28-.53A1.5 1.5 0 0 1 4 6.75c0-.87.68-1.5 1.5-1.7V4.5a.5.5 0 0 1 1 0v.56c.82.18 1.5.82 1.5 1.69a.5.5 0 0 1-1 0' }],
  c: [{ d: 'M8 1q.084 0 .166.021.098.023.186.075c1.055.624 4.22 2.486 5.277 3.11.085.05.15.112.209.192h-.002l.028.037a.5.5 0 0 1 .103.21q.031.102.033.21v6.29a.71.71 0 0 1-.347.616l-5.307 3.144a.68.68 0 0 1-.693 0l-5.307-3.144A.72.72 0 0 1 2 11.145V4.832a.71.71 0 0 1 .346-.612l5.288-3.126A.7.7 0 0 1 7.992 1zm2.901 4.349a3.75 3.75 0 1 0 0 5.302l-1.06-1.06a2.25 2.25 0 1 1 0-3.182z', evenodd: true }],
  cpp: [{ d: 'M8 1q.084 0 .166.021.098.023.186.075c1.055.624 4.22 2.486 5.277 3.11.085.05.15.112.209.192h-.002l.028.037a.5.5 0 0 1 .103.21q.031.102.033.21v6.29a.71.71 0 0 1-.347.616l-5.307 3.144a.68.68 0 0 1-.693 0l-5.307-3.144A.72.72 0 0 1 2 11.145V4.832a.71.71 0 0 1 .346-.612l5.288-3.126A.7.7 0 0 1 7.992 1zm2.901 4.349a3.75 3.75 0 1 0 0 5.302l-1.06-1.06a2.25 2.25 0 1 1 0-3.182z', evenodd: true }],
  css: [{ d: 'M8 15c-5.76 0-7-1.24-7-7V2a1 1 0 0 1 1-1h6c5.77 0 7 1.24 7 7s-1.24 7-7 7', o: 0.2 }, { d: 'M10.1 9.19h.73c.03.49.22.6 1 .6.76 0 .93-.12.93-.68 0-.52-.17-.67-.94-.85-1.38-.3-1.68-.56-1.68-1.47 0-1.05.3-1.29 1.67-1.29 1.29 0 1.57.2 1.6 1.13h-.74c-.01-.34-.17-.42-.85-.42-.77 0-.94.1-.94.58 0 .42.17.55.96.73 1.36.3 1.66.58 1.66 1.59 0 1.14-.31 1.39-1.73 1.39-1.39 0-1.69-.24-1.67-1.31m-3.9 0h.74c.03.49.21.6.99.6.76 0 .93-.12.93-.68 0-.52-.17-.67-.93-.85-1.39-.3-1.69-.56-1.69-1.47 0-1.05.3-1.29 1.67-1.29 1.3 0 1.58.2 1.6 1.13h-.73c-.02-.34-.18-.42-.85-.42-.78 0-.95.1-.95.58 0 .42.17.55.96.73 1.37.3 1.67.58 1.67 1.59 0 1.14-.32 1.39-1.74 1.39-1.38 0-1.68-.24-1.66-1.31m-1.22 0h.75c-.09 1.07-.37 1.31-1.56 1.31-1.37 0-1.68-.45-1.68-2.5 0-1.96.36-2.5 1.68-2.5 1.16 0 1.44.25 1.52 1.35h-.76c-.08-.52-.22-.64-.76-.64-.74 0-.9.33-.9 1.78 0 1.47.16 1.8.9 1.8.58 0 .74-.11.8-.6' }],
  database: [{ d: 'M14.953 9.733a12.4 12.4 0 0 1-.244 1.936c-.207.933-.532 1.58-.996 2.044s-1.11.789-2.044.996C10.73 14.918 9.533 15 8 15s-2.73-.082-3.669-.291c-.933-.207-1.58-.532-2.044-.996s-.789-1.11-.996-2.044c-.122-.547-.2-1.182-.244-1.92q.23.364.532.667c.64.639 1.482 1.031 2.533 1.265 1.046.232 2.33.315 3.884.315 1.555 0 2.838-.083 3.884-.315 1.051-.234 1.893-.626 2.532-1.265a4 4 0 0 0 .541-.683' }, { d: 'M14.93 5.924c-.046.663-.118 1.24-.23 1.743-.207.932-.532 1.579-.995 2.042s-1.11.789-2.042.996c-.938.209-2.135.291-3.667.291-1.531 0-2.729-.082-3.667-.29-.932-.208-1.579-.534-2.042-.997s-.789-1.11-.996-2.042a12 12 0 0 1-.227-1.683l.016-.188a4 4 0 0 0 .5.62c.638.639 1.48 1.031 2.532 1.265 1.046.232 2.33.315 3.884.315 1.555 0 2.838-.083 3.884-.315 1.051-.234 1.893-.626 2.532-1.265.192-.192.357-.404.506-.633z' }, { d: 'M8 1c1.533 0 2.73.082 3.669.291.933.207 1.58.533 2.044.996.403.404.904.944.91 1.695.004.764-.509 1.318-.918 1.727-.463.463-1.11.789-2.042.996-.938.209-2.135.291-3.667.291-1.531 0-2.729-.082-3.667-.29-.932-.208-1.579-.534-2.042-.997-.406-.406-.915-.953-.915-1.71 0-.758.509-1.305.915-1.712.464-.463 1.11-.789 2.044-.996C5.27 1.082 6.467 1 8 1' }],
  default: [{ d: 'M8 1v3a3 3 0 0 0 3 3h3v5.5a2.5 2.5 0 0 1-2.5 2.5h-7A2.5 2.5 0 0 1 2 12.5v-9A2.5 2.5 0 0 1 4.5 1z', o: 0.4 }, { d: 'M9.5 1a.5.5 0 0 1 .354.146l4 4A.5.5 0 0 1 14 5.5V6h-3a2 2 0 0 1-2-2V1z' }],
  font: [{ d: 'M12.3 13c-1.59 0-2.68-.99-2.68-2.5 0-1.43 1-2.34 2.88-2.35h2.16v-.83c0-1.08-.62-1.68-1.73-1.68-1.05 0-1.66.54-1.73 1.36H9.93c.09-1.43 1.06-2.48 3.05-2.48 1.75 0 3.02.95 3.02 2.68v5.66h-1.29v-1.02h-.04c-.41.66-1.16 1.16-2.37 1.16m.36-1.12c1.14 0 2-.72 2-1.74v-.96H12.6c-1.12 0-1.6.54-1.6 1.28 0 .97.8 1.42 1.66 1.42m-11.24.98H0L3.8 2h1.39l3.8 10.86H7.54l-1.08-3.2H2.5zm3.09-9.25h-.04l-1.6 4.95H6.1z' }],
  git: [{ d: 'M14.74 7.38 8.62 1.26a.9.9 0 0 0-1.27 0L6.08 2.53l1.61 1.61a1.07 1.07 0 0 1 1.36 1.37l1.55 1.55a1.07 1.07 0 0 1 1.1 1.77 1.07 1.07 0 0 1-1.74-1.16L8.5 6.22v3.8a1.07 1.07 0 1 1-.89-.02V6.15a1.07 1.07 0 0 1-.58-1.4l-1.58-1.6-4.2 4.2a.9.9 0 0 0 0 1.27l6.12 6.12a.9.9 0 0 0 1.27 0l6.09-6.09a.9.9 0 0 0 0-1.27' }],
  go: [{ d: 'M4.41 4.57A3.2 3.2 0 0 1 6.87 5q.74.49 1.08 1.29.08.12-.1.16l-1.55.4c-.14.03-.15.04-.27-.1a1 1 0 0 0-.44-.34 1.6 1.6 0 0 0-1.68.14q-.95.61-.94 1.73c0 .73.52 1.33 1.25 1.43q.95.1 1.58-.6l.25-.34h-1.8c-.19 0-.24-.12-.17-.27.12-.28.34-.76.47-1a.3.3 0 0 1 .24-.14h2.98a4 4 0 0 1 .64-1.19 4 4 0 0 1 2.6-1.52 3.5 3.5 0 0 1 2.64.46q1.13.73 1.31 2.04a3.5 3.5 0 0 1-1.06 3.09q-.93.92-2.23 1.17l-.74.08a3.5 3.5 0 0 1-2.27-.8 3 3 0 0 1-.93-1.42 4 4 0 0 1-.39.61 4 4 0 0 1-2.64 1.56 3.3 3.3 0 0 1-2.5-.6 3 3 0 0 1-1.18-2.03 3.5 3.5 0 0 1 .8-2.67 4 4 0 0 1 2.6-1.58M13.1 7.5a1.53 1.53 0 0 0-1.9-1.21q-1.3.3-1.62 1.59a1.5 1.5 0 0 0 .85 1.72q.77.33 1.52-.05a2 2 0 0 0 1.18-1.74q0-.17-.03-.3', evenodd: true }],
  html: [{ d: 'M8 1C2.24 1 1 2.24 1 8s1.24 7 7 7 7-1.24 7-7-1.24-7-7-7', o: 0.2 }, { d: 'M10.48 3.76a.5.5 0 0 1 .4.58L10.6 5.8h1.14a.5.5 0 0 1 0 1h-1.32L10 9.2h1.08a.5.5 0 0 1 0 1H9.8l-.3 1.64a.5.5 0 1 1-.98-.18l.27-1.46H6.4l-.3 1.64a.5.5 0 1 1-.98-.18l.27-1.46H4.25a.5.5 0 0 1 0-1h1.32L6 6.8H4.93a.5.5 0 0 1 0-1H6.2l.3-1.64a.5.5 0 1 1 .98.18L7.2 5.8h2.4l.3-1.64a.5.5 0 0 1 .58-.4M6.58 9.2h2.4l.44-2.4h-2.4z' }],
  image: [{ d: 'M12.5 2A2.5 2.5 0 0 1 15 4.5v4.67l-4.05-3.54-4.08 4.08-3-2L1 10.6V4.5A2.5 2.5 0 0 1 3.5 2z', o: 0.3 }, { d: 'M15 10.5v1a2.5 2.5 0 0 1-2.5 2.5h-9a2.5 2.5 0 0 1-2.46-2.04L4 9l3 2 4-4zm-7-5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0' }],
  javascript: [{ d: 'M8 1C2.24 1 1 2.24 1 8s1.24 7 7 7 7-1.24 7-7-1.24-7-7-7', o: 0.2 }, { d: 'M8.1 9.64h.95c.04.62.28.76 1.28.76s1.2-.14 1.2-.85c0-.66-.2-.85-1.2-1.07-1.79-.38-2.18-.7-2.18-1.86C8.15 5.3 8.54 5 10.31 5c1.67 0 2.04.26 2.07 1.42h-.95c-.02-.43-.23-.53-1.1-.53-1 0-1.22.14-1.22.74 0 .52.22.7 1.24.92 1.76.38 2.15.73 2.15 2 0 1.44-.4 1.75-2.24 1.75-1.8 0-2.18-.3-2.15-1.66M3.5 9.5h.98c0 .76.15.92.85.92.77 0 .94-.18.94-1.02V5.1h1v4.34c0 1.54-.35 1.87-1.92 1.87-1.55 0-1.89-.32-1.86-1.8' }],
  json: [{ d: 'M13.25 11.5V9.75a.5.5 0 0 1 .36-.48l.55-.15a1.16 1.16 0 0 0 0-2.24l-.55-.15a.5.5 0 0 1-.36-.48V4.5a2.5 2.5 0 0 0-2.5-2.5h-.25a.5.5 0 0 0 0 1h.25a1.5 1.5 0 0 1 1.5 1.5v1.75a1.5 1.5 0 0 0 1.09 1.44l.54.15a.16.16 0 0 1 0 .32l-.54.15a1.5 1.5 0 0 0-1.09 1.44v1.75a1.5 1.5 0 0 1-1.5 1.5h-.25a.5.5 0 0 0 0 1h.25a2.5 2.5 0 0 0 2.5-2.5m-10.5 0V9.75a.5.5 0 0 0-.36-.48l-.55-.15a1.16 1.16 0 0 1 0-2.24l.55-.15a.5.5 0 0 0 .36-.48V4.5A2.5 2.5 0 0 1 5.25 2h.25a.5.5 0 0 1 0 1h-.25a1.5 1.5 0 0 0-1.5 1.5v1.75a1.5 1.5 0 0 1-1.09 1.44l-.54.15a.16.16 0 0 0 0 .32l.54.15a1.5 1.5 0 0 1 1.09 1.45v1.74a1.5 1.5 0 0 0 1.5 1.5h.25a.5.5 0 0 1 0 1h-.25a2.5 2.5 0 0 1-2.5-2.5' }],
  markdown: [{ d: 'M1 12V4h2l2 2.5L7 4h2v8H7V7.5l-2 2-2-2V12zm9-3 3 3.5L16 9h-2V4h-2v5z' }],
  mcp: [{ d: 'M9.26-.04a3 3 0 0 1 2 .82 2.8 2.8 0 0 1 .8 2.35 2.9 2.9 0 0 1 2.41.8l.03.02a2.74 2.74 0 0 1 0 3.94l-5.8 5.69-.04.06-.02.07q0 .04.02.07.01.04.04.06l1.2 1.17a.55.55 0 0 1 0 .79.6.6 0 0 1-.81 0l-1.2-1.17a1.3 1.3 0 0 1 0-1.84L13.7 7.1a1.65 1.65 0 0 0 .37-1.82 2 2 0 0 0-.37-.54l-.03-.03a1.73 1.73 0 0 0-2.4 0L6.47 9.4l-.07.06a.58.58 0 0 1-.92-.18.6.6 0 0 1 .12-.6l4.85-4.76a1.65 1.65 0 0 0 0-2.36 1.73 1.73 0 0 0-2.4 0l-6.43 6.3a.6.6 0 0 1-.8 0 .55.55 0 0 1 0-.8L7.25.79a3 3 0 0 1 2-.82' }, { d: 'M9.26 2.19a.6.6 0 0 1 .52.34.6.6 0 0 1 0 .43l-.12.18L4.9 7.79a1.65 1.65 0 0 0 0 2.36 1.73 1.73 0 0 0 2.4 0l4.75-4.66a.58.58 0 0 1 .93.18.6.6 0 0 1-.12.61l-4.75 4.66a2.9 2.9 0 0 1-4.01 0 2.75 2.75 0 0 1-.62-3.04A3 3 0 0 1 4.1 7l4.74-4.65a.6.6 0 0 1 .4-.16' }],
  python: [{ d: 'M8.33 8.4H10c1.16 0 1.9-.73 1.9-1.86V5.08q0-.24.25-.24h.74c.75 0 1.33.32 1.66.97q.4.73.41 1.46c.09.9.09 1.78-.24 2.67-.25.73-.75 1.3-1.58 1.46h-4.8c-.08 0-.25 0-.25.08v.4s.17.09.25.09h2.82q.34-.02.33.32v1.06c0 .56-.25.97-.75 1.13-.41.16-.83.33-1.24.4a7 7 0 0 1-2.98-.07 3 3 0 0 1-1.16-.49c-.33-.32-.58-.65-.5-1.14v-2.91c0-1.13.67-1.78 1.82-1.78q.89-.1 1.66-.08m2.32 4.86a.65.65 0 0 0-.66-.65c-.34 0-.67.33-.67.65s.33.57.67.65a.65.65 0 0 0 .66-.65', o: 0.8 }, { d: 'M7.67 7.6H6c-1.16 0-1.9.73-1.9 1.86v1.46q0 .24-.25.24h-.74c-.75 0-1.33-.32-1.66-.97a3 3 0 0 1-.41-1.46 6 6 0 0 1 .24-2.67c.25-.73.75-1.3 1.58-1.46h4.8c.08 0 .25 0 .25-.08v-.4s-.17-.09-.25-.09H4.85c-.24 0-.33-.08-.33-.32V2.65c0-.56.25-.97.75-1.13.41-.16.83-.33 1.24-.4a7 7 0 0 1 2.98.07c.41.09.83.25 1.16.49.33.32.58.65.5 1.13v2.92c0 1.14-.67 1.78-1.82 1.78-.58.08-1.16.08-1.66.08M5.35 2.73c0 .33.25.65.66.65.33 0 .66-.32.66-.65 0-.32-.33-.56-.66-.64a.65.65 0 0 0-.66.64' }],
  ruby: [{ d: 'M11.04 2c.48 0 .92.23 1.18.6l2.54 3.65c.37.52.3 1.23-.15 1.69l-5.58 5.64a1.47 1.47 0 0 1-2.06 0L1.39 7.94a1.3 1.3 0 0 1-.15-1.7l2.54-3.63q.2-.3.5-.45.33-.16.68-.16zm.84 2.17a.5.5 0 0 0-.7-.05L8 6.84 4.83 4.12a.5.5 0 0 0-.65.76L6.65 7H3.5a.5.5 0 0 0 0 1h9a.5.5 0 0 0 0-1H9.35l2.48-2.12a.5.5 0 0 0 .05-.7', evenodd: true }],
  rust: [{ d: 'M8 .8a.2.2 0 0 1 .18.1l.38.6.16.02.5-.53.01-.01a.2.2 0 0 1 .33.08l.25.68.16.05.59-.43h.02a.2.2 0 0 1 .3.14l.12.71.15.08.65-.3a.2.2 0 0 1 .2.02.2.2 0 0 1 .1.18l-.03.72.12.1.71-.16a.2.2 0 0 1 .25.25l-.17.7q.06.06.1.13l.73-.03A.2.2 0 0 1 14 4a.2.2 0 0 1 .02.2l-.3.66.08.14.71.12a.2.2 0 0 1 .14.32l-.43.59.05.16.68.25a.2.2 0 0 1 .07.35l-.53.49.01.16.62.38a.2.2 0 0 1 0 .36l-.62.38-.01.16.53.5a.2.2 0 0 1-.07.34l-.68.25-.05.16.43.59a.2.2 0 0 1-.14.32l-.72.12-.07.15.3.65a.2.2 0 0 1-.02.2.2.2 0 0 1-.18.1l-.72-.03-.1.13.16.7a.2.2 0 0 1-.25.25l-.7-.17-.13.1.03.73a.2.2 0 0 1-.1.18.2.2 0 0 1-.2.02l-.66-.3-.14.08-.12.71a.2.2 0 0 1-.32.14l-.59-.43-.16.05-.25.68a.2.2 0 0 1-.34.07l-.5-.53-.16.01-.38.62a.2.2 0 0 1-.36 0l-.38-.62-.16-.01-.5.53a.2.2 0 0 1-.34-.07l-.25-.68-.16-.05-.59.43a.2.2 0 0 1-.32-.14L5 13.78l-.15-.07-.65.3a.2.2 0 0 1-.2-.02.2.2 0 0 1-.1-.18l.03-.72-.13-.1-.7.16a.2.2 0 0 1-.25-.25l.17-.7-.1-.13-.73.03a.2.2 0 0 1-.2-.3l.3-.66-.08-.14-.71-.12a.2.2 0 0 1-.14-.32l.43-.59-.05-.16-.68-.25A.2.2 0 0 1 1 9.22l.53-.5-.02-.16-.6-.38A.2.2 0 0 1 .8 8a.2.2 0 0 1 .1-.18l.6-.38.02-.16-.53-.5a.2.2 0 0 1 .07-.34l.68-.25.05-.16-.43-.59a.2.2 0 0 1 .14-.32L2.2 5l.08-.15L2 4.2a.2.2 0 0 1 .2-.3l.72.03.1-.13-.16-.7a.2.2 0 0 1 .25-.25l.7.16.13-.1-.03-.72A.2.2 0 0 1 4 2a.2.2 0 0 1 .2-.02l.65.3L5 2.2l.12-.71v-.03a.2.2 0 0 1 .32-.1l.59.41.16-.04.25-.68.01-.02A.2.2 0 0 1 6.8.99l.49.53.16-.02.38-.61.02-.02A.2.2 0 0 1 8 .79M6.8 9.45h1.26l.06.01q.03.01.03.05v1.52q0 .07-.09.06h-4.5A5.4 5.4 0 0 0 8 13.42a5.4 5.4 0 0 0 4.45-2.33h-2.42c-.36 0-.68-.5-.77-.75-.08-.22-.2-.91-.25-1.12-.15-.61-.59-.71-.78-.73H6.8zM8 2.58a5.4 5.4 0 0 0-4.07 1.85h5.74l.17.02c.23.03.6.12.96.35.34.23.83.68.83 1.4 0 .66-.55 1.16-1.08 1.5.42.33.7.53.86 1.44.04.17.34.32.62.29.29-.03.62-.16.62-.75v-.24q0-.1.07-.1h.68A5.43 5.43 0 0 0 8 2.59M2.96 6.03a5.4 5.4 0 0 0-.19 3.37h1.66V6.03zM6.8 7.06h1.66c.35 0 .77-.12.77-.47 0-.42-.55-.53-.65-.53H6.8z', evenodd: true }],
  swift: [{ d: 'M9.63 1c6.15 4.35 4.16 9.15 4.16 9.15s1.75 2.05 1.04 3.85c0 0-.72-1.26-1.93-1.26-1.17 0-1.85 1.26-4.2 1.26C3.47 14 1 9.46 1 9.46c4.71 3.22 7.93.94 7.93.94C6.8 9.12 2.29 3 2.29 3c3.93 3.47 5.63 4.39 5.63 4.39-1.01-.87-3.86-5.13-3.86-5.13C6.34 4.66 10.86 8 10.86 8c1.28-3.7-1.23-7-1.23-7' }],
  table: [{ d: 'M8 4a3 3 0 0 0 3 3h3v5.5a2.5 2.5 0 0 1-2.5 2.5h-7A2.5 2.5 0 0 1 2 12.5v-9A2.5 2.5 0 0 1 4.5 1H8z', o: 0.4 }, { d: 'M11.5 8a.5.5 0 0 1 .5.5v4a.5.5 0 0 1-.5.5h-7a.5.5 0 0 1-.5-.5v-4a.5.5 0 0 1 .5-.5zM5 12h2.5v-1H5zm3.5 0H11v-1H8.5zM5 10h2.5V9H5zm3.5 0H11V9H8.5zm1-9a.5.5 0 0 1 .354.146l4 4A.5.5 0 0 1 14 5.5V6h-3a2 2 0 0 1-2-2V1z' }],
  text: [{ d: 'M8 4a3 3 0 0 0 3 3h3v5.5a2.5 2.5 0 0 1-2.5 2.5h-7A2.5 2.5 0 0 1 2 12.5v-9A2.5 2.5 0 0 1 4.5 1H8z', o: 0.4, evenodd: true }, { d: 'M8.5 11a.5.5 0 0 1 0 1h-3a.5.5 0 0 1 0-1zm2-2a.5.5 0 0 1 0 1h-5a.5.5 0 0 1 0-1zm-1-8a.5.5 0 0 1 .354.146l4 4A.5.5 0 0 1 14 5.5V6h-3a2 2 0 0 1-2-2V1z' }],
  typescript: [{ d: 'M8 1C2.24 1 1 2.24 1 8s1.24 7 7 7 7-1.24 7-7-1.24-7-7-7', o: 0.2 }, { d: 'M8.1 9.64h.95c.04.62.28.76 1.28.76s1.2-.14 1.2-.85c0-.66-.2-.85-1.2-1.07-1.79-.38-2.18-.7-2.18-1.86C8.15 5.3 8.54 5 10.31 5c1.67 0 2.04.26 2.07 1.42h-.95c-.02-.43-.23-.53-1.1-.53-1 0-1.22.14-1.22.74 0 .52.22.7 1.24.92 1.76.38 2.15.73 2.15 2 0 1.44-.4 1.75-2.24 1.75-1.8 0-2.18-.3-2.15-1.66m-3 1.57V5.99H3.5v-.9h4.21v.9H6.1v5.22z' }],
  zip: [{ d: 'M4.585 2a2 2 0 0 1 1.028.285l1.788 1.072a1 1 0 0 0 .514.143H12A2 2 0 0 1 13.935 5H0V4a2 2 0 0 1 2-2z', o: 0.5 }, { d: 'M14 12a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-1.25h1v-1H0V6h14zM9.9 8.25c-.883 0-1.9.5-1.9.5H7v1h1v1s1.017.5 1.9.5c.884 0 1.6-.672 1.6-1.5s-.716-1.5-1.6-1.5M2 9.75v1h1v-1zm2 0v1h1v-1zm2 0v1h1v-1zm-5-1v1h1v-1zm2 0v1h1v-1zm2 0v1h1v-1z', evenodd: true }],
};

/** Whole file names with a type of their own. */
const TYPE_NAMES: Record<string, string> = {
  bash: '.bash_profile .bashrc .zprofile .zshenv .zshrc',
  git: '.gitattributes .gitignore .gitkeep .gitmodules',
  ruby: 'gemfile rakefile',
  markdown: 'readme.md',
};

/** Extensions by type. */
const TYPE_EXTENSIONS: Record<string, string> = {
  zip: '7z bz2 gz jar rar tar tgz war xz zip',
  text: 'cfg conf editorconfig env env.development env.local env.production ini log rst rtf txt',
  image: 'avif bmp gif icns ico jpeg jpg png tif tiff webp',
  bash: 'bash csh fish ksh sh zsh',
  c: 'c h',
  cpp: 'cc cpp cxx hh hpp hxx inl mm',
  javascript: 'cjs js jsx mjs',
  css: 'css less postcss sass scss styl',
  table: 'csv ods tsv xls xlsx',
  typescript: 'cts mts ts tsx',
  database: 'db sql sqlite sqlite3',
  font: 'eot otf ttf woff woff2',
  ruby: 'erb gemspec rake rb',
  go: 'go',
  html: 'htm html xhtml',
  json: 'json json5 jsonc jsonl',
  markdown: 'markdown md mdx mdx.tsx',
  mcp: 'mcp',
  python: 'py pyi pyw pyx',
  rust: 'rs',
  swift: 'swift',
};
const TYPE_OF_NAME = new Map(Object.entries(TYPE_NAMES).flatMap(([type, names]) => names.split(' ').map((name) => [name, type] as const)));
const TYPE_OF_EXTENSION = new Map(Object.entries(TYPE_EXTENSIONS).flatMap(([type, exts]) => exts.split(' ').map((ext) => [ext, type] as const)));

/** The type of a file, from its whole name or else its longest known extension (`page.mdx.tsx` → `mdx.tsx`). */
function fileTypeOf(name: string): string {
  const lower = name.toLowerCase();
  const parts = lower.split('.');
  let type = TYPE_OF_NAME.get(lower);
  for (let i = 1; !type && i < parts.length; i++) type = TYPE_OF_EXTENSION.get(parts.slice(i).join('.'));
  return type ?? 'default';
}

/** A file's type icon in a Tree's row: one color (the row's icon ink), read from `name`. */
function TreeTypeIcon({ name }: { name: string }) {
  const type = fileTypeOf(name);
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" data-slot="tree-type-icon" data-type={type}>
      {(TYPE_GLYPHS[type] ?? TYPE_GLYPHS.default)?.map((path, i) => (
        <path key={i} d={path.d} fill="currentColor" opacity={path.o} fillRule={path.evenodd ? 'evenodd' : undefined} clipRule={path.evenodd ? 'evenodd' : undefined} />
      ))}
    </svg>
  );
}

/** Where a long name gives way: after its extension's dot (`page.` + `tsx`), else near its middle off a space. */
function splitName(name: string): [string, string] {
  const dot = name.lastIndexOf('.') + 1;
  if (dot >= 1 && name.length - dot <= 10) return [name.slice(0, dot), name.slice(dot)];
  const space = (i: number) => /\s/.test(name[i - 1] ?? '') || /\s/.test(name[i] ?? '');
  const center = Math.ceil(name.length / 2);
  let at = center;
  for (let offset = 1; space(at) && offset < name.length; offset++) {
    if (center - offset > 0 && !space(center - offset)) at = center - offset;
    else if (center + offset < name.length && !space(center + offset)) at = center + offset;
  }
  return [name.slice(0, at), name.slice(at)];
}

/** A row's name, cut in the middle when it doesn't fit: the start gives way first, then the end (its extension) loses
 *  its own start. */
function RowName({ name }: { name: string }) {
  const end = 'block min-w-0 truncate [direction:rtl] *:[unicode-bidi:plaintext]';
  if (name.length < 5) return <span aria-hidden="true" className="flex min-w-0"><span className={end}><span>{name}</span></span></span>;
  const [head, tail] = splitName(name);
  return (
    <span aria-hidden="true" className="flex min-w-0">
      <span className="block min-w-0 shrink-[999999] truncate">{head}</span>
      <span className={end}><span>{tail}</span></span>
    </span>
  );
}

/* ── File icons for lists of files outside a Tree ── */

/** A two-tone folder that opens with its row. */
export function TreeFolderIcon({ open, size = 18, className }: { open?: boolean; size?: number; className?: string }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 20 20" data-slot="tree-folder-icon" className={cn('text-link', className)}>
      <path d="M2 5.5A1.5 1.5 0 0 1 3.5 4h3.9l1.6 1.6H16.5A1.5 1.5 0 0 1 18 7.1V14.5A1.5 1.5 0 0 1 16.5 16h-13A1.5 1.5 0 0 1 2 14.5Z" fill="currentColor" opacity=".55" />
      {open
        ? <path d="M3.9 8.2A1.4 1.4 0 0 1 5.2 7.3h12.1a.9.9 0 0 1 .85 1.2l-2.2 6.6a1.4 1.4 0 0 1-1.3.9H3.3a.9.9 0 0 1-.85-1.2Z" fill="currentColor" />
        : <path d="M2 8.1A1.1 1.1 0 0 1 3.1 7h13.8A1.1 1.1 0 0 1 18 8.1v6.4a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 2 14.5Z" fill="currentColor" />}
    </svg>
  );
}

/* File-type badge inks: content colors that match each language's own brand, the same in light and dark. */
const BLUE = '#3178C6', YELLOW = '#D4A500', AMBER = '#C58B00', PURPLE = '#8E5CD9', GRAY = '#6E7781', ORANGE = '#E3912C';
const RED = '#E4572E', GOLD = '#E8A33D', GREEN = '#2EA36B', PINK = '#CB4B6F', SLATE = '#4B5563';

/** Extension → label and color, for `TreeFileIcon`. */
const FILE_KINDS: Record<string, { label: string; color: string }> = {
  ts: { label: 'TS', color: BLUE }, tsx: { label: 'TSX', color: BLUE },
  js: { label: 'JS', color: YELLOW }, jsx: { label: 'JSX', color: YELLOW }, mjs: { label: 'JS', color: YELLOW },
  json: { label: '{ }', color: AMBER }, css: { label: 'CSS', color: PURPLE },
  md: { label: 'MD', color: GRAY }, mdx: { label: 'MDX', color: ORANGE },
  stl: { label: 'STL', color: PURPLE },
  html: { label: 'HTML', color: RED }, svg: { label: 'SVG', color: GOLD },
  png: { label: 'PNG', color: GREEN }, jpg: { label: 'JPG', color: GREEN },
  yml: { label: 'YML', color: PINK }, yaml: { label: 'YML', color: PINK },
  sh: { label: 'SH', color: SLATE }, txt: { label: 'TXT', color: GRAY },
};

/** A page with a dog-ear and a colored badge for the file's type, read from `name`'s extension. */
export function TreeFileIcon({ name, size = 18, className }: { name: string; size?: number; className?: string }) {
  const ext = /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase() ?? '';
  const kind = FILE_KINDS[ext];
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 20 20" data-slot="tree-file-icon" data-ext={ext || undefined} className={className}>
      <path d="M5 2h6.6L16 6.4V16.5A1.5 1.5 0 0 1 14.5 18h-9A1.5 1.5 0 0 1 4 16.5v-13A1.5 1.5 0 0 1 5.5 2Z" fill="var(--card, white)" stroke="currentColor" strokeOpacity=".35" strokeWidth="1" />
      <path d="M11.5 2.2V5.4a1 1 0 0 0 1 1h3.3" fill="none" stroke="currentColor" strokeOpacity=".35" strokeWidth="1" />
      {kind ? <>
        <rect x="1" y="9" width={kind.label.length > 2 ? 16 : 13} height="8" rx="2" fill={kind.color} />
        <text x={kind.label.length > 2 ? 9 : 7.5} y="15.1" textAnchor="middle" fontSize={kind.label.length > 3 ? 4.3 : 5.4} fontWeight="800" letterSpacing="-.2"
          fontFamily="ui-sans-serif, system-ui, sans-serif" fill="white">{kind.label}</text>
      </> : <path d="M7 10h6M7 12.5h6M7 15h4" stroke="currentColor" strokeOpacity=".4" strokeWidth="1" strokeLinecap="round" />}
    </svg>
  );
}

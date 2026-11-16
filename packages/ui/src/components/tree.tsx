'use client';
import {
  Children, isValidElement, useCallback, useEffect, useMemo, useRef, useState,
  type CSSProperties, type DragEvent, type FocusEvent, type HTMLAttributes, type KeyboardEvent, type MouseEvent, type ReactNode,
} from 'react';
import {
  Tree as SdkTree, TreeGroup as SdkTreeGroup, TreeItem as SdkTreeItem, TreeItemCheckbox as SdkTreeItemCheckbox,
  TreeItemIndicator as SdkTreeItemIndicator, TreeItemLabel as SdkTreeItemLabel,
  createTreeController, treeFromPaths, visibleTreeRows,
  type TreeActionDetails, type TreeController, type TreeExpandedChangeReason, type TreeItemData, type TreeMode,
  type TreeProps as SdkTreeProps,
} from '@ui-sdk/react/tree';
import { createParts } from '@ui-sdk/react/primitive';
import type { ChangeDetails } from '@ui-sdk/core';
import { cva, type VariantProps } from 'class-variance-authority';
import { DropdownMenu, DropdownMenuContextTrigger } from '@/components/ui/dropdown-menu';
import { renderEmptyState } from '@/components/ui/empty-state';
import { HoverCard, HoverCardContent, HoverCardTrigger, createHoverCardController, type HoverCardController } from '@/components/ui/hover-card';
import { SearchInput } from '@/components/ui/search-input';
import { Skeleton } from '@/components/ui/skeleton';
import { FileTypeIcon } from '@/lib/file-icons';
import { Icon, type IconName } from '@/lib/icon';
import { inlineEdit, type InlineEditChangeDetails, type InlineEditDetails } from '@/lib/inline-edit-primitive';
import { useVirtualRows } from '@/lib/use-virtual-rows';
import { cn, cx } from '@/lib/utils';

/* ══ Tree — UI SDK's Tree with the kit's rows ══
   UI SDK owns the behavior: one tab stop, arrow keys between rows (Right and Left open, close and step in and out),
   Home and End, typing to find a row, selection (`mode`, `value`, `onValueChange`), expansion (`expanded`,
   `onExpandedChange`), checkboxes (`checkable`), `onAction` for a press (or a double press, `actionOn`) or Return, `current` for a page in a
   navigation tree, and a controller (`createTreeController`) to drive it from outside.

   Compose it from parts, for a short tree whose rows are yours:
   <Tree aria-label="Files">
     <TreeItem value="src">
       <TreeItemLabel><TreeItemIndicator />src</TreeItemLabel>
       <TreeGroup><TreeItem value="src/app.tsx"><TreeItemLabel>app.tsx</TreeItemLabel></TreeItem></TreeGroup>
     </TreeItem>
   </Tree>

   Or hand it the data and it draws the rows, only the ones in view (UI SDK's virtualizer), with what a file browser
   has: indent guides, file-type icons, a trailing note after the label, search, Git status, rename in place, a context menu
   and a hover preview per row, and drag and drop. A node with `children` (even an empty array) is a folder.
   <Tree aria-label="Files" items={[{ value: 'src', label: 'src', children: [{ value: 'src/app.tsx', label: 'app.tsx' }] }]}
     defaultExpanded="all" onAction={(value) => open(value)} />
   `renderRow` draws a row of your own on the same virtual tree (ObjectTree and CallStack are built that way):
   return a `TreeItemLabel`, which carries the row's look. ══ */

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
      comfortable: '[--tree-row-height:36px] [--tree-pad-x:9.6px] [--tree-gap:7.2px] [--tree-indent:24.28125px] [--tree-nudge:1.2px] [--tree-inset:2.4px]',
    },
  },
  defaultVariants: { density: 'default' },
});

export type TreeDensity = NonNullable<VariantProps<typeof treeVariants>['density']>;
const ROW_HEIGHT: Record<TreeDensity, number> = { compact: 24, default: 30, comfortable: 36 };

/** A row: the label inside an item. Selection, the current page and a disabled row show here; keyboard focus is on the
 *  item around it (`group/tree-item`). Each level moves the row's content in by `--tree-indent`. */
export const treeRowVariants = cva([
  'group/tree-row relative box-border flex h-(--tree-row-height) w-full min-w-0 cursor-default items-center gap-(--tree-gap) rounded-ctl pe-(--tree-pad-x) leading-(--tree-row-height) select-none',
  // Logical, so a row's own `ps-*` (ObjectTree's capped indent) merges with it, and the indent follows the text direction.
  'ps-[calc(var(--tree-pad-x)+(var(--tree-level,1)-1)*var(--tree-indent))]',
  'hover:not-data-disabled:not-data-selected:bg-secondary data-selected:bg-primary/16 data-current:font-medium data-disabled:opacity-50 data-pending:cursor-progress',
  'group-focus-visible/tree-item:[box-shadow:inset_0_0_0_2px_var(--ring)]',
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
  /** After the label, at the row's end: a count, a kind, a short status. */
  trailing?: ReactNode;
  /** What the row's `trailing` says, in words: its tooltip and the item's `aria-description`. Default: `trailing`,
   *  when it's a string. */
  description?: string;
  /** A leaf's icon, from the icon set (folders show their chevron). Overrides the file-type icon. */
  icon?: IconName;
  /** Shown faded: listed, but not the kind of thing this tree opens. */
  dimmed?: boolean;
}

/** Which pointer press runs a tree's `onAction`. */
export type TreeActionOn = 'press' | 'double-press';

/** `onAction`, run by a double press only: a click that is not the second of a pair is just a press (it selects).
 *  A click with `detail` 0 comes from assistive technology or `click()`, not a pointer, so it still runs. */
function actionFor<A extends (value: string, details: TreeActionDetails) => unknown>(onAction: A | undefined, actionOn: TreeActionOn | undefined) {
  if (!onAction || actionOn !== 'double-press') return onAction;
  return ((value, details) => {
    const event = details.event;
    const presses = event?.type === 'click' && event instanceof UIEvent ? event.detail : 0;
    if (presses !== 0 && presses !== 2) return undefined;
    return onAction(value, details);
  }) as A;
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

/** What `onAction` gets after the value: UI SDK's action details, with the node that ran in a tree drawn from `items`. */
export type TreeNodeActionDetails = TreeActionDetails & {
  /** The row's node. Always there in a tree drawn from `items`; a tree composed from parts has none. */
  node?: TreeNode;
};

/** What `renderRow` gets beside the node. */
export interface TreeRowState {
  /** 1 for a top-level row. */
  level: number;
  /** A folder: it has children, even none yet. */
  branch: boolean;
  /** An open folder. */
  expanded: boolean;
}

/** The props both kinds of tree take: UI SDK's, with the kit's look. */
type TreeSharedProps<Mode extends TreeMode> = Omit<
  SdkTreeProps<Mode>,
  'items' | 'paths' | 'children' | 'defaultExpanded' | 'className' | 'style' | 'contextMenu' | 'onDragStart' | 'onDrop' | 'onAction'
> & {
  /** An item ran: a press (or a double press, with `actionOn`) or Return. In a tree drawn from `items`,
   *  `details.node` is the row's node. Return a Promise and the row shows `data-pending` until it settles. */
  onAction?: (value: string, details: TreeNodeActionDetails) => unknown;
  className?: string;
  style?: CSSProperties;
  /** Row height and indent: `compact` 24px rows, `default` 30px, `comfortable` 36px. */
  density?: TreeDensity;
  /** Which pointer press runs `onAction`: any press (the default), or only a double press, as a file browser opens
   *  files while a single click only selects. Return runs it either way, and the arrow keys never do. */
  actionOn?: TreeActionOn;
};

/** What only a tree drawn from its data takes. */
export interface TreeDataOptions {
  /** The whole hierarchy as data: the tree draws the rows, only the ones in view. */
  items?: readonly TreeNode[];
  /** File paths instead of `items` (`['src/index.ts', 'README.md']`); folders become branches. */
  paths?: readonly string[];
  /** The branches open at first: these, or every one (`'all'`, which also opens branches that arrive later). */
  defaultExpanded?: string[] | 'all';
  /** Branches to open, with the branches above them, when they join this list (a schema that appears, the folders
   *  above the open file). The user can still close one: it stays closed while it stays listed. Left alone when
   *  `expanded` controls the tree. */
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
  /** A `DropdownMenuContent` for the node, opened by right-click, long-press or the menu key. Return nothing for a row
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
  /** The data isn't here yet: placeholder rows show while there are none, and the tree is `aria-busy`. */
  loading?: boolean;
  /** Shown instead of the rows when there are none: a node, or the title of the kit's `EmptyState`. Default: "No
   *  matches" while searching, "No items" otherwise. `null` (or `''`) shows nothing. */
  emptyState?: ReactNode;
  /** Draws a row of your own: return a `TreeItemLabel` (it carries the row's look, the selection and the name the
   *  keyboard finds by), with a `TreeItemIndicator` in it for a branch. The item around it, its place in the scroll and
   *  its keyboard focus stay the tree's. Without it, the tree draws its file-browser row. */
  renderRow?: (node: TreeNode, state: TreeRowState) => ReactNode;
}

/** A tree drawn from `items` (or `paths`): virtualized, with the file browser's rows or your own. */
export type TreeDataProps<Mode extends TreeMode = 'single'> = TreeSharedProps<Mode> & TreeDataOptions & { children?: undefined };

/** A tree composed from parts: your `TreeItem`s, in the kit's look. */
export type TreePartsProps<Mode extends TreeMode = 'single'> = TreeSharedProps<Mode> & { [K in Exclude<keyof TreeDataOptions, 'defaultExpanded'>]?: undefined } & {
  /** The items, as `TreeItem`s with a `TreeItemLabel` each. */
  children: SdkTreeProps<Mode>['children'];
  /** The branches open at first. */
  defaultExpanded?: string[];
};

/** Hand it `items` and it draws them; give it children and it is UI SDK's composition. The data-only props exist only
 *  on the first. */
export type TreeProps<Mode extends TreeMode = 'single'> = TreeDataProps<Mode> | TreePartsProps<Mode>;

export function Tree<Mode extends TreeMode = 'single'>(props: TreeProps<Mode>) {
  if (props.children === undefined) return <DataTree {...(props as TreeDataProps<TreeMode>)} />;
  const { density, actionOn, onAction, className, ...rest } = props as TreePartsProps<TreeMode>;
  return (
    <SdkTree
      onAction={actionFor(onAction, actionOn)}
      className={cn(treeVariants({ density }), 'flex flex-col outline-none', className)}
      {...(rest as SdkTreeProps<TreeMode>)}
    />
  );
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

/* Git inks (the `git-*` tokens): each status's hue leaned toward the text color, so it keeps contrast in light and dark. */
const STATUS: Record<TreeGitStatus, { letter: string; label: string; ink: string }> = {
  added: { letter: 'A', label: 'Added', ink: 'text-git-added' },
  untracked: { letter: 'U', label: 'Untracked', ink: 'text-git-added' },
  modified: { letter: 'M', label: 'Modified', ink: 'text-git-modified' },
  renamed: { letter: 'R', label: 'Renamed', ink: 'text-git-renamed' },
  deleted: { letter: 'D', label: 'Deleted', ink: 'text-git-deleted' },
  ignored: { letter: 'I', label: 'Ignored', ink: 'text-git-ignored' },
};

const Edit = createParts(inlineEdit, { root: 'div', input: 'input' });

/** A row holds a field while it is renamed: its keys and presses aren't the row's. */
const own = (e: KeyboardEvent | MouseEvent) => e.stopPropagation();

/** The placeholder rows while a tree loads: each one's level and width. */
const PLACEHOLDER_ROWS: readonly (readonly [number, string])[] = [[1, '38%'], [2, '56%'], [2, '44%'], [2, '50%'], [1, '30%']];

/** The tree itself as a drop target. */
const ROOT = '\u0000root';

function DataTree({
  items: itemsProp, paths, defaultExpanded, expanded: expandedProp, onExpandedChange, autoExpand, density = 'default', actionOn,
  sort, search, flatten, icons = true, gitStatus, contextMenu, preview, editing, onEditingChange, onRename,
  canDrag, onDragStart, onMove, canMove, externalDrop, loading, emptyState, renderRow,
  mode, value, defaultValue, onValueChange, activation, expandOnPress, checkable, checked, defaultChecked, onCheckedChange, checkStrategy,
  onAction, pendingAnnouncement, loadChildren, current, onHighlight, disabled, focusableWhenDisabled, announcement, controller: controllerProp, debug,
  keepMounted, hiddenUntilFound,
  'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledBy, className, style, ...rootProps
}: TreeDataProps<TreeMode>) {
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
  /** What `autoExpand` has opened already: a branch the user closed since stays closed while it stays listed. */
  const autoOpened = useRef(new Set<string>());
  useEffect(() => {
    const { shape: at, autoExpand: list } = live.current;
    if (!list?.length) return;
    const wanted: string[] = [];
    for (const id of list) {
      if (autoOpened.current.has(id) || !at.nodeOf.has(at.alias.get(id) ?? id)) continue;
      autoOpened.current.add(id);
      for (let v: string | null | undefined = at.alias.get(id) ?? id; v != null && at.nodeOf.has(v); v = at.parentOf.get(v)) wanted.push(v);
    }
    // Gone from the list, it opens again if it comes back.
    for (const id of autoOpened.current) if (!list.includes(id)) autoOpened.current.delete(id);
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
  const expandedSet = useMemo(() => new Set(expanded), [expanded]);
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

  /* The element that scrolls. */
  const scrollerEl = useRef<HTMLElement | null>(null);
  const { scrollerRef: connectScroller } = virtual;
  const scrollerRef = useCallback((el: HTMLElement | null) => {
    scrollerEl.current = el;
    return connectScroller(el);
  }, [connectScroller]);

  /* A selection set from outside comes into view: a step to the next row scrolls only as far as it takes, a jump
     lands mid-list, with the rows around it on show. Scrolling away from it afterward is the user's to do. */
  const revealKey = typeof value === 'string' ? value : null;
  const reveal = useRef({ indexOf, rowHeight, scrollToIndex: virtual.scrollToIndex });
  reveal.current = { indexOf, rowHeight, scrollToIndex: virtual.scrollToIndex };
  useEffect(() => {
    const { indexOf: at, rowHeight: height, scrollToIndex: scrollTo } = reveal.current;
    const index = revealKey == null ? undefined : at.get(revealKey);
    if (index === undefined) return;
    const list = scrollerEl.current;
    const top = index * height;
    const view = list?.clientHeight ?? 0;
    const away = list ? Math.max(list.scrollTop - top, top + height - (list.scrollTop + view)) : 0;
    scrollTo(index, { align: view && away > view ? 'center' : 'auto' });
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
    const key = shown.item.value;
    const branch = !!shown.item.children;
    const content = renderRow ? renderRow(node, { level: shown.level, branch, expanded: branch && expandedSet.has(key) }) : fileRow(shown, node, renaming);
    const item = {
      value: key,
      'data-key': key,
      'aria-description': node.description ?? (typeof node.trailing === 'string' && node.trailing ? node.trailing : undefined),
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

  /** The file browser's row: indent guides, a chevron or an icon, the name, a trailing note and the Git status. */
  const fileRow = (shown: (typeof flat)[number], node: TreeNode, renaming: string | null) => {
    const { value: key, label } = shown.item;
    const branch = !!shown.item.children;
    const status = gitStatus?.[key];
    const ink = status ? STATUS[status].ink : undefined;
    const hasTrailing = node.trailing != null && node.trailing !== false && node.trailing !== '';
    const leafIcon = node.icon ? <Icon name={node.icon} size={16} />
      : icons ? <FileTypeIcon name={node.label} />
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
    return (
      <SdkTreeItemLabel className={treeRowVariants()} {...dragHandlers(node)}>
        {guides}
        {checkable ? <TreeItemCheckbox /> : null}
        {branch ? <TreeItemIndicator /> : (
          <span className={cn('flex w-4 shrink-0 items-center justify-center text-muted-foreground', status === 'ignored' && 'opacity-50', ink)}>
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
          <span className={cn('min-w-0 truncate', ink)}>
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
        {/* The trailing text describes the row (`aria-description` on the item); the row's name stays its label. */}
        {hasTrailing || gitStatus ? (
          <span aria-hidden="true" title={node.description} className="flex min-w-0 flex-1 basis-0 justify-end overflow-hidden text-end text-foreground/72">
            {/* Too long, it gives way at its start: its end (the part that tells rows apart) stays. */}
            {hasTrailing ? <span className="inline-flex max-w-full min-w-0 justify-end overflow-hidden whitespace-nowrap">{node.trailing}</span> : null}
          </span>
        ) : null}
        {gitStatus ? (
          <span className={cn('flex w-3 shrink-0 items-center justify-center', !status && changed.has(key) && 'opacity-50', ink ?? (changed.has(key) ? STATUS.modified.ink : undefined))}>
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
          onAction={actionFor(onAction && ((key: string, details: TreeActionDetails) => {
            const node = nodeOf.get(key);
            return node ? onAction(key, { ...details, node }) : undefined;
          }), actionOn)}
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
        ) : loading && !query ? placeholder
          : renderEmptyState(emptyState, { title: query ? 'No matches' : 'No items' });
  };
  const scroller = {
    ref: scrollerRef,
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
  // Rows to come: a top-level row with a few inside it, at the rows' own height and indent.
  const placeholder = (
    <div role="group" aria-label={`Loading ${name}`} className="flex flex-col px-(--tree-inset)">
      {PLACEHOLDER_ROWS.map(([level, width], i) => (
        <div key={i} className={cn('flex h-(--tree-row-height) items-center', level === 1 ? 'ps-(--tree-pad-x)' : 'ps-[calc(var(--tree-pad-x)+var(--tree-indent))]')}>
          <Skeleton shape="text" className="h-2.5" style={{ width }} />
        </div>
      ))}
    </div>
  );
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
    <div data-slot="tree-view" aria-busy={loading || undefined} className={cn(treeVariants({ density }), 'flex min-h-0 flex-col', className)} style={style} {...(rootProps as RootProps)}>
      {search ? <SearchInput aria-label={`Search ${name}`} placeholder="Search" className="mx-4 mb-1.5 shrink-0" value={query} onValueChange={(next) => setQuery(next)} /> : null}
      {contextMenu ? (
        <DropdownMenu
          onOpenChange={(isOpen, details) => {
            if (!isOpen) return;
            // The row under the pointer, or the row with focus for the menu key.
            const node = nodeAt(details.event?.target ?? null) ?? nodeAt(document.activeElement);
            if (!node || contextMenu(node) == null) return details.cancel();
            setMenuNode(node);
          }}
        >
          <DropdownMenuContextTrigger className="flex min-h-0 flex-1 flex-col">{tree}</DropdownMenuContextTrigger>
          {menuNode ? contextMenu(menuNode) : null}
        </DropdownMenu>
      ) : tree}
      {preview ? (
        <HoverCard controller={card} onPayloadChange={(payload) => setPreviewNode((payload as TreeNode | undefined) ?? null)}>
          <HoverCardContent side="end" align="start">{previewNode ? preview(previewNode) : null}</HoverCardContent>
        </HoverCard>
      ) : null}
    </div>
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

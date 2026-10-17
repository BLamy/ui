'use client';
import { useEffect, useMemo, useRef, useState, type DragEvent, type HTMLAttributes, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import {
  prepareFileTreeInput, preparePresortedFileTreeInput,
  type FileTreeDensity, type FileTreeDirectoryHandle, type FileTreeIconConfig, type FileTreeRowDecoration, type GitStatus,
} from '@pierre/trees';
import { FileTree, useFileTree } from '@pierre/trees/react';
import { ContextMenu } from '@/components/ui/context-menu';
import { SearchField } from '@/components/ui/search-field';
import { IC, type IconName, type IconShape } from '@/lib/icon';
import { cn } from '@/lib/utils';

/* ══ Tree — a hierarchy on Trees (@pierre/trees, https://trees.software): a virtualized, keyboard-driven tree with
   indent guides, file-type icons, search, Git status, inline rename and drag and drop. Pass the data as
   nested `items`; a node with `children` (even an empty array) is a folder. Rows are identified by `id`.
   <Tree aria-label="Files" items={[{ id: 'src', name: 'src', children: [{ id: 'app', name: 'app.tsx' }] }]}
     defaultExpanded="all" onSelectionChange={([id]) => open(id)} />
   Trees is path-first: each node becomes a path built from its ancestors' names. Two siblings may share a name and a
   name may hold a slash; the tree keeps them apart without changing what it shows. ══ */

export interface TreeNode {
  id: string;
  /** The row's label. For files it also picks the file-type icon (by extension or exact name). */
  name: string;
  /** A folder's children. An empty array is an empty folder; leave it out for a leaf. */
  children?: readonly TreeNode[];
  /** After the label: a count, a kind, a short status. */
  detail?: string;
  /** The detail's tooltip and accessible description. */
  detailTitle?: string;
  /** A leaf's icon, from the icon set (folders show their chevron). Overrides the file-type icon. */
  icon?: IconName;
  /** Shown faded: listed, but not the kind of thing this tree opens. */
  dimmed?: boolean;
}

export type TreeGitStatus = GitStatus;

/** Where a drag would land: a folder, or the tree itself (`null`). */
export type TreeDropTarget = TreeNode | null;

export interface TreeProps extends Omit<HTMLAttributes<HTMLElement>, 'children' | 'onSelect' | 'onDrop' | 'onDragStart' | 'contextMenu'> {
  'aria-label': string;
  items: readonly TreeNode[];
  /** Folders first, then A→Z, as a file browser lists them. Default: the order of `items`. */
  sort?: boolean;
  /** The selected rows. Setting it selects them and scrolls the first into view. */
  selectedIds?: readonly string[];
  /** Selection when the tree mounts, for an uncontrolled tree. */
  defaultSelectedIds?: readonly string[];
  /** A click, a ⌘- or ⇧-click, or the arrow keys changed the selection. */
  onSelectionChange?: (ids: string[]) => void;
  /** Double-click or Return on a row. */
  onAction?: (node: TreeNode) => void;
  /** Which folders start open: all, none (the default), or these. */
  defaultExpanded?: 'all' | 'none' | readonly string[];
  /** Folders to open whenever they appear in this list (with their ancestors). The user can still close them. */
  expandedIds?: readonly string[];
  /** A search field over the rows; typing keeps only the matches and the folders above them. */
  search?: boolean;
  /** Show a chain of folders that each hold only one folder as one row (`src / app / ui`), as code editors do. */
  flatten?: boolean;
  /** The file-type icon set (default `standard`), or `none` for no leaf icon except a node's own `icon`. */
  icons?: 'minimal' | 'standard' | 'complete' | 'none';
  /** Git-style status by node id; folders show when something inside them changed. */
  gitStatus?: Readonly<Record<string, TreeGitStatus>>;
  /** Row height and spacing. */
  density?: FileTreeDensity;
  /** A `ContextMenuContent` for the node, opened by right-click, long-press or the menu key. */
  contextMenu?: (node: TreeNode) => ReactNode;
  /** The row being renamed in place; Return commits (`onRename`), Escape or a click away cancels (`onRenameEnd`). */
  renamingId?: string | null;
  onRename?: (node: TreeNode, name: string) => void;
  /** Renaming finished, committed or not. */
  onRenameEnd?: () => void;
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
}

/* ── Nodes ↔ paths ── */

/** Invisible, so two same-named siblings render alike yet have distinct paths. */
const ZWSP = '​';
/** A slash in a name would start a new folder: show a look-alike instead. */
const SLASH = '∕';

interface Index {
  paths: string[];
  byPath: Map<string, TreeNode>;
  pathOf: Map<string, string>;
  /** Leaves with their own icon, by path segment. */
  icons: Map<string, IconName>;
  dimmed: string[];
}

function indexOf(items: readonly TreeNode[]): Index {
  const index: Index = { paths: [], byPath: new Map(), pathOf: new Map(), icons: new Map(), dimmed: [] };
  const walk = (nodes: readonly TreeNode[], parent: string) => {
    const taken = new Set<string>();
    for (const node of nodes) {
      let segment = node.name.replaceAll('/', SLASH).trim() || 'Untitled';
      // Leading, so the extension (and with it the file-type icon) is untouched.
      while (taken.has(segment)) segment = ZWSP + segment;
      taken.add(segment);
      const path = parent + segment + (node.children ? '/' : '');
      index.paths.push(path);
      index.byPath.set(path, node);
      index.pathOf.set(node.id, path);
      if (node.icon && !node.children) index.icons.set(segment, node.icon);
      if (node.dimmed) index.dimmed.push(path);
      if (node.children) walk(node.children, path);
    }
  };
  walk(items, '');
  return index;
}

const prepare = (paths: string[], sort?: boolean) => (sort ? prepareFileTreeInput(paths) : preparePresortedFileTreeInput(paths));

/* ── Icons: the icon set as an SVG sprite the tree can reference ── */

function shapeMarkup(s: IconShape) {
  if (s.k || s.bg) return '';
  const paint = `fill="${s.f ? 'currentColor' : 'none'}" stroke="${s.f === 1 ? 'none' : 'currentColor'}" stroke-width="${1.8 * (s.w ?? 1)}" stroke-linecap="round" stroke-linejoin="round"${s.fr ? ' fill-rule="evenodd"' : ''}`;
  if (s.d) return `<path d="${s.d}" ${paint}/>`;
  if (s.c) return `<circle cx="${s.c[0]}" cy="${s.c[1]}" r="${s.c[2]}" ${paint}/>`;
  if (s.r) return `<rect x="${s.r[0]}" y="${s.r[1]}" width="${s.r[2]}" height="${s.r[3]}" rx="${s.r[4] ?? 0}" ${paint}/>`;
  return '';
}

const symbolId = (name: string) => `bl-tree-icon-${name}`;
/** An empty symbol: no leaf icon. */
const BLANK = 'bl-tree-icon-blank';

function iconConfig(index: Index, icons: TreeProps['icons']): FileTreeIconConfig {
  const names = [...new Set(index.icons.values())];
  const sprite = `<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" style="position:absolute" aria-hidden="true"><symbol id="${BLANK}" viewBox="0 0 24 24"></symbol>${names
    .map((n) => `<symbol id="${symbolId(n)}" viewBox="0 0 24 24">${(IC[n] ?? []).map(shapeMarkup).join('')}</symbol>`).join('')}</svg>`;
  const ref = (name: string) => ({ name, viewBox: '0 0 24 24', width: 16, height: 16 });
  return {
    set: icons === 'none' ? 'none' : (icons ?? 'standard'),
    colored: true,
    spriteSheet: sprite,
    ...(icons === 'none' ? { remap: { 'file-tree-icon-file': ref(BLANK) } } : {}),
    byFileName: Object.fromEntries([...index.icons].map(([segment, name]) => [segment, ref(symbolId(name))])),
  };
}

/** The path of the row an event came from, through the tree's shadow root. */
function rowPathOf(e: Event): string | null {
  for (const el of e.composedPath()) {
    if (el instanceof HTMLElement && el.dataset.itemPath) return el.dataset.itemPath;
  }
  return null;
}

const quote = (path: string) => JSON.stringify(path);

export function Tree({
  'aria-label': ariaLabel, items, sort, selectedIds, defaultSelectedIds, onSelectionChange, onAction, defaultExpanded = 'none',
  expandedIds, search, flatten, icons, gitStatus, density = 'default', contextMenu, renamingId, onRename, onRenameEnd,
  canDrag, onDragStart, onMove, canMove, externalDrop, className, ...hostProps
}: TreeProps) {
  const index = useMemo(() => indexOf(items), [items]);
  const live = useRef({ index, selectedIds, gitStatus, onSelectionChange, onRename, onRenameEnd, canDrag, onMove, canMove });
  live.current = { index, selectedIds, gitStatus, onSelectionChange, onRename, onRenameEnd, canDrag, onMove, canMove };
  const nodesOf = (paths: readonly string[]) => paths.flatMap((p) => live.current.index.byPath.get(p) ?? []);
  const targetOf = (path: string | null): TreeDropTarget => (path ? live.current.index.byPath.get(path) ?? null : null);
  /** Selection we're applying ourselves, so it doesn't echo back as a change (the tree may report it later). */
  const syncing = useRef(false);
  const applied = useRef<string | null>(null);

  const { model } = useFileTree({
    preparedInput: prepare(index.paths, sort),
    initialExpansion: defaultExpanded === 'all' ? 'open' : 'closed',
    initialExpandedPaths: Array.isArray(defaultExpanded) ? defaultExpanded.flatMap((id) => index.pathOf.get(id) ?? []) : undefined,
    initialSelectedPaths: (selectedIds ?? defaultSelectedIds ?? []).flatMap((id) => index.pathOf.get(id) ?? []),
    // Our own SearchField drives the search (`setSearch`): the tree's built-in field sits inside its `role=tree`.
    search: false,
    fileTreeSearchMode: 'hide-non-matches',
    flattenEmptyDirectories: !!flatten,
    density,
    icons: iconConfig(index, icons),
    gitStatus: gitStatusOf(index, gitStatus),
    onSelectionChange: (paths) => {
      const ids = nodesOf(paths).map((n) => n.id);
      if (syncing.current || JSON.stringify(ids) === applied.current) return;
      applied.current = null;
      live.current.onSelectionChange?.(ids);
      // Controlled: once the owner has answered, the tree shows what it chose, even when it kept the old selection.
      if (live.current.selectedIds) setTimeout(() => applySelection(live.current.selectedIds ?? [], live.current.index, false));
    },
    renderRowDecoration: ({ item }): FileTreeRowDecoration | null => {
      const node = live.current.index.byPath.get(item.path);
      return node?.detail ? { text: node.detail, ...(node.detailTitle ? { title: node.detailTitle } : {}) } : null;
    },
    renaming: {
      canRename: ({ path }) => !!live.current.onRename && live.current.index.byPath.get(path)?.id === renamingRef.current,
      onRename: ({ sourcePath, destinationPath }) => {
        const node = live.current.index.byPath.get(sourcePath);
        const name = destinationPath.replace(/\/$/, '').split('/').at(-1)?.replaceAll(ZWSP, '').replaceAll(SLASH, '/').trim();
        if (node && name && name !== node.name) live.current.onRename?.(node, name);
        settle();
        endRename();
      },
      onError: () => { settle(); endRename(); },
    },
    dragAndDrop: {
      canDrag: (paths) => !!live.current.canDrag?.(nodesOf(paths)),
      canDrop: ({ draggedPaths, target }) => {
        const { onMove: move, canMove: can } = live.current;
        return !!move && (can?.(nodesOf(draggedPaths), targetOf(target.directoryPath)) ?? true);
      },
      onDropComplete: ({ draggedPaths, target }) => {
        live.current.onMove?.(nodesOf(draggedPaths), targetOf(target.directoryPath));
        settle();
      },
    },
  });

  /* Rebuild from `items`, keeping what's open and what's selected. */
  const shown = useRef(index);
  function resetFrom(next: Index) {
    const before = shown.current;
    const open = [...before.byPath].filter(([p, n]) => n.children && (model.getItem(p) as FileTreeDirectoryHandle | null)?.isExpanded()).map(([, n]) => n.id);
    const selected = model.getSelectedPaths().flatMap((p) => before.byPath.get(p)?.id ?? []);
    const focused = before.byPath.get(model.getFocusedPath() ?? '')?.id;
    const host = model.getFileTreeContainer();
    const hadFocus = !!host && (document.activeElement === host || host.contains(document.activeElement));
    shown.current = next;
    syncing.current = true;
    try {
      model.resetPaths({ preparedInput: prepare(next.paths, sort), initialExpandedPaths: open.flatMap((id) => next.pathOf.get(id) ?? []) });
      const keep = live.current.selectedIds ?? selected;
      for (const id of keep) { const p = next.pathOf.get(id); if (p) model.getItem(p)?.select(); }
      applied.current = JSON.stringify(keep.filter((id) => next.pathOf.has(id)));
      model.setGitStatus(gitStatusOf(next, live.current.gitStatus));
      // Keep the keyboard where it was (only when the tree has focus, so a background update never takes it).
      const focusPath = focused ? next.pathOf.get(focused) : undefined;
      if (hadFocus && focusPath) model.focusPath(focusPath);
    } finally { syncing.current = false; }
  }
  /** After the tree moved or renamed a row itself: once it's done, show `items` again (with the change, if the
      owner took it). What the tree reports in between is its own bookkeeping, not the user's selection. */
  function settle() {
    syncing.current = true;
    setTimeout(() => { syncing.current = false; resetFrom(live.current.index); });
  }
  useEffect(() => {
    if (index === shown.current) return;
    resetFrom(index);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a new tree shape is the only trigger.
  }, [index]);

  const iconKey = useMemo(() => JSON.stringify([icons, [...index.icons]]), [icons, index]);
  const firstIcons = useRef(iconKey);
  useEffect(() => {
    if (iconKey !== firstIcons.current) model.setIcons(iconConfig(index, icons));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iconKey]);
  const gitKey = JSON.stringify(gitStatus ?? null);
  const firstGit = useRef(gitKey);
  useEffect(() => {
    if (gitKey !== firstGit.current) { firstGit.current = gitKey; model.setGitStatus(gitStatusOf(shown.current, gitStatus)); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gitKey]);

  /* Controlled selection: select exactly these, and bring the first into view. */
  function applySelection(ids: readonly string[], at: Index, reveal: boolean) {
    const want = new Set(ids.flatMap((id) => at.pathOf.get(id) ?? []));
    syncing.current = true;
    try {
      for (const p of model.getSelectedPaths()) if (!want.has(p)) model.getItem(p)?.deselect();
      for (const p of want) if (!model.getItem(p)?.isSelected()) model.getItem(p)?.select();
      applied.current = JSON.stringify(ids.filter((id) => at.pathOf.has(id)));
    } finally { syncing.current = false; }
    const firstPath = [...want][0];
    if (reveal && firstPath) model.scrollToPath(firstPath, { focus: false, offset: 'nearest' });
  }
  const selectedKey = selectedIds ? JSON.stringify(selectedIds) : null;
  useEffect(() => {
    if (selectedIds) applySelection(selectedIds, index, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey, index]);

  /* Folders asked open, with every folder above them. (`defaultExpanded` too: presorted input skips the tree's own
     initial expansion.) */
  const expandedKey = expandedIds ? JSON.stringify(expandedIds) : null;
  const openedFor = useRef<object | null>(null);
  useEffect(() => {
    // Once per model (Strict Mode builds the model twice).
    const ids = [...(openedFor.current !== model && Array.isArray(defaultExpanded) ? defaultExpanded : []), ...(expandedIds ?? [])];
    openedFor.current = model;
    for (const id of ids) {
      const path = index.pathOf.get(id);
      if (!path) continue;
      const parts = path.replace(/\/$/, '').split('/');
      for (let i = 1; i <= parts.length; i++) {
        const item = model.getItem(`${parts.slice(0, i).join('/')}/`);
        if (item?.isDirectory()) (item as FileTreeDirectoryHandle).expand();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedKey, index, model]);

  /* Rename in place. */
  const renamingRef = useRef(renamingId ?? null);
  renamingRef.current = renamingId ?? null;
  const ended = useRef(false);
  function endRename() {
    if (ended.current) return;
    ended.current = true;
    live.current.onRenameEnd?.();
  }
  useEffect(() => {
    const path = renamingId ? index.pathOf.get(renamingId) : undefined;
    if (!path) return;
    ended.current = false;
    const host = model.getFileTreeContainer();
    // Escape and a click away cancel without telling us: notice the field going away.
    const watch = new MutationObserver(() => {
      if (!host?.shadowRoot?.querySelector('[data-item-path] input')) { watch.disconnect(); endRename(); }
    });
    // A menu that started the rename hands focus back as it closes, which would end the rename at once: start once
    // it has gone.
    let frame = 0;
    const start = () => {
      if (document.querySelector('[data-slot=dropdown-menu]')) { frame = requestAnimationFrame(start); return; }
      frame = requestAnimationFrame(() => {
        if (!model.startRenaming(path)) { endRename(); return; }
        if (host?.shadowRoot) watch.observe(host.shadowRoot, { childList: true, subtree: true });
      });
    };
    start();
    return () => { cancelAnimationFrame(frame); watch.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renamingId]);

  /* The tree's own element (in its shadow root) carries the name; rows the host page styles go in a sheet beside it. */
  const sheet = useRef<HTMLStyleElement | null>(null);
  const dropPath = useRef<string | null>(null);
  const paintSheet = () => {
    if (!sheet.current) return;
    const dim = shown.current.dimmed.map((p) => `[data-item-path=${quote(p)}]`).join(',');
    const drop = dropPath.current;
    sheet.current.textContent = [
      // Fill the host, whatever height the page gives it.
      '[data-file-tree-virtualized-wrapper]{flex:1 1 auto;min-height:0}',
      // Details read as secondary but keep text contrast (the theme's muted ink is for icons and guides).
      '[data-item-section=decoration]{color:color-mix(in oklab,var(--trees-fg) 72%,transparent)}',
      dim ? `${dim}{opacity:.6}` : '',
      drop === '' ? '[role=tree]{box-shadow:inset 0 0 0 2px var(--trees-accent);border-radius:var(--trees-border-radius)}' : '',
      drop ? `[data-item-path=${quote(drop)}]{background:var(--trees-bg-muted);box-shadow:inset 0 0 0 2px var(--trees-accent)}` : '',
    ].join('');
  };
  useEffect(() => {
    let watch: MutationObserver | undefined;
    let frame = 0;
    // The tree mounts its shadow root in its own effect; wait for it.
    const attach = () => {
      const root = model.getFileTreeContainer()?.shadowRoot;
      if (!root) { frame = requestAnimationFrame(attach); return; }
      const label = () => { const tree = root.querySelector('[role=tree]'); if (tree && tree.getAttribute('aria-label') !== ariaLabel) tree.setAttribute('aria-label', ariaLabel); };
      label();
      if (!sheet.current) { sheet.current = document.createElement('style'); sheet.current.dataset.blTree = ''; }
      if (sheet.current.parentNode !== root) root.appendChild(sheet.current);
      paintSheet();
      watch = new MutationObserver(label);
      watch.observe(root, { childList: true, subtree: true });
    };
    attach();
    return () => { cancelAnimationFrame(frame); watch?.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, ariaLabel]);
  useEffect(paintSheet, [index]);

  /* Drags. The tree runs drags of its own rows; drops from elsewhere land here. */
  const ownDrag = useRef(false);
  const setDrop = (path: string | null) => {
    if (dropPath.current === path) return;
    dropPath.current = path;
    paintSheet();
  };
  const folderAt = (e: Event) => {
    const path = rowPathOf(e);
    if (!path) return '';
    // A file's row stands for the folder it's in.
    return path.endsWith('/') ? path : path.includes('/') ? path.slice(0, path.lastIndexOf('/', path.length - 1) + 1) : '';
  };
  const handlers = {
    onDragStart: (e: DragEvent<HTMLElement>) => {
      const path = rowPathOf(e.nativeEvent);
      if (!path) return;
      ownDrag.current = true;
      const selected = model.getSelectedPaths();
      const nodes = nodesOf(selected.includes(path) ? selected : [path]);
      onDragStart?.(nodes, e.dataTransfer);
    },
    onDragEnd: () => { ownDrag.current = false; },
    onDragOver: (e: DragEvent<HTMLElement>) => {
      if (ownDrag.current || !externalDrop) return;
      const folder = folderAt(e.nativeEvent);
      if (!externalDrop.accepts([...e.dataTransfer.types], targetOf(folder || null))) { setDrop(null); return; }
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      setDrop(folder);
    },
    onDragLeave: (e: DragEvent<HTMLElement>) => {
      if (!(e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget))) setDrop(null);
    },
    onDrop: (e: DragEvent<HTMLElement>) => {
      setDrop(null);
      if (ownDrag.current || !externalDrop) return;
      const target = targetOf(folderAt(e.nativeEvent) || null);
      if (!externalDrop.accepts([...e.dataTransfer.types], target)) return;
      e.preventDefault();
      externalDrop.onDrop(e.dataTransfer, target);
    },
  };

  /* The context menu belongs to the row it opened on. */
  const [menuNode, setMenuNode] = useState<TreeNode | null>(null);
  /** Picks the menu's row; false when there's none (no menu then, and no browser menu either). */
  const pickMenuRow = (e: Event) => {
    const node = targetOf(rowPathOf(e) ?? model.getFocusedPath());
    setMenuNode(node);
    return !!node;
  };
  const action = (e: Event) => {
    const node = targetOf(rowPathOf(e));
    if (!node || !onAction) return;
    // The action may move focus (into an editor, say): the key that ran it mustn't land there too.
    e.preventDefault();
    onAction(node);
  };

  const tree = (
    <FileTree
      model={model}
      data-slot="tree"
      className="flex min-h-0 flex-1 flex-col"
      {...handlers}
      onDoubleClick={(e: MouseEvent<HTMLElement>) => action(e.nativeEvent)}
      onKeyDown={(e: KeyboardEvent<HTMLElement>) => { if (e.key === 'Enter' && !e.nativeEvent.composedPath().some((el) => el instanceof HTMLInputElement)) action(e.nativeEvent); }}
    />
  );
  const field = search ? (
    <SearchField aria-label={`Search ${ariaLabel}`} placeholder="Search" className="mb-1.5 shrink-0"
      onChange={(value) => model.setSearch(value || null)} />
  ) : null;
  if (!contextMenu) {
    return <div data-slot="tree-root" {...(hostProps as HTMLAttributes<HTMLDivElement>)} className={cn('flex min-h-0 flex-col', className)}>{field}{tree}</div>;
  }
  return (
    <ContextMenu
      data-slot="tree-root"
      {...(hostProps as HTMLAttributes<HTMLDivElement>)}
      className={cn('flex min-h-0 flex-col', className)}
      onContextMenu={(e) => { if (!pickMenuRow(e.nativeEvent)) e.preventDefault(); }}
      onKeyDown={(e) => { if ((e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) && !pickMenuRow(e.nativeEvent)) e.preventDefault(); }}
    >
      {field}
      {tree}
      {menuNode ? contextMenu(menuNode) : null}
    </ContextMenu>
  );
}

function gitStatusOf(index: Index, status: TreeProps['gitStatus']) {
  return status ? Object.entries(status).flatMap(([id, s]) => { const path = index.pathOf.get(id); return path ? [{ path, status: s }] : []; }) : undefined;
}

/* ── File icons, for lists of files outside a Tree (a Tree draws its own) ── */

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

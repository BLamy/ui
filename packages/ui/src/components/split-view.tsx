'use client';
/* ══ SplitView — UISplitViewController, as composable parts ══
   <SplitView> is the split-view primitive (lib/split-view-primitive): its size class comes from its own box
   (`bindSizeClass`, or `sizeClass` to force one), and it owns which columns exist, whether the sidebar is open,
   the value selected in each column, the column on top when collapsed, the columns' widths and whether the
   supplementary column is shown. Each column part (<SplitViewSidebar>, <SplitViewSupplementary>,
   <SplitViewDetail>) is ONE persistent element placed by CSS variables the primitive writes, so tiled columns, a
   floating sidebar and the compact stack are the same DOM in different places. Nothing remounts between size
   classes: a column that was tiled slides into its place in the stack, keeps its scroll position and its state,
   and slides back out again.

     regular   sidebar · supplementary · detail tiled (the sidebar tiles; the toggle slides it away)
     medium    supplementary · detail tiled; the sidebar floats over them (overlay) or pushes them (displace)
     compact   one column at a time: picking pushes the next column; back, Escape and a swipe from the leading
               edge pop. A sidebar with `compactPresentation="tabs"` becomes the iOS tab bar over the other
               columns instead of the stack's first page: its `tab` items (and `tab` sections, as one tab each) are
               the tabs, and picking one selects it as at any other width. A `tab` section's tab opens on the
               sidebar itself showing that section's rows (Music's Library), and they push as in the stack.
               Pressing the selected tab again goes back to its first page, then to the top

   A column that pushes pages of its own holds a <NavigationStack>. The column is the stack's parent
   (lib/stack-parent): collapsed, the stack's first page gets the back button to the column before, labelled with
   that column's title, and the swipe, Escape and the platform back pop the stack's pages first; the columns only
   move once the stack is at its first page. A column that doesn't push draws its bar with <SplitViewHeader> (the
   same bar, back label and large title as NavigationStackBar: lib/nav-bar) over <SplitViewContent>.
   The supplementary column can be closed (`supplementaryOpen={false}`, Notes' gallery): it slides away and the
   detail takes its space.

   Motion is CSS on the `smooth` spring (`duration-spring-smooth ease-spring-smooth`): transitions retarget from
   where a column is, so a push can be reversed mid-flight; a divider drag and the back swipe follow the pointer
   with transitions off; and nothing moves under prefers-reduced-motion. The compact stack moves like a
   NavigationStack: the column under slides back 30% under a 10% shade, the one on top casts `shadow-edge-*`. */
import {
  createContext, useCallback, useContext, useId, useLayoutEffect, useMemo, useRef, useState,
  type ComponentProps, type CSSProperties, type ReactNode, type Ref,
} from 'react';
import { usePart, usePrimitive, type PartProps, type PrimitiveHandle } from '@ui-sdk/react/primitive';
import { useShortcut, useShortcutHint } from '@ui-sdk/react/shortcuts';
import {
  Collapsible as SdkCollapsible,
  CollapsiblePanel as SdkCollapsiblePanel,
  CollapsibleTrigger as SdkCollapsibleTrigger,
} from '@ui-sdk/react/collapsible';
import type { ChangeDetails } from '@ui-sdk/core';
import { cva, type VariantProps } from 'class-variance-authority';
import { Chevron, Icon, type IconName } from '@/lib/icon';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Tabs, TabsBar, TabsList, TabsTab } from '@/components/ui/tabs';
import { cn, cx } from '@/lib/utils';
import { SizeClassProvider } from '@/lib/container';
import { barBottomHeight, sectionLabelVariants } from '@/lib/primitives';
import { StackParentContext, scrollToTop, type StackParent } from '@/lib/stack-parent';
import {
  BackLabel, backName, barBackButton, barTitle, barTitleFade, barTitleHidden, centeredRoom, largeTitleText, useBackFit,
} from '@/lib/nav-bar';
import {
  SPLIT_VIEW_COLUMN_DEFAULTS,
  splitView,
  type SplitViewColumn,
  type SplitViewColumnState,
  type SplitViewCompactColumnChangeReason,
  type SplitViewItemState,
  type SplitViewOptions,
  type SplitViewSidebarOpenChangeReason,
  type SplitViewState,
  type SplitViewSupplementaryOpenChangeReason,
  type SplitViewColumnWidthsChangeReason,
  type SplitViewHeaderState,
  type SplitViewValueChangeReason,
} from '@/lib/split-view-primitive';

export { createSplitViewController } from '@/lib/split-view-primitive';
export type {
  SplitViewColumn,
  SplitViewColumnState,
  SplitViewColumnWidths,
  SplitViewColumnWidthsChangeDetails,
  SplitViewColumnWidthsChangeReason,
  SplitViewCompactColumnChangeDetails,
  SplitViewCompactColumnChangeReason,
  SplitViewController,
  SplitViewDefaultSidebarOpen,
  SplitViewHeaderState,
  SplitViewItemState,
  SplitViewSidebarBehavior,
  SplitViewSidebarOpenChangeDetails,
  SplitViewSidebarOpenChangeReason,
  SplitViewSizeClass,
  SplitViewState,
  SplitViewSupplementaryOpenChangeDetails,
  SplitViewSupplementaryOpenChangeReason,
  SplitViewValue,
  SplitViewValueChangeDetails,
  SplitViewValueChangeReason,
} from '@/lib/split-view-primitive';

type Handle = PrimitiveHandle<typeof splitView>;
type Opt<R extends string> = { reason?: R; event?: Event };

/** A part's `className`/`style` may be a function of its state. */
const apply = <S, V>(v: V | ((state: S) => V) | undefined, state: S) => (typeof v === 'function' ? (v as (s: S) => V)(state) : v);

/** Sets a ref of ours and the caller's. */
function useMergedRef<T>(own: { current: T | null }, theirs: Ref<T> | undefined) {
  return useCallback((el: T | null) => {
    own.current = el;
    if (typeof theirs === 'function') theirs(el);
    else if (theirs) (theirs as { current: T | null }).current = el;
  }, [own, theirs]);
}

/* ── Context ── */
/** Tells a column's stack (or content) that its place was picked again: a tab bar's selected tab, pressed. */
interface Reselect {
  emit: (column: SplitViewColumn) => void;
  on: (column: SplitViewColumn, listener: () => void) => () => void;
}
function createReselect(): Reselect {
  const listeners = new Map<SplitViewColumn, Set<() => void>>();
  return {
    emit: (column) => listeners.get(column)?.forEach((l) => l()),
    on(column, listener) {
      const set = listeners.get(column) ?? new Set();
      listeners.set(column, set);
      set.add(listener);
      return () => { set.delete(listener); };
    },
  };
}

interface RootContext {
  handle: Handle;
  state: SplitViewState;
  titles: Partial<Record<SplitViewColumn, string>>;
  setTitle: (column: SplitViewColumn, title: string | undefined) => void;
  reselect: Reselect;
}
const Ctx = createContext<RootContext | null>(null);
const ColumnCtx = createContext<SplitViewColumn | null>(null);

function useRoot(part: string) {
  const c = useContext(Ctx);
  if (!c) throw new Error(`<${part}> must be rendered inside <SplitView>`);
  return c;
}

/** What `useSplitView()` returns: the split view's state and the ways to change it. */
export interface SplitViewContextValue extends SplitViewState {
  setSidebarOpen: (open: boolean, options?: Opt<SplitViewSidebarOpenChangeReason>) => boolean;
  toggleSidebar: (options?: Opt<SplitViewSidebarOpenChangeReason>) => boolean;
  /** Selects `value` in `column` and shows the column after it (a push when collapsed). `null` clears. */
  select: (column: SplitViewColumn, value: string | null, options?: Opt<SplitViewValueChangeReason>) => boolean;
  /** Whether `value` is the current one in `column` (what its items draw): never while collapsed, where rows are
   *  navigation, except in a sidebar that has become a tab bar. */
  isCurrent: (column: SplitViewColumn, value: string) => boolean;
  /** Puts `column` on top of the compact stack (tracked at every size). */
  show: (column: SplitViewColumn, options?: Opt<SplitViewCompactColumnChangeReason>) => boolean;
  back: (options?: Opt<SplitViewCompactColumnChangeReason>) => boolean;
  setColumnWidth: (column: SplitViewColumn, width: number, options?: Opt<SplitViewColumnWidthsChangeReason>) => boolean;
  setSupplementaryOpen: (open: boolean, options?: Opt<SplitViewSupplementaryOpenChangeReason>) => boolean;
}

/** The split view's state and navigation: size class, sidebar, value per column, the compact stack. Throws outside
 *  a SplitView. */
export function useSplitView(): SplitViewContextValue {
  const { handle, state } = useRoot('useSplitView');
  return useMemo(() => {
    const api = handle.api;
    return {
      ...state,
      setSidebarOpen: (open, o) => api.setSidebarOpen(open, o),
      toggleSidebar: (o) => api.toggleSidebar(o),
      select: (column, value, o) => api.select(column, value, o),
      isCurrent: (column, value) => (!state.collapsed || (column === 'sidebar' && state.sidebarTabs)) && state.value[column] === value,
      show: (column, o) => api.show(column, o),
      back: (o) => api.back(o),
      setColumnWidth: (column, width, o) => api.setColumnWidth(column, width, o),
      setSupplementaryOpen: (open, o) => api.setSupplementaryOpen(open, o),
    };
  }, [handle, state]);
}

/** The column the calling component is rendered in, or null outside a column. */
export function useSplitViewColumn() {
  return useContext(ColumnCtx);
}

/** For a bar of your own at the root of a column (a NavigationStack does this by itself): while the split view is
 *  collapsed and a column comes before this one, that column's title and the way back to it, else null (outside a
 *  column, and inside a NavigationStack's pages, whose way back is the stack's). `title` names this column, for the
 *  back label of the column after it (what a SplitViewHeader's title does). */
export function useSplitViewBack(title?: string): { title: string; back: () => void } | null {
  const parent = useContext(StackParentContext);
  const setTitle = parent?.setTitle;
  useLayoutEffect(() => {
    if (setTitle && title !== undefined) setTitle(title);
  }, [setTitle, title]);
  return parent?.back ? { title: parent.back.title, back: parent.back.onClick } : null;
}

/* ── Root ── */
export type SplitViewProps = SplitViewOptions &
  Omit<PartProps<'div', SplitViewState>, 'children' | 'defaultValue'> & {
    children?: ReactNode;
  };

export function SplitView({
  sizeClass, breakpoints, sidebarBehavior,
  sidebarOpen, defaultSidebarOpen, onSidebarOpenChange,
  value, defaultValue, onValueChange,
  compactColumn, defaultCompactColumn, onCompactColumnChange,
  supplementaryOpen, defaultSupplementaryOpen, onSupplementaryOpenChange,
  columnWidths, defaultColumnWidths, onColumnWidthsChange,
  onSizeClassChange, controller, debug, children, className, style, ...props
}: SplitViewProps) {
  const handle = usePrimitive(splitView, {
    sizeClass, breakpoints, sidebarBehavior,
    sidebarOpen, defaultSidebarOpen, onSidebarOpenChange,
    value, defaultValue, onValueChange,
    compactColumn, defaultCompactColumn, onCompactColumnChange,
    supplementaryOpen, defaultSupplementaryOpen, onSupplementaryOpenChange,
    columnWidths, defaultColumnWidths, onColumnWidthsChange,
    onSizeClassChange, controller, debug,
  } as SplitViewOptions);
  const [titles, setTitles] = useState<Partial<Record<SplitViewColumn, string>>>({});
  const setTitle = useCallback((c: SplitViewColumn, t: string | undefined) => {
    setTitles((s) => (s[c] === t ? s : { ...s, [c]: t }));
  }, []);
  const [reselect] = useState(createReselect);
  return usePart(handle, 'root', {}, {
    ...props,
    className: cx('group/split relative isolate h-full w-full touch-pan-y overflow-hidden bg-background', className),
    // A sidebar that is a tab bar covers the bottom: what scrolls under it keeps that much room (`--tabs-bar-h`, as
    // under a Tabs `bar`).
    style: (state: SplitViewState) => ({ ...(state.sidebarTabs ? { '--tabs-bar-h': barBottomHeight } : null), ...apply(style, state) }) as CSSProperties,
    children: (state) => (
      <RootProvider handle={handle} state={state} titles={titles} setTitle={setTitle} reselect={reselect}>
        {children}
        <Resizer handle={handle} column="sidebar" />
        <Resizer handle={handle} column="supplementary" />
        <Scrim handle={handle} />
      </RootProvider>
    ),
  }, 'div');
}

function RootProvider({ handle, state, titles, setTitle, reselect, children }: RootContext & { children: ReactNode }) {
  const { sizeClass, collapsed, columns, sidebarOpen, sidebarBehavior, value, compactColumn, canGoBack, columnWidths, supplementaryOpen, sidebarTabs, tabGroup } = state;
  const key = columns.join();
  const ctx = useMemo<RootContext>(() => ({
    handle,
    state: { sizeClass, collapsed, columns: key ? (key.split(',') as SplitViewColumn[]) : [], sidebarOpen, sidebarBehavior, value, compactColumn, canGoBack, columnWidths, supplementaryOpen, sidebarTabs, tabGroup },
    titles,
    setTitle,
    reselect,
  }), [handle, sizeClass, collapsed, key, sidebarOpen, sidebarBehavior, value, compactColumn, canGoBack, columnWidths, supplementaryOpen, sidebarTabs, tabGroup, titles, setTitle, reselect]);
  // The view's size class is the scope of everything in it, popups included (`presentation="auto"`).
  return (
    <Ctx.Provider value={ctx}>
      <SizeClassProvider value={sizeClass}>{children}</SizeClassProvider>
    </Ctx.Provider>
  );
}

/** Dims the tiled columns under a floating sidebar. A press on it is a press outside the sidebar's layer. */
function Scrim({ handle }: { handle: Handle }) {
  return usePart(handle, 'scrim', {}, {
    className: cn(
      'pointer-events-none absolute inset-0 z-20 bg-overlay opacity-(--split-view-scrim) data-open:pointer-events-auto',
      'transition-opacity duration-spring-smooth ease-spring-smooth motion-reduce:transition-none group-data-instant/split:transition-none',
    ),
  }, 'div');
}

/* ── Columns ── */
export type SplitViewColumnProps = Omit<PartProps<'section', SplitViewColumnState>, 'children'> & {
  /** Preferred width, px (sidebar default 280, supplementary 340; the detail fills what's left). */
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  /** Draggable divider on the trailing edge (tiled only). Default true for sidebar and supplementary. */
  resizable?: boolean;
  children?: ReactNode;
};

const COLUMN_BG: Record<SplitViewColumn, string> = {
  sidebar: 'bg-sidebar [--avatar-ring:var(--sidebar)]',
  supplementary: 'bg-background',
  detail: 'bg-background',
};

// Placed by the variables the primitive writes; a swipe moves the top column and the one under it by
// `--stack-progress`, with transitions off. The compact stack's offsets are times `--stack-dir` (-1 right to
// left), so columns enter from the trailing edge and follow the swipe from the leading one in either direction.
// The column is its own surface (className merges over its background and flex layout); the divider hairline is
// its `::after`, over its bar.
const COLUMN = cn(
  'group/column absolute inset-y-0 left-(--column-left) z-(--column-z) flex w-(--column-width) min-w-0 flex-col overflow-hidden text-foreground outline-none',
  'translate-x-[calc(var(--column-translate)_*_var(--stack-dir,1))] rtl:[--stack-dir:-1]',
  'transition-[left,width,translate,box-shadow] duration-spring-smooth ease-spring-smooth motion-reduce:transition-none',
  'group-data-instant/split:transition-none group-data-resizing/split:transition-none data-swiping:transition-none',
  'data-swiping:data-top:translate-x-[calc(var(--stack-progress)_*_100%_*_var(--stack-dir,1))] data-swiping:data-behind:translate-x-[calc((-30%_+_var(--stack-progress)_*_30%)_*_var(--stack-dir,1))]',
  "after:pointer-events-none after:absolute after:inset-y-0 after:right-0 after:z-40 after:hidden after:w-px after:bg-border after:content-[''] data-hairline:after:block rtl:after:right-auto rtl:after:left-0",
);
/** The edge shadow while lifted: a floating sidebar casts it toward the columns, a pushed column toward the one
 *  under it. */
const LIFTED: Record<SplitViewColumn, string> = {
  sidebar: 'data-lifted:shadow-edge-right rtl:data-lifted:shadow-edge-left',
  supplementary: 'data-lifted:shadow-edge-left rtl:data-lifted:shadow-edge-right',
  detail: 'data-lifted:shadow-edge-left rtl:data-lifted:shadow-edge-right',
};
const DIM = cn(
  'pointer-events-none absolute inset-0 z-50 bg-black opacity-(--column-dim)',
  'transition-opacity duration-spring-smooth ease-spring-smooth motion-reduce:transition-none group-data-instant/split:transition-none',
  'group-data-swiping/column:transition-none group-data-swiping/column:group-data-behind/column:opacity-[calc(0.1_*_(1_-_var(--stack-progress)))]',
);

function ColumnPart({ column, width, minWidth, maxWidth, resizable, tabs = false, children, className, ...props }: SplitViewColumnProps & { column: SplitViewColumn; tabs?: boolean }) {
  const { handle, state, titles, setTitle, reselect } = useRoot(`SplitView${column[0].toUpperCase()}${column.slice(1)}`);
  const d = SPLIT_VIEW_COLUMN_DEFAULTS[column];
  const w = width ?? d.width, min = minWidth ?? d.minWidth, max = maxWidth ?? d.maxWidth, res = resizable ?? d.resizable;
  const { register } = handle.api.internal;
  useLayoutEffect(() => { register(column, { width: w, minWidth: min, maxWidth: max, resizable: res, tabs }); }, [register, column, w, min, max, res, tabs]);
  useLayoutEffect(() => () => register(column, null), [register, column]);

  // The column is the parent of a NavigationStack at its root (and of a SplitViewHeader): collapsed, the way back
  // to the column before, labelled with its title.
  const i = state.columns.indexOf(column);
  const prev = state.collapsed && i > 0 ? state.columns[i - 1] : null;
  const prevTitle = prev ? titles[prev] ?? 'Back' : null;
  const api = handle.api;
  const back = useMemo(() => (prevTitle == null ? null : { title: prevTitle, onClick: () => void api.back({ reason: 'trigger-press' }) }),
    [prevTitle, api]);
  const nameColumn = useCallback((t: string | undefined) => setTitle(column, t), [setTitle, column]);
  const onReselect = useCallback((listener: () => void) => reselect.on(column, listener), [reselect, column]);
  const parent = useMemo<StackParent>(() => ({ back, setTitle: nameColumn, onReselect }), [back, nameColumn, onReselect]);

  const el = usePart(handle, column, {}, {
    ...props,
    className: cx(cn(COLUMN, COLUMN_BG[column], LIFTED[column]), className),
    children: (
      <StackParentContext value={parent}>
        <Pane>{children}</Pane>
        <div aria-hidden="true" className={DIM} />
      </StackParentContext>
    ),
  }, 'section');
  return <ColumnCtx.Provider value={column}>{el}</ColumnCtx.Provider>;
}

export interface SplitViewSidebarProps extends SplitViewColumnProps {
  /** What the sidebar becomes in a compact split view. `stack` (default): the compact stack's first page, so picking
   *  an item pushes the column after it (Mail, Settings). `tabs`: the iOS tab bar, pinned over the bottom of the other
   *  columns (Music, Podcasts): its `tab` items and `tab` sections are the tabs, and picking one selects it, as at
   *  any other width, and goes back to the first page of the stack beside it. A `tab` section's tab is the sidebar
   *  itself showing that section's rows (the header takes the section's title), and its rows push the column after
   *  it; pressing the selected tab again goes back to its first page, then scrolls it to the top. The columns are
   *  the same elements at every size, so a NavigationStack in the detail (with `resetKey={value.sidebar}`) stays
   *  mounted. */
  compactPresentation?: 'stack' | 'tabs';
}

/** Primary column: navigation (mailboxes, folders, settings sections). */
export function SplitViewSidebar({ compactPresentation = 'stack', children, ...props }: SplitViewSidebarProps) {
  const { handle, state } = useRoot('SplitViewSidebar');
  const tabs = compactPresentation === 'tabs';
  const [entries, setEntries] = useState<ReadonlyMap<string, { current: TabEntry | null }>>(() => new Map());
  const registry = useMemo<TabRegistry | null>(() => (tabs ? {
    set: (key, entry) => setEntries((m) => {
      const next = new Map(m);
      if (entry) next.set(key, entry); else next.delete(key);
      return next;
    }),
  } : null), [tabs]);
  // The tab groups the primitive needs to know which tab a value is in: each member's group, and each group's own.
  const all = [...entries.values()].map((e) => e.current).filter((e): e is TabEntry => e != null);
  const groupsKey = JSON.stringify(all.flatMap((e) => (e.kind === 'member' ? [[e.value, e.group]] : e.group ? [[e.value, e.value]] : [])));
  const setTabGroups = handle.api.internal.setTabGroups;
  useLayoutEffect(() => { setTabGroups(Object.fromEntries(JSON.parse(groupsKey) as [string, string][])); }, [setTabGroups, groupsKey]);
  // Showing a tab group's rows (its tab's first page): the section's title heads the column.
  const groupTitle = state.tabGroup == null ? null
    : all.find((e): e is TabItem => e.kind === 'tab' && !!e.group && e.value === state.tabGroup)?.title ?? null;
  const page = useMemo<TabPage | null>(() => (state.tabGroup == null ? null : { group: state.tabGroup, title: groupTitle }), [state.tabGroup, groupTitle]);
  return (
    <>
      <TabRegistryContext.Provider value={registry}>
        <TabPageContext.Provider value={page}>
          {/* A tab's page sits on the page background, as the other tabs' columns do, not the sidebar's grey. */}
          <ColumnPart column="sidebar" aria-label="Sidebar" tabs={tabs} {...props}
            className={cx(page ? 'bg-background [--avatar-ring:var(--background)]' : '', props.className)}>{children}</ColumnPart>
        </TabPageContext.Provider>
      </TabRegistryContext.Provider>
      {tabs ? <SidebarTabBar entries={all} label={props['aria-label'] ?? 'Sidebar'} /> : null}
    </>
  );
}

/* ── The sidebar as a tab bar (compact, `compactPresentation="tabs"`) ──
   The tabs are the sidebar's own items and sections that say `tab`, in the order they appear in it: an item is a
   tab for its value; a section is one tab (UIKit's tab group) that is current while any item in it is, and whose
   first page is the sidebar showing only that section's rows. They register here as they render; the bar is the
   kit's Tabs `bar`, and the column on top is its tabpanel. */
type TabEntry =
  | { kind: 'tab'; value: string; title: ReactNode; icon: ReactNode; disabled?: boolean; group?: boolean; el: () => Element | null }
  | { kind: 'member'; value: string; group: string };
/** The tab group whose rows the sidebar shows as its tab's first page, and its title (the column's heading). */
interface TabPage { group: string; title: ReactNode }
const TabPageContext = createContext<TabPage | null>(null);
/** Each entry is the latest render's (a ref), so a title or icon that changes shows without registering again. */
interface TabRegistry { set: (key: string, entry: { current: TabEntry | null } | null) => void }
const TabRegistryContext = createContext<TabRegistry | null>(null);
/** The `tab` section an item is in: its value, for the tab bar to call the section current. */
const TabGroupContext = createContext<string | null>(null);

/** Registers a tab (or a member of a tab group) with the sidebar's tab bar while it is rendered. */
function useTabEntry(entry: TabEntry | null) {
  const registry = useContext(TabRegistryContext);
  const key = useId();
  const set = registry?.set;
  const sig = entry ? JSON.stringify([entry.kind, entry.value, entry.group, entry.kind === 'tab' ? entry.disabled : null]) : '';
  const latest = useRef(entry);
  latest.current = entry;
  useLayoutEffect(() => {
    if (!set || !latest.current) return undefined;
    set(key, latest);
    return () => set(key, null);
    // Re-registers when what identifies it changes; its title and icon are read when the bar renders.
  }, [set, key, sig]);
  return !!registry;
}

type TabItem = Extract<TabEntry, { kind: 'tab' }>;

function SidebarTabBar({ entries, label }: { entries: TabEntry[]; label: string }) {
  const { handle, state, reselect } = useRoot('SplitViewSidebar');
  if (!state.sidebarTabs) return null;
  // In the sidebar's order, once per value (an item can show in two sections).
  const tabs = entries.filter((e): e is TabItem => e.kind === 'tab')
    .sort((a, b) => {
      const x = a.el(), y = b.el();
      return x && y && x !== y ? (x.compareDocumentPosition(y) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1) : 0;
    })
    .filter((t, i, list) => list.findIndex((u) => u.value === t.value) === i);
  const selected = state.value.sidebar ?? null;
  const current = selected == null ? null : tabs.some((t) => t.value === selected) ? selected : state.tabGroup;
  const { internal } = handle.api;
  // The selected tab pressed again, as on iOS: back to the tab's first page (a group's rows, or the first column
  // after the sidebar), and there, its stack back to its first page, then to the top.
  const again = (event: Event) => {
    const group = state.tabGroup;
    const root = group != null ? 'sidebar' : state.columns[0];
    if (state.compactColumn !== root) {
      if (group != null) handle.api.select('sidebar', group, { reason: 'item-press', event });
      else handle.api.show(root, { reason: 'trigger-press', event });
    } else reselect.emit(root);
  };
  return (
    <Tabs variant="bar" value={current} activation="manual"
      onValueChange={(value, details) => { if (value != null) internal.selectTab(value, { reason: 'item-press', event: details.event }); }}
      className="absolute inset-x-0 bottom-0 z-60">
      <TabsBar>
        <TabsList aria-label={label}>
          {tabs.map((t) => (
            // The selected tab controls the column on top (its tabpanel, labelled by it).
            <TabsTab key={t.value} value={t.value} icon={t.icon} disabled={t.disabled}
              {...(t.value === current ? { id: internal.tabId, 'aria-controls': internal.columnId(state.compactColumn), onClick: (e) => again(e.nativeEvent) } : null)}>
              {t.title}
            </TabsTab>
          ))}
        </TabsList>
      </TabsBar>
    </Tabs>
  );
}
/** Middle column of a three-column split: the list whose selection drives the detail. */
export function SplitViewSupplementary(props: SplitViewColumnProps) {
  return <ColumnPart column="supplementary" {...props} />;
}
/** Content column: fills the remaining width. */
export function SplitViewDetail(props: SplitViewColumnProps) {
  return <ColumnPart column="detail" {...props} />;
}

/* ── Divider: on its column's trailing edge, drawn by the root (a column clips what it holds) ── */
function Resizer({ handle, column }: { handle: Handle; column: SplitViewColumn }) {
  return usePart(handle, 'resizer', { value: column }, {
    className: cn(
      'group/resizer absolute inset-y-0 left-(--resizer-left) z-40 w-[10px] -translate-x-1/2 cursor-col-resize touch-none outline-none',
      'transition-[left] duration-spring-smooth ease-spring-smooth motion-reduce:transition-none group-data-instant/split:transition-none group-data-resizing/split:transition-none',
    ),
    children: (
      <div className={cn(
        'absolute inset-y-0 left-1/2 w-[3px] -translate-x-1/2 scale-y-[.96] rounded-full bg-primary opacity-0 transition-[opacity,scale] duration-200',
        'group-hover/resizer:scale-y-100 group-hover/resizer:opacity-45',
        'group-focus-visible/resizer:scale-y-100 group-focus-visible/resizer:opacity-100 group-active/resizer:scale-y-100 group-active/resizer:opacity-100 group-data-dragging/resizer:scale-y-100 group-data-dragging/resizer:opacity-100',
      )} />
    ),
  }, 'div');
}

/* ── Panes: one header + content pair that scroll together ── */
/** What a header's large title draws at the top of the pane's scroll. */
interface LargeSpec { title: ReactNode; trailing?: ReactNode; className?: string }
interface PaneState {
  /** The pane's key in the primitive: its header, content and large title share it. */
  key: string;
  /** A large title the pane's SplitViewContent draws at the top of its scroll. */
  large: LargeSpec | null;
  setLarge: (large: LargeSpec | null) => void;
  /** A SplitViewContent is rendered in it (it draws the large title then); its scroll state is the primitive's. */
  contents: number;
  addContent: () => () => void;
}
const PaneCtx = createContext<PaneState | null>(null);

function Pane({ children }: { children?: ReactNode }) {
  const key = useId();
  const [large, setLarge] = useState<LargeSpec | null>(null);
  const [contents, setContents] = useState(0);
  const addContent = useCallback(() => {
    setContents((n) => n + 1);
    return () => setContents((n) => n - 1);
  }, []);
  const value = useMemo(() => ({ key, large, setLarge, contents, addContent }), [key, large, contents, addContent]);
  return <PaneCtx.Provider value={value}>{children}</PaneCtx.Provider>;
}

function LargeTitle({ handle, pane, spec }: { handle: Handle; pane: string; spec: LargeSpec }) {
  return usePart(handle, 'large-title', { value: pane }, {
    className: cn('px-4 pt-1 pb-2', spec.trailing != null && 'flex items-end gap-4', spec.className),
    children: spec.trailing != null ? (
      // A trailing item (a count, a button) shares the title's line, on the trailing edge.
      <>
        <div role="heading" aria-level={1} className={cn(largeTitleText, 'min-w-0 flex-1')}>{spec.title}</div>
        <div data-large-title-trailing="" className="flex shrink-0 items-center text-large-title leading-[1.15]">{spec.trailing}</div>
      </>
    ) : (
      // A heading role, not an <h1>: host prose styles (a docs page's `.markdown h1`) would otherwise restyle it.
      <div role="heading" aria-level={1} className={largeTitleText}>{spec.title}</div>
    ),
  }, 'div');
}

/* ── Column bar ── */
export interface SplitViewHeaderProps extends Omit<PartProps<'div', SplitViewHeaderState>, 'title' | 'children'> {
  /** The column's title. A string also labels the next column's back button while collapsed. */
  title?: ReactNode;
  /** `center` (default), as on iOS; `start` puts the title after the leading items, sharing the bar with the
   *  toolbar controls (an editor's file name). */
  titleAlign?: 'center' | 'start';
  /** iOS large title: drawn big at the top of the pane's SplitViewContent and scrolling with it; once it has
   *  gone under the bar the inline title (and the bar's hairline) fade in. */
  largeTitle?: boolean;
  /** Drawn on the large title's line, at the trailing edge (Reminders' open count). */
  largeTitleTrailing?: ReactNode;
  /** Classes for the large-title block, to line it up with the content (`mx-auto max-w-[760px] px-5`). */
  largeTitleClassName?: string;
  /** No large title: the inline title (and the bar's hairline) fade in once the content scrolls. */
  showOnScroll?: boolean;
  /** iOS's scroll-edge appearance: the bar's hairline shows only once the pane's SplitViewContent has scrolled
   *  under it, as a NavigationStackBar's surface does, so the bars of a window line up at rest. Default true;
   *  `false` keeps the hairline at rest too (a column whose content doesn't scroll under the bar). A bar with no
   *  SplitViewContent in its pane always draws it. */
  scrollEdge?: boolean;
  /** Leading items (`<SplitViewSidebarTrigger/>`). Collapsed, the back button to the column before takes their place. */
  leading?: ReactNode;
  trailing?: ReactNode;
  /** The back button's label; defaults to the previous column's title. */
  backLabel?: string;
}

/** Room for the back label when the title follows it at the start of the bar. */
const startRoom = (row: number) => Math.floor(row * 0.45 - 32);

/** The column's back button, collapsed: pops to the column before (`split-view-back`). */
function HeaderBack({ handle, row, title, label, align }: {
  handle: Handle; row: { current: HTMLDivElement | null }; title: { current: HTMLDivElement | null }; label: string; align: 'center' | 'start';
}) {
  const fit = useBackFit(row, label, () => title.current, align === 'start' ? startRoom : centeredRoom);
  const button = usePart(handle, 'back', {}, {
    'aria-label': backName(label),
    className: barBackButton,
    children: <BackLabel fit={fit} label={label} />,
  }, 'button');
  return <>{button}{fit.rulers}</>;
}

/** The bar of a column that doesn't push pages: title, leading and trailing items, and (collapsed) the back button
 *  to the column before. It is the same bar as NavigationStackBar, as one component: a column that pushes holds a
 *  NavigationStack, whose pages use NavigationStackBar's parts. */
export function SplitViewHeader({
  title: titleProp, titleAlign = 'center', largeTitle: largeTitleProp, largeTitleTrailing, largeTitleClassName, showOnScroll, scrollEdge = true,
  leading, trailing, backLabel, className, ref, ...props
}: SplitViewHeaderProps) {
  const s = useRoot('SplitViewHeader');
  const parent = useContext(StackParentContext);
  const pane = useContext(PaneCtx);
  // A sidebar showing a tab group's rows (its tab's first page) is headed by the group, as a large title.
  const tabPage = useContext(TabPageContext);
  const title = tabPage ? tabPage.title : titleProp;
  const largeTitle = tabPage ? true : largeTitleProp;
  // A string title names the column, for the back button of the column after it.
  const t = typeof title === 'string' ? title : undefined;
  const setColumnTitle = parent?.setTitle;
  useLayoutEffect(() => { setColumnTitle?.(t); }, [setColumnTitle, t]);

  const back = parent?.back ?? null;
  const label = backLabel ?? back?.title ?? 'Back';

  // Large title: the pane's content draws it at the top of its scroll (or, with no content, it sits under the bar).
  const large = !!largeTitle && title != null;
  const spec = useMemo<LargeSpec | null>(() => (large ? { title, trailing: largeTitleTrailing, className: largeTitleClassName } : null),
    [large, title, largeTitleTrailing, largeTitleClassName]);
  const setLarge = pane?.setLarge;
  useLayoutEffect(() => { setLarge?.(spec); }, [setLarge, spec]);
  useLayoutEffect(() => () => setLarge?.(null), [setLarge]);
  // Outside a pane (a header on its own) it keys itself.
  const ownKey = useId();
  const paneKey = pane?.key ?? ownKey;

  const row = useRef<HTMLDivElement | null>(null);
  const titleEl = useRef<HTMLDivElement | null>(null);
  const setRow = useMergedRef(row, ref);
  const start = titleAlign === 'start';
  const header = usePart(s.handle, 'header', { value: paneKey, largeTitle: large, showOnScroll: !!showOnScroll }, {
    ...props,
    ref: setRow,
    className: (h: SplitViewHeaderState) => cn(
      'group/header relative z-30 flex h-toolbar shrink-0 items-center px-1.5',
      !h.fading && (!scrollEdge || !h.inContent || h.scrolled) && 'shadow-hairline-b',
      apply(className, h),
    ),
    children: (h: SplitViewHeaderState) => (
      <>
        <div className={cn('relative z-1 flex items-center', start && !back && !leading ? 'min-w-0' : 'min-w-[44px]')}>
          {back ? <HeaderBack handle={s.handle} row={row} title={titleEl} label={label} align={titleAlign} /> : leading}
        </div>
        {/* The inline title and the hairline fade in once the content has scrolled (under its large title). */}
        <div ref={titleEl} aria-hidden={!h.inline || undefined}
          className={cn(start ? 'min-w-0 flex-1 truncate px-2 text-body font-semibold text-foreground' : barTitle, h.fading && barTitleFade, h.fading && !h.inline && barTitleHidden)}>
          {title}
        </div>
        {h.fading ? <span aria-hidden="true" className={cn('pointer-events-none absolute inset-x-0 bottom-0 h-px bg-border', barTitleFade, !h.inline && barTitleHidden)} /> : null}
        <div className="relative z-1 ms-auto flex items-center gap-0.5">{trailing}</div>
      </>
    ),
  }, 'div');
  return (
    <>
      {header}
      {spec && !(pane && pane.contents > 0) ? <LargeTitle handle={s.handle} pane={paneKey} spec={spec} /> : null}
    </>
  );
}

export type SplitViewContentProps = Omit<PartProps<'div'>, 'children'> & { children?: ReactNode };

/** Scrolling body of a column. Draws the header's large title, if it has one, at the top of the scroll. */
export function SplitViewContent({ children, className, ref, ...props }: SplitViewContentProps) {
  const { handle } = useRoot('SplitViewContent');
  const pane = useContext(PaneCtx);
  const ownKey = useId();
  const key = pane?.key ?? ownKey;
  const add = pane?.addContent;
  useLayoutEffect(() => add?.(), [add]);
  const large = pane?.large;
  // Its column's tab pressed again while it is at the tab's first page: back to the top.
  const own = useRef<HTMLDivElement | null>(null);
  const setRef = useMergedRef(own, ref);
  const onReselect = useContext(StackParentContext)?.onReselect;
  useLayoutEffect(() => onReselect?.(() => scrollToTop(own.current)), [onReselect]);
  return usePart(handle, 'content', { value: key }, {
    ...props,
    ref: setRef,
    className: cx('bl-scroll relative min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain', className),
    children: (
      <>
        {large ? <LargeTitle handle={handle} pane={key} spec={large} /> : null}
        {children}
        {/* Room under a tab bar that covers the bottom (`--tabs-bar-h`: a Tabs bar, or this sidebar as one). */}
        <div aria-hidden="true" className="h-(--tabs-bar-h) shrink-0" />
      </>
    ),
  }, 'div');
}

export type SplitViewSidebarTriggerProps = Omit<PartProps<'button', { open: boolean }>, 'children'> & {
  /** The glyph. Default the 22px `sidebar` icon in the tint. */
  children?: ReactNode;
  /** A key that shows and hides the sidebar from anywhere (UI SDK's shortcut syntax: `"mod+alt+s"`), announced as the
   *  button's `aria-keyshortcuts`. */
  shortcut?: string;
};

/** The sidebar button (`aria-expanded`, `aria-controls`): shows and hides the sidebar. It is there whenever there's a
 *  sidebar to open or close, and gone when collapsed, where back takes over. */
export function SplitViewSidebarTrigger({ className, children, shortcut, ...props }: SplitViewSidebarTriggerProps) {
  const { handle, state } = useRoot('SplitViewSidebarTrigger');
  const hint = useShortcutHint(shortcut || 'a');
  const usable = !state.collapsed && state.columns.includes('sidebar') && state.columns.length > 1;
  useShortcut(shortcut, (event) => { if (usable) handle.api.toggleSidebar({ reason: 'shortcut', event }); });
  return usePart(handle, 'sidebar-trigger', {}, {
    ...props,
    ...(shortcut ? { 'aria-keyshortcuts': hint.ariaKeyshortcuts } : null),
    className: cx(cn(
      'bl-btn grid cursor-pointer place-items-center rounded-ctl border-0 bg-transparent px-2.5 py-2 text-primary outline-none',
      'transition-[background,scale] duration-150 hover:bg-secondary active:scale-[.94] focus-visible:ring-2 focus-visible:ring-ring',
    ), className),
    children: children ?? <Icon name="sidebar" size={22} sw={1.9} />,
  }, 'button');
}

/** Current colours for a SplitViewItem: a background (with the theme's on-primary foreground), or both. */
export type SplitViewItemTint = string | { background: string; foreground?: string };

/** A SplitViewItem's surface: `pill` (inset rounded, sidebar default) or `row` (full-bleed with a separator);
 *  current fills with the tint (pill) or a 14% wash of it (row), the item's own `tint` when it has one. Pills are
 *  44px tall in a compact split view (touch). */
export const splitViewItemVariants = cva(
  [
    'bl-btn group/item relative flex w-full cursor-pointer items-center gap-3 border-0 text-start [font-family:inherit] text-subhead text-foreground outline-none',
    'transition-[background-color,color] duration-150',
    'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
    'disabled:cursor-default disabled:opacity-45',
  ],
  {
    variants: {
      variant: {
        pill: 'min-h-10 rounded-ctl px-2.5 py-1.5 group-data-[size-class=compact]/split:min-h-11',
        row: 'min-h-row px-4 py-2.5',
      },
      current: { true: '', false: 'bg-transparent not-disabled:hover:bg-secondary not-disabled:active:bg-accent' },
      tinted: { true: '', false: '' },
    },
    compoundVariants: [
      { variant: 'pill', current: true, tinted: false, class: 'bg-primary text-primary-foreground' },
      { variant: 'pill', current: true, tinted: true, class: 'bg-(--split-item-tint) text-(--split-item-on-tint)' },
      // Over black a 14% wash is barely a step: dark doubles it, so the current row still reads.
      { variant: 'row', current: true, tinted: false, class: 'bg-primary/14 dark:bg-primary/26' },
      { variant: 'row', current: true, tinted: true, class: 'bg-(--split-item-tint)/14 dark:bg-(--split-item-tint)/26' },
    ],
    defaultVariants: { variant: 'pill', current: false, tinted: false },
  },
);

interface SplitViewItemBaseProps
  extends Omit<PartProps<'button', SplitViewItemState>, 'value' | 'title' | 'children'>,
    Pick<VariantProps<typeof splitViewItemVariants>, 'variant'> {
  /** The item's value in its column. Several items may share one (the same mailbox under Favorites and under its
   *  account): every item whose value is the column's draws current. */
  value: string;
  title?: ReactNode;
  /** The secondary line under the title. */
  description?: ReactNode;
  /** Trailing detail: a count, a time… */
  trailing?: ReactNode;
  /** Replaces the icon / title / description / trailing layout entirely. */
  children?: ReactNode;
  /** `pill` (sidebar default): inset rounded row. `row`: full-bleed list row with a separator. */
  variant?: 'pill' | 'row' | null;
  /** This item's own colour instead of the app tint (Reminders' coloured lists). Also colours the icon while not
   *  current. Exposed to custom content as `--split-item-tint` / `--split-item-on-tint`. */
  tint?: SplitViewItemTint;
  /** A hover card beside the item that previews what pressing it opens (a list's first items, a folder's notes). */
  preview?: ReactNode;
  /** Can't be picked, and the arrow keys pass over it. */
  disabled?: boolean;
}

export type SplitViewItemProps = SplitViewItemBaseProps & (
  | {
    /** In a sidebar with `compactPresentation="tabs"`: this item is one of the compact tab bar's tabs (its `icon`
     *  over its `title`). A tab needs its `icon`. */
    tab: true;
    /** The leading glyph, in the tint: an `Icon` name (drawn at 21px; in a compact tab bar, the tab's 25px glyph
     *  that thickens when selected) or any node. */
    icon: IconName | ReactNode;
  }
  | {
    tab?: false;
    /** The leading glyph, in the tint: an `Icon` name (drawn at 21px) or any node. */
    icon?: IconName | ReactNode;
  }
);

/** A row bound to its column's value: pressing it selects `value` and shows the next column (a push while
 *  collapsed). `onClick` runs first; `event.preventDefault()` keeps it from selecting. */
export function SplitViewItem({
  value, title, description, icon, trailing, children, variant, tint, preview, disabled, tab, className, style, ref, ...props
}: SplitViewItemProps) {
  const s = useRoot('SplitViewItem');
  const column = useContext(ColumnCtx) ?? 'supplementary';
  // A tab of the sidebar's compact tab bar, or a member of the `tab` section it is in.
  const own = useRef<HTMLButtonElement | null>(null);
  const setRef = useMergedRef(own, ref);
  const group = useContext(TabGroupContext);
  useTabEntry(tab ? { kind: 'tab', value, title, icon, disabled, el: () => own.current } : group != null ? { kind: 'member', value, group } : null);
  // A sidebar showing a tab group's rows hides every other row (the other tabs are in the bar).
  const page = useContext(TabPageContext);
  const off = page != null && group !== page.group;
  const v = variant ?? (column === 'sidebar' ? 'pill' : 'row');
  const current = !s.state.collapsed && s.state.value[column] === value;
  const pushes = s.state.collapsed && s.state.columns.indexOf(column) < s.state.columns.length - 1;
  const tinted = tint != null;
  // The item's own tint is a runtime colour.
  const tintVars = tinted ? {
    '--split-item-tint': typeof tint === 'string' ? tint : tint.background,
    '--split-item-on-tint': typeof tint === 'string' ? 'var(--primary-foreground)' : tint.foreground ?? 'var(--primary-foreground)',
  } : undefined;
  const on = current && v === 'pill';
  const glyph = typeof icon === 'string' ? <Icon name={icon as IconName} size={21} /> : icon;
  const ink = (rest: string, onTint: string, onPrimary: string) => (on ? (tinted ? onTint : onPrimary) : rest);
  const part: PartProps<'button', SplitViewItemState> = {
    ...props,
    ...(off ? { hidden: true } : null),
    ref: setRef,
    ...({ 'data-tinted': tinted || undefined } as object),
    className: cx(splitViewItemVariants({ variant: v, current, tinted }), className),
    style: tintVars ? (st: SplitViewItemState) => ({ ...tintVars, ...apply(style, st) }) : style,
    children: (
      <>
        {children ?? (
          <>
            {glyph ? <span className={cn('grid w-6 shrink-0 place-items-center', ink(tinted ? 'text-(--split-item-tint)' : 'text-primary', 'text-(--split-item-on-tint)', 'text-primary-foreground'))}>{glyph}</span> : null}
            <span className="min-w-0 flex-1">
              <span className="block truncate leading-[1.3]">{title}</span>
              {description ? <span className={cn('mt-px block truncate text-footnote', ink('text-muted-foreground', 'text-(--split-item-on-tint)/80', 'text-primary-foreground/80'))}>{description}</span> : null}
            </span>
            {trailing != null ? <span className={cn('shrink-0 text-detail tabular-nums', ink('text-muted-foreground', 'text-(--split-item-on-tint)/85', 'text-primary-foreground/85'))}>{trailing}</span> : null}
            {pushes ? <Icon name="chev" size={14} sw={2.6} className={cn('shrink-0', ink('text-tertiary-foreground', 'text-(--split-item-on-tint)/70', 'text-primary-foreground/70'))} /> : null}
          </>
        )}
        {v === 'row' ? <span aria-hidden="true" className="pointer-events-none absolute end-0 bottom-0 start-4 h-px bg-border" /> : null}
      </>
    ),
  };
  if (preview == null) return <ItemPart handle={s.handle} item={value} column={column} disabled={disabled} {...part} />;
  return (
    <HoverCard>
      <HoverCardTrigger render={<ItemPart handle={s.handle} item={value} column={column} disabled={disabled} {...part} />} />
      <HoverCardContent side="end" align="start">{preview}</HoverCardContent>
    </HoverCard>
  );
}

function ItemPart({ handle, item, column, disabled, ...props }: { handle: Handle; item: string; column: SplitViewColumn; disabled?: boolean } & PartProps<'button', SplitViewItemState>) {
  // Its own key: the same value can show in several items.
  const id = useId();
  return usePart(handle, 'item', { id, item, column, disabled }, props, 'button');
}

const SECTION_LABEL = {
  /** The small group label (Mail's "Favorites"): the kit's `menu` section label. */
  default: cn(sectionLabelVariants({ variant: 'menu' }), 'px-2.5 pt-4 pb-1.5'),
  /** The bold 20px heading iOS puts over a list group (Reminders' "My Lists"). */
  prominent: 'm-0 min-w-0 px-1 pt-6 pb-2 text-title font-bold tracking-[-.2px] text-foreground',
};

interface SplitViewSectionBaseProps extends Omit<ComponentProps<'div'>, 'title'> {
  /** Section label ("Favorites", "iCloud"). Names the group. */
  title?: ReactNode;
  /** `default`, the small grey group label; `prominent`, the bold heading over a list group. */
  variant?: 'default' | 'prominent';
  /** Classes for the label (merged over the variant's). */
  labelClassName?: string;
  /** The label becomes a disclosure button (UI SDK's Collapsible) that folds the section with a spring. */
  collapsible?: boolean;
  open?: boolean;
  /** Default true. */
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean, details: ChangeDetails) => void;
}

export type SplitViewSectionProps = SplitViewSectionBaseProps & (
  | {
    /** In a sidebar with `compactPresentation="tabs"`: the whole section is one tab of the compact tab bar (UIKit's
     *  tab group, Music's Library), named by its `title`, with this `icon`. Picking it selects `value` and shows the
     *  sidebar with only this section's rows (the header takes its title), which push as in the stack; while any
     *  item in the section is the selection, it is the current tab. A section nested inside belongs to the group. */
    tab: true;
    /** The section's tab: the value it selects. */
    value: string;
    /** The section's tab: its glyph, an `Icon` name or a node. */
    icon: IconName | ReactNode;
  }
  | { tab?: false; value?: never; icon?: never }
);
/** A titled group of SplitViewItems in a column (`role="group"`, named by its label). A value may appear in more
 *  than one section; each copy draws current. */
export function SplitViewSection({
  title, variant = 'default', labelClassName, collapsible, open, defaultOpen = true, onOpenChange, tab, value, icon, children, ref, ...props
}: SplitViewSectionProps) {
  const uid = useId();
  const own = useRef<HTMLDivElement | null>(null);
  const setRef = useMergedRef(own, ref);
  // A section inside a tab group belongs to it.
  const outer = useContext(TabGroupContext);
  const group = tab ? value : outer;
  useTabEntry(tab ? { kind: 'tab', value, title, icon, group: true, el: () => own.current } : null);
  // A sidebar showing a tab group's rows: the group's own label is the column's title, other sections hide.
  const page = useContext(TabPageContext);
  const off = page != null && group !== page.group;
  const root = page != null && tab && value === page.group;
  const labelCls = cn(SECTION_LABEL[variant], labelClassName);
  const items = <div className="flex flex-col gap-px"><TabGroupContext.Provider value={group}>{children}</TabGroupContext.Provider></div>;
  return (
    <div ref={setRef} data-slot="split-view-section" role="group" aria-labelledby={title != null ? uid : undefined} hidden={off || undefined} {...props}>
      {root ? (
        <>
          {title != null ? <div id={uid} hidden>{title}</div> : null}
          {items}
        </>
      ) : collapsible && title != null ? (
        <SdkCollapsible open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
          <SdkCollapsibleTrigger id={uid}
            className={cn('bl-btn group/section flex w-full cursor-pointer items-center border-0 bg-transparent text-start [font-family:inherit] outline-none focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-ring', labelCls)}>
            {(state) => (
              <>
                <span className="flex-1">{title}</span>
                <Chevron direction={state.open ? 'down' : 'right'} size={variant === 'prominent' ? 18 : 14} strokeWidth={2.6} className="text-primary rtl:-scale-x-100" />
              </>
            )}
          </SdkCollapsibleTrigger>
          <SdkCollapsiblePanel hiddenUntilFound
            className="h-(--collapsible-panel-height) overflow-clip transition-[height] duration-spring-tray ease-spring-tray data-starting-style:h-0 data-ending-style:h-0 motion-reduce:transition-none">
            {items}
          </SdkCollapsiblePanel>
        </SdkCollapsible>
      ) : (
        <>
          {title != null ? <div id={uid} className={labelCls}>{title}</div> : null}
          {items}
        </>
      )}
    </div>
  );
}

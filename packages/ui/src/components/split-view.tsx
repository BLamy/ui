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
               edge pop

   A column can host its own push/pop stack (<SplitViewStack>, or `<SplitViewDetail stack>`): its pages slide like
   the compact columns do, and the swipe, Escape and the back button pop the innermost level first; the column
   stack only moves once the nested one is at its root. The supplementary column can be closed
   (`supplementaryOpen={false}`, Notes' gallery): it slides away and the detail takes its space.

   Motion is CSS on the `smooth` spring (`duration-spring-smooth ease-spring-smooth`): transitions retarget from
   where a column is, so a push can be reversed mid-flight; a divider drag and the back swipe follow the pointer
   with transitions off; and nothing moves under prefers-reduced-motion. A header's inline title fades on CSS too,
   from the attributes its pane's scroll writes (the primitive follows the scroll in `bind`). */
import {
  createContext, useCallback, useContext, useId, useLayoutEffect, useMemo, useRef, useState,
  type CSSProperties, type ReactNode,
} from 'react';
import { usePart, usePrimitive, type PartProps, type PrimitiveHandle } from '@ui-sdk/react/primitive';
import {
  Collapsible as SdkCollapsible,
  CollapsiblePanel as SdkCollapsiblePanel,
  CollapsibleTrigger as SdkCollapsibleTrigger,
} from '@ui-sdk/react/collapsible';
import type { ChangeDetails } from '@ui-sdk/core';
import { cva, type VariantProps } from 'class-variance-authority';
import { Chevron, Icon } from '@/lib/icon';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { cn, cx } from '@/lib/utils';
import { SizeClassProvider } from '@/lib/container';
import {
  SPLIT_VIEW_COLUMN_DEFAULTS,
  SPLIT_VIEW_STACK_ROOT,
  splitView,
  splitViewStack,
  type SplitViewColumn,
  type SplitViewCompactColumnChangeReason,
  type SplitViewOptions,
  type SplitViewSidebarOpenChangeReason,
  type SplitViewState,
  type SplitViewStackOptions,
  type SplitViewSupplementaryOpenChangeReason,
  type SplitViewColumnWidthsChangeReason,
  type SplitViewHeaderState,
  type SplitViewValueChangeReason,
} from '@/lib/split-view-primitive';

export { createSplitViewController, createSplitViewStackController } from '@/lib/split-view-primitive';
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
  SplitViewStackController,
  SplitViewStackPagesChangeDetails,
  SplitViewStackPagesChangeReason,
  SplitViewState,
  SplitViewSupplementaryOpenChangeDetails,
  SplitViewSupplementaryOpenChangeReason,
  SplitViewValue,
  SplitViewValueChangeDetails,
  SplitViewValueChangeReason,
} from '@/lib/split-view-primitive';

type Handle = PrimitiveHandle<typeof splitView>;
type StackHandle = PrimitiveHandle<typeof splitViewStack>;
type Opt<R extends string> = { reason?: R; event?: Event };

/* ── Context ── */
interface RootContext {
  handle: Handle;
  state: SplitViewState;
  titles: Partial<Record<SplitViewColumn, string>>;
  setTitle: (column: SplitViewColumn, title: string | undefined) => void;
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
  /** Selects `id` in `column` and shows the column after it (a push when collapsed). `null` clears. */
  select: (column: SplitViewColumn, id: string | null, options?: Opt<SplitViewValueChangeReason>) => boolean;
  /** Whether `id` should draw selected: never while collapsed, where rows are navigation. */
  isSelected: (column: SplitViewColumn, id: string) => boolean;
  /** Puts `column` on top of the compact stack (tracked at every size). */
  show: (column: SplitViewColumn, options?: Opt<SplitViewCompactColumnChangeReason>) => boolean;
  back: (options?: Opt<SplitViewCompactColumnChangeReason>) => boolean;
  setColumnWidth: (column: SplitViewColumn, width: number, options?: Opt<SplitViewColumnWidthsChangeReason>) => boolean;
  setSupplementaryOpen: (open: boolean, options?: Opt<SplitViewSupplementaryOpenChangeReason>) => boolean;
}

/** The split view's state and navigation: size class, sidebar, value per column, the compact stack. */
export function useSplitView(): SplitViewContextValue {
  const { handle, state } = useRoot('useSplitView');
  return useMemo(() => {
    const api = handle.api;
    return {
      ...state,
      setSidebarOpen: (open, o) => api.setSidebarOpen(open, o),
      toggleSidebar: (o) => api.toggleSidebar(o),
      select: (column, id, o) => api.select(column, id, o),
      isSelected: (column, id) => !state.collapsed && state.value[column] === id,
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

/** For a container that draws its own bar (NavigationStack) at the root of a SplitView column: while the split
 *  view is collapsed and a column comes before this one, that column's title and the way back to it, else null
 *  (outside a SplitView too). `title` registers this column's own title, for the back label of the column after
 *  it (what a SplitViewHeader does). */
export function useSplitViewBack(title?: string): { title: string; back: () => void } | null {
  const s = useContext(Ctx);
  const column = useContext(ColumnCtx);
  const page = useContext(PageCtx);
  const setTitle = s?.setTitle;
  const root = !page || page.index === 0;
  useLayoutEffect(() => {
    if (setTitle && column && root && title !== undefined) setTitle(column, title);
  }, [setTitle, column, root, title]);
  const api = s?.handle.api;
  const back = useCallback(() => void api?.back({ reason: 'trigger-press' }), [api]);
  if (!s || !column || !s.state.collapsed || !root) return null;
  const i = s.state.columns.indexOf(column);
  if (i < 1) return null;
  return { title: s.titles[s.state.columns[i - 1]] ?? 'Back', back };
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
  onSizeClassChange, controller, debug, children, className, ...props
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
  return usePart(handle, 'root', {}, {
    ...props,
    className: cx('group/split relative isolate h-full w-full touch-pan-y overflow-hidden bg-background', className),
    children: (state) => (
      <RootProvider handle={handle} state={state} titles={titles} setTitle={setTitle}>
        {children}
        <Scrim handle={handle} />
      </RootProvider>
    ),
  }, 'div');
}

function RootProvider({ handle, state, titles, setTitle, children }: RootContext & { children: ReactNode }) {
  const { sizeClass, collapsed, columns, sidebarOpen, sidebarBehavior, value, compactColumn, canGoBack, columnWidths, supplementaryOpen } = state;
  const key = columns.join();
  const ctx = useMemo<RootContext>(() => ({
    handle,
    state: { sizeClass, collapsed, columns: key ? (key.split(',') as SplitViewColumn[]) : [], sidebarOpen, sidebarBehavior, value, compactColumn, canGoBack, columnWidths, supplementaryOpen },
    titles,
    setTitle,
  }), [handle, sizeClass, collapsed, key, sidebarOpen, sidebarBehavior, value, compactColumn, canGoBack, columnWidths, supplementaryOpen, titles, setTitle]);
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
export interface SplitViewColumnProps {
  /** Preferred width, px (sidebar default 280, supplementary 340; the detail fills what's left). */
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  /** Draggable divider on the trailing edge (tiled only). Default true for sidebar and supplementary. */
  resizable?: boolean;
  /** Host a push/pop stack: the children become its root page (see `SplitViewStack`, `useSplitViewStack`). */
  stack?: boolean;
  /** Accessible name of the column region. */
  'aria-label'?: string;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

const COLUMN_BG: Record<SplitViewColumn, string> = {
  sidebar: 'bg-sidebar',
  supplementary: 'bg-background',
  detail: 'bg-background',
};

// Placed by the variables the primitive writes; a swipe moves the top column and the one under it by
// `--stack-progress`, with transitions off. The compact stack's offsets are times `--stack-dir` (-1 right to
// left), so columns enter from the trailing edge and follow the swipe from the leading one in either direction.
const COLUMN = cn(
  'group/column absolute inset-y-0 left-(--column-left) z-(--column-z) w-(--column-width) translate-x-[calc(var(--column-translate)_*_var(--stack-dir,1))] outline-none rtl:[--stack-dir:-1]',
  'transition-[left,width,translate] duration-spring-smooth ease-spring-smooth motion-reduce:transition-none',
  'group-data-instant/split:transition-none group-data-resizing/split:transition-none data-swiping:transition-none',
  'data-swiping:data-top:translate-x-[calc(var(--stack-progress)_*_100%_*_var(--stack-dir,1))] data-swiping:data-behind:translate-x-[calc((-30%_+_var(--stack-progress)_*_30%)_*_var(--stack-dir,1))]',
);
const DIM = cn(
  'pointer-events-none absolute inset-0 z-50 bg-black opacity-(--column-dim)',
  'transition-opacity duration-spring-smooth ease-spring-smooth motion-reduce:transition-none group-data-instant/split:transition-none',
  'group-data-swiping/column:transition-none group-data-swiping/column:group-data-behind/column:opacity-[calc(0.1_*_(1_-_var(--stack-progress)))]',
);

function ColumnPart({ column, width, minWidth, maxWidth, resizable, stack, children, className, style, ...props }: SplitViewColumnProps & { column: SplitViewColumn }) {
  const { handle } = useRoot(`SplitView${column[0].toUpperCase()}${column.slice(1)}`);
  const d = SPLIT_VIEW_COLUMN_DEFAULTS[column];
  const w = width ?? d.width, min = minWidth ?? d.minWidth, max = maxWidth ?? d.maxWidth, res = resizable ?? d.resizable;
  const { register } = handle.api.internal;
  useLayoutEffect(() => { register(column, { width: w, minWidth: min, maxWidth: max, resizable: res }); }, [register, column, w, min, max, res]);
  useLayoutEffect(() => () => register(column, null), [register, column]);

  const el = usePart(handle, column, {}, {
    ...props,
    className: COLUMN,
    children: (
      <>
        <div className={cn(
          'relative flex h-full min-w-0 flex-col overflow-hidden text-foreground',
          COLUMN_BG[column],
          'group-data-hairline/column:shadow-[inset_-1px_0_0_var(--border)]',
          className,
        )} style={style}>
          <Pane>{stack ? <SplitViewStack>{children}</SplitViewStack> : children}</Pane>
          <div aria-hidden="true" className={DIM} />
        </div>
        {column === 'sidebar' ? (
          <div aria-hidden="true" className={cn(
            'pointer-events-none absolute inset-y-0 -right-10 w-10 opacity-0 transition-opacity duration-300 group-data-lifted/column:opacity-100',
            'bg-[linear-gradient(to_right,--alpha(black/16%),transparent)]',
          )} />
        ) : (
          <div aria-hidden="true" className={cn(
            'pointer-events-none absolute inset-y-0 -left-10 w-10 opacity-0 transition-opacity duration-300 group-data-lifted/column:opacity-100 rtl:left-auto rtl:-right-10 rtl:-scale-x-100',
            'bg-[linear-gradient(to_left,--alpha(black/14%),transparent)]',
          )} />
        )}
        {column !== 'detail' ? <Resizer handle={handle} column={column} /> : null}
      </>
    ),
  }, 'section');
  return <ColumnCtx.Provider value={column}>{el}</ColumnCtx.Provider>;
}

/** Primary column: navigation (mailboxes, folders, settings sections). */
export function SplitViewSidebar(props: SplitViewColumnProps) {
  return <ColumnPart column="sidebar" aria-label="Sidebar" {...props} />;
}
/** Middle column of a three-column split: the list whose selection drives the detail. */
export function SplitViewSupplementary(props: SplitViewColumnProps) {
  return <ColumnPart column="supplementary" {...props} />;
}
/** Content column: fills the remaining width. */
export function SplitViewDetail(props: SplitViewColumnProps) {
  return <ColumnPart column="detail" {...props} />;
}

/* ── Divider ── */
function Resizer({ handle, column }: { handle: Handle; column: SplitViewColumn }) {
  return usePart(handle, 'resizer', { value: column }, {
    className: 'group/resizer absolute inset-y-0 -right-[5px] z-40 w-[10px] cursor-col-resize touch-none outline-none',
    children: (
      <div className={cn(
        'absolute inset-y-0 left-1/2 w-[3px] -translate-x-1/2 scale-y-[.96] rounded-full bg-primary opacity-0 transition-[opacity,scale] duration-200',
        'group-hover/resizer:scale-y-100 group-hover/resizer:opacity-45',
        'group-focus-visible/resizer:scale-y-100 group-focus-visible/resizer:opacity-100 group-active/resizer:scale-y-100 group-active/resizer:opacity-100 group-data-dragging/resizer:scale-y-100 group-data-dragging/resizer:opacity-100',
      )} />
    ),
  }, 'div');
}

/* ── Panes: one header + content pair that scroll together (a column, or one page of a nested stack) ── */
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
  const h1 = 'm-0 truncate text-[34px] leading-[1.15] font-extrabold tracking-[-.5px]';
  return usePart(handle, 'large-title', { value: pane }, {
    className: cn(spec.trailing != null ? 'flex items-end gap-4 px-4 pt-1 pb-2' : 'px-4 pt-1 pb-2', spec.className),
    children: spec.trailing != null ? (
      // A trailing item (a count, a button) shares the title's line, on the trailing edge.
      <>
        <div role="heading" aria-level={1} className={cn(h1, 'min-w-0 flex-1')}>{spec.title}</div>
        <div data-large-title-trailing="" className="flex shrink-0 items-center text-[34px] leading-[1.15]">{spec.trailing}</div>
      </>
    ) : (
      // A heading role, not an <h1>: host prose styles (a docs page's `.markdown h1`) would otherwise restyle it.
      <div role="heading" aria-level={1} className={h1}>{spec.title}</div>
    ),
  }, 'div');
}

/* ── Column chrome ── */
export interface SplitViewHeaderProps {
  title?: ReactNode;
  /** Inline title alignment. Leading titles share the available space with toolbar controls. */
  titleAlign?: 'center' | 'leading';
  /** iOS large title: drawn big at the top of the pane's SplitViewContent and scrolling with it; once it has
   *  gone under the bar the inline title (and the bar's hairline) spring in. */
  largeTitle?: boolean;
  /** Drawn on the large title's line, at the trailing edge (Reminders' open count). */
  largeTitleTrailing?: ReactNode;
  /** Classes for the large-title block, to line it up with the content (`mx-auto max-w-[760px] px-5`). */
  largeTitleClassName?: string;
  /** No large title: the inline title (and the bar's hairline) fade in once the content scrolls. */
  titleOnScroll?: boolean;
  /** Leading items (e.g. <SplitViewToggle/>). Replaced by the back button when collapsed and not the root. */
  leading?: ReactNode;
  trailing?: ReactNode;
  /** Back button label; defaults to the previous column's (or stack page's) title, truncated to the room the
   *  title leaves. */
  backLabel?: string;
  className?: string;
  style?: CSSProperties;
}

// The inline title and the hairline come in on the `fades.in` tween (the title rising on the snappy spring) and go
// on the quicker exit, from the header's `data-title-hidden`.
const TITLE_FADE = cn(
  'transition-[opacity,translate] [transition-duration:220ms,var(--duration-spring-snappy)] [transition-timing-function:cubic-bezier(.22,1,.36,1),var(--ease-spring-snappy)]',
  'group-data-title-hidden/header:translate-y-2 group-data-title-hidden/header:opacity-0 group-data-title-hidden/header:[transition-duration:var(--duration-exit),var(--duration-spring-snappy)] group-data-title-hidden/header:[transition-timing-function:var(--ease-exit),var(--ease-spring-snappy)]',
  'motion-reduce:transition-none',
);
const HAIRLINE_FADE = cn(
  'transition-opacity duration-220 ease-[cubic-bezier(.22,1,.36,1)] group-data-title-hidden/header:opacity-0 group-data-title-hidden/header:duration-exit group-data-title-hidden/header:ease-exit',
  'motion-reduce:transition-none',
);

const BACK = cn(
  'bl-btn flex cursor-pointer items-center border-0 bg-transparent py-1.5 pr-2 pl-0 [font-family:inherit] text-body text-primary outline-none',
  'focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-ring',
);

/** A back button: the column stack's (`split-view-back`) or a stack page's (`split-view-stack-back`). */
function BackButton({ stack, label, maxWidth }: { stack?: StackHandle; label: string; maxWidth: number | undefined }) {
  const { handle } = useRoot('SplitViewHeader');
  const props = {
    'aria-label': label === 'Back' ? undefined : `Back to ${label}`,
    className: cn(BACK, maxWidth != null ? 'max-w-(--back-max)' : 'max-w-[150px]'),
    // The room the centered title leaves, measured.
    style: maxWidth != null ? ({ '--back-max': maxWidth + 'px' } as CSSProperties) : undefined,
    children: (
      <>
        <Icon name="chevL" size={24} sw={2.4} className="shrink-0 rtl:-scale-x-100" />
        <span className="min-w-0 truncate">{label}</span>
      </>
    ),
  };
  return stack ? <StackBack handle={stack} {...props} /> : <ColumnBack handle={handle} {...props} />;
}
function ColumnBack({ handle, ...props }: { handle: Handle } & PartProps<'button'>) {
  return usePart(handle, 'back', {}, props, 'button');
}
function StackBack({ handle, ...props }: { handle: StackHandle } & PartProps<'button'>) {
  return usePart(handle, 'back', {}, props, 'button');
}

/** Column bar: back button when collapsed (or on a pushed stack page), title, leading / trailing items. */
export function SplitViewHeader({
  title, titleAlign = 'center', largeTitle, largeTitleTrailing, largeTitleClassName, titleOnScroll, leading, trailing, backLabel, className, style,
}: SplitViewHeaderProps) {
  const s = useRoot('SplitViewHeader');
  const column = useContext(ColumnCtx);
  const page = useContext(PageCtx);
  const pane = useContext(PaneCtx);
  const { setTitle } = s;
  const t = typeof title === 'string' ? title : undefined;
  const rootPage = !page || page.index === 0;
  useLayoutEffect(() => { if (column && rootPage) setTitle(column, t); }, [column, t, setTitle, rootPage]);
  const setPageTitle = page?.stack.setTitle;
  const pageKey = page?.pageKey;
  useLayoutEffect(() => { if (setPageTitle && pageKey) setPageTitle(pageKey, t); }, [setPageTitle, pageKey, t]);

  // Back: a pushed stack page pops its stack; otherwise the collapsed column stack pops a column.
  const inPage = !!page && page.index > 0;
  const i = column ? s.state.columns.indexOf(column) : -1;
  const prev = i > 0 ? s.state.columns[i - 1] : null;
  const showBack = inPage || (s.state.collapsed && !!prev);
  const prevTitle = inPage ? page.stack.titleAt(page.index - 1) : prev ? s.titles[prev] : undefined;
  const label = backLabel ?? prevTitle ?? 'Back';

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

  // The back label may use the room the centered title leaves on its side.
  const head = useRef<HTMLDivElement | null>(null);
  const titleEl = useRef<HTMLDivElement | null>(null);
  const [backMax, setBackMax] = useState<number | undefined>(undefined);
  useLayoutEffect(() => {
    const h = head.current;
    if (!showBack || !h) return;
    const m = () => {
      const tw = titleEl.current?.offsetWidth ?? 0;
      setBackMax(Math.max(44, tw ? (h.clientWidth - tw) / 2 - 10 : h.clientWidth * 0.6));
    };
    m();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(m);
    ro.observe(h);
    if (titleEl.current) ro.observe(titleEl.current);
    return () => ro.disconnect();
  }, [showBack, title]);

  const titleCls = cn('truncate text-body font-semibold tracking-[-.2px]',
    titleAlign === 'leading' ? 'min-w-0 flex-1 px-2' : 'pointer-events-none absolute left-1/2 max-w-[56%] -translate-x-1/2');
  const header = usePart(s.handle, 'header', { value: paneKey, largeTitle: large, titleOnScroll: !!titleOnScroll }, {
    ref: head,
    className: (h: SplitViewHeaderState) => cn('group/header relative z-30 flex h-toolbar shrink-0 items-center px-1.5', !h.fading && 'shadow-hairline-b', className),
    style,
    children: (h: SplitViewHeaderState) => (
      <>
        <div className={cn('relative z-1 flex items-center', titleAlign === 'leading' && !showBack && !leading ? 'min-w-0' : 'min-w-[44px]')}>
          {showBack ? <BackButton stack={inPage ? page.stack.handle : undefined} label={label} maxWidth={backMax} /> : leading}
        </div>
        {/* The inline title and the hairline fade in (and the title rises 8px) once the content has scrolled. */}
        <div ref={titleEl} className={cn(titleCls, h.fading && TITLE_FADE)} aria-hidden={!h.inline || undefined}>{title}</div>
        {h.fading ? <span aria-hidden="true" className={cn('pointer-events-none absolute inset-x-0 bottom-0 h-px bg-border', HAIRLINE_FADE)} /> : null}
        <div className="relative z-1 ml-auto flex items-center gap-0.5">{trailing}</div>
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

/** Scrolling body of a column. Draws the header's large title, if it has one, at the top of the scroll. */
export function SplitViewContent({ children, className, style }: { children?: ReactNode; className?: string; style?: CSSProperties }) {
  const { handle } = useRoot('SplitViewContent');
  const pane = useContext(PaneCtx);
  const ownKey = useId();
  const key = pane?.key ?? ownKey;
  const add = pane?.addContent;
  useLayoutEffect(() => add?.(), [add]);
  const large = pane?.large;
  return usePart(handle, 'content', { value: key }, {
    className: cn('bl-scroll relative min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain', className),
    style,
    children: (
      <>
        {large ? <LargeTitle handle={handle} pane={key} spec={large} /> : null}
        {children}
      </>
    ),
  }, 'div');
}

export interface SplitViewToggleProps {
  className?: string;
  'aria-label'?: string;
}
/** Sidebar button (`aria-expanded`, `aria-controls`). Shown whenever there's a sidebar to open or close; gone
 *  when collapsed, where back takes over. */
export function SplitViewToggle({ className, ...props }: SplitViewToggleProps) {
  const { handle } = useRoot('SplitViewToggle');
  return usePart(handle, 'toggle', {}, {
    ...props,
    className: cn(
      'bl-btn grid cursor-pointer place-items-center rounded-ctl border-0 bg-transparent px-2.5 py-2 text-primary outline-none',
      'transition-[background,scale] duration-150 hover:bg-secondary active:scale-[.94] focus-visible:ring-2 focus-visible:ring-ring',
      className,
    ),
    children: <Icon name="sidebar" size={22} sw={1.9} />,
  }, 'button');
}

/** Selected colours for a SplitViewItem: a background (foreground white), or both. */
export type SplitViewItemTint = string | { background: string; foreground?: string };

/** A SplitViewItem's surface: `pill` (inset rounded, sidebar default) or `row` (full-bleed with a separator);
 *  selected fills with the tint (pill) or a 14% wash of it (row), the item's own `tint` when it has one. */
export const splitViewItemVariants = cva(
  [
    'bl-btn group/item relative flex w-full cursor-pointer items-center gap-3 border-0 text-left [font-family:inherit] text-foreground outline-none',
    'transition-[background-color,color] duration-150',
    'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
  ],
  {
    variants: {
      variant: {
        pill: 'min-h-[40px] rounded-ctl px-2.5 py-1.5 text-[15.5px]',
        row: 'min-h-row px-4 py-2.5 text-[15.5px]',
      },
      selected: { true: '', false: 'bg-transparent hover:bg-secondary active:bg-accent' },
      tinted: { true: '', false: '' },
    },
    compoundVariants: [
      { variant: 'pill', selected: true, tinted: false, class: 'bg-primary text-primary-foreground' },
      { variant: 'pill', selected: true, tinted: true, class: 'bg-(--split-item-tint) text-(--split-item-on-tint)' },
      { variant: 'row', selected: true, tinted: false, class: 'bg-[color-mix(in_srgb,var(--primary)_14%,transparent)]' },
      { variant: 'row', selected: true, tinted: true, class: 'bg-[color-mix(in_srgb,var(--split-item-tint)_14%,transparent)]' },
    ],
    defaultVariants: { variant: 'pill', selected: false, tinted: false },
  },
);

export interface SplitViewItemProps extends Pick<VariantProps<typeof splitViewItemVariants>, 'variant'> {
  /** Selection value within this column. Several items may share one (the same mailbox under Favorites and
   *  under its account): every item whose id is selected draws selected. */
  id: string;
  title?: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  /** Trailing detail: a count, a time… */
  badge?: ReactNode;
  /** Replaces the title/subtitle layout entirely. */
  children?: ReactNode;
  /** `pill` (sidebar default): inset rounded row. `row`: full-bleed list row with a separator. */
  variant?: 'pill' | 'row' | null;
  /** This item's own selection colour instead of the app tint (Reminders' coloured lists). Also colours the
   *  icon while unselected. Exposed to custom content as `--split-item-tint` / `--split-item-on-tint`. */
  tint?: SplitViewItemTint;
  /** A hover card beside the item that previews what pressing it opens (a list's first items, a folder's notes). */
  preview?: ReactNode;
  /** Runs before the item selects; `event.preventDefault()` keeps it from selecting. */
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  className?: string;
}

/** A selectable row bound to the column's value: pressing it selects `id` and shows the next column. */
export function SplitViewItem({ id, title, subtitle, icon, badge, children, variant, tint, preview, onClick, className }: SplitViewItemProps) {
  const s = useRoot('SplitViewItem');
  const column = useContext(ColumnCtx) ?? 'supplementary';
  const v = variant ?? (column === 'sidebar' ? 'pill' : 'row');
  const selected = !s.state.collapsed && s.state.value[column] === id;
  const pushes = s.state.collapsed && s.state.columns.indexOf(column) < s.state.columns.length - 1;
  const tinted = tint != null;
  const tintStyle = tinted ? {
    '--split-item-tint': typeof tint === 'string' ? tint : tint.background,
    '--split-item-on-tint': typeof tint === 'string' ? 'white' : tint.foreground ?? 'white',
  } as CSSProperties : undefined;
  const onSel = selected && v === 'pill';
  const props: PartProps<'button'> = {
    'data-tinted': tinted || undefined,
    onClick,
    className: cn(splitViewItemVariants({ variant: v, selected, tinted }), className),
    // The item's own tint is a runtime color.
    style: tintStyle,
    children: (
      <>
        {children ?? (
          <>
            {icon ? <span className={cn('grid w-6 shrink-0 place-items-center',
              onSel ? tinted ? 'text-(--split-item-on-tint)' : 'text-primary-foreground' : tinted ? 'text-(--split-item-tint)' : 'text-primary')}>{icon}</span> : null}
            <span className="min-w-0 flex-1">
              <span className="block truncate leading-[1.3]">{title}</span>
              {subtitle ? <span className={cn('mt-px block truncate text-footnote',
                onSel ? tinted ? 'text-(--split-item-on-tint)/80' : 'text-primary-foreground/80' : 'text-muted-foreground')}>{subtitle}</span> : null}
            </span>
            {badge != null ? <span className={cn('shrink-0 text-detail tabular-nums',
              onSel ? tinted ? 'text-(--split-item-on-tint)/85' : 'text-primary-foreground/85' : 'text-muted-foreground')}>{badge}</span> : null}
            {pushes ? <Icon name="chev" size={14} sw={2.6} className={cn('shrink-0',
              onSel ? tinted ? 'text-(--split-item-on-tint)/70' : 'text-primary-foreground/70' : 'text-tertiary-foreground')} /> : null}
          </>
        )}
        {v === 'row' ? <span aria-hidden="true" className="pointer-events-none absolute right-0 bottom-0 left-4 h-px bg-border" /> : null}
      </>
    ),
  } as PartProps<'button'>;
  if (preview == null) return <ItemPart handle={s.handle} item={id} column={column} {...props} />;
  return (
    <HoverCard>
      <HoverCardTrigger render={<ItemPart handle={s.handle} item={id} column={column} {...props} />} />
      <HoverCardContent side="end" align="start">{preview}</HoverCardContent>
    </HoverCard>
  );
}

function ItemPart({ handle, item, column, ...props }: { handle: Handle; item: string; column: SplitViewColumn } & PartProps<'button'>) {
  // Its own key: the same value can show in several items.
  const id = useId();
  return usePart(handle, 'item', { id, item, column }, props, 'button');
}

/** A SplitViewSection's label: `default`, the small grey group label (Mail's "Favorites"); `prominent`, the
 *  bold 20px heading iOS uses over a list group (Reminders' "My Lists"). */
export const splitViewSectionLabelVariants = cva('', {
  variants: {
    variant: {
      default: 'px-2.5 pt-4 pb-1.5 text-footnote font-semibold tracking-[-.1px] text-muted-foreground',
      prominent: 'px-1 pt-6 pb-2 text-title font-bold tracking-[-.2px] text-foreground',
    },
  },
  defaultVariants: { variant: 'default' },
});

export interface SplitViewSectionProps extends VariantProps<typeof splitViewSectionLabelVariants> {
  /** Section label ("Favorites", "iCloud"). */
  title?: ReactNode;
  /** Classes for the label (merged over the variant's). */
  labelClassName?: string;
  /** The label becomes a disclosure button (UI SDK's Collapsible) that folds the section with a spring. */
  collapsible?: boolean;
  open?: boolean;
  /** Default true. */
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean, details: ChangeDetails) => void;
  children?: ReactNode;
  className?: string;
}
/** A titled group of SplitViewItems in a column. An item id may appear in more than one section; each copy
 *  highlights when it's selected. */
export function SplitViewSection({
  title, variant, labelClassName, collapsible, open, defaultOpen = true, onOpenChange, children, className,
}: SplitViewSectionProps) {
  const uid = useId();
  const labelCls = cn(splitViewSectionLabelVariants({ variant }), labelClassName);
  const items = <div className="flex flex-col gap-px">{children}</div>;
  return (
    <div data-slot="split-view-section" role="group" aria-labelledby={title != null ? uid : undefined} className={className}>
      {collapsible && title != null ? (
        <SdkCollapsible open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
          <SdkCollapsibleTrigger id={uid}
            className={cn('bl-btn group/section flex w-full cursor-pointer items-center border-0 bg-transparent text-left [font-family:inherit] outline-none focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-ring', labelCls)}>
            {(state) => (
              <>
                <span className="flex-1">{title}</span>
                <Chevron direction={state.open ? 'down' : 'right'} size={variant === 'prominent' ? 18 : 14} strokeWidth={2.6} className="text-primary" />
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

/* ── Nested stack ── */
export interface SplitViewStackApi {
  /** Push a page on top, under `key` (default: a new one) in `pages`. Pages are kept as elements, so read live data
   *  from hooks/context inside them. Nothing happens when `key` is in the stack already. */
  push: (page: ReactNode, options?: { key?: string }) => void;
  /** Pop the top page (no-op at the root). */
  pop: () => void;
  popToRoot: () => void;
  /** Pages including the root: 1 at the root. */
  depth: number;
  canPop: boolean;
}
interface StackInternal extends SplitViewStackApi {
  handle: StackHandle;
  setTitle: (key: string, title: string | undefined) => void;
  titleAt: (index: number) => string | undefined;
}
const StackCtx = createContext<StackInternal | null>(null);
interface PageState { index: number; pageKey: string; stack: StackInternal }
const PageCtx = createContext<PageState | null>(null);

/** The nearest SplitViewStack's push / pop. */
export function useSplitViewStack(): SplitViewStackApi {
  const c = useContext(StackCtx);
  if (!c) throw new Error('useSplitViewStack must be used inside <SplitViewStack> (or a column with `stack`)');
  return c;
}

export type SplitViewStackProps = SplitViewStackOptions & {
  /** The root page. */
  children?: ReactNode;
  /** The page for a key in `pages` that no `push` gave a node: a deep link, a stack restored after a reload, or
   *  a controller's `push(key)`. A key it returns nothing for renders nothing. */
  renderPage?: (page: string) => ReactNode;
  /** Changing this pops every pushed page at once (e.g. the sidebar selection the stack belongs to). */
  resetKey?: unknown;
  className?: string;
  style?: CSSProperties;
};

// Every offset is times `--stack-dir` (-1 right to left), so pages enter from the trailing edge and follow the
// swipe from the leading one in either direction.
const PAGE = cn(
  'group/page absolute inset-0 flex flex-col bg-inherit outline-none rtl:[--stack-dir:-1]',
  'transition-[translate] duration-spring-smooth ease-spring-smooth motion-reduce:transition-none group-data-instant/split:transition-none',
  'data-starting-style:translate-x-[calc((100%_+_24px)_*_var(--stack-dir,1))] data-ending-style:not-data-covered:translate-x-[calc((100%_+_24px)_*_var(--stack-dir,1))] data-covered:translate-x-[calc(-30%_*_var(--stack-dir,1))]',
  'data-swiping:transition-none data-swiping:not-data-covered:translate-x-[calc(var(--stack-progress)_*_100%_*_var(--stack-dir,1))] data-swiping:data-covered:translate-x-[calc((-30%_+_var(--stack-progress)_*_30%)_*_var(--stack-dir,1))]',
);
const PAGE_DIM = cn(
  'pointer-events-none absolute inset-0 z-50 bg-black opacity-0 group-data-covered/page:opacity-10',
  'transition-opacity duration-spring-smooth ease-spring-smooth motion-reduce:transition-none',
  'group-data-swiping/page:transition-none group-data-swiping/page:group-data-covered/page:opacity-[calc(0.1_*_(1_-_var(--stack-progress)))]',
);

/** A push/pop stack inside a column. Each page may have its own SplitViewHeader (whose back button pops,
 *  labelled with the page below's title) and SplitViewContent. The leading-edge swipe and Esc pop the
 *  innermost level first; the column stack only moves once this stack is at its root. Its pages are keys
 *  (`pages`/`defaultPages`/`onPagesChange`, a `controller`), from `"root"`: `useSplitViewStack().push(node)`
 *  pushes a node under a new key, and `renderPage` draws the keys nothing pushed. */
export function SplitViewStack({
  children, pages, defaultPages, onPagesChange, controller, renderPage, resetKey, debug, className, style,
}: SplitViewStackProps) {
  useRoot('SplitViewStack');
  const handle = usePrimitive(splitViewStack, { pages, defaultPages, onPagesChange, controller, debug });
  return usePart(handle, 'root', {}, {
    className: cn('relative min-h-0 flex-1 touch-pan-y overflow-hidden bg-inherit', className),
    style,
    children: (state) => (
      <StackPages handle={handle} pages={state.pages} exiting={state.exiting} resetKey={resetKey} renderPage={renderPage}>
        {children}
      </StackPages>
    ),
  }, 'div');
}

/** A page the stack draws: the node it was pushed with, or none (`renderPage` draws it). */
type Kept = { node?: ReactNode };

function StackPages({ handle, pages, exiting, resetKey, renderPage, children }: {
  handle: StackHandle; pages: string[]; exiting: string[]; resetKey: unknown;
  renderPage: ((page: string) => ReactNode) | undefined; children: ReactNode;
}) {
  // Every page drawn, by key, until it has left and finished animating out.
  const [kept, setKept] = useState<ReadonlyMap<string, Kept>>(() => new Map());
  const seq = useRef(0);
  const { api } = handle;
  const depth = pages.length;

  const push = useCallback((node: ReactNode, o?: { key?: string }) => {
    const key = o?.key ?? `page-${++seq.current}`;
    if (api.getPages().includes(key)) return;
    setKept((m) => new Map(m).set(key, { node }));
    // Canceled (or refused): the node goes again.
    if (!api.push(key)) setKept((m) => (m.get(key)?.node === node ? new Map([...m].filter(([k]) => k !== key)) : m));
  }, [api]);
  const pop = useCallback(() => void api.pop(), [api]);
  const popToRoot = useCallback(() => void api.popToRoot(), [api]);

  // Once the stack has heard of this render's pages (a controlled pop records its exit in the same commit, after
  // this effect), keep what is in it or leaving and let go of the rest.
  const live = [...pages, ...exiting].join('\u0000');
  useLayoutEffect(() => {
    let on = true;
    queueMicrotask(() => {
      if (!on) return;
      const now = handle.instance.get();
      const keep = new Set([...now.pages, ...now.exiting.map((exit) => exit.key)]);
      setKept((m) => {
        const next = new Map([...m].filter(([k]) => keep.has(k)));
        for (const k of now.pages) if (k !== SPLIT_VIEW_STACK_ROOT && !next.has(k)) next.set(k, {});
        return next.size === m.size && [...next.keys()].every((k) => m.has(k)) ? m : next;
      });
    });
    return () => { on = false; };
  }, [live, handle]);

  const first = useRef(true);
  useLayoutEffect(() => {
    if (first.current) { first.current = false; return; }
    api.popToRoot();
  }, [resetKey, api]);

  const [titles, setTitles] = useState<Record<string, string | undefined>>({});
  const setTitle = useCallback((key: string, t: string | undefined) => setTitles((m) => (m[key] === t ? m : { ...m, [key]: t })), []);
  const pageKeys = pages.join('\u0000');
  const titleAt = useCallback((i: number) => titles[pageKeys.split('\u0000')[i] ?? ''], [titles, pageKeys]);

  const ctx = useMemo<StackInternal>(() => ({ handle, push, pop, popToRoot, depth, canPop: depth > 1, setTitle, titleAt }),
    [handle, push, pop, popToRoot, depth, setTitle, titleAt]);
  // In stack order, then the ones leaving (over the page they uncover), then pushed ones the stack hasn't heard of.
  const keys = [...new Set([...pages, ...exiting, ...kept.keys()])].filter((k) => k !== SPLIT_VIEW_STACK_ROOT);
  return (
    <StackCtx.Provider value={ctx}>
      <StackPage handle={handle} value={SPLIT_VIEW_STACK_ROOT} stack={ctx}>{children}</StackPage>
      {keys.map((key) => {
        const own = kept.get(key);
        const node = own && 'node' in own ? own.node : renderPage?.(key);
        return node == null ? null : <StackPage key={key} handle={handle} value={key} stack={ctx}>{node}</StackPage>;
      })}
    </StackCtx.Provider>
  );
}

function StackPage({ handle, value, stack, children }: { handle: StackHandle; value: string; stack: StackInternal; children: ReactNode }) {
  return usePart(handle, 'page', { value }, {
    className: PAGE,
    children: (state) => (
      <PageProvider index={state.index} pageKey={value} stack={stack}>
        <Pane>{children}</Pane>
        <div aria-hidden="true" className={PAGE_DIM} />
        {state.index > 0 ? (
          <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 -left-10 w-10 bg-[linear-gradient(to_left,--alpha(black/14%),transparent)] rtl:left-auto rtl:-right-10 rtl:-scale-x-100" />
        ) : null}
      </PageProvider>
    ),
  }, 'div');
}

function PageProvider({ index, pageKey, stack, children }: PageState & { children: ReactNode }) {
  const value = useMemo(() => ({ index, pageKey, stack }), [index, pageKey, stack]);
  return <PageCtx.Provider value={value}>{children}</PageCtx.Provider>;
}

export interface SplitViewEmptyProps {
  icon?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  className?: string;
}
/** Placeholder for a column with nothing selected. */
export function SplitViewEmpty({ icon, title, description, className }: SplitViewEmptyProps) {
  return (
    <div data-slot="split-view-empty" className={cn('grid h-full place-items-center p-6 text-center', className)}>
      <div>
        {icon ? <div className="mb-2.5 grid place-items-center text-tertiary-foreground">{icon}</div> : null}
        {title ? <div className="text-callout font-medium text-muted-foreground">{title}</div> : null}
        {description ? <div className="mt-1 text-footnote text-tertiary-foreground">{description}</div> : null}
      </div>
    </div>
  );
}


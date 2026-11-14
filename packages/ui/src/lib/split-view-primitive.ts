import {
  bindLayer,
  createChange,
  createController,
  createResize,
  createRovingFocus,
  css,
  definePrimitive,
  type ChangeDetails,
  type ChangeOptions,
  type PrimitiveOptions,
  type ResizeBox,
  type ResizeDraft,
} from '@ui-sdk/core';
import { bindBack } from '@/lib/back';
import { bindEdgeSwipe } from '@/lib/edge-swipe';
import { bindSizeClass, type SizeClass, type SizeClassBreakpoints } from '@/lib/size-class';
import { bindScrollEdge } from '@/lib/scroll-edge';
import { createStack, type StackExit } from '@/lib/stack';

/* ══ SplitView — UISplitViewController as one primitive ══
   The primitive owns everything a split view decides: its size class (measured from its own box with
   `bindSizeClass`, or forced), which columns exist, whether the sidebar is open, the value selected in each
   column, which column is on top when collapsed, the columns' widths, and whether the supplementary column is
   shown. Each column is one persistent element; the layout is a pure function from that state to CSS variables
   (`--column-left`, `--column-width`, `--column-translate`, `--column-z`, `--column-dim`) and state attributes, so
   tiled columns, a floating sidebar and the compact stack are the same DOM in different places, moved by CSS.

     regular   sidebar · supplementary · detail tiled (the sidebar tiles; closing it slides it away)
     medium    supplementary · detail tiled; the sidebar floats over them (overlay) or pushes them (displace)
     compact   one column at a time: the columns are the pages of a `createStack`, so a pick pushes the next
               one and back, Escape and a swipe from the leading edge pop, innermost stack first

   Dividers are `createResize` handles (the separator pattern: arrows, Shift+arrows, Home, End, Enter or a double
   click to reset). A floating sidebar is a layer (`bindLayer`): Escape and a press outside close it. The items of
   each column are one tab stop (`createRovingFocus`, one group per column): Up, Down, Home and End move between
   them. A pane (a column's header and content, or a nested stack page's) follows its content's scroll in `bind`
   (`bindScrollEdge`, shared with NavigationStack): `data-scrolled` once it leaves the top, `data-under` once the
   large title has gone under the header, and the header shows or hides its inline title from them. */

export type SplitViewColumn = 'sidebar' | 'supplementary' | 'detail';
export type SplitViewSizeClass = SizeClass;
/** How an open sidebar shares space with the other columns. `auto`: tile at regular, overlay at medium. */
export type SplitViewSidebarBehavior = 'auto' | 'tile' | 'overlay' | 'displace';
/** The value selected in each column; `null` is nothing. */
export type SplitViewValue = Partial<Record<SplitViewColumn, string | null>>;
/** Column widths the user set, px. A column that isn't listed uses its `width`. */
export type SplitViewColumnWidths = Partial<Record<SplitViewColumn, number>>;
/** Where the sidebar starts, and what it resets to when the size class changes: one value for regular (medium
 *  then starts closed), or one per class. */
export type SplitViewDefaultSidebarOpen = boolean | { regular?: boolean; medium?: boolean };

/** Why the sidebar opened or closed: the toggle, Escape, a press outside a floating sidebar, a pick in it, the
 *  size class changing (it resets to `defaultSidebarOpen`), or a controller. */
export type SplitViewSidebarOpenChangeReason = 'trigger-press' | 'escape-key' | 'outside-press' | 'item-press' | 'content-resize' | 'imperative';
export type SplitViewValueChangeReason = 'item-press' | 'imperative';
/** Why the top column of the compact stack changed: a pick pushed the next one, the back button, Escape, the
 *  platform's back, a swipe from the leading edge, or a controller. */
export type SplitViewCompactColumnChangeReason = 'item-press' | 'trigger-press' | 'escape-key' | 'back' | 'swipe' | 'imperative';
export type SplitViewSupplementaryOpenChangeReason = 'trigger-press' | 'item-press' | 'imperative';
/** Why a column's width changed: a divider dragged, its keys, a double click or Enter on it, or a controller. */
export type SplitViewColumnWidthsChangeReason = 'drag' | 'resize-key' | 'handle-press' | 'imperative';

export type SplitViewSidebarOpenChangeDetails = ChangeDetails<SplitViewSidebarOpenChangeReason>;
/** `column` is the column whose value changed. */
export type SplitViewValueChangeDetails = ChangeDetails<SplitViewValueChangeReason> & { column: SplitViewColumn };
export type SplitViewCompactColumnChangeDetails = ChangeDetails<SplitViewCompactColumnChangeReason>;
export type SplitViewSupplementaryOpenChangeDetails = ChangeDetails<SplitViewSupplementaryOpenChangeReason>;
/** `column` is the column that was resized. */
export type SplitViewColumnWidthsChangeDetails = ChangeDetails<SplitViewColumnWidthsChangeReason> & { column: SplitViewColumn };

export type SplitViewOptions = {
  /** Forces a size class. Omit it to measure the split view's own width against `breakpoints`. */
  sizeClass?: SplitViewSizeClass;
  /** The widths, px, the medium and regular classes start at. Default 640 and 1024. */
  breakpoints?: SizeClassBreakpoints;
  sidebarBehavior?: SplitViewSidebarBehavior;
  /** Whether the sidebar is open, to control it. */
  sidebarOpen?: boolean;
  /** Where the sidebar starts and what it resets to whenever the size class changes. Default
   *  `{ regular: true, medium: false }`; a boolean sets regular. */
  defaultSidebarOpen?: SplitViewDefaultSidebarOpen;
  /** Every open and close, including the reset when the size class changes (reason `content-resize`), so a
   *  controlling parent can mirror it. */
  onSidebarOpenChange?: (open: boolean, details: SplitViewSidebarOpenChangeDetails) => void;
  /** The value selected in each column, to control it. */
  value?: SplitViewValue;
  defaultValue?: SplitViewValue;
  onValueChange?: (value: SplitViewValue, details: SplitViewValueChangeDetails) => void;
  /** The column on top while collapsed, to control it. Tracked at every size, so collapsing lands where you were. */
  compactColumn?: SplitViewColumn | null;
  /** Default: supplementary, else sidebar, else detail. */
  defaultCompactColumn?: SplitViewColumn | null;
  onCompactColumnChange?: (column: SplitViewColumn | null, details: SplitViewCompactColumnChangeDetails) => void;
  /** Whether the supplementary column is shown, to control it. Closed, it slides away and the detail takes its
   *  space (Notes' gallery); collapsed, the stack skips it. */
  supplementaryOpen?: boolean;
  /** Default true. */
  defaultSupplementaryOpen?: boolean;
  onSupplementaryOpenChange?: (open: boolean, details: SplitViewSupplementaryOpenChangeDetails) => void;
  /** Widths the user set, px, to control them. */
  columnWidths?: SplitViewColumnWidths;
  defaultColumnWidths?: SplitViewColumnWidths;
  /** Once a divider is let go, or moved with its keys. */
  onColumnWidthsChange?: (widths: SplitViewColumnWidths, details: SplitViewColumnWidthsChangeDetails) => void;
  /** Runs when the size class in effect changes (not on mount). */
  onSizeClassChange?: (sizeClass: SplitViewSizeClass) => void;
  /** Drives the split view from anywhere. Create one with `createSplitViewController()`. */
  controller?: SplitViewController;
} & PrimitiveOptions;

type Why<R extends string> = ChangeOptions<R>;

/** Changes and reads a split view from outside it. Write methods run the change callbacks like the user's own
 *  changes and return false when nothing changed or the change was canceled. */
export type SplitViewController = {
  getSizeClass: () => SplitViewSizeClass;
  isSidebarOpen: () => boolean;
  setSidebarOpen: (open: boolean, options?: Why<SplitViewSidebarOpenChangeReason>) => boolean;
  toggleSidebar: (options?: Why<SplitViewSidebarOpenChangeReason>) => boolean;
  getValue: () => SplitViewValue;
  setValue: (value: SplitViewValue, options?: Why<SplitViewValueChangeReason>) => boolean;
  /** Selects `id` in `column` (`null` clears it) and shows the column after it, which pushes it when collapsed. */
  select: (column: SplitViewColumn, id: string | null, options?: Why<SplitViewValueChangeReason>) => boolean;
  getCompactColumn: () => SplitViewColumn;
  setCompactColumn: (column: SplitViewColumn, options?: Why<SplitViewCompactColumnChangeReason>) => boolean;
  /** Puts `column` on top of the compact stack. */
  show: (column: SplitViewColumn, options?: Why<SplitViewCompactColumnChangeReason>) => boolean;
  /** Pops the compact stack to the column before the top one. */
  back: (options?: Why<SplitViewCompactColumnChangeReason>) => boolean;
  isSupplementaryOpen: () => boolean;
  setSupplementaryOpen: (open: boolean, options?: Why<SplitViewSupplementaryOpenChangeReason>) => boolean;
  getColumnWidths: () => SplitViewColumnWidths;
  setColumnWidths: (widths: SplitViewColumnWidths, options?: Why<SplitViewColumnWidthsChangeReason>) => boolean;
  /** Sets one column's width, clamped to its limits. */
  setColumnWidth: (column: SplitViewColumn, width: number, options?: Why<SplitViewColumnWidthsChangeReason>) => boolean;
};

/** A handle for a split view: pass it as `controller`, then call it from anywhere. */
export function createSplitViewController() {
  return createController<SplitViewController>();
}

/** What a column declares about its size. */
export type SplitViewColumnSpec = { width: number; minWidth: number; maxWidth: number; resizable: boolean };

export const SPLIT_VIEW_COLUMNS: readonly SplitViewColumn[] = ['sidebar', 'supplementary', 'detail'];
export const SPLIT_VIEW_COLUMN_DEFAULTS: Record<SplitViewColumn, SplitViewColumnSpec> = {
  sidebar: { width: 280, minWidth: 200, maxWidth: 380, resizable: true },
  supplementary: { width: 340, minWidth: 260, maxWidth: 480, resizable: true },
  detail: { width: 0, minWidth: 320, maxWidth: Infinity, resizable: false },
};

type Store = {
  /** What `bindSizeClass` measured. */
  measured: SizeClass;
  /** What the `sizeClass` option forces. */
  forced: SizeClass | undefined;
  breakpoints: string;
  behavior: SplitViewSidebarBehavior;
  specs: Partial<Record<SplitViewColumn, SplitViewColumnSpec>>;
  sidebarOpen: boolean;
  value: SplitViewValue;
  compactColumn: SplitViewColumn | null;
  supplementaryOpen: boolean;
  columnWidths: SplitViewColumnWidths;
  /** The divider a pointer drags. */
  resizing: ResizeDraft | null;
  /** The compact stack's pages: the shown columns up to the top one. A stack only while compact (`active`). */
  pages: string[];
  exiting: StackExit[];
  /** The first layout has painted: from here on, moves animate. */
  ready: boolean;
  /** The item of each column with its tab stop (`createRovingFocus`). */
  focusedSidebar: string | null;
  focusedSupplementary: string | null;
  focusedDetail: string | null;
  /** Each pane (by its key) whose content is rendered, and how far that content has scrolled. */
  panes: Record<string, PaneScroll>;
};

/** A pane's content: past the top (`scrolled`), past the large title (`under`). */
type PaneScroll = { scrolled: boolean; under: boolean };

/** How far, px, a pane's content scrolls before it counts as scrolled. */
const PANE_SCROLLED = 8;
/** The large title counts as gone under the header this many px before its bottom does. */
const PANE_UNDER = 4;

const breakpointsKey = (b: SizeClassBreakpoints | undefined) => `${b?.medium ?? 640},${b?.regular ?? 1024}`;
const breakpointsOf = (key: string): SizeClassBreakpoints => {
  const [medium, regular] = key.split(',').map(Number);
  return { medium, regular };
};
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const flag = (on: boolean | undefined) => (on ? '' : undefined);
const px = (n: number) => `${Math.round(n * 100) / 100}px`;

const sizeClassIn = (state: Store) => state.forced ?? state.measured;
const behaviorIn = (state: Store): Exclude<SplitViewSidebarBehavior, 'auto'> =>
  state.behavior !== 'auto' ? state.behavior : sizeClassIn(state) === 'regular' ? 'tile' : 'overlay';
const specOf = (state: Store, column: SplitViewColumn) => state.specs[column] ?? SPLIT_VIEW_COLUMN_DEFAULTS[column];
/** Columns that are rendered, in order. */
const registeredIn = (state: Store) => SPLIT_VIEW_COLUMNS.filter((c) => state.specs[c]);
/** Registered columns that are hidden: the supplementary, closed, when there's a detail to take its space. */
const hiddenIn = (state: Store): SplitViewColumn[] =>
  !state.supplementaryOpen && state.specs.supplementary && state.specs.detail ? ['supplementary'] : [];
/** Columns that are shown, in order. */
const presentIn = (state: Store) => {
  const hidden = hiddenIn(state);
  return registeredIn(state).filter((c) => !hidden.includes(c));
};
const topIn = (state: Store): SplitViewColumn => {
  const present = presentIn(state);
  const top = state.compactColumn;
  if (top && present.includes(top)) return top;
  return present.includes('supplementary') ? 'supplementary' : present.includes('sidebar') ? 'sidebar' : present[0] ?? 'detail';
};
const sidebarOpenIn = (state: Store) => presentIn(state).includes('sidebar') && state.sidebarOpen;
const pagesIn = (state: Store) => {
  const present = presentIn(state);
  return present.slice(0, Math.max(0, present.indexOf(topIn(state))) + 1);
};
const sidebarDefault = (open: SplitViewDefaultSidebarOpen | undefined, sizeClass: SizeClass) => {
  const per = typeof open === 'object' ? open : { regular: open };
  return sizeClass === 'regular' ? per.regular ?? true : sizeClass === 'medium' ? per.medium ?? false : false;
};
const sameList = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/** Where a column is, as CSS. Lengths are expressions of the root's width (`100%`), so a container resize inside
 *  one class re-lays out without starting a transition. */
export type SplitViewColumnLayout = {
  left: string;
  width: string;
  translate: string;
  z: number;
  /** Black wash over the column (compact: the columns under the top one). */
  dim: number;
  /** Off-screen or covered: out of the tab order and the accessibility tree. */
  inert: boolean;
  /** The top column of the compact stack. */
  top: boolean;
  /** Under the top column of the compact stack. */
  behind: boolean;
  /** Draws the lifted edge shadow (a floating sidebar, a pushed compact column). */
  lifted: boolean;
  /** The divider on the trailing edge can be dragged. */
  resizable: boolean;
  /** A hairline on the trailing edge. */
  hairline: boolean;
};

/** The layout: columns by name, and how much the scrim covers (0 to 1). */
export function splitViewLayout(state: Store, widthOf: (column: SplitViewColumn) => number) {
  const out: Partial<Record<SplitViewColumn, SplitViewColumnLayout>> = {};
  const present = presentIn(state);
  const hidden = hiddenIn(state);
  const sizeClass = sizeClassIn(state);
  const base = { z: 0, dim: 0, inert: true, top: false, behind: false, lifted: false, resizable: false, hairline: true };
  let scrim = 0;
  if (sizeClass === 'compact') {
    const t = Math.max(0, present.indexOf(topIn(state)));
    for (const c of hidden) out[c] = { ...base, left: '0px', width: '100%', translate: 'calc(100% + 24px)' };
    present.forEach((c, i) => {
      out[c] = {
        ...base,
        left: '0px',
        width: '100%',
        translate: i < t ? '-30%' : i === t ? '0px' : 'calc(100% + 24px)',
        z: 10 + i,
        dim: i < t ? 0.1 : 0,
        inert: i !== t,
        top: i === t,
        behind: i < t,
        lifted: i > 0 && i <= t,
        hairline: false,
      };
    });
    return { columns: out, scrim };
  }
  const has = (c: SplitViewColumn) => present.includes(c);
  const behavior = behaviorIn(state);
  const hasSide = has('sidebar') && present.length > 1;
  const sideShown = hasSide && state.sidebarOpen;
  const side = specOf(state, 'sidebar');
  const sw = hasSide ? clamp(widthOf('sidebar'), side.minWidth, side.maxWidth) : 0;
  const tiled = sideShown && behavior === 'tile';
  // Displace keeps the other columns' widths and pushes them along; tile gives the sidebar its own room.
  const shift = sideShown && behavior !== 'overlay' ? sw : 0;
  const taken = tiled ? sw : 0;
  if (hasSide) {
    out.sidebar = {
      ...base,
      left: px(sideShown ? 0 : -sw - (behavior === 'tile' ? 0 : 32)),
      width: px(sw),
      translate: '0px',
      z: behavior === 'tile' ? 2 : 30,
      inert: !sideShown,
      lifted: sideShown && behavior !== 'tile',
      resizable: tiled && side.resizable,
    };
    if (sideShown && behavior !== 'tile') scrim = behavior === 'overlay' ? 1 : 0.6;
  }
  // A hidden column tucks in behind the leading edge of the space it gave up, keeping its width.
  for (const c of hidden) {
    const s = specOf(state, c);
    const w = clamp(widthOf(c), s.minWidth, s.maxWidth);
    out[c] = { ...base, left: px(shift - w - 1), width: px(w), translate: '0px' };
  }
  const rest = present.filter((c) => c !== 'sidebar' || !hasSide);
  // At most two columns share the room: the first takes its width (within what the last one needs), the last
  // takes what's left.
  let first: string | undefined;
  rest.forEach((c, i) => {
    const last = i === rest.length - 1;
    const s = specOf(state, c);
    let width: string;
    if (!last) {
      const after = rest.slice(i + 1).reduce((a, n) => a + specOf(state, n).minWidth, 0);
      const pref = clamp(widthOf(c), s.minWidth, s.maxWidth);
      const room = `calc(100% - ${px(taken + after)})`;
      const most = Number.isFinite(s.maxWidth) ? `min(${px(s.maxWidth)}, ${room})` : room;
      width = `clamp(${px(s.minWidth)}, ${px(pref)}, max(${px(s.minWidth)}, ${most}))`;
      first = width;
    } else {
      width = first ? `max(0px, calc(100% - ${px(taken)} - ${first}))` : `max(0px, calc(100% - ${px(taken)}))`;
    }
    out[c] = {
      ...base,
      left: first && last ? `calc(${px(shift)} + ${first})` : px(shift),
      width,
      translate: '0px',
      z: 1,
      inert: false,
      resizable: !last && s.resizable,
      hairline: !last,
    };
  });
  return { columns: out, scrim };
}

/** What the root hands its children, and what `useSplitView()` reads. */
export type SplitViewState = {
  /** The size class in effect: measured from the split view's own width unless `sizeClass` forces one. */
  sizeClass: SplitViewSizeClass;
  /** True in compact: one column at a time, navigated like a stack. */
  collapsed: boolean;
  /** The columns shown, in order (a closed supplementary is left out). */
  columns: SplitViewColumn[];
  sidebarOpen: boolean;
  /** The sidebar behavior for the current size class. */
  sidebarBehavior: Exclude<SplitViewSidebarBehavior, 'auto'>;
  value: SplitViewValue;
  /** The top column of the compact stack (tracked at every size). */
  compactColumn: SplitViewColumn;
  /** Collapsed, with a column to go back to. */
  canGoBack: boolean;
  columnWidths: SplitViewColumnWidths;
  supplementaryOpen: boolean;
};

/** What a column's parts hand `render` functions and state-based class names. */
export type SplitViewColumnState = {
  column: SplitViewColumn;
  top: boolean;
  behind: boolean;
  lifted: boolean;
};

/** What a header hands `render` functions and state-based class names. */
export type SplitViewHeaderState = {
  /** It has a large title, drawn by the pane's content (or under the bar when there is none). */
  largeTitle: boolean;
  /** Its pane has content to scroll. */
  inContent: boolean;
  /** The inline title comes and goes with the scroll. */
  fading: boolean;
  /** The inline title (and the bar's hairline) shows. */
  inline: boolean;
};

const headerState = (
  pane: PaneScroll | undefined,
  { largeTitle = false, titleOnScroll = false }: { largeTitle?: boolean; titleOnScroll?: boolean },
): SplitViewHeaderState => {
  const inContent = !!pane;
  const onScroll = !largeTitle && titleOnScroll && inContent;
  return {
    largeTitle,
    inContent,
    fading: largeTitle || onScroll,
    inline: largeTitle ? inContent && pane.under : onScroll ? pane.scrolled : true,
  };
};

/** What an item hands `render` functions and state-based class names. */
export type SplitViewItemState = {
  selected: boolean;
  /** Collapsed: pressing it pushes the next column. */
  pushes: boolean;
};

function stateOf(state: Store): SplitViewState {
  const sizeClass = sizeClassIn(state);
  const columns = presentIn(state);
  const top = topIn(state);
  return {
    sizeClass,
    collapsed: sizeClass === 'compact',
    columns,
    sidebarOpen: sidebarOpenIn(state),
    sidebarBehavior: behaviorIn(state),
    value: state.value,
    compactColumn: top,
    canGoBack: sizeClass === 'compact' && columns.indexOf(top) > 0,
    columnWidths: state.columnWidths,
    supplementaryOpen: state.supplementaryOpen,
  };
}

export const splitView = definePrimitive({
  name: 'split-view',
  options: {
    sizeClass: 'string',
    breakpoints: 'value',
    sidebarBehavior: 'string',
    sidebarOpen: 'boolean',
    defaultSidebarOpen: 'value',
    onSidebarOpenChange: 'callback',
    value: 'value',
    defaultValue: 'value',
    onValueChange: 'callback',
    compactColumn: 'string',
    defaultCompactColumn: 'string',
    onCompactColumnChange: 'callback',
    supplementaryOpen: 'boolean',
    defaultSupplementaryOpen: 'boolean',
    onSupplementaryOpenChange: 'callback',
    columnWidths: 'value',
    defaultColumnWidths: 'value',
    onColumnWidthsChange: 'callback',
    onSizeClassChange: 'callback',
    controller: 'value',
  },
  controlled: ['sidebarOpen', 'value', 'compactColumn', 'supplementaryOpen', 'columnWidths'],
  state: (options: SplitViewOptions): Store => {
    const sizeClass = options.sizeClass ?? 'regular';
    return {
      measured: 'regular',
      forced: options.sizeClass,
      breakpoints: breakpointsKey(options.breakpoints),
      behavior: options.sidebarBehavior ?? 'auto',
      specs: {},
      sidebarOpen: options.sidebarOpen ?? sidebarDefault(options.defaultSidebarOpen, sizeClass),
      value: options.value ?? options.defaultValue ?? {},
      compactColumn: options.compactColumn ?? options.defaultCompactColumn ?? null,
      supplementaryOpen: options.supplementaryOpen ?? options.defaultSupplementaryOpen ?? true,
      columnWidths: options.columnWidths ?? options.defaultColumnWidths ?? {},
      resizing: null,
      pages: [],
      exiting: [],
      ready: false,
      focusedSidebar: null,
      focusedSupplementary: null,
      focusedDetail: null,
      panes: {},
    };
  },
  sync: (options) => ({
    forced: options.sizeClass,
    breakpoints: breakpointsKey(options.breakpoints),
    behavior: options.sidebarBehavior ?? 'auto',
    ...(options.sidebarOpen === undefined ? {} : { sidebarOpen: options.sidebarOpen }),
    ...(options.value === undefined ? {} : { value: options.value }),
    ...(options.compactColumn === undefined ? {} : { compactColumn: options.compactColumn }),
    ...(options.supplementaryOpen === undefined ? {} : { supplementaryOpen: options.supplementaryOpen }),
    ...(options.columnWidths === undefined ? {} : { columnWidths: options.columnWidths }),
  }),
  api: (context) => {
    const { store, options } = context;
    const change = createChange(context);
    const imperative = <R extends string>(o: Why<R> | undefined, fallback = 'imperative') =>
      ({ reason: (o?.reason ?? fallback) as R, event: o?.event });

    const stack = createStack<Store, SplitViewCompactColumnChangeReason>(context, {
      key: 'pages',
      exiting: 'exiting',
      // Popping a column is choosing the one under it.
      set: (pages, details) => {
        const to = pages.at(-1);
        return !!to && change('compactColumn', to as SplitViewColumn, details);
      },
      back: bindBack,
      // Tiled, the same columns are side by side: nothing pops, and a new top column moves no focus.
      active: () => sizeClassIn(store.get()) === 'compact',
      // One element per column for its whole life, placed by the layout: no exits, and `inert` stays the layout's.
      persistent: true,
    });

    // The stack's pages follow the size class, the columns and the top column, whoever changed them. A change
    // of class also resets the sidebar to where that class starts.
    let sizeClass = sizeClassIn(store.get());
    context.onDestroy(
      store.subscribe(() => {
        const state = store.get();
        const pages = pagesIn(state);
        if (!sameList(pages, state.pages)) store.set({ pages });
        const next = sizeClassIn(state);
        if (next === sizeClass) return;
        sizeClass = next;
        const open = sidebarDefault(options().defaultSidebarOpen, next);
        if (!state.ready) {
          // Where it starts, not a change: the first measurement.
          if (options().sidebarOpen === undefined && open !== state.sidebarOpen) store.set({ sidebarOpen: open });
          return;
        }
        if (open !== state.sidebarOpen) change('sidebarOpen', open, { reason: 'content-resize' });
        options().onSizeClassChange?.(next);
      }),
    );

    const widthOf = (state: Store, column: SplitViewColumn) => {
      const draft = state.resizing;
      if (draft?.key === column) return draft.box.width;
      return state.columnWidths[column] ?? specOf(state, column).width;
    };
    const resize = createResize<Store>(context, {
      boxes: (state) => {
        const boxes: Record<string, ResizeBox> = {};
        for (const c of ['sidebar', 'supplementary'] as const) {
          if (state.specs[c]) boxes[c] = { x: 0, y: 0, width: state.columnWidths[c] ?? specOf(state, c).width, height: 1 };
        }
        return boxes;
      },
      draft: 'resizing',
      set: (boxes, details) => {
        const before = store.get().columnWidths;
        const next: SplitViewColumnWidths = { ...before };
        let column: SplitViewColumn | undefined;
        for (const [key, box] of Object.entries(boxes)) {
          const c = key as SplitViewColumn;
          const w = Math.round(box.width);
          if ((before[c] ?? specOf(store.get(), c).width) !== w) { next[c] = w; column = c; }
        }
        return !!column && change('columnWidths', next, { ...details, column });
      },
      min: (key) => ({ width: specOf(store.get(), key as SplitViewColumn).minWidth, height: 1 }),
      max: (key) => ({ width: specOf(store.get(), key as SplitViewColumn).maxWidth, height: 1 }),
      label: (key) => (key === 'sidebar' ? 'Sidebar' : 'List'),
      message: ({ label, box }) => `${label} ${Math.round(box.width)} pixels wide`,
    });

    // One tab stop per column: Up, Down, Home and End move between its items. An item on a covered page of a
    // nested stack can't take focus.
    type ItemProps = { item: string; column: string };
    const itemEls = new Map<string, HTMLElement>();
    const roving = (column: SplitViewColumn, key: 'focusedSidebar' | 'focusedSupplementary' | 'focusedDetail') =>
      createRovingFocus<Store, ItemProps>(context, {
        slot: 'item',
        key,
        focusable: (item) => !itemEls.get(item.key)?.closest('[inert]'),
        preferred: (item) => store.get().value[column] === item.props.item,
      });
    const rovers: Record<SplitViewColumn, ReturnType<typeof roving>> = {
      sidebar: roving('sidebar', 'focusedSidebar'),
      supplementary: roving('supplementary', 'focusedSupplementary'),
      detail: roving('detail', 'focusedDetail'),
    };
    const roverOf = (column: string) => rovers[column as SplitViewColumn] ?? rovers.supplementary;

    /** A pane's content: whether it is rendered, has scrolled off its top, and has scrolled its large title (the
     *  pane's `large-title` part) under the header. */
    function bindPane(el: HTMLElement, pane: string) {
      const set = (patch: Partial<PaneScroll>) => {
        const panes = store.get().panes;
        const cur = panes[pane] ?? { scrolled: false, under: false };
        if (panes[pane] && Object.entries(patch).every(([k, v]) => cur[k as keyof PaneScroll] === v)) return;
        store.set({ panes: { ...panes, [pane]: { ...cur, ...patch } } });
      };
      set({});
      const offScrolled = bindScrollEdge(el, { threshold: () => PANE_SCROLLED, onChange: (scrolled) => set({ scrolled }) });
      const offUnder = bindScrollEdge(el, {
        threshold: () => {
          const title = context.element('large-title', pane)?.querySelector<HTMLElement>('[role=heading]');
          return title ? title.offsetTop + title.offsetHeight - PANE_UNDER : Infinity;
        },
        onChange: (under) => set({ under }),
      });
      return () => {
        offScrolled();
        offUnder();
        const panes = { ...store.get().panes };
        delete panes[pane];
        store.set({ panes });
      };
    }

    function setSidebarOpen(open: boolean, o?: Why<SplitViewSidebarOpenChangeReason>) {
      return open !== store.get().sidebarOpen && change('sidebarOpen', open, imperative(o));
    }
    function show(column: SplitViewColumn, o?: Why<SplitViewCompactColumnChangeReason>) {
      return column !== topIn(store.get()) && change('compactColumn', column, imperative(o));
    }
    function select(column: SplitViewColumn, id: string | null, o?: Why<SplitViewValueChangeReason>) {
      const state = store.get();
      const why = imperative(o);
      // Picking the selected id again still shows what follows it; a canceled change shows nothing.
      const same = state.value[column] === id;
      if (!same && !change('value', { ...state.value, [column]: id }, { ...why, column })) return false;
      const present = presentIn(state);
      const after = present[present.indexOf(column) + 1];
      show(id != null && after ? after : column, why);
      // A floating sidebar gets out of the way once something is picked in it.
      if (column === 'sidebar' && sizeClassIn(state) !== 'compact' && behaviorIn(state) !== 'tile') {
        setSidebarOpen(false, { reason: o?.reason === 'item-press' ? 'item-press' : 'imperative', event: o?.event });
      }
      return !same;
    }
    function setColumnWidth(column: SplitViewColumn, width: number, o?: Why<SplitViewColumnWidthsChangeReason>) {
      const s = specOf(store.get(), column);
      const w = Math.round(clamp(width, s.minWidth, s.maxWidth));
      const state = store.get();
      if ((state.columnWidths[column] ?? s.width) === w) return false;
      return change('columnWidths', { ...state.columnWidths, [column]: w }, { ...imperative(o), column });
    }

    /** Keys on a divider: arrows move it 12px (48 with Shift) and Home and End go to its limits, through
     *  `createResize` (its clamp and announcement); Enter resets it to the column's own width. */
    function resizerKeydown(event: KeyboardEvent, column: SplitViewColumn) {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const state = store.get();
      const s = specOf(state, column);
      const why = { reason: 'resize-key' as const, event };
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        resize.resizeBy(column, 'e', (event.key === 'ArrowRight' ? 1 : -1) * (event.shiftKey ? 48 : 12), 0, why);
      } else if (event.key === 'Home' || event.key === 'End') {
        resize.resizeTo(column, { ...resize.box(state, column), width: event.key === 'Home' ? s.minWidth : s.maxWidth }, why, 'e');
      } else if (event.key === 'Enter') {
        setColumnWidth(column, s.width, { reason: 'handle-press', event });
      } else return;
      event.preventDefault();
    }

    /** The root: its size class, the leading-edge swipe, and the first paint. */
    function bindRoot(el: HTMLElement) {
      let stopSize: (() => void) | undefined;
      let bound = '';
      const bindSize = () => {
        const state = store.get();
        const key = state.forced ? '' : state.breakpoints;
        if (key === bound && (stopSize || state.forced)) return;
        stopSize?.();
        stopSize = undefined;
        bound = key;
        if (!state.forced) {
          stopSize = bindSizeClass(el, {
            breakpoints: breakpointsOf(state.breakpoints),
            onChange: (measured) => store.set({ measured }),
          });
        } else el.setAttribute('data-size-class', state.forced);
      };
      bindSize();
      const offStore = store.subscribe(bindSize);
      const offSwipe = bindEdgeSwipe(el, { ...stack.swipe, size: 28 });
      // Springs start once the first layout has painted.
      let b = 0;
      const a = requestAnimationFrame(() => {
        b = requestAnimationFrame(() => store.set({ ready: true }));
      });
      return () => {
        cancelAnimationFrame(a);
        cancelAnimationFrame(b);
        offStore();
        offSwipe();
        stopSize?.();
      };
    }

    /** A floating sidebar is a layer while it's open: Escape and a press outside it close it. */
    function bindSidebarLayer(el: HTMLElement) {
      let off: (() => void) | undefined;
      const root = () => el.closest('[data-slot="split-view"]');
      const update = () => {
        const state = store.get();
        const floating = sizeClassIn(state) !== 'compact' && behaviorIn(state) !== 'tile' && sidebarOpenIn(state) && presentIn(state).length > 1;
        if (floating === !!off) return;
        if (!floating) { off?.(); off = undefined; return; }
        off = bindLayer(el, {
          // The toggle that opened it counts as inside, so pressing it toggles once.
          contains: (target) => {
            const toggle = target instanceof Element ? target.closest('[data-slot="split-view-toggle"]') : null;
            return !!toggle && root()?.contains(toggle) === true;
          },
          onDismiss: (reason, event) => {
            if (reason !== 'window-blur') setSidebarOpen(false, { reason, event });
          },
        });
      };
      update();
      const offStore = store.subscribe(update);
      return () => { offStore(); off?.(); };
    }

    const api = {
      getSizeClass: () => sizeClassIn(store.get()),
      isSidebarOpen: () => sidebarOpenIn(store.get()),
      setSidebarOpen,
      toggleSidebar: (o?: Why<SplitViewSidebarOpenChangeReason>) => setSidebarOpen(!store.get().sidebarOpen, o),
      getValue: () => store.get().value,
      setValue: (value: SplitViewValue, o?: Why<SplitViewValueChangeReason>) => {
        const before = store.get().value;
        const column = SPLIT_VIEW_COLUMNS.find((c) => before[c] !== value[c]);
        return !!column && change('value', value, { ...imperative(o), column });
      },
      select,
      getCompactColumn: () => topIn(store.get()),
      setCompactColumn: show,
      show,
      back: (o?: Why<SplitViewCompactColumnChangeReason>) => {
        const state = store.get();
        const present = presentIn(state);
        const i = present.indexOf(topIn(state));
        return i > 0 && show(present[i - 1], o);
      },
      isSupplementaryOpen: () => store.get().supplementaryOpen,
      setSupplementaryOpen: (open: boolean, o?: Why<SplitViewSupplementaryOpenChangeReason>) =>
        open !== store.get().supplementaryOpen && change('supplementaryOpen', open, imperative(o)),
      getColumnWidths: () => store.get().columnWidths,
      setColumnWidths: (widths: SplitViewColumnWidths, o?: Why<SplitViewColumnWidthsChangeReason>) => {
        const before = store.get().columnWidths;
        const column = SPLIT_VIEW_COLUMNS.find((c) => before[c] !== widths[c]);
        return !!column && change('columnWidths', widths, { ...imperative(o), column });
      },
      setColumnWidth,
      internal: {
        stack,
        resize,
        layout: (state: Store) => splitViewLayout(state, (c) => widthOf(state, c)),
        widthOf: (state: Store, column: SplitViewColumn) => widthOf(state, column),
        spec: (state: Store, column: SplitViewColumn) => specOf(state, column),
        state: stateOf,
        /** A column says it's there, with its size. `null` takes it away. */
        register(column: SplitViewColumn, spec: SplitViewColumnSpec | null) {
          const specs = store.get().specs;
          const cur = specs[column];
          if (!spec) {
            if (!cur) return;
            const next = { ...specs };
            delete next[column];
            store.set({ specs: next });
            return;
          }
          if (cur && cur.width === spec.width && cur.minWidth === spec.minWidth && cur.maxWidth === spec.maxWidth && cur.resizable === spec.resizable) return;
          store.set({ specs: { ...specs, [column]: spec } });
        },
        bindRoot,
        bindSidebarLayer,
        resizerKeydown,
        bindPane,
        /** An item joins its column's tab stop group. */
        bindItem(el: HTMLElement, part: { key: string; props: ItemProps }) {
          itemEls.set(part.key, el);
          const off = roverOf(part.props.column).bind(el, part);
          return () => {
            off();
            if (itemEls.get(part.key) === el) itemEls.delete(part.key);
          };
        },
        itemTabIndex: (state: Store, part: { key: string; props: ItemProps }) => roverOf(part.props.column).tabIndex(state, part),
        itemKeydown: (event: KeyboardEvent, el: HTMLElement, column: string) => void roverOf(column).keydown(event, el),
        /** Collapsed, an item that pushes the column after it. */
        pushes(state: Store, column: SplitViewColumn) {
          const present = presentIn(state);
          return sizeClassIn(state) === 'compact' && present.indexOf(column) < present.length - 1;
        },
        /** Whether `id` draws selected in `column`: never while collapsed, where rows are navigation. */
        selected: (state: Store, column: SplitViewColumn, id: string) => sizeClassIn(state) !== 'compact' && state.value[column] === id,
      },
    };
    return api;
  },
  slots: (slot) => {
  /** A column: one element for its whole life, wherever the layout puts it. */
  const column = (c: SplitViewColumn) =>
    slot<object, SplitViewColumnState>({
      state: (state, { api }) => {
        const l = api.internal.layout(state).columns[c];
        return { column: c, top: !!l?.top, behind: !!l?.behind, lifted: !!l?.lifted };
      },
      attrs: (state, { api, id }) => {
        const l = api.internal.layout(state).columns[c];
        return {
          id: `${id}-${c}`,
          tabindex: '-1',
          inert: l ? flag(l.inert) : '',
          'data-top': flag(l?.top),
          'data-behind': flag(l?.behind),
          'data-lifted': flag(l?.lifted),
          'data-hairline': flag(l?.hairline),
          style: l
            ? css({ '--column-left': l.left, '--column-width': l.width, '--column-translate': l.translate, '--column-z': l.z, '--column-dim': l.dim })
            : css({ visibility: 'hidden' }),
        };
      },
      bind(el, { api }) {
        // Collapsed, the columns are the stack's pages; a pushed column takes focus unless it already has it.
        const offPage = api.internal.stack.bindPage(el, c, {
          initialFocus: () => (el.contains(el.ownerDocument.activeElement) ? null : el),
        });
        const offLayer = c === 'sidebar' ? api.internal.bindSidebarLayer(el) : undefined;
        return () => {
          offPage();
          offLayer?.();
        };
      },
    });
  return {
    root: slot<object, SplitViewState>({
      role: 'group',
      state: (state) => stateOf(state),
      attrs: (state) => ({
        'data-size-class': sizeClassIn(state),
        'data-sidebar-open': flag(sidebarOpenIn(state)),
        'data-resizing': flag(!!state.resizing),
        // Nothing animates until the first layout has painted.
        'data-instant': flag(!state.ready),
      }),
      bind: (el, { api }) => api.internal.bindRoot(el),
    }),

    sidebar: column('sidebar'),
    supplementary: column('supplementary'),
    detail: column('detail'),

    resizer: slot<{ value: string }, { dragging: boolean }>({
      role: 'separator',
      focus: 'tab-stop',
      keys: ['ArrowLeft', 'ArrowRight', 'shift+ArrowLeft', 'shift+ArrowRight', 'Home', 'End', 'Enter'],
      props: { value: 'string' },
      state: (state, { key }) => ({ dragging: state.resizing?.key === key }),
      present: (state, { api, key }) => !!api.internal.layout(state).columns[key as SplitViewColumn]?.resizable,
      attrs: (state, { api, id, key }) => {
        const c = key as SplitViewColumn;
        const spec = api.internal.spec(state, c);
        return {
          tabindex: '0',
          'aria-orientation': 'vertical',
          'aria-label': c === 'sidebar' ? 'Resize sidebar' : 'Resize list',
          'aria-controls': `${id}-${c}`,
          'aria-valuenow': String(Math.round(api.internal.widthOf(state, c))),
          'aria-valuemin': String(spec.minWidth),
          'aria-valuemax': Number.isFinite(spec.maxWidth) ? String(spec.maxWidth) : undefined,
          'data-dragging': flag(state.resizing?.key === key),
          ...api.internal.resize.handleAttrs('e'),
        };
      },
      on: {
        pointerdown: (event, { api, key, el }) => el && api.internal.resize.pointerdown(event, key, 'e', el),
        keydown: (event, { api, key }) => api.internal.resizerKeydown(event, key as SplitViewColumn),
        // A double click puts it back at the column's own width.
        dblclick: (event, { api, key, store }) => {
          const c = key as SplitViewColumn;
          api.setColumnWidth(c, api.internal.spec(store.get(), c).width, { reason: 'handle-press', event });
        },
      },
    }),

    scrim: slot<object, { open: boolean }>({
      role: 'presentation',
      state: (state, { api }) => ({ open: api.internal.layout(state).scrim > 0 }),
      attrs: (state, { api }) => {
        const scrim = api.internal.layout(state).scrim;
        return { 'aria-hidden': 'true', 'data-open': flag(scrim > 0), style: css({ '--split-view-scrim': scrim }) };
      },
    }),

    toggle: slot<object, { open: boolean }>({
      present: (state) => sizeClassIn(state) !== 'compact' && presentIn(state).includes('sidebar') && presentIn(state).length > 1,
      state: (state) => ({ open: sidebarOpenIn(state) }),
      attrs: (state, { id }) => ({
        type: 'button',
        'aria-label': sidebarOpenIn(state) ? 'Hide sidebar' : 'Show sidebar',
        'aria-expanded': String(sidebarOpenIn(state)),
        'aria-controls': `${id}-sidebar`,
      }),
      press: ({ api }, event) => void api.toggleSidebar({ reason: 'trigger-press', event }),
    }),

    // Keyed by a made id: the same value can show in several items (a mailbox under Favorites and its account).
    item: slot<{ id?: string; item: string; column: string }, SplitViewItemState>({
      props: { id: 'id', item: 'string', column: 'string' },
      state: (state, { api, props }) => ({
        selected: api.internal.selected(state, props.column as SplitViewColumn, props.item),
        pushes: api.internal.pushes(state, props.column as SplitViewColumn),
      }),
      attrs: (state, part) => {
        const { api, props } = part;
        const selected = api.internal.selected(state, props.column as SplitViewColumn, props.item);
        return {
          type: 'button',
          tabindex: api.internal.itemTabIndex(state, part),
          'data-selected': flag(selected),
          'aria-current': selected ? 'true' : undefined,
        };
      },
      bind: (el, part) => part.api.internal.bindItem(el, part),
      on: {
        keydown: (event, { api, el, props }) => el && api.internal.itemKeydown(event, el, props.column),
      },
      press: ({ api, props }, event) => void api.select(props.column as SplitViewColumn, props.item, { reason: 'item-press', event }),
    }),

    /** A column's (or a nested stack page's) bar. Keyed by its pane. With a large title or `titleOnScroll` the
     *  inline title comes and goes: `data-title-hidden` while it is away. */
    header: slot<{ value: string; largeTitle?: boolean; titleOnScroll?: boolean }, SplitViewHeaderState>({
      props: { value: 'string', largeTitle: 'boolean', titleOnScroll: 'boolean' },
      state: (state, { key, props }) => headerState(state.panes[key], props),
      attrs: (state, { key, props }) => {
        const h = headerState(state.panes[key], props);
        return { 'data-large-title': flag(h.largeTitle), 'data-fading': flag(h.fading), 'data-title-hidden': flag(!h.inline) };
      },
    }),
    /** The pane's scrolling content: `data-scrolled` once it has left its top, `data-under` once the large title
     *  has gone under the header. */
    content: slot<{ value: string }>({
      props: { value: 'string' },
      attrs: (state, { key }) => ({ 'data-scrolled': flag(state.panes[key]?.scrolled), 'data-under': flag(state.panes[key]?.under) }),
      bind: (el, { api, key }) => api.internal.bindPane(el, key),
    }),
    /** The header's large title, drawn at the top of the pane's content. */
    'large-title': slot<{ value: string }>({ props: { value: 'string' } }),

    /** A column header's back button, collapsed: pops to the column before. */
    back: slot({
      attrs: () => ({ type: 'button' }),
      press: ({ api }, event) => void api.back({ reason: 'trigger-press', event }),
    }),
  };
  },
  agent: { actions: ['select', 'show', 'back', 'setSidebarOpen', 'toggleSidebar', 'setSupplementaryOpen', 'setColumnWidth'] },
});

/* ══ SplitViewStack — a push/pop stack inside a column ══
   Its pages are keys in a `createStack`; the component keeps the element pushed under each key. A pushed page
   enters from the trailing edge, the one under it slides back a little and dims; back, Escape, the platform's back
   and a swipe from the leading edge pop the top page, and the innermost stack goes first, so the column stack only
   moves once this one is at its root. */

/** The root page's key. */
export const SPLIT_VIEW_STACK_ROOT = 'root';

export type SplitViewStackPagesChangeReason = 'trigger-press' | 'escape-key' | 'back' | 'swipe' | 'imperative';
export type SplitViewStackPagesChangeDetails = ChangeDetails<SplitViewStackPagesChangeReason>;

export type SplitViewStackOptions = {
  /** The page keys from the root (`"root"`) to the top, to control the stack. The first key is always `"root"`. */
  pages?: string[];
  /** The pages it starts with, when `pages` is left out, from `"root"`. Default `["root"]`. */
  defaultPages?: string[];
  /** Every push and pop: the page keys from the root (`"root"`) to the top. */
  onPagesChange?: (pages: string[], details: SplitViewStackPagesChangeDetails) => void;
  /** Drives the stack from anywhere. Create one with `createSplitViewStackController()`. */
  controller?: SplitViewStackController;
} & PrimitiveOptions;

/** Pushes and pops a split view stack from outside it. Write methods run `onPagesChange` like the user's own
 *  changes and return false when nothing changed or the change was canceled. */
export type SplitViewStackController = {
  /** Puts the page with this key on top. False when it is in the stack already. */
  push: (page: string, options?: Why<SplitViewStackPagesChangeReason>) => boolean;
  /** Takes the top page off. False at the root. */
  pop: (options?: Why<SplitViewStackPagesChangeReason>) => boolean;
  /** Takes off every page above the root. False at the root. */
  popToRoot: (options?: Why<SplitViewStackPagesChangeReason>) => boolean;
  /** The pages now, from the root to the top. */
  getPages: () => string[];
};

/** A handle for a split view stack: pass it as `controller`, then call it from anywhere. */
export function createSplitViewStackController() {
  return createController<SplitViewStackController>();
}

type StackStore = { pages: string[]; exiting: StackExit[] };

/** What a stack page hands `render` functions and state-based class names. */
export type SplitViewStackPageState = {
  /** Where it is in the stack: 0 for the root. */
  index: number;
  top: boolean;
};

export const splitViewStack = definePrimitive({
  name: 'split-view-stack',
  options: { pages: 'list', defaultPages: 'list', onPagesChange: 'callback', controller: 'value' },
  controlled: ['pages'],
  state: (options: SplitViewStackOptions): StackStore => ({
    pages: options.pages ?? options.defaultPages ?? [SPLIT_VIEW_STACK_ROOT],
    exiting: [],
  }),
  sync: (options) => (options.pages === undefined ? {} : { pages: options.pages }),
  api: (context) => {
    const change = createChange(context);
    const stack = createStack<StackStore, SplitViewStackPagesChangeReason>(context, {
      key: 'pages',
      exiting: 'exiting',
      set: (pages, details) => change('pages', pages, details),
      back: bindBack,
    });
    const pages = () => context.store.get().pages;
    return {
      push: (page: string, o?: Why<SplitViewStackPagesChangeReason>) => stack.push(page, o),
      pop: (o?: Why<SplitViewStackPagesChangeReason>) => stack.pop(o),
      popToRoot: (o?: Why<SplitViewStackPagesChangeReason>) => stack.popTo(SPLIT_VIEW_STACK_ROOT, o),
      getPages: pages,
      internal: { stack },
    };
  },
  slots: (slot) => ({
    root: slot<object, { pages: string[]; exiting: string[] }>({
      state: (state) => ({ pages: state.pages, exiting: state.exiting.map((exit) => exit.key) }),
      attrs: (state) => ({ 'data-depth': String(state.pages.length), 'data-can-pop': flag(state.pages.length > 1) }),
      bind: (el, { api }) => bindEdgeSwipe(el, { ...api.internal.stack.swipe, size: 28 }),
    }),
    page: slot<{ value: string }, SplitViewStackPageState>({
      props: { value: 'string' },
      present: (state, { api, key }) => api.internal.stack.present(state, key),
      state: (state, { key }) => {
        const index = state.pages.indexOf(key);
        return { index: index < 0 ? state.pages.length : index, top: state.pages.at(-1) === key };
      },
      attrs: (state, { api, key }) => ({
        ...api.internal.stack.pageAttrs(state, key),
        'data-root': flag(key === SPLIT_VIEW_STACK_ROOT),
      }),
      bind: (el, { api, key }) =>
        api.internal.stack.bindPage(el, key, {
          initialFocus: () => (el.contains(el.ownerDocument.activeElement) ? null : el),
        }),
    }),
    /** A pushed page's back button: pops it. */
    back: slot({
      attrs: () => ({ type: 'button' }),
      press: ({ api }, event) => void api.pop({ reason: 'trigger-press', event }),
    }),
  }),
  agent: { actions: ['push', 'pop', 'popToRoot'] },
});

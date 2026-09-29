/* ══ SplitView — UISplitViewController, as composable parts ══
   <SplitView> owns the state: its width class (measured from its own box, or given), which columns exist,
   sidebar visibility, per-column selection, and which column is on top when collapsed. Each column part
   (<SplitViewSidebar>, <SplitViewSupplementary>, <SplitViewDetail>) is ONE persistent element that is laid
   out absolutely and moved with springs — so tiled columns, an overlay sidebar and the compact stack are
   the same DOM in different places. Nothing remounts between size classes: a column that was tiled slides
   into its place in the stack, keeps its scroll position and its state, and slides back out again.

     regular   sidebar · supplementary · detail tiled (sidebar tiles; toggle slides it away)
     medium    supplementary · detail tiled; the sidebar floats over them (overlay) or pushes them (displace)
     compact   one column at a time — selecting pushes the next column, back / edge-swipe / Esc pops

   A column can host its own push/pop stack (<SplitViewStack>, or `<SplitViewDetail stack>`): its pages slide
   like the compact columns do, and the edge swipe / Esc / back button pop the innermost level first — the
   column stack only moves once the nested one is at its root. The supplementary column can be hidden
   (`supplementaryVisible={false}`, Notes' gallery): it slides away and the detail takes its space.

   Motion follows lib/motion.ts: `springs.smooth` for every column move (interruptible — a motion value is
   retargeted mid-flight and keeps its velocity), instant while a divider or the back swipe is being dragged,
   and no movement at all under prefers-reduced-motion. */
import {
  createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState,
  type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode,
} from 'react';
import { animate, motion, useMotionValue, type MotionValue } from 'framer-motion';
import { Button as AriaButton } from 'react-aria-components';
import { useFocusRing, useHover, useMove, mergeProps } from 'react-aria';
import { cva, type VariantProps } from 'class-variance-authority';
import { Haptics } from '../lib/haptics';
import { Icon } from '../lib/icon';
import { useContainerWidth } from '../lib/container';
import { AnimatedHeight } from './animated-height';
import { Chevron } from './icon-swap';
import { fades, springs, useReducedMotion } from '../lib/motion';
import { cn } from '../lib/utils';

export type SplitViewColumn = 'sidebar' | 'supplementary' | 'detail';
export type SplitViewWidthClass = 'compact' | 'medium' | 'regular';
/** How a shown sidebar shares space with the other columns. `auto`: tile at regular, overlay at medium. */
export type SplitViewSidebarBehavior = 'auto' | 'tile' | 'overlay' | 'displace';
export type SplitViewSelection = Partial<Record<SplitViewColumn, string | null>>;

const ORDER: SplitViewColumn[] = ['sidebar', 'supplementary', 'detail'];
const DEFAULTS: Record<SplitViewColumn, ColumnSpec> = {
  sidebar: { width: 280, minWidth: 200, maxWidth: 380, resizable: true },
  supplementary: { width: 340, minWidth: 260, maxWidth: 480, resizable: true },
  detail: { width: 0, minWidth: 320, maxWidth: Infinity, resizable: false },
};
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

interface ColumnSpec { width: number; minWidth: number; maxWidth: number; resizable: boolean }
interface ColumnLayout {
  x: number;
  width: number;
  z: number;
  /** Black wash over the column (compact: columns under the top one). */
  dim: number;
  /** Off-screen or covered: removed from the tab order and the accessibility tree. */
  inert: boolean;
  /** Draws the lifted edge shadow (overlay sidebar, pushed compact column). */
  lifted: boolean;
  /** Divider on the trailing edge is draggable here. */
  resizable: boolean;
  /** Hairline on the trailing edge. */
  hairline: boolean;
}

/* ── Layout: a pure function from state to column frames ── */
function computeLayout(o: {
  W: number; wc: SplitViewWidthClass; present: SplitViewColumn[]; specs: Partial<Record<SplitViewColumn, ColumnSpec>>;
  widths: Partial<Record<SplitViewColumn, number>>; sidebarVisible: boolean; behavior: Exclude<SplitViewSidebarBehavior, 'auto'>;
  top: SplitViewColumn; swipe: number;
  /** Registered columns that are hidden (the supplementary in gallery mode): laid out off to the side. */
  hidden?: SplitViewColumn[];
}) {
  const { W, wc, present, specs, widths, sidebarVisible, behavior, top, swipe, hidden = [] } = o;
  const out: Partial<Record<SplitViewColumn, ColumnLayout>> = {};
  let scrim = 0;
  const off = (c: SplitViewColumn, x: number, width: number): ColumnLayout =>
    ({ x, width, z: 0, dim: 0, inert: true, lifted: false, resizable: false, hairline: true });
  if (wc === 'compact') {
    hidden.forEach((c) => { out[c] = off(c, W + 24, W); });
    const t = Math.max(0, present.indexOf(top));
    const p = W ? clamp(swipe / W, 0, 1) : 0;
    present.forEach((c, i) => {
      let x = i < t ? -0.3 * W : i === t ? 0 : W + 24;
      let dim = i < t ? 0.1 : 0;
      if (p > 0 && i === t) x = swipe;
      if (p > 0 && i === t - 1) { x = -0.3 * W * (1 - p); dim = 0.1 * (1 - p); }
      out[c] = { x, width: W, z: 10 + i, dim, inert: i !== t, lifted: i > 0 && i <= t, resizable: false, hairline: false };
    });
    return { columns: out, scrim };
  }
  const has = (c: SplitViewColumn) => present.includes(c);
  const spec = (c: SplitViewColumn) => specs[c] ?? DEFAULTS[c];
  const detailMin = has('detail') ? spec('detail').minWidth : 0;
  const hasSide = has('sidebar') && present.length > 1;
  const sideShown = hasSide && sidebarVisible;
  const sw = hasSide ? clamp(widths.sidebar ?? spec('sidebar').width, spec('sidebar').minWidth, spec('sidebar').maxWidth) : 0;
  const tiled = sideShown && behavior === 'tile';
  const shift = sideShown && behavior !== 'overlay' ? sw : 0;
  // Space the non-sidebar columns lay out in (displace keeps their widths and pushes them right).
  const room = W - (tiled ? sw : 0);
  if (hasSide) {
    out.sidebar = {
      x: sideShown ? 0 : -sw - (behavior === 'tile' ? 0 : 32), width: sw, z: behavior === 'tile' ? 2 : 30, dim: 0,
      inert: !sideShown, lifted: sideShown && behavior !== 'tile', resizable: tiled && spec('sidebar').resizable, hairline: true,
    };
    if (sideShown && behavior !== 'tile') scrim = behavior === 'overlay' ? 1 : 0.6;
  }
  const rest = present.filter((c) => c !== 'sidebar' || !hasSide);
  // A hidden column tucks in behind the leading edge of the space it gave up (under a tiled sidebar, or
  // off-screen), keeping its width so it slides back out unchanged.
  hidden.forEach((c) => {
    const s = spec(c);
    const w = clamp(widths[c] ?? s.width, s.minWidth, s.maxWidth);
    out[c] = off(c, shift - w - 1, w);
  });
  let x = shift;
  rest.forEach((c, i) => {
    const last = i === rest.length - 1;
    const s = spec(c);
    let w: number;
    if (last) w = Math.max(room - (x - shift), 0);
    else {
      const after = rest.slice(i + 1).reduce((a, n) => a + (n === 'detail' ? detailMin : spec(n).minWidth), 0);
      w = clamp(widths[c] ?? s.width, s.minWidth, Math.max(s.minWidth, Math.min(s.maxWidth, room - (x - shift) - after)));
    }
    out[c] = {
      x, width: w, z: 1, dim: 0, inert: false, lifted: false, resizable: !last && s.resizable, hairline: !last,
    };
    x += w;
  });
  return { columns: out, scrim };
}

/* ── Context ── */
export interface SplitViewState {
  /** Width class in effect (measured from the SplitView's own width unless `widthClass` is given). */
  widthClass: SplitViewWidthClass;
  /** True in compact: one column at a time, navigated like a stack. */
  collapsed: boolean;
  /** Measured width of the SplitView, px. */
  width: number;
  /** Columns that are shown, in order (a hidden supplementary is left out). */
  columns: SplitViewColumn[];
  sidebarVisible: boolean;
  setSidebarVisible: (visible: boolean) => void;
  toggleSidebar: () => void;
  /** Resolved sidebar behavior for the current width class. */
  sidebarBehavior: Exclude<SplitViewSidebarBehavior, 'auto'>;
  selection: SplitViewSelection;
  /** Select `id` in `column`; shows the next column (a push when collapsed). `null` clears. */
  select: (column: SplitViewColumn, id: string | null) => void;
  /** Whether `id` should be drawn selected — never while collapsed, where rows are navigation. */
  isSelected: (column: SplitViewColumn, id: string) => boolean;
  /** Top column of the stack when collapsed (tracked at every width, so collapsing lands where you were). */
  topColumn: SplitViewColumn;
  show: (column: SplitViewColumn) => void;
  back: () => void;
  canGoBack: boolean;
  widths: Partial<Record<SplitViewColumn, number>>;
  setColumnWidth: (column: SplitViewColumn, width: number) => void;
  /** False while the supplementary column is hidden and the detail has taken its space. */
  supplementaryVisible: boolean;
  setSupplementaryVisible: (visible: boolean) => void;
}
type Tracking = 'drag' | 'resize' | false;
interface InternalState extends SplitViewState {
  layout: Partial<Record<SplitViewColumn, ColumnLayout>>;
  specs: Partial<Record<SplitViewColumn, ColumnSpec>>;
  register: (column: SplitViewColumn, spec: ColumnSpec | null) => void;
  titles: Partial<Record<SplitViewColumn, string>>;
  setTitle: (column: SplitViewColumn, title: string | undefined) => void;
  /** Values jump instead of animating (first paint, reduced motion). */
  instant: boolean;
  /** `drag`: a divider or the back swipe steers the layout — follow 1:1. `resize`: the container changed
   *  width within its class — follow, but let any in-flight spring (a class change) keep flying. */
  tracking: Tracking;
  setResizing: (on: boolean) => void;
  idFor: (column: SplitViewColumn) => string;
  rootRef: React.RefObject<HTMLDivElement | null>;
}
const Ctx = createContext<InternalState | null>(null);
const ColumnCtx = createContext<SplitViewColumn | null>(null);

function useInternal(part: string) {
  const c = useContext(Ctx);
  if (!c) throw new Error(`<${part}> must be rendered inside <SplitView>`);
  return c;
}
/** Split view state: width class, sidebar visibility, selection and navigation. */
export function useSplitView(): SplitViewState {
  return useInternal('useSplitView');
}
/** The column the calling component is rendered in, or null outside a column. */
export function useSplitViewColumn() {
  return useContext(ColumnCtx);
}

/** For a container that draws its own bar (NavigationStack) at the root of a SplitView column: while the split
 *  view is collapsed and a column comes before this one, that column's title and the way back to it — else
 *  null (outside a SplitView too). `title` registers this column's own title, for the back label of the column
 *  after it (what a SplitViewHeader does). */
export function useSplitViewBack(title?: string): { title: string; back: () => void } | null {
  const s = useContext(Ctx);
  const column = useContext(ColumnCtx);
  const page = useContext(PageCtx);
  const setTitle = s?.setTitle;
  const root = !page || page.index === 0;
  useLayoutEffect(() => { if (setTitle && column && root && title !== undefined) setTitle(column, title); }, [setTitle, column, root, title]);
  if (!s || !column || !s.collapsed || !root) return null;
  const i = s.columns.indexOf(column);
  if (i < 1) return null;
  return { title: s.titles[s.columns[i - 1]] ?? 'Back', back: s.back };
}

/* ── Root ── */
export interface SplitViewProps {
  /** Force a width class. Omit to measure the SplitView's own width against `breakpoints`. */
  widthClass?: SplitViewWidthClass;
  /** Minimum widths (px) of the medium and regular classes. Default 640 / 1024. */
  breakpoints?: { medium: number; regular: number };
  sidebarBehavior?: SplitViewSidebarBehavior;
  /** Controlled sidebar visibility. */
  sidebarVisible?: boolean;
  /** Sidebar visibility at regular width — shorthand for `sidebarVisibility={{ regular }}`. Default true. */
  defaultSidebarVisible?: boolean;
  /** The visibility the sidebar starts at, and resets to whenever the width class changes, per class.
   *  Default `{ regular: defaultSidebarVisible, medium: false }`. */
  sidebarVisibility?: Partial<Record<Exclude<SplitViewWidthClass, 'compact'>, boolean>>;
  /** Every visibility change: the toggle, the scrim, Esc, picking in a floating sidebar — and the reset to
   *  `sidebarVisibility` when the width class changes, so a controlling parent can simply mirror it. */
  onSidebarVisibleChange?: (visible: boolean) => void;
  /** Controlled supplementary visibility. `false` slides the supplementary away and the detail takes its space
   *  (Notes' gallery); when collapsed, the stack skips it. */
  supplementaryVisible?: boolean;
  /** Default true. */
  defaultSupplementaryVisible?: boolean;
  onSupplementaryVisibleChange?: (visible: boolean) => void;
  selection?: SplitViewSelection;
  defaultSelection?: SplitViewSelection;
  onSelectionChange?: (selection: SplitViewSelection) => void;
  /** Initial top column when collapsed. Default: supplementary, else sidebar, else detail. */
  defaultCompactColumn?: SplitViewColumn;
  onCompactColumnChange?: (column: SplitViewColumn) => void;
  onWidthClassChange?: (widthClass: SplitViewWidthClass) => void;
  /** Accessible name of the whole split view. */
  'aria-label'?: string;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function SplitView({
  widthClass: wcProp, breakpoints = { medium: 640, regular: 1024 }, sidebarBehavior = 'auto',
  sidebarVisible: sideProp, defaultSidebarVisible = true, sidebarVisibility, onSidebarVisibleChange,
  supplementaryVisible: suppProp, defaultSupplementaryVisible = true, onSupplementaryVisibleChange,
  selection: selProp, defaultSelection, onSelectionChange, defaultCompactColumn, onCompactColumnChange,
  onWidthClassChange, children, className, style, ...aria
}: SplitViewProps) {
  const [ref, W] = useContainerWidth<HTMLDivElement>();
  const wc: SplitViewWidthClass = wcProp ?? (W >= breakpoints.regular ? 'regular' : W >= breakpoints.medium ? 'medium' : 'compact');
  const collapsed = wc === 'compact';
  const reduce = !!useReducedMotion();
  const uid = useId();

  const [specs, setSpecs] = useState<Partial<Record<SplitViewColumn, ColumnSpec>>>({});
  const register = useCallback((c: SplitViewColumn, spec: ColumnSpec | null) => {
    setSpecs((s) => {
      const cur = s[c];
      if (spec == null) { if (!cur) return s; const n = { ...s }; delete n[c]; return n; }
      if (cur && cur.width === spec.width && cur.minWidth === spec.minWidth && cur.maxWidth === spec.maxWidth && cur.resizable === spec.resizable) return s;
      return { ...s, [c]: spec };
    });
  }, []);
  const [suppState, setSuppState] = useState(defaultSupplementaryVisible);
  const suppVisible = suppProp ?? suppState;
  const onSuppRef = useRef(onSupplementaryVisibleChange); onSuppRef.current = onSupplementaryVisibleChange;
  const setSupplementaryVisible = useCallback((v: boolean) => { setSuppState(v); onSuppRef.current?.(v); }, []);
  const registered = ORDER.filter((c) => specs[c]);
  const hidden: SplitViewColumn[] = !suppVisible && specs.supplementary && specs.detail ? ['supplementary'] : [];
  const present = registered.filter((c) => !hidden.includes(c));
  const [titles, setTitles] = useState<Partial<Record<SplitViewColumn, string>>>({});
  const setTitle = useCallback((c: SplitViewColumn, t: string | undefined) => {
    setTitles((s) => (s[c] === t ? s : { ...s, [c]: t }));
  }, []);

  // Sidebar visibility: reset to the class default whenever the width class changes — and say so, so a
  // controlling parent follows the reset instead of re-implementing it.
  const classDefault = (c: SplitViewWidthClass) =>
    c === 'regular' ? sidebarVisibility?.regular ?? defaultSidebarVisible : c === 'medium' ? sidebarVisibility?.medium ?? false : false;
  const [sideState, setSideState] = useState(() => classDefault(wc));
  const [prevWc, setPrevWc] = useState(wc);
  if (prevWc !== wc) {
    setPrevWc(wc);
    setSideState(classDefault(wc));
  }
  const sidebarVisible = sideProp ?? sideState;
  const onSideRef = useRef(onSidebarVisibleChange); onSideRef.current = onSidebarVisibleChange;
  const setSidebarVisible = useCallback((v: boolean) => { setSideState(v); onSideRef.current?.(v); }, []);
  const committedSide = useRef(sidebarVisible);
  // The first measurement (mount → the real width) is where the sidebar *starts*, not a change to report.
  const settled = useRef(false);
  const classDefaultRef = useRef(classDefault); classDefaultRef.current = classDefault;
  useEffect(() => {
    if (!settled.current) return;
    const v = classDefaultRef.current(wc);
    if (v !== committedSide.current) onSideRef.current?.(v);
  }, [wc]);
  useEffect(() => { committedSide.current = sidebarVisible; });
  const wcRef = useRef(onWidthClassChange); wcRef.current = onWidthClassChange;
  useEffect(() => { wcRef.current?.(wc); }, [wc]);

  const behavior: Exclude<SplitViewSidebarBehavior, 'auto'> =
    sidebarBehavior !== 'auto' ? sidebarBehavior : wc === 'regular' ? 'tile' : 'overlay';

  const [selState, setSelState] = useState<SplitViewSelection>(defaultSelection ?? {});
  const selection = selProp ?? selState;
  const selRef = useRef(selection); selRef.current = selection;
  const onSelRef = useRef(onSelectionChange); onSelRef.current = onSelectionChange;

  const [topState, setTopState] = useState<SplitViewColumn | null>(defaultCompactColumn ?? null);
  const top: SplitViewColumn = topState && present.includes(topState) ? topState
    : present.includes('supplementary') ? 'supplementary' : present.includes('sidebar') ? 'sidebar' : present[0] ?? 'detail';
  const onTopRef = useRef(onCompactColumnChange); onTopRef.current = onCompactColumnChange;
  const presentRef = useRef(present); presentRef.current = present;
  const topRef = useRef(top); topRef.current = top;
  const show = useCallback((c: SplitViewColumn) => {
    if (c === topRef.current) return;
    setTopState(c); onTopRef.current?.(c);
  }, []);
  const back = useCallback(() => {
    const p = presentRef.current; const i = p.indexOf(topRef.current);
    if (i > 0) { show(p[i - 1]); Haptics.impact('light'); }
  }, [show]);

  const behaviorRef = useRef(behavior); behaviorRef.current = behavior;
  const collapsedRef = useRef(collapsed); collapsedRef.current = collapsed;
  const select = useCallback((c: SplitViewColumn, id: string | null) => {
    const next = { ...selRef.current, [c]: id };
    selRef.current = next;
    setSelState(next); onSelRef.current?.(next);
    const p = presentRef.current; const after = p[p.indexOf(c) + 1];
    show(id != null && after ? after : c);
    // A floating sidebar gets out of the way once something is picked in it.
    if (c === 'sidebar' && !collapsedRef.current && behaviorRef.current !== 'tile') setSidebarVisible(false);
  }, [show, setSidebarVisible]);
  const isSelected = useCallback((c: SplitViewColumn, id: string) => !collapsed && selection[c] === id, [collapsed, selection]);

  const [widths, setWidths] = useState<Partial<Record<SplitViewColumn, number>>>({});
  const setColumnWidth = useCallback((c: SplitViewColumn, w: number) => setWidths((s) => ({ ...s, [c]: Math.round(w) })), []);

  // Back swipe (compact): drag from the leading edge pulls the top column off.
  const [swipe, setSwipe] = useState(0);
  const drag = useRef<{ x0: number; y0: number; on: boolean; last: number; lt: number; vel: number } | null>(null);
  const [resizing, setResizing] = useState(false);

  const { columns: layout, scrim } = computeLayout({ W, wc, present, specs, widths, sidebarVisible, behavior, top, swipe, hidden });

  // First paint lands in place; springs start once the layout has settled.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let b = 0;
    const a = requestAnimationFrame(() => { b = requestAnimationFrame(() => { settled.current = true; setReady(true); }); });
    return () => { cancelAnimationFrame(a); cancelAnimationFrame(b); };
  }, []);

  // A width change inside one class (window/frame resize) re-lays out in place; crossing a class morphs.
  const prevBox = useRef({ W, wc });
  const widthOnly = W !== prevBox.current.W && wc === prevBox.current.wc;
  useLayoutEffect(() => { prevBox.current = { W, wc }; });

  const toggleSidebar = useCallback(() => { setSidebarVisible(!sidebarVisible); Haptics.impact('light'); }, [sidebarVisible, setSidebarVisible]);
  const idFor = useCallback((c: SplitViewColumn) => `${uid}-${c}`, [uid]);
  const tIdx = present.indexOf(top);

  const value: InternalState = {
    widthClass: wc, collapsed, width: W, columns: present, sidebarVisible: present.includes('sidebar') && sidebarVisible,
    setSidebarVisible, toggleSidebar, sidebarBehavior: behavior, selection, select, isSelected, topColumn: top, show, back,
    canGoBack: collapsed && tIdx > 0, widths, setColumnWidth, supplementaryVisible: suppVisible, setSupplementaryVisible,
    layout, specs, register, titles, setTitle, instant: !ready || reduce,
    tracking: resizing || swipe > 0 ? 'drag' : widthOnly ? 'resize' : false, setResizing, idFor, rootRef: ref,
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!collapsed || tIdx < 1 || e.button) return;
    const r = e.currentTarget.getBoundingClientRect();
    if (e.clientX - r.left > 28) return;
    // A nested stack that can pop owns the edge swipe: only the innermost level goes back.
    if (innerStackCanPop(e.target, e.currentTarget)) return;
    drag.current = { x0: e.clientX, y0: e.clientY, on: false, last: e.clientX, lt: performance.now(), vel: 0 };
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current; if (!d) return;
    const dx = e.clientX - d.x0, dy = e.clientY - d.y0;
    if (!d.on) {
      if (dx > 8 && dx > Math.abs(dy) * 1.2) {
        d.on = true;
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* noop */ }
      } else { if (Math.abs(dy) > 14) drag.current = null; return; }
    }
    const now = performance.now();
    d.vel = (e.clientX - d.last) / Math.max(1, now - d.lt); d.last = e.clientX; d.lt = now;
    setSwipe(Math.max(0.01, dx));
  };
  const onPointerUp = () => {
    const d = drag.current; drag.current = null;
    if (!d || !d.on) return;
    if (swipe / Math.max(1, W) > 0.33 || d.vel > 0.5) back();
    setSwipe(0);
  };
  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Escape' || e.defaultPrevented || innerStackCanPop(e.target, e.currentTarget)) return;
    if (!collapsed && value.sidebarVisible && behavior !== 'tile') { setSidebarVisible(false); e.preventDefault(); }
    else if (collapsed && tIdx > 0) { back(); e.preventDefault(); }
  };

  return (
    <Ctx.Provider value={value}>
      <div ref={ref} data-slot="split-view" data-width-class={wc} data-sidebar-visible={value.sidebarVisible || undefined}
        role="group" aria-label={aria['aria-label']}
        className={cn('relative isolate h-full w-full touch-pan-y overflow-hidden bg-background', className)} style={style}
        onPointerDownCapture={onPointerDown} onPointerMoveCapture={onPointerMove} onPointerUpCapture={onPointerUp} onPointerCancelCapture={onPointerUp}
        onKeyDown={onKeyDown}>
        {children}
        <Scrim amount={scrim} onPress={() => setSidebarVisible(false)} />
      </div>
    </Ctx.Provider>
  );
}

/** True when `target` sits in a nested stack (a SplitViewStack or a NavigationStack) that is deeper than its
 *  root — that stack pops itself, so the split view must not pop a column too. */
function innerStackCanPop(target: EventTarget | null, root: Element) {
  let el = target instanceof Element ? target : null;
  while (el && el !== root) {
    if (el.hasAttribute('data-split-stack-can-pop')) return true;
    if (el.getAttribute('data-slot') === 'navigation-stack'
      && [...el.children].filter((c) => c.getAttribute('data-slot') === 'screen').length > 1) return true;
    el = el.parentElement;
  }
  return false;
}

/** Drives a motion value toward `target`: jumps when instant, follows 1:1 while tracking, else springs
 *  (retargeting any spring in flight, so interruptions keep their velocity). */
function useDriven(mv: MotionValue<number>, target: number, instant: boolean, tracking: Tracking) {
  useLayoutEffect(() => {
    if (instant) mv.jump(target);
    else if (tracking === 'drag' || (tracking === 'resize' && !mv.isAnimating())) { mv.stop(); mv.set(target); }
    else if (mv.get() !== target) animate(mv, target, springs.smooth);
  }, [mv, target, instant, tracking]);
}

function Scrim({ amount, onPress }: { amount: number; onPress: () => void }) {
  const s = useInternal('SplitView');
  const o = useMotionValue(amount);
  useDriven(o, amount, s.instant, false);
  return (
    <motion.div data-slot="split-view-scrim" aria-hidden="true" onClick={onPress}
      className={cn('absolute inset-0 z-20 bg-overlay', amount > 0 ? 'pointer-events-auto' : 'pointer-events-none')}
      style={{ opacity: o }} />
  );
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

function ColumnPart({ column, width, minWidth, maxWidth, resizable, stack, children, className, style, ...aria }: SplitViewColumnProps & { column: SplitViewColumn }) {
  const s = useInternal(`SplitView${column[0].toUpperCase()}${column.slice(1)}`);
  const d = DEFAULTS[column];
  const spec = { width: width ?? d.width, minWidth: minWidth ?? d.minWidth, maxWidth: maxWidth ?? d.maxWidth, resizable: resizable ?? d.resizable };
  const { register } = s;
  useLayoutEffect(() => { register(column, spec); }, [register, column, spec.width, spec.minWidth, spec.maxWidth, spec.resizable]); // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => () => register(column, null), [register, column]);

  const l = s.layout[column];
  const x = useMotionValue(l?.x ?? 0);
  const w = useMotionValue(l?.width ?? 0);
  const dim = useMotionValue(l?.dim ?? 0);
  useDriven(x, l?.x ?? 0, s.instant || !l, s.tracking);
  useDriven(w, l?.width ?? 0, s.instant || !l, s.tracking);
  useDriven(dim, l?.dim ?? 0, s.instant || !l, s.tracking);

  // Keep keyboard focus with the navigation: a push/pop moves focus into the column that's now on top.
  const el = useRef<HTMLElement | null>(null);
  const isTop = s.collapsed && s.topColumn === column;
  const wasTop = useRef(isTop);
  useEffect(() => {
    const root = s.rootRef.current;
    if (isTop && !wasTop.current && el.current && root) {
      const a = document.activeElement;
      if (!a || a === document.body || (root.contains(a) && !el.current.contains(a))) el.current.focus({ preventScroll: true });
    }
    wasTop.current = isTop;
  }, [isTop, s.rootRef]);

  return (
    <ColumnCtx.Provider value={column}>
      <motion.section ref={el} id={s.idFor(column)} tabIndex={-1} data-slot={`split-view-${column}`}
        data-top={isTop || undefined} aria-label={aria['aria-label']} inert={l?.inert || undefined}
        className="absolute inset-y-0 left-0 outline-none"
        style={{ x, width: w, zIndex: l?.z ?? 0, visibility: l ? undefined : 'hidden' }}>
        <div className={cn(
          'relative flex h-full min-w-0 flex-col overflow-hidden text-foreground',
          COLUMN_BG[column],
          l?.hairline && 'shadow-[inset_-1px_0_0_var(--border)]',
          className,
        )} style={style}>
          <Pane>{stack ? <SplitViewStack>{children}</SplitViewStack> : children}</Pane>
          <motion.div aria-hidden="true" className="pointer-events-none absolute inset-0 z-50 bg-black" style={{ opacity: dim }} />
        </div>
        <div aria-hidden="true" className={cn(
          'pointer-events-none absolute inset-y-0 -left-10 w-10 transition-opacity duration-300',
          'bg-[linear-gradient(to_left,--alpha(black/14%),transparent)]',
          l?.lifted && column !== 'sidebar' ? 'opacity-100' : 'opacity-0',
        )} />
        <div aria-hidden="true" className={cn(
          'pointer-events-none absolute inset-y-0 -right-10 w-10 transition-opacity duration-300',
          'bg-[linear-gradient(to_right,--alpha(black/16%),transparent)]',
          l?.lifted && column === 'sidebar' ? 'opacity-100' : 'opacity-0',
        )} />
        {l?.resizable ? <Resizer column={column} /> : null}
      </motion.section>
    </ColumnCtx.Provider>
  );
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
function Resizer({ column }: { column: SplitViewColumn }) {
  const s = useInternal('SplitView');
  const spec = s.specs[column] ?? DEFAULTS[column];
  const cur = s.layout[column]?.width ?? spec.width;
  const acc = useRef(cur);
  const set = (v: number) => s.setColumnWidth(column, clamp(v, spec.minWidth, spec.maxWidth));
  const { moveProps } = useMove({
    onMoveStart() { acc.current = cur; s.setResizing(true); },
    onMove(e) {
      acc.current += e.pointerType === 'keyboard' ? e.deltaX * (e.shiftKey ? 48 : 12) : e.deltaX;
      set(acc.current);
    },
    onMoveEnd() { s.setResizing(false); },
  });
  const { focusProps, isFocusVisible } = useFocusRing();
  const { hoverProps, isHovered } = useHover({});
  const [active, setActive] = useState(false);
  const label = column === 'sidebar' ? 'Resize sidebar' : 'Resize list';
  return (
    <div role="separator" aria-orientation="vertical" aria-label={label} aria-controls={s.idFor(column)}
      aria-valuenow={Math.round(cur)} aria-valuemin={spec.minWidth} aria-valuemax={Number.isFinite(spec.maxWidth) ? spec.maxWidth : undefined}
      tabIndex={0} data-slot="split-view-resizer"
      {...mergeProps(moveProps, focusProps, hoverProps, {
        onPointerDown: () => setActive(true), onPointerUp: () => setActive(false), onPointerCancel: () => setActive(false),
        onKeyDown: (e: ReactKeyboardEvent) => {
          if (e.key === 'Home') { set(spec.minWidth); e.preventDefault(); }
          else if (e.key === 'End') { set(spec.maxWidth); e.preventDefault(); }
          else if (e.key === 'Enter') { set(spec.width); e.preventDefault(); }
        },
        onDoubleClick: () => set(spec.width),
      })}
      className="group absolute inset-y-0 -right-[5px] z-40 w-[10px] cursor-col-resize touch-none outline-none">
      <div className={cn(
        'absolute inset-y-0 left-1/2 w-[3px] -translate-x-1/2 rounded-full bg-primary transition-[opacity,transform] duration-200',
        isFocusVisible || active || isHovered ? 'scale-y-100 opacity-100' : 'scale-y-[.96] opacity-0',
        !(isFocusVisible || active) && isHovered && 'opacity-45',
      )} />
    </div>
  );
}

/* ── Panes: one header + content pair that scroll together (a column, or one page of a nested stack) ── */
/** What a header's large title draws at the top of the pane's scroll. */
interface LargeSpec { title: ReactNode; trailing?: ReactNode; className?: string }
interface PaneState {
  /** A large title the pane's SplitViewContent draws at the top of its scroll. */
  large: LargeSpec | null;
  setLarge: (large: LargeSpec | null) => void;
  /** The large title has scrolled under the bar: the header shows the inline title and its hairline. */
  under: boolean;
  setUnder: (under: boolean) => void;
  /** The pane's content has scrolled off its top (drives `titleOnScroll`). */
  scrolled: boolean;
  setScrolled: (scrolled: boolean) => void;
  contents: number;
  addContent: () => () => void;
}
const PaneCtx = createContext<PaneState | null>(null);

function Pane({ children }: { children?: ReactNode }) {
  const [large, setLarge] = useState<LargeSpec | null>(null);
  const [under, setUnder] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [contents, setContents] = useState(0);
  const addContent = useCallback(() => {
    setContents((n) => n + 1);
    return () => setContents((n) => n - 1);
  }, []);
  const value = useMemo(() => ({ large, setLarge, under, setUnder, scrolled, setScrolled, contents, addContent }),
    [large, under, scrolled, contents, addContent]);
  return <PaneCtx.Provider value={value}>{children}</PaneCtx.Provider>;
}

function LargeTitle({ spec, titleRef }: { spec: LargeSpec; titleRef?: React.Ref<HTMLDivElement> }) {
  const h1 = 'm-0 truncate text-[34px] leading-[1.15] font-extrabold tracking-[-.5px]';
  return spec.trailing != null ? (
    // A trailing item (a count, a button) shares the title's line, on the trailing edge.
    <div data-slot="split-view-large-title" className={cn('flex items-end gap-4 px-4 pt-1 pb-2', spec.className)}>
      <div ref={titleRef} role="heading" aria-level={1} className={cn(h1, 'min-w-0 flex-1')}>{spec.title}</div>
      <div data-slot="split-view-large-title-trailing" className="flex shrink-0 items-center text-[34px] leading-[1.15]">{spec.trailing}</div>
    </div>
  ) : (
    <div data-slot="split-view-large-title" className={cn('px-4 pt-1 pb-2', spec.className)}>
      {/* A heading role, not an <h1>: host prose styles (a docs page's `.markdown h1`) would otherwise restyle it. */}
      <div ref={titleRef} role="heading" aria-level={1} className={h1}>{spec.title}</div>
    </div>
  );
}

/* ── Column chrome ── */
export interface SplitViewHeaderProps {
  title?: ReactNode;
  /** iOS large title: drawn big at the top of the pane's SplitViewContent and scrolling with it; once it has
   *  gone under the bar the inline title (and the bar's hairline) spring in. */
  largeTitle?: boolean;
  /** Drawn on the large title's line, at the trailing edge (Reminders' open count). */
  largeTitleTrailing?: ReactNode;
  /** Classes for the large-title block — to line it up with the content (`mx-auto max-w-[760px] px-5`). */
  largeTitleClassName?: string;
  /** No large title: the inline title (and the bar's hairline) fade in once the content scrolls. */
  titleOnScroll?: boolean;
  /** Leading items (e.g. <SplitViewToggle/>). Replaced by the back button when collapsed and not the root. */
  leading?: ReactNode;
  trailing?: ReactNode;
  /** Back button label; defaults to the previous column's (or stack page's) title, truncated to the room
   *  the title leaves. */
  backLabel?: string;
  className?: string;
  style?: CSSProperties;
}

/** Column bar: back button when collapsed (or on a pushed stack page), title, leading / trailing items. */
export function SplitViewHeader({
  title, largeTitle, largeTitleTrailing, largeTitleClassName, titleOnScroll, leading, trailing, backLabel, className, style,
}: SplitViewHeaderProps) {
  const s = useInternal('SplitViewHeader');
  const column = useContext(ColumnCtx);
  const page = useContext(PageCtx);
  const pane = useContext(PaneCtx);
  const reduce = !!useReducedMotion();
  const { setTitle } = s;
  const t = typeof title === 'string' ? title : undefined;
  const rootPage = !page || page.index === 0;
  useLayoutEffect(() => { if (column && rootPage) setTitle(column, t); }, [column, t, setTitle, rootPage]);
  const setPageTitle = page?.stack.setTitle;
  const pageKey = page?.pageKey;
  useLayoutEffect(() => { if (setPageTitle && pageKey) setPageTitle(pageKey, t); }, [setPageTitle, pageKey, t]);

  // Back: a pushed stack page pops its stack; otherwise the collapsed column stack pops a column.
  const inPage = !!page && page.index > 0;
  const i = column ? s.columns.indexOf(column) : -1;
  const prev = i > 0 ? s.columns[i - 1] : null;
  const showBack = inPage || (s.collapsed && !!prev);
  const prevTitle = inPage ? page.stack.titleAt(page.index - 1) : prev ? s.titles[prev] : undefined;
  const label = backLabel ?? prevTitle ?? 'Back';
  const onBack = inPage ? page.stack.pop : s.back;

  // Large title.
  const large = !!largeTitle && title != null;
  const spec = useMemo<LargeSpec | null>(() => (large ? { title, trailing: largeTitleTrailing, className: largeTitleClassName } : null),
    [large, title, largeTitleTrailing, largeTitleClassName]);
  const setLarge = pane?.setLarge;
  useLayoutEffect(() => { setLarge?.(spec); }, [setLarge, spec]);
  useLayoutEffect(() => () => setLarge?.(null), [setLarge]);
  const inContent = large && !!pane && pane.contents > 0;
  // The inline title (and the hairline) come and go: under a large title once it scrolls away, or on scroll.
  const onScroll = !large && !!titleOnScroll && !!pane && pane.contents > 0;
  const fading = large || onScroll;
  const inline = large ? inContent && pane.under : onScroll ? pane.scrolled : true;

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

  const titleCls = 'pointer-events-none absolute left-1/2 max-w-[56%] -translate-x-1/2 truncate text-[17px] font-semibold tracking-[-.2px]';
  return (
    <>
      <div ref={head} data-slot="split-view-header" data-large-title={large || undefined}
        className={cn('relative z-30 flex h-[52px] shrink-0 items-center px-1.5', !fading && 'shadow-[inset_0_-1px_0_var(--border)]', className)} style={style}>
        <div className="relative z-1 flex min-w-[44px] items-center">
          {showBack ? (
            <AriaButton onPress={onBack} data-slot="split-view-back" aria-label={label === 'Back' ? undefined : `Back to ${label}`}
              className={cn(
                'bl-btn flex cursor-pointer items-center border-0 bg-transparent py-1.5 pr-2 pl-0 [font-family:inherit] text-[17px] text-primary outline-none data-[focus-visible]:rounded-lg data-[focus-visible]:ring-2 data-[focus-visible]:ring-ring',
                backMax != null ? 'max-w-(--back-max)' : 'max-w-[150px]',
              )}
              // The room the centered title leaves, measured.
              style={backMax != null ? { '--back-max': backMax + 'px' } as CSSProperties : undefined}>
              <Icon name="chevL" size={24} sw={2.4} className="shrink-0" />
              <span className="min-w-0 truncate">{label}</span>
            </AriaButton>
          ) : leading}
        </div>
        {fading ? (
          <>
            <motion.div ref={titleEl} className={titleCls} aria-hidden={!inline || undefined}
              initial={false} animate={{ opacity: inline ? 1 : 0, y: inline ? 0 : 8 }}
              transition={reduce ? { duration: 0 } : { y: springs.snappy, opacity: inline ? fades.in : fades.out }}>{title}</motion.div>
            <motion.span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-border"
              initial={false} animate={{ opacity: inline ? 1 : 0 }} transition={reduce ? { duration: 0 } : inline ? fades.in : fades.out} />
          </>
        ) : <div ref={titleEl} className={titleCls}>{title}</div>}
        <div className="relative z-1 ml-auto flex items-center gap-0.5">{trailing}</div>
      </div>
      {spec && !inContent ? <LargeTitle spec={spec} /> : null}
    </>
  );
}

/** Scrolling body of a column. Draws the header's large title, if it has one, at the top of the scroll. */
export function SplitViewContent({ children, className, style }: { children?: ReactNode; className?: string; style?: CSSProperties }) {
  const pane = useContext(PaneCtx);
  const add = pane?.addContent;
  useLayoutEffect(() => add?.(), [add]);
  const large = pane?.large;
  const setUnder = pane?.setUnder;
  const setScrolled = pane?.setScrolled;
  const scroller = useRef<HTMLDivElement | null>(null);
  const titleRef = useRef<HTMLDivElement | null>(null);
  const check = useCallback(() => {
    const el = titleRef.current, sc = scroller.current;
    if (!sc) return;
    setUnder?.(!!el && sc.scrollTop > el.offsetTop + el.offsetHeight - 4);
    setScrolled?.(sc.scrollTop > 8);
  }, [setUnder, setScrolled]);
  const hasLarge = large != null;
  useLayoutEffect(() => { check(); }, [check, hasLarge]);
  return (
    <div ref={scroller} data-slot="split-view-content" onScroll={pane ? check : undefined}
      className={cn('bl-scroll relative min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain', className)} style={style}>
      {large ? <LargeTitle spec={large} titleRef={titleRef} /> : null}
      {children}
    </div>
  );
}

export interface SplitViewToggleProps {
  className?: string;
  'aria-label'?: string;
}
/** Sidebar button. Shown whenever there's a sidebar to show or hide; hidden when collapsed (back takes over). */
export function SplitViewToggle({ className, ...aria }: SplitViewToggleProps) {
  const s = useInternal('SplitViewToggle');
  if (s.collapsed || !s.columns.includes('sidebar') || s.columns.length < 2) return null;
  return (
    <AriaButton onPress={s.toggleSidebar} data-slot="split-view-toggle"
      aria-label={aria['aria-label'] ?? (s.sidebarVisible ? 'Hide sidebar' : 'Show sidebar')}
      aria-expanded={s.sidebarVisible} aria-controls={s.idFor('sidebar')}
      className={cn(
        'bl-btn grid cursor-pointer place-items-center rounded-[10px] border-0 bg-transparent px-2.5 py-2 text-primary outline-none',
        'transition-[background,transform] duration-150 data-[hovered]:bg-secondary data-[pressed]:scale-[.94] data-[focus-visible]:ring-2 data-[focus-visible]:ring-ring',
        className,
      )}>
      <Icon name="sidebar" size={22} sw={1.9} />
    </AriaButton>
  );
}

/** Selected colours for a SplitViewItem: a background (foreground white), or both. */
export type SplitViewItemTint = string | { background: string; foreground?: string };

/** A SplitViewItem's surface: `pill` (inset rounded, sidebar default) or `row` (full-bleed with a separator);
 *  selected fills with the tint (pill) or a 14% wash of it (row) — the item's own `tint` when it has one. */
export const splitViewItemVariants = cva(
  [
    'bl-btn group/item relative flex w-full cursor-pointer items-center gap-3 border-0 text-left [font-family:inherit] text-foreground outline-none',
    'transition-[background-color,color] duration-150',
    'data-[focus-visible]:ring-2 data-[focus-visible]:ring-ring data-[focus-visible]:ring-inset',
  ],
  {
    variants: {
      variant: {
        pill: 'min-h-[40px] rounded-[10px] px-2.5 py-1.5 text-[15.5px]',
        row: 'min-h-[46px] px-4 py-2.5 text-[15.5px]',
      },
      selected: { true: '', false: 'bg-transparent data-[hovered]:bg-secondary data-[pressed]:bg-accent' },
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
  onPress?: () => void;
  className?: string;
}
/** A selectable row bound to the column's selection: pressing it selects `id` and shows the next column. */
export function SplitViewItem({ id, title, subtitle, icon, badge, children, variant, tint, onPress, className }: SplitViewItemProps) {
  const s = useInternal('SplitViewItem');
  const column = useContext(ColumnCtx) ?? 'supplementary';
  const v = variant ?? (column === 'sidebar' ? 'pill' : 'row');
  const selected = s.isSelected(column, id);
  const pushes = s.collapsed && s.columns.indexOf(column) < s.columns.length - 1;
  const tinted = tint != null;
  const tintStyle = tinted ? {
    '--split-item-tint': typeof tint === 'string' ? tint : tint.background,
    '--split-item-on-tint': typeof tint === 'string' ? 'white' : tint.foreground ?? 'white',
  } as CSSProperties : undefined;
  const onSel = selected && v === 'pill';
  const onKeyDown = (e: ReactKeyboardEvent<HTMLElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const col = e.currentTarget.closest('[data-slot^="split-view-"]');
    const items = col ? [...col.querySelectorAll<HTMLElement>('[data-split-item]')] : [];
    const n = items[items.indexOf(e.currentTarget) + (e.key === 'ArrowDown' ? 1 : -1)];
    if (n) { n.focus(); e.preventDefault(); }
  };
  return (
    <AriaButton data-split-item="" data-slot="split-view-item" data-selected={selected || undefined} aria-current={selected || undefined}
      data-tinted={tinted || undefined}
      onPress={() => { Haptics.selection(); s.select(column, id); onPress?.(); }}
      onKeyDown={onKeyDown}
      className={cn(splitViewItemVariants({ variant: v, selected, tinted }), className)}
      // The item's own tint is a runtime color.
      style={tintStyle}>
      {children ?? (
        <>
          {icon ? <span className={cn('grid w-6 shrink-0 place-items-center',
            onSel ? tinted ? 'text-(--split-item-on-tint)' : 'text-primary-foreground' : tinted ? 'text-(--split-item-tint)' : 'text-primary')}>{icon}</span> : null}
          <span className="min-w-0 flex-1">
            <span className="block truncate leading-[1.3]">{title}</span>
            {subtitle ? <span className={cn('mt-px block truncate text-[13px]',
              onSel ? tinted ? 'text-(--split-item-on-tint)/80' : 'text-primary-foreground/80' : 'text-muted-foreground')}>{subtitle}</span> : null}
          </span>
          {badge != null ? <span className={cn('shrink-0 text-[14px] tabular-nums',
            onSel ? tinted ? 'text-(--split-item-on-tint)/85' : 'text-primary-foreground/85' : 'text-muted-foreground')}>{badge}</span> : null}
          {pushes ? <Icon name="chev" size={14} sw={2.6} className={cn('shrink-0',
            onSel ? tinted ? 'text-(--split-item-on-tint)/70' : 'text-primary-foreground/70' : 'text-tertiary-foreground')} /> : null}
        </>
      )}
      {v === 'row' ? <span aria-hidden="true" className="pointer-events-none absolute right-0 bottom-0 left-4 h-px bg-border" /> : null}
    </AriaButton>
  );
}

/** A SplitViewSection's label: `default` — the small grey group label (Mail's "Favorites"); `prominent` — the
 *  bold 20px heading iOS uses over a list group (Reminders' "My Lists"). */
export const splitViewSectionLabelVariants = cva('', {
  variants: {
    variant: {
      default: 'px-2.5 pt-4 pb-1.5 text-[13px] font-semibold tracking-[-.1px] text-muted-foreground',
      prominent: 'px-1 pt-6 pb-2 text-[20px] font-bold tracking-[-.2px] text-foreground',
    },
  },
  defaultVariants: { variant: 'default' },
});

export interface SplitViewSectionProps extends VariantProps<typeof splitViewSectionLabelVariants> {
  /** Section label ("Favorites", "iCloud"). */
  title?: ReactNode;
  /** Classes for the label (merged over the variant's). */
  labelClassName?: string;
  /** The label becomes a disclosure button that folds the section with a spring. */
  collapsible?: boolean;
  expanded?: boolean;
  /** Default true. */
  defaultExpanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  children?: ReactNode;
  className?: string;
}
/** A titled group of SplitViewItems in a column. An item id may appear in more than one section; each copy
 *  highlights when it's selected. */
export function SplitViewSection({
  title, variant, labelClassName, collapsible, expanded, defaultExpanded = true, onExpandedChange, children, className,
}: SplitViewSectionProps) {
  const uid = useId();
  const [openState, setOpen] = useState(defaultExpanded);
  const open = !collapsible || (expanded ?? openState);
  const toggle = () => { const n = !open; setOpen(n); onExpandedChange?.(n); Haptics.selection(); };
  const labelCls = cn(splitViewSectionLabelVariants({ variant }), labelClassName);
  const items = <div className="flex flex-col gap-px">{children}</div>;
  return (
    <div data-slot="split-view-section" role="group" aria-labelledby={title != null ? uid : undefined} className={className}>
      {title == null ? null : collapsible ? (
        <AriaButton id={uid} onPress={toggle} aria-expanded={open}
          className={cn('bl-btn flex w-full cursor-pointer items-center border-0 bg-transparent text-left [font-family:inherit] outline-none data-[focus-visible]:rounded-lg data-[focus-visible]:ring-2 data-[focus-visible]:ring-ring', labelCls)}>
          <span className="flex-1">{title}</span>
          <Chevron direction={open ? 'down' : 'right'} size={variant === 'prominent' ? 18 : 14} sw={2.6} className="text-primary" />
        </AriaButton>
      ) : <div id={uid} className={labelCls}>{title}</div>}
      {collapsible ? <AnimatedHeight>{open ? items : null}</AnimatedHeight> : items}
    </div>
  );
}

/* ── Nested stack ── */
export interface SplitViewStackApi {
  /** Push a page on top. Pages are kept as elements, so read live data from hooks/context inside them. */
  push: (page: ReactNode, options?: { key?: string }) => void;
  /** Pop the top page (no-op at the root). */
  pop: () => void;
  popToRoot: () => void;
  /** Pages including the root: 1 at the root. */
  depth: number;
  canPop: boolean;
}
interface StackInternal extends SplitViewStackApi {
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

export interface SplitViewStackProps {
  /** The root page. */
  children?: ReactNode;
  /** Changing this drops every pushed page at once (e.g. the sidebar selection the stack belongs to). */
  resetKey?: unknown;
  onDepthChange?: (depth: number) => void;
  className?: string;
  style?: CSSProperties;
}

interface PageEntry { key: string; node: ReactNode; leaving?: boolean }
const ROOT_KEY = '__root';

/** A push/pop stack inside a column. Each page may have its own SplitViewHeader (whose back button pops,
 *  labelled with the page below's title) and SplitViewContent. The leading-edge swipe and Esc pop the
 *  innermost level first; the column stack only moves once this stack is at its root. */
export function SplitViewStack({ children, resetKey, onDepthChange, className, style }: SplitViewStackProps) {
  const s = useInternal('SplitViewStack');
  const [ref, W] = useContainerWidth<HTMLDivElement>();
  const [pages, setPages] = useState<PageEntry[]>([]);
  const live = pages.filter((p) => !p.leaving);
  const depth = live.length + 1;
  const seq = useRef(0);

  const [prevReset, setPrevReset] = useState(resetKey);
  if (!Object.is(prevReset, resetKey)) { setPrevReset(resetKey); setPages([]); }

  const push = useCallback((node: ReactNode, o?: { key?: string }) => {
    const key = o?.key ?? `page-${++seq.current}`;
    setPages((ps) => [...ps.filter((p) => p.key !== key), { key, node }]);
  }, []);
  const depthRef = useRef(depth); depthRef.current = depth;
  const pop = useCallback(() => {
    if (depthRef.current < 2) return;
    Haptics.impact('light');
    setPages((ps) => {
      let i = ps.length - 1;
      while (i >= 0 && ps[i].leaving) i--;
      if (i < 0) return ps;
      const n = [...ps]; n[i] = { ...n[i], leaving: true }; return n;
    });
  }, []);
  const popToRoot = useCallback(() => setPages((ps) => ps.map((p) => (p.leaving ? p : { ...p, leaving: true }))), []);
  const remove = useCallback((key: string) => setPages((ps) => ps.filter((p) => p.key !== key || !p.leaving)), []);

  const [titles, setTitles] = useState<Record<string, string | undefined>>({});
  const setTitle = useCallback((key: string, t: string | undefined) => setTitles((m) => (m[key] === t ? m : { ...m, [key]: t })), []);
  const liveKeys = live.map((p) => p.key).join('\u0000');
  const titleAt = useCallback((i: number) => titles[i === 0 ? ROOT_KEY : liveKeys.split('\u0000')[i - 1]], [titles, liveKeys]);

  const onDepth = useRef(onDepthChange); onDepth.current = onDepthChange;
  const firstDepth = useRef(true);
  useEffect(() => {
    if (firstDepth.current) { firstDepth.current = false; return; }
    onDepth.current?.(depth);
  }, [depth]);

  const api = useMemo<StackInternal>(() => ({ push, pop, popToRoot, depth, canPop: depth > 1, setTitle, titleAt }),
    [push, pop, popToRoot, depth, setTitle, titleAt]);

  // Leading-edge swipe pops the top page.
  const [swipe, setSwipe] = useState(0);
  const drag = useRef<{ x0: number; y0: number; on: boolean; last: number; lt: number; vel: number } | null>(null);
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (depth < 2 || e.button) return;
    const r = e.currentTarget.getBoundingClientRect();
    if (e.clientX - r.left > 28 || innerStackCanPop(e.target, e.currentTarget)) return;
    drag.current = { x0: e.clientX, y0: e.clientY, on: false, last: e.clientX, lt: performance.now(), vel: 0 };
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current; if (!d) return;
    const dx = e.clientX - d.x0, dy = e.clientY - d.y0;
    if (!d.on) {
      if (dx > 8 && dx > Math.abs(dy) * 1.2) {
        d.on = true;
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* noop */ }
      } else { if (Math.abs(dy) > 14) drag.current = null; return; }
    }
    const now = performance.now();
    d.vel = (e.clientX - d.last) / Math.max(1, now - d.lt); d.last = e.clientX; d.lt = now;
    setSwipe(Math.max(0.01, dx));
  };
  const onPointerUp = () => {
    const d = drag.current; drag.current = null;
    if (!d || !d.on) return;
    if (swipe / Math.max(1, W) > 0.33 || d.vel > 0.5) pop();
    setSwipe(0);
  };
  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Escape' || e.defaultPrevented || depth < 2 || innerStackCanPop(e.target, e.currentTarget)) return;
    pop(); e.preventDefault();
  };

  const top = depth - 1;
  const p = W ? clamp(swipe / W, 0, 1) : 0;
  const entries: (PageEntry & { pos: number })[] = [{ key: ROOT_KEY, node: children, pos: 0 }];
  let n = 0;
  pages.forEach((pg) => entries.push({ ...pg, pos: pg.leaving ? top + 1 : ++n }));
  return (
    <StackCtx.Provider value={api}>
      <div ref={ref} data-slot="split-view-stack" data-depth={depth} data-split-stack-can-pop={depth > 1 || undefined}
        className={cn('relative min-h-0 flex-1 touch-pan-y overflow-hidden bg-inherit', className)} style={style}
        onPointerDownCapture={onPointerDown} onPointerMoveCapture={onPointerMove} onPointerUpCapture={onPointerUp} onPointerCancelCapture={onPointerUp}
        onKeyDown={onKeyDown}>
        {entries.map((e, i) => {
          let x = 0, dim = 0;
          if (e.leaving) x = W + 24;
          else if (e.pos < top) { x = -0.3 * W; dim = 0.1; if (p > 0 && e.pos === top - 1) { x = -0.3 * W * (1 - p); dim = 0.1 * (1 - p); } }
          else if (p > 0) x = swipe;
          return (
            <StackPage key={e.key} pageKey={e.key} index={e.pos} z={i} x={x} dim={dim} top={e.pos === top && !e.leaving}
              leaving={!!e.leaving} enterFrom={W + 24} instant={s.instant} tracking={swipe > 0}
              api={api} onGone={remove}>
              {e.node}
            </StackPage>
          );
        })}
      </div>
    </StackCtx.Provider>
  );
}

function StackPage({ pageKey, index, z, x: tx, dim: tdim, top, leaving, enterFrom, instant, tracking, api, onGone, children }: {
  pageKey: string; index: number; z: number; x: number; dim: number; top: boolean; leaving: boolean; enterFrom: number;
  instant: boolean; tracking: boolean; api: StackInternal; onGone: (key: string) => void; children: ReactNode;
}) {
  // A pushed page enters from the trailing edge; the root (and anything on first paint) is simply there.
  const x = useMotionValue(index > 0 && !instant ? enterFrom : tx);
  const dim = useMotionValue(tdim);
  useLayoutEffect(() => {
    if (instant) { x.jump(tx); if (leaving) onGone(pageKey); return; }
    if (tracking) { x.stop(); x.set(tx); return; }
    if (x.get() === tx) { if (leaving) onGone(pageKey); return; }
    const c = animate(x, tx, springs.smooth);
    if (leaving) c.then(() => onGone(pageKey));
    return undefined;
  }, [x, tx, instant, tracking, leaving, pageKey, onGone]);
  useLayoutEffect(() => {
    if (instant || tracking) dim.jump(tdim);
    else if (dim.get() !== tdim) animate(dim, tdim, springs.smooth);
  }, [dim, tdim, instant, tracking]);

  // Keep keyboard focus with the navigation, like the column stack.
  const el = useRef<HTMLDivElement | null>(null);
  const wasTop = useRef(top);
  useEffect(() => {
    const node = el.current;
    const host = node?.parentElement;
    if (top && !wasTop.current && node && host) {
      const a = document.activeElement;
      if (!a || a === document.body || (host.contains(a) && !node.contains(a))) node.focus({ preventScroll: true });
    }
    wasTop.current = top;
  }, [top]);

  const page = useMemo(() => ({ index, pageKey, stack: api }), [index, pageKey, api]);
  return (
    <PageCtx.Provider value={page}>
      <motion.div ref={el} tabIndex={-1} data-slot="split-view-stack-page" data-top={top || undefined} inert={!top || undefined}
        className="absolute inset-0 flex flex-col bg-inherit outline-none"
        style={{ x, zIndex: z }}>
        <Pane>{children}</Pane>
        <motion.div aria-hidden="true" className="pointer-events-none absolute inset-0 z-50 bg-black" style={{ opacity: dim }} />
        {index > 0 ? (
          <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 -left-10 w-10 bg-[linear-gradient(to_left,--alpha(black/14%),transparent)]" />
        ) : null}
      </motion.div>
    </PageCtx.Provider>
  );
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
        {title ? <div className="text-[16px] font-medium text-muted-foreground">{title}</div> : null}
        {description ? <div className="mt-1 text-[13px] text-tertiary-foreground">{description}</div> : null}
      </div>
    </div>
  );
}

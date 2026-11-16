'use client';
import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentProps,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type Ref,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import {
  DrawerContent as SdkDrawerContent,
  DrawerHandle as SdkDrawerHandle,
  createDrawerController,
  type DrawerOpenChangeReason,
  type DrawerSnapPointChangeReason,
  type SnapPoint,
} from '@ui-sdk/react/drawer';
import { Button as SdkButton } from '@ui-sdk/react/button';
import { type ChangeDetails } from '@ui-sdk/core';
import { cva } from 'class-variance-authority';
import { themeScopeClass, useAppearance, useThemeScope, type Appearance } from '@/lib/theme';
import { ThemeScopeContext } from '@/lib/theme-context';
import { useHideOnScroll } from '@/lib/scroll-edge';
import { changeDetails, type ChangeGiven } from '@/lib/change-details';
import { useControllableChange } from '@/lib/controllable-state';
import { focusRing } from '@/lib/primitives';
import { cn } from '@/lib/utils';
import { Sheet, SheetBackdrop, sheetGrabberVariants } from '@/components/ui/sheet';
import { trayInset } from '@/lib/surface';

/* ══ FloatingSheet — a card that rests over a page and grows into it ══
   <FloatingSheet peek={120} aria-label="Order">
     <FloatingSheetBody>…grows with the sheet…</FloatingSheetBody>
     <FloatingSheetFooter>…pinned at the bottom…</FloatingSheetFooter>
     <FloatingSheetFab aria-label="Show order"><Icon name="bag" /></FloatingSheetFab>
   </FloatingSheet>
   UI SDK's Drawer with snap points at the peek, any `snapPoints` and full height, modal only above the peek. ══ */

/** The look: translucent glass over the page, or an opaque card like a system sheet. */
export type FloatingSheetVariant = 'glass' | 'card';
/** The colour scheme of the surface. `auto` follows the page; `light` / `dark` put the bl-theme's `sheet` scope on it
    in that appearance (the host's background and accent stay), so the sheet can disagree with the page. */
export type FloatingSheetAppearance = 'auto' | Appearance;
/** Which edge of the host the FAB rests on. `start` / `end` are the inline edges (left / right in a left-to-right page). */
export type FloatingSheetFabSide = 'top' | 'bottom' | 'start' | 'end';
/** Where along that edge: `start`, `center` or `end` (for `start` / `end` sides, top, middle or bottom). */
export type FloatingSheetFabAlign = 'start' | 'center' | 'end';
/** What a drag below the resting height does: fold the sheet into its FAB, slide it off the bottom edge
    (`visible` becomes false), or nothing (it springs back to rest). */
export type FloatingSheetCollapse = 'fab' | 'hide' | 'none';
/** A size as pixels, or (`'52%'`) a share of the host's height. */
export type FloatingSheetSize = number | `${number}%`;

/** What `onOpenChange` and `onVisibleChange` receive: UI SDK's change details from the drawer underneath (`swipe`,
    `handle-press`, `handle-key`, `escape-key`, `outside-press`, `imperative`, …). */
export type FloatingSheetChangeDetails = ChangeDetails<DrawerSnapPointChangeReason | DrawerOpenChangeReason>;
/** Why the sheet folded into its FAB or unfolded: a drag below rest (`swipe`), the FAB (`trigger-press`), or code. */
export type FloatingSheetMinimizedChangeReason = 'swipe' | 'trigger-press' | 'imperative';
export type FloatingSheetMinimizedChangeDetails = ChangeDetails<FloatingSheetMinimizedChangeReason>;

export interface FloatingSheetContextValue {
  /** Whether the sheet has grown to its full height. */
  open: boolean;
  /** Grows the sheet or brings it back to rest (`onOpenChange` hears `imperative` unless `given` says otherwise). */
  setOpen: (open: boolean, given?: ChangeGiven<DrawerSnapPointChangeReason | DrawerOpenChangeReason>) => void;
  /** The resting stop: 0 at the peek, 1 fully grown, a snap point in between. The live value while dragging is the
      `--fs-grown` CSS variable on the surface. */
  progress: number;
  /** Height of body visible while resting, px. */
  peek: number;
  /** Whether the surface has been folded into its FAB. */
  minimized: boolean;
  setMinimized: (minimized: boolean, given?: ChangeGiven<FloatingSheetMinimizedChangeReason>) => void;
}

const FloatingSheetContext = createContext<FloatingSheetContextValue | null>(null);

export function useFloatingSheet(): FloatingSheetContextValue {
  const value = useContext(FloatingSheetContext);
  if (!value) {
    throw new Error('useFloatingSheet must be used within <FloatingSheet>');
  }
  return value;
}

/* What the parts read from the root; not public. */
interface PartsContextValue {
  root: HTMLDivElement | null;
  setFoot: (el: HTMLDivElement | null) => void;
  bodyAlign: 'start' | 'end';
  /** The body window is out of reach: resting on the cap and foot alone, not being dragged. */
  closedWindow: boolean;
  variant: FloatingSheetVariant;
  label: string;
  collapse: FloatingSheetCollapse;
  minimized: boolean;
  restore: (event?: Event) => void;
  claimFab: () => () => void;
}
const PartsContext = createContext<PartsContextValue | null>(null);
const DraggingContext = createContext(false);

function useParts(part: string): PartsContextValue {
  const value = useContext(PartsContext);
  if (!value) throw new Error(`${part} must be used within <FloatingSheet>`);
  return value;
}

/** Height of the grabber cap row at the top of the surface: 18px, and 36px on a touch screen, where it is the one
 *  control that grows the sheet. With the 8px of the dock's padding under it (which passes presses through) it is a
 *  44px target even when nothing peeks. */
const CAP_HEIGHT = 18;
const CAP_HEIGHT_COARSE = 36;

const COARSE = '(pointer: coarse)';
const subscribeCoarse = (change: () => void) => {
  const query = typeof matchMedia === 'function' ? matchMedia(COARSE) : null;
  query?.addEventListener?.('change', change);
  return () => query?.removeEventListener?.('change', change);
};
/** Whether the primary pointer is a finger. */
function useCoarsePointer() {
  return useSyncExternalStore(subscribeCoarse, () => typeof matchMedia === 'function' && matchMedia(COARSE).matches, () => false);
}
/** The surface's top and bottom borders are outside its flex children. */
const BORDER_HEIGHT = 2;
/** The glass blur. Inline, so the production CSS optimizer cannot rewrite the unprefixed property out of Safari's bundle. */
const GLASS_BLUR: CSSProperties = { backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' };

/* One surface at the top of UI SDK's bottom Drawer. The Drawer moves (translates) a transparent panel as tall as the
   fully grown sheet and writes how far it is open (`--drawer-progress`) on it; the surface derives its geometry from
   that every frame — it grows taller, wider and squarer as it rises past the peek (`--fs-grown`, 0 → 1), and below
   the peek it keeps its resting size and slides away. The cap, the growing body and the foot are rows of one rounded
   rect, so there is no second card to fade in and no seam under the cap.
   ck-floating-sheet__surface stays as a hook for the peek-mask rules in styles.css. */
const surfaceBase =
  'ck-floating-sheet__surface pointer-events-auto absolute inset-x-0 top-0 mx-auto box-border flex h-[max(calc(var(--fs-rest)*1px_-_var(--fs-gutter)*1px),calc(var(--fs-extent)*1px_-_var(--fs-gutter)*1px*(1_-_var(--fs-grown))))] w-[min(var(--fs-max-w,100%),max(52px,calc(100%_-_var(--fs-gutter)*2px*(1_-_var(--fs-grown)))))] flex-col'
  // A surface narrower than its host (`width`) sits at its `align`: `gutter` in from that edge.
  + ' data-[align=start]:ms-[calc(var(--fs-gutter)*1px*(1_-_var(--fs-grown)))] data-[align=start]:me-auto data-[align=end]:ms-auto data-[align=end]:me-[calc(var(--fs-gutter)*1px*(1_-_var(--fs-grown)))] overflow-hidden rounded-t-[calc(var(--fs-radius)*(1_-_var(--fs-grown)*var(--fs-square)))] rounded-b-[calc(var(--fs-radius-bottom)*(1_-_var(--fs-grown)))] border transition-[background-color,border-color,box-shadow,backdrop-filter,color,translate,opacity] duration-spring-smooth ease-spring-smooth motion-reduce:transition-none';
/* The material, mixed from the scope's own tokens (so it follows the page, or the `sheet` scope of an explicit
   appearance): translucent glass (the card colour at a growing alpha under a highlight gradient), or an opaque
   card (the card colour, a soft shadow that deepens as it grows). The FAB wears the same. */
const sheetMaterial = {
  glass:
    'border-[color:color-mix(in_srgb,var(--foreground)_calc(var(--ck-sheet-border-alpha,.12)*100%),transparent)] bg-[color:color-mix(in_srgb,var(--card)_calc(var(--ck-sheet-bg-alpha,.28)*100%),transparent)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--color-white)_8%,transparent),color-mix(in_srgb,var(--color-white)_1.8%,transparent)_34%,color-mix(in_srgb,var(--color-white)_2.6%,transparent))] [box-shadow:inset_0_1px_0_color-mix(in_srgb,var(--color-white)_14%,transparent),inset_0_-1px_0_color-mix(in_srgb,var(--color-white)_3%,transparent),0_2px_10px_color-mix(in_srgb,var(--color-black)_12%,transparent),0_var(--ck-sheet-shadow-y,14px)_var(--ck-sheet-shadow-blur,34px)_-12px_color-mix(in_srgb,var(--color-black)_calc(var(--ck-sheet-shadow-alpha,.22)*100%),transparent)]',
  card:
    'border-[color:color-mix(in_srgb,var(--foreground)_calc(var(--ck-sheet-border-alpha,.12)*50%),transparent)] bg-card [box-shadow:0_-1px_0_color-mix(in_srgb,var(--foreground)_4%,transparent),0_2px_10px_color-mix(in_srgb,var(--color-black)_8%,transparent),0_var(--ck-sheet-shadow-y,14px)_var(--ck-sheet-shadow-blur,34px)_-12px_color-mix(in_srgb,var(--color-black)_calc(var(--ck-sheet-shadow-alpha,.22)*100%),transparent)]',
};

/** The surface, resting or hidden by scrolling. */
export const floatingSheetSurfaceVariants = cva(surfaceBase, {
  variants: {
    variant: sheetMaterial,
    /** Hidden by scrolling: slid below the edge, faded out and out of reach. */
    hidden: { true: 'pointer-events-none translate-y-[calc(100%_+_44px)] opacity-0', false: '' },
  },
  defaultVariants: { variant: 'glass', hidden: false },
});

/** The FAB the sheet folds into, on an edge of the host (`side`) at `align` along it, `--fs-fab-gutter` in from the
    edges. It grows in as the sheet goes. */
export const floatingSheetFabVariants = cva(
  cn(
    'pointer-events-auto absolute z-1 grid size-[52px] cursor-pointer place-items-center rounded-full border p-0 text-foreground transition-[opacity,scale] duration-spring-snappy ease-spring-snappy data-folded:pointer-events-none data-folded:scale-60 data-folded:opacity-0 motion-reduce:transition-none',
    focusRing,
  ),
  {
    variants: {
      variant: sheetMaterial,
      side: {
        top: 'top-(--fs-fab-gutter)',
        bottom: 'bottom-(--fs-fab-gutter)',
        start: 'start-(--fs-fab-gutter)',
        end: 'end-(--fs-fab-gutter)',
      },
      align: { start: '', center: '', end: '' },
    },
    compoundVariants: [
      { side: ['top', 'bottom'], align: 'start', class: 'start-(--fs-fab-gutter)' },
      { side: ['top', 'bottom'], align: 'center', class: 'left-1/2 -translate-x-1/2' },
      { side: ['top', 'bottom'], align: 'end', class: 'end-(--fs-fab-gutter)' },
      { side: ['start', 'end'], align: 'start', class: 'top-(--fs-fab-gutter)' },
      { side: ['start', 'end'], align: 'center', class: 'top-1/2 -translate-y-1/2' },
      { side: ['start', 'end'], align: 'end', class: 'bottom-(--fs-fab-gutter)' },
    ],
    defaultVariants: { variant: 'glass', side: 'bottom', align: 'center' },
  },
);

/** The layer: the box the sheet's contained Sheet (its layer host) fills, so it covers this box, not the app.
    ck-floating-sheet keys the body / peek-mask rules in styles.css. */
export const floatingSheetVariants = cva(
  'ck-floating-sheet pointer-events-none absolute inset-0 z-40 overflow-clip font-sans text-foreground [contain:layout]',
);

export interface FloatingSheetProps {
  /** Controlled state for the fully grown sheet. */
  open?: boolean;
  defaultOpen?: boolean;
  /** The sheet grew to full height or came back to rest: a drag (`swipe`), the cap (`handle-press`, `handle-key`),
      Escape (`escape-key`), the scrim (`outside-press`) or code. `details.cancel()` keeps it where it is. */
  onOpenChange?: (open: boolean, details: FloatingSheetChangeDetails) => void;
  /**
   * Height of body kept visible above the foot while resting, so a summary (the newest chat reply, an order
   * status) peeks out. `0` rests on the foot alone. `'52%'` sizes the whole resting sheet (cap and foot included)
   * as a share of the host instead.
   */
  peek?: FloatingSheetSize;
  /** Space left above the sheet when fully grown, so the page behind still shows (and the top corners stay round). */
  topGap?: FloatingSheetSize;
  /**
   * Extra resting heights between the peek and full, as fractions (0–1) of the fully grown body — `[0.5]` for a
   * half-height stop — or (`'70%'`) as a share of the host. A drag releases to whichever stop its velocity carries
   * it nearest. The peek and full height are always stops.
   */
  snapPoints?: (number | `${number}%`)[];
  /** What a drag below the resting height does. `fab` (default) folds the sheet into its FAB (`minimized`); `hide`
      slides it off the bottom edge (`visible` becomes false); `none` springs it back. */
  collapse?: FloatingSheetCollapse;
  /** Controlled fold into the FAB (`collapse="fab"`). */
  minimized?: boolean;
  defaultMinimized?: boolean;
  onMinimizedChange?: (minimized: boolean, details: FloatingSheetMinimizedChangeDetails) => void;
  /** Whether a `collapse="hide"` sheet is on screen. Pass it with `onVisibleChange` to control it. */
  visible?: boolean;
  defaultVisible?: boolean;
  onVisibleChange?: (visible: boolean, details: FloatingSheetChangeDetails) => void;
  /** Inset from the host edges while resting, px. Default 10, the inset of Dialog's `tray` (the same floating card
      on a phone). `0` docks the sheet edge to edge like a system sheet. */
  gutter?: number;
  /** Corner radius while resting: px, or any CSS length. Default `var(--radius-sheet)`, the radius of every modal
      sheet and of Dialog's `tray`. Squares off as the sheet fills the host. */
  radius?: number | string;
  /** The surface's largest inline size: px, or any CSS length. Default: the host's width less the `gutter`. A wide
   *  host (a tablet or a desktop window) keeps the card to a readable column, as a Maps card does on an iPad. */
  width?: number | string;
  /** Where a surface narrower than the host sits: `center` (default), or `gutter` in from the `start` / `end` edge. */
  align?: 'start' | 'center' | 'end';
  /** `glass` (default) blurs the page behind it; `card` is an opaque card. */
  variant?: FloatingSheetVariant;
  /** Colour scheme of the surface: `auto` (default) follows the page; `light` / `dark` override it. */
  appearance?: FloatingSheetAppearance;
  /**
   * Which edge of the body the visible window is anchored to. `end` pins the body to the foot so a transcript grows
   * upward out of the cap; `start` keeps a card's header under the cap and lets the rest emerge below as it grows.
   */
  bodyAlign?: 'start' | 'end';
  /** Follow NavigationStack/List scroll chrome, like the `Tabs` bar. */
  hideOnScroll?: boolean;
  /** A scroller whose direction also hides and restores the surface while it is resting. */
  scrollRef?: RefObject<HTMLElement | null>;
  /** Dim the host behind the sheet as it grows. */
  scrim?: boolean;
  /** Key of the current view of a flow (review → pay → done), as on Sheet and Dialog: with it, `SheetHeader
   *  variant="bar"`, `SheetBack`, `SheetTitle` and `SheetView` inside travel the way the flow moves (a new key from
   *  the end, one seen before from the start). Give each step its own `peek` to spring the sheet between heights. */
  view?: string;
  /** Accessible name of the sheet (its FAB is "Open" + this name unless the FloatingSheetFab names itself). */
  'aria-label'?: string;
  /** The root layer element. */
  ref?: Ref<HTMLDivElement>;
  children?: ReactNode;
  className?: string;
  /** Classes for the sheet surface itself (the card), merged last — e.g. `bg-background`. */
  surfaceClassName?: string;
  style?: CSSProperties;
}

/** Pixels of a host share (`'52%'`), minus what the cap, foot and borders already take. */
const shareOfHost = (percent: string, hostHeight: number, chrome: number) =>
  Math.max(0, (hostHeight * Number.parseFloat(percent)) / 100 - chrome);

/**
 * A floating surface that fills its positioned host as a pointer-transparent layer and grows from a resting card
 * into the full page: UI SDK's Drawer with snap points at the peek, any `snapPoints` and full height, modal only
 * above the peek (`modalAbove`), so the page stays usable beside a resting sheet. Drag it (or press the cap) to grow
 * it; drag down past the resting height to fold it into a FAB, or (`collapse="hide"`) slide it away. Escape and the
 * scrim bring a grown sheet back to rest. Write a `FloatingSheetBody` (the growing region) and a `FloatingSheetFooter`
 * (pinned at the bottom: a composer, actions) inside it, in that order.
 */
export function FloatingSheet({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  peek: requestedPeek = 0,
  topGap = 0,
  snapPoints,
  collapse = 'fab',
  minimized: controlledMinimized,
  defaultMinimized = false,
  onMinimizedChange,
  visible: controlledVisible,
  defaultVisible = true,
  onVisibleChange,
  gutter = trayInset,
  radius = 'var(--radius-sheet)',
  variant = 'glass',
  appearance = 'auto',
  bodyAlign = 'start',
  hideOnScroll = true,
  scrollRef,
  scrim = true,
  view,
  width,
  align = 'center',
  'aria-label': label = 'Sheet',
  ref,
  children,
  className,
  surfaceClassName,
  style,
}: FloatingSheetProps) {
  // `auto` follows the page; an explicit appearance is the bl-theme's `sheet` scope in it, published to popups opened
  // inside (a scope above is passed through unchanged otherwise).
  const scheme: Appearance | undefined = appearance === 'auto' ? undefined : appearance;
  const parentScope = useThemeScope();
  const scope = scheme ? { scope: 'sheet', appearance: scheme } : parentScope;
  // The page's scheme under the sheet (its scope's, else the app's; light without either).
  const ambient = useAppearance();
  const pageScheme = parentScope?.appearance ?? ambient ?? 'light';
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const rootRef = useCallback(
    (el: HTMLDivElement | null) => {
      setRoot(el);
      if (typeof ref === 'function') ref(el);
      else if (ref) ref.current = el;
    },
    [ref],
  );
  const [foot, setFoot] = useState<HTMLDivElement | null>(null);
  const [height, setHeight] = useState(0);
  const [footHeight, setFootHeight] = useState(0);
  const [minimized, changeMinimized] = useControllableChange<boolean, FloatingSheetMinimizedChangeReason>(controlledMinimized, defaultMinimized, onMinimizedChange);
  const [visible, changeVisible] = useControllableChange<boolean, DrawerSnapPointChangeReason | DrawerOpenChangeReason>(controlledVisible, defaultVisible, onVisibleChange);
  // The resting stop, as an index into `stops` (0 is the peek, the last is fully grown).
  const [stop, setStop] = useState(defaultOpen ? Number.POSITIVE_INFINITY : 0);
  const [controller] = useState(() => createDrawerController());
  // A move this component asked the drawer for, already reported to `onOpenChange`.
  const moving = useRef(false);
  const [customFabs, setCustomFabs] = useState(0);

  // Only the geometry waits for a measurement: the sheet, its surface and the Body render from the first (server)
  // render on. A host that measures 0 (a hidden tab, a closed panel) keeps the last geometry, so nothing moves or
  // unmounts while it is out of sight.
  useLayoutEffect(() => {
    if (!root) return;
    const measure = () => {
      if (root.offsetHeight === 0) return;
      setHeight(root.offsetHeight);
      setFootHeight(foot?.offsetHeight ?? 0);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    if (foot) observer.observe(foot);
    return () => observer.disconnect();
  }, [root, foot]);

  const capHeight = useCoarsePointer() ? CAP_HEIGHT_COARSE : CAP_HEIGHT;
  const dockHeight = (foot ? footHeight : 0) + capHeight;
  const chrome = dockHeight + BORDER_HEIGHT;
  // Fully grown, the cap touches the host's top edge (or `topGap` short of it) and the foot its bottom edge.
  const gapAbove = typeof topGap === 'string' ? (height * Number.parseFloat(topGap)) / 100 : topGap;
  const full = Math.max(0, height - gapAbove);
  const maxReveal = Math.max(0, full - chrome);
  // The peek can never take more than three quarters of the host, or there is nothing to grow into.
  const requested = typeof requestedPeek === 'string' ? shareOfHost(requestedPeek, height, chrome) : requestedPeek;
  const peek = Math.max(0, Math.min(requested, maxReveal * 0.75));
  // Where the sheet rests, measured from the host's bottom edge: the resting card plus the gutter under it.
  const rest = chrome + peek + gutter;
  const between = (snapPoints ?? [])
    .map((d) => chrome + (typeof d === 'string' ? shareOfHost(d, height, chrome) : Math.round(Math.max(0, Math.min(1, d)) * maxReveal)))
    .filter((px) => px > rest + 1 && px < full - 1)
    .sort((a, b) => a - b);
  // Before the first measurement there is nothing to rest on: the sheet stays rendered but closed (`keepMounted`).
  const measured = full > 0;
  const stops = measured ? [rest, ...between, full].map((px) => Math.max(2, Math.round(px))) : [1];
  const last = stops.length - 1;
  const at = Math.min(stop, last);
  const open = controlledOpen ?? at === last;
  // A controlled `open` wins: open is fully grown; closed leaves the sheet on its snap point, or at the peek.
  const resting = controlledOpen === undefined ? at : controlledOpen ? last : at === last ? 0 : at;
  const folded = collapse === 'fab' && minimized;
  const shown = (collapse === 'hide' ? visible : !folded) && measured;
  const progress = last > 0 ? (stops[resting] - stops[0]) / (stops[last] - stops[0]) : 0;

  /** Moves to a stop after `onOpenChange` agreed (when it changes `open`); false when it was canceled. */
  const moveTo = (index: number, given: ChangeGiven<DrawerSnapPointChangeReason | DrawerOpenChangeReason>) => {
    const grown = index === last;
    if (grown !== open) {
      const details = changeDetails(given);
      onOpenChange?.(grown, details);
      if (details.canceled) return false;
    }
    setStop(index);
    moving.current = true;
    controller.setSnapPoint(stops[index], { reason: 'imperative' });
    moving.current = false;
    return true;
  };

  const setOpen: FloatingSheetContextValue['setOpen'] = (next, given) => {
    if (next === open) return;
    moveTo(next ? last : 0, given ?? { reason: 'imperative' });
  };

  const setMinimized: FloatingSheetContextValue['setMinimized'] = (next, given) => {
    if (changeMinimized(next, given) && next) setStop(0);
  };

  // The drawer settled on another stop: the user dragged it, pressed or arrowed the cap.
  const onSnapPointChange = (snapPoint: SnapPoint, details: FloatingSheetChangeDetails) => {
    const px = typeof snapPoint === 'number' ? snapPoint : Number.parseFloat(String(snapPoint));
    const index = stops.reduce((best, s, i) => (Math.abs(s - px) < Math.abs(stops[best] - px) ? i : best), 0);
    if (!moving.current && (index === last) !== open) onOpenChange?.(index === last, details);
    if (!details.canceled) setStop(index);
  };

  // The drawer wants to close. Only a drag below the peek puts the sheet away (or folds it into its FAB); Escape and
  // the scrim bring a grown sheet back to rest instead, reported to `onOpenChange` with their reason.
  const onDrawerOpenChange = (next: boolean, details: FloatingSheetChangeDetails) => {
    if (next) return;
    const given = { reason: details.reason, event: details.event, source: details.source };
    if (details.reason === 'swipe' && collapse === 'hide') {
      if (!changeVisible(false, given)) details.cancel();
      else setStop(0);
      return;
    }
    if (details.reason === 'swipe' && collapse === 'fab') {
      if (!changeMinimized(true, { reason: 'swipe', event: details.event, source: details.source })) details.cancel();
      else setStop(0);
      return;
    }
    details.cancel();
    if (resting > 0) moveTo(0, given);
  };

  const restore = (event?: Event) => {
    if (changeMinimized(false, { reason: event ? 'trigger-press' : 'imperative', event })) setStop(0);
  };

  // A sheet that shows only its cap and foot gets out of the way of a scroll; a peeking or risen one stays.
  const hidden = useHideOnScroll(hideOnScroll, scrollRef) && resting === 0 && peek === 0;
  // Glass mixes the card colour over the page. A scheme that disagrees with the page (a dark sheet over a light map)
  // would mix to a mid grey its own text can't be read on, so its glass starts nearly opaque.
  const contrasting = !!scheme && scheme !== pageScheme;
  const restAlpha = contrasting ? 0.82 : peek > 0 ? 0.5 : 0.28;
  const grownAlpha = contrasting ? 0.92 : 0.58;
  const glass = variant === 'glass';

  const value: FloatingSheetContextValue = { open, setOpen, progress, peek, minimized: folded, setMinimized };
  const parts: PartsContextValue = {
    root,
    setFoot,
    bodyAlign,
    closedWindow: resting === 0 && peek === 0,
    variant,
    label,
    collapse,
    minimized: folded,
    restore,
    claimFab: () => {
      setCustomFabs((n) => n + 1);
      return () => setCustomFabs((n) => n - 1);
    },
  };

  return (
    <FloatingSheetContext.Provider value={value}>
      <PartsContext.Provider value={parts}>
        <ThemeScopeContext.Provider value={scope}>
          <div
            ref={rootRef}
            data-slot="floating-sheet"
            data-variant={variant}
            data-appearance={scheme}
            data-theme-scope={scheme ? 'sheet' : undefined}
            data-body-align={bodyAlign}
            data-open={open || undefined}
            data-expanded={(resting > 0 || peek > 0) || undefined}
            data-minimized={folded || undefined}
            data-dismissed={(collapse === 'hide' && !visible) || undefined}
            className={cn(floatingSheetVariants(), themeScopeClass(scheme), className)}
            style={{ '--fs-fab-gutter': `${Math.max(gutter, 16)}px`, ...style } as CSSProperties}
          >
            {/* A contained Sheet: its layer host fills this box, so the drawer is modal only to it and rendered in
                place (without the top layer, into that host rather than the body). */}
            <Sheet
              side="bottom"
              contained
              view={view}
              controller={controller}
              open={shown}
              onOpenChange={onDrawerOpenChange}
              snapPoints={stops}
              snapPoint={stops[resting]}
              onSnapPointChange={onSnapPointChange}
              modalAbove={stops[0]}
              driver="pointer"
            >
              {scrim ? <SheetBackdrop className="bg-black/16" /> : null}
              <SdkDrawerContent
                keepMounted
                initialFocus="none"
                finalFocus="none"
                aria-label={label}
                className="pointer-events-none! relative box-border w-full bg-transparent outline-none [--fs-extent:calc(var(--drawer-progress,0)*var(--fs-h))] [--fs-grown:clamp(0,calc((var(--fs-extent)_-_var(--fs-rest))/var(--fs-span)),1)]"
                style={{
                  height: `${full}px`,
                  '--fs-h': full,
                  '--fs-rest': stops[0],
                  '--fs-span': Math.max(1, full - stops[0]),
                } as CSSProperties}
              >
                {(state) => (
                  <div
                    data-slot="floating-sheet-surface"
                    // A transcript inside reads its resting state from here (see the message-scroller primitive).
                    data-peek-host=""
                    data-open={open || undefined}
                    data-expanded={(resting > 0 || peek > 0) || undefined}
                    data-peeking={(peek > 0 && resting === 0) || undefined}
                    data-dragging={state.dragging || undefined}
                    data-hidden={hidden || undefined}
                    data-align={align}
                    className={cn(floatingSheetSurfaceVariants({ variant, hidden }), surfaceClassName)}
                    style={{
                      '--fs-max-w': width === undefined ? undefined : typeof width === 'number' ? `${width}px` : width,
                      '--fs-gutter': gutter,
                      '--fs-radius': typeof radius === 'number' ? `${radius}px` : radius,
                      '--fs-radius-bottom': gutter > 0 ? 'var(--fs-radius)' : '0px',
                      '--fs-square': gapAbove > 0 ? 0 : 1,
                      // The material firms up as the sheet grows.
                      '--ck-sheet-border-alpha': 'calc(.12 + .04 * var(--fs-grown))',
                      '--ck-sheet-bg-alpha': `calc(${restAlpha} + ${grownAlpha - restAlpha} * var(--fs-grown))`,
                      '--ck-sheet-shadow-y': 'calc(14px + 20px * var(--fs-grown))',
                      '--ck-sheet-shadow-blur': 'calc(34px + 30px * var(--fs-grown))',
                      '--ck-sheet-shadow-alpha': 'calc(.22 + .18 * var(--fs-grown))',
                      '--ck-sheet-divider-alpha': 'calc(.09 * var(--fs-grown))',
                      '--ck-sheet-body-height': `${maxReveal}px`,
                      ...(glass ? GLASS_BLUR : null),
                    } as CSSProperties}
                  >
                    {/* The cap: UI SDK's handle, so a press steps to the next stop and the arrow keys, Home and End
                        move through them. Its grip is the Sheet's grabber, widening while it is pressable. */}
                    <SdkDrawerHandle
                      data-open={open || undefined}
                      aria-label={open ? 'Collapse' : 'Expand'}
                      className={cn(
                        'group/cap box-border grid h-[18px] w-full shrink-0 cursor-grab touch-none place-items-center border-0 bg-transparent p-0 text-inherit focus-visible:ring-inset active:cursor-grabbing pointer-coarse:h-9',
                        // 18px drawn, 36px on a touch screen (`CAP_HEIGHT_COARSE`), where it answers presses 44px tall, over the
                        // body's faded top or the dock's padding.
                        "relative z-1 pointer-coarse:after:absolute pointer-coarse:after:inset-x-0 pointer-coarse:after:top-0 pointer-coarse:after:h-11 pointer-coarse:after:content-['']",
                        focusRing,
                      )}
                    >
                      <span
                        data-slot="floating-sheet-grip"
                        className={cn(
                          sheetGrabberVariants(),
                          'm-0 h-1 [transition:width_var(--duration-spring-bouncy)_var(--ease-spring-bouncy),background-color_var(--duration-spring-snappy)_var(--ease-spring-snappy)] motion-reduce:[transition:none]',
                          open
                            ? 'w-10 bg-muted-foreground'
                            : 'w-8 group-hover/cap:w-10 group-hover/cap:bg-muted-foreground group-focus-visible/cap:w-10 group-focus-visible/cap:bg-muted-foreground',
                        )}
                      />
                    </SdkDrawerHandle>
                    <DraggingContext.Provider value={state.dragging}>{children}</DraggingContext.Provider>
                  </div>
                )}
              </SdkDrawerContent>
            </Sheet>
            {collapse === 'fab' && customFabs === 0 ? <Fab /> : null}
          </div>
        </ThemeScopeContext.Provider>
      </PartsContext.Provider>
    </FloatingSheetContext.Provider>
  );
}

export type FloatingSheetBodyProps = ComponentProps<'div'>;

/** The growing region, laid out at the sheet's full grown height behind a window that slides with the drag, so its
    content never reflows mid-gesture. Out of reach (`inert`) while the sheet rests on its cap and foot alone. */
export function FloatingSheetBody({ className, children, ...props }: FloatingSheetBodyProps) {
  const { bodyAlign, closedWindow } = useParts('FloatingSheetBody');
  const dragging = useContext(DraggingContext);
  return (
    // The visible window between the cap and the foot; it grows with the surface. ck-floating-sheet__reveal stays as
    // a hook for the peek-mask rules in styles.css.
    <div
      data-slot="floating-sheet-reveal"
      inert={(closedWindow && !dragging) || undefined}
      className="ck-floating-sheet__reveal relative min-h-0 w-full flex-1 overflow-hidden"
    >
      {/* `end` pins it to the foot so a transcript grows upward out of the cap; `start` keeps a card's header against
          the cap. ck-floating-sheet__body stays as a hook for the child rules in styles.css. */}
      <div
        data-slot="floating-sheet-body"
        className={cn(
          'ck-floating-sheet__body absolute right-0 left-0 flex h-(--ck-sheet-body-height) min-w-0 flex-col overflow-hidden',
          bodyAlign === 'end' ? 'bottom-0 justify-end' : 'top-0',
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </div>
  );
}

export type FloatingSheetFooterProps = ComponentProps<'div'>;

/** Pinned to the bottom of the surface at every height: a composer, action buttons. A hairline above it appears as
    the sheet grows. */
export function FloatingSheetFooter({ className, ref, ...props }: FloatingSheetFooterProps) {
  const { setFoot } = useParts('FloatingSheetFooter');
  return (
    <div
      ref={(el) => {
        setFoot(el);
        if (typeof ref === 'function') ref(el);
        else if (ref) ref.current = el;
      }}
      data-slot="floating-sheet-footer"
      className={cn(
        'relative z-2 min-w-0 shrink-0 border-t border-[color:color-mix(in_srgb,var(--foreground)_calc(var(--ck-sheet-divider-alpha,0)*100%),transparent)]',
        className,
      )}
      {...props}
    />
  );
}

export type FloatingSheetFabProps = Omit<ComponentProps<typeof SdkButton>, 'children' | 'className' | 'style' | 'onClick'> & {
  /** The edge of the host the FAB rests on. Default `bottom`. */
  side?: FloatingSheetFabSide;
  /** Where along that edge. Default `center`. */
  align?: FloatingSheetFabAlign;
  /** Runs before the sheet unfolds; `event.preventDefault()` keeps it folded. */
  onClick?: (event: ReactMouseEvent<HTMLElement>) => void;
  /** The FAB's face, usually an icon. Default: a dot in the accent colour. */
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
};

/* The FAB itself, wherever it is written: placed on the host's edge, folded and out of reach until the sheet is. */
function Fab({ side = 'bottom', align = 'center', className, style, children, onClick, 'aria-label': ariaLabel, ...props }: FloatingSheetFabProps) {
  const { variant, label, minimized, restore } = useParts('FloatingSheetFab');
  return (
    <SdkButton
      data-floating-sheet-fab=""
      data-folded={!minimized || undefined}
      aria-label={ariaLabel ?? `Open ${label}`}
      // Not there until the sheet folds into it: out of the tab order and the accessibility tree.
      inert={!minimized || undefined}
      aria-hidden={!minimized || undefined}
      className={cn(floatingSheetFabVariants({ variant, side, align }), className)}
      style={{ ...(variant === 'glass' ? GLASS_BLUR : null), ...style }}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) restore(event.nativeEvent);
      }}
      {...props}
    >
      {children ?? <span className="block size-2.5 rounded-full bg-primary" />}
    </SdkButton>
  );
}

/** The round button the sheet folds into with `collapse="fab"` (a drag below rest); pressing it brings the resting
    sheet back. Write it inside the FloatingSheet to give it a face, a name or a place; it renders on the host's
    `side` edge (default `bottom`) at `align` along it (default `center`). Without one, the sheet shows a default FAB named "Open" + the sheet's name. */
export function FloatingSheetFab(props: FloatingSheetFabProps) {
  const { root, collapse, claimFab } = useParts('FloatingSheetFab');
  useLayoutEffect(claimFab, []);
  if (collapse !== 'fab' || !root) return null;
  return createPortal(<Fab {...props} />, root);
}

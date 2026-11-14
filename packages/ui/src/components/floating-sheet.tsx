'use client';
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react';
import {
  DrawerContent as SdkDrawerContent,
  DrawerHandle as SdkDrawerHandle,
  createDrawerController,
  type DrawerOpenChangeReason,
  type DrawerSnapPointChangeReason,
  type SnapPoint,
} from '@ui-sdk/react/drawer';
import { Button as SdkButton } from '@ui-sdk/react/button';
import { supportsTopLayer, type ChangeDetails } from '@ui-sdk/core';
import { cva } from 'class-variance-authority';
import { themeScopeClass, useAppearance, useChromeHidden } from '@/lib/theme';
import { collectSlots, defineSlot } from '@/lib/container';
import { bindScrollEdge } from '@/lib/scroll-edge';
import { cn } from '@/lib/utils';
import { Sheet, SheetBackdrop } from '@/components/ui/sheet';

export type FloatingSheetFabPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'center-left'
  | 'center-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

/** Translucent glass over dark content, or an opaque card like a system sheet. */
export type FloatingSheetAppearance = 'glass' | 'sheet';
/** Colour scheme of the surface: `dark` / `light` put the bl-theme's `sheet` scope on it in that appearance (the
    host's background and accent stay); `auto` inherits the host's theme. */
export type FloatingSheetTone = 'auto' | 'dark' | 'light';

/** What `onOpenChange` and `onVisibleChange` receive: UI SDK's change details from the sheet underneath. */
export type FloatingSheetChangeDetails = ChangeDetails<DrawerSnapPointChangeReason | DrawerOpenChangeReason>;

export interface FloatingSheetContextValue {
  /** Whether the sheet has grown to its full height. */
  open: boolean;
  setOpen: (open: boolean) => void;
  /** The resting stop: 0 at the peek, 1 fully grown, a detent in between. The live value while dragging is the
      `--fs-grown` CSS variable on the surface. */
  progress: number;
  /** Height of body visible while closed. */
  peek: number;
  /** Whether the surface has been folded into its FAB. */
  minimized: boolean;
  setMinimized: (minimized: boolean) => void;
}

const FloatingSheetContext = createContext<FloatingSheetContextValue | null>(null);

export function useFloatingSheet(): FloatingSheetContextValue {
  const value = useContext(FloatingSheetContext);
  if (!value) {
    throw new Error('useFloatingSheet must be used within <FloatingSheet>');
  }
  return value;
}

/** Whether floating chrome (a FloatingSheet, a FloatingChat) should hide: the shared chrome state says the bars are
    hidden, or `scrollRef` was scrolled down (it returns on scroll-up and at the top). Always false when off. */
export function useHideOnScroll(hideOnScroll: boolean, scrollRef?: RefObject<HTMLElement | null>): boolean {
  const chromeHidden = useChromeHidden();
  const [scrolledDown, setScrolledDown] = useState(false);
  useEffect(() => {
    const scroller = scrollRef?.current;
    if (!scroller || !hideOnScroll) {
      setScrolledDown(false);
      return;
    }
    // The kit's one scroll follower: back at the top it shows, and otherwise it follows the scroll's direction.
    return bindScrollEdge(scroller, {
      threshold: () => 3,
      onChange: (scrolled) => {
        if (!scrolled) setScrolledDown(false);
      },
      onScroll: (y, dy) => {
        if (y < 4) setScrolledDown(false);
        else if (dy > 3) setScrolledDown(true);
        else if (dy < -3) setScrolledDown(false);
      },
    });
  }, [scrollRef, hideOnScroll]);
  return hideOnScroll && (chromeHidden || scrolledDown);
}

/** Height of the grabber cap row at the top of the surface. */
const CAP_HEIGHT = 18;
/** The surface's top and bottom borders are outside its flex children. */
const BORDER_HEIGHT = 2;

/* The kit's tray spring is the Sheet's default physics, so the surface settles like every other sheet. */

/* One surface at the top of UI SDK's bottom Drawer. The Drawer moves (translates) a transparent panel as tall as the
   fully grown sheet and writes how far it is open (`--drawer-progress`) on it; the surface derives its geometry from
   that every frame — it grows taller, wider and squarer as it rises past the peek (`--fs-grown`, 0 → 1), and below
   the peek it keeps its resting size and slides away. The cap, the growing body and the foot are rows of one rounded
   rect, so there is no second card to fade in and no seam under the cap.
   ck-floating-sheet__surface stays as a hook for the peek-mask rules in styles.css. */
const surfaceBase =
  'ck-floating-sheet__surface pointer-events-auto absolute top-0 left-1/2 box-border flex h-[max(calc(var(--fs-rest)*1px_-_var(--fs-gutter)*1px),calc(var(--fs-extent)*1px_-_var(--fs-gutter)*1px*(1_-_var(--fs-grown))))] w-[max(52px,calc(100%_-_var(--fs-gutter)*2px*(1_-_var(--fs-grown))))] -translate-x-1/2 flex-col overflow-hidden rounded-t-[calc(var(--fs-radius)*1px*(1_-_var(--fs-grown)*var(--fs-square)))] rounded-b-[calc(var(--fs-radius-bottom)*1px*(1_-_var(--fs-grown)))] border transition-[background-color,border-color,box-shadow,backdrop-filter,color,translate,opacity] duration-spring-smooth ease-spring-smooth motion-reduce:transition-none';
/* The material: translucent glass (a highlight gradient over the tone's surface colour) or an opaque system sheet
   (card colour, no glass highlights, a soft shadow that deepens as it grows). The FAB wears the same. */
const sheetMaterial = {
  glass:
    'border-[color:rgba(var(--ck-sheet-line),var(--ck-sheet-border-alpha,.12))] bg-[color:rgba(var(--ck-sheet-surface),var(--ck-sheet-bg-alpha,.28))] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--color-white)_8%,transparent),color-mix(in_srgb,var(--color-white)_1.8%,transparent)_34%,color-mix(in_srgb,var(--color-white)_2.6%,transparent))] [box-shadow:inset_0_1px_0_color-mix(in_srgb,var(--color-white)_14%,transparent),inset_0_-1px_0_color-mix(in_srgb,var(--color-white)_3%,transparent),0_2px_10px_color-mix(in_srgb,var(--color-black)_12%,transparent),0_var(--ck-sheet-shadow-y,14px)_var(--ck-sheet-shadow-blur,34px)_-12px_rgba(0,0,0,var(--ck-sheet-shadow-alpha,.22))]',
  sheet:
    'border-[color:rgba(var(--ck-sheet-line),calc(var(--ck-sheet-border-alpha,.12)_*_.5))] bg-card [box-shadow:0_-1px_0_rgba(var(--ck-sheet-line),.04),0_2px_10px_color-mix(in_srgb,var(--color-black)_8%,transparent),0_var(--ck-sheet-shadow-y,14px)_var(--ck-sheet-shadow-blur,34px)_-12px_rgba(0,0,0,var(--ck-sheet-shadow-alpha,.22))]',
};

/** The surface, resting or hidden by scrolling. */
export const floatingSheetSurfaceVariants = cva(surfaceBase, {
  variants: {
    appearance: sheetMaterial,
    /** Hidden by scrolling: slid below the edge, faded out and out of reach. */
    hidden: { true: 'pointer-events-none translate-y-[calc(100%_+_44px)] opacity-0', false: '' },
  },
  defaultVariants: { appearance: 'glass', hidden: false },
});

/** The FAB the sheet folds into, at one of eight spots (bottom-center keeps 20px from the host edge even when
    docked). It grows in as the sheet goes. */
export const floatingSheetFabVariants = cva(
  'pointer-events-auto absolute z-1 grid size-[52px] cursor-pointer place-items-center rounded-[50%] border p-0 text-foreground transition-[opacity,scale] duration-spring-snappy ease-spring-snappy outline-none focus-visible:ring-2 focus-visible:ring-primary/60 data-folded:pointer-events-none data-folded:scale-60 data-folded:opacity-0 motion-reduce:transition-none',
  {
    variants: {
      appearance: sheetMaterial,
      position: {
        'top-left': 'top-(--fs-fab-gutter) left-(--fs-fab-gutter)',
        'top-center': 'top-(--fs-fab-gutter) left-1/2 -translate-x-1/2',
        'top-right': 'top-(--fs-fab-gutter) right-(--fs-fab-gutter)',
        'center-left': 'top-1/2 left-(--fs-fab-gutter) -translate-y-1/2',
        'center-right': 'top-1/2 right-(--fs-fab-gutter) -translate-y-1/2',
        'bottom-left': 'bottom-(--fs-fab-gutter) left-(--fs-fab-gutter)',
        'bottom-center': 'bottom-[max(var(--fs-fab-gutter),20px)] left-1/2 -translate-x-1/2',
        'bottom-right': 'right-(--fs-fab-gutter) bottom-(--fs-fab-gutter)',
      },
    },
    defaultVariants: { appearance: 'glass', position: 'bottom-center' },
  },
);

/** The layer, and the layer host the sheet lives in (so it fills this box, not the app). --ck-sheet-surface /
    --ck-sheet-line are the RGB triplets the glass mixes its alphas into: dark glass unless the tone is light.
    ck-floating-sheet keys the body / peek-mask rules in styles.css. */
export const floatingSheetVariants = cva(
  'ck-floating-sheet pointer-events-none absolute inset-0 z-40 overflow-clip text-foreground [font-family:var(--bl-font,-apple-system,BlinkMacSystemFont,"SF_Pro_Text",sans-serif)]',
  {
    variants: {
      tone: {
        auto: '[--ck-sheet-line:255,255,255] [--ck-sheet-surface:18,18,22]',
        dark: '[--ck-sheet-line:255,255,255] [--ck-sheet-surface:18,18,22]',
        light: '[--ck-sheet-line:0,0,0] [--ck-sheet-surface:250,250,252]',
      },
    },
    defaultVariants: { tone: 'auto' },
  },
);

/** The theme-scope props for a floating chat surface's tone: the bl-theme's `sheet` scope in that appearance, or
    nothing for `auto` (the host's theme carries through). */
export function sheetToneProps(tone: FloatingSheetTone): { 'data-theme-scope'?: 'sheet'; className?: string } {
  return tone === 'auto' ? {} : { 'data-theme-scope': 'sheet', className: themeScopeClass(tone) };
}

/** A size as pixels, or (`'52%'`) a share of the host's height. */
export type FloatingSheetSize = number | `${number}%`;

export interface FloatingSheetProps {
  /** Controlled state for the fully grown sheet. */
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean, details: FloatingSheetChangeDetails) => void;
  /**
   * Height of body kept visible above the foot while closed, so a summary (the newest chat
   * reply, an order status) peeks out. `0` rests on the foot alone. `'52%'` sizes the whole resting sheet
   * (cap and foot included) as a share of the host instead.
   */
  peek?: FloatingSheetSize;
  /** Space left above the sheet when fully grown, so the page behind still shows (and the top corners stay round). */
  topGap?: FloatingSheetSize;
  /**
   * Make it a bottom sheet that can be put away: dragging below the resting height slides it off the edge
   * (`onVisibleChange(false, details)`) instead of folding it into a FAB. Show it again with `visible`.
   */
  dismissible?: boolean;
  /** Whether a `dismissible` sheet is on screen. Pass it with `onVisibleChange` to control it. */
  visible?: boolean;
  defaultVisible?: boolean;
  onVisibleChange?: (visible: boolean, details: FloatingSheetChangeDetails) => void;
  /** Inset from the host edges while closed. `0` docks the sheet edge to edge like a system sheet. */
  gutter?: number;
  /** Corner radius while closed. Grows square as the sheet fills the host. */
  radius?: number;
  appearance?: FloatingSheetAppearance;
  /**
   * Colour scheme of the surface. Defaults to the ambient `AppearanceProvider` value, else `auto`
   * (inherit the host's --bl-* tokens).
   */
  tone?: FloatingSheetTone;
  /**
   * Which edge of the body the visible window is anchored to. `end` pins the body to the
   * foot so a transcript grows upward out of the cap; `start` keeps a card's header under
   * the cap and lets the rest emerge below as the sheet grows.
   */
  bodyAlign?: 'start' | 'end';
  /**
   * Extra resting heights between the peek and full, as fractions (0–1) of the fully grown body — e.g.
   * `[0.5]` for a half-height detent — or (`'70%'`) as a share of the host. A drag releases to whichever stop its
   * velocity carries it nearest.
   */
  detents?: (number | `${number}%`)[];
  /** Allow dragging below the resting height to fold the sheet into a FAB. */
  minimizable?: boolean;
  /** Resting position of the FAB. */
  fabPosition?: FloatingSheetFabPosition;
  /** Icon shown in the FAB; falls back to the `Fab` slot. */
  fabIcon?: ReactNode;
  /** Follow NavigationStack/List scroll chrome, like TabBar. */
  hideOnScroll?: boolean;
  /** A scroller whose direction also hides and restores the surface while it is resting. */
  scrollRef?: RefObject<HTMLElement | null>;
  /** Dim the host behind the sheet as it grows. */
  scrim?: boolean;
  /** Accessible name of the sheet. */
  label?: string;
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
 * into the full page: UI SDK's Drawer with snap points at the peek, any detents and full height, modal only above
 * the peek (`modalAbove`), so the page stays usable beside a resting sheet. Drag it (or press the cap) to grow it;
 * drag down past the resting height to fold it into a FAB, or (`dismissible`) slide it away. Escape and the scrim
 * bring a grown sheet back to rest. The `Body` slot is the growing region and the `Foot` slot stays pinned at the
 * bottom (a composer, actions, nothing at all).
 */
export function FloatingSheet({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  peek: requestedPeek = 0,
  topGap = 0,
  dismissible = false,
  visible: controlledVisible,
  defaultVisible = true,
  onVisibleChange,
  gutter = 20,
  radius = 28,
  appearance = 'glass',
  tone: toneProp,
  bodyAlign = 'start',
  detents,
  minimizable = true,
  fabPosition = 'bottom-center',
  fabIcon,
  hideOnScroll = true,
  scrollRef,
  scrim = true,
  label = 'Sheet',
  children,
  className,
  surfaceClassName,
  style,
}: FloatingSheetProps) {
  const ambient = useAppearance();
  const tone: FloatingSheetTone = toneProp ?? ambient ?? 'auto';
  const toneProps = sheetToneProps(tone);
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const [foot, setFoot] = useState<HTMLDivElement | null>(null);
  const [height, setHeight] = useState(0);
  const [footHeight, setFootHeight] = useState(0);
  const [minimized, setMinimized] = useState(false);
  const [internalVisible, setInternalVisible] = useState(defaultVisible);
  const visible = controlledVisible ?? internalVisible;
  // The resting stop, as an index into `stops` (0 is the peek, the last is fully grown).
  const [stop, setStop] = useState(defaultOpen ? Number.POSITIVE_INFINITY : 0);
  const [controller] = useState(() => createDrawerController());

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

  const dockHeight = footHeight + CAP_HEIGHT;
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
  const between = (detents ?? [])
    .map((d) => chrome + (typeof d === 'string' ? shareOfHost(d, height, chrome) : Math.round(Math.max(0, Math.min(1, d)) * maxReveal)))
    .filter((px) => px > rest + 1 && px < full - 1)
    .sort((a, b) => a - b);
  // Before the first measurement there is nothing to rest on: the sheet stays rendered but closed (`keepMounted`).
  const measured = full > 0;
  const stops = measured ? [rest, ...between, full].map((px) => Math.max(2, Math.round(px))) : [1];
  const last = stops.length - 1;
  const at = Math.min(stop, last);
  const open = controlledOpen ?? at === last;
  // A controlled `open` wins: open is fully grown; closed leaves the sheet on its detent, or at the peek.
  const resting = controlledOpen === undefined ? at : controlledOpen ? last : at === last ? 0 : at;
  const shown = (dismissible ? visible : !minimized) && measured;
  const progress = last > 0 ? (stops[resting] - stops[0]) / (stops[last] - stops[0]) : 0;

  const setOpen = (next: boolean) => {
    if (next === open) return;
    controller.setSnapPoint(stops[next ? last : 0], { reason: 'imperative' });
  };

  // The drawer settled on another stop: the user dragged it, pressed or arrowed the cap, or code moved it.
  const onSnapPointChange = (snapPoint: SnapPoint, details: FloatingSheetChangeDetails) => {
    const px = typeof snapPoint === 'number' ? snapPoint : Number.parseFloat(String(snapPoint));
    const index = stops.reduce((best, s, i) => (Math.abs(s - px) < Math.abs(stops[best] - px) ? i : best), 0);
    if ((index === last) !== open) onOpenChange?.(index === last, details);
    if (!details.canceled) setStop(index);
  };

  // The drawer wants to close. Only a drag below the peek puts the sheet away (or folds it into its FAB); Escape and
  // the scrim bring a grown sheet back to rest instead.
  const onDrawerOpenChange = (next: boolean, details: FloatingSheetChangeDetails) => {
    if (next) return;
    if (details.reason === 'swipe' && dismissible) {
      onVisibleChange?.(false, details);
      if (details.canceled) return;
      if (controlledVisible === undefined) setInternalVisible(false);
      setStop(0);
      return;
    }
    if (details.reason === 'swipe' && minimizable) {
      setMinimized(true);
      setStop(0);
      return;
    }
    details.cancel();
    if (resting > 0) controller.setSnapPoint(stops[0], { reason: 'imperative' });
  };

  const slots = collectSlots(children);
  const hasFoot = slots.foot != null && slots.foot !== false;
  // A sheet that shows only its cap and foot gets out of the way of a scroll; a peeking or risen one stays.
  const hidden = useHideOnScroll(hideOnScroll, scrollRef) && resting === 0 && peek === 0;
  const restAlpha = peek > 0 ? 0.5 : 0.28;
  const glass = appearance === 'glass';
  const body = maxReveal;

  const value: FloatingSheetContextValue = {
    open,
    setOpen,
    progress,
    peek,
    minimized,
    setMinimized: (next) => {
      setMinimized(next);
      if (next) setStop(0);
    },
  };

  return (
    <FloatingSheetContext.Provider value={value}>
      <div
        ref={setRoot}
        data-slot="floating-sheet"
        // The sheet's layer host (with `contain: layout` in its classes): the drawer fills it and is modal only to
        // it. In the markup, so a sheet that's open from the start already sees its host.
        data-layer-host=""
        data-appearance={appearance}
        data-tone={tone === 'auto' ? undefined : tone}
        data-theme-scope={toneProps['data-theme-scope']}
        data-body-align={bodyAlign}
        data-open={open || undefined}
        data-expanded={(resting > 0 || peek > 0) || undefined}
        data-minimized={minimized || undefined}
        data-dismissed={(dismissible && !visible) || undefined}
        className={cn(floatingSheetVariants({ tone }), '[contain:layout]', toneProps.className, className)}
        style={{ '--fs-fab-gutter': `${gutter}px`, ...style } as CSSProperties}
      >
        {/* Rendered in place, inside this host (a portal into it would remount the Body once the host's element
            exists); only a browser without the top layer needs the explicit container, or UI SDK would use the body. */}
        <Sheet
          side="bottom"
          container={supportsTopLayer() ? null : root}
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
                data-open={open || undefined}
                data-expanded={(resting > 0 || peek > 0) || undefined}
                data-peeking={(peek > 0 && resting === 0) || undefined}
                data-dragging={state.dragging || undefined}
                data-hidden={hidden || undefined}
                className={cn(floatingSheetSurfaceVariants({ appearance, hidden }), surfaceClassName)}
                // backdrop-filter stays inline so the production CSS optimizer cannot rewrite the unprefixed
                // property out of Safari's bundle.
                style={{
                  '--fs-gutter': gutter,
                  '--fs-radius': radius,
                  '--fs-radius-bottom': gutter > 0 ? radius : 0,
                  '--fs-square': gapAbove > 0 ? 0 : 1,
                  // The material firms up as the sheet grows.
                  '--ck-sheet-border-alpha': 'calc(.12 + .04 * var(--fs-grown))',
                  '--ck-sheet-bg-alpha': `calc(${restAlpha} + ${0.58 - restAlpha} * var(--fs-grown))`,
                  '--ck-sheet-shadow-y': 'calc(14px + 20px * var(--fs-grown))',
                  '--ck-sheet-shadow-blur': 'calc(34px + 30px * var(--fs-grown))',
                  '--ck-sheet-shadow-alpha': 'calc(.22 + .18 * var(--fs-grown))',
                  '--ck-sheet-divider-alpha': 'calc(.09 * var(--fs-grown))',
                  '--ck-sheet-body-height': `${body}px`,
                  ...(glass ? { backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' } : null),
                } as CSSProperties}
              >
                {/* The cap: UI SDK's handle, so a press steps to the next stop and the arrow keys, Home and End
                    move through them. */}
                <SdkDrawerHandle
                  data-open={open || undefined}
                  aria-label={open ? 'Collapse' : 'Expand'}
                  className="group/cap box-border grid h-[18px] w-full shrink-0 cursor-grab touch-none place-items-center border-0 bg-transparent p-0 text-inherit focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary active:cursor-grabbing"
                >
                  <span
                    data-slot="floating-sheet-grip"
                    className={cn(
                      'block h-[4px] rounded-[999px] [transition:width_var(--duration-spring-bouncy)_var(--ease-spring-bouncy),background-color_var(--duration-spring-snappy)_var(--ease-spring-snappy)] motion-reduce:[transition:none]',
                      open
                        ? 'w-[40px] bg-muted-foreground'
                        : 'w-[32px] bg-tertiary-foreground group-hover/cap:w-[40px] group-hover/cap:bg-muted-foreground group-focus-visible/cap:w-[40px] group-focus-visible/cap:bg-muted-foreground',
                    )}
                  />
                </SdkDrawerHandle>
                {/* The visible window between the cap and the foot; it grows with the surface.
                    ck-floating-sheet__reveal stays as a hook for the peek-mask rules in styles.css. */}
                <div
                  data-slot="floating-sheet-reveal"
                  inert={(resting === 0 && peek === 0 && !state.dragging) || undefined}
                  className="ck-floating-sheet__reveal relative min-h-0 w-full flex-1 overflow-hidden"
                >
                  {/* Laid out at its full grown height so the window slides over a stable body instead of
                      reflowing on every drag frame. `end` pins it to the foot so a transcript grows upward out of
                      the cap; `start` keeps a card's header against the cap. ck-floating-sheet__body stays as a hook
                      for the child rules in styles.css (and hosts that style the body's child). */}
                  <div
                    data-slot="floating-sheet-body"
                    className={cn(
                      'ck-floating-sheet__body absolute right-0 left-0 flex h-(--ck-sheet-body-height) min-w-0 flex-col overflow-hidden',
                      bodyAlign === 'end' ? 'bottom-0 justify-end' : 'top-0',
                    )}
                  >
                    {slots.body}
                  </div>
                </div>
                <div
                  ref={setFoot}
                  data-slot="floating-sheet-foot"
                  className={cn(
                    'relative min-w-0 shrink-0',
                    hasFoot ? 'border-t border-[color:rgba(var(--ck-sheet-line),var(--ck-sheet-divider-alpha,0))]' : 'border-t-0',
                  )}
                  data-empty={hasFoot ? undefined : true}
                >
                  {slots.foot}
                </div>
              </div>
            )}
          </SdkDrawerContent>
        </Sheet>
        {!dismissible && minimizable ? (
          <SdkButton
            data-floating-sheet-fab=""
            data-folded={!minimized || undefined}
            aria-label="Open"
            inert={!minimized || undefined}
            className={floatingSheetFabVariants({ appearance, position: fabPosition })}
            style={glass ? { backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' } : undefined}
            onClick={() => {
              setStop(0);
              setMinimized(false);
            }}
          >
            {fabIcon ?? slots.fab ?? <span className="block size-[10px] rounded-[50%] bg-primary" />}
          </SdkButton>
        ) : null}
      </div>
    </FloatingSheetContext.Provider>
  );
}

FloatingSheet.Body = defineSlot('body');
FloatingSheet.Foot = defineSlot('foot');
FloatingSheet.Fab = defineSlot('fab');
FloatingSheet.Context = FloatingSheetContext;
FloatingSheet.useFloatingSheet = useFloatingSheet;

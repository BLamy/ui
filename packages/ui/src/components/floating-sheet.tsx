import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react';
import { Button } from 'react-aria-components';
import { cva } from 'class-variance-authority';
import { themeScopeClass, useAppearance, useChromeHidden } from '@/lib/theme';
import { collectSlots, defineSlot } from '@/lib/container';
import { springCss } from '@/lib/motion';
import { useSheetDrag } from '@/lib/sheet-drag';
import { cn } from '@/lib/utils';

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

export interface FloatingSheetContextValue {
  /** Whether the sheet has grown to its full height. */
  open: boolean;
  setOpen: (open: boolean) => void;
  /** 0 at rest (foot plus peek), 1 when the surface fills the host. */
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

/** Height of the grabber cap row at the top of the surface. */
const CAP_HEIGHT = 18;
/** The surface's top and bottom borders are outside its flex children. */
const BORDER_HEIGHT = 2;
/** Diameter of the minimized FAB. */
const FAB_SIZE = 52;

/* One surface, inset from the host edges by the gutter. The cap, the growing body and the foot are rows of
   the same rounded rect, so opening the sheet only makes that rect taller — there is no second card to fade
   in and no seam under the cap. Geometry comes from the --ck-sheet-* variables the gesture writes.
   ck-floating-sheet__surface stays as a hook for the peek-mask rules in styles.css. */
const surfaceBase =
  'ck-floating-sheet__surface pointer-events-auto absolute bottom-[var(--ck-sheet-bottom-gutter,20px)] left-1/2 z-2 box-border flex h-[var(--ck-sheet-height,auto)] w-[var(--ck-sheet-width,calc(100%_-_40px))] min-w-0 flex-col overflow-hidden rounded-t-[var(--ck-sheet-radius,28px)] rounded-b-[var(--ck-sheet-radius-bottom,28px)] border motion-reduce:animate-none motion-reduce:[transition:none]!';
/* Motion. The sheet's geometry (height, width, corners, gutter) is written every frame by the spring drag —
   it follows the finger, then springs to rest with the release velocity — so those only CSS-transition when
   something else changes them (a gutter or radius prop). Placement (hide on scroll, the FAB corner) and the
   look (glass ↔ card, tone) cross on the spring curves, so an appearance change morphs rather than swaps. */
const GEOMETRY = ['width', 'height', 'bottom', 'border-radius'];
const PLACEMENT = ['left', 'right', 'top', 'transform'];
const LOOK = ['background-color', 'border-color', 'box-shadow', 'backdrop-filter', 'color'];
const surfaceTransition = (driving: boolean) =>
  [springCss(PLACEMENT, 'smooth'), springCss(LOOK, 'smooth'), springCss('opacity', 'snappy'), driving ? '' : springCss(GEOMETRY, 'tray')]
    .filter(Boolean)
    .join(', ');
/** The surface: translucent glass (a highlight gradient over the tone's surface colour) or an opaque system sheet
    (card colour, no glass highlights, a soft shadow that deepens as it grows) — resting, hidden by scrolling, or
    folded into its FAB at one of eight spots (bottom-center keeps 20px from the host edge even when docked). */
export const floatingSheetSurfaceVariants = cva(surfaceBase, {
  variants: {
    appearance: {
      glass:
        'border-[color:rgba(var(--ck-sheet-line),var(--ck-sheet-border-alpha,.12))] bg-[color:rgba(var(--ck-sheet-surface),var(--ck-sheet-bg-alpha,.28))] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--color-white)_8%,transparent),color-mix(in_srgb,var(--color-white)_1.8%,transparent)_34%,color-mix(in_srgb,var(--color-white)_2.6%,transparent))] [box-shadow:inset_0_1px_0_color-mix(in_srgb,var(--color-white)_14%,transparent),inset_0_-1px_0_color-mix(in_srgb,var(--color-white)_3%,transparent),0_2px_10px_color-mix(in_srgb,var(--color-black)_12%,transparent),0_var(--ck-sheet-shadow-y,14px)_var(--ck-sheet-shadow-blur,34px)_-12px_rgba(0,0,0,var(--ck-sheet-shadow-alpha,.22))]',
      sheet:
        'border-[color:rgba(var(--ck-sheet-line),calc(var(--ck-sheet-border-alpha,.12)_*_.5))] bg-card [box-shadow:0_-1px_0_rgba(var(--ck-sheet-line),.04),0_2px_10px_color-mix(in_srgb,var(--color-black)_8%,transparent),0_var(--ck-sheet-shadow-y,14px)_var(--ck-sheet-shadow-blur,34px)_-12px_rgba(0,0,0,var(--ck-sheet-shadow-alpha,.22))]',
    },
    placement: {
      resting: '[transform:translateX(-50%)]',
      hidden: '[transform:translate(-50%,calc(100%_+_44px))]',
      'top-left': 'top-[var(--ck-sheet-gutter,20px)] right-auto bottom-auto left-[var(--ck-sheet-gutter,20px)] [transform:none]',
      'top-center': 'top-[var(--ck-sheet-gutter,20px)] right-auto bottom-auto left-1/2 [transform:translateX(-50%)]',
      'top-right': 'top-[var(--ck-sheet-gutter,20px)] right-[var(--ck-sheet-gutter,20px)] bottom-auto left-auto [transform:none]',
      'center-left': 'top-1/2 right-auto bottom-auto left-[var(--ck-sheet-gutter,20px)] [transform:translateY(-50%)]',
      'center-right': 'top-1/2 right-[var(--ck-sheet-gutter,20px)] bottom-auto left-auto [transform:translateY(-50%)]',
      'bottom-left': 'top-auto right-auto bottom-[var(--ck-sheet-gutter,20px)] left-[var(--ck-sheet-gutter,20px)] [transform:none]',
      'bottom-center': 'top-auto right-auto bottom-[max(var(--ck-sheet-gutter,20px),20px)] left-1/2 [transform:translateX(-50%)]',
      'bottom-right': 'top-auto right-[var(--ck-sheet-gutter,20px)] bottom-[var(--ck-sheet-gutter,20px)] left-auto [transform:none]',
    },
    /** Hidden by scrolling: faded out and out of reach. */
    hidden: { true: 'pointer-events-none opacity-0', false: '' },
  },
  defaultVariants: { appearance: 'glass', placement: 'resting', hidden: false },
});

/** The layer. --ck-sheet-surface / --ck-sheet-line are the RGB triplets the glass mixes its alphas into: dark glass
    unless the tone is light. ck-floating-sheet keys the body / peek-mask rules in styles.css. */
export const floatingSheetVariants = cva(
  'ck-floating-sheet pointer-events-none absolute inset-0 z-40 text-foreground [font-family:var(--bl-font,-apple-system,BlinkMacSystemFont,"SF_Pro_Text",sans-serif)]',
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

export interface FloatingSheetProps {
  /** Controlled state for the fully grown sheet. */
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /**
   * Height of body kept visible above the foot while closed, so a summary (the newest chat
   * reply, an order status) peeks out. `0` rests on the foot alone.
   */
  peek?: number;
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
   * `[0.5]` for a half-height detent. A drag releases to whichever stop its velocity carries it nearest.
   */
  detents?: number[];
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
  /** Accessible name for the body region. */
  label?: string;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/**
 * A floating surface that fills its positioned host as a pointer-transparent layer and
 * grows from a resting card into the full page. Drag the cap up to grow it, down past the
 * resting height to fold it into a FAB. The `Body` slot is the growing region and the `Foot`
 * slot stays pinned at the bottom (a composer, actions, nothing at all).
 */
export function FloatingSheet({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  peek: requestedPeek = 0,
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
  style,
}: FloatingSheetProps) {
  const ambient = useAppearance();
  const tone: FloatingSheetTone = toneProp ?? ambient ?? 'auto';
  const toneProps = sheetToneProps(tone);
  const rootRef = useRef<HTMLDivElement>(null);
  const footRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(430);
  const [height, setHeight] = useState(800);
  const [footHeight, setFootHeight] = useState(0);
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const [minimized, setMinimized] = useState(false);
  const [scrollHidden, setScrollHidden] = useState(false);
  const chromeHidden = useChromeHidden();
  const open = controlledOpen ?? uncontrolledOpen;
  const bodyId = useId();

  const setOpen = (next: boolean) => {
    if (controlledOpen == null) setUncontrolledOpen(next);
    onOpenChange?.(next);
  };

  useEffect(() => {
    const root = rootRef.current;
    const foot = footRef.current;
    if (!root) return;
    const measure = () => {
      setWidth(root.offsetWidth);
      setHeight(root.offsetHeight);
      setFootHeight(foot?.offsetHeight ?? 0);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    if (foot) observer.observe(foot);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const scroller = scrollRef?.current;
    if (!scroller || !hideOnScroll) {
      setScrollHidden(false);
      return;
    }
    let previous = scroller.scrollTop;
    const onScroll = () => {
      const next = scroller.scrollTop;
      const delta = next - previous;
      previous = next;
      if (next < 4) setScrollHidden(false);
      else if (delta > 3) setScrollHidden(true);
      else if (delta < -3) setScrollHidden(false);
    };
    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => scroller.removeEventListener('scroll', onScroll);
  }, [scrollRef, hideOnScroll]);

  const dockHeight = footHeight + CAP_HEIGHT;
  // Fully grown, the cap touches the host's top edge and the foot its bottom edge.
  const maxReveal = Math.max(0, height - dockHeight - BORDER_HEIGHT);
  // The peek can never take more than three quarters of the host, or there is nothing to grow into.
  const peek = Math.max(0, Math.min(requestedPeek, maxReveal * 0.75));
  // The cap gesture (grow, snap, fold into the FAB) is the shared sheet drag.
  const sheetDrag = useSheetDrag({
    open,
    onOpenChange: setOpen,
    peek,
    maxReveal,
    detents: detents?.map((f) => Math.round(Math.max(0, Math.min(1, f)) * maxReveal)),
    minimizable,
    minimized,
    onMinimizedChange: setMinimized,
  });

  // `reveal` / `minimize` are the spring's current values (the finger's while dragging).
  const { reveal, dragging, settling } = sheetDrag;
  const driving = dragging || settling;
  const expanded = reveal > 0;
  // Growth is measured from the resting height, so a peeking sheet keeps its compact shape
  // and only starts turning into the full page once it is dragged past the peek.
  const grown = maxReveal > peek ? Math.max(0, (reveal - peek) / (maxReveal - peek)) : 0;
  const minimizeProgress = sheetDrag.minimize;
  const collapsedWidth = Math.max(FAB_SIZE, width - gutter * 2);
  const expandedWidth = collapsedWidth + (width - collapsedWidth) * grown;
  const overlayWidth = expandedWidth + (FAB_SIZE - expandedWidth) * minimizeProgress;
  const expandedHeight = dockHeight + reveal + BORDER_HEIGHT;
  const overlayHeight = expandedHeight + (FAB_SIZE - expandedHeight) * minimizeProgress;
  const expandedRadius = radius * (1 - grown);
  const overlayRadius = expandedRadius + (FAB_SIZE / 2 - expandedRadius) * minimizeProgress;
  const bottomRadius = gutter > 0 ? overlayRadius : minimizeProgress * (FAB_SIZE / 2);

  const closeRef = useRef(() => setOpen(false));
  closeRef.current = () => setOpen(false);
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRef.current();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  useEffect(() => {
    if (open) setMinimized(false);
  }, [open]);

  const slots = collectSlots(children);
  const hasFoot = slots.foot != null && slots.foot !== false;

  const restore = () => {
    setOpen(false);
    setMinimized(false);
  };

  const value: FloatingSheetContextValue = {
    open,
    setOpen,
    progress: grown,
    peek,
    minimized,
    setMinimized,
  };
  const hidden = hideOnScroll && (chromeHidden || scrollHidden) && !expanded;
  const restAlpha = peek > 0 ? 0.5 : 0.28;
  const glass = appearance === 'glass';

  return (
    <FloatingSheetContext.Provider value={value}>
      <div
        ref={rootRef}
        data-slot="floating-sheet"
        data-appearance={appearance}
        data-tone={tone === 'auto' ? undefined : tone}
        data-theme-scope={toneProps['data-theme-scope']}
        data-body-align={bodyAlign}
        data-open={open || undefined}
        data-expanded={expanded || undefined}
        data-dragging={dragging || undefined}
        data-minimized={minimized || undefined}
        className={cn(floatingSheetVariants({ tone }), toneProps.className, className)}
        style={{
          '--ck-sheet-dock-height': `${dockHeight}px`,
          '--ck-sheet-reveal': `${reveal}px`,
          '--ck-sheet-body-height': `${maxReveal}px`,
          '--ck-sheet-width': `${overlayWidth}px`,
          '--ck-sheet-height': `${overlayHeight}px`,
          '--ck-sheet-minimize': `${minimizeProgress}`,
          '--ck-sheet-grown': `${grown}`,
          '--ck-sheet-gutter': `${gutter}px`,
          '--ck-sheet-bottom-gutter': `${gutter * (1 - grown)}px`,
          '--ck-sheet-radius': `${overlayRadius}px`,
          '--ck-sheet-radius-bottom': `${bottomRadius}px`,
          // Fades the surface from resting-light to full-page-dark as it grows.
          '--ck-sheet-scrim-opacity': `${scrim ? 0.16 * grown : 0}`,
          '--ck-sheet-border-alpha': `${0.12 + 0.04 * grown}`,
          // A peeking transcript needs more body behind it than a lone composer does.
          '--ck-sheet-bg-alpha': `${restAlpha + (0.58 - restAlpha) * grown}`,
          '--ck-sheet-shadow-y': `${14 + 20 * grown}px`,
          '--ck-sheet-shadow-blur': `${34 + 30 * grown}px`,
          '--ck-sheet-shadow-alpha': `${0.22 + 0.18 * grown}`,
          '--ck-sheet-divider-alpha': `${0.09 * grown}`,
          ...style,
        } as CSSProperties}
      >
        {/* A pointer backdrop that tracks the drag through --ck-sheet-scrim-opacity, so the host dims only as
            far as the sheet has grown. It stays a plain button: react-aria's Button would drop the aria-hidden
            and tabIndex that keep it out of reach while the sheet is closed. */}
        <button
          type="button"
          aria-label="Close"
          aria-hidden={!open}
          tabIndex={open ? 0 : -1}
          data-slot="floating-sheet-scrim"
          className={cn(
            'absolute inset-0 z-0 block border-0 bg-black p-0 opacity-[var(--ck-sheet-scrim-opacity,0)] motion-reduce:[transition:none]',
            open ? 'pointer-events-auto' : 'pointer-events-none',
          )}
          style={{ transition: driving ? 'none' : springCss('opacity', 'smooth') }}
          data-open={open || undefined}
          onClick={() => setOpen(false)}
        />
        <div
          data-slot="floating-sheet-surface"
          className={floatingSheetSurfaceVariants({ appearance, placement: minimized ? fabPosition : hidden ? 'hidden' : 'resting', hidden })}
          // Inline so the production CSS optimizer cannot rewrite the unprefixed property
          // out of Safari's bundle.
          style={{
            transition: dragging ? 'none' : surfaceTransition(driving),
            ...(glass ? { backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' } : null),
          }}
          data-open={open || undefined}
          data-expanded={expanded || undefined}
          data-peeking={(peek > 0 && !open) || undefined}
          data-dragging={dragging || undefined}
          data-hidden={hidden || undefined}
          data-minimized={minimized || undefined}
          data-fab-position={fabPosition}
        >
          {/* The cap is the top row of the surface and its drag handle, so it stays a raw button that owns
              its pointer events. */}
          <button
            type="button"
            data-slot="floating-sheet-cap"
            className={cn(
              'group/cap box-border grid h-[18px] w-full shrink-0 touch-none place-items-center border-0 bg-transparent p-0 text-inherit opacity-[calc(1_-_var(--ck-sheet-minimize,0))] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary',
              dragging ? 'cursor-grabbing' : 'cursor-grab',
            )}
            data-open={open || undefined}
            aria-label={open ? 'Collapse' : 'Expand'}
            aria-expanded={open}
            aria-controls={bodyId}
            onClick={sheetDrag.toggle}
            {...sheetDrag.handlers}
          >
            <span
              data-slot="floating-sheet-grip"
              className={cn(
                'block h-[4px] rounded-[999px] [transition:width_var(--duration-spring-bouncy)_var(--ease-spring-bouncy),background-color_var(--duration-spring-snappy)_var(--ease-spring-snappy)] motion-reduce:[transition:none]',
                open
                  ? 'w-[40px] bg-muted-foreground'
                  : 'w-[32px] bg-tertiary-foreground group-focus-visible/cap:w-[40px] group-focus-visible/cap:bg-muted-foreground group-[:hover]/cap:w-[40px] group-[:hover]/cap:bg-muted-foreground',
              )}
            />
          </button>
          {/* Height is driven by --ck-sheet-reveal, which the cap drag writes one-to-one with the pointer.
              ck-floating-sheet__reveal stays as a hook for the peek-mask rules in styles.css. */}
          <div
            id={bodyId}
            role="region"
            aria-label={label}
            aria-hidden={!expanded}
            inert={!expanded}
            data-slot="floating-sheet-reveal"
            className={cn(
              'ck-floating-sheet__reveal relative h-[var(--ck-sheet-reveal,0px)] w-full shrink-0 overflow-hidden opacity-[calc(1_-_var(--ck-sheet-minimize,0))]',
              // Its height is the spring's, frame by frame — never a CSS transition.
              expanded ? 'visible' : 'invisible',
            )}
          >
            {/* Laid out at its full grown height so the visible window slides up over a stable body instead of
                reflowing on every drag frame. `end` pins it to the foot so a transcript grows upward out of the
                cap; `start` keeps a card's header against the cap. ck-floating-sheet__body stays as a hook for
                the child rules in styles.css (and hosts that style the body's child). */}
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
            ref={footRef}
            data-slot="floating-sheet-foot"
            className={cn(
              'relative min-w-0 shrink-0 opacity-[calc(1_-_var(--ck-sheet-minimize,0))]',
              hasFoot ? 'border-t border-[color:rgba(var(--ck-sheet-line),var(--ck-sheet-divider-alpha,0))]' : 'border-t-0',
            )}
            data-empty={hasFoot ? undefined : true}
          >
            {slots.foot}
          </div>
          <Button
            data-slot="floating-sheet-fab"
            className={cn(
              'absolute inset-0 grid h-full w-full cursor-pointer place-items-center rounded-[50%] border-0 bg-transparent p-0 text-foreground opacity-[var(--ck-sheet-minimize,0)]',
              minimized ? 'pointer-events-auto' : 'pointer-events-none',
            )}
            aria-label="Open"
            onPress={restore}
          >
            {fabIcon ?? slots.fab ?? <span className="block size-[10px] rounded-[50%] bg-primary" />}
          </Button>
        </div>
      </div>
    </FloatingSheetContext.Provider>
  );
}

FloatingSheet.Body = defineSlot('body');
FloatingSheet.Foot = defineSlot('foot');
FloatingSheet.Fab = defineSlot('fab');
FloatingSheet.Context = FloatingSheetContext;
FloatingSheet.useFloatingSheet = useFloatingSheet;

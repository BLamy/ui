import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { Button } from 'react-aria-components';
import { Haptics, useChromeHidden, collectSlots, defineSlot } from '@brett_lamy/ui';
import { cn } from './cn';

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
/** Colour scheme of the surface; `auto` inherits the host's `--bl-*` tokens. */
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
/** Pointer travel below which a cap drag counts as a tap. */
const TAP_SLOP = 4;
/** Extra downward travel that folds the surface into its FAB. */
const MINIMIZE_TRAVEL = 96;
/** Diameter of the minimized FAB. */
const FAB_SIZE = 52;

/* One surface, inset from the host edges by the gutter. The cap, the growing body and the foot are rows of
   the same rounded rect, so opening the sheet only makes that rect taller — there is no second card to fade
   in and no seam under the cap. Geometry comes from the --ck-sheet-* variables the gesture writes.
   ck-floating-sheet__surface stays as a hook for the peek-mask rules in styles.css. */
const surfaceBase =
  'ck-floating-sheet__surface pointer-events-auto absolute bottom-[var(--ck-sheet-bottom-gutter,20px)] left-1/2 z-2 box-border flex h-[var(--ck-sheet-height,auto)] w-[var(--ck-sheet-width,calc(100%_-_40px))] min-w-0 flex-col overflow-hidden rounded-t-[var(--ck-sheet-radius,28px)] rounded-b-[var(--ck-sheet-radius-bottom,28px)] border [transition:left_.48s_cubic-bezier(.22,1,.36,1),right_.48s_cubic-bezier(.22,1,.36,1),top_.48s_cubic-bezier(.22,1,.36,1),width_.48s_cubic-bezier(.22,1,.36,1),height_.48s_cubic-bezier(.22,1,.36,1),bottom_.48s_cubic-bezier(.22,1,.36,1),border-radius_.44s_cubic-bezier(.32,.72,0,1),transform_.48s_cubic-bezier(.22,1,.36,1),opacity_.24s_ease,background_.34s_ease,border-color_.34s_ease,box-shadow_.34s_ease,backdrop-filter_.34s_ease] motion-reduce:animate-none motion-reduce:[transition:none]';
/** Translucent glass: a highlight gradient over the tone's surface colour. */
const surfaceGlass =
  'border-[color:rgba(var(--ck-sheet-line),var(--ck-sheet-border-alpha,.12))] bg-[color:rgba(var(--ck-sheet-surface),var(--ck-sheet-bg-alpha,.28))] bg-[linear-gradient(180deg,rgba(255,255,255,.08),rgba(255,255,255,.018)_34%,rgba(255,255,255,.026))] [box-shadow:inset_0_1px_0_rgba(255,255,255,.14),inset_0_-1px_0_rgba(255,255,255,.03),0_2px_10px_rgba(0,0,0,.12),0_var(--ck-sheet-shadow-y,14px)_var(--ck-sheet-shadow-blur,34px)_-12px_rgba(0,0,0,var(--ck-sheet-shadow-alpha,.22))]';
/** Opaque system sheet: card colour, no glass highlights, a soft shadow that deepens as it grows. */
const surfaceSheet =
  'border-[color:rgba(var(--ck-sheet-line),calc(var(--ck-sheet-border-alpha,.12)_*_.5))] bg-[color:var(--bl-card,#fff)] [box-shadow:0_-1px_0_rgba(var(--ck-sheet-line),.04),0_2px_10px_rgba(0,0,0,.08),0_var(--ck-sheet-shadow-y,14px)_var(--ck-sheet-shadow-blur,34px)_-12px_rgba(0,0,0,var(--ck-sheet-shadow-alpha,.22))]';
const surfaceResting = '[transform:translateX(-50%)]';
const surfaceHidden = 'pointer-events-none opacity-0';
/** Where the folded FAB rests. The bottom-center FAB keeps 20px from the host edge even when docked edge to edge. */
const fabPlacement: Record<FloatingSheetFabPosition, string> = {
  'top-left': 'top-[var(--ck-sheet-gutter,20px)] right-auto bottom-auto left-[var(--ck-sheet-gutter,20px)] [transform:none]',
  'top-center': 'top-[var(--ck-sheet-gutter,20px)] right-auto bottom-auto left-1/2 [transform:translateX(-50%)]',
  'top-right': 'top-[var(--ck-sheet-gutter,20px)] right-[var(--ck-sheet-gutter,20px)] bottom-auto left-auto [transform:none]',
  'center-left': 'top-1/2 right-auto bottom-auto left-[var(--ck-sheet-gutter,20px)] [transform:translateY(-50%)]',
  'center-right': 'top-1/2 right-[var(--ck-sheet-gutter,20px)] bottom-auto left-auto [transform:translateY(-50%)]',
  'bottom-left': 'top-auto right-auto bottom-[var(--ck-sheet-gutter,20px)] left-[var(--ck-sheet-gutter,20px)] [transform:none]',
  'bottom-center': 'top-auto right-auto bottom-[max(var(--ck-sheet-gutter,20px),20px)] left-1/2 [transform:translateX(-50%)]',
  'bottom-right': 'top-auto right-[var(--ck-sheet-gutter,20px)] bottom-[var(--ck-sheet-gutter,20px)] left-auto [transform:none]',
};

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
  tone?: FloatingSheetTone;
  /**
   * Which edge of the body the visible window is anchored to. `end` pins the body to the
   * foot so a transcript grows upward out of the cap; `start` keeps a card's header under
   * the cap and lets the rest emerge below as the sheet grows.
   */
  bodyAlign?: 'start' | 'end';
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
  tone = 'auto',
  bodyAlign = 'start',
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
  const rootRef = useRef<HTMLDivElement>(null);
  const footRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(430);
  const [height, setHeight] = useState(800);
  const [footHeight, setFootHeight] = useState(0);
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const [minimized, setMinimized] = useState(false);
  const [scrollHidden, setScrollHidden] = useState(false);
  /** Live body height while the cap is being dragged. */
  const [dragReveal, setDragReveal] = useState<number | null>(null);
  const [dragMinimize, setDragMinimize] = useState<number | null>(null);
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
  const reveal = dragReveal ?? (open ? maxReveal : peek);
  const dragging = dragReveal != null;
  const expanded = reveal > 0;
  // Growth is measured from the resting height, so a peeking sheet keeps its compact shape
  // and only starts turning into the full page once it is dragged past the peek.
  const grown = maxReveal > peek ? Math.max(0, (reveal - peek) / (maxReveal - peek)) : 0;
  const minimizeProgress = dragMinimize ?? (minimized ? 1 : 0);
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

  const drag = useRef({ active: false, y: 0, from: 0, moved: false });

  // Travel below the resting height first closes the peek, then folds the surface into its FAB.
  const minimizeTravel = peek + MINIMIZE_TRAVEL;
  const minimizeFor = (rawReveal: number) =>
    minimizable && rawReveal < peek ? Math.min(1, (peek - rawReveal) / minimizeTravel) : 0;

  const onCapDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    drag.current = { active: true, y: event.clientY, from: open ? maxReveal : peek, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onCapMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!drag.current.active) return;
    const delta = drag.current.y - event.clientY;
    if (!drag.current.moved && Math.abs(delta) < TAP_SLOP) return;
    drag.current.moved = true;
    // The cap pulls the surface out one-to-one with the pointer.
    const rawReveal = drag.current.from + delta;
    setDragReveal(Math.max(minimizable ? 0 : Math.min(peek, maxReveal), Math.min(maxReveal, rawReveal)));
    setDragMinimize(minimizeFor(rawReveal));
  };

  const endDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!drag.current.active) return;
    const { moved, from } = drag.current;
    drag.current.active = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!moved) {
      setDragReveal(null);
      return;
    }
    const rawReveal = from + (drag.current.y - event.clientY);
    const settled = Math.max(0, Math.min(maxReveal, rawReveal));
    const shouldMinimize = minimizeFor(rawReveal) > 0.5;
    const nextOpen = !shouldMinimize && settled > peek + (maxReveal - peek) * 0.35;
    setDragReveal(null);
    setDragMinimize(null);
    setMinimized(shouldMinimize);
    if (nextOpen !== open) {
      Haptics.selection();
      setOpen(nextOpen);
    } else if (shouldMinimize) {
      Haptics.selection();
    }
  };

  const cancelDrag = () => {
    drag.current.active = false;
    setDragReveal(null);
    setDragMinimize(null);
  };

  const toggle = () => {
    // Pointer drags settle in endDrag; only real taps should toggle.
    if (drag.current.moved) {
      drag.current.moved = false;
      return;
    }
    Haptics.selection();
    setMinimized(false);
    setOpen(!open);
  };

  const restore = () => {
    Haptics.selection();
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
        data-body-align={bodyAlign}
        data-open={open || undefined}
        data-expanded={expanded || undefined}
        data-dragging={dragging || undefined}
        data-minimized={minimized || undefined}
        // ck-floating-sheet keys the tone token maps and the body/peek rules in styles.css.
        className={cn(
          'ck-floating-sheet pointer-events-none absolute inset-0 z-40 text-[color:var(--bl-label,#f5f5f7)] [font-family:var(--bl-font,-apple-system,BlinkMacSystemFont,"SF_Pro_Text",sans-serif)] [--ck-sheet-line:255,255,255] [--ck-sheet-surface:18,18,22]',
          className,
        )}
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
            'absolute inset-0 z-0 block border-0 bg-[#000] p-0 opacity-[var(--ck-sheet-scrim-opacity,0)] motion-reduce:[transition:none]',
            open ? 'pointer-events-auto' : 'pointer-events-none',
            dragging ? '[transition:none]' : '[transition:opacity_.42s_cubic-bezier(.32,.72,0,1)]',
          )}
          data-open={open || undefined}
          onClick={() => setOpen(false)}
        />
        <div
          data-slot="floating-sheet-surface"
          className={cn(
            surfaceBase,
            glass ? surfaceGlass : surfaceSheet,
            minimized
              ? fabPlacement[fabPosition]
              : hidden
                ? '[transform:translate(-50%,calc(100%_+_44px))]'
                : surfaceResting,
            hidden && surfaceHidden,
            dragging && '[transition:none]',
          )}
          // Inline so the production CSS optimizer cannot rewrite the unprefixed property
          // out of Safari's bundle.
          style={glass ? { backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' } : undefined}
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
              'group/cap box-border grid h-[18px] w-full shrink-0 touch-none place-items-center border-0 bg-transparent p-0 text-inherit opacity-[calc(1_-_var(--ck-sheet-minimize,0))] [transition:opacity_.18s_ease] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[color:var(--bl-tint,#0a84ff)]',
              dragging ? 'cursor-grabbing' : 'cursor-grab',
            )}
            data-open={open || undefined}
            aria-label={open ? 'Collapse' : 'Expand'}
            aria-expanded={open}
            aria-controls={bodyId}
            onClick={toggle}
            onPointerDown={onCapDown}
            onPointerMove={onCapMove}
            onPointerUp={endDrag}
            onPointerCancel={cancelDrag}
            onLostPointerCapture={cancelDrag}
          >
            <span
              data-slot="floating-sheet-grip"
              className={cn(
                'block h-[4px] rounded-[999px] [transition:width_.24s_ease,background_.24s_ease] motion-reduce:[transition:none]',
                open
                  ? 'w-[40px] bg-[color:var(--bl-label2,rgba(235,235,245,.62))]'
                  : 'w-[32px] bg-[color:var(--bl-label3,rgba(235,235,245,.32))] group-focus-visible/cap:w-[40px] group-focus-visible/cap:bg-[color:var(--bl-label2,rgba(235,235,245,.62))] group-[:hover]/cap:w-[40px] group-[:hover]/cap:bg-[color:var(--bl-label2,rgba(235,235,245,.62))]',
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
              expanded ? 'visible' : 'invisible',
              dragging
                ? '[transition:visibility_0s]'
                : expanded
                  ? '[transition:height_.44s_cubic-bezier(.32,.72,0,1),visibility_0s]'
                  : '[transition:height_.44s_cubic-bezier(.32,.72,0,1),visibility_0s_linear_.44s] motion-reduce:[transition:visibility_0s]',
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
              'relative min-w-0 shrink-0 opacity-[calc(1_-_var(--ck-sheet-minimize,0))] [transition:opacity_.18s_ease]',
              hasFoot ? 'border-t border-[color:rgba(var(--ck-sheet-line),var(--ck-sheet-divider-alpha,0))]' : 'border-t-0',
            )}
            data-empty={hasFoot ? undefined : true}
          >
            {slots.foot}
          </div>
          <Button
            data-slot="floating-sheet-fab"
            className={cn(
              'absolute inset-0 grid h-full w-full cursor-pointer place-items-center rounded-[50%] border-0 bg-transparent p-0 text-[color:var(--bl-label,#f5f5f7)] opacity-[var(--ck-sheet-minimize,0)]',
              minimized ? 'pointer-events-auto' : 'pointer-events-none',
            )}
            aria-label="Open"
            onPress={restore}
          >
            {fabIcon ?? slots.fab ?? <span className="block size-[10px] rounded-[50%] bg-[color:var(--bl-tint,#0a84ff)]" />}
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

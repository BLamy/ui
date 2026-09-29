import {
  Children, createContext, forwardRef, isValidElement, useContext, useMemo, useRef,
  type CSSProperties, type MouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode,
} from 'react';
import {
  AnimatePresence, LayoutGroup, MotionConfig, motion, useDragControls, useReducedMotion, type PanInfo, type Transition,
} from 'framer-motion';
import { springs, type SpringName } from '../lib/motion';
import { cn } from '../lib/utils';

/* ══ Morph — one element, two layouts (a shared-element transition) ══
   The mini player that becomes the full player; the thumbnail that becomes the detail's hero; the pill that
   becomes the panel. Render the element in whichever layout the state calls for — both places use the same
   `<Morph id>` — and when one unmounts as the other mounts, the element springs from the old frame to the new
   one (position, size and corner radius) instead of cross-fading two copies. Nest `<Morph>`s (the artwork inside
   the player) and each piece flies to its own new place. Built on framer-motion's `layoutId`, scoped by
   `<MorphGroup>` so two groups on a page never trade elements.

     <MorphGroup>
       {open
         ? <Morph id="player" radius={0} dragToDismiss onDismiss={close}>…full…<Morph id="art" radius={12}/></Morph>
         : <Morph id="player" radius={14} onClick={open}>…mini…<Morph id="art" radius={6}/></Morph>}
     </MorphGroup>

   Drag to dismiss: the expanded element follows the finger down (rubber-banded up), and past `dismissDistance`
   or a downward flick calls `onDismiss` — the element then morphs back from wherever the finger left it.
   Reduced motion: the layouts swap at once with a short cross-fade. */

interface MorphCtx { transition: Transition; reduced: boolean }
const MorphContext = createContext<MorphCtx | null>(null);

export interface MorphGroupProps {
  /** Scope for the ids inside (defaults to a unique id per group). */
  id?: string;
  /** Spring preset for every morph in the group (default `smooth`). */
  spring?: SpringName;
  /** A custom framer-motion transition (overrides `spring`). */
  transition?: Transition;
  children?: ReactNode;
}

let groupSeq = 0;

export function MorphGroup({ id, spring = 'smooth', transition, children }: MorphGroupProps) {
  const reducedPref = useReducedMotion();
  const reduced = !!reducedPref;
  const auto = useRef<string | null>(null);
  auto.current ??= `bl-morph-${++groupSeq}`;
  const t: Transition = reduced ? { duration: 0 } : transition ?? springs[spring];
  const ctx = useMemo(() => ({ transition: t, reduced }), [t, reduced]);
  return (
    <MorphContext.Provider value={ctx}>
      <LayoutGroup id={id ?? auto.current}>
        <MotionConfig transition={t}>{children}</MotionConfig>
      </LayoutGroup>
    </MorphContext.Provider>
  );
}

type MorphTag = 'div' | 'section' | 'article' | 'aside' | 'span' | 'li' | 'button' | 'a' | 'img' | 'figure' | 'header' | 'nav';

export interface MorphProps {
  /** The shared identity: the same id in both layouts. */
  id: string;
  /** Corner radius for this layout (px). Animated with the frame and kept undistorted while it scales. */
  radius?: number;
  /** Element to render (default `div`). */
  as?: MorphTag;
  /** Follow a downward drag and dismiss past `dismissDistance` or on a flick. A drag never starts inside a
      `[data-no-drag]` descendant (a scrubber, a slider, a scrolling list) — nor on form controls. */
  dragToDismiss?: boolean;
  /** Called when a drag-to-dismiss completes (or pass `onDismiss` alone and wire your own close button). */
  onDismiss?: () => void;
  /** Distance in px past which a released drag dismisses (default 120). */
  dismissDistance?: number;
  /** How the frame animates: `true` (position and size, the default) or `position` (only moves; for text that
      would stretch). */
  layout?: true | 'position' | 'size';
  /** Fade in on mount and out on unmount (inside `MorphPresence`), for an element that has no partner in the
      other layout. Leave off (the default) for shared elements — they morph rather than fade. */
  fade?: boolean;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  onClick?: (e: MouseEvent) => void;
  /** Extra DOM attributes (aria-*, data-*, role, href, src, alt, type …). */
  [attr: `aria-${string}` | `data-${string}`]: unknown;
  role?: string;
  href?: string;
  src?: string;
  alt?: string;
  type?: 'button' | 'submit' | 'reset';
  tabIndex?: number;
  title?: string;
}

/** An element that morphs between its layouts. Use inside a `<MorphGroup>`. */
export const Morph = forwardRef<HTMLElement, MorphProps>(function Morph(
  {
    id, radius, as = 'div', dragToDismiss, onDismiss, dismissDistance = 120, layout = true, fade = false,
    className, style, children, ...rest
  },
  ref,
) {
  const ctx = useContext(MorphContext);
  const reducedPref = useReducedMotion();
  const reduced = ctx?.reduced ?? !!reducedPref;
  const transition = ctx?.transition ?? (reduced ? { duration: 0 } : springs.smooth);
  const M = motion[as] as typeof motion.div;
  const drag = dragToDismiss && !reduced;
  const controls = useDragControls();
  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > dismissDistance || info.velocity.y > 650) onDismiss?.();
  };
  const userPointerDown = (rest as { onPointerDown?: (e: ReactPointerEvent) => void }).onPointerDown;
  const onPointerDown = (e: ReactPointerEvent) => {
    userPointerDown?.(e);
    const t = e.target as Element | null;
    if (e.defaultPrevented || t?.closest('[data-no-drag],input,textarea,select,[role=slider]')) return;
    controls.start(e);
  };
  return (
    <M
      ref={ref as never}
      data-slot="morph"
      data-morph-id={id}
      layoutId={id}
      layout={layout}
      transition={{ ...transition, opacity: reduced ? { duration: 0.12 } : { duration: 0.18 } }}
      {...(fade ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } } : null)}
      className={cn(drag && 'touch-pan-x', className)}
      style={{ ...(radius != null ? { borderRadius: radius } : null), ...style }}
      {...(drag
        ? {
          drag: 'y' as const,
          dragDirectionLock: true,
          dragConstraints: { top: 0, bottom: 0 },
          dragElastic: { top: 0.08, bottom: 0.9 },
          dragSnapToOrigin: true,
          dragListener: false,
          dragControls: controls,
          onDragEnd,
        }
        : null)}
      {...(rest as object)}
      {...(drag ? { onPointerDown } : null)}
    >
      {children}
    </M>
  );
});

export interface MorphPresenceProps {
  children?: ReactNode;
  /** `popLayout` lets the leaving layout get out of the way of the arriving one; it needs children that take a
      ref (a `Morph`, a DOM element). `auto` (default) uses `popLayout` when every child does, else `sync` — so
      any component works as a child without forwarding a ref. */
  mode?: 'auto' | 'sync' | 'wait' | 'popLayout';
}

const REF_TYPES = new Set<unknown>([Symbol.for('react.forward_ref'), Symbol.for('react.memo')]);
/** A child popLayout can measure: a DOM element, a Morph, or a forwardRef component. */
const takesRef = (c: ReactNode) =>
  isValidElement(c) && (typeof c.type === 'string' || c.type === Morph || REF_TYPES.has((c.type as { $$typeof?: unknown }).$$typeof));

/** Wrap conditionally rendered Morph content so parts without a partner (the full player's controls) can fade out
    as the morph runs, instead of vanishing. Optional: a plain swap already morphs the shared elements. */
export function MorphPresence({ children, mode = 'auto' }: MorphPresenceProps) {
  const m = mode === 'auto' ? (Children.toArray(children).every(takesRef) ? 'popLayout' : 'sync') : mode;
  return <AnimatePresence initial={false} mode={m}>{children}</AnimatePresence>;
}

/** The group's transition (for your own motion elements that should move with the morph). */
export function useMorphTransition(): Transition {
  const ctx = useContext(MorphContext);
  const reduced = useReducedMotion();
  return ctx?.transition ?? (reduced ? { duration: 0 } : springs.smooth);
}

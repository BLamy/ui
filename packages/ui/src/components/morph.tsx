'use client';
import {
  Children, createContext, isValidElement, useContext, useMemo, useRef,
  type AllHTMLAttributes, type ComponentType, type PointerEvent as ReactPointerEvent, type ReactElement, type ReactNode, type Ref,
} from 'react';
import { AnimatePresence, LayoutGroup, MotionConfig, motion, useReducedMotion, type Transition } from 'framer-motion';
import { bindDrag, dragThreshold } from '@ui-sdk/core';
import { createVelocityTracker } from '@ui-sdk/core/gesture';
import { springs, type SpringName } from '@/lib/motion';
import { cn } from '@/lib/utils';

/* ══ Morph — one element, two layouts (a shared-element transition) ══
   The mini player that becomes the full player; the thumbnail that becomes the detail's hero; the pill that
   becomes the panel. Render the element in whichever layout the state calls for — both places use the same
   `<Morph layoutId>` — and when one unmounts as the other mounts, the element springs from the old frame to the new
   one (position, size and corner radius) instead of cross-fading two copies. Nest `<Morph>`s (the artwork inside
   the player) and each piece flies to its own new place. Built on framer-motion's `layoutId`, scoped by
   `<MorphGroup>` so two groups on a page never trade elements.

     <MorphGroup>
       {open
         ? <Morph layoutId="player" radius={0} dragToDismiss onDismiss={close}>…full…<Morph layoutId="art" radius={12}/></Morph>
         : <Morph layoutId="player" radius={14} onClick={open}>…mini…<Morph layoutId="art" radius={6}/></Morph>}
     </MorphGroup>

   Drag to dismiss: the expanded element follows the finger down (rubber-banded up), and past `dismissDistance`
   or a downward flick calls `onDismiss` — the element then morphs back from wherever the finger left it. The
   gesture is UI SDK's `bindDrag`; the offset is the CSS `translate` property (`--morph-drag-y`), apart from the
   `transform` framer-motion animates, and springs back on the smooth spring token. The flick is UI SDK's velocity
   tracker (the one Drawer measures a release with).
   `render` swaps the element, as on UI SDK parts: `<Morph layoutId="card" render={<button type="button" />}>`. The
   element's type becomes the framer-motion element (`motion.button`, or `motion.create(Component)` for a component
   that forwards its ref), and its props sit under Morph's.
   Into a dialog: `<DialogContent render={<Morph layoutId="player" />}>` keeps the dialog's focus and dismissal and
   adds the morph. Reduced motion: the layouts swap at once with a short cross-fade. */

interface MorphCtx { transition: Transition; reduced: boolean }
const MorphContext = createContext<MorphCtx | null>(null);

export interface MorphGroupProps {
  /** Scope for the `layoutId`s inside (defaults to a unique id per group). */
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

/* motion.create() makes a new component each call: one per rendered component type, kept for the page's life. */
const motionOf = new Map<unknown, typeof motion.div>();
function motionElement(type: unknown): typeof motion.div {
  if (typeof type === 'string') return (motion as unknown as Record<string, typeof motion.div>)[type] ?? motion.div;
  let m = motionOf.get(type);
  if (!m) {
    m = motion.create(type as ComponentType) as unknown as typeof motion.div;
    motionOf.set(type, m);
  }
  return m;
}

/** A flick faster than this (px/ms, downward) dismisses whatever the distance. */
const FLICK_SPEED = 0.65;

type MotionConflicts = 'onAnimationStart' | 'onAnimationEnd' | 'onAnimationIteration' | 'onDrag' | 'onDragStart' | 'onDragEnd' | 'onDragOver' | 'onDragEnter' | 'onDragLeave' | 'onDrop';

/** Any HTML attribute, since `render` can make it any element (`href` and `target` on a link, `name` and `value` on a
    button, `src` and `alt` on an image), minus the event names framer-motion uses for its own gestures. */
export interface MorphProps extends Omit<AllHTMLAttributes<HTMLElement>, MotionConflicts | 'ref'> {
  ref?: Ref<HTMLElement>;
  /** The shared identity: the same `layoutId` in both layouts (framer-motion's name). `id` stays the DOM id. */
  layoutId: string;
  /** Corner radius for this layout (px). Animated with the frame and kept undistorted while it scales. */
  radius?: number;
  /** The element to render instead of a `div`, like `<button type="button" />` or `<li />`: its type and props
      are used, Morph's own props win, and `className`s merge. Pass the children to Morph, not to the element. */
  render?: ReactElement<{ className?: string }>;
  /** Follow a downward drag and dismiss past `dismissDistance` or on a flick. A drag never starts inside a
      `[data-no-drag]` descendant (a scrubber, a slider, a scrolling list) — nor on form controls. */
  dragToDismiss?: boolean;
  /** Called when a drag-to-dismiss completes (or pass `onDismiss` alone and wire your own close button). */
  onDismiss?: () => void;
  /** Distance in px past which a released drag dismisses (default 120). */
  dismissDistance?: number;
  /** How the frame animates: `true` (position and size, the default), `position` (only moves; for text that would
      stretch) or `size` (only resizes, in place). */
  layout?: true | 'position' | 'size';
  /** Fade in on mount and out on unmount (inside `MorphPresence`), for an element that has no partner in the
      other layout. Leave off (the default) for shared elements — they morph rather than fade. */
  fade?: boolean;
  [attr: `data-${string}`]: unknown;
}

/** An element that morphs between its layouts. Use inside a `<MorphGroup>`. */
export function Morph({
  layoutId, radius, render, dragToDismiss, onDismiss, dismissDistance = 120, layout = true, fade = false,
  className, style, children, ref, ...rest
}: MorphProps) {
  const ctx = useContext(MorphContext);
  const reducedPref = useReducedMotion();
  const reduced = ctx?.reduced ?? !!reducedPref;
  const transition = ctx?.transition ?? (reduced ? { duration: 0 } : springs.smooth);
  const M = motionElement(render?.type ?? 'div');
  const { className: renderClassName, ...renderProps } = (render?.props ?? {}) as { className?: string; children?: ReactNode };
  delete renderProps.children;
  const drag = dragToDismiss && !reduced;
  const userPointerDown = (rest as { onPointerDown?: (e: ReactPointerEvent) => void }).onPointerDown;
  const onPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    userPointerDown?.(e);
    const t = e.target as Element | null;
    if (e.button !== 0 || e.defaultPrevented || t?.closest('[data-no-drag],input,textarea,select,[role=slider]')) return;
    const el = e.currentTarget;
    const x0 = e.clientX, y0 = e.clientY;
    let dy = 0;
    const velocity = createVelocityTracker();
    velocity.add(e.timeStamp, y0);
    bindDrag(el, e.nativeEvent, {
      threshold: dragThreshold,
      // Vertical only: a sideways gesture (a carousel, a scrubber) is left alone.
      onStart: (ev) => {
        if (Math.abs(ev.clientY - y0) < Math.abs(ev.clientX - x0)) return false;
        el.setAttribute('data-dragging', '');
        return true;
      },
      onMove: ({ y, event }) => {
        velocity.add(event.timeStamp, y);
        dy = y - y0;
        // Rubber-banded: it barely moves up, and follows most of the way down.
        el.style.setProperty('--morph-drag-y', `${dy < 0 ? dy * 0.08 : dy * 0.9}px`);
      },
      onEnd: (end, canceled) => {
        el.removeAttribute('data-dragging');
        el.style.removeProperty('--morph-drag-y');
        if (!canceled && (dy > dismissDistance || velocity.velocity(end.timeStamp) > FLICK_SPEED)) onDismiss?.();
      },
    });
  };
  return (
    <M
      {...(renderProps as object)}
      ref={ref as never}
      data-slot="morph"
      data-morph-id={layoutId}
      layoutId={layoutId}
      layout={layout}
      transition={{ ...transition, opacity: reduced ? { duration: 0.12 } : { duration: 0.18 } }}
      {...(fade ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } } : null)}
      className={cn(
        renderClassName,
        drag && 'touch-pan-x translate-y-(--morph-drag-y) transition-[translate] duration-spring-smooth ease-spring-smooth data-dragging:transition-none motion-reduce:transition-none',
        className,
      )}
      style={{ ...(radius != null ? { borderRadius: radius } : null), ...style }}
      {...(rest as object)}
      {...(drag ? { onPointerDown } : null)}
    >
      {children}
    </M>
  );
}

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

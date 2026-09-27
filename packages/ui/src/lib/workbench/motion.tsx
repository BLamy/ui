import * as React from 'react';
import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { animate, AnimatePresence, motion, type AnimationPlaybackControls } from 'framer-motion';
import { Haptics } from '../haptics';
import { cn } from '../utils';
import { springs, type SpringName } from '../motion';

/* ══ Motion helpers for the Workbench and ChatKit surfaces ══
   The kit's shared vocabulary (`springs`, `springCss`, --ease-spring-* / --duration-spring-*) lives in
   @brett_lamy/ui. These are the few pieces the composer and sheets need on top of it, after Benji Taylor's
   "Family Values": springs that keep the finger's velocity on release, FLIP moves for elements that change
   parents, and labels that morph by their shared letters. Everything honours prefers-reduced-motion. */

export { springs, type SpringName };

/** Whether the user asked for reduced motion (checked when an animation starts, so it follows the setting live). */
export function prefersReducedMotion(): boolean {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/* ── FLIP ── */
export type FlipSnapshot = Map<Element, DOMRect>;

/** Records where elements are now, before a change moves them. */
export function flipSnapshot(elements: Iterable<Element>): FlipSnapshot {
  const map: FlipSnapshot = new Map();
  for (const el of elements) map.set(el, el.getBoundingClientRect());
  return map;
}

/**
 * Plays elements from where `snapshot` saw them to where they are now, on a spring. `relativeTo` pairs a
 * container's before/after rects so children move relative to it (a card that is itself resizing).
 * Interrupting is safe: a snapshot taken mid-flight includes the running transform.
 */
export function flipPlay(
  snapshot: FlipSnapshot,
  {
    spring = 'smooth',
    relativeTo,
    fade = false,
    lift = false,
  }: { spring?: SpringName; relativeTo?: [DOMRect, DOMRect]; fade?: boolean; lift?: boolean } = {},
) {
  if (prefersReducedMotion()) return;
  const [rb, ra] = relativeTo ?? [null, null];
  snapshot.forEach((before, el) => {
    if (!el.isConnected || !(el instanceof HTMLElement || el instanceof SVGElement)) return;
    const after = el.getBoundingClientRect();
    if (!after.width && !after.height) return;
    let dx = before.left - after.left;
    let dy = before.top - after.top;
    if (rb && ra) {
      dx = before.left - rb.left - (after.left - ra.left);
      dy = before.top - rb.top - (after.top - ra.top);
    }
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
    // Lifted elements fly over their neighbours (an option pill crossing the card on its way to a bump).
    if (lift) {
      el.style.position ||= 'relative';
      el.style.zIndex = '5';
    }
    animate(el, { x: [dx, 0], y: [dy, 0], ...(fade ? { opacity: [0.4, 1] } : null) }, {
      ...springs[spring],
      onComplete: () => {
        if (lift) el.style.zIndex = '';
      },
    });
  });
}

/* ── Spring-driven sheet drag ── */
export const SHEET_TAP_SLOP = 4;
export const SHEET_MINIMIZE_TRAVEL = 96;
/** How far (ms of travel at release velocity) a flick is projected before picking the nearest stop. */
const PROJECT_MS = 200;
/** Release speed (px/ms) above which a drag counts as a flick toward the next stop. */
const FLICK_SPEED = 0.4;

export interface SpringSheetDragOptions {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Body height visible at rest. */
  peek: number;
  /** Body height when fully open. */
  maxReveal: number;
  /** Extra resting heights between `peek` and `maxReveal` (px of body). */
  detents?: number[];
  /** Allow dragging below the resting height to fold into a FAB. */
  minimizable?: boolean;
  minimized?: boolean;
  onMinimizedChange?: (minimized: boolean) => void;
  /** Spring the body settles with (default `tray`). */
  spring?: SpringName;
}

export interface SpringSheetDragState {
  /** The body height to draw this frame (follows the finger, then springs to rest). */
  reveal: number;
  /** 0–1 fold towards the FAB to draw this frame. */
  minimize: number;
  /** A finger is on the handle. */
  dragging: boolean;
  /** The spring is carrying the body to rest after a release or a state change. */
  settling: boolean;
  /** The middle detent the sheet rests at (px), or null at peek/open. */
  detent: number | null;
  /** Spread on the handle element. */
  handlers: {
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
    onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
    onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void;
    onPointerCancel: () => void;
    onLostPointerCapture: () => void;
  };
  /** A tap on the handle: toggles open (ignored right after a drag). */
  toggle: () => void;
}

const rubber = (over: number) => Math.pow(Math.max(0, over), 0.72);

/**
 * The grow / snap / fold gesture behind FloatingSheet's cap and Composer's draggable bump. The body follows
 * the pointer one-to-one (rubber-banding past its ends); on release the pointer's velocity is projected
 * forward to pick a stop (peek, a detent, open, or the FAB) and a spring carries the body there *from that
 * velocity*, so a flick keeps its momentum. Grabbing mid-flight catches the body where it is. State changes
 * from outside (a tap, Escape, `peek` changing) spring too. Snaps tick.
 */
export function useSpringSheetDrag({
  open,
  onOpenChange,
  peek,
  maxReveal,
  detents = [],
  minimizable = false,
  minimized = false,
  onMinimizedChange,
  spring = 'tray',
}: SpringSheetDragOptions): SpringSheetDragState {
  const [detent, setDetent] = useState<number | null>(null);
  const restDetent = detent != null && detent > peek && detent < maxReveal ? detent : null;
  const target = open ? maxReveal : (restDetent ?? peek);
  const targetMin = minimized ? 1 : 0;

  const [reveal, setReveal] = useState(target);
  const [minimize, setMinimize] = useState(targetMin);
  const [dragging, setDragging] = useState(false);
  const [settling, setSettling] = useState(false);
  const [kick, setKick] = useState(0);
  const cur = useRef({ reveal: target, minimize: targetMin });
  const anim = useRef<{ r?: AnimationPlaybackControls; m?: AnimationPlaybackControls }>({});
  const velocity = useRef({ reveal: 0, minimize: 0 });
  const drag = useRef({ active: false, y: 0, from: 0, moved: false, samples: [] as { t: number; y: number }[] });
  const mounted = useRef(false);

  const minimizeTravel = peek + SHEET_MINIMIZE_TRAVEL;
  const minimizeFor = (raw: number) => (minimizable && raw < peek ? Math.min(1, (peek - raw) / minimizeTravel) : 0);

  const stop = () => {
    anim.current.r?.stop();
    anim.current.m?.stop();
    anim.current = {};
  };
  const write = (r: number, m: number) => {
    cur.current = { reveal: r, minimize: m };
    setReveal(r);
    setMinimize(m);
  };

  // Spring to rest whenever the resting state changes, or a release asks for it (kick).
  useIsoLayoutEffect(() => {
    if (drag.current.active) return;
    const first = !mounted.current;
    mounted.current = true;
    const from = cur.current;
    if (first || prefersReducedMotion() || (Math.abs(from.reveal - target) < 0.5 && Math.abs(from.minimize - targetMin) < 0.005)) {
      stop();
      write(target, targetMin);
      setSettling(false);
      return;
    }
    stop();
    setSettling(true);
    let pending = 2;
    const done = () => {
      if (--pending === 0) setSettling(false);
    };
    const opts = springs[spring];
    anim.current.r = animate(from.reveal, target, {
      ...opts,
      velocity: velocity.current.reveal,
      onUpdate: (v) => {
        const r = Math.max(0, Math.min(maxReveal, v));
        cur.current.reveal = r;
        setReveal(r);
      },
      onComplete: done,
    });
    anim.current.m = animate(from.minimize, targetMin, {
      ...opts,
      velocity: velocity.current.minimize,
      onUpdate: (v) => {
        const m = Math.max(0, Math.min(1, v));
        cur.current.minimize = m;
        setMinimize(m);
      },
      onComplete: done,
    });
    velocity.current = { reveal: 0, minimize: 0 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, targetMin, kick]);
  useEffect(() => () => stop(), []);

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    stop();
    setSettling(false);
    // Catch the body where it is — mid-spring included.
    drag.current = { active: true, y: event.clientY, from: cur.current.reveal, moved: false, samples: [{ t: event.timeStamp, y: event.clientY }] };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d.active) return;
    const delta = d.y - event.clientY;
    if (!d.moved && Math.abs(delta) < SHEET_TAP_SLOP) return;
    if (!d.moved) setDragging(true);
    d.moved = true;
    d.samples.push({ t: event.timeStamp, y: event.clientY });
    if (d.samples.length > 6) d.samples.shift();
    const raw = d.from + delta;
    const floor = minimizable ? 0 : Math.min(peek, maxReveal);
    const shown = raw > maxReveal ? maxReveal + rubber(raw - maxReveal) * 0.35 : raw < floor ? Math.max(0, floor - rubber(floor - raw)) : raw;
    write(Math.min(maxReveal + 24, shown), minimizeFor(raw));
  };

  const release = (clientY: number, timeStamp: number) => {
    const d = drag.current;
    d.active = false;
    setDragging(false);
    if (!d.moved) return;
    // Velocity over the last ~80ms of samples, in reveal px per ms (up = positive).
    const recent = d.samples.filter((s) => timeStamp - s.t < 90);
    const first = recent[0] ?? d.samples[0];
    const dt = Math.max(1, timeStamp - (first?.t ?? timeStamp));
    const v = first ? (first.y - clientY) / dt : 0;
    const raw = d.from + (d.y - clientY);
    const projected = raw + v * PROJECT_MS;
    const shouldMinimize = minimizable && minimizeFor(projected) > 0.5 && minimizeFor(raw) > 0.08;
    const stops = [peek, ...detents.filter((x) => x > peek && x < maxReveal), maxReveal];
    const clamped = Math.max(0, Math.min(maxReveal, projected));
    // A decided flick goes to the next stop the way it was thrown; a gentle release, to the nearest one.
    const ahead = Math.abs(v) > FLICK_SPEED ? stops.filter((s) => (v > 0 ? s > raw + 1 : s < raw - 1)) : [];
    const nearest = ahead.length
      ? v > 0
        ? Math.min(...ahead)
        : Math.max(...ahead)
      : stops.reduce((best, s) => (Math.abs(s - clamped) < Math.abs(best - clamped) ? s : best), stops[0]);
    const nextOpen = !shouldMinimize && nearest === maxReveal && maxReveal > peek;
    const nextDetent = !shouldMinimize && nearest !== peek && nearest !== maxReveal ? nearest : null;
    velocity.current = {
      reveal: v * 1000,
      minimize: minimizable && raw < peek ? (-v * 1000) / minimizeTravel : 0,
    };
    const changed = nextOpen !== open || shouldMinimize !== minimized || nextDetent !== restDetent;
    if (changed) Haptics.selection();
    setDetent(nextDetent);
    if (shouldMinimize !== minimized) onMinimizedChange?.(shouldMinimize);
    if (nextOpen !== open) onOpenChange(nextOpen);
    // Spring back even when the rest state is unchanged.
    setKick((k) => k + 1);
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLElement>) => {
    if (!drag.current.active) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    release(event.clientY, event.timeStamp);
  };

  const cancel = () => {
    if (!drag.current.active) return;
    drag.current.active = false;
    setDragging(false);
    setKick((k) => k + 1);
  };

  const toggle = () => {
    // Pointer drags settle in onPointerUp; only real taps toggle.
    if (drag.current.moved) {
      drag.current.moved = false;
      return;
    }
    Haptics.selection();
    setDetent(null);
    onMinimizedChange?.(false);
    onOpenChange(!open);
  };

  return {
    reveal,
    minimize,
    dragging,
    settling,
    detent: restDetent,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: cancel, onLostPointerCapture: cancel },
    toggle,
  };
}

/* ── MorphText: a label that changes by its shared letters ── */
export interface MorphTextProps {
  children: string;
  className?: string;
}

/**
 * Text that morphs rather than swaps: letters both labels share slide to their new places, the rest fade
 * and blur in/out (Continue → Confirm). Keep it to short labels — pills, buttons, statuses.
 */
export function MorphText({ children, className }: MorphTextProps) {
  const text = String(children ?? '');
  const reduce = prefersReducedMotion();
  const box = useRef<HTMLSpanElement>(null);
  const width = useRef<number | null>(null);
  // The label's width springs to the new text, so its neighbours glide instead of jumping.
  useIsoLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.width = '';
    const next = el.getBoundingClientRect().width;
    const prev = width.current;
    width.current = next;
    if (prev == null || Math.abs(prev - next) < 0.5 || prefersReducedMotion()) return;
    animate(el, { width: [prev, next] }, { ...springs.snappy, onComplete: () => (el.style.width = '') });
  }, [text]);
  const seen: Record<string, number> = {};
  const letters = Array.from(text).map((ch) => {
    const n = (seen[ch] = (seen[ch] ?? 0) + 1);
    return { ch, key: `${ch}-${n}` };
  });
  if (reduce) return <span className={className}>{text}</span>;
  return (
    <span ref={box} className={cn('inline-flex', className)} data-slot="morph-text">
      <span className="sr-only">{text}</span>
      <span aria-hidden="true" className="relative inline-flex whitespace-pre">
        <AnimatePresence mode="popLayout" initial={false}>
          {letters.map(({ ch, key }) => (
            <motion.span
              key={key}
              layout="position"
              layoutDependency={text}
              className="inline-block"
              initial={{ opacity: 0, filter: 'blur(3px)', y: 3 }}
              animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
              exit={{ opacity: 0, filter: 'blur(3px)', y: -3 }}
              transition={{ ...springs.snappy, opacity: { duration: 0.16 } }}
            >
              {ch === ' ' ? ' ' : ch}
            </motion.span>
          ))}
        </AnimatePresence>
      </span>
    </span>
  );
}

/* ── Height that follows its content on a spring (trays vary in height and morph) ── */
export interface AutoHeightProps extends React.HTMLAttributes<HTMLDivElement> {
  spring?: SpringName;
}

/** A box whose height springs to fit its content whenever the content changes size. */
export function AutoHeight({ spring = 'tray', className, style, children, ...props }: AutoHeightProps) {
  const inner = useRef<HTMLDivElement>(null);
  const outer = useRef<HTMLDivElement>(null);
  const last = useRef<number | null>(null);
  useEffect(() => {
    const el = inner.current,
      box = outer.current;
    if (!el || !box || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      const h = el.offsetHeight;
      const prev = last.current;
      last.current = h;
      if (prev == null || prev === h || prefersReducedMotion()) {
        box.style.height = '';
        return;
      }
      // Mid-flight the box has an inline height (where it is now); at rest it is auto (already `h`).
      const from = box.style.height ? box.offsetHeight : prev;
      animate(box, { height: [from, h] }, { ...springs[spring], onComplete: () => (box.style.height = '') });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [spring]);
  return (
    <div ref={outer} className={className} style={{ overflow: 'clip', ...style }} {...props}>
      <div ref={inner}>{children}</div>
    </div>
  );
}

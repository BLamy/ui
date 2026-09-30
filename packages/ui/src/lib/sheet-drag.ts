import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { animate, type AnimationPlaybackControls } from 'framer-motion';
import { springs, type SpringName } from './motion';
import { prefersReducedMotion } from './workbench/motion';

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/* ══ useSheetDrag — the grow / snap / fold gesture behind FloatingSheet's cap and Composer's draggable bump ══ */
/** Pointer travel below which a handle drag counts as a tap. */
export const SHEET_TAP_SLOP = 4;
/** Extra downward travel (past the peek) that folds the surface into its FAB. */
export const SHEET_MINIMIZE_TRAVEL = 96;
/** How far (ms of travel at release velocity) a flick is projected before picking the nearest stop. */
const PROJECT_MS = 200;
/** Release speed (px/ms) above which a drag counts as a flick toward the next stop. */
const FLICK_SPEED = 0.4;

export interface SheetDragOptions {
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

export interface SheetDragState {
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
 * from outside (a tap, Escape, `peek` changing) spring too.
 */
export function useSheetDrag({
  open,
  onOpenChange,
  peek,
  maxReveal,
  detents = [],
  minimizable = false,
  minimized = false,
  onMinimizedChange,
  spring = 'tray',
}: SheetDragOptions): SheetDragState {
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

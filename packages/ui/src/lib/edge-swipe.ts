'use client';
import { useRef, type PointerEvent as ReactPointerEvent } from 'react';

/* A back swipe from an element's left edge — the gesture NavigationStack and SideDrawer's compact push share.
   The hook owns what has to be the same everywhere, so it can't drift between them:
   - a press in the edge zone only *arms* the gesture. It engages on a clearly horizontal, rightward drag (past the
     slop), and a vertical drag first hands the pointer back to the page (scrolling);
   - the pointer is captured when the drag engages, not on press, so a tap in the edge zone (a back chevron, a row's
     leading icon) still reaches the control under it. Capturing at engage is also what keeps a swipe that began on a
     button from pressing it when the finger lifts over it: the pointer moves to the captured element, the button sees
     it leave, and its press is cancelled;
   - release speed and distance decide whether it commits.
   Callers keep what differs: what moves (`move`), what happens on release (`release`), and what a press in the zone
   is allowed to start (`begin`). */

export interface EdgeSwipeConfig<C> {
  /** The element whose left edge starts the swipe and whose width is a full swipe. */
  target: () => HTMLElement | null;
  /** Width of the edge zone, px. */
  edge: number;
  /** Fraction of the width past which a release commits. */
  commit: number;
  /** Release speed (px/ms) past which it commits whatever the distance. */
  flick: number;
  /** A press landed in the edge zone: return what the swipe will move (`ctx`), or null to ignore the press. */
  begin: (e: ReactPointerEvent, rect: DOMRect) => C | null;
  /** The drag engaged; runs once, just before the first `move`. */
  engage?: (ctx: C) => void;
  /** The finger moved. `p` is the fraction of the width travelled (0–1), `dx` the distance in px. */
  move: (ctx: C, p: number, dx: number) => void;
  /** The finger lifted (or the pointer was cancelled) after the drag engaged. */
  release: (ctx: C, r: { p: number; dx: number; commit: boolean }) => void;
  /** The press ended without the drag ever engaging (a tap, a vertical drag). */
  abort?: (ctx: C) => void;
}

interface Gesture<C> { ctx: C; x0: number; y0: number; w: number; last: number; lt: number; vel: number; dx: number; on: boolean }

/** Slop: the drag engages past this many px, and only when clearly more horizontal than vertical. */
const SLOP = 8;
const HORIZONTAL = 1.2;
/** A vertical drag this far before the swipe engages is a scroll: the gesture is dropped. */
const SCROLL = 14;

export function useEdgeSwipe<C>(config: EdgeSwipeConfig<C>) {
  const cfg = useRef(config);
  cfg.current = config;
  const gesture = useRef<Gesture<C> | null>(null);

  const down = (e: ReactPointerEvent) => {
    if (e.button) return;
    const { target, edge, begin } = cfg.current;
    const el = target();
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (e.clientX - rect.left > edge) return;
    const ctx = begin(e, rect);
    if (ctx == null) return;
    gesture.current = { ctx, x0: e.clientX, y0: e.clientY, w: rect.width, last: e.clientX, lt: performance.now(), vel: 0, dx: 0, on: false };
  };

  const move = (e: ReactPointerEvent) => {
    const g = gesture.current;
    if (!g) return;
    const raw = e.clientX - g.x0, dy = e.clientY - g.y0;
    if (!g.on) {
      if (raw > SLOP && raw > Math.abs(dy) * HORIZONTAL) {
        g.on = true;
        try { cfg.current.target()?.setPointerCapture(e.pointerId); } catch { /* no active pointer (synthetic input) */ }
        cfg.current.engage?.(g.ctx);
      } else {
        if (Math.abs(dy) > SCROLL) gesture.current = null;
        return;
      }
    }
    const dx = Math.max(0, raw);
    g.dx = dx;
    g.vel = (e.clientX - g.last) / Math.max(1, performance.now() - g.lt);
    g.last = e.clientX;
    g.lt = performance.now();
    try { cfg.current.move(g.ctx, dx / g.w, dx); } catch { gesture.current = null; }
  };

  const up = () => {
    const g = gesture.current;
    if (!g) return;
    gesture.current = null;
    const { commit, flick, abort, release } = cfg.current;
    if (!g.on) { abort?.(g.ctx); return; }
    const p = g.dx / g.w;
    release(g.ctx, { p, dx: g.dx, commit: p > commit || g.vel > flick });
  };

  return {
    /** Spread onto the element: `<div {...swipe.bind} />`. The press is seen in the capture phase, because a button
     *  inside (react-aria's press handling) stops pointerdown from bubbling. */
    bind: { onPointerDownCapture: down, onPointerMove: move, onPointerUp: up, onPointerCancel: up },
  };
}

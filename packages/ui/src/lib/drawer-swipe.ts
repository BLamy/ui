'use client';
import { useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { springCss } from '@/lib/motion';

/* The drag that opens and closes a drawer, with the feel of NavigationStack's edge swipe: the panel follows the
   finger, the scrim fades with it, and a release commits past a distance or a flick and settles on the tray spring
   from wherever the finger let go. A drawer that is open closes by dragging its panel toward its edge; one that is
   closed opens by dragging from a strip along that edge.
   As in `useEdgeSwipe`, a press only arms the gesture. It engages on a clearly horizontal drag (a vertical one
   first is a scroll and is handed back), and the pointer is captured then, so a tap still reaches the control
   under it. The panel and scrim are moved through inline `translate`/`opacity` and handed back to their classes on
   release, so the drawer's own open/closed styling stays the one source of where it rests. */

export interface DrawerSwipeConfig {
  side: 'left' | 'right';
  open: boolean;
  panel: () => HTMLElement | null;
  scrim: () => HTMLElement | null;
  /** Fraction of the panel's width past which a release commits. */
  commit: number;
  /** Release speed (px/ms) past which it commits whatever the distance. */
  flick: number;
  /** A closed drawer was dragged open (the strip's gesture runs only when this is given). */
  onOpen?: () => void;
  onClose?: () => void;
}

interface Gesture { mode: 'open' | 'close'; x0: number; y0: number; w: number; last: number; lt: number; vel: number; d: number; on: boolean }

const SLOP = 8;
const HORIZONTAL = 1.2;
const SCROLL = 14;
/** How far past its edge a closed panel waits, as a fraction of its width (EdgeDrawer's `translate-x-[103%]`). */
const PARKED = 1.03;
/** The tray spring's settle time, plus a frame. */
const SETTLE_MS = 430;

export function useDrawerSwipe(config: DrawerSwipeConfig) {
  const cfg = useRef(config);
  cfg.current = config;
  const g = useRef<Gesture | null>(null);

  // Toward the drawer's edge is closing; away from it is opening. `toward` is that unit direction on screen.
  const toward = () => (cfg.current.side === 'left' ? -1 : 1);

  const press = (mode: Gesture['mode']) => (e: ReactPointerEvent) => {
    const { panel, open, onOpen } = cfg.current;
    if (e.button || (mode === 'close' ? !open : open || !onOpen)) return;
    if (mode === 'close' && (e.target as Element).closest('[data-drawer-swipe="off"]')) return;
    const el = panel();
    if (!el) return;
    g.current = { mode, x0: e.clientX, y0: e.clientY, w: el.getBoundingClientRect().width, last: e.clientX, lt: performance.now(), vel: 0, d: 0, on: false };
  };

  const apply = (s: Gesture, d: number) => {
    const { panel, scrim } = cfg.current;
    const p = Math.min(1, d / s.w);
    const pnl = panel(), scr = scrim();
    if (pnl) {
      pnl.style.transition = 'none';
      pnl.style.translate = `${s.mode === 'close' ? toward() * d : toward() * PARKED * s.w * (1 - p)}px 0`;
    }
    if (scr) { scr.style.transition = 'none'; scr.style.opacity = String(s.mode === 'close' ? 1 - p : p); }
  };

  const move = (e: ReactPointerEvent) => {
    const s = g.current;
    if (!s) return;
    // Distance travelled in the gesture's own direction: toward the edge to close, away from it to open.
    const sign = s.mode === 'close' ? toward() : -toward();
    const raw = (e.clientX - s.x0) * sign, dy = e.clientY - s.y0;
    if (!s.on) {
      if (raw > SLOP && raw > Math.abs(dy) * HORIZONTAL) {
        s.on = true;
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* no active pointer (synthetic input) */ }
      } else {
        if (Math.abs(dy) > SCROLL) g.current = null;
        return;
      }
    }
    const now = performance.now();
    s.vel = ((e.clientX - s.last) * sign) / Math.max(1, now - s.lt);
    s.last = e.clientX; s.lt = now;
    s.d = Math.max(0, raw);
    apply(s, s.d);
  };

  const release = () => {
    const s = g.current;
    g.current = null;
    if (!s || !s.on) return;
    const { panel, scrim, commit, flick, onOpen, onClose } = cfg.current;
    const go = s.d / s.w > commit || s.vel > flick;
    const pnl = panel(), scr = scrim();
    // Hand the position back to the classes on the tray spring: it carries on from where the finger let go.
    if (pnl) { pnl.style.transition = springCss(['translate', 'box-shadow'], 'tray'); pnl.style.translate = ''; }
    if (scr) { scr.style.transition = springCss('opacity', 'tray'); scr.style.opacity = ''; }
    if (go) (s.mode === 'open' ? onOpen : onClose)?.();
    setTimeout(() => {
      if (pnl) pnl.style.transition = '';
      if (scr) scr.style.transition = '';
    }, SETTLE_MS);
  };

  return {
    /** Spread onto the drawer's panel: dragging it toward its edge closes it. */
    panelProps: { onPointerDownCapture: press('close'), onPointerMove: move, onPointerUp: release, onPointerCancel: release },
    /** Spread onto a strip along the drawer's edge: dragging from it opens a closed drawer. */
    edgeProps: { onPointerDown: press('open'), onPointerMove: move, onPointerUp: release, onPointerCancel: release },
  };
}

'use client';
import { useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { springCss } from '@/lib/motion';

/* Pull-to-refresh for a scroller at its top: drag down and the content follows (with rubber-band resistance) while a
   spinner fades in; past the threshold, release holds the content open for the refresh and calls `onRefresh`.
   The hook writes transforms straight to the content and the spinner during the drag, so React doesn't render per
   pointer move. */

interface Pull { y0: number; x0: number; on: boolean; armed: boolean }

interface Options {
  /** Called when a pull is released past the threshold. Pull-to-refresh is off without it. */
  onRefresh?: () => void;
  /** The scroller the pull starts on (it must be at its top). */
  scroller: RefObject<HTMLElement | null>;
  /** The content that follows the finger. */
  content: RefObject<HTMLElement | null>;
  /** The spinner that fades in as the pull grows. */
  spinner: RefObject<HTMLElement | null>;
}

/** How long the refresh is held open before `onRefresh` runs and the content settles back. */
const HOLD_MS = 1100;
/** How far the content sits while refreshing, px, and the pull (px) past which a release arms a refresh. */
const HELD = 52;
const ARM = 54;

export function usePullToRefresh({ onRefresh, scroller, content, spinner }: Options) {
  const pull = useRef<Pull | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const down = (e: ReactPointerEvent) => {
    if (!onRefresh || refreshing || e.button) return;
    if ((scroller.current?.scrollTop ?? 0) > 2) return;
    pull.current = { y0: e.clientY, x0: e.clientX, on: false, armed: false };
  };

  const move = (e: ReactPointerEvent) => {
    const d = pull.current;
    if (!d) return;
    const dy = e.clientY - d.y0, dx = e.clientX - d.x0;
    if (!d.on) {
      if (dy > 10 && dy > Math.abs(dx) * 1.3 && (scroller.current?.scrollTop ?? 0) <= 1) {
        d.on = true;
        try { scroller.current?.setPointerCapture(e.pointerId); } catch { /* no active pointer (synthetic input) */ }
      } else if (dy < -6) { pull.current = null; return; }
      else return;
    }
    const t = Math.min(110, 56 * Math.log1p(Math.max(0, dy - 10) / 40));
    const c = content.current, sp = spinner.current;
    if (c) { c.style.transition = 'none'; c.style.transform = `translateY(${t}px)`; }
    if (sp) { sp.style.opacity = String(Math.min(1, t / 58)); sp.style.transform = `translateX(-50%) rotate(${t * 3.2}deg) scale(${Math.min(1, 0.5 + t / 90)})`; }
    d.armed = t > ARM;
  };

  const end = () => {
    const d = pull.current;
    if (!d) return;
    pull.current = null;
    if (!d.on) return;
    const c = content.current, sp = spinner.current;
    const clearAfter = (ms: number) => setTimeout(() => { if (c) { c.style.transition = ''; c.style.transform = ''; } }, ms);
    if (d.armed) {
      setRefreshing(true);
      if (c) { c.style.transition = springCss('transform', 'snappy'); c.style.transform = `translateY(${HELD}px)`; }
      if (sp) { sp.style.opacity = '1'; sp.style.transform = 'translateX(-50%)'; }
      setTimeout(() => {
        setRefreshing(false);
        if (c) { c.style.transition = springCss('transform', 'smooth'); c.style.transform = 'translateY(0)'; }
        if (sp) sp.style.opacity = '0';
        onRefresh?.();
        clearAfter(560);
      }, HOLD_MS);
    } else {
      if (c) {
        c.style.transition = springCss('transform', 'snappy'); c.style.transform = 'translateY(0)';
        clearAfter(400);
      }
      if (sp) sp.style.opacity = '0';
    }
  };

  return {
    refreshing,
    /** Spread onto the scroller. */
    bind: { onPointerDown: down, onPointerMove: move, onPointerUp: end, onPointerCancel: end },
  };
}

import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Haptics } from './haptics';

/* ══ useSheetDrag — the grow/snap/fold gesture behind FloatingSheet's cap and Composer's draggable bump ══
   A handle pulls a body out one-to-one with the pointer between a resting height (`peek`) and `maxReveal`.
   Release snaps open past 35% of the travel, else closed; with `minimizable`, travel below the resting
   height folds the surface into a FAB (reported as `dragMinimize` 0–1 while dragging). Snaps tick. */

/** Pointer travel below which a handle drag counts as a tap. */
export const SHEET_TAP_SLOP = 4;
/** Extra downward travel (past the peek) that folds the surface into its FAB. */
export const SHEET_MINIMIZE_TRAVEL = 96;
/** Fraction of the open travel past which a release snaps open. */
export const SHEET_OPEN_THRESHOLD = 0.35;

export interface SheetDragOptions {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Body height visible at rest. */
  peek: number;
  /** Body height when fully open. */
  maxReveal: number;
  /** Allow dragging below the resting height to fold into a FAB. */
  minimizable?: boolean;
  minimized?: boolean;
  onMinimizedChange?: (minimized: boolean) => void;
}

export interface SheetDragState {
  /** Live body height while dragging; null when settled. */
  dragReveal: number | null;
  /** Live fold progress (0–1) while dragging below rest; null when settled. */
  dragMinimize: number | null;
  dragging: boolean;
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

export function useSheetDrag({
  open,
  onOpenChange,
  peek,
  maxReveal,
  minimizable = false,
  onMinimizedChange,
}: SheetDragOptions): SheetDragState {
  const [dragReveal, setDragReveal] = useState<number | null>(null);
  const [dragMinimize, setDragMinimize] = useState<number | null>(null);
  const drag = useRef({ active: false, y: 0, from: 0, moved: false });

  // Travel below the resting height first closes the peek, then folds the surface into its FAB.
  const minimizeTravel = peek + SHEET_MINIMIZE_TRAVEL;
  const minimizeFor = (rawReveal: number) =>
    minimizable && rawReveal < peek ? Math.min(1, (peek - rawReveal) / minimizeTravel) : 0;

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    drag.current = { active: true, y: event.clientY, from: open ? maxReveal : peek, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    if (!drag.current.active) return;
    const delta = drag.current.y - event.clientY;
    if (!drag.current.moved && Math.abs(delta) < SHEET_TAP_SLOP) return;
    drag.current.moved = true;
    // The handle pulls the body out one-to-one with the pointer.
    const rawReveal = drag.current.from + delta;
    setDragReveal(Math.max(minimizable ? 0 : Math.min(peek, maxReveal), Math.min(maxReveal, rawReveal)));
    setDragMinimize(minimizeFor(rawReveal));
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLElement>) => {
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
    const nextOpen = !shouldMinimize && settled > peek + (maxReveal - peek) * SHEET_OPEN_THRESHOLD;
    setDragReveal(null);
    setDragMinimize(null);
    onMinimizedChange?.(shouldMinimize);
    if (nextOpen !== open) {
      Haptics.selection();
      onOpenChange(nextOpen);
    } else if (shouldMinimize) {
      Haptics.selection();
    }
  };

  const cancel = () => {
    drag.current.active = false;
    setDragReveal(null);
    setDragMinimize(null);
  };

  const toggle = () => {
    // Pointer drags settle in onPointerUp; only real taps should toggle.
    if (drag.current.moved) {
      drag.current.moved = false;
      return;
    }
    Haptics.selection();
    onMinimizedChange?.(false);
    onOpenChange(!open);
  };

  return {
    dragReveal,
    dragMinimize,
    dragging: dragReveal != null,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: cancel, onLostPointerCapture: cancel },
    toggle,
  };
}

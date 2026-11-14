import { bindDrag, isRTL, type Side } from '@ui-sdk/core';
import { sheetPhysics } from '@ui-sdk/core/drawer';
import { createVelocityTracker, projectDistance } from '@ui-sdk/core/gesture';

/* ══ bindEdgeSwipe — a swipe in from an element's edge ══
   The swipe that goes back a page or pulls a panel out from the side: a press in a strip along the edge waits for
   the pointer to move; away from the edge starts the swipe, along it stays the browser's scroll (give the element
   `touch-action: pan-y` for a side edge, `pan-x` for the top or bottom; a finger's swipe over a scroller inside
   is held from the browser's pan once it is ours). Letting go finishes it past `threshold` of
   the element, or sooner with a flick (the distance the speed would still carry it, UIScrollView's deceleration;
   a release slower than UI SDK's sheets count as a fling carries nothing, so a slow short drag springs back).
   The pointer is followed by UI SDK's `bindDrag` once the direction is known, so a press that lifts first stays a
   click and a finished swipe never clicks what it ends on. When swipes are nested (a stack inside a stack), the
   innermost binding that accepts a press takes it; the ones around it leave it alone. ══ */

/** What the callbacks receive. */
export interface EdgeSwipeDetails {
  /** The pointer event behind it: the move that started or carried the swipe, or the one that ended it. */
  event: PointerEvent;
}

/** What `onEnd` receives. */
export interface EdgeSwipeEndDetails extends EdgeSwipeDetails {
  /** How fast the pointer left, px/ms, positive away from the edge. 0 for a swipe cut short. */
  velocity: number;
}

export interface BindEdgeSwipeOptions {
  /** The edge a swipe starts from. `start` and `end` follow the reading direction at press time. Default `start`. */
  side?: Side;
  /** How far in from the edge a press can start a swipe, px. `Infinity` starts one anywhere. Default 24. */
  size?: number;
  /** The fraction of the element's size, counting a flick's carry, that finishes the swipe. Default 1/3. */
  threshold?: number;
  /** Runs once the pointer has moved away from the edge, before the first `onMove`. Return `false` to refuse:
   *  the press goes on as if nothing were bound (and a binding around this one may take it). */
  onStart?: (details: EdgeSwipeDetails) => boolean | void;
  /** How far across the element the pointer is, 0 to 1, at most once a frame. */
  onMove?: (progress: number, details: EdgeSwipeDetails) => void;
  /** Once, when a started swipe ends: whether it went far or fast enough. A swipe the browser took over (a
   *  `pointercancel`), or one under way when the cleanup runs, ends unfinished. */
  onEnd?: (committed: boolean, details: EdgeSwipeEndDetails) => void;
}

/** How far a press moves before its direction decides whether it is a swipe. */
const SLOP = 8;
/** UIScrollView's normal deceleration, per ms, for how far a flick would carry on. */
const DECELERATION = 0.998;
/** Below this speed (px/ms) a release is no flick: where the finger let go decides. UI SDK's sheets' threshold. */
const MIN_FLICK = sheetPhysics.ios.minFlingVelocity;

const CLAIMED = Symbol.for('bl-ui.edge-swipe@1');
/** Presses a binding has taken, so the bindings around it leave them alone. One set per page (`Symbol.for`), so
 *  bindings from two copies of the library nest too. */
const claimed: WeakSet<PointerEvent> = ((globalThis as unknown as { [CLAIMED]?: WeakSet<PointerEvent> })[CLAIMED] ??=
  new WeakSet());

type Physical = 'left' | 'right' | 'top' | 'bottom';
const physical = (side: Side, rtl: boolean): Physical =>
  side === 'start' ? (rtl ? 'right' : 'left') : side === 'end' ? (rtl ? 'left' : 'right') : side;
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Lets a pointer swipe in from an edge of `el`. Returns a cleanup, which ends a swipe under way as unfinished.
 *
 *  ```ts
 *  bind: (el, { api }) =>
 *    bindEdgeSwipe(el, {
 *      onStart: () => api.canGoBack(),
 *      onMove: (progress) => el.style.setProperty('--progress', String(progress)),
 *      onEnd: (committed, { event }) => committed && api.goBack(event),
 *    }),
 *  ``` */
export function bindEdgeSwipe(el: HTMLElement, options: BindEdgeSwipeOptions = {}): () => void {
  const doc = el.ownerDocument;
  /** Stops the press being watched or followed now, without reporting anything. */
  let stop: (() => void) | undefined;
  /** Ends a swipe under way as unfinished. */
  let abort: (() => void) | undefined;

  const onDown = (down: PointerEvent) => {
    if (stop || !down.isPrimary || down.button !== 0 || claimed.has(down)) return;
    const side = physical(options.side ?? 'start', isRTL(el));
    const horizontal = side === 'left' || side === 'right';
    // 1 for a swipe that moves right or down on screen, -1 for the other way.
    const sign = side === 'left' || side === 'top' ? 1 : -1;
    const along = (e: PointerEvent) => (horizontal ? e.clientX : e.clientY);
    const across = (e: PointerEvent) => (horizontal ? e.clientY : e.clientX);
    const box = el.getBoundingClientRect();
    const inset = (along(down) - box[side]) * sign;
    if (inset < 0 || inset > (options.size ?? 24)) return;
    const extent = (horizontal ? box.width : box.height) || 1;
    const travel = (e: PointerEvent) => (along(e) - along(down)) * sign;
    const velocity = createVelocityTracker();
    velocity.add(down.timeStamp, along(down));
    const move = (e: PointerEvent) => {
      velocity.add(e.timeStamp, along(e));
      options.onMove?.(clamp01(travel(e) / extent), { event: e });
    };

    // Waiting for the direction: nothing is captured, so a press that lifts first stays a click.
    const watch = (e: PointerEvent) => {
      if (e.pointerId !== down.pointerId) return;
      const away = travel(e);
      const aside = Math.abs(across(e) - across(down));
      if (Math.hypot(away, aside) < SLOP) return;
      unwatch();
      // Along the edge first is a scroll, and toward it goes nowhere.
      if (away <= aside || claimed.has(down) || options.onStart?.({ event: e }) === false) return;
      claimed.add(down);
      follow(e);
    };
    const release = (e: PointerEvent) => {
      if (e.pointerId === down.pointerId) unwatch();
    };
    const unwatch = () => {
      doc.removeEventListener('pointermove', watch);
      doc.removeEventListener('pointerup', release);
      doc.removeEventListener('pointercancel', release);
      stop = undefined;
    };
    doc.addEventListener('pointermove', watch);
    doc.addEventListener('pointerup', release);
    doc.addEventListener('pointercancel', release);
    stop = unwatch;

    // A finger's swipe that starts over a scroller inside (a page's content) is that scroller's to pan: its
    // touch-action, not this element's, decides, and the browser would cancel the pointer as soon as it pans. While
    // this touch is down, a non-passive touchmove keeps the browser from panning once the swipe is ours (pointer
    // events come before touch events, so `watch` has decided by then). Only for this touch: a non-passive
    // listener makes every scroll wait for the main thread.
    if (down.pointerType === 'touch') {
      const hold = (e: TouchEvent) => {
        if (claimed.has(down) && e.cancelable) e.preventDefault();
      };
      const done = () => {
        el.removeEventListener('touchmove', hold);
        el.removeEventListener('touchend', done);
        el.removeEventListener('touchcancel', done);
      };
      el.addEventListener('touchmove', hold, { passive: false });
      el.addEventListener('touchend', done);
      el.addEventListener('touchcancel', done);
    }

    const follow = (first: PointerEvent) => {
      let last = first;
      const end = (event: PointerEvent, canceled: boolean) => {
        stop = abort = undefined;
        const speed = canceled ? 0 : velocity.velocity(event.timeStamp) * sign;
        const reach = travel(event) + (Math.abs(speed) < MIN_FLICK ? 0 : projectDistance(speed, DECELERATION));
        options.onEnd?.(!canceled && reach >= extent * (options.threshold ?? 1 / 3), { event, velocity: speed });
      };
      const drag = bindDrag(el, first, {
        onMove: ({ event }) => {
          last = event;
          move(event);
        },
        onEnd: end,
      });
      stop = drag;
      abort = () => {
        drag();
        end(last, true);
      };
      move(first);
    };
  };

  el.addEventListener('pointerdown', onDown);
  return () => {
    el.removeEventListener('pointerdown', onDown);
    if (abort) abort();
    else stop?.();
  };
}

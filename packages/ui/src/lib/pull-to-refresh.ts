import { announce, sourceOf, type ActionDetails } from '@ui-sdk/core';
import { rubberBand } from '@ui-sdk/core/gesture';
import { prefersReducedMotion } from '@/lib/reduced-motion';

/* ══ bindPullToRefresh — pull a scroller down from its top to refresh it ══
   As a phone's inbox does: the pull resists like a rubber band (UI SDK's `rubberBand`), and letting go past
   `threshold` runs `onRefresh`, with the pull held open while its Promise is pending. Everything is written on the
   scroller itself, so nothing re-renders while a finger moves:
     data-pulling                 a finger is pulling
     data-pending + aria-busy     a refresh is pending (the pull holds at `threshold`)
     --pull-distance              how far the pull shows, px (0px with reduced motion)
     --pull-progress              0..1, reaching 1 at `threshold` (moves with reduced motion too)
   A pull starts only at the top, from one finger whose first move is down and mostly vertical, outside a nested
   scroller, so a scroll, a sideways swipe and an inner scroller keep their gestures. The non-passive `touchmove`
   that lets a pull hold the page still is added only while a touch that can pull is down, so ordinary scrolling
   never waits on the main thread. The scroller gets `overscroll-behavior-y: contain`, which keeps the browser's own
   pull to refresh off it. Touch only: `refresh()` on the returned cleanup is the button or key. ══ */

/** What `onRefresh` receives. */
export interface PullToRefreshDetails extends ActionDetails {
  /** The `touchend` that let go of the pull; undefined for `refresh()` from code. */
  event?: TouchEvent;
}

export interface BindPullToRefreshOptions {
  /** Refreshes the content. Return a Promise to hold the pull open (`data-pending`) until it settles; further
   *  pulls wait for it. */
  onRefresh: (details: PullToRefreshDetails) => unknown;
  /** How far the pull shows, px, before letting go refreshes (the finger travels about twice as far). Default 64. */
  threshold?: number;
  /** Whether a pull can't start, and `refresh()` does nothing. Read on every use. */
  disabled?: () => boolean;
  /** What screen readers hear once a refresh has been pending for a second. Default "Loading". */
  pendingAnnouncement?: string;
}

/** The cleanup `bindPullToRefresh` returns, with a way to refresh without a gesture. */
export type PullToRefresh = (() => void) & {
  /** Refreshes as a pull past the threshold does, from a button or a key. */
  refresh: () => void;
};

/** How long a refresh is pending before it is announced, ms. */
const ANNOUNCE_AFTER = 1000;

interface Pull {
  x: number;
  y: number;
  /** The gesture is ours: decided by its first move. */
  claimed: boolean;
  /** The content stays put, for someone who prefers reduced motion. */
  still: boolean;
  distance: number;
}

/** Lets a finger pull `scroller` down from its top to refresh it. Returns a cleanup with `refresh()`.
 *
 *  ```ts
 *  list: slot({ bind: (el, { api }) => bindPullToRefresh(el, { onRefresh: () => api.reload() }) })
 *  ``` */
export function bindPullToRefresh(scroller: HTMLElement, options: BindPullToRefreshOptions): PullToRefresh {
  const view = scroller.ownerDocument.defaultView;
  const threshold = () => options.threshold ?? 64;
  const reducedMotion = () => prefersReducedMotion(view);
  let pull: Pull | undefined;
  let pending = false;
  let bound = true;
  let announcing: ReturnType<typeof setTimeout> | undefined;

  const show = (distance: number, still: boolean) => {
    scroller.style.setProperty('--pull-distance', `${still ? 0 : distance}px`);
    scroller.style.setProperty('--pull-progress', String(Math.min(1, distance / threshold())));
  };

  const setPending = (next: boolean) => {
    pending = next;
    clearTimeout(announcing);
    announcing = undefined;
    if (!bound) return;
    if (next) {
      scroller.setAttribute('data-pending', '');
      scroller.setAttribute('aria-busy', 'true');
      announcing = setTimeout(
        () => announce(options.pendingAnnouncement ?? 'Loading', { doc: scroller.ownerDocument }),
        ANNOUNCE_AFTER,
      );
    } else {
      scroller.removeAttribute('data-pending');
      scroller.removeAttribute('aria-busy');
    }
    show(next ? threshold() : 0, reducedMotion());
  };

  const refresh = (event?: TouchEvent) => {
    if (!bound || pending || options.disabled?.()) return;
    const result = options.onRefresh({ source: event ? sourceOf(event) : 'programmatic', event });
    if (!result || typeof (result as PromiseLike<unknown>).then !== 'function') return;
    setPending(true);
    const settle = () => {
      if (pending) setPending(false);
    };
    (result as PromiseLike<unknown>).then(settle, settle);
  };

  /** A scroller of its own under the finger takes the gesture. */
  const scrollsInside = (target: EventTarget | null) => {
    for (let node = target instanceof Element ? target : null; node && node !== scroller; node = node.parentElement) {
      if (node.scrollHeight > node.clientHeight && /auto|scroll/.test(getComputedStyle(node).overflowY)) return true;
    }
    return false;
  };

  const onMove = (event: TouchEvent) => {
    const touch = event.touches[0];
    if (!pull || !touch) return;
    const down = touch.clientY - pull.y;
    if (!pull.claimed) {
      // The first move decides, as it does for the browser: a pull down from the top is ours, anything else its scroll.
      const pulls = event.cancelable && down > 0 && down >= Math.abs(touch.clientX - pull.x) && scroller.scrollTop <= 0;
      if (!pulls) {
        end();
        return;
      }
      pull.claimed = true;
      scroller.setAttribute('data-pulling', '');
    }
    if (event.cancelable) event.preventDefault();
    pull.distance = rubberBand(down, scroller.clientHeight);
    show(pull.distance, pull.still);
  };

  const end = (event?: TouchEvent) => {
    const ended = pull;
    pull = undefined;
    scroller.removeEventListener('touchmove', onMove);
    if (!ended?.claimed) return;
    scroller.removeAttribute('data-pulling');
    show(0, ended.still);
    if (event?.type === 'touchend' && ended.distance >= threshold()) refresh(event);
  };

  const onStart = (event: TouchEvent) => {
    end();
    const touch = event.touches[0];
    const starts =
      event.touches.length === 1 && !pending && !options.disabled?.() && scroller.scrollTop <= 0 && !scrollsInside(event.target);
    if (!starts || !touch) return;
    pull = { x: touch.clientX, y: touch.clientY, claimed: false, still: reducedMotion(), distance: 0 };
    // Only now, for this touch: a non-passive listener makes every scroll wait for the main thread.
    scroller.addEventListener('touchmove', onMove, { passive: false });
  };
  const onEnd = (event: TouchEvent) => end(event);

  const contained = scroller.style.getPropertyValue('overscroll-behavior-y');
  scroller.style.setProperty('overscroll-behavior-y', 'contain');
  scroller.addEventListener('touchstart', onStart, { passive: true });
  scroller.addEventListener('touchend', onEnd);
  scroller.addEventListener('touchcancel', onEnd);

  const cleanup = () => {
    end();
    if (pending) setPending(false);
    bound = false;
    scroller.removeEventListener('touchstart', onStart);
    scroller.removeEventListener('touchend', onEnd);
    scroller.removeEventListener('touchcancel', onEnd);
    scroller.style.setProperty('overscroll-behavior-y', contained);
    scroller.style.removeProperty('--pull-distance');
    scroller.style.removeProperty('--pull-progress');
  };
  return Object.assign(cleanup, { refresh: () => refresh() });
}

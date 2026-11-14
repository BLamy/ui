'use client';
import { useEffect, useState, type RefObject } from 'react';
import { useChromeHidden } from '@/lib/theme';

/* ══ Scroll edge — whether a scroller has left its top ══
   The one implementation behind the bars that change as their content scrolls (NavigationStack's pages,
   SplitView's panes): it reports when the scroller crosses a threshold (a few px, or the bottom of a large title,
   read on every scroll so it follows the layout) and, for a bar that hides on scroll, every move with its
   direction. `bindScrollEdge` is framework-free: call it from a primitive slot's `bind` and return its cleanup.
   `useHideOnScroll` is the React form for floating chrome (FloatingSheet, ArtifactChatContainer's floating chat). */

export interface BindScrollEdgeOptions {
  /** How far, px, the scroller has to scroll to count as scrolled. Read at bind and on every scroll. */
  threshold: () => number;
  /** It scrolled past `threshold`, or back above it. Also at bind when it starts past it. */
  onChange: (scrolled: boolean) => void;
  /** Every scroll, with how far it moved since the one before (positive down). */
  onScroll?: (y: number, dy: number) => void;
}

/** Follows `el`'s vertical scroll. Returns the cleanup. */
export function bindScrollEdge(el: HTMLElement, { threshold, onChange, onScroll }: BindScrollEdgeOptions): () => void {
  let scrolled = false;
  let last = el.scrollTop;
  const check = () => {
    const y = el.scrollTop;
    const now = y > threshold();
    if (now !== scrolled) {
      scrolled = now;
      onChange(now);
    }
    return y;
  };
  const handle = () => {
    const y = check();
    onScroll?.(y, y - last);
    last = y;
  };
  check();
  el.addEventListener('scroll', handle, { passive: true });
  return () => el.removeEventListener('scroll', handle);
}

/** Whether floating chrome should hide: the shared chrome state says the bars are hidden (`useChromeHidden`), or
    `scrollRef` was scrolled down (it comes back on a scroll up and at the top; moves of 3px or less are noise).
    Always false while `hideOnScroll` is off. */
export function useHideOnScroll(hideOnScroll: boolean, scrollRef?: RefObject<HTMLElement | null>): boolean {
  const chromeHidden = useChromeHidden();
  const [scrolledDown, setScrolledDown] = useState(false);
  useEffect(() => {
    const scroller = scrollRef?.current;
    if (!scroller || !hideOnScroll) {
      setScrolledDown(false);
      return;
    }
    return bindScrollEdge(scroller, {
      threshold: () => 3,
      onChange: (scrolled) => {
        if (!scrolled) setScrolledDown(false);
      },
      onScroll: (y, dy) => {
        if (y < 4) setScrolledDown(false);
        else if (dy > 3) setScrolledDown(true);
        else if (dy < -3) setScrolledDown(false);
      },
    });
  }, [scrollRef, hideOnScroll]);
  return hideOnScroll && (chromeHidden || scrolledDown);
}

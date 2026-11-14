/* ══ Scroll edge — whether a scroller has left its top ══
   The one implementation behind the bars that change as their content scrolls (NavigationStack's pages,
   SplitView's panes): it reports when the scroller crosses a threshold (a few px, or the bottom of a large title,
   read on every scroll so it follows the layout) and, for a bar that hides on scroll, every move with its
   direction. Framework-free: call it from a primitive slot's `bind` and return its cleanup. */

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

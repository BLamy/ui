import { useLayoutEffect, useRef, type ReactNode } from 'react';

/** Internal: reports its rendered height (used by Credenza's morphing body). */
export function MeasureH({ onH, children }: { onH: (h: number) => void; children?: ReactNode }) {
  const r = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const el = r.current; if (!el) return;
    onH(el.offsetHeight);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => { if (r.current) onH(r.current.offsetHeight); });
    ro.observe(el); return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [children]);
  return <div ref={r}>{children}</div>;
}

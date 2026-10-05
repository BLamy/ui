'use client';
import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { cn } from '@/lib/utils';

/* ══ Filmstrip — a row of frames across a stretch of media time ══
   Give it frames (`time` and an image `src`, e.g. from `useMediaFrames`) and the media range it stands for (`from`…`to`,
   a clip's in and out points); it tiles its width with frame-shaped cells, each showing the frame nearest the time it
   covers, so it reads right at any width or zoom. Cells keep the media's aspect (`aspect`, else the first frame's).
   Decorative: it is hidden from assistive tech; the clip it sits in carries the label. ══ */

export interface FilmstripFrame {
  /** Media time, seconds. */
  time: number;
  src: string;
}

export interface FilmstripProps {
  frames: readonly FilmstripFrame[];
  /** The media time at the left edge. Default: the first frame's. */
  from?: number;
  /** The media time at the right edge. Default: the last frame's. */
  to?: number;
  /** Width over height of a frame. Default: measured from the first frame, else 16 / 9. */
  aspect?: number;
  className?: string;
  style?: CSSProperties;
}

export function Filmstrip({ frames, from, to, aspect, className, style }: FilmstripProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [measured, setMeasured] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const read = () => setBox((b) => (b.w === el.clientWidth && b.h === el.clientHeight ? b : { w: el.clientWidth, h: el.clientHeight }));
    read();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const first = frames[0]?.src;
  useLayoutEffect(() => {
    if (aspect || !first) return undefined;
    let live = true;
    const img = new Image();
    img.onload = () => { if (live && img.naturalHeight) setMeasured(img.naturalWidth / img.naturalHeight); };
    img.src = first;
    return () => { live = false; };
  }, [aspect, first]);

  const ratio = aspect ?? measured ?? 16 / 9;
  const cell = Math.max(8, box.h * ratio);
  const count = frames.length && box.w ? Math.ceil(box.w / cell) : 0;
  const a = from ?? frames[0]?.time ?? 0;
  const b = to ?? frames[frames.length - 1]?.time ?? a;
  const sorted = frames.length > 1 && frames.some((f, i) => i && f.time < frames[i - 1].time) ? [...frames].sort((x, y) => x.time - y.time) : frames;
  const nearest = (t: number) => {
    let lo = 0, hi = sorted.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (sorted[mid].time < t) lo = mid + 1;
      else hi = mid;
    }
    return lo > 0 && Math.abs(sorted[lo - 1].time - t) <= Math.abs(sorted[lo].time - t) ? sorted[lo - 1] : sorted[lo];
  };

  return (
    <div ref={ref} data-slot="filmstrip" aria-hidden className={cn('relative flex h-full w-full overflow-hidden', className)} style={style}>
      {Array.from({ length: count }, (_, i) => {
        // The time at the middle of the cell's share of the strip.
        const t = a + ((i + 0.5) * cell / Math.max(1, box.w)) * (b - a);
        const f = nearest(t);
        return (
          <div key={i} className="h-full w-(--cell) shrink-0 bg-(image:--frame) bg-cover bg-center"
            style={{ '--cell': `${cell}px`, '--frame': f ? `url("${f.src}")` : 'none' } as CSSProperties} />
        );
      })}
    </div>
  );
}

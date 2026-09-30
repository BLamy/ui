'use client';
import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { animate, motion, useMotionValue, useTransform, type AnimationPlaybackControls } from 'framer-motion';
import { cn } from '@/lib/utils';
import { prefersReducedMotion, springs } from '@/lib/motion';

/* ══ SnapSheet — vaul-style bottom drawer (drag handle, snap points, velocity release) ══
   The panel's offset is a spring-driven motion value: it rises in on open, follows the finger one-to-one
   (rubber-banding past the top snap), and on release the finger's velocity is projected to pick a snap —
   or dismiss — and carried into the spring, so a flick keeps its momentum. Grabbing mid-flight catches it. */
export interface SnapSheetProps {
  open: boolean;
  onClose: () => void;
  snaps?: number[];
  children?: React.ReactNode;
  /** Classes for the sheet surface (the panel), merged last — e.g. `bg-background` for a surface other than `bg-card`. */
  className?: string;
  /** Styles for the sheet surface (the panel). */
  style?: React.CSSProperties;
}
export function SnapSheet({ open, onClose, snaps: snapsProp, children, className, style }: SnapSheetProps) {
  const snaps = snapsProp || [0.55, 0.94];
  const maxS = Math.max(...snaps);
  const [vis, setVis] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const y = useMotionValue(10000); // px the panel is pushed down from its tallest snap
  const anim = useRef<AnimationPlaybackControls | null>(null);
  const st = useRef({ drag: false, y0: 0, ty0: 0, samples: [] as { t: number; y: number }[] });
  const ch = () => (wrap.current ? wrap.current.offsetHeight : 700);
  const restTy = (idx: number) => ch() * (maxS - snaps[idx]);
  // The scrim follows the panel: fully dim at the tallest snap, clear when it is gone.
  const fade = useTransform(y, (v) => {
    const h = ch();
    return Math.min(1, Math.max(0, (maxS - v / h) / maxS));
  });

  const springTo = (to: number, velocity = 0, done?: () => void) => {
    anim.current?.stop();
    if (prefersReducedMotion()) {
      y.set(to);
      done?.();
      return;
    }
    anim.current = animate(y, to, { ...springs.tray, velocity, onComplete: done });
  };

  useEffect(() => {
    if (open) {
      setVis(true);
    } else if (vis) {
      springTo(ch() * maxS, 0, () => setVis(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  // Once mounted, rise from below the edge to the first snap.
  React.useLayoutEffect(() => {
    if (!vis || !open) return;
    y.set(ch() * maxS);
    springTo(restTy(0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vis]);
  useEffect(() => () => anim.current?.stop(), []);

  if (!open && !vis) return null;
  const down = (e: React.PointerEvent<HTMLDivElement>) => {
    anim.current?.stop();
    st.current = { drag: true, y0: e.clientY, ty0: y.get(), samples: [{ t: e.timeStamp, y: e.clientY }] };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = st.current;
    if (!s.drag) return;
    s.samples.push({ t: e.timeStamp, y: e.clientY });
    if (s.samples.length > 6) s.samples.shift();
    let t = s.ty0 + (e.clientY - s.y0);
    const top = restTy(snaps.indexOf(maxS));
    if (t < top) t = top - Math.pow(top - t, 0.72);
    y.set(Math.max(0, t));
  };
  const up = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = st.current;
    if (!s.drag) return;
    s.drag = false;
    const recent = s.samples.filter((p) => e.timeStamp - p.t < 90);
    const first = recent[0] ?? s.samples[0];
    const v = first ? (e.clientY - first.y) / Math.max(1, e.timeStamp - first.t) : 0; // px/ms, down = +
    const cur = y.get();
    const proj = cur + v * 200;
    const H = ch();
    let best = -1,
      bd = Infinity;
    snaps.forEach((f, i) => {
      const d = Math.abs(proj - H * (maxS - f));
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    if (Math.abs(proj - H * maxS) < bd || proj > H * (maxS - Math.min(...snaps)) + H * 0.12) {
      springTo(H * maxS, v * 1000);
      onClose();
      return;
    }
    springTo(restTy(best), v * 1000);
  };
  return (
    <div ref={wrap} data-slot="snap-sheet" className="absolute inset-0 z-70 overflow-hidden">
      <motion.div data-slot="snap-sheet-scrim" onClick={onClose} className="absolute inset-0 bg-black/45" style={{ opacity: fade }} />
      <motion.div
        data-slot="snap-sheet-panel"
        className={cn(
          'absolute right-0 bottom-0 left-0 flex h-(--sheet-h) touch-none flex-col rounded-t-2xl border-x border-t border-border bg-card shadow-[0_-12px_40px_black] shadow-black/8 dark:shadow-black/50',
          className,
        )}
        // y is the gesture's motion value; the height comes from the snap points
        style={{ ...style, y, '--sheet-h': maxS * 100 + '%' } as never}
      >
        <div
          data-slot="snap-sheet-handle"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          className="shrink-0 cursor-grab touch-none pt-2 pb-1"
        >
          <div className="mx-auto h-[5px] w-[38px] rounded-[3px] bg-handle" />
        </div>
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </motion.div>
    </div>
  );
}

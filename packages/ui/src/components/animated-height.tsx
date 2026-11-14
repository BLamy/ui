'use client';
import { useLayoutEffect, useRef, useState, type HTMLAttributes, type ReactNode, type Ref } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { springs, type SpringName } from '@/lib/motion';
import { cn } from '@/lib/utils';

/* ══ AnimatedHeight — a container that changes size instead of cutting ══
   It measures its content and springs its own height to match, so a tray going from a two-line step to a
   five-line step grows rather than jumps. Pair it with `Swap` for Family's tray step:
   `<AnimatedHeight><Swap value={step} direction={dir}>`. The height is a spring-animated value (framer-motion);
   under reduced motion it changes at once. */

export interface AnimatedHeightProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'onAnimationStart' | 'onDrag' | 'onDragStart' | 'onDragEnd' | 'onAnimationEnd' | 'onAnimationIteration'> {
  children?: ReactNode;
  /** Spring for the height (default `tray`): `tray` for sheets and trays, `smooth` for panels, `snappy` for small
   *  controls, `bouncy` for a playful overshoot. */
  spring?: SpringName;
  ref?: Ref<HTMLDivElement>;
}

export function AnimatedHeight({ children, spring = 'tray', className, ...props }: AnimatedHeightProps) {
  const inner = useRef<HTMLDivElement | null>(null);
  const [h, setH] = useState<number | 'auto'>('auto');
  const reduced = useReducedMotion();
  useLayoutEffect(() => {
    const el = inner.current;
    if (!el) return;
    const m = () => setH(el.offsetHeight);
    m();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(m);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <motion.div {...props} data-slot="animated-height" className={cn('overflow-hidden', className)}
      initial={false} animate={{ height: h }} transition={reduced ? { duration: 0 } : springs[spring]}>
      <div ref={inner} className="flow-root">{children}</div>
    </motion.div>
  );
}

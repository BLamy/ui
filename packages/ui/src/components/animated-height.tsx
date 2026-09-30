import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { fades, springs, type SpringName } from '@/lib/motion';
import { cn } from '@/lib/utils';

/* ══ AnimatedHeight / ContentSwap — trays that change size instead of cutting ══
   AnimatedHeight measures its content and springs its own height to match, so a tray going from a two-line
   step to a five-line step grows rather than jumps. ContentSwap replaces its content by key: the old view
   leaves and the new one arrives in the direction of travel (forward → from the right), blurred through the
   middle. Together they are Family's tray step: `<AnimatedHeight><ContentSwap id={step} direction={dir}>`. */

export interface AnimatedHeightProps {
  children?: ReactNode;
  /** Spring preset for the height (default `tray`). */
  spring?: SpringName;
  className?: string;
  style?: CSSProperties;
}

export function AnimatedHeight({ children, spring = 'tray', className, style }: AnimatedHeightProps) {
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
    <motion.div data-slot="animated-height" className={cn('overflow-hidden', className)} style={style}
      initial={false} animate={{ height: h }} transition={reduced ? { duration: 0 } : springs[spring]}>
      <div ref={inner} className="flow-root">{children}</div>
    </motion.div>
  );
}

export interface ContentSwapProps {
  /** Identity of the current view — changing it swaps. */
  id: string | number;
  /** -1 back / 1 forward (slides horizontally); 0 swaps in place with a small scale. See `useDirection`. */
  direction?: -1 | 0 | 1;
  /** Travel distance in px for a directional swap. */
  distance?: number;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function ContentSwap({ id, direction = 0, distance = 36, children, className, style }: ContentSwapProps) {
  const reduced = useReducedMotion();
  const off = (d: number, sign: number) => reduced ? { opacity: 0 }
    : d ? { opacity: 0, x: sign * d * distance, filter: 'blur(4px)' } : { opacity: 0, scale: 0.96, filter: 'blur(4px)' };
  return (
    <div data-slot="content-swap" className={cn('relative', className)} style={style}>
      <AnimatePresence initial={false} mode="popLayout" custom={direction}>
        <motion.div
          key={id}
          custom={direction}
          variants={{
            enter: (d: number) => off(d, 1),
            center: { opacity: 1, x: 0, scale: 1, filter: 'blur(0px)' },
            exit: (d: number) => ({ ...off(d, -1), transition: reduced ? { duration: 0.1 } : { ...fades.out, x: springs.smooth } }),
          }}
          initial="enter"
          animate="center"
          exit="exit"
          transition={reduced ? { duration: 0.12 } : { x: springs.smooth, scale: springs.smooth, default: fades.in }}
          className="w-full"
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

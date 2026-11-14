'use client';
import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { springs, type SpringName } from '@/lib/motion';
import { useEnterExit, usePresenceList, type PresenceEntry } from '@/lib/presence';
import { cn } from '@/lib/utils';

/* ══ AnimatedHeight / ContentSwap — trays that change size instead of cutting ══
   AnimatedHeight measures its content and springs its own height to match, so a tray going from a two-line
   step to a five-line step grows rather than jumps. ContentSwap replaces its content by key: the old view
   leaves and the new one arrives in the direction of travel (forward → from the right), blurred through the
   middle. Together they are Family's tray step: `<AnimatedHeight><ContentSwap id={step} direction={dir}>`.
   The height is a spring-animated value (framer-motion); the views come and go with UI SDK's presence
   (`data-starting-style` / `data-ending-style`), the leaving one lifted out of the flow while it exits. */

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
  /** Blur in px at the middle of the swap. */
  blur?: number;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/* Arriving: opacity and blur on the entry fade, travel and scale on the smooth spring. Leaving: the exit fade, the
   same spring for travel. The distances come from the root's variables, so the direction a view leaves in is the
   one of the change that replaced it. Reduced motion keeps only a short fade. */
const viewClass = cn(
  'w-full',
  '[transition:opacity_220ms_cubic-bezier(.22,1,.36,1),filter_220ms_cubic-bezier(.22,1,.36,1),translate_var(--duration-spring-smooth)_var(--ease-spring-smooth),scale_var(--duration-spring-smooth)_var(--ease-spring-smooth)]',
  'data-starting-style:opacity-0 data-starting-style:blur-(--swap-blur) data-starting-style:translate-x-(--swap-enter) data-starting-style:scale-(--swap-scale)',
  'data-ending-style:opacity-0 data-ending-style:blur-(--swap-blur) data-ending-style:translate-x-(--swap-exit) data-ending-style:scale-(--swap-scale)',
  'data-ending-style:[transition:opacity_var(--duration-exit)_var(--ease-exit),filter_var(--duration-exit)_var(--ease-exit),translate_var(--duration-spring-smooth)_var(--ease-spring-smooth),scale_var(--duration-spring-smooth)_var(--ease-spring-smooth)]',
  // The leaving view is lifted out of the flow at the top, so the arriving one takes its place at once.
  'data-ending-style:absolute data-ending-style:inset-x-0 data-ending-style:top-0',
  'motion-reduce:[transition:opacity_120ms] motion-reduce:data-ending-style:[transition:opacity_100ms]',
  'motion-reduce:data-starting-style:translate-x-0 motion-reduce:data-starting-style:scale-100 motion-reduce:data-starting-style:blur-none',
  'motion-reduce:data-ending-style:translate-x-0 motion-reduce:data-ending-style:scale-100 motion-reduce:data-ending-style:blur-none',
);

function View({ entry }: { entry: PresenceEntry<{ id: string; node: ReactNode }> }) {
  const ref = useRef<HTMLDivElement>(null);
  useEnterExit(ref, entry.present, { appear: entry.appear, exited: entry.exited });
  return (
    <div ref={ref} data-slot="content-swap-view" className={viewClass}>
      {entry.item.node}
    </div>
  );
}

export function ContentSwap({ id, direction = 0, distance = 36, blur = 4, children, className, style }: ContentSwapProps) {
  const views = usePresenceList([{ id: String(id), node: children }], (v) => v.id);
  const vars = {
    '--swap-enter': `${direction * distance}px`,
    '--swap-exit': `${-direction * distance}px`,
    '--swap-scale': direction ? 1 : 0.96,
    '--swap-blur': `${blur}px`,
  } as CSSProperties;
  return (
    <div data-slot="content-swap" data-direction={direction} className={cn('relative', className)} style={{ ...vars, ...style }}>
      {views.map((entry) => (
        <View key={entry.key} entry={entry} />
      ))}
    </div>
  );
}

'use client';
import { useRef, type CSSProperties, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { springs } from '@/lib/motion';
import { useEnterExit, usePresenceList, type PresenceEntry } from '@/lib/presence';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';

/* ══ IconSwap / Chevron — icons change in place rather than cut ══
   IconSwap: when `id` changes, the old glyph shrinks and blurs out while the new one grows in, stacked in the
   same cell so nothing around it moves (copy → check, play → pause). The glyphs come and go with UI SDK's
   presence (`data-starting-style` / `data-ending-style`), and the motion is CSS on the kit's spring tokens.
   Chevron: one chevron that rotates to face a new direction (forward → down when a row expands, forward →
   back when a flow reverses). It always turns the short way round. */

export interface IconSwapProps {
  /** Identity of the current icon — changing it swaps. */
  id: string | number;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/* Arriving: opacity and blur on the entry fade, scale on the bouncy spring. Leaving is quicker: the exit fade,
   scale on the snappy spring. Reduced motion keeps only a short fade. */
const glyphClass = cn(
  'relative grid place-items-center',
  '[transition:opacity_220ms_cubic-bezier(.22,1,.36,1),filter_220ms_cubic-bezier(.22,1,.36,1),scale_var(--duration-spring-bouncy)_var(--ease-spring-bouncy)]',
  'data-starting-style:scale-40 data-starting-style:opacity-0 data-starting-style:blur-[4px]',
  'data-ending-style:scale-40 data-ending-style:opacity-0 data-ending-style:blur-[4px]',
  'data-ending-style:[transition:opacity_var(--duration-exit)_var(--ease-exit),filter_var(--duration-exit)_var(--ease-exit),scale_var(--duration-spring-snappy)_var(--ease-spring-snappy)]',
  'motion-reduce:[transition:opacity_120ms] motion-reduce:data-ending-style:[transition:opacity_100ms]',
  'motion-reduce:data-starting-style:scale-100 motion-reduce:data-starting-style:blur-none motion-reduce:data-ending-style:scale-100 motion-reduce:data-ending-style:blur-none',
);

function Glyph({ entry }: { entry: PresenceEntry<{ id: string; node: ReactNode }> }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEnterExit(ref, entry.present, { appear: entry.appear, exited: entry.exited });
  return (
    <span ref={ref} data-slot="icon-swap-glyph" className={glyphClass}>
      {entry.item.node}
    </span>
  );
}

export function IconSwap({ id, children, className, style }: IconSwapProps) {
  const glyphs = usePresenceList([{ id: String(id), node: children }], (g) => g.id);
  return (
    <span data-slot="icon-swap" className={cn('inline-grid *:[grid-area:1/1]', className)} style={style}>
      {glyphs.map((entry) => (
        <Glyph key={entry.key} entry={entry} />
      ))}
    </span>
  );
}

const ANGLE = { right: 0, down: 90, left: 180, up: 270 } as const;
export type ChevronDirection = keyof typeof ANGLE;

export interface ChevronProps {
  direction?: ChevronDirection;
  size?: number;
  /** Stroke width. */
  sw?: number;
  className?: string;
  style?: CSSProperties;
}

export function Chevron({ direction = 'right', size = 17, sw = 2.4, className, style }: ChevronProps) {
  const reduced = useReducedMotion();
  // Accumulate the angle so 270° → 0° turns +90°, not −270°.
  const acc = useRef<{ dir: ChevronDirection; deg: number }>({ dir: direction, deg: ANGLE[direction] });
  if (acc.current.dir !== direction) {
    const delta = ((ANGLE[direction] - (acc.current.deg % 360) + 540) % 360) - 180;
    acc.current = { dir: direction, deg: acc.current.deg + (delta === -180 ? 180 : delta) };
  }
  return (
    <motion.span
      data-slot="chevron"
      data-direction={direction}
      aria-hidden="true"
      className={cn('inline-grid shrink-0 place-items-center', className)}
      style={style}
      initial={false}
      animate={{ rotate: acc.current.deg }}
      transition={reduced ? { duration: 0 } : springs.snappy}
    >
      <Icon name="chev" size={size} sw={sw} />
    </motion.span>
  );
}

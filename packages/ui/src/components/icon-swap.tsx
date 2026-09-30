import { useRef, type CSSProperties, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { fades, springs } from '@/lib/motion';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';

/* ══ IconSwap / Chevron — icons change in place rather than cut ══
   IconSwap: when `id` changes, the old glyph shrinks and blurs out while the new one grows in, stacked in the
   same cell so nothing around it moves (copy → check, play → pause).
   Chevron: one chevron that rotates to face a new direction (forward → down when a row expands, forward →
   back when a flow reverses). It always turns the short way round. */

export interface IconSwapProps {
  /** Identity of the current icon — changing it swaps. */
  id: string | number;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function IconSwap({ id, children, className, style }: IconSwapProps) {
  const reduced = useReducedMotion();
  const hidden = reduced ? { opacity: 0 } : { opacity: 0, scale: 0.4, filter: 'blur(4px)' };
  return (
    <span data-slot="icon-swap" className={cn('inline-grid place-items-center *:[grid-area:1/1]', className)} style={style}>
      <AnimatePresence initial={false}>
        <motion.span
          key={id}
          className="inline-grid place-items-center"
          initial={hidden}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          exit={{ ...hidden, transition: reduced ? { duration: 0.1 } : { ...fades.out, scale: springs.snappy } }}
          transition={reduced ? { duration: 0.12 } : { default: fades.in, scale: springs.bouncy }}
        >
          {children}
        </motion.span>
      </AnimatePresence>
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

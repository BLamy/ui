'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { renderElement, type PartProps } from '@ui-sdk/react/primitive';
import { motion, useReducedMotionConfig } from 'framer-motion';
import { cx } from '@/lib/utils';

/* ══ Celebrate — a burst for rare moments ══
   Family's delight curve: the less often a moment happens, the more it may celebrate. A backup finishing,
   a first payment, a streak — not a tab switch. Wrap the thing that succeeded:
     <Celebrate fire={n}><SuccessBadge /></Celebrate>
   Every time `fire` changes, a ring pulses and confetti bursts out from behind it, then falls away. Celebrate is
   an `inline-grid` span around its child (`render={<div />}` for another element, `className` to place it), with
   the burst on a layer behind the child. Reduced motion gets the ring only, as a soft fade. */

/** The theme's own colours, so a ThemeScope recolours the confetti too. */
const PALETTE = [
  'var(--color-primary)',
  'var(--color-success)',
  'var(--color-warning)',
  'var(--color-destructive)',
  'var(--chart-5, var(--color-primary))',
  'var(--chart-3, var(--color-warning))',
];

/** Small deterministic PRNG so a burst looks the same each time it is replayed (and in screenshots). */
function rand(seed: number) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

interface Piece { x: number; y: number; r: number; s: number; w: number; h: number; c: string; d: number }

function pieces(n: number, spread: number, seed: number, colors: string[]): Piece[] {
  const rnd = rand(seed * 7919 + 17);
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + rnd() * 0.5;
    const dist = spread * (0.55 + rnd() * 0.45);
    const round = rnd() > 0.55;
    return {
      x: Math.cos(a) * dist, y: Math.sin(a) * dist * 0.85 - spread * 0.18,
      r: (rnd() - 0.5) * 540, s: 0.7 + rnd() * 0.5,
      w: round ? 7 : 5, h: round ? 7 : 11, c: colors[i % colors.length], d: rnd() * 0.06,
    };
  });
}

export interface CelebrateProps extends Omit<PartProps<'span'>, 'children'> {
  /** What succeeded: the burst comes out from behind it. */
  children?: ReactNode;
  /** Change this (e.g. a counter) to fire a burst. Falsy values never fire. */
  fire?: number | string | boolean | null;
  /** Number of confetti pieces (default 22). */
  count?: number;
  /** How far pieces fly, in px (default 100). */
  spread?: number;
  /** Confetti colours, any CSS colours (default the theme's primary, success, warning, destructive and two chart
   *  colours). */
  colors?: string[];
}

export function Celebrate({ fire, count = 22, spread = 100, colors = PALETTE, className, render, children, ...props }: CelebrateProps) {
  const reduced = useReducedMotionConfig();
  const [bursts, setBursts] = useState<number[]>([]);
  const n = useRef(0);
  // The value last seen, so only a change fires (the first render, and Strict Mode's second effect run, don't).
  const seen = useRef(fire);
  // Each burst removes itself after its animation; a newer burst never cancels an older one's removal.
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach(clearTimeout);
      pending.clear();
    };
  }, []);
  useEffect(() => {
    if (Object.is(seen.current, fire)) return;
    seen.current = fire;
    if (!fire) return;
    const id = ++n.current;
    setBursts((b) => [...b, id]);
    const t = setTimeout(() => {
      timers.current.delete(t);
      setBursts((b) => b.filter((x) => x !== id));
    }, 1400);
    timers.current.add(t);
  }, [fire]);
  const layer = (
    <span data-slot="celebrate-burst" aria-hidden="true" className="pointer-events-none absolute inset-0 -z-1 grid place-items-center overflow-visible">
      {bursts.map((id) => (
        <span key={id} className="relative size-0">
          <motion.span
            className="absolute -top-6 -left-6 size-12 rounded-full [border:2px_solid_var(--primary)]"
            initial={{ scale: 0.4, opacity: 0.8 }}
            animate={{ scale: reduced ? 1.2 : 2.6, opacity: 0 }}
            transition={{ duration: reduced ? 0.4 : 0.7, ease: [0.22, 1, 0.36, 1] }}
          />
          {reduced ? null : pieces(count, spread, id, colors).map((p, i) => (
            <motion.span
              key={i}
              className="absolute rounded-[2px]"
              style={{ width: p.w, height: p.h, left: -p.w / 2, top: -p.h / 2, background: p.c, borderRadius: p.w === p.h ? '50%' : 2 }}
              initial={{ x: 0, y: 0, scale: 0, rotate: 0, opacity: 1 }}
              animate={{
                x: [0, p.x, p.x * 1.15],
                y: [0, p.y, p.y + spread * 0.95],
                scale: [0.4, p.s, p.s * 0.7],
                rotate: [0, p.r * 0.5, p.r],
                opacity: [1, 1, 0],
              }}
              // Out fast (ease-out), then fall under gravity (ease-in) while fading.
              transition={{ duration: 1.25, delay: p.d, times: [0, 0.3, 1], ease: [[0.16, 1, 0.3, 1], [0.45, 0, 0.9, 0.5]] as never }}
            />
          ))}
        </span>
      ))}
    </span>
  );
  return renderElement(
    'span',
    {
      'data-slot': 'celebrate',
      ...props,
      className: cx('relative isolate inline-grid place-items-center', className),
      children: (
        <>
          {layer}
          {children}
        </>
      ),
    },
    render,
  );
}

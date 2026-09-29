import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '../lib/utils';

/* ══ Celebrate — a burst for rare moments ══
   Family's delight curve: the less often a moment happens, the more it may celebrate. A backup finishing,
   a first payment, a streak — not a tab switch. Drop <Celebrate fire={n} /> next to the thing that succeeded,
   inside a `relative isolate` wrapper: every time `fire` changes, a ring pulses and confetti bursts out from
   behind it, then falls away.
   Reduced motion gets the ring only, as a soft fade. */

const PALETTE = ['var(--primary)', 'var(--success, oklch(0.723 0.191 149.6))', '#FFD60A', '#FF375F', '#BF5AF2', '#FF9F0A'];

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

export interface CelebrateProps {
  /** Change this (e.g. a counter) to fire a burst. Falsy values never fire. */
  fire?: number | string | boolean | null;
  /** Number of confetti pieces (default 22). */
  count?: number;
  /** How far pieces fly, in px (default 100). */
  spread?: number;
  colors?: string[];
  className?: string;
  style?: CSSProperties;
}

export function Celebrate({ fire, count = 22, spread = 100, colors = PALETTE, className, style }: CelebrateProps) {
  const reduced = useReducedMotion();
  const [bursts, setBursts] = useState<number[]>([]);
  const n = useRef(0);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (!fire) return;
    const id = ++n.current;
    setBursts((b) => [...b, id]);
    const t = setTimeout(() => setBursts((b) => b.filter((x) => x !== id)), 1400);
    return () => clearTimeout(t);
  }, [fire]);
  return (
    <span data-slot="celebrate" aria-hidden="true"
      className={cn('pointer-events-none absolute inset-0 -z-1 grid place-items-center overflow-visible', className)} style={style}>
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
}

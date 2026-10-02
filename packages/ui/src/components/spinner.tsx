'use client';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import { SHAPES, SHAPE_IDS, ShapeLoader, type ShapeAnimation, type ShapeVariant } from './spinner-shapes';

/* ══ Spinner — the iOS activity indicator, and twenty loaders with three variants each ══
   `ios` (the default) is eight fading spokes in stepped rotation. Seven of the others — orbit, beacon, matrix, cells,
   register, bands, lift — are the CSS loaders from Dani Asyrofi's "Loading" (https://loading.daniasyrofi.com), ported to
   React: the markup and the timing tables below are his, the keyframes are in styles.css (`bl-ld-*`). The other thirteen
   (steps, cradle, hourglass … see spinner-shapes.tsx) are BL UI's own, made after the ideas in his gallery. They draw in
   `currentColor`, scale from a 24px design to any `size`, can be sped up, slowed down or paused, pause themselves
   while off screen or in a hidden tab, and hold a still frame under reduced motion.

   <Spinner spin />                                         // iOS spokes
   <Spinner animation="orbit" variant="oppose" size={48} />

   Loading (the original) is MIT licensed:
     Copyright (c) 2026 Dani Asyrofi (https://daniasyrofi.com)
     Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
     documentation files (the "Software"), to deal in the Software without restriction, including without limitation
     the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and
     to permit persons to whom the Software is furnished to do so, subject to the following conditions: The above
     copyright notice and this permission notice shall be included in all copies or substantial portions of the
     Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT
     LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT
     SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
     OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
     DEALINGS IN THE SOFTWARE. */

interface Pattern { duration: number; delays: number[] }

/** Each animation's variants: how long one cycle takes (ms) and when each part starts within it (ms). */
const PATTERNS = {
  orbit: {
    chase: { duration: 960, delays: [0, 120, 240, 360, 480, 600, 720, 840] },
    oppose: { duration: 1100, delays: [0, 120, 240, 360, 0, 120, 240, 360] },
    breathe: { duration: 1500, delays: [0, 0, 0, 0, 0, 0, 0, 0] },
  },
  beacon: {
    rise: { duration: 980, delays: [0, 90, 180, 270, 360] },
    fall: { duration: 980, delays: [360, 270, 180, 90, 0] },
    balance: { duration: 1180, delays: [0, 180, 360, 180, 0] },
  },
  matrix: {
    diagonal: { duration: 1040, delays: [0, 90, 180, 90, 180, 270, 180, 270, 360] },
    ripple: { duration: 1160, delays: [240, 120, 240, 120, 0, 120, 240, 120, 240] },
    scan: { duration: 980, delays: [0, 0, 0, 180, 180, 180, 360, 360, 360] },
  },
  cells: {
    merge: { duration: 1120, delays: [0, 100, 200, 300] },
    spread: { duration: 1120, delays: [300, 200, 100, 0] },
    checker: { duration: 1260, delays: [0, 280, 280, 0] },
  },
  register: {
    shift: { duration: 1040, delays: [0, 90, 180, 270, 360, 450] },
    invert: { duration: 1220, delays: [0, 0, 0, 260, 260, 260] },
    pair: { duration: 1320, delays: [0, 0, 220, 220, 440, 440] },
  },
  bands: {
    descend: { duration: 1060, delays: [0, 180, 360] },
    ascend: { duration: 1060, delays: [360, 180, 0] },
    split: { duration: 1260, delays: [0, 280, 0] },
  },
  lift: {
    rise: { duration: 1240, delays: [0, 120, 240, 360] },
    fall: { duration: 1240, delays: [360, 240, 120, 0] },
    breathe: { duration: 1560, delays: [0, 100, 200, 300] },
  },
} satisfies Record<string, Record<string, Pattern>>;

type PortedAnimation = keyof typeof PATTERNS;
export type SpinnerAnimation = 'ios' | PortedAnimation | ShapeAnimation;
/** Every variant name. A variant that the chosen animation does not have falls back to its first. */
export type SpinnerVariant = { [A in PortedAnimation]: keyof (typeof PATTERNS)[A] }[PortedAnimation] | ShapeVariant;

export interface SpinnerAnimationInfo {
  id: SpinnerAnimation;
  label: string;
  /** The animation's variants, the first being the default (empty for `ios`). */
  variants: readonly string[];
}

/** The animations to choose from, with their labels and variants — for a picker or a gallery. */
export const spinnerAnimations: readonly SpinnerAnimationInfo[] = [
  { id: 'ios', label: 'iOS', variants: [] },
  { id: 'orbit', label: 'Orbit', variants: Object.keys(PATTERNS.orbit) },
  { id: 'beacon', label: 'Bars', variants: Object.keys(PATTERNS.beacon) },
  { id: 'matrix', label: 'Matrix', variants: Object.keys(PATTERNS.matrix) },
  { id: 'cells', label: 'Merge', variants: Object.keys(PATTERNS.cells) },
  { id: 'register', label: 'Encode', variants: Object.keys(PATTERNS.register) },
  { id: 'bands', label: 'Scan', variants: Object.keys(PATTERNS.bands) },
  { id: 'lift', label: 'Lift', variants: Object.keys(PATTERNS.lift) },
  ...SHAPE_IDS.map((id) => ({ id, label: SHAPES[id].label, variants: Object.keys(SHAPES[id].variants) })),
];

export interface SpinnerProps {
  /** Which loader (default `ios`). */
  animation?: SpinnerAnimation;
  /** The variant of the chosen animation (see `spinnerAnimations`); the first when omitted or unknown. */
  variant?: SpinnerVariant;
  /** `ios` only: turn the spokes. The other loaders always animate unless `paused`. */
  spin?: boolean;
  /** Width and height in px: 22 for `ios`, 32 for the others (12–160). */
  size?: number;
  /** Playback speed of the other loaders, 0.25–3 (default 1). */
  speed?: number;
  /** Hold the other loaders still. */
  paused?: boolean;
  /** An accessible name. Without one the spinner is decorative (`aria-hidden`); with one it is a `role="status"`. */
  label?: string;
  className?: string;
  style?: CSSProperties;
}

const isShape = (a: SpinnerAnimation): a is ShapeAnimation => a in SHAPES;

const clamp = (n: number, min: number, max: number, fallback: number) => (Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback);

/** Per-part timing, as custom properties the keyframes read. */
const timing = (p: Pattern, i: number): CSSProperties => ({ '--bl-ld-d': `${p.duration}ms`, '--bl-ld-delay': `${p.delays[i]}ms` }) as CSSProperties;

function Loader({ animation, variant }: { animation: PortedAnimation; variant: string }) {
  const table = PATTERNS[animation] as Record<string, Pattern>;
  const name = table[variant] ? variant : Object.keys(table)[0];
  const p = table[name];
  switch (animation) {
    case 'orbit':
      return (
        <span className="bl-ld-orbit-indicator" data-variant={name}>
          {p.delays.map((_, i) => (
            <span key={i} className="bl-ld-orbit-node" style={{ '--bl-ld-angle': `${i * 45}deg` } as CSSProperties}>
              <span className="bl-ld-orbit-dot" style={timing(p, i)} />
            </span>
          ))}
        </span>
      );
    case 'beacon':
      return (
        <span className="bl-ld-beacon-indicator" data-variant={name}>
          {p.delays.map((_, i) => (
            <span key={i} className="bl-ld-beacon-indicator__bar" style={{ ...timing(p, i), '--bl-ld-bar': `${7 + Math.abs(2 - i) * 2}px` } as CSSProperties} />
          ))}
        </span>
      );
    case 'matrix':
      return (
        <span className="bl-ld-matrix-indicator" data-variant={name}>
          {p.delays.map((_, i) => <span key={i} className="bl-ld-matrix-indicator__dot" style={timing(p, i)} />)}
        </span>
      );
    case 'cells':
      return (
        <span className="bl-ld-cell-indicator" data-variant={name}>
          {p.delays.map((_, i) => <span key={i} className="bl-ld-cell-indicator__cell" style={timing(p, i)} />)}
        </span>
      );
    case 'register':
      return (
        <span className="bl-ld-register-indicator" data-variant={name}>
          {p.delays.map((_, i) => <span key={i} className="bl-ld-register-indicator__bit" data-bit={i % 2 === 0 ? 'one' : 'zero'} style={timing(p, i)} />)}
        </span>
      );
    case 'bands':
      return (
        <span className="bl-ld-band-indicator" data-variant={name}>
          {p.delays.map((_, i) => (
            <span key={i} className="bl-ld-band-indicator__row">
              <span className="bl-ld-band-indicator__rail" />
              <span className="bl-ld-band-indicator__segment" style={timing(p, i)} />
            </span>
          ))}
        </span>
      );
    case 'lift':
      return (
        <span className="bl-ld-lift-queue-indicator" data-variant={name}>
          {p.delays.map((_, i) => <span key={i} className="bl-ld-lift-queue-indicator__level" style={{ ...timing(p, i), '--bl-ld-level': i } as CSSProperties} />)}
        </span>
      );
  }
}

/** True while the element is on screen and the tab is visible: a loader nobody can see should not keep animating. */
function useVisibleToUser(ref: React.RefObject<HTMLElement | null>, enabled: boolean) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    let onScreen = true;
    const sync = () => setVisible(onScreen && !document.hidden);
    document.addEventListener('visibilitychange', sync);
    const observer = typeof IntersectionObserver === 'undefined' || !el ? null : new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; sync(); });
    if (observer && el) observer.observe(el);
    sync();
    return () => { document.removeEventListener('visibilitychange', sync); observer?.disconnect(); };
  }, [ref, enabled]);
  return visible;
}

/** A loading indicator. The default is the iOS activity indicator (eight fading spokes, stepped rotation); it grows in
    when it mounts (a spinner appearing is an event; popping in unannounced reads as a glitch). `animation` picks one of
    one of the twenty loaders instead. */
export function Spinner({ animation = 'ios', variant, spin, size, speed = 1, paused, label, className, style }: SpinnerProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const isLoader = animation !== 'ios';
  const visible = useVisibleToUser(ref, isLoader);

  if (!isLoader) {
    const px = size ?? 22;
    return (
      <svg
        data-slot="spinner"
        data-animation="ios"
        className={cn('block transition-[scale,opacity] duration-spring-snappy ease-spring-snappy starting:scale-50 starting:opacity-0 motion-reduce:transition-none', spin && 'animate-[blSpin_.75s_steps(8)_infinite]', className)}
        width={px} height={px} viewBox="0 0 24 24" style={style}
        {...(label ? { role: 'status', 'aria-label': label } : { 'aria-hidden': true })}
      >
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <rect key={i} x="11.1" y="2.8" width="1.8" height="5.2" rx="0.9" fill="currentColor" opacity={(i + 1) / 8} transform={`rotate(${i * 45} 12 12)`} />
        ))}
      </svg>
    );
  }

  const px = clamp(size ?? 32, 12, 160, 32);
  return (
    <span
      ref={ref}
      data-slot="spinner"
      data-animation={animation}
      data-paused={paused || !visible || undefined}
      className={cn('bl-ld', className)}
      style={{ '--bl-ld-size': `${px}px`, '--bl-ld-scale': px / 24, '--bl-ld-speed': clamp(speed, 0.25, 3, 1), ...style } as CSSProperties}
      {...(label ? { role: 'status', 'aria-label': label } : { 'aria-hidden': true })}
    >
      <span className="bl-ld-stage" aria-hidden="true">
        {isShape(animation) ? <ShapeLoader animation={animation} variant={variant ?? ''} /> : <Loader animation={animation as PortedAnimation} variant={variant ?? ''} />}
      </span>
    </span>
  );
}

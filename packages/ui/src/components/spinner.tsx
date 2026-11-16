'use client';
import { useCallback, useEffect, useRef, useState, type CSSProperties, type HTMLAttributes, type Ref } from 'react';
import { cn } from '@/lib/utils';
import { SHAPES, SHAPE_IDS, ShapeLoader, type ShapeAnimation, type ShapePattern } from '@/lib/spinner-shapes';

/* ══ Spinner — the iOS activity indicator, and twenty-two loaders with three patterns each ══
   `ios` (the default) is eight fading spokes in stepped rotation. Seven of the others — orbit, bars, matrix, merge,
   encode, scan, lift — are the CSS loaders from Dani Asyrofi's "Loading" (https://loading.daniasyrofi.com), ported to
   React: the markup and the timing tables below are his, the keyframes are in styles.css (`bl-ld-*`). The other fifteen
   (steps, cradle, hourglass … see lib/spinner-shapes.tsx) are BL UI's own, made after the ideas in his gallery. They draw in
   `currentColor`, scale from a 24px design to any `size`, can be sped up, slowed down or paused, pause themselves
   while off screen or in a hidden tab, and hold a still frame under reduced motion. Every one animates unless `paused`.

   <Spinner />                                              // iOS spokes
   <Spinner animation="orbit" pattern="oppose" size={48} />

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

/** Each ported animation's patterns: how long one cycle takes (ms) and when each part starts within it (ms). */
const PATTERNS = {
  orbit: {
    chase: { duration: 960, delays: [0, 120, 240, 360, 480, 600, 720, 840] },
    oppose: { duration: 1100, delays: [0, 120, 240, 360, 0, 120, 240, 360] },
    breathe: { duration: 1500, delays: [0, 0, 0, 0, 0, 0, 0, 0] },
  },
  bars: {
    rise: { duration: 980, delays: [0, 90, 180, 270, 360] },
    fall: { duration: 980, delays: [360, 270, 180, 90, 0] },
    balance: { duration: 1180, delays: [0, 180, 360, 180, 0] },
  },
  matrix: {
    diagonal: { duration: 1040, delays: [0, 90, 180, 90, 180, 270, 180, 270, 360] },
    ripple: { duration: 1160, delays: [240, 120, 240, 120, 0, 120, 240, 120, 240] },
    scan: { duration: 980, delays: [0, 0, 0, 180, 180, 180, 360, 360, 360] },
  },
  merge: {
    merge: { duration: 1120, delays: [0, 100, 200, 300] },
    spread: { duration: 1120, delays: [300, 200, 100, 0] },
    checker: { duration: 1260, delays: [0, 280, 280, 0] },
  },
  encode: {
    shift: { duration: 1040, delays: [0, 90, 180, 270, 360, 450] },
    invert: { duration: 1220, delays: [0, 0, 0, 260, 260, 260] },
    pair: { duration: 1320, delays: [0, 0, 220, 220, 440, 440] },
  },
  scan: {
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
/** The patterns of one animation (`never` for `ios`, which has none). */
export type SpinnerPatternOf<A extends SpinnerAnimation> = A extends PortedAnimation
  ? keyof (typeof PATTERNS)[A]
  : A extends ShapeAnimation
    ? keyof (typeof SHAPES)[A]['variants']
    : never;
/** Every pattern name, of any animation. */
export type SpinnerPattern = { [A in PortedAnimation]: keyof (typeof PATTERNS)[A] }[PortedAnimation] | ShapePattern;

export interface SpinnerAnimationInfo {
  id: SpinnerAnimation;
  label: string;
  /** The animation's patterns, the first being the default (empty for `ios`). */
  patterns: readonly string[];
}

/** The animations to choose from, with their labels and patterns — for a picker or a gallery. */
export const spinnerAnimations: readonly SpinnerAnimationInfo[] = [
  { id: 'ios', label: 'iOS', patterns: [] },
  ...(Object.keys(PATTERNS) as PortedAnimation[]).map((id) => ({ id, label: id[0].toUpperCase() + id.slice(1), patterns: Object.keys(PATTERNS[id]) })),
  ...SHAPE_IDS.map((id) => ({ id, label: SHAPES[id].label, patterns: Object.keys(SHAPES[id].variants) })),
];

type LoaderAnimation = Exclude<SpinnerAnimation, 'ios'>;
/** `animation` and the `pattern` it allows: `pattern` only exists for the loaders, and only with that loader's names. */
type SpinnerChoice =
  | { /** Which loader (default `ios`, the activity indicator). */ animation?: 'ios'; pattern?: never }
  | { [A in LoaderAnimation]: { animation: A; /** The loader's timing pattern (see `spinnerAnimations`); the first when omitted. */ pattern?: SpinnerPatternOf<A> } }[LoaderAnimation];

export type SpinnerProps = SpinnerChoice &
  Omit<HTMLAttributes<HTMLSpanElement>, 'children'> & {
    /** Width and height in px: 22 for `ios`, 32 for the others (12–160). */
    size?: number;
    /** Playback speed of the loaders, 0.25–3 (default 1). `ios` turns at its own rate. */
    speed?: number;
    /** Hold it still. Every animation, `ios` included, moves unless `paused`. */
    paused?: boolean;
    /** An accessible name (`aria-label` works the same). Without one the spinner is decorative (`aria-hidden`); with
     *  one it is a `role="status"` named by the label, with the label as its (visually hidden) text so the live
     *  region announces it. */
    label?: string;
    ref?: Ref<HTMLSpanElement>;
  };

const isShape = (a: SpinnerAnimation): a is ShapeAnimation => a in SHAPES;

const clamp = (n: number, min: number, max: number, fallback: number) => (Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback);

/** Per-part timing, as custom properties the keyframes read. */
const timing = (p: Pattern, i: number): CSSProperties => ({ '--bl-ld-d': `${p.duration}ms`, '--bl-ld-delay': `${p.delays[i]}ms` }) as CSSProperties;

function Loader({ animation, pattern }: { animation: PortedAnimation; pattern: string }) {
  const table = PATTERNS[animation] as Record<string, Pattern>;
  const name = table[pattern] ? pattern : Object.keys(table)[0];
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
    case 'bars':
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
    case 'merge':
      return (
        <span className="bl-ld-cell-indicator" data-variant={name}>
          {p.delays.map((_, i) => <span key={i} className="bl-ld-cell-indicator__cell" style={timing(p, i)} />)}
        </span>
      );
    case 'encode':
      return (
        <span className="bl-ld-register-indicator" data-variant={name}>
          {p.delays.map((_, i) => <span key={i} className="bl-ld-register-indicator__bit" data-bit={i % 2 === 0 ? 'one' : 'zero'} style={timing(p, i)} />)}
        </span>
      );
    case 'scan':
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
function useVisibleToUser(ref: React.RefObject<HTMLElement | null>) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const el = ref.current;
    let onScreen = true;
    const sync = () => setVisible(onScreen && !document.hidden);
    document.addEventListener('visibilitychange', sync);
    const observer = typeof IntersectionObserver === 'undefined' || !el ? null : new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; sync(); });
    if (observer && el) observer.observe(el);
    sync();
    return () => { document.removeEventListener('visibilitychange', sync); observer?.disconnect(); };
  }, [ref]);
  return visible;
}

/** One stable callback ref for the spinner's own ref and the caller's: a new function each render would detach and
    re-attach the caller's ref (null, then the node) on every render. */
function useMergedRef<T>(own: React.RefObject<T | null>, ref: Ref<T> | undefined) {
  return useCallback((node: T | null) => {
    own.current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) ref.current = node;
  }, [own, ref]);
}

/** A loading indicator. The default is the iOS activity indicator (eight fading spokes, stepped rotation); it grows in
    when it mounts (a spinner appearing is an event; popping in unannounced reads as a glitch). `animation` picks one of
    the twenty-two loaders instead. */
export function Spinner(props: SpinnerProps) {
  const { animation = 'ios', pattern, size, speed = 1, paused, label: labelProp, 'aria-label': ariaLabel, className, style, ref, ...rest } = props;
  const label = labelProp ?? ariaLabel;
  const own = useRef<HTMLSpanElement>(null);
  const setRef = useMergedRef(own, ref);
  const visible = useVisibleToUser(own);
  const still = paused || !visible || undefined;
  // A live region announces its text, so the label is text inside it; `status` takes its name only from an author
  // attribute, so it is the aria-label too (for finding it by name and for screen-reader navigation).
  const a11y = label ? { role: 'status', 'aria-label': label } : { 'aria-hidden': true as const };
  const name = label ? <span className="sr-only">{label}</span> : null;

  if (animation === 'ios') {
    const px = size ?? 22;
    return (
      <span
        {...rest}
        {...a11y}
        ref={setRef}
        data-slot="spinner"
        data-animation="ios"
        data-paused={still}
        className={cn(
          'block shrink-0 transition-[scale,opacity] duration-spring-snappy ease-spring-snappy starting:scale-50 starting:opacity-0 motion-reduce:transition-none',
          !paused && 'animate-[blSpin_.75s_steps(8)_infinite] data-paused:[animation-play-state:paused]',
          className,
        )}
        style={{ width: px, height: px, ...style }}
      >
        <svg className="block size-full" viewBox="0 0 24 24" aria-hidden="true">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <rect key={i} x="11.1" y="2.8" width="1.8" height="5.2" rx="0.9" fill="currentColor" opacity={(i + 1) / 8} transform={`rotate(${i * 45} 12 12)`} />
          ))}
        </svg>
        {name}
      </span>
    );
  }

  const px = clamp(size ?? 32, 12, 160, 32);
  return (
    <span
      {...rest}
      {...a11y}
      ref={setRef}
      data-slot="spinner"
      data-animation={animation}
      data-paused={still}
      className={cn('bl-ld', className)}
      style={{ '--bl-ld-size': `${px}px`, '--bl-ld-scale': px / 24, '--bl-ld-speed': clamp(speed, 0.25, 3, 1), ...style } as CSSProperties}
    >
      <span className="bl-ld-stage" aria-hidden="true">
        {isShape(animation)
          ? <ShapeLoader animation={animation} pattern={String(pattern ?? '')} />
          : <Loader animation={animation} pattern={String(pattern ?? '')} />}
      </span>
      {name}
    </span>
  );
}

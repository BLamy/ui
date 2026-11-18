'use client';
import { useCallback, useLayoutEffect, useRef, type HTMLAttributes, type ReactNode, type Ref } from 'react';
import type { AnimationPlaybackControls } from 'framer-motion';
import { springs, useReducedMotion, type SpringName } from '@/lib/motion';
import { motionEngine, requestMotionEngine, useMotionRequest } from '@/lib/motion-lazy';
import { cn } from '@/lib/utils';

/* ══ AnimatedHeight — a container that changes size instead of cutting ══
   It measures its content and springs its own height to match, so a tray going from a two-line step to a
   five-line step grows rather than jumps. Pair it with `Swap` for Family's tray step:
   `<AnimatedHeight><Swap value={step} direction={dir}>`. The height is a spring-animated value (framer-motion);
   under reduced motion it changes at once.
   framer-motion is fetched after first paint (lib/motion-lazy.ts), so the container is a plain element that holds
   its content's height, and each new height is animated on the element: by the engine when it is here, at once when
   it is not yet. What it holds is never remounted, whenever the engine arrives. */

export interface AnimatedHeightProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'onAnimationStart' | 'onDrag' | 'onDragStart' | 'onDragEnd' | 'onAnimationEnd' | 'onAnimationIteration'> {
  children?: ReactNode;
  /** Spring for the height (default `tray`): `tray` for sheets and trays, `smooth` for panels, `snappy` for small
   *  controls, `bouncy` for a playful overshoot. */
  spring?: SpringName;
  ref?: Ref<HTMLDivElement>;
}

export function AnimatedHeight({ children, spring = 'tray', className, style, ref, ...props }: AnimatedHeightProps) {
  const outer = useRef<HTMLDivElement | null>(null);
  const inner = useRef<HTMLDivElement | null>(null);
  const reduced = useReducedMotion();
  useMotionRequest();
  // What the next change of height reads: the spring and the setting as they are then.
  const how = useRef({ spring, reduced });
  how.current = { spring, reduced };
  /* `at` is the height the box holds or is heading for (null until the first measurement, which is where it starts,
     not a change); `driven` says framer-motion holds the height now, so every later change goes through it and
     carries on from wherever the last one had got to. */
  const at = useRef<number | null>(null);
  const driven = useRef(false);
  const running = useRef<AnimationPlaybackControls | null>(null);
  useLayoutEffect(() => {
    const el = inner.current;
    const box = outer.current;
    if (!el || !box) return;
    const fit = () => {
      const h = el.offsetHeight;
      if (h === at.current) return;
      const first = at.current === null;
      at.current = h;
      const engine = motionEngine();
      if (engine && (driven.current || !first)) {
        running.current = engine.animate(box, { height: h }, how.current.reduced ? { duration: 0 } : springs[how.current.spring]);
        driven.current = true;
        return;
      }
      box.style.height = `${h}px`;
      if (!first) requestMotionEngine();
    };
    fit();
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fit);
    ro?.observe(el);
    return () => {
      ro?.disconnect();
      running.current?.stop();
    };
  }, []);
  const setOuter = useCallback((node: HTMLDivElement | null) => {
    outer.current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) ref.current = node;
  }, [ref]);
  return (
    // `height: auto` is what the server draws and what React writes once; the measured height is written on the element.
    <div {...props} ref={setOuter} data-slot="animated-height" className={cn('box-content overflow-hidden', className)}
      style={{ ...style, height: 'auto' }}>
      <div ref={inner} className="flow-root">{children}</div>
    </div>
  );
}

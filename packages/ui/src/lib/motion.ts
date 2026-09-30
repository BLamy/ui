/* Motion — one vocabulary for every animation in the kit, after Benji Taylor's "Family Values"
   (https://benji.org/family-values): simplicity, fluidity, delight.

   - Fluid: things fly, never teleport. Use springs (interruptible, velocity-preserving) rather than
     fixed-duration tweens; direction follows the gesture or the index (left tab → move left).
   - Continuity: an element that persists between two states stays put and morphs (height, width,
     label, icon) instead of being duplicated or cross-faded.
   - Delight by frequency: the rarer the moment, the more it may celebrate. Everyday controls stay quick.
   - Reduced motion: honour `prefers-reduced-motion` — swap movement for a short opacity change.

   `springs` are framer-motion transitions; the same physics are sampled into CSS as
   `--ease-spring-*` / `--duration-spring-*` in theme.css for plain CSS transitions. */
import * as Motion from 'framer-motion';
import { animate } from 'framer-motion';
import { useReducedMotion as useReducedMotionFM } from 'framer-motion';
import { useRef } from 'react';

export function loadMotion() { /* no-op — framer-motion is a static npm import */ }

/** The framer-motion module (kept for the prototype's call shape). Prefer importing from 'framer-motion'. */
export function useMotion(): typeof Motion {
  return Motion;
}

/** Spring presets. `snappy` for small controls, `smooth` for layout and panels, `tray` for sheets and
 *  height morphs, `bouncy` for rare, celebratory moments only. */
export const springs = {
  snappy: { type: 'spring', stiffness: 620, damping: 48, mass: 1 },
  smooth: { type: 'spring', stiffness: 380, damping: 40, mass: 1 },
  tray: { type: 'spring', stiffness: 520, damping: 44, mass: 1 },
  bouncy: { type: 'spring', stiffness: 520, damping: 26, mass: 1 },
} as const;
export type SpringName = keyof typeof springs;

/** CSS `transition` shorthand for a spring preset: `transition: springCss('transform', 'smooth')`. */
export function springCss(property: string | string[], spring: SpringName = 'smooth') {
  return (Array.isArray(property) ? property : [property])
    .map((p) => `${p} var(--duration-spring-${spring}) var(--ease-spring-${spring})`)
    .join(', ');
}

/** Direction of travel between two ordered positions: -1 back/left, 1 forward/right, 0 none. */
export function direction(from: number, to: number): -1 | 0 | 1 {
  return to > from ? 1 : to < from ? -1 : 0;
}

/** Tweens for the few things that shouldn't spring: opacity/blur fades. Exits are quicker than entries —
 *  what leaves gets out of the way; what arrives takes its time. */
export const fades = {
  in: { duration: 0.22, ease: [0.22, 1, 0.36, 1] },
  out: { duration: 0.14, ease: [0.4, 0, 1, 1] },
} as const;

/** A spring preset, or an instant transition when the user prefers reduced motion. */
export function useSpringTransition(name: SpringName = 'smooth') {
  const reduced = useReducedMotionFM();
  return reduced ? ({ duration: 0 } as const) : springs[name];
}

/** Direction of the latest change of an ordered value (a tab index, a step): -1, 0 or 1. Stable between
 *  changes, so a panel keyed by the value can read it on enter and exit alike. */
export function useDirection(index: number): -1 | 0 | 1 {
  const r = useRef({ index, dir: 0 as -1 | 0 | 1 });
  if (r.current.index !== index) r.current = { index, dir: direction(r.current.index, index) };
  return r.current.dir;
}

export { useReducedMotion } from 'framer-motion';

/* ══ FLIP moves and reduced-motion checks ══
   For elements that change parents (the sheet gesture is `useSheetDrag` in lib/sheet-drag.ts), after Benji Taylor's
   "Family Values". Everything honours prefers-reduced-motion. */


/** Whether the user asked for reduced motion (checked when an animation starts, so it follows the setting live). */
export function prefersReducedMotion(): boolean {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/* ── FLIP ── */
export type FlipSnapshot = Map<Element, DOMRect>;

/** Records where elements are now, before a change moves them. */
export function flipSnapshot(elements: Iterable<Element>): FlipSnapshot {
  const map: FlipSnapshot = new Map();
  for (const el of elements) map.set(el, el.getBoundingClientRect());
  return map;
}

/**
 * Plays elements from where `snapshot` saw them to where they are now, on a spring. `relativeTo` pairs a
 * container's before/after rects so children move relative to it (a card that is itself resizing).
 * Interrupting is safe: a snapshot taken mid-flight includes the running transform.
 */
export function flipPlay(
  snapshot: FlipSnapshot,
  {
    spring = 'smooth',
    relativeTo,
    fade = false,
    lift = false,
  }: { spring?: SpringName; relativeTo?: [DOMRect, DOMRect]; fade?: boolean; lift?: boolean } = {},
) {
  if (prefersReducedMotion()) return;
  const [rb, ra] = relativeTo ?? [null, null];
  snapshot.forEach((before, el) => {
    if (!el.isConnected || !(el instanceof HTMLElement || el instanceof SVGElement)) return;
    const after = el.getBoundingClientRect();
    if (!after.width && !after.height) return;
    let dx = before.left - after.left;
    let dy = before.top - after.top;
    if (rb && ra) {
      dx = before.left - rb.left - (after.left - ra.left);
      dy = before.top - rb.top - (after.top - ra.top);
    }
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
    // Lifted elements fly over their neighbours (an option pill crossing the card on its way to a bump).
    if (lift) {
      el.style.position ||= 'relative';
      el.style.zIndex = '5';
    }
    animate(el, { x: [dx, 0], y: [dy, 0], ...(fade ? { opacity: [0.4, 1] } : null) }, {
      ...springs[spring],
      onComplete: () => {
        if (lift) el.style.zIndex = '';
      },
    });
  });
}

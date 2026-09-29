import { animate } from 'framer-motion';
import { springs, type SpringName } from '../motion';

/* ══ Motion helpers for the Workbench and ChatKit surfaces ══
   The kit's shared vocabulary (`springs`, `springCss`, --ease-spring-* / --duration-spring-*, TextMorph) lives in
   @brett_lamy/ui. These are the few pieces the composer needs on top of it, after Benji Taylor's "Family Values":
   FLIP moves for elements that change parents (the sheet gesture is `useSheetDrag` in lib/sheet-drag.ts).
   Everything honours prefers-reduced-motion. */

export { springs, type SpringName };

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

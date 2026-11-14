/* Reduced motion — one framework-free check for code that moves things itself (primitives, FLIP moves,
   scroll-into-view). Styles honour the setting in CSS (`motion-reduce:`); this is for script. It is read when an
   animation starts, so it follows the setting live. */

/** Whether the user asked for reduced motion, in `view` (the window an element lives in; default the global one).
 *  `false` on the server. */
export function prefersReducedMotion(view?: Pick<Window, 'matchMedia'> | null): boolean {
  const match = view ? view.matchMedia?.bind(view) : typeof matchMedia === 'function' ? matchMedia : undefined;
  return !!match?.('(prefers-reduced-motion: reduce)').matches;
}

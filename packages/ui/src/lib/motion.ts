/* framer-motion — statically imported (the prototype lazy-loaded a CDN UMD build).
   `useMotion()` keeps the prototype's call shape: it returns the module. `loadMotion()` is a no-op. */
import * as Motion from 'framer-motion';

export function loadMotion() { /* no-op — framer-motion is a static npm import */ }

export function useMotion(): typeof Motion {
  return Motion;
}

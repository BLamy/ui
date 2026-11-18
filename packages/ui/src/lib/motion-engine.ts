'use client';
/* @internal Motion's engine — the parts of framer-motion the kit animates with, as one module.
   Nothing imports this file statically: `lib/motion-lazy.ts` loads it with one dynamic `import()`, so a bundler puts
   it (and the framer-motion code it reaches) in a chunk of its own that an app fetches after first paint. Whatever
   is exported here is in that chunk whether or not a page uses it, so keep the list to what the kit's lazy parts
   call: `animate` (springs on an element or a number), and for a layer that exists only while an animation runs
   (TextMorph's letters) the `m` elements with `AnimatePresence`, given their features by `LazyMotion`. The features
   are `domMin`: enter, animate and exit. Nothing here needs framer-motion's gestures, drag or layout projection, which
   are half of it; a part that does (Morph) imports framer-motion itself. */
export { AnimatePresence, LazyMotion, animate, domMin, m } from 'framer-motion';

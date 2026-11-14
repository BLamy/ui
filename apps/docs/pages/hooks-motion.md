# Motion hooks

The hooks behind BL UI's motion: spring and direction helpers for your own animations, and the title flight that `NavigationStack`'s header is built on. Gestures (edge swipes, sheet drags, pull-to-refresh) are UI SDK behaviors, listed under Gestures below. The principles and presets are on the [Motion](https://blamy.github.io/ui/#/motion) page; the other hooks are in the [Hooks overview](https://blamy.github.io/ui/#/hooks).

`useSpringTransition`, `useDirection`, `useReducedMotion` and `useMorphTransition` are public. `createTitleFlight` is registry-only: it is not in `@brett_lamy/ui`, and arrives in your project with `NavigationStack` or as a registry item of its own.

Tab panels no longer need a hook to slide in from the side of the selected tab: UI SDK's tab panel part sets `data-activation-direction` (`left`, `right`, `up`, `down` or `none`) and `data-starting-style` / `data-ending-style`, and the kit's `TabsPanel` and `TabViewPanel` style those attributes. 6.0 removed `useTabPanelDirection` and `TabDirection`.

```tsx
// npm
import { useSpringTransition, useDirection, useReducedMotion, useMorphTransition } from '@brett_lamy/ui'

// shadcn registry (aliases)
import { useSpringTransition, useDirection } from '@/lib/motion'              // …/r/motion.json
import { useMorphTransition } from '@/components/ui/morph'                    // …/r/morph.json
import { createTitleFlight } from '@/lib/title-flight'                        // …/r/title-flight.json (registry-only)
```

For framer-motion itself (`motion`, `AnimatePresence`, `LayoutGroup`), import it from `framer-motion`. 6.0 removed `useMotion` and `loadMotion`.

## `useSpringTransition`

A spring preset for a framer-motion `transition`, or an instant transition when the user prefers reduced motion.

- **Export:** public. Registry item `motion`.
- **Needs:** nothing.

```ts
function useSpringTransition(name: SpringName = 'smooth'): typeof springs[SpringName] | { duration: 0 }
// SpringName: 'snappy' | 'smooth' | 'tray' | 'bouncy'
```

```tsx
function Toggle({ on }: { on: boolean }) {
  const transition = useSpringTransition('snappy')
  return <motion.span animate={{ x: on ? 20 : 0 }} transition={transition} />
}
```

It wraps framer-motion's `useReducedMotion`. Only the transition is replaced; it does not stop other animation you wrote. For plain CSS transitions, `springCss()` and the `duration-spring-*` utilities carry no reduced-motion handling of their own: add `motion-reduce:transition-none` the way the components do.

## `useReducedMotion`

framer-motion's `useReducedMotion`, re-exported so one import covers it. Returns `true` when the user prefers reduced motion. `prefersReducedMotion()`, also public, is the same check as a plain function for code that is not a component; it reads the media query each time it is called.

## `useDirection`

The direction of the latest change of an ordered value, such as a tab index or a step: `-1` (it went down), `0` (no change yet) or `1` (it went up).

- **Export:** public. Registry item `motion`.
- **Needs:** nothing.

```ts
function useDirection(index: number): -1 | 0 | 1
```

The value is stable between changes, which is the point: a panel that is leaving and a panel that is arriving, both rendered after the same change, read the same direction. It is `0` on the first render.

```tsx
function Steps({ step }: { step: number }) {
  const dir = useDirection(step)
  return <ContentSwap id={step} direction={dir}>{renderStep(step)}</ContentSwap>
}
```

{% demo src="hooks-motion/direction" %}

Gotchas:

- It records the index in a ref **during render**. A render React starts and then discards (a transition that is interrupted, a Suspense retry) can still move the baseline, so the next real change compares against an index you never committed. For tabs and steps this is harmless; do not use it as a log of what the user did.
- The comparison is only `>` and `<`: the size of the jump is not reported. Going from step 0 to step 3 is `1`, the same as 0 to 1.
- An exiting element keeps the props it had when it left. With framer-motion's `AnimatePresence`, pass the direction through `custom` on both `AnimatePresence` and the child (as the demo does), or the leaving panel animates the old direction.

## `useMorphTransition`

The transition of the enclosing `MorphGroup`, for your own motion elements that should move with the morph.

- **Export:** public. Registry item `morph`.
- **Needs:** a `MorphGroup`, optionally. **Outside one:** returns `springs.smooth` (or `{ duration: 0 }` under reduced motion).

```ts
function useMorphTransition(): Transition   // framer-motion's Transition
```

```tsx
import { motion } from 'framer-motion'

function Badge({ count }: { count: number }) {
  const transition = useMorphTransition()
  return <motion.span layout transition={transition}>{count}</motion.span>
}
```

Inside a group it returns the group's `transition` prop, else the group's `spring` preset (default `smooth`); under reduced motion the group makes both instant (`{ duration: 0 }`).

## Gestures

The 5.x gesture hooks are gone in 6.0. Each was hand-written pointer code; the containers now build on UI SDK behaviors from `@ui-sdk/core` and on the kit's own behaviors built from them, and so should your own gestures. See [Dragging](https://blamy.github.io/ui/#/behaviors-dragging) and [The kit's behaviors](https://blamy.github.io/ui/#/behaviors-kit).

| 5.x hook | 6.0 |
| --- | --- |
| `useEdgeSwipe` (`@/lib/edge-swipe`) | `bindEdgeSwipe(el, options)`, from the same `@/lib/edge-swipe` (a framework-free behavior now, on UI SDK's `bindDrag`). `NavigationStack`, `SplitView`, `SideDrawer` and `AdaptivePane` use it. |
| `useSheetDrag` (`@/lib/sheet-drag`), `SHEET_TAP_SLOP`, `SHEET_MINIMIZE_TRAVEL` | A sheet that grows, snaps and folds is UI SDK's `Drawer` with `snapPoints` (`snapPoint` / `onSnapPointChange`), `DrawerHandle`, and `--drawer-progress` for whatever follows it, as `FloatingSheet` does. Any other drag: `bindDrag`, with `createVelocityTracker` and `rubberBand`, as the Composer's bump does. |
| `usePullToRefresh` (`@/lib/pull-to-refresh`) | `bindPullToRefresh(scroller, options)` from the same `@/lib/pull-to-refresh`, or `<NavigationStackContent onRefresh>`. Touch only. |
| `useTitleFlight` (`@/lib/title-flight`) | `createTitleFlight`, below. |

## `createTitleFlight`

Registry-only. The header title morph: on a push, the previous page's title (large or inline) flies into the new page's back button; on pop, the back label flies back into the title it names. Two copies of the label (one styled as the source, one as the destination) travel together, scaling and cross-fading, while the real labels hide. `NavigationStack` is the only user; this section is for anyone building a similar container. It is framework-free: no React.

- **Export:** not in `@brett_lamy/ui`. Registry item `title-flight` (`@/lib/title-flight`), installed with `navigation-stack`.
- **Needs:** the stack's root element (whose children are its pages) and a way to read a page's header.

```ts
function createTitleFlight(cont: HTMLElement, source: TitleFlightSource): {
  fly: (pick: () => [from: HTMLElement | null, to: HTMLElement | null, toPage: HTMLElement | null | undefined]) => void
  end: () => void
  destroy: () => void
}

interface TitleFlightSource {
  parts: (page: HTMLElement) => TitleParts   // the header elements of a page element
  committed: () => boolean                   // whether the swipe that just ended popped the page
}
```

| Function | Does |
| --- | --- |
| `fly(pick)` | Ends any flight, then after one animation frame (so the new page has laid out its bar) reads `[from, to, toPage]` from `pick()` and plays the flight on the smooth spring. |
| `end()` | Ends the flight in progress and restores the real labels. |
| `destroy()` | Stops watching swipes and ends the flight. Call it when the container unmounts. |

There is no scrub function to call: while a page swipes back, the top page and the one under it carry `data-swiping` and the swipe writes `--stack-progress` on them (UI SDK's stack does this). The flight watches those attributes, follows the progress, and when the swipe ends settles on the tray spring toward `1` if `committed()` says the page popped, else back to `0`.

Three helpers go with it, also from the module: `shownTitle(parts)` (the title a page shows now: its large title until it scrolls under the bar, else the inline one), `pushedTitle(parts)` (the title that flies out on a push: the shown title, or nothing when a large title has scrolled under the bar) and `backLabel(parts)` (the back label, when it shows the previous title), all taking a `TitleParts` of `{ el, large, inline, back }` elements.

Behaviors to know:

- One flight at a time: starting another, or `destroy`, ends the one in progress, so a push or pop that lands mid-flight takes over.
- Under `prefers-reduced-motion`, nothing flies.
- The flight layer is an absolutely positioned, `aria-hidden`, `pointer-events: none` element appended to `cont`, with `z-index: 300`, so `cont` should be a positioned element.

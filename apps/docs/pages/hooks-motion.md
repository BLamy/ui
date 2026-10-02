# Motion hooks

The hooks behind BL UI's motion: spring and direction helpers for your own animations, and the gesture hooks (`useEdgeSwipe`, `useSheetDrag`, `usePullToRefresh`, `useTitleFlight`) that `NavigationStack`, `SideDrawer`, `FloatingSheet` and the Composer are built on. The principles and presets are on the [Motion](https://blamy.github.io/ui/#/motion) page; the other hooks are in the [Hooks overview](https://blamy.github.io/ui/#/hooks).

`useMotion`, `useSpringTransition`, `useDirection`, `useReducedMotion`, `useMorphTransition`, `useEdgeSwipe` and `useSheetDrag` are public. `useTabPanelDirection`, `usePullToRefresh` and `useTitleFlight` are registry-only: they are not in `@brett_lamy/ui`, and arrive in your project with the component that uses them (`Tabs`, `NavigationStack`) or as a registry item of their own.

```tsx
// npm
import {
  useMotion, useSpringTransition, useDirection, useReducedMotion, useMorphTransition, useEdgeSwipe, useSheetDrag,
} from '@brett_lamy/ui'

// shadcn registry (aliases)
import { useMotion, useSpringTransition, useDirection } from '@/lib/motion'    // …/r/motion.json
import { useMorphTransition } from '@/components/ui/morph'                    // …/r/morph.json
import { useEdgeSwipe } from '@/lib/edge-swipe'                               // …/r/edge-swipe.json
import { useSheetDrag } from '@/lib/sheet-drag'                               // …/r/sheet-drag.json
import { usePullToRefresh } from '@/lib/pull-to-refresh'                      // …/r/pull-to-refresh.json (registry-only)
import { useTitleFlight } from '@/lib/title-flight'                           // …/r/title-flight.json (registry-only)
import { useTabPanelDirection } from '@/components/ui/tabs'                   // …/r/tabs.json (registry-only)
```

## `useMotion`

Returns the `framer-motion` module. It is not a stateful hook (it reads no context and has no effects), so it can be called anywhere a hook can. It exists for the prototype's call shape; `import { motion } from 'framer-motion'` does the same and is preferred.

- **Export:** public. Registry item `motion` (`@/lib/motion`).
- **Needs:** nothing.

```ts
function useMotion(): typeof import('framer-motion')
```

```tsx
const { motion, AnimatePresence } = useMotion()
```

`loadMotion()`, exported alongside it, is a no-op kept for the same reason: framer-motion is a static import.

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

## `useTabPanelDirection`

Registry-only. The CSS variables a tab panel needs to arrive from the side of the tab that was just selected.

- **Export:** not in `@brett_lamy/ui`. It is in the `tabs` registry item (`@/components/ui/tabs`) and used by `TabPanel` and, in `tab-view`, by `TabViewPanel`.
- **Needs:** to be rendered inside `Tabs` or `TabView`, which provide the direction. **Outside them:** the direction is `0`, so the variables are `0` and the panel does not move.

```ts
function useTabPanelDirection(orientation: 'horizontal' | 'vertical' = 'horizontal'): CSSProperties
// horizontal → { '--bl-dx': dir, '--bl-dy': 0 }   vertical → { '--bl-dx': 0, '--bl-dy': dir }
```

`dir` is `-1`, `0` or `1`, computed with `useDirection` from the order of the tabs in the collection. The `animate-bl-panel-in` and `animate-bl-panel-out` utilities read the variables and move the panel 28px along them.

```tsx
import { TabPanel as AriaTabPanel } from 'react-aria-components'

function MyPanel(props: React.ComponentProps<typeof AriaTabPanel>) {
  const direction = useTabPanelDirection()
  return (
    <AriaTabPanel
      {...props}
      style={direction}
      className="data-entering:animate-bl-panel-in motion-reduce:data-entering:animate-bl-fade-in"
    />
  )
}
```

`TabPanel` and `TabViewPanel` already do this; reach for the hook only for a panel of your own. It is evaluated at render, so a style object it returns is new each time.

## `useEdgeSwipe`

A back swipe from an element's left edge: the gesture `NavigationStack` and `SideDrawer` share. The hook owns the parts that must not drift between them (when the drag engages, pointer capture, how a release commits). You supply what moves and what happens on release.

- **Export:** public. Registry item `edge-swipe` (`@/lib/edge-swipe`).
- **Needs:** nothing; spread the result on the element.

```ts
function useEdgeSwipe<C>(config: EdgeSwipeConfig<C>): { bind: {
  onPointerDownCapture: (e: React.PointerEvent) => void
  onPointerMove: (e: React.PointerEvent) => void
  onPointerUp: () => void
  onPointerCancel: () => void
} }

interface EdgeSwipeConfig<C> {
  target: () => HTMLElement | null     // the element whose left edge starts the swipe; its width is a full swipe
  edge: number                         // width of the edge zone, px
  commit: number                       // fraction of the width past which a release commits
  flick: number                        // release speed (px/ms) past which it commits whatever the distance
  begin: (e: React.PointerEvent, rect: DOMRect) => C | null   // a press landed in the zone: return the context, or null to ignore it
  engage?: (ctx: C) => void            // the drag engaged; runs once, just before the first move
  move: (ctx: C, p: number, dx: number) => void          // p is 0 to 1 of the width, dx is px
  release: (ctx: C, r: { p: number; dx: number; commit: boolean }) => void
  abort?: (ctx: C) => void             // the press ended without engaging (a tap, a vertical drag)
}
```

```tsx
function Page({ onBack }: { onBack: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const swipe = useEdgeSwipe<HTMLElement>({
    target: () => ref.current,
    edge: 24, commit: 0.4, flick: 0.5,
    begin: () => ref.current,
    move: (el, _p, dx) => { el.style.transform = `translateX(${dx}px)` },
    release: (el, { commit }) => {
      el.style.transform = ''
      if (commit) onBack()
    },
    abort: (el) => { el.style.transform = '' },
  })
  return <div ref={ref} {...swipe.bind}>…</div>
}
```

How it decides, from the source:

- A press within `edge` px of the element's left edge only **arms** the gesture. It engages on a clearly horizontal, rightward drag: more than 8px, and at least 1.2 times as far across as down. A vertical drag of more than 14px before that drops the gesture, so the page scrolls.
- The pointer is **captured when the drag engages**, not on press. A tap in the edge zone still reaches the control under it, and a swipe that began on a button does not press it when the finger lifts.
- It commits when the travelled fraction is greater than `commit`, or the release speed is greater than `flick`.
- Only the primary button starts it (`e.button` must be `0`).
- The press is read in the **capture** phase (`onPointerDownCapture`), because a react-aria button inside stops `pointerdown` from bubbling.

Gotchas:

- It is **left edge and rightward only**. There is no right-to-left handling.
- The latest `config` is read through a ref, so inline functions are fine and closures are never stale. `bind` is a new object each render.
- If `move` throws, the gesture ends (`release` does not run) and the error is reported with `reportError` (or `console.error`), so it still reaches your error tracking.
- Nothing here reads `prefers-reduced-motion`: it follows the finger, and `release` is yours to animate.

## `useSheetDrag`

The grow, snap and fold gesture behind `FloatingSheet`'s cap and the Composer's draggable bump. The body follows the pointer one-to-one (rubber-banding past its ends); on release the pointer's velocity is projected forward to pick a stop, and a spring carries the body there from that velocity, so a flick keeps its momentum.

- **Export:** public, with `SHEET_TAP_SLOP` and `SHEET_MINIMIZE_TRAVEL`. Registry item `sheet-drag` (`@/lib/sheet-drag`).
- **Needs:** nothing; spread `handlers` on the handle element.

```ts
function useSheetDrag(options: SheetDragOptions): SheetDragState
```

| Option | Default | Effect |
| --- | --- | --- |
| `open`, `onOpenChange` | required | The resting state: `maxReveal` when open, `peek` (or a detent) when not. `onOpenChange` is called when a release changes it, and when a tap goes through `toggle`. |
| `peek` | required | Body height visible at rest, px. |
| `maxReveal` | required | Body height when fully open, px. |
| `detents` | `[]` | Extra resting heights between `peek` and `maxReveal`. |
| `minimizable`, `minimized`, `onMinimizedChange` | `false`, `false` | Allow dragging below rest to fold into a FAB. `onMinimizedChange` fires when a release changes it. |
| `fold` | `'fab'` | `'fab'` closes the peek on the way down and the caller morphs the surface into a FAB. `'dismiss'` holds the body at `peek` and leaves the caller to slide the whole surface away by `minimize` (0 at rest, 1 gone). |
| `foldTravel` | `peek + SHEET_MINIMIZE_TRAVEL` (96px) | Downward travel below `peek` that folds all the way (`minimize` is 1). |
| `spring` | `'tray'` | The spring the body settles with. |

| Returned | Meaning |
| --- | --- |
| `reveal` | The body height to draw this frame: the finger's while dragging, then the spring's. |
| `minimize` | 0 to 1 fold toward the FAB (or off the edge, with `fold: 'dismiss'`) to draw this frame. |
| `dragging`, `settling` | A finger is on the handle; the spring is carrying the body to rest. |
| `detent` | The middle detent the sheet rests at, px, or `null` at peek or open. |
| `handlers` | `onPointerDown`, `onPointerMove`, `onPointerUp`, `onPointerCancel`, `onLostPointerCapture`: spread on the handle. |
| `toggle()` | A tap on the handle: toggles `open`. Ignored right after a drag. |

```tsx
function Tray({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const drag = useSheetDrag({ open, onOpenChange: setOpen, peek: 72, maxReveal: 360, detents: [220] })
  return (
    <div className="absolute inset-x-0 bottom-0 rounded-t-sheet bg-card">
      <button
        type="button"
        aria-label={open ? 'Collapse' : 'Expand'}
        aria-expanded={open}
        className="grid h-5 w-full touch-none place-items-center"
        onClick={drag.toggle}
        {...drag.handlers}
      >
        <span className="h-1 w-8 rounded-full bg-tertiary-foreground" />
      </button>
      <div className="overflow-hidden" style={{ height: drag.reveal }}>{children}</div>
    </div>
  )
}
```

Gotchas:

- **Give the handle `touch-none`.** Without `touch-action: none` the browser claims a vertical touch drag for scrolling and the pointer events stop. `FloatingSheet`'s cap and the Composer's handle both have it.
- Wire `onClick={drag.toggle}` yourself; the pointer handlers do not fire clicks. `toggle` ignores the click that follows a drag.
- It calls `setState` for `reveal` and `minimize` every frame while dragging or settling, so the component using it re-renders per frame. Keep what depends on `reveal` small, or write it into a CSS variable (as `FloatingSheet` does).
- Under `prefers-reduced-motion`, and on the first render, the body jumps to rest instead of springing. A release still picks the stop; only the spring is skipped.
- Mid-flight, a new press catches the body where it is. External changes (`open`, `peek`, `minimized`) spring too, and a drag that is cancelled springs back.
- It stops any running animation on unmount.
- `handlers` and the returned object are rebuilt each render.

## `usePullToRefresh`

Registry-only. Pull-to-refresh for a scroller at its top: drag down and the content follows (with rubber-band resistance) while a spinner fades in; past a threshold, a release calls `onRefresh` and holds the content open until it finishes (at least about a second). `NavigationStack` uses it.

- **Export:** not in `@brett_lamy/ui`. Registry item `pull-to-refresh` (`@/lib/pull-to-refresh`), also installed with `navigation-stack`.
- **Needs:** nothing; it takes refs and returns handlers to spread on the scroller.

```ts
function usePullToRefresh(options: {
  onRefresh?: () => void | Promise<unknown>   // pull-to-refresh is off without it
  scroller: RefObject<HTMLElement | null>   // the scroller the pull starts on; it must be at its top
  content: RefObject<HTMLElement | null>    // the content that follows the finger
  spinner: RefObject<HTMLElement | null>    // the spinner that fades in as the pull grows
}): { refreshing: boolean; bind: { onPointerDown; onPointerMove; onPointerUp; onPointerCancel } }
```

```tsx
function Feed({ reload }: { reload: () => void }) {
  const scroller = useRef<HTMLDivElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const spinner = useRef<HTMLDivElement>(null)
  const pull = usePullToRefresh({ onRefresh: reload, scroller, content, spinner })
  return (
    <div ref={scroller} className="relative h-full overflow-y-auto" {...pull.bind}>
      <div ref={spinner} className="absolute top-2 left-1/2 opacity-0"><Spinner /></div>
      <div ref={content}>{/* rows */}</div>
    </div>
  )
}
```

How it behaves, from the source:

- A press arms the pull only when the scroller is within 2px of the top. It engages after the finger moves more than 10px down and more than 1.3 times as far down as across; moving up more than 6px first cancels it.
- It writes `transform` and `transition` straight onto `content` and `spinner` during the drag, so React does not render per pointer move. The spinner's transform is `translateX(-50%) rotate(…) scale(…)`, so position it with `left: 50%`.
- The pull is rubber-banded (it is capped at 110px). A release when the content has been pulled more than 54px sets `refreshing` and holds the content at 52px.

Behaviors to know:

- **`onRefresh` runs at release.** Return a promise and the spinner stays until it settles; it always shows for at least 1100ms so a fast refresh doesn't flash. A rejection or a thrown error still ends the refresh and is reported with `reportError`.
- Timers are cleared on unmount, so an unmounted component gets no late state update.
- `bind` is a new object each render, and the hook ignores `prefers-reduced-motion`.

## `useTitleFlight`

Registry-only. The header title morph: on a push, the previous screen's title (large or inline) flies into the new screen's back button; on pop, the back label flies back into the title it names. Two copies of the label (one styled as the source, one as the destination) travel together, scaling and cross-fading, while the real labels hide. `NavigationStack` is the only user; this section is for anyone building a similar container.

- **Export:** not in `@brett_lamy/ui`. Registry item `title-flight` (`@/lib/title-flight`), installed with `navigation-stack`.
- **Needs:** nothing; it takes a ref to the element the flight layer is drawn in.

```ts
function useTitleFlight(cont: RefObject<HTMLElement | null>): {
  fly: (pick: () => [from: HTMLElement | null, to: HTMLElement | null, toScreen: HTMLElement | null | undefined]) => void
  scrub: (from: HTMLElement | null, to: HTMLElement | null, toScreen: HTMLElement | null | undefined) => ActiveFlight | null
  release: (flight: ActiveFlight | null | undefined, p: number, to: 0 | 1) => void
  end: () => void
  isCurrent: (flight: ActiveFlight | null | undefined) => flight is ActiveFlight
}
```

| Function | Does |
| --- | --- |
| `fly(pick)` | Ends any flight, then after one animation frame (so the new screen has laid out its bar) reads `[from, to, toScreen]` from `pick()` and plays the flight on the smooth spring. |
| `scrub(from, to, toScreen)` | Starts a flight your finger drives (an edge swipe). Returns the flight, or `null` when there is nothing to fly or motion is reduced. Set its progress with `flight.f.set(p)`. |
| `release(flight, p, to)` | Hands a scrubbed flight to the tray spring from progress `p` toward `0` or `1`. |
| `end()` | Ends the flight in progress and restores the real labels. |
| `isCurrent(flight)` | Whether `flight` is the one in progress. |

Two helpers go with it, also from the module: `shownTitle(parts)` (the title a screen shows now: its large title until it scrolls under the bar, else the inline one) and `backLabel(parts)` (the back label, when it shows the previous title), both taking a `TitleParts` of `{ el, large, inline, back }` elements.

Behaviors to know:

- One flight at a time: starting another, or unmounting, ends the one in progress, so a push or pop that lands mid-flight takes over.
- Under `prefers-reduced-motion`, `fly` returns without playing and `scrub` returns `null`.
- The flight layer is an absolutely positioned, `aria-hidden`, `pointer-events: none` element appended to `cont`, with `z-index: 300`, so `cont` should be a positioned element.
- The returned functions are new each render; read them from the latest render rather than from a dependency array.

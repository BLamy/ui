# Motion and gestures

In BL UI 6.0 motion is CSS. A part's state is on attributes (`data-open`, `data-starting-style`, `data-ending-style`, `data-covered`, `data-swiping`) and its progress on CSS variables (`--panel-height`, `--stack-progress`, `--pull-distance`), and transitions on the kit's spring tokens animate between them. That makes every animation interruptible (a transition starts from where the last one is), instant while a finger drags (a `data-*` attribute turns the transition off), and calm under `prefers-reduced-motion` (`motion-reduce:`). UI SDK's motion behaviors supply the attributes and keep an element mounted until its exit has played: `bindPanel` for a panel that animates its height, `animateIn` and `animateOut` for anything that comes and goes, and the math in `@ui-sdk/core/gesture` for throws, springs and rubber-banding. framer-motion stays only for purely visual morphs (shared layout, [TextMorph](https://blamy.github.io/ui/#/text-morph), [NumberMorph](https://blamy.github.io/ui/#/number-morph)). The upstream reference is [Transitions and Gestures](https://ui-sdk.dev/docs/core/behaviors/motion).

```ts
import { bindPanel, hiddenAttrs, bindFindable, animateIn, animateOut } from '@ui-sdk/core'
import { createVelocityTracker, projectDistance, solveSpring, rubberBand, sectorOf } from '@ui-sdk/core/gesture'
```

## The spring tokens

The kit's four springs (`snappy` for small controls, `smooth` for layout and panels, `tray` for sheets, `bouncy` for rare celebratory moments) are CSS easing curves, generated into `tokens.css` as `--ease-spring-<name>` with a matching `--duration-spring-<name>`, and available as utilities:

```tsx
<div className="transition-[translate] duration-spring-smooth ease-spring-smooth data-starting-style:translate-y-2 motion-reduce:transition-none" />
```

From script, `springCss('translate', 'smooth')` in `@/lib/motion` writes the same `transition` value. See [Motion](https://blamy.github.io/ui/#/motion) for the curves.

## Already done for you

| Behavior | Where the kit uses it |
| --- | --- |
| Entrance and exit (`data-starting-style`, `data-ending-style`) | Every popup (`popoverMotion` in `@/lib/primitives`), Dialog, Sheet, Toast: UI SDK's parts write the attributes, the kit's classes animate them. |
| `animateIn` / `animateOut` | `Conversation` (a part that leaves after its exit), `ArtifactChatContainer` (the chat column when the container turns compact). |
| `bindPanel` | UI SDK's Collapsible and Accordion, under the kit's [Disclosure](https://blamy.github.io/ui/#/disclosure), and UI SDK's Tree for opening branches. |
| A page stack | [NavigationStack](https://blamy.github.io/ui/#/navigation-stack), on the kit's `createPageStack` from `@/lib/stack`, built on UI SDK's `bindLayer` and `animateIn` / `animateOut` (see [The kit's behaviors](https://blamy.github.io/ui/#/behaviors-kit)). |
| Keeping a React element mounted through its exit | `usePresence`, `usePresenceList` and `useEnterExit` from `@/lib/presence`, the kit's React side of `animateIn` / `animateOut` (see [The kit's behaviors](https://blamy.github.io/ui/#/behaviors-kit)). |

## Panels that animate their height

`bindPanel` coordinates one panel: it measures the content and writes the height through your `size` callback (a measured height while it moves, `auto` once open), keeps a closing panel present until its transition ends (`exited`), and moves focus to the trigger if it was inside a panel that closes. Your state says what is open and what is still leaving:

{% demo src="behaviors-motion/panel" %}

```ts
panel: slot<{ value: string }>({
  props: { value: 'string' },
  present: (state, { key }) => state.expanded.includes(key) || state.exiting.includes(key),
  bind: (el, { api, key, store }) =>
    bindPanel(el, {
      size: (node, height) => node.style.setProperty('--panel-height', height),
      isOpen: () => store.get().expanded.includes(key),
      isExiting: () => store.get().exiting.includes(key),
      isFindable: () => false,
      opening: () => 'animate',
      reveal: () => api.toggle(key),
      trigger: () => el.previousElementSibling as HTMLElement | undefined,
      subscribe: store.subscribe,
      settled: () => {},
      exited: () => store.set({ exiting: without(store.get().exiting, key) }),
    }),
}),
```

```tsx
<FaqPanel className="h-(--panel-height) overflow-hidden transition-[height] duration-spring-smooth ease-spring-smooth data-starting-style:h-0 data-ending-style:h-0 motion-reduce:transition-none" />
```

`opening()` returns `"mount"` for a panel that is open from the start (no animation), `"instant"` to skip one opening, or `"animate"`. To keep a closed panel searchable with the browser's find, keep it mounted with `hiddenAttrs(open, true)` (`hidden="until-found"`), return `true` from `isFindable`, and open it in `reveal`; `bindFindable` does the same for content without a transition.

## Entering and leaving

For an element that simply appears and disappears, `animateIn(el)` puts `data-starting-style` on it for its first frame, so a transition runs from that style to its resting one. `animateOut(el, done)` sets `data-ending-style` and calls `done` once the element's transitions and animations have finished (with a timeout, so a stuck animation can't keep it mounted); remove the element there. Both return a cleanup: stop a pending entrance before starting the exit.

{% demo src="behaviors-motion/presence" %}

```ts
item: slot<{ value: string }>({
  props: { value: 'string' },
  bind: (el, { api, key, store }) => {
    let stop = animateIn(el)
    const unsubscribe = store.subscribe(() => {
      if (!store.get().leaving.includes(key) || el.hasAttribute('data-ending-style')) return
      stop()
      stop = animateOut(el, () => api.remove(key))
    })
    return () => {
      unsubscribe()
      stop()
    }
  },
}),
```

The row collapses with `grid-template-rows: 1fr → 0fr`, so no height is measured. Under reduced motion only the fade is left (`motion-reduce:transition-opacity`), and the row still leaves only after it.

## Gesture math

`@ui-sdk/core/gesture` interprets pointer movement; your primitive still handles input (with `bindDrag`), state and frames. The fork's edge swipe and pull to refresh are built from these.

| Helper | What it does |
| --- | --- |
| `createVelocityTracker({ maxSpeed, staleAfter })` | `add(time, x)` while moving, `velocity(time)` on release, in px/ms. `staleAfter` makes a pause before release read as zero, so holding still isn't a flick. Call `reset()` at the start of each gesture. |
| `projectDistance(velocity, decay)` | How far that speed carries an object as it slows down (`rate` is the per-millisecond decay, e.g. `0.994`): aim a throw at `x + projectDistance(v, 0.994)`, or pick the snap point nearest it. |
| `solveSpring(response, dampingRatio, displacement, velocity)` | A spring's `position(t)` and `velocity(t)` (t in ms) from the release, for settling onto a target in a frame loop. Damping `1` settles without a bounce. |
| `rubberBand(distancePastEdge, dimension)` | Resistance past an edge: the result approaches `dimension` as the pull grows. |
| `sectorOf(dx, dy, count, { deadZone, start })` | Which wedge a stroke points at (0 is up, then clockwise), `-1` inside the dead zone (18px by default). For radial menus. |

Prefer a CSS transition over `solveSpring` whenever the end state is known: the transition is interruptible and needs no frame loop. Reach for the solver when the motion has to continue a finger's velocity.

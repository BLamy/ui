# Motion

Every animation in BL UI follows one vocabulary, borrowed from Benji Taylor's [Family Values](https://benji.org/family-values) — the design principles behind the Family wallet. Read the original; it is short and every point in it is visible in the app. This page is how those principles become components.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/motion.json https://blamy.github.io/ui/r/text-morph.json https://blamy.github.io/ui/r/number-morph.json https://blamy.github.io/ui/r/swap.json{% endcommand %}

Copies the source into your project's `lib/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { springs } from '@/lib/motion'
import { TextMorph } from '@/components/ui/text-morph'
import { NumberMorph } from '@/components/ui/number-morph'
import { Swap } from '@/components/ui/swap'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from their module (the Motion library's entry, `@brett_lamy/ui/motion`, has them too):

```tsx
import '@brett_lamy/ui/styles.css'

import { springs } from '@brett_lamy/ui/lib/motion'
import { TextMorph } from '@brett_lamy/ui/text-morph'
import { NumberMorph } from '@brett_lamy/ui/number-morph'
import { Swap } from '@brett_lamy/ui/swap'
```
{% endtab %}
{% endtabs %}

## Principles

1. **Fluid — things fly, they never teleport.** A change of state is a change of place, and the motion should explain where you went. Tabs move in the direction of the tab you picked; a pushed screen arrives from the right and a popped one leaves the same way; a new tray step comes in from the side you are heading.
2. **Springs, not timers.** Springs start from wherever the element is and keep going if you change your mind mid-flight. Press a button twice quickly and it retargets instead of restarting.
3. **Continuity.** An element that persists between two states stays one element and *morphs* — its size, position, label or icon — instead of being duplicated, cross-faded or remounted. A button's "Continue" becomes "Confirm" by moving the letters the two words share. A changing number rolls digit by digit and its commas slide. A chevron turns rather than being swapped for another chevron. A tray that needs more room grows.
4. **Gradual revelation.** Show what is relevant now; let the next thing arrive when it is needed. Trays vary in height from step to step, so progress is felt as well as read.
5. **Delight is selective.** The less often a moment happens, the more it may celebrate. A finished backup can burst into confetti; a tab switch should be quick and quiet. Frequent controls use the snappy spring, and nothing on a hot path waits for an animation.
6. **Respect reduced motion.** With `prefers-reduced-motion`, movement collapses to a short fade (or nothing) — every component and primitive below honours it.

## Spring presets

The same four springs exist in JavaScript (framer-motion) and in CSS (sampled into `linear()` easings), so a CSS transition and a framer animation feel like the same physics.

| Preset | framer-motion | CSS / Tailwind | Use for |
| --- | --- | --- | --- |
| `snappy` | `springs.snappy` | `duration-spring-snappy ease-spring-snappy` | presses, toggles, indicators, small controls |
| `smooth` | `springs.smooth` | `duration-spring-smooth ease-spring-smooth` | layout, panels, navigation pushes |
| `tray` | `springs.tray` | `duration-spring-tray ease-spring-tray` | sheets, trays, drawers, height morphs |
| `bouncy` | `springs.bouncy` | `duration-spring-bouncy ease-spring-bouncy` | rare, celebratory moments only |

```tsx
import { motion } from 'framer-motion'
import { springs, springCss, useDirection, useSpringTransition } from '@brett_lamy/ui/lib/motion'

// framer-motion
<motion.div layout transition={springs.smooth} />
// Tailwind
<div className="transition-transform duration-spring-smooth ease-spring-smooth"/>
// inline CSS
<div style={{ transition: springCss(['transform', 'opacity'], 'tray') }} />

// the preset, or { duration: 0 } under reduced motion
const t = useSpringTransition('snappy')
// -1 | 0 | 1 — direction of the latest change
const dir = useDirection(tabIndex)
```

Exits are quicker than entrances: what leaves gets out of the way, what arrives takes its time. Exits use a short ease-in rather than a spring.

| Token | Value | Use |
| --- | --- | --- |
| `--ease-spring-{snappy,smooth,tray,bouncy}` | `linear(…)` | the spring curves |
| `--duration-spring-{snappy,smooth,tray,bouncy}` | 383 / 550 / 413 / 597ms | the time each spring takes to settle |
| `--ease-exit` / `--duration-exit` | ease-in, 140ms | overlays and panels leaving |
| `--duration-exit-tray` | 240ms | sheets and trays leaving |
| `motionFades.in` / `motionFades.out` | 220ms / 140ms | opacity and blur in framer-motion |

{% demo src="motion/spring-presets" %}

## Text that morphs

`TextMorph` animates one label into the next. Letters the two strings share — matched by character and occurrence — slide to their new positions; the others blur out and in; the box springs to the new width. At rest it is a single plain text run, so kerning, selection and screen readers are unaffected. `Button` does this automatically for a plain-string child.

{% demo src="motion/text-morph" %}

## Numbers that roll

`NumberMorph` formats with `Intl.NumberFormat` and gives every part an identity by *place*: the units digit is always the units digit, the thousands separator is always the thousands separator. Typing a digit therefore slides the comma one place left instead of re-rendering the string, and a changed digit rolls through the reel — up when the value rises, down when it falls. `Progress` uses it for its percentage.

{% demo src="motion/amount-entry" %}

## Direction follows the index

`Tabs`, `Segmented` and `ToggleGroup` draw their selection as one element that slides and resizes to the new item. `TabsPanel` arrives from the side of the tab you picked and the old panel leaves the other way (vertically when the tabs sit at the start or end). `NavigationStack` pushes from the right, pops to the right, and its edge-swipe hands off to the tray spring from wherever your finger let go.

{% demo src="motion/directional-tabs" %}

## Trays that change height

`AnimatedHeight` measures its content and springs its height to match; [Swap](https://blamy.github.io/ui/#/swap) replaces content by `value`, moving it in the direction you pass (`useDirection(step)`). Together they are Family's tray step. `DialogView` does both inside a [Dialog](https://blamy.github.io/ui/#/dialog) flow (it infers direction from the root's `view` history), and `SheetView` does the same in a [Sheet](https://blamy.github.io/ui/#/sheet) (with the Sheet's `view`, or alone for content-sized sheets).

{% demo src="motion/step-tray" %}

## Icons turn, they don't swap

`Chevron` is one glyph that rotates to face `right`, `down`, `left` or `up`, always the short way round — the forward arrow becomes a back arrow by turning. `Swap effect="pop"` changes a glyph in place (copy → check, idle → spinner → done) by shrinking and blurring the old one out as the new one grows in, stacked in the same cell so nothing around it moves. `Chevron` lives with the icons in `@/lib/icon`. `Disclosure` turns its chevron as its panel grows.

## Coming and going

Anything that appears and disappears (a toast, a tile, a glyph, a view) uses UI SDK's presence: `animateIn` writes `data-starting-style` for the first frame, `animateOut` writes `data-ending-style` and keeps the element mounted until its CSS transitions finish. The kit's `usePresence(present)` (one element) and `usePresenceList(items, key)` with `useEnterExit` (keyed children) in `@/lib/presence` wrap them for React; the motion itself is CSS on the spring tokens. framer-motion is kept only for what CSS can't do: shared-layout morphs (`Morph`), digit and letter morphs (`NumberMorph`, `TextMorph`), spring-animated values (`AnimatedHeight`'s height, `Chevron`'s angle) and confetti.

```tsx
const toast = usePresence<HTMLDivElement>(shown)
return toast.mounted ? (
  <div ref={toast.ref} className="transition-opacity duration-spring-snappy data-starting-style:opacity-0 data-ending-style:opacity-0">…</div>
) : null
```

## A rare moment

`Celebrate` bursts confetti and a ring out from behind the element it wraps whenever `fire` changes. Save it for moments that happen rarely and mean something — a completed backup, a first payment.

{% demo src="motion/celebrate" %}

## When the engine loads

The springs run on framer-motion, and an everyday part does not load framer-motion to be drawn. `Button`, `Toast`, `List`, `TextMorph`, `Chevron` and `AnimatedHeight` render their resting markup without it, on the server too. Once one that can animate has mounted (a Button with a text label, a List whose rows can move, a Toast), the kit fetches the engine when the browser is idle: one chunk for the page (about 29 kB gzipped), shared by every part.

A label that changes, or a row that moves, before that chunk has arrived simply shows its new state, as it does under reduced motion. From then on it animates. Nothing renders again and no element is replaced when the engine arrives, so nothing shifts and focus stays where it was.

`preloadMotion()` fetches the engine sooner and resolves when it is ready. Call it before a moment that has to animate the first time, or in a test that looks at a morph:

```tsx
import { preloadMotion } from '@brett_lamy/ui/lib/motion'

await preloadMotion()
```

`NumberMorph`, `Morph` and `Celebrate` are made of framer-motion's own elements and import it themselves, so framer-motion is part of the bundle of a page that renders one of them (`Progress` and `ProgressRing` show their percentage with `NumberMorph`). The everyday parts beside them still wait for the kit's own fetch, so the first change is only sure to animate after `preloadMotion()`.

`preloadMotion()` rejects if the fetch fails (offline, a deploy that replaced the chunk). The parts carry on without animating, and because a browser remembers a failed module fetch for as long as the page is open, they animate again after a reload.

A `List` no longer wraps its rows in framer-motion's `MotionConfig`: an element of your own inside a row that should stand still under Reduce motion needs `<MotionConfig reducedMotion="user">` around it, or `useReducedMotion()`.

## Slowing it down

These docs have a motion panel for reviewing animation: press **⌥M** (Alt+M) to show or hide it, then pick 1×, ½×, ¼× or ⅒× speed. Every demo slows together, so a title flying into a back button or a sheet settling can be watched frame by frame. Change the speed while something is moving and it carries on from where it was.

The kit's motion comes from two engines and the panel slows both: framer-motion springs (the clock they read is scaled) and CSS transitions and animations (each one's playback rate is set). A link can carry the setting — `?motion=0.25` for a speed, `?reduce=1` for reduced motion — and a demo opened full screen takes the same parameters (`/?demo=navigation-stack/title-morph&motion=0.25`).

**Reduce** makes `matchMedia('(prefers-reduced-motion: reduce)')` answer yes, which is what the kit's JavaScript checks (title flights are skipped, springs become instant). CSS `motion-reduce:` variants are a media query only the browser can flip: for those use DevTools → Rendering → *Emulate CSS media feature prefers-reduced-motion*. This is a tool of these docs, not part of the kit — nothing in your app changes.

## What moves where

| Component | Motion |
| --- | --- |
| `Button` | sinks on press (snappy); a string label morphs |
| `Toggle`, `ToggleGroup` | press sink; a single-select `segmented` group slides its card |
| `Segmented`, `Tabs` | the selection indicator slides and resizes (smooth) |
| `TabsPanel` | directional enter / exit |
| `Switch` | thumb springs across and stretches while pressed |
| `Checkbox` | the tick draws itself on; press sink |
| `Radio`, `Slider` | press sink / thumb grows while dragging |
| `Disclosure` | panel height (tray) + content fades down + chevron turns |
| `Dialog`, `Popover`, `Tooltip`, `DropdownMenu`, `Select`, `Combobox` | grow out of the trigger's anchor point (snappy), leave quicker |
| `Sheet`, `AdaptivePane` drawers and pushes | slide on the tray spring; `SheetView` for stepping sheets |
| `Dialog` with `view` (`DialogView`, `DialogBack`) | height morph, directional views and titles, back chevron grows in |
| `NavigationStack` | push / pop on the smooth spring, interruptible; swipe release continues on the tray spring |
| `ListRow` | swipe settles on snappy; delete collapses its height on the tray spring |
| `Progress` | fill springs to value; percentage rolls |
| `Skeleton` | a highlight sweeps across instead of pulsing |
| `Spinner` | grows in when it appears |

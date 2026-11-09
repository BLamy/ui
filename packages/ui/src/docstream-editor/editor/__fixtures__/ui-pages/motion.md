# Motion

Every animation in BL UI follows one vocabulary, borrowed from Benji Taylor's [Family Values](https://benji.org/family-values) — the design principles behind the Family wallet. Read the original; it is short and every point in it is visible in the app. This page is how those principles become components.

{% tabs title="Installation" sync="install" %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import {
  springs, TextMorph, NumberMorph, IconSwap,
} from '@brett_lamy/ui'
```
{% endtab %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/motion.json{% endcommand %}

Adds `@/components/ui/motion.tsx`, installs `@brett_lamy/ui`, and wires its stylesheet and tokens into your CSS. Import from your alias:

```tsx
import {
  springs, TextMorph, NumberMorph, IconSwap,
} from '@/components/ui/motion'
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
import { springs, springCss, useDirection, useSpringTransition } from '@brett_lamy/ui'

<motion.div layout transition={springs.smooth} />                    // framer-motion
<div className="transition-transform duration-spring-smooth ease-spring-smooth" />   // Tailwind
<div style={{ transition: springCss(['transform', 'opacity'], 'tray') }} />         // inline CSS

const t = useSpringTransition('snappy')   // the preset, or { duration: 0 } under reduced motion
const dir = useDirection(tabIndex)        // -1 | 0 | 1 — direction of the latest change
```

Exits are quicker than entrances: what leaves gets out of the way, what arrives takes its time. Exits use a short ease-in rather than a spring.

| Token | Value | Use |
| --- | --- | --- |
| `--ease-spring-{snappy,smooth,tray,bouncy}` | `linear(…)` | the spring curves |
| `--duration-spring-{snappy,smooth,tray,bouncy}` | 383 / 550 / 413 / 597ms | the time each spring takes to settle |
| `--ease-exit` / `--duration-exit` | ease-in, 140ms | overlays and panels leaving |
| `--duration-exit-tray` | 240ms | sheets and trays leaving |
| `fades.in` / `fades.out` | 220ms / 140ms | opacity and blur in framer-motion |

{% demo src="motion/spring-presets" %}

## Text that morphs

`TextMorph` animates one label into the next. Letters the two strings share — matched by character and occurrence — slide to their new positions; the others blur out and in; the box springs to the new width. At rest it is a single plain text run, so kerning, selection and screen readers are unaffected. `Button` does this automatically for a plain-string child.

{% demo src="motion/text-morph" %}

## Numbers that roll

`NumberMorph` formats with `Intl.NumberFormat` and gives every part an identity by *place*: the units digit is always the units digit, the thousands separator is always the thousands separator. Typing a digit therefore slides the comma one place left instead of re-rendering the string, and a changed digit rolls through the reel — up when the value rises, down when it falls. `Progress` uses it for its percentage.

{% demo src="motion/amount-entry" %}

## Direction follows the index

`Tabs`, `Segmented`, `ToggleGroup` and `TabView` draw their selection as one element that slides and resizes to the new item. `TabPanel` and `TabViewPanel` arrive from the side of the tab you picked and the old panel leaves the other way (vertically for a vertical `TabView`). `NavigationStack` pushes from the right, pops to the right, and its edge-swipe hands off to the tray spring from wherever your finger let go.

{% demo src="motion/directional-tabs" %}

## Trays that change height

`AnimatedHeight` measures its content and springs its height to match; `ContentSwap` replaces content by key, moving it in the direction you pass (`useDirection(step)`). Together they are Family's tray step. `Credenza` does both internally — it infers direction from the view history — and `SheetContent` takes `animateHeight` for short, content-sized sheets.

{% demo src="motion/step-tray" %}

## Icons turn, they don't swap

`Chevron` is one glyph that rotates to face `right`, `down`, `left` or `up`, always the short way round — the forward arrow becomes a back arrow by turning. `IconSwap` changes a glyph in place (copy → check, idle → spinner → done) by shrinking and blurring the old one out as the new one grows in, stacked in the same cell so nothing around it moves. `Disclosure` turns its chevron as its panel grows.

## A rare moment

`Celebrate` bursts confetti and a ring out of its parent's centre whenever `fire` changes. Save it for moments that happen rarely and mean something — a completed backup, a first payment. Pair it with `Haptics.notification('success')`.

{% demo src="motion/celebrate" %}

## What moves where

| Component | Motion |
| --- | --- |
| `Button` | sinks on press (snappy); a string label morphs |
| `Toggle`, `ToggleGroup` | press sink; a single-select `filled` group slides its card |
| `Segmented`, `Tabs`, `TabView` | the selection indicator slides and resizes (smooth) |
| `TabPanel`, `TabViewPanel` | directional enter / exit |
| `Switch` | thumb springs across and stretches while pressed |
| `Checkbox` | the tick draws itself on; press sink |
| `Radio`, `Slider` | press sink / thumb grows while dragging |
| `Disclosure` | panel height (tray) + content fades down + chevron turns |
| `Dialog`, `Popover`, `Tooltip`, `DropdownMenu`, `Select`, `ComboBox` | grow out of the trigger's anchor point (snappy), leave quicker |
| `Sheet`, `SideDrawer`, `EdgeDrawer` | slide on the tray spring; `animateHeight` for stepping sheets |
| `Credenza` | height morph, directional views and titles, back chevron grows in |
| `NavigationStack` | push / pop on the smooth spring, interruptible; swipe release continues on the tray spring |
| `List.Row` | swipe settles on snappy; delete collapses its height on the tray spring |
| `Progress` | fill springs to value; percentage rolls |
| `Skeleton` | a highlight sweeps across instead of pulsing |
| `Spinner` | grows in when it appears |
| `HapticIndicator` | one pill that stays while haptics keep coming, morphing its label |

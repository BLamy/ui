# Celebrate

A burst for rare moments: a ring pulses and confetti flies out from behind an element, then falls away. The less often something happens, the more it may celebrate: a backup finishing, a first payment, a streak, not a tab switch. `Celebrate` wraps the thing that succeeded and draws nothing until you fire it. For progress use [Progress](https://blamy.github.io/ui/#/progress) or a [Spinner](https://blamy.github.io/ui/#/spinner), and for a routine confirmation a [Toast](https://blamy.github.io/ui/#/toast).

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/celebrate.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { Celebrate } from '@/components/ui/celebrate'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from their module:

```tsx
import '@brett_lamy/ui/styles.css'

import { Celebrate } from '@brett_lamy/ui/celebrate'
```
{% endtab %}
{% endtabs %}

## Usage

Wrap the thing that succeeded: `<Celebrate fire={n}><SuccessBadge /></Celebrate>`. Celebrate is an `inline-grid` span (`relative isolate`) around its child with the burst on a layer behind it (`-z-1`), so the confetti comes out from behind the badge. `render={<div />}` makes it a block, and `className` places it like any element. Each time `fire` changes to a truthy value, a burst plays (about 1.4s). Bursts overlap if you fire again early.

{% demo src="celebrate/backup" %}

```tsx
const [fired, setFired] = useState(0)

<Celebrate fire={fired}>
  <SuccessBadge />
</Celebrate>

// when the job completes:
setFired((n) => n + 1)
```

`fire` can be a counter, a string or a boolean. The first render never fires, and a falsy value never fires, so `fire={done}` bursts once when `done` becomes true. Use a counter when the same moment can happen repeatedly. The pieces' positions come from a seeded generator, so a given burst looks the same each time it is replayed.

## Reduced motion

With `prefers-reduced-motion` (or framer-motion's `<MotionConfig reducedMotion="always">` around it) only the ring plays, as a soft fade; no confetti is drawn.

## Accessibility

The burst layer is `aria-hidden` and `pointer-events-none`: it is decoration only, and the child keeps its own semantics. Announce the success in text too (a `role="status"` message or the changed label), as nothing in the burst is exposed to assistive technology.

## Props

| Prop | Default | Effect |
| --- | --- | --- |
| `children` | — | What succeeded; the burst comes from behind it. |
| `fire` | — | Change it to a truthy value to fire a burst. |
| `count` | `22` | Confetti pieces per burst. |
| `spread` | `100` | How far the pieces fly, in px; they also fall by about the same distance. |
| `colors` | the theme's primary, success, warning, destructive and two chart colours | CSS colours for the pieces, cycled in order. |
| `render` | — | Another element for the wrapper, e.g. `render={<div />}`. |
| `className` / `style` | — | Merged onto the wrapper; every other `span` attribute passes through. |

## Styling

The wrapper is `data-slot="celebrate"` (`relative isolate inline-grid place-items-center`) and the layer `data-slot="celebrate-burst"`, centred with `overflow: visible`, so the burst can overlap neighbouring content; leave room around it. The ring uses the `--primary` colour and the default confetti the theme's colours, so a [ThemeScope](https://blamy.github.io/ui/#/theming) recolours both.

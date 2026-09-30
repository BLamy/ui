# Celebrate

A burst for rare moments: a ring pulses and confetti flies out from behind an element, then falls away. The less often something happens, the more it may celebrate: a backup finishing, a first payment, a streak, not a tab switch. `Celebrate` draws nothing until you fire it.

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

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { Celebrate } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## Usage

Put `<Celebrate fire={n} />` next to the thing that succeeded, inside a `relative isolate` wrapper. The layer is absolutely positioned over the wrapper and sits behind its content (`-z-1`), so the burst comes out from behind the badge. Each time `fire` changes to a truthy value, a burst plays (about 1.4s). Bursts overlap if you fire again early.

{% demo src="celebrate/backup" %}

```tsx
const [fired, setFired] = useState(0)

<div className="relative isolate">
  <Celebrate fire={fired} />
  <SuccessBadge />
</div>

// when the job completes:
setFired((n) => n + 1)
```

`fire` can be a counter, a string or a boolean. The first render never fires, and a falsy value never fires, so `fire={done}` bursts once when `done` becomes true. Use a counter when the same moment can happen repeatedly. The pieces' positions come from a seeded generator, so a given burst looks the same each time it is replayed.

## Reduced motion

With `prefers-reduced-motion` only the ring plays, as a soft fade; no confetti is drawn.

## Accessibility

The layer is `aria-hidden` and `pointer-events-none`: it is decoration only. Announce the success in text too (a `role="status"` message or the changed label), as nothing in the burst is exposed to assistive technology.

## Props

| Prop | Default | Effect |
| --- | --- | --- |
| `fire` | — | Change it to a truthy value to fire a burst. |
| `count` | `22` | Confetti pieces per burst. |
| `spread` | `100` | How far the pieces fly, in px; they also fall by about the same distance. |
| `colors` | primary, success and four fixed hues | CSS colours for the pieces, cycled in order. |
| `className` / `style` | — | Merged onto the layer (`absolute inset-0`). |

## Styling

The root is `data-slot="celebrate"`, centred in its wrapper with `overflow: visible`, so the burst can overlap neighbouring content; leave room around the wrapper. The ring uses the `--primary` colour.

# AnimatedHeight

A container that changes size instead of cutting. `AnimatedHeight` measures its content and springs its own height to match, so a tray going from a two-line step to a five-line step grows rather than jumps. Use it around content whose height changes in place; to replace one view with another, put a [Swap](https://blamy.github.io/ui/#/swap) inside it (the tray step: `<AnimatedHeight><Swap value={step} direction={dir}>…`). For a panel that opens and closes, use [Disclosure](https://blamy.github.io/ui/#/disclosure), which animates its own height; for a short sheet or a flow in one, `SheetView` (and `DialogView` in a Dialog), which put both together.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/animated-height.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { AnimatedHeight } from '@/components/ui/animated-height'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from their module:

```tsx
import '@brett_lamy/ui/styles.css'

import { AnimatedHeight } from '@brett_lamy/ui/animated-height'
```
{% endtab %}
{% endtabs %}

## AnimatedHeight

Wrap anything whose height changes. It observes its content with a `ResizeObserver`, so you do not tell it the new height: a list gaining rows, an image loading or text reflowing all animate. It clips its content (`overflow: hidden`), so put outlines, focus rings and shadows of children inside its padding, and style the tray itself (background, radius, padding) on the `AnimatedHeight`: it is `box-content`, so its padding and border add to the height it animates rather than cutting the content short.

{% demo src="animated-height/disclosure" %}

```tsx
<AnimatedHeight className="rounded-card bg-card">
  <ul>{rows.map(…)}</ul>
</AnimatedHeight>
```

`spring` picks one of the four [motion springs](https://blamy.github.io/ui/#/motion): `tray` (the default: sheets and trays, stiff and well damped), `smooth` (panels and views, no overshoot), `snappy` (small controls, quick) or `bouncy` (a playful overshoot). Under reduced motion the height changes at once.

## With Swap

`AnimatedHeight` follows its content; it does not decide how the content changes. For a tray whose steps replace each other, put a [Swap](https://blamy.github.io/ui/#/swap) inside: the leaving view is lifted out of the flow, so the height springs to the new step at once while the views slide.

{% demo src="animated-height/steps" %}

```tsx
const dir = useDirection(step)

<AnimatedHeight>
  <Swap value={step} direction={dir}>
    <StepContent step={step} />
  </Swap>
</AnimatedHeight>
```

## Accessibility

`AnimatedHeight` adds no role. It clips what overflows while it springs, so keep focus rings inside its padding. When content is loading, mark the container `aria-busy`, and announce changes that matter with a `role="status"` region outside it. Under reduced motion the height changes at once.

## Props

### AnimatedHeight

| Prop | Default | Effect |
| --- | --- | --- |
| `spring` | `tray` | `tray`, `smooth`, `snappy` or `bouncy` (from `@/lib/motion`). |
| `children` | — | Content whose height is followed. |
| `className` / `style` | — | Merged onto the clipping wrapper (`overflow-hidden`). |
| `ref`, DOM props | — | Passed to the wrapper (`id`, `aria-*`, `data-*`, events). |

## Styling

Slot: `animated-height`, the animated wrapper. Its inner measured element is a `flow-root`, so children's margins are included in the height.

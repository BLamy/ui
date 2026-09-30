# AnimatedHeight

Trays that change size instead of cutting. `AnimatedHeight` measures its content and springs its own height to match, so a tray going from a two-line step to a five-line step grows rather than jumps. `ContentSwap` replaces its content by key, with the old view leaving and the new one arriving in the direction of travel. Together they are the tray step pattern: `<AnimatedHeight><ContentSwap id={step} direction={dir}>…`. Both live in `animated-height` and are documented here.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/animated-height.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import {
  AnimatedHeight, ContentSwap,
} from '@/components/ui/animated-height'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { AnimatedHeight, ContentSwap } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## AnimatedHeight

Wrap anything whose height changes. It observes its content with a `ResizeObserver`, so you do not tell it the new height: a list gaining rows, an image loading or text reflowing all animate. It clips its content (`overflow: hidden`), so put outlines, focus rings and shadows of children inside its padding, and style the tray itself (background, radius) on the `AnimatedHeight`.

{% demo src="animated-height/disclosure" %}

```tsx
<AnimatedHeight className="rounded-card bg-card">
  <ul>{rows.map(…)}</ul>
</AnimatedHeight>
```

`spring` picks the preset from the [motion springs](https://blamy.github.io/ui/#/motion): `tray` by default (stiff and well damped), or `smooth`, `snappy`, `bouncy` and the others. Under reduced motion the height changes at once.

## ContentSwap

Give it an `id` for the current view and a `direction`: `1` (forward) brings the new view in from the right and sends the old one left, `-1` the reverse, both blurring through the middle; `0` swaps in place with a small scale. `distance` sets the travel in px (default 36). The leaving view is taken out of flow (`popLayout`), so the swap never adds height; pair it with `AnimatedHeight` to spring to the new size. `useDirection(index)` from `@/lib/motion` returns -1, 0 or 1 from a changing index.

{% demo src="animated-height/steps" %}

```tsx
const dir = useDirection(step)

<AnimatedHeight>
  <ContentSwap id={step} direction={dir}>
    <StepContent step={step} />
  </ContentSwap>
</AnimatedHeight>
```

## Accessibility

Neither component adds roles. The outgoing view stays in the DOM for the length of the exit (about 0.15s), so move focus deliberately: if the control that caused the change lives inside the swapped content, focus the new content's heading or first control. When content is loading, mark the container `aria-busy`; announce changes that matter with a `role="status"` region outside the swap. Reduced motion replaces the slide and scale with a short fade.

## Props

### AnimatedHeight

| Prop | Default | Effect |
| --- | --- | --- |
| `spring` | `tray` | A spring preset name from `@/lib/motion`. |
| `children` | — | Content whose height is followed. |
| `className` / `style` | — | Merged onto the clipping wrapper (`overflow-hidden`). |

### ContentSwap

| Prop | Default | Effect |
| --- | --- | --- |
| `id` | — | Identity of the current view (`string` or `number`). Changing it swaps. |
| `direction` | `0` | `-1` back, `1` forward (slide), `0` in place. |
| `distance` | `36` | Slide distance in px for a directional swap. |
| `className` / `style` | — | Merged onto the wrapper (`relative`). |

## Styling

Slots: `animated-height` (the animated wrapper; its inner measured element is a `flow-root`, so children's margins are included) and `content-swap`. The animated views fill the width (`w-full`).

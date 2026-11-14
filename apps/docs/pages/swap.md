# Swap

Content that changes in place instead of cutting. When `value` changes, the old content leaves and the new one arrives: `effect="slide"` (the default) moves the views in the direction of the change, blurred through the middle (a tray going to its next step, a dialog title between views); `effect="pop"` shrinks and blurs the old content out while the new one grows in (copy becoming a check, play becoming pause). Use `Swap` whenever one thing replaces another in the same place. For text whose letters should travel use [TextMorph](https://blamy.github.io/ui/#/text-morph), for a number [NumberMorph](https://blamy.github.io/ui/#/number-morph), for one element moving between two layouts [Morph](https://blamy.github.io/ui/#/morph), and for a container that should grow with its content [AnimatedHeight](https://blamy.github.io/ui/#/animated-height) (it pairs with `Swap`). A chevron that turns rather than swaps is [`Chevron`](https://blamy.github.io/ui/#/icons) in `@/lib/icon`.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/swap.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { Swap } from '@/components/ui/swap'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { Swap } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## Usage

Wrap the content and give `value` something that changes when it does. Whatever is inside for one `value` stays on screen until it has left.

```tsx
<Swap value={step} direction={dir}>
  <StepContent step={step} />
</Swap>
```

## Pop: glyphs

`effect="pop"` stacks the old and new glyph in one inline grid cell, so nothing around it moves. The new one grows in on the bouncy spring; the old one leaves faster, on the snappy spring. A pop is `inline` by default (a `span`).

{% demo src="swap/copy" %}

```tsx
<Swap effect="pop" value={copied ? 'check' : 'copy'}>
  <Icon name={copied ? 'check' : 'copy'} size={18} />
</Swap>
```

## Slide: views

`effect="slide"` with a `direction`: `1` (forward) brings the new view in from the right and sends the old one left, `-1` the reverse; `0` cross-fades in place with a small scale (loading → loaded). `distance` is the travel in px (default 36). The leaving view is lifted out of the flow while it exits, so the swap never adds height: wrap it in `AnimatedHeight` and the container springs to the new size at once. `useDirection(index)` from `@/lib/motion` turns a changing index into -1, 0 or 1.

{% demo src="swap/slide" %}

```tsx
const dir = useDirection(step)

<AnimatedHeight>
  <Swap value={step} direction={dir}>
    <StepContent step={step} />
  </Swap>
</AnimatedHeight>
```

### A title between views

A short travel and a stronger blur make the title morph a dialog uses when it moves between views. `inline` keeps it in a line of text.

{% demo src="swap/title" %}

```tsx
<DialogTitle>
  <Swap value={view} direction={dir} distance={18} blur={6} inline>{titles[view]}</Swap>
</DialogTitle>
```

## Motion

Both effects fade opacity and blur on the entry tokens (`--duration-enter`, `--ease-enter`: 220ms) and leave on the exit tokens (`--duration-exit`, `--ease-exit`: 140ms). Travel and scale ride the spring tokens: `smooth` for a slide, `bouncy` in and `snappy` out for a pop. The views come and go with UI SDK's presence (`data-starting-style` / `data-ending-style`, through the kit's `usePresenceList`), so a swap is plain CSS and can be interrupted: change `value` again mid-swap and the newest wins. Under `prefers-reduced-motion` the travel, scale and blur go and only a short fade is left.

## Accessibility

`Swap` adds no role. The content is decoration for the change; put the meaning on the control around it: change the button's label or `aria-label` with the state ("Copy" to "Copied"). The leaving view stays in the DOM (and `inert`) for the length of its exit, so if the control that caused the change lives inside the swapped content, move focus to the new content's heading or first control. Announce a change that matters with a `role="status"` region outside the swap.

## Props

| Prop | Default | Effect |
| --- | --- | --- |
| `value` | — | Identity of the current content (`string` or `number`). Changing it swaps. |
| `effect` | `slide` | `slide` travels in `direction`; `pop` scales the old content out and the new one in. |
| `inline` | `true` for `pop`, else `false` | Stack the views in one inline grid cell (a `span`) instead of a block (a `div`, the views full width). |
| `direction` | `0` | `slide` only: `-1` back, `1` forward, `0` in place with a small scale. |
| `distance` | `36` | `slide` only: travel in px. |
| `blur` | `4` | Blur in px at the middle of the swap. |
| `className` / `style`, `ref`, DOM props | — | On the root (`id`, `aria-*`, `data-*`, events). |

## Styling

Slots: `swap` (with `data-effect`, and `data-direction` for a slide) and each `swap-view` inside it, which has `data-starting-style` for its first frame and `data-ending-style` while it leaves. The start and end frames read variables on the root (`--swap-enter`, `--swap-exit`, `--swap-scale`, `--swap-blur`), so a stylesheet can restyle a swap without JavaScript. Both effects use `currentColor`, so colour the content from a parent or with a `text-*` class.

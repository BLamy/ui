# IconSwap

Icons that change in place instead of cutting. `IconSwap` stacks the old and new glyph in one cell: the old one shrinks and blurs out while the new one grows in, so nothing around it moves. The copy button that turns into a check, play that becomes pause. `Chevron`, from the same module, is one chevron that rotates to face a new direction. For text use [TextMorph](https://blamy.github.io/ui/#/text-morph), and for a shared element moving between layouts [Morph](https://blamy.github.io/ui/#/morph).

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/icon-swap.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { IconSwap, Chevron } from '@/components/ui/icon-swap'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { IconSwap, Chevron } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## IconSwap

Wrap the icon and give it an `id` that changes when the icon does. The children are whatever you render: an [Icon](https://blamy.github.io/ui/#/icons), an SVG, an emoji. The cell sizes itself to the icon, so the layout is stable.

{% demo src="icon-swap/copy" %}

```tsx
<IconSwap id={copied ? 'check' : 'copy'}>
  <Icon name={copied ? 'check' : 'copy'} size={18} />
</IconSwap>
```

The new glyph grows in on the bouncy spring; the old one leaves faster than the new arrives. Under reduced motion both just fade, briefly.

## Chevron

`Chevron` points `right` by default and rotates to `down`, `left` or `up` on the snappy spring. It accumulates its angle so it always turns the short way round (`up` to `right` is a quarter turn forward, not three quarters back). Use it for disclosure rows and for flows that reverse.

{% demo src="icon-swap/chevron" %}

## Accessibility

Neither part labels anything: the glyph is decoration and `Chevron` is `aria-hidden`. Put the meaning on the control that contains them: change the button's label or `aria-label` with the state ("Copy" to "Copied"), and use `aria-expanded` on a disclosure. A state change that is not obvious from a label change should be announced in a `role="status"` region.

## Props

### IconSwap

| Prop | Default | Effect |
| --- | --- | --- |
| `id` | — | Identity of the current icon (`string` or `number`). Changing it swaps. |
| `children` | — | The icon to show for this `id`. |
| `className` / `style` | — | Merged onto the cell (`inline-grid`). |

### Chevron

| Prop | Default | Effect |
| --- | --- | --- |
| `direction` | `right` | `right`, `down`, `left` or `up`. |
| `size` | `17` | Icon size in px. |
| `sw` | `2.4` | Stroke width. |
| `className` / `style` | — | Merged onto the rotating wrapper. |

## Styling

`data-slot="icon-swap"` is the cell; the leaving and arriving glyphs are stacked in the same grid area. `data-slot="chevron"` carries `data-direction`. Both use `currentColor`, so set the colour on a parent or with a `text-*` class.

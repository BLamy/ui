# NumberMorph

A formatted number whose digits roll and whose separators slide, in the style of NumberFlow. Use it for values that change in place: a balance, a counter, a percentage, a price. It formats with `Intl.NumberFormat`, so currency, percent, compact notation and other locales work the same way. [Progress](https://blamy.github.io/ui/#/progress) and [ProgressRing](https://blamy.github.io/ui/#/progress-ring) use it for their percentages.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/number-morph.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { NumberMorph } from '@/components/ui/number-morph'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { NumberMorph } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## Usage

Pass a `value` and optional `format` (any `Intl.NumberFormatOptions`) and `locales`. Every part of the formatted string keeps its identity by place: the units digit stays the units digit and the thousands comma stays the thousands comma, so `1,234` to `12,345` slides the comma one digit left rather than rewriting the text.

{% demo src="number-morph/counter" %}

```tsx
<NumberMorph value={balance} format={{ style: 'currency', currency: 'USD' }} />
<NumberMorph value={0.42} format={{ style: 'percent' }} />
<NumberMorph value={1_250_000} format={{ notation: 'compact' }} />
<NumberMorph value={balance} locales="de-DE" format={{ style: 'currency', currency: 'EUR' }} />
```

## How it moves

- Digits are a 0 to 9 reel that rolls up when the value rises and down when it falls. A wrap from 9 to 0 keeps rolling in the same direction.
- Parts that appear or disappear (a new leading digit, a minus sign) scale and blur in or out, and the rest spring to their new positions.
- `format` and `locales` are compared by value, so passing a fresh object each render does not remount anything.
- Under `prefers-reduced-motion` the digits step without rolling and the layout changes instantly.

## Accessibility

The root is `role="img"` with `aria-label` set to the formatted number, so assistive technology reads "$11,249.50" rather than a column of digits. The rolling reels are `aria-hidden`. A live value that changes often should not be announced on every tick: update an `aria-live` region less often if it matters. Inherit the surrounding font for width-stable digits: the root sets `tabular-nums`.

## Props

| Prop | Default | Effect |
| --- | --- | --- |
| `value` | — | The number to show. |
| `format` | — | `Intl.NumberFormat` options (`style`, `currency`, `minimumFractionDigits`, `notation`, …). |
| `locales` | runtime default | A locale string or list. |
| `className` / `style` | — | Merged onto the root `span` (`inline-flex`, `tabular-nums`, `whitespace-pre`). |

## Styling

The root is `data-slot="number-morph"`. Size and colour are inherited from the parent (or set with `className`). Digits are masked with a soft fade at the top and bottom of the reel, scaled to the font size (`.12em`).

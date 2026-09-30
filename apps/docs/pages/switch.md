# Switch

The iOS on/off switch on react-aria's `Switch`: a 51 by 31 track that goes green, and a white thumb that springs across and stretches toward the far side while pressed, so the press already hints where it will land. It is for a setting that takes effect immediately; for a choice that is submitted with a form use [Checkbox](https://blamy.github.io/ui/#/checkbox).

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/switch.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { Switch } from '@/components/ui/switch'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { Switch } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## Controlled

`Switch` is controlled: `checked` and `onChange(boolean)` are required, and it renders only the control. The text that names it is yours to lay out.

{% demo src="switch/settings" %}

```tsx
<span id="sw-wifi">Wi-Fi sync</span>
<Switch aria-labelledby="sw-wifi" checked={on} onChange={setOn} />
```

Inside a `ListRow` (see [Lists](https://blamy.github.io/ui/#/lists)) the switch is labelled by the row's title automatically, so `<ListRow title="Wi-Fi" accessory={<Switch checked={on} onChange={setOn} />} />` needs no extra label.

## Accessibility

react-aria renders `role="switch"` on a native checkbox input, so Space toggles it and assistive technology announces its state. A switch has no text of its own: name it with `aria-label` or `aria-labelledby`. If you pass neither (and it is not in a `ListRow`) it falls back to the label "Toggle", which says nothing about what it controls. The thumb stops animating under reduced motion.

## Props

| Prop | Default | Effect |
| --- | --- | --- |
| `checked` | — | Whether the switch is on. |
| `onChange` | — | Called with the new boolean. |
| `aria-label` | `Toggle` (unless labelled by a row) | Accessible name. |
| `aria-labelledby` | the enclosing `ListRow` title | Id of the element that names it. |
| `className` / `style` | — | Merged onto the 51 by 31 root. |

Only these props are forwarded; there is no `isDisabled` or `name` on this component.

## Styling

The root is `data-slot="switch"` (a `group`), the track `data-slot="switch-track"` (`bg-secondary-strong`, `bg-success` when selected) and the thumb `data-slot="switch-thumb"`. They react to the root's `data-selected` and `data-pressed`.

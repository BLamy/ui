# Switch

The iOS on/off switch on UI SDK's `Switch`: a 51 by 31 track that goes green, and a white thumb that springs across and stretches toward the far side while pressed, so the press already hints where it will land. It is for a setting that takes effect immediately; for a choice that is submitted with a form use [Checkbox](https://blamy.github.io/ui/#/checkbox).

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

`checked` and `onCheckedChange(checked, details)` control it; `defaultChecked` leaves the state to the switch. `details.reason` says what changed it (a press, the keyboard, a label or a controller) and `details.cancel()` keeps it as it was. With no children it renders its `SwitchThumb`. The text that names it is yours to lay out.

{% demo src="switch/settings" %}

```tsx
<span id="sw-wifi">Wi-Fi sync</span>
<Switch aria-labelledby="sw-wifi" checked={on} onCheckedChange={setOn} />
```

Wrap it and its text in a [Label](https://blamy.github.io/ui/#/label) and the whole line presses it:

```tsx
<Label variant="control"><Switch defaultChecked />Wi-Fi sync</Label>
```

Inside a `ListRow` (see [Lists](https://blamy.github.io/ui/#/lists)) the switch is labelled by the row's title automatically, so `<ListRow title="Wi-Fi" accessory={<Switch checked={on} onCheckedChange={setOn} />} />` needs no extra label.

To flip it from elsewhere (a keyboard shortcut, a test), pass a controller from `createSwitchController()` as `controller` and call its methods.

## Accessibility

The root is a `<button>` with `role="switch"` and `aria-checked`, so Space and Enter toggle it and assistive technology announces its state; with a `name` a hidden native checkbox submits it with a form. A switch has no text of its own: name it with `aria-label`, `aria-labelledby`, a wrapping `Label`, or a `ListRow`. The thumb stops animating under reduced motion.

## Props

UI SDK's `Switch` props, the main ones:

| Prop | Default | Effect |
| --- | --- | --- |
| `checked` / `defaultChecked` | `false` | Whether the switch is on. |
| `onCheckedChange` | — | `(checked, details)` with the new boolean; `details.reason`, `details.cancel()`. |
| `disabled` | `false` | Dims to 40% and ignores presses. |
| `readOnly` / `required` | `false` | Shows the state but can't change it / must be on to submit. |
| `name` / `value` | — | Submits with a form. |
| `controller` | — | From `createSwitchController()`, to drive it from outside. |
| `aria-label` / `aria-labelledby` | the enclosing `ListRow` title | Accessible name. |
| `children` | `<SwitchThumb />` | Replace the thumb. |
| `className` / `style` | — | Merged onto the 51 by 31 track (`className` may be a function of the state). |

## Styling

The root is the track, `data-slot="switch"` (a `group`: `bg-secondary-strong`, `bg-success` when `data-checked`), and `SwitchThumb` is `data-slot="switch-thumb"`. Both carry `data-checked` / `data-unchecked`, `data-disabled`, `data-readonly` and `data-required`; the thumb's stretch while held is `group-active:`.

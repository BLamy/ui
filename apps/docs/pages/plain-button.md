# PlainButton

UI SDK's buttons with no styling of their own. `PlainButton` is UI SDK's `Button` and `PlainToggleButton` its `Toggle`, both unstyled, so you can draw the pressable yourself and still get press, focus, keyboard and accessibility behavior. Reach for them for chips, rows, tiles and anything else whose look is all your own. For a styled action, including icon-only ones, use [Button](https://blamy.github.io/ui/#/button).

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/plain-button.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import {
  PlainButton, PlainToggleButton,
} from '@/components/ui/plain-button'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { PlainButton, PlainToggleButton } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## Your own pressables

Style hover, a held press and keyboard focus with the native `hover:`, `active:` and `focus-visible:`, and state with UI SDK's attributes: `data-disabled`, `data-pending` on the button, and `data-pressed` on the toggle while it is on. Both components take `className` as a string or as a function of their state.

{% demo src="plain-button/custom-pressables" %}

```tsx
<PlainToggleButton
  pressed={on}
  onPressedChange={setOn}
  className="rounded-full bg-secondary px-3.5 active:not-data-pressed:bg-secondary-strong data-pressed:bg-primary data-pressed:text-primary-foreground"
>
  Unread
</PlainToggleButton>

<PlainButton title="Open the thread" onClick={open} className="active:bg-secondary">
  …
</PlainButton>
```

There is no default focus ring, hover or disabled style: add them, or keyboard users will see no focus indicator.

## Accessibility

Both render a native `<button>` (or what `render` gives them). `PlainButton` handles `onClick`, `Enter` and `Space`, `disabled` / `focusableWhenDisabled`, and stays pending while a Promise returned from `onClick` runs. `PlainToggleButton` adds `aria-pressed` and its state (`pressed` / `defaultPressed` / `onPressedChange(pressed, details)`), and inside a UI SDK `ToggleGroup` takes a `value`. Give either an accessible name: visible text, or `aria-label` for icon-only content. `title` is added as a native tooltip only; it is not a substitute for a label.

## Props

| Component | Props |
| --- | --- |
| `PlainButton` | UI SDK `Button` props (`onClick`, `disabled`, `focusableWhenDisabled`, `pendingAnnouncement`, `render`, and every native button attribute such as `title`). |
| `PlainToggleButton` | UI SDK `Toggle` props (`pressed`, `defaultPressed`, `onPressedChange`, `value`, `disabled`, `controller`, `render`, and native button attributes). |

Neither adds classes; UI SDK writes `data-slot="button"` or `data-slot="toggle"`, and a `className` you pass is the only styling.

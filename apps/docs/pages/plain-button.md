# PlainButton

react-aria's buttons with no styling of their own. `PlainButton` is a `Button` and `PlainToggleButton` a `ToggleButton`, both unstyled and both keeping `title` (react-aria drops it), so you can draw the pressable yourself and still get press, focus, keyboard and accessibility behavior. Reach for them for chips, rows, tiles and custom icon buttons. For a styled labelled action use [Button](https://blamy.github.io/ui/#/button); for a ready-made icon-only control use [IconButton](https://blamy.github.io/ui/#/icon-button), which is built on `PlainButton`.

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

Style with the react-aria state attributes: `data-pressed`, `data-hovered`, `data-focus-visible`, `data-disabled`, and for the toggle `data-selected`. Both components take `className` as a string or as react-aria's render-props function.

{% demo src="plain-button/custom-pressables" %}

```tsx
<PlainToggleButton
  isSelected={on}
  onChange={setOn}
  className="rounded-full bg-secondary px-3.5 data-pressed:bg-secondary-strong data-selected:bg-primary data-selected:text-primary-foreground"
>
  Unread
</PlainToggleButton>

<PlainButton title="Open the thread" onPress={open} className="data-pressed:bg-secondary">
  …
</PlainButton>
```

There is no default focus ring, hover or disabled style: add them, or keyboard users will see no focus indicator.

## Accessibility

Both render a native `<button>` through react-aria. `PlainButton` handles press, `Enter` and `Space`, `isDisabled` and `isPending`. `PlainToggleButton` adds `aria-pressed` and selection state (`isSelected` / `defaultSelected` / `onChange`). Give either an accessible name: visible text, or `aria-label` for icon-only content. `title` is added as a native tooltip only; it is not a substitute for a label.

## Props

| Component | Props |
| --- | --- |
| `PlainButton` | react-aria `ButtonProps` (minus `render`) plus `title`. |
| `PlainToggleButton` | react-aria `ToggleButtonProps` (minus `render`) plus `title`. |

`title` is rendered onto the `<button>` by replacing react-aria's `render` element; that is why `render` is omitted from the types. Neither component sets `data-slot` or any classes; a `className` you pass is the only styling.

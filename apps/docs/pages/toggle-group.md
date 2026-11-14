# ToggleGroup

A row of [Toggle](https://blamy.github.io/ui/#/toggle)s on UI SDK's `ToggleGroup`: one choice at a time (single selection, like a segmented control) or any number (multiple, like text styles). Items inherit the group's `variant` and `size`, and arrow keys move focus between them.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/toggle-group.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import {
  ToggleGroup, ToggleGroupItem,
} from '@/components/ui/toggle-group'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { ToggleGroup, ToggleGroupItem } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## Single and multiple

One toggle is pressed at a time unless you set `multiple`. In a `filled` single group one white card slides between the items. With `multiple` each item toggles on its own. The value is always an array of the pressed items' `value`s, in document order (`value` / `defaultValue` / `onValueChange(value, details)`). Pressing the pressed item of a single group again clears it; add `deselectable={false}` (with a `defaultValue`) to keep one always on.

{% demo src="toggle-group/modes" %}

```tsx
<ToggleGroup variant="filled" aria-label="View" defaultValue={['grid']} deselectable={false}>
  <ToggleGroupItem value="list">List</ToggleGroupItem>
  <ToggleGroupItem value="grid">Grid</ToggleGroupItem>
</ToggleGroup>

<ToggleGroup variant="outline" multiple aria-label="Text style">
  <ToggleGroupItem value="bold" aria-label="Bold">B</ToggleGroupItem>
  <ToggleGroupItem value="italic" aria-label="Italic">I</ToggleGroupItem>
</ToggleGroup>
```

`details.reason` is `item-press` or `imperative` (a write from a controller made with `createToggleGroupController()` and passed as `controller`); `details.cancel()` keeps the current value.

## Accessibility

It renders UI SDK's `ToggleGroup`: a `group` of native buttons with `aria-pressed`, in single and multiple mode alike (use [Segmented](https://blamy.github.io/ui/#/segmented) or [RadioGroup](https://blamy.github.io/ui/#/radio-group) when arrow keys should select as they move). The group needs a name (`aria-label` or `aria-labelledby`). It is one Tab stop, entering on the first pressed item; the arrow keys and Home / End move focus, and Space / Enter press. Disabled items stay reachable with the arrow keys (`aria-disabled`) but ignore presses. Items with only a glyph (B, I, an icon) need an `aria-label`.

## Props

### ToggleGroup

Every UI SDK `ToggleGroup` prop applies, plus:

| Prop | Default | Effect |
| --- | --- | --- |
| `variant` | `default` | `default` (gap, tinted when on) · `filled` (secondary tray, white pressed card) · `outline` (joined buttons in a hairline frame). |
| `size` | `default` | `sm` · `default` · `lg`; passed to every item. |
| `multiple` | `false` | Let several items stay pressed. |
| `value` / `defaultValue` / `onValueChange` | — | The pressed items' values, as an array. |
| `deselectable` | `true` | `false` keeps one pressed once any is (single mode). |
| `orientation` / `loop` / `disabled` | `horizontal` / `true` / `false` | Arrow-key axis, wrapping at the ends, and disabling every item. |
| `controller` | — | From `createToggleGroupController()`. |

### ToggleGroupItem

A [Toggle](https://blamy.github.io/ui/#/toggle): `value` (what the group's value lists while it is pressed), `disabled`, `focusableWhenDisabled`, `className`, `children`, plus `variant` and `size` to override the group's for one item. Its own `pressed` / `defaultPressed` don't apply inside a group.

## Styling

`data-slot="toggle-group"` (with `data-variant` and `data-orientation`) and `data-slot="toggle"` on each item; the sliding card is `data-slot="selection-indicator"`, positioned from the `--selection-indicator-left`, `-top`, `-width` and `-height` variables it writes on itself. Pressed items have `data-pressed` and unavailable ones `data-disabled`; hover, press and keyboard focus are plain `hover:`, `active:` and `focus-visible:`. `toggleGroupVariants({ variant })` returns the container classes.

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `toggleGroupVariants`

Defined in `@/components/ui/toggle-group`. Base classes:

```text
relative isolate inline-flex w-fit items-center
```

**`variant`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `gap-1` |
| `filled` | `gap-0.5 rounded-[11px] bg-secondary p-0.5` |
| `outline` | `gap-0 overflow-hidden rounded-ctl shadow-hairline` |

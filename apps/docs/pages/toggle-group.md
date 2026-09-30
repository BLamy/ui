# ToggleGroup

A row of [Toggle](https://blamy.github.io/ui/#/toggle)s on react-aria's `ToggleButtonGroup`: one choice at a time (single selection, like a segmented control) or any number (multiple, like text styles). Items inherit the group's `variant` and `size`, and arrow keys move focus between them.

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

`selectionMode` is `single` by default. In a `filled` single group one white card slides between the items. In `multiple` mode each item toggles on its own. Selection is a set of item `id`s (`selectedKeys` / `defaultSelectedKeys` / `onSelectionChange`); add `disallowEmptySelection` to keep one always on.

{% demo src="toggle-group/modes" %}

```tsx
<ToggleGroup variant="filled" aria-label="View" defaultSelectedKeys={['grid']} disallowEmptySelection>
  <ToggleGroupItem id="list">List</ToggleGroupItem>
  <ToggleGroupItem id="grid">Grid</ToggleGroupItem>
</ToggleGroup>

<ToggleGroup variant="outline" selectionMode="multiple" aria-label="Text style">
  <ToggleGroupItem id="bold" aria-label="Bold">B</ToggleGroupItem>
  <ToggleGroupItem id="italic" aria-label="Italic">I</ToggleGroupItem>
</ToggleGroup>
```

## Accessibility

A single-selection group is a `radiogroup` of `radio` buttons (`aria-checked`); a multiple-selection group is a `toolbar` of `aria-pressed` buttons. The group needs a name (`aria-label` or `aria-labelledby`). It is one Tab stop; arrow keys move between items, and Space / Enter select. Items with only a glyph (B, I, an icon) need an `aria-label`.

## Props

### ToggleGroup

Every react-aria `ToggleButtonGroup` prop applies, plus:

| Prop | Default | Effect |
| --- | --- | --- |
| `variant` | `default` | `default` (gap, tinted when on) · `filled` (secondary tray, white selected card) · `outline` (joined buttons in a hairline frame). |
| `size` | `default` | `sm` · `default` · `lg`; passed to every item. |
| `selectionMode` | `single` | `single` or `multiple`. |
| `selectedKeys` / `defaultSelectedKeys` / `onSelectionChange` | — | The selected item ids. |
| `disallowEmptySelection` | `false` | Keep at least one selected. |
| `orientation` / `isDisabled` | `horizontal` / `false` | As in react-aria. |

### ToggleGroupItem

Every `ToggleButton` prop (`id`, `isDisabled`, `className`, `children`), plus `variant` and `size` to override the group's for one item.

## Styling

`data-slot="toggle-group"` (with `data-variant`) and `data-slot="toggle-group-item"`; the sliding card is `data-slot="toggle-group-indicator"`. Items get `data-selected`, `data-pressed` and `data-focus-visible` from react-aria. `toggleGroupVariants({ variant })` returns the container classes.

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `toggleGroupVariants`

Defined in `@/components/ui/toggle-group`. Base classes:

```text
isolate inline-flex w-fit items-center
```

**`variant`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `gap-1` |
| `filled` | `gap-0.5 rounded-[11px] bg-secondary p-0.5` |
| `outline` | `gap-0 overflow-hidden rounded-ctl shadow-hairline` |

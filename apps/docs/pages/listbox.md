# Listbox

A keyboard-navigable list of options with single or multiple selection. It is UI SDK's `Listbox` in two looks: `inset`, the default, is an iOS inset-grouped list — rounded card, hairline dividers, a trailing checkmark — for choosing in a settings screen or a sheet; `popup` is the compact list inside the [Select](https://blamy.github.io/ui/#/select) and [Combobox](https://blamy.github.io/ui/#/combobox) popups, with the checkmark leading and a rounded highlight. Reach for Listbox when the options are always visible; use [List](https://blamy.github.io/ui/#/lists) rows for navigation and content, and [DropdownMenu](https://blamy.github.io/ui/#/dropdown-menu) when choosing runs an action.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/listbox.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { Listbox, ListboxItem } from '@/components/ui/listbox'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { Listbox, ListboxItem } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## Single selection

Control the choice with `value` and `onValueChange(value, details)`, or leave it to the list with `defaultValue`. The value is the chosen item's `value`, or `null` when nothing is chosen. Pressing the selected row keeps it selected; add `deselectable` to let a press clear a single selection. An item's `disabled` dims it and keeps it from being chosen.

{% demo src="listbox/single" %}

```tsx
<Listbox aria-label="Ringtone" value={tone} onValueChange={setTone}>
  <ListboxItem value="Reflection">Reflection</ListboxItem>
  <ListboxItem value="Apex">Apex</ListboxItem>
</Listbox>
```

`value` / `defaultValue` / `onValueChange(value, details)` hold the choice; `details.reason` says why (`item-press`, `list-navigation`, …) and `details.cancel()` refuses it. In a single list the arrow keys select as they move; `activation="manual"` makes them only move, and a press, Space or Enter selects. The selection cannot be emptied by default (`deselectable` lets a press on the selected option clear it).

Options can be data too: `<Listbox items={['Reflection', 'Apex']} />` draws the same rows (strings, `{ value, label, disabled }`, `{ type: 'group', label, items }`, `{ type: 'separator' }`).

## Multiple selection, icons, popup variant

`multiple` makes the value a list and lets every row toggle; the arrows move without selecting, Space toggles and Shift selects a range. Items take an `icon` (tinted with the primary color in `inset`, muted in `popup`) and a `description` line. The same parts with `variant="popup"` are what Select and Combobox render, which is useful for an always-open filter list; `ListboxItem` follows its list's variant. In `inset` rows with an icon, the hairline between rows starts under the text, past the icon (24px by default; set `--listbox-icon` on the list for a wider one).

{% demo src="listbox/multiple" %}

## Groups

`ListboxGroup` with a `ListboxGroupLabel` groups rows under a small header; groups after the first are separated by a hairline, and `ListboxSeparator` draws one anywhere.

```tsx
<Listbox aria-label="Time zone" variant="popup">
  <ListboxGroup>
    <ListboxGroupLabel>Americas</ListboxGroupLabel>
    <ListboxItem value="pt">Pacific Time</ListboxItem>
  </ListboxGroup>
  <ListboxGroup>
    <ListboxGroupLabel>Europe</ListboxGroupLabel>
    <ListboxItem value="cet">Central European Time</ListboxItem>
  </ListboxGroup>
</Listbox>
```

## Lists of actions

A Listbox always selects. For a list whose rows run something, use a [DropdownMenu](https://blamy.github.io/ui/#/dropdown-menu) or [CommandMenu](https://blamy.github.io/ui/#/command-menu); for a list that reports a press but keeps nothing selected, pass `value={null}` with `activation="manual"` and act in `onValueChange`. To open a row on Enter or a double click beside a selection, handle `onKeyDown` / `onDoubleClick` on the item.

## Accessibility

UI SDK renders a `listbox` of `option`s with `aria-selected` and, with `multiple`, `aria-multiselectable`. The list is one tab stop, on the selected option: arrows move, Home/End jump, typing a letter jumps to a matching row (by its label, not its description). An option's name is its label; its `description` is read after it as the option's description. The list needs a name — `aria-label` or `aria-labelledby`. Options made of non-text children need a `label` for typeahead; for plain string children it is taken from the text. A disabled option stays reachable with the arrows but cannot be selected.

## Props

### Listbox

UI SDK's `Listbox` props, plus `variant`.

| Prop | Default | Effect |
| --- | --- | --- |
| `variant` | `inset` | `inset` iOS grouped card · `popup` compact popup list. |
| `value` / `defaultValue` / `onValueChange` | `null` (`[]` with `multiple`) | The selected value(s); `onValueChange(value, details)`. |
| `multiple` | `false` | Several values. |
| `activation` | `automatic` | `manual`: the arrows move without selecting. |
| `deselectable` | `false` | A press on the selected option clears it. |
| `items` | — | Options as data. |
| `orientation` / `loop` | `vertical` / — | Arrow-key direction and wrapping. |
| `disabled` / `readOnly` / `required` / `name` | — | State and a hidden form input. |
| `controller` | — | `createListboxController()`: drive it from outside. |
| `className` | — | Merged onto the list (may be a function of its state). |

### ListboxItem

| Prop | Default | Effect |
| --- | --- | --- |
| `value` | — | What the list's value becomes. |
| `label` | string children | Typeahead text. |
| `icon` | — | Leading icon or avatar. |
| `description` | — | Secondary line (footnote, muted), truncated. |
| `disabled` | `false` | 40% opacity, cannot be selected. |

`ListboxGroup`, `ListboxGroupLabel` and `ListboxSeparator` take the props of the element they render.

## Styling

The list carries UI SDK's `listbox` slot (with our `data-variant`), options `listbox-item`, then `listbox-group`, `listbox-group-label` (the kit's menu section label, `sectionLabelVariants({ variant: 'menu' })`), `listbox-separator`. Options expose `data-highlighted` (the active option), `data-selected` and `data-disabled`; hover is `:hover`, a press `:active`, keyboard focus `:focus-visible`. The popup list scrolls past 320px (or the room its popup has, if less). `listboxVariants` and `listboxItemVariants` are the recipes; nest the list inside a `Card` or sheet, or restyle with `className` (for example `bg-muted` on a card-colored surface).

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `listboxVariants`

Defined in `@/components/ui/listbox`. Base classes:

```text
outline-none
```

**`variant`** — default `inset`

| Value | Adds |
| --- | --- |
| `inset` (default) | `overflow-hidden rounded-panel bg-card focus-visible:ring-[3px] focus-visible:ring-ring/45` |
| `popup` | `bl-scroll box-border max-h-[min(320px,var(--available-height,320px))] overflow-y-auto p-1.5` |

### `listboxItemVariants`

Defined in `@/components/ui/listbox`. Base classes:

```text
bl-btn group/item relative box-border flex cursor-pointer items-center gap-2.5 text-foreground outline-none data-disabled:cursor-default data-disabled:opacity-40
```

**`variant`** — default `inset`

| Value | Adds |
| --- | --- |
| `inset` (default) | `[ 'min-h-11 px-4 py-[11px] text-body leading-[22px]', // The hairline starts under the text: past the icon when the row has one ('--listbox…` |
| `popup` | `[ 'min-h-9 rounded-lg py-[7px] pr-3 pl-2 text-subhead leading-5', 'data-highlighted:bg-accent active:not-data-disabled:bg-secondary-strong …` |

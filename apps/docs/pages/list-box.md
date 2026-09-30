# ListBox

A keyboard-navigable list of options with single or multiple selection. It is react-aria's `ListBox` in two looks: `inset`, the default, is an iOS inset-grouped list — rounded card, hairline dividers, a trailing checkmark — for choosing in a settings screen or a sheet; `popup` is the compact list inside the [Select](https://blamy.github.io/ui/#/select) and [ComboBox](https://blamy.github.io/ui/#/combobox) popovers, with the checkmark leading and a rounded highlight. Reach for ListBox when the options are always visible; use [List](https://blamy.github.io/ui/#/lists) rows for navigation and content, and [DropdownMenu](https://blamy.github.io/ui/#/dropdown-menu) when choosing runs an action.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/list-box.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { ListBox, ListBoxItem } from '@/components/ui/list-box'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { ListBox, ListBoxItem } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## Single selection

Set `selectionMode="single"` and control it with `selectedKeys` and `onSelectionChange` (a `Set` of ids) or `defaultSelectedKeys`. `disallowEmptySelection` stops a press on the selected row from clearing it. Without a `selectionMode` nothing is selectable: rows highlight, no checkmark column is drawn, and `onAction` tells you which row was pressed. A row's `isDisabled` dims it and skips it.

{% demo src="list-box/single" %}

```tsx
<ListBox
  aria-label="Ringtone"
  selectionMode="single"
  disallowEmptySelection
  selectedKeys={selected}
  onSelectionChange={setSelected}
>
  <ListBoxItem id="Reflection">Reflection</ListBoxItem>
  <ListBoxItem id="Apex">Apex</ListBoxItem>
</ListBox>
```

## Multiple selection, icons, popup variant

`selectionMode="multiple"` lets every row toggle. Items take an `icon` (tinted with the primary color in `inset`, muted in `popup`) and a `description` line. The same parts with `variant="popup"` are what Select and ComboBox render, which is useful for an always-open filter list; `ListBoxItem` follows its list's variant, or takes its own.

{% demo src="list-box/multiple" %}

## Sections

`ListBoxSection title="…"` groups rows under a small header (with `ListBoxHeader` if you want the header on its own); sections after the first are separated by a hairline. Dynamic collections take `items` and a render function, like the other react-aria lists; `renderEmptyState` covers an empty one.

```tsx
<ListBox aria-label="Timezone" variant="popup" selectionMode="single">
  <ListBoxSection title="Americas">
    <ListBoxItem id="pt">Pacific Time</ListBoxItem>
  </ListBoxSection>
  <ListBoxSection title="Europe">
    <ListBoxItem id="cet">Central European Time</ListBoxItem>
  </ListBoxSection>
</ListBox>
```

## Accessibility

react-aria renders a `listbox` of `option`s with `aria-selected` and, for multiple selection, `aria-multiselectable`. The list is one tab stop: arrows move focus, Home/End jump, typing a letter jumps to a matching row, Space or Enter toggles, and Shift+arrows or Ctrl/Cmd+A extend a multiple selection. The list needs a name — `aria-label` or `aria-labelledby`. Items made of non-text children need a `textValue` for typeahead; for plain string children it is taken from the text.

## Props

### ListBox

| Prop | Default | Effect |
| --- | --- | --- |
| `variant` | `inset` | `inset` iOS grouped card · `popup` compact popover list. |
| `selectionMode` | `none` | `none` · `single` · `multiple`. |
| `selectedKeys` / `defaultSelectedKeys` / `onSelectionChange` | — | Selected ids as a `Set` (or `'all'`). |
| `disallowEmptySelection` | `false` | Keep at least one selected. |
| `items` / `renderEmptyState` | — | Dynamic collection; empty message. |
| `onAction` | — | Called with an id when a row is pressed (for lists without selection). |
| `className` | — | Merged onto the list (may be a function). |

### ListBoxItem

| Prop | Default | Effect |
| --- | --- | --- |
| `id` | — | The key. |
| `icon` | — | Leading icon or avatar. |
| `description` | — | Secondary line (footnote, muted), truncated. |
| `variant` | the list's | `inset` or `popup`, overriding the list. |
| `textValue` | string children | Typeahead and accessible text. |
| `isDisabled` | `false` | 40% opacity, not focusable. |

`ListBoxSection` takes `title`; `ListBoxHeader` is the header element.

## Styling

Slots: `list-box` (with `data-variant`), `list-box-item`, `list-box-section`, `list-box-header`. Rows expose react-aria's states: `data-hovered`, `data-pressed`, `data-focused`, `data-focus-visible`, `data-selected`, `data-disabled`. The popup list scrolls past 320px (or the visual viewport's height, if less). `listBoxVariants` and `listBoxItemVariants` are the recipes; nest the list inside a `Card` or sheet, or restyle with `className` (for example `bg-muted` on a card-colored surface).

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `listBoxVariants`

Defined in `@/components/ui/list-box`. Base classes:

```text
outline-none
```

**`variant`** — default `inset`

| Value | Adds |
| --- | --- |
| `inset` (default) | `overflow-hidden rounded-panel bg-card data-focus-visible:ring-[3px] data-focus-visible:ring-ring/45` |
| `popup` | `bl-scroll box-border max-h-[min(320px,var(--visual-viewport-height,320px))] overflow-y-auto p-1.5` |

### `listBoxItemVariants`

Defined in `@/components/ui/list-box`. Base classes:

```text
bl-btn group/item relative box-border flex cursor-pointer items-center gap-2.5 text-foreground outline-none data-disabled:cursor-default data-disabled:opacity-40
```

**`variant`** — default `inset`

| Value | Adds |
| --- | --- |
| `inset` (default) | `[ 'min-h-11 px-4 py-[11px] text-body leading-[22px]', 'after:pointer-events-none after:absolute after:right-0 after:bottom-0 after:left-4 a…` |
| `popup` | `[ 'min-h-9 rounded-lg py-[7px] pr-3 pl-2 text-subhead leading-5', 'data-focused:bg-accent data-pressed:bg-secondary-strong', ]` |

# Select

A pop-up button that opens a list of options and keeps one of them. It is UI SDK's `Select` — a button, a hidden form input, and a list of options in a popup drawn like a [Listbox](https://blamy.github.io/ui/#/listbox)'s `popup` variant — drawn as an iOS filled field. Use it when the choices are a short, fixed set the user picks from; reach for [Combobox](https://blamy.github.io/ui/#/combobox) when they need to type to filter, or [DropdownMenu](https://blamy.github.io/ui/#/dropdown-menu) when choosing runs an action instead of setting a value.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/select.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from), adds BL UI's tokens to your CSS and installs `@brett_lamy/ui` for UI SDK, which the copied files import by the package's name (`@brett_lamy/ui/sdk/…`). The copied source is yours to edit. Import from your alias:

```tsx
import {
  Select, SelectTrigger, SelectContent, SelectItem,
} from '@/components/ui/select'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from their module:

```tsx
import '@brett_lamy/ui/styles.css'

import {
  Select, SelectTrigger, SelectContent, SelectItem,
} from '@brett_lamy/ui/select'
```
{% endtab %}
{% endtabs %}

## Anatomy

The `Select` root renders no element: it holds the value and the open state. Lay the label, the button and any help or error text out with a [Field](https://blamy.github.io/ui/#/field), which also names the select and gives it its `name`, its disabled and invalid state. `SelectTrigger` is the button, `SelectContent` the popup and its list. Options need a `value`; their text (or `label`) is what the button shows and what typeahead matches.

```tsx
<Field>
  <FieldLabel>Repeat</FieldLabel>
  <Select placeholder="Choose…" defaultValue="week">
    <SelectTrigger />
    <SelectContent>
      <SelectItem value="never">Never</SelectItem>
      <SelectItem value="week">Every week</SelectItem>
    </SelectContent>
  </Select>
</Field>
```

For data, give the root `items` (strings, `{ value, label, disabled }`, `{ type: 'group', label, items }` and `{ type: 'separator' }`) and leave `SelectContent` empty: it draws them with the same rows. With `items` the select knows its options before the list has ever opened, so the button shows the label of its value and typing on the closed button selects from the first key.

```tsx
<Select items={[{ value: 'never', label: 'Never' }, { value: 'week', label: 'Every week' }]} placeholder="Choose…">
  <SelectTrigger />
  <SelectContent />
</Select>
```

A select whose options are written as `SelectItem`s and that has never been opened ignores the first key typed on its closed button (from the second key on it selects); give it `items`, or `keepMounted` on `SelectContent`, where that matters.

## Controlled, groups, validation

`value` / `defaultValue` / `onValueChange(value, details)` work on option values (`null` is "nothing selected"); `details.reason` says why (`item-press`, `list-navigation` on the closed button, …). `multiple` makes the value a list and keeps the popup open while you toggle. Group options with `SelectGroup` and a `SelectGroupLabel`; `SelectSeparator` draws a hairline. A Field with `invalid` turns the outline red and announces its `FieldError` with the button; `required` on the select takes part in native form validation. `disabled` (on the Field or the select) dims the button and keeps the list closed.

{% demo src="select/fields" %}

## Plain variant in a row

`variant="plain"` drops the fill and the full width: a muted value and the up-down glyph, right-aligned — the iOS pop-up button at the trailing edge of a settings row. Put the select at the end of the row, give its trigger an `aria-label`, and open the list toward the edge with `align="end"`.

{% demo src="select/settings-rows" %}

```tsx
<div className="flex items-center justify-between gap-2">
  <span aria-hidden="true">Repeat</span>
  <Select items={repeats} value={repeat} onValueChange={setRepeat}>
    <SelectTrigger aria-label="Repeat" variant="plain" />
    <SelectContent align="end" />
  </Select>
</div>
```

## Sizes

The trigger is the kit's filled field (`fieldSurfaceVariants` from [Input](https://blamy.github.io/ui/#/input)), so it takes the field sizes and lines up with an Input: `size="sm"` is 32px (`text-subhead`), the default 44px, `lg` 50px. `size="sm"` on `SelectContent` makes the rows dense as well (32px, footnote text), for an inspector or a settings panel. To show something other than the selected text, pass children to `SelectTrigger` — it always appends the up-down glyph, and `<SelectValue />` is what it renders when you pass none.

{% demo src="select/sizes" %}

## Small screens

`presentation="auto"` on the root shows the list as a bottom sheet on small touch screens (shaped like the kit's Sheet, grabber included, as Popover's and DropdownMenu's sheets are), `"sheet"` always does. In a sheet the rows are 44px touch targets in body text, also under a small field; only `size="sm"` on `SelectContent` keeps them dense there.

## Accessibility

UI SDK wires the whole pattern: the button is a `combobox` with `aria-haspopup="listbox"` and `aria-expanded`, the list is a `listbox` of `option`s labelled by the field's label, and a hidden input carries the value for form submission and autofill. On the closed button typing a letter jumps to a match; Enter, Space, Up/Down or a press opens the list, arrows and typeahead move through it (the active option is `data-highlighted`), Enter or a press chooses, Esc closes, and focus returns to the button.

You supply the name: a `FieldLabel` in a Field is associated automatically, else a `SelectLabel` beside the select, else an `aria-label` on the trigger. Give options with non-text children a `label`.

## Props

### Select

UI SDK's `Select` props. The popup renders into BLProvider's root unless you pass `container`.

| Prop | Default | Effect |
| --- | --- | --- |
| `value` / `defaultValue` / `onValueChange` | `null` | Selected value (a list with `multiple`); `onValueChange(value, details)`. |
| `multiple` | `false` | Several values. |
| `items` | — | Options as data, drawn by an empty `SelectContent`. |
| `placeholder` | — | Text while nothing is selected. |
| `disabled` / `required` / `readOnly` | `false` | State. |
| `name` / `form` / `autoComplete` | — | The hidden form input (a Field's `name` also reaches it). |
| `open` / `defaultOpen` / `onOpenChange` | closed | Control the list's visibility. |
| `presentation` | `popover` | `auto` or `sheet` for a bottom sheet. |
| `itemToValue` / `itemToLabel` / `isItemEqualToValue` | — | For object values. |
| `controller` | — | `createSelectController()`: open, set and clear from outside. |

### SelectTrigger

| Prop | Default | Effect |
| --- | --- | --- |
| `variant` | `default` | `default` filled field · `plain` iOS pop-up button (no fill, auto width, muted). |
| `size` | `default` | `sm` 32px · `default` 44px · `lg` 50px. |
| `children` | `<SelectValue />` | Custom contents (before the glyph); a function receives the trigger's state. |

### SelectContent and SelectItem

| Prop | Default | Effect |
| --- | --- | --- |
| `side` / `align` | `bottom` / `start` | Starting position; it flips to fit. |
| `sideOffset` | `8` | Gap to the button, px. |
| `keepMounted` | `false` | Keep the closed list in the DOM, hidden. |
| `size` | the trigger's | `sm`: dense 32px rows in footnote text. The rows follow the trigger: a `sm` `SelectTrigger` opens `sm` rows; an explicit `size` wins. |
| `palette` | `scope` | Where the colors come from: the ThemeScope it was opened from, or `trigger`: the trigger's own surface (for a trigger on a surface CSS paints, see [Popover](https://blamy.github.io/ui/#/popover)). |
| `className` | — | Classes for the popup (at least as wide as the button and 200px; scrolls past 320px). |
| `SelectItem` `value` / `label` | — | The option's value; its text when the children are not plain text. |
| `SelectItem` `icon` / `description` | — | A leading icon and a secondary line under the label. The description is read as the option's description, not as part of its name. |
| `SelectItem` `disabled` | `false` | Dims the row (40% opacity) and skips it. |

`SelectGroup`, `SelectGroupLabel` and `SelectSeparator` structure the list; `SelectLabel` (Label's `variant`s) names a select outside a Field. `SelectValue` accepts `className` and a `placeholder`.

## Styling

Parts carry UI SDK's slots: `select-trigger`, `select-value`, `select-content`, `select-item`, `select-group`, `select-group-label`, `select-separator`. The trigger is the kit's field surface: a 1.5px primary edge while it has focus and while its list is open (`data-open`), a red one while invalid (`data-invalid`), dimmed when `data-disabled`; hold-to-press is `:active`. Group labels are the kit's menu section label (`sectionLabelVariants({ variant: 'menu' })`). The value carries `data-placeholder` while empty. Options expose `data-highlighted`, `data-selected` and `data-disabled`. Inside a [ThemeScope](https://blamy.github.io/ui/#/theming) the list wears the scope — see [Popover](https://blamy.github.io/ui/#/popover).

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `selectTriggerVariants`

Defined in `@/components/ui/select`. Base classes:

```text
bl-btn box-border flex cursor-pointer items-center gap-2 border-0 text-left [font-family:inherit] text-foreground outline-none data-disabled:cursor-default
```

**`variant`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `w-full justify-between active:not-data-disabled:bg-secondary-strong data-open:bg-transparent data-open:shadow-[inset_0_0_0_1.5px_var(--primary)]` |
| `plain` | `[ 'w-auto justify-end rounded-lg bg-transparent px-1 text-muted-foreground transition-opacity duration-spring-snappy ease-spring-snappy', '…` |

**`size`** — default `default`

| Value | Adds |
| --- | --- |
| `sm` | `h-8 text-subhead` |
| `default` (default) | `h-11 text-body` |
| `lg` | `h-[50px] text-body` |

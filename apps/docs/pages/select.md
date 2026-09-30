# Select

A pop-up button that opens a list of options and keeps one of them. It is react-aria's `Select` — a button, a hidden native `<select>` for forms, and a [ListBox](https://blamy.github.io/ui/#/list-box) in a [Popover](https://blamy.github.io/ui/#/popover) — drawn as an iOS filled field. Use it when the choices are a short, fixed set the user picks from; reach for [ComboBox](https://blamy.github.io/ui/#/combobox) when they need to type to filter, or [DropdownMenu](https://blamy.github.io/ui/#/dropdown-menu) when choosing runs an action instead of setting a value.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/select.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import {
  Select, SelectTrigger, SelectContent, SelectItem,
} from '@/components/ui/select'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import {
  Select, SelectTrigger, SelectContent, SelectItem,
} from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## Anatomy

A `Select` is a column holding a label, the trigger, the list and any help or error text. Items need an `id`; their text (or `textValue`) is what the trigger shows and what typeahead matches.

```tsx
<Select placeholder="Choose…" defaultValue="week">
  <Label variant="field">Repeat</Label>
  <SelectTrigger />
  <SelectContent>
    <SelectItem id="never">Never</SelectItem>
    <SelectItem id="week">Every week</SelectItem>
  </SelectContent>
</Select>
```

For data, give `SelectContent` an `items` array and a render function; every item needs an `id` (or pass `key`s) and, when it is not a plain string, a `textValue`.

```tsx
<SelectContent items={repeats}>
  {(item) => <SelectItem>{item.name}</SelectItem>}
</SelectContent>
```

## Controlled, sections, validation

`value` and `onChange` work on item ids (`null` is "nothing selected"). Group options with `SelectSection title="…"`. A field that is `isRequired` and `isInvalid` turns its outline red, and a [FieldError](https://blamy.github.io/ui/#/text-field) inside the `Select` is announced with it. `isDisabled` dims the trigger and keeps the list closed.

{% demo src="select/fields" %}

## Plain variant in a row

`variant="plain"` drops the fill and the full width: a muted value and the up-down glyph, right-aligned — the iOS pop-up button at the trailing edge of a settings row. Make the `Select` itself the row (`flex-row`), give it an `aria-label`, and open the list toward the edge with `placement="bottom end"`.

{% demo src="select/settings-rows" %}

```tsx
<Select aria-label="Repeat" className="flex-row items-center justify-between gap-2">
  <span aria-hidden="true">Repeat</span>
  <SelectTrigger variant="plain" />
  <SelectContent placement="bottom end">…</SelectContent>
</Select>
```

## Sizes

`size="sm"` is a 32px trigger (`text-subhead`); the default is 44px. To show something other than the selected text, pass children to `SelectTrigger` — it always appends the up-down glyph, and `<SelectValue />` is what it renders when you pass none.

## Accessibility

react-aria wires the whole pattern: the trigger is a button with `aria-haspopup="listbox"` and `aria-expanded`, the list is a `listbox` of `option`s labelled by the field's label, and a hidden native select carries the value for form submission and autofill. On the closed trigger Left/Right step through the options and typing a letter jumps to a match; Enter, Space, Up/Down or a press opens the list, arrows and typeahead move through it, Enter or a press chooses, Esc closes, and focus returns to the trigger.

You supply the name: a visible `Label` is associated automatically, otherwise pass `aria-label`. Give items with non-text children a `textValue`. Put `FieldDescription` and `FieldError` inside the `Select` so they are announced with the field.

## Props

### Select

The root is react-aria's `Select`; every prop passes through, with `className` merged onto `group flex flex-col gap-1.5`.

| Prop | Default | Effect |
| --- | --- | --- |
| `value` / `defaultValue` / `onChange` | — | Selected item id (controlled / uncontrolled). |
| `placeholder` | localized "Select an item" | Text while nothing is selected. |
| `isDisabled` / `isRequired` / `isInvalid` | `false` | State; the trigger reads them for its dimming and its red outline. |
| `name` | — | Form field name for the hidden native select. |
| `isOpen` / `defaultOpen` / `onOpenChange` | closed | Control the list's visibility. |

### SelectTrigger

| Prop | Default | Effect |
| --- | --- | --- |
| `variant` | `default` | `default` filled field · `plain` iOS pop-up button (no fill, auto width, muted). |
| `size` | `default` | `default` 44px · `sm` 32px. |
| `children` | `<SelectValue />` | Custom contents (before the glyph). |

Other props go to react-aria's `Button` (`className` may be a function).

### SelectContent and SelectItem

| Prop | Default | Effect |
| --- | --- | --- |
| `placement` | `bottom start` | Popover placement. |
| `popoverClassName` | — | Classes for the popover (its minimum width is the larger of the trigger's and 200px). |
| `items` / `renderEmptyState` | — | Dynamic collection; the list's empty message. |
| `className` | — | Classes for the list (`ListBox` popup variant, max 320px then scrolls). |
| `SelectItem` `icon` / `description` | — | A leading icon and a secondary line under the label. |
| `SelectItem` `isDisabled` | `false` | Dims the row (40% opacity) and skips it. |

`SelectSection` is [ListBox](https://blamy.github.io/ui/#/list-box)'s section (`title` for a header). `SelectValue` accepts `className` and render props.

## Styling

Slots: `select`, `select-trigger`, `select-value`, `select-content` (the popover), `select-item`. The root carries `data-open`, `data-invalid`, `data-disabled`, and the trigger styles its open and invalid outlines off those (`group-data-open`, `group-data-invalid`); the trigger itself has `data-pressed`, `data-focus-visible`. The value carries `data-placeholder` while empty. Inside a [ThemeScope](https://blamy.github.io/ui/#/theming) the list wears the scope — see [Popover](https://blamy.github.io/ui/#/popover).

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `selectTriggerVariants`

Defined in `@/components/ui/select`. Base classes:

```text
[ 'bl-btn box-border flex w-full cursor-pointer items-center justify-between gap-2 border-0 px-3 text-left [font-family:inherit] text-foreground outline-none', 'transition-[background-color,box-shadow] duration-spring-snappy ease-spring-snappy data-pressed:bg-secondary-strong', 'data-focus-visible:ring-[3px] data-focus-visible:ring-ring/45 group-data-open:shadow-[inset_0_0_0_1.5px_var(--primary)]', 'group-data-invalid:shadow-[inset_0_0_0_1.5px_var(--destructive)] data-disabled:cursor-default data-disabled:opacity-50', ]
```

**`variant`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `bg-input` |
| `plain` | `w-auto justify-end bg-transparent px-1 text-muted-foreground data-pressed:bg-transparent data-pressed:opacity-60 group-data-open:shadow-none` |

**`size`** — default `default`

| Value | Adds |
| --- | --- |
| `sm` | `h-8 rounded-lg text-subhead` |
| `default` (default) | `h-11 rounded-ctl text-body` |

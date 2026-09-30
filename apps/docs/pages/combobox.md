# ComboBox

A text field with a list of suggestions under it. Type to narrow the options, move with the arrow keys, press Enter to commit, Esc to close the list. It is react-aria's `ComboBox` drawn as one iOS filled field with a disclosure chevron at its end. Use it when the option set is long enough to search — people, cities, labels; for a short fixed set use [Select](https://blamy.github.io/ui/#/select), and for a command palette use [CommandMenu](https://blamy.github.io/ui/#/command-menu).

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/combobox.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import {
  ComboBox, ComboBoxInput, ComboBoxContent, ComboBoxItem,
} from '@/components/ui/combobox'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import {
  ComboBox, ComboBoxInput, ComboBoxContent, ComboBoxItem,
} from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## Anatomy

The list is a [ListBox](https://blamy.github.io/ui/#/list-box) (popup variant) in a [Popover](https://blamy.github.io/ui/#/popover) as wide as the field. Static children are filtered for you by text.

```tsx
<ComboBox>
  <Label variant="field">City</Label>
  <ComboBoxInput placeholder="Search cities" />
  <ComboBoxContent>
    {cities.map((c) => <ComboBoxItem key={c} id={c}>{c}</ComboBoxItem>)}
  </ComboBoxContent>
</ComboBox>
```

## Filtering, descriptions, controlled

Two props feed a dynamic list, and they differ: `defaultItems` are filtered by the built-in "contains" match on each item's `textValue` (override with `defaultFilter`), while `items` is yours — react-aria shows exactly what you pass, so use it for server-side or custom filtering. `value` / `onChange` hold the selected item's id and `inputValue` / `onInputChange` the text, so you can control either. Items take an `icon` and a `description`. An empty result closes the list unless you set `allowsEmptyCollection`, which lets `renderEmptyState` show a message.

{% demo src="combobox/assignee" %}

```tsx
<ComboBox<Person> defaultItems={people} menuTrigger="focus" allowsEmptyCollection>
  <Label variant="field">Assignee</Label>
  <ComboBoxInput placeholder="Search the team" />
  <ComboBoxContent<Person> renderEmptyState={() => <p>No one matches.</p>}>
    {(p) => <ComboBoxItem textValue={p.name} description={p.email}>{p.name}</ComboBoxItem>}
  </ComboBoxContent>
</ComboBox>
```

## Custom values

`allowsCustomValue` lets the text stand when it matches no item — a tag or label input that suggests existing ones. Read what was typed from `inputValue`.

{% demo src="combobox/custom-value" %}

## When the list opens

`menuTrigger` picks it: `input` (default) opens as you type, `focus` also opens when the field gains focus, `manual` only opens from the chevron or the Down arrow. The chevron button (`data-slot="combobox-button"`) is for pointer users: it is left out of the tab order (`tabIndex=-1`) so focus stays in the input.

## Accessibility

react-aria provides the combobox pattern: the input has `role="combobox"` with `aria-expanded`, `aria-controls` and `aria-activedescendant`, so focus stays in the input while arrows move a virtual highlight through a `listbox`. Down/Up open the list, Enter commits the highlighted option, Esc closes the list, and the disclosure button opens it for pointer users. Screen readers are told how many options match as you type.

Give the field a name: a visible `Label` is wired automatically, otherwise `aria-label`. Put `FieldDescription` and `FieldError` from [TextField](https://blamy.github.io/ui/#/text-field) inside the `ComboBox`; they are announced with the input.

## Props

### ComboBox

Root is react-aria's `ComboBox`; all props pass through (`className` merged onto `group flex flex-col gap-1.5`).

| Prop | Default | Effect |
| --- | --- | --- |
| `items` / `defaultItems` | — | Dynamic collection: `items` as-is, `defaultItems` filtered by `defaultFilter`. |
| `defaultFilter` | "contains" | `(textValue, inputValue) => boolean`. |
| `value` / `defaultValue` / `onChange` | — | Selected item id. |
| `inputValue` / `defaultInputValue` / `onInputChange` | — | The text in the field. |
| `allowsCustomValue` | `false` | Keep text that matches no item. |
| `allowsEmptyCollection` | `false` | Keep the list open (for an empty message) when nothing matches. |
| `menuTrigger` | `input` | `input` · `focus` · `manual`. |
| `isDisabled` / `isRequired` / `isInvalid` | `false` | State; the field outlines red when invalid. |

### ComboBoxInput

| Prop | Default | Effect |
| --- | --- | --- |
| `groupClassName` | — | Classes for the field wrapper (the filled, 44px rounded `Group`). |
| `className` and the rest | — | On the `<input>` (react-aria `Input` props; `className` may be a function). |

### ComboBoxContent and ComboBoxItem

| Prop | Default | Effect |
| --- | --- | --- |
| `placement` | `bottom start` | Popover placement. |
| `popoverClassName` | — | Classes for the popover. |
| `renderEmptyState` | — | Shown when `allowsEmptyCollection` and nothing matches. |
| `ComboBoxItem` `icon` / `description` | — | Leading icon; secondary line. |
| `ComboBoxItem` `textValue` | string children | What filtering and the input text use; required for non-string children. |

`ComboBoxSection` is [ListBox](https://blamy.github.io/ui/#/list-box)'s section.

## Styling

Slots: `combobox`, `combobox-input` (the field wrapper, focus ring on `data-focus-within`), `combobox-button`, `combobox-content` (the popover), `combobox-item`. The chevron rotates on `group-data-open`; the wrapper shows a red outline on `group-data-invalid` and dims on `data-disabled`. There is no cva recipe: change the classes in your copy.

# Combobox

A text field with a list of suggestions under it. Type to narrow the options, move with the arrow keys, press Enter to commit, Esc to close the list. It is UI SDK's `Combobox` drawn as one iOS filled field with a disclosure chevron at its end. Use it when the option set is long enough to search — people, cities, labels; for a short fixed set use [Select](https://blamy.github.io/ui/#/select), and for a command palette use [CommandMenu](https://blamy.github.io/ui/#/command-menu).

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/combobox.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import {
  Combobox, ComboboxInput, ComboboxContent, ComboboxItem,
} from '@/components/ui/combobox'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import {
  Combobox, ComboboxInput, ComboboxContent, ComboboxItem,
} from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## Anatomy

The `Combobox` root renders no element: lay the label, the field and any help text out with a [Field](https://blamy.github.io/ui/#/field). `ComboboxInput` is the input and its disclosure button drawn as one field; `ComboboxContent` is the popup, as wide as the field, holding a `ComboboxList` of options and a `ComboboxEmpty` message beside it. Options written as children are filtered for you by their text (or `label`, plus `keywords`).

```tsx
<Field>
  <FieldLabel variant="field">City</FieldLabel>
  <Combobox>
    <ComboboxInput placeholder="Search cities" />
    <ComboboxContent>
      <ComboboxEmpty>No cities found.</ComboboxEmpty>
      <ComboboxList>
        {cities.map((c) => <ComboboxItem key={c} value={c}>{c}</ComboboxItem>)}
      </ComboboxList>
    </ComboboxContent>
  </Combobox>
</Field>
```

## Data, filtering, controlled

`items` on the root takes the options as data (strings, `{ value, label, keywords, disabled }`, groups and separators); an empty `ComboboxContent` draws the ones that match with the same rows, and hides groups with no match. For rows of your own, pass `ComboboxList` a function: it receives the list's state, whose `items` are the matches. `filter` replaces the built-in match (`'contains'`, `'startsWith'` or a function); for results a server already filtered pass them as `items` with `filter={false}`, and `status` while they load.

The value is an option (`value` / `defaultValue` / `onValueChange(value, details)`, a list with `multiple`); the text in the field is only a query (`query` / `defaultQuery` / `onQueryChange`). Esc closes the list and brings the chosen option's label back. Options take an `icon` and a `description`.

{% demo src="combobox/assignee" %}

```tsx
<Combobox items={people} value={assignee} onValueChange={setAssignee}>
  <ComboboxInput placeholder="Search the team" />
  <ComboboxContent>
    <ComboboxEmpty>No one matches.</ComboboxEmpty>
    <ComboboxList>
      {(state) => (state.items as Person[]).map((p) => (
        <ComboboxItem key={p.value} value={p.value} label={p.label} keywords={p.keywords} description={p.keywords[0]}>
          {p.label}
        </ComboboxItem>
      ))}
    </ComboboxList>
  </ComboboxContent>
</Combobox>
```

## Custom values

`allowCustomValue` lets the text stand when it matches no option — a tag or label input that suggests existing ones. Enter makes the typed text the value.

{% demo src="combobox/custom-value" %}

## Choosing several

With `multiple` the value is a list, and choosing an option toggles it and keeps the list open. `chips` on `ComboboxInput` shows the chosen options as chips before the text, each with a remove button; Backspace in the empty input removes the last one, and the arrow keys move between chips. `clearable` adds a Clear button that empties the selection and the text and keeps focus in the input.

```tsx
<Field>
  <FieldLabel variant="field">Cities</FieldLabel>
  <Combobox multiple defaultValue={['Berlin']}>
    <ComboboxInput chips clearable placeholder="Add a city" />
    <ComboboxContent>
      <ComboboxList>{cities.map((c) => <ComboboxItem key={c} value={c}>{c}</ComboboxItem>)}</ComboboxList>
    </ComboboxContent>
  </Combobox>
</Field>
```

To draw the chips yourself, pass a function of the value's state: `chips={(state) => (state.value as string[]).map((v) => <ComboboxChip key={v} value={v} removeLabel={`Remove ${v}`} />)}`.

## When the list opens

Typing opens the list, and so do the Down and Up arrows and the chevron. The chevron button (`data-slot="combobox-trigger"`) is for pointer users: it is out of the tab order so focus stays in the input. `autoHighlight` highlights the first match as you type, so Enter takes it.

## Small screens

`presentation="auto"` on the root shows the popup as a bottom sheet on small touch screens (shaped like the kit's Sheet), with the input in its header; `"sheet"` always does.

## Accessibility

UI SDK provides the combobox pattern: the input has `role="combobox"` with `aria-expanded`, `aria-controls` and `aria-activedescendant`, so focus stays in the input while the arrows move a virtual highlight (`data-highlighted`) through a `listbox`. Down/Up open the list, Enter chooses the highlighted option, Esc closes the list, and the disclosure button opens it for pointer users. `ComboboxEmpty` is announced when nothing matches.

Give the field a name: a `FieldLabel` in a Field is wired automatically, else a `ComboboxLabel`, else `aria-label` on the input. `FieldDescription` and `FieldError` in the same Field are announced with the input.

## Props

### Combobox

UI SDK's `Combobox` props. The popup renders into BLProvider's root unless you pass `container`.

| Prop | Default | Effect |
| --- | --- | --- |
| `items` | — | Options as data, filtered and drawn by an empty `ComboboxContent`. |
| `filter` | `'contains'`, on label and keywords | `'startsWith'`, a function, or `false` to show `items` as they are. |
| `value` / `defaultValue` / `onValueChange` | `null` | The chosen option (a list with `multiple`). |
| `query` / `defaultQuery` / `onQueryChange` | `''` | The text in the field. |
| `allowCustomValue` | `false` | The typed text becomes the value when it matches nothing. |
| `autoHighlight` | `false` | Highlight the first match as you type. |
| `open` / `defaultOpen` / `onOpenChange` | closed | Control the list. |
| `status` / `onLoadMore` | `idle` | Async results: `loading` sets `aria-busy`. |
| `disabled` / `required` / `readOnly` / `name` | — | State and the form input (a Field's `name` and `disabled` reach it). |
| `presentation` / `controller` | — | Sheet on small screens; `createComboboxController()`. |

### ComboboxInput

| Prop | Default | Effect |
| --- | --- | --- |
| `groupClassName` | — | Classes for the field around the input (the filled, 44px rounded box). |
| `triggerLabel` | `Show options` | The disclosure button's accessible name. |
| `chips` | — | With `multiple`: `true` shows each chosen option as a `ComboboxChip`; a function `(state) => node` draws your own. |
| `clearable` / `clearLabel` | `false` / `Clear` | A Clear button, shown while there is a selection or text. |
| `className` and the rest | — | On the `<input>`. |

### ComboboxContent, ComboboxList and ComboboxItem

| Prop | Default | Effect |
| --- | --- | --- |
| `side` / `align` / `sideOffset` | `bottom` / `start` / `8` | Position under the field. |
| `anchor` | the field | What the popup hangs from and matches in width. |
| `ComboboxList` `children` | the matching `items` | Options, or a function of the list's state. |
| `ComboboxItem` `value` / `label` / `keywords` | — | The option's value; its text when the children are not plain text; more words that match. |
| `ComboboxItem` `icon` / `description` / `disabled` | — | Leading icon; secondary line; dimmed and skipped. |

`ComboboxChip` (`value`, `removeLabel`, children default to the option's label) with its `ComboboxChipRemove`, `ComboboxStatus` (the loading or error line of an async list, as `(state) => node` children), `ComboboxEmpty` (shown while nothing matches), `ComboboxGroup`, `ComboboxGroupLabel`, `ComboboxSeparator` and `ComboboxLabel` complete the set.

## Styling

Parts carry UI SDK's slots: `combobox-input`, `combobox-trigger`, `combobox-content`, `combobox-list`, `combobox-item`, `combobox-empty`, `combobox-group`, `combobox-chips`, `combobox-chip`, `combobox-chip-remove`, `combobox-clear`, `combobox-status`. The field's focus outline is `focus-within`; it shows a red outline when the input is `data-invalid` and dims when it is disabled. The chevron rotates on the trigger's `data-open`. The popup hides itself while there is nothing to show. There is no cva recipe: change the classes in your copy.

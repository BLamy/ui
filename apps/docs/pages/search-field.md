# SearchField

The iOS search field: a rounded secondary-colored bar with a magnifier, a borderless input and a clear button that appears once there is a query. It is UI SDK's `Input` in an `InputGroup` with an `InputClear`, plus two keys of its own: Esc clears a non-empty query and Enter submits. It is a finished, fixed-style control, not a wrapper: for a labelled, validated text field use a [Field](https://blamy.github.io/ui/#/field) with an [Input](https://blamy.github.io/ui/#/input).

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/search-field.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { SearchField } from '@/components/ui/search-field'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { SearchField } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## Filtering a list

Control it with `value` and `onValueChange`, or seed it with `defaultValue` and let it keep its own state. `onValueChange(value, details)` receives the string on every keystroke and `''` when it is cleared; `details.reason` is `input-change` for typing and `clear-press` for the clear button or Esc. `onSubmit(value, details)` receives the query on Enter, with `details.reason` `enter-key`, the key event, `source` and `cancel()`.

{% demo src="search-field/filter" %}

```tsx
const [query, setQuery] = useState('')

<SearchField
  value={query}
  onValueChange={setQuery}
  onSubmit={runSearch}
  placeholder="Search people"
  aria-label="Search people"
/>
```

Uncontrolled: `<SearchField defaultValue="Wei" onValueChange={track} aria-label="Search contacts" />`.

## Keys

| Key | Does |
| --- | --- |
| Esc | Clears the query. In an empty field it does nothing and is left alone, so the popover or sheet around the field still closes on it. |
| Enter | Calls `onSubmit` with the query. Without `onSubmit`, or when `onSubmit` calls `details.cancel()`, Enter submits the form around the field, like any input. |

Neither key acts while an input method is composing text. A `readOnly` field still submits on Enter, but Escape doesn't clear it.

## From outside

Pass a `controller` to write the query from somewhere else, like a suggestion chip. Its writes reach `onValueChange` with the reason `imperative`.

```tsx
const [search] = useState(createInputController)

<SearchField controller={search} aria-label="Search cities" />
<Button onClick={() => search.setValue('Lisbon')}>Lisbon</Button>
```

`createInputController` comes from [Input](https://blamy.github.io/ui/#/input).

## Accessibility

The input is a native `type="search"`, so its role is `searchbox`. The clear button is labelled "Clear search", returns focus to the input, and is left out of the Tab order (Esc is the keyboard route). The field's accessible name is `aria-label`, which defaults to "Search"; set it to say what is searched ("Search contacts") so it differs from other search fields on the page. Inside a `Field`, the `FieldLabel` names it instead. Announce the result count yourself (`announce()` from `@ui-sdk/core`) if the list updates as you type.

An agent sees the input under the field's name, with `setValue` and `clear`. With `onSubmit`, the field is listed too, under the same name, with a `submit` action: it calls `onSubmit` with the current query, `reason: 'imperative'` and `source: 'agent'`.

## Props

`SearchField` takes the props of UI SDK's `Input`, which go to the input, except `type` and `render`:

| Prop | Default | Effect |
| --- | --- | --- |
| `value` | — | Controlled query. |
| `defaultValue` | — | Initial query when uncontrolled. |
| `onValueChange` | — | `(value, details)` on each change, and `''` when cleared. `details.cancel()` rejects it. |
| `onSubmit` | — | `(value, details)` when Enter is pressed (`reason: 'enter-key'`) or an agent submits (`'imperative'`). `details.cancel()` leaves Enter to the form. |
| `controller` | — | From `createInputController()`: `getValue()`, `setValue(value)`, `clear()`, `focus()`. |
| `placeholder` | `Search` | Placeholder text. |
| `disabled` / `readOnly` | `false` | A disabled field is dimmed; neither shows the clear button. |
| `name`, `autoFocus`, `autoComplete`, … | — | Any other native input attribute. |
| `aria-label` | `Search` | Accessible name. |
| `className` / `style` | — | Merged onto the bar, not the input. |

There is no label, description or validation here: put it in a `Field` for those.

## Styling

The root is `data-slot="search-field"`, an 11px-radius `bg-secondary` row with a 17px `search` icon, an `input` (`data-slot="input"`) with no chrome (the browser's own search cancel button is hidden) and, when the query is not empty, a 18px `xcirc` clear button (`data-slot="input-clear"`). The `input-group` between the root and its children has no box of its own (`display: contents`). Because `className` merges last you can change the background (`bg-card` on a secondary surface) or the radius, and reach the input with `[&_input]:`. To hold it above a list, pass it as the `header` of a `List`.

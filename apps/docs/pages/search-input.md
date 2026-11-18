# SearchInput

The iOS search field: a rounded secondary-colored bar with a magnifier, a borderless input and a clear button that appears once there is a query. It is UI SDK's `Input` in an `InputGroup` with an `InputClear`, plus two keys of its own: Esc clears a non-empty query and Enter submits. Use it for a query that filters or searches; for a labelled, validated text field use a [Field](https://blamy.github.io/ui/#/field) with an [Input](https://blamy.github.io/ui/#/input); to filter by structured fields use [Filter](https://blamy.github.io/ui/#/filter) (whose sentence box, `FilterInput`, is a SearchInput with a sparkle).

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/search-input.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from), adds BL UI's tokens to your CSS and installs `@brett_lamy/ui` for UI SDK, which the copied files import by the package's name (`@brett_lamy/ui/sdk/…`). The copied source is yours to edit. Import from your alias:

```tsx
import { SearchInput } from '@/components/ui/search-input'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from their module:

```tsx
import '@brett_lamy/ui/styles.css'

import { SearchInput } from '@brett_lamy/ui/search-input'
```
{% endtab %}
{% endtabs %}

## Filtering a list

Control it with `value` and `onValueChange`, or seed it with `defaultValue` and let it keep its own state. `onValueChange(value, details)` receives the string on every keystroke and `''` when it is cleared; `details.reason` is `input-change` for typing and `clear-press` for the clear button or Esc. `onSubmit(value, details)` receives the query on Enter, with `details.reason` `enter-key`, the key event, `source` and `cancel()`.

{% demo src="search-input/filter" %}

```tsx
const [query, setQuery] = useState('')

<SearchInput
  value={query}
  onValueChange={setQuery}
  onSubmit={runSearch}
  placeholder="Search people"
  aria-label="Search people"
/>
```

Uncontrolled: `<SearchInput defaultValue="Wei" onValueChange={track} aria-label="Search contacts" />`.

## Sizes and glyph

`size="sm"` is the 32px search of a sidebar, a toolbar or a popover; the default is the 36px bar under a large title. `icon` replaces the magnifier (`null` shows none) and `clearable={false}` drops the Clear button (Escape still clears).

```tsx
<SearchInput size="sm" aria-label="Search settings" />
<SearchInput icon={<Icon name="bubble" size={16} />} clearable={false} placeholder="Ask anything" aria-label="Ask" />
```

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

<SearchInput controller={search} aria-label="Search cities" />
<Button onClick={() => search.setValue('Lisbon')}>Lisbon</Button>
```

`createInputController` comes from [Input](https://blamy.github.io/ui/#/input).

## Accessibility

The input is a native `type="search"`, so its role is `searchbox`. The clear button is labelled "Clear search", returns focus to the input, and is left out of the Tab order (Esc is the keyboard route). The field's accessible name is `aria-label`, which defaults to "Search"; set it to say what is searched ("Search contacts") so it differs from other search fields on the page. Inside a `Field`, the `FieldLabel` names it instead. Announce the result count yourself (`announce()` from `@brett_lamy/ui/sdk/core`) if the list updates as you type.

An agent sees the input under the field's name, with `setValue` and `clear`. With `onSubmit`, the field is listed too, under the same name, with a `submit` action: it calls `onSubmit` with the current query, `reason: 'imperative'` and `source: 'agent'`.

## Props

`SearchInput` takes the props of UI SDK's `Input`, which go to the input, except `type` and `render`:

| Prop | Default | Effect |
| --- | --- | --- |
| `value` | — | Controlled query. |
| `defaultValue` | — | Initial query when uncontrolled. |
| `onValueChange` | — | `(value, details)` on each change, and `''` when cleared. `details.cancel()` rejects it. |
| `onSubmit` | — | `(value, details)` when Enter is pressed (`reason: 'enter-key'`) or an agent submits (`'imperative'`). `details.cancel()` leaves Enter to the form. |
| `controller` | — | From `createInputController()`: `getValue()`, `setValue(value)`, `clear()`, `focus()`. |
| `size` | `default` | `sm` 32px (footnote text, 14px glyph) · `default` 36px (body text, 17px glyph). |
| `icon` | magnifier | The leading glyph; `null` shows none. |
| `clearable` | `true` | Show the Clear button while there is a query. |
| `placeholder` | `Search` | Placeholder text. |
| `disabled` / `readOnly` | `false` | A disabled field is dimmed; neither shows the clear button. |
| `name`, `autoFocus`, `autoComplete`, … | — | Any other native input attribute. |
| `aria-label` | `Search` | Accessible name. |
| `className` / `style` | — | Merged onto the bar, not the input. |

There is no label, description or validation here: put it in a `Field` for those.

## Styling

The root is `data-slot="search-input"`, `searchInputVariants({ size })`: a `bg-secondary` row (11px radius at `default`, 8px at `sm`) with the glyph, an `input` (`data-slot="input"`) with no chrome (the browser's own search cancel button is hidden) and, when the query is not empty, an `xcirc` clear button (`data-slot="input-clear"`). Focus draws the same 1.5px inset primary ring as Input. The `input-group` between the root and its children has no box of its own (`display: contents`). Because `className` merges last you can change the background (`bg-card` on a secondary surface) or the radius, and reach the input with `[&_input]:`. To hold it above a list, pass it as the `header` of a `List`.

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `searchInputVariants`

Defined in `@/components/ui/search-input`. Base classes:

```text
[ 'box-border flex min-w-0 items-center bg-secondary text-foreground transition-[box-shadow] duration-spring-snappy ease-spring-snappy', // The fill stays on focus, as on iOS; the focus line is the field's. fieldFocusRing, 'has-[input:disabled]:opacity-50', ]
```

**`size`** — default `default`

| Value | Adds |
| --- | --- |
| `sm` | `h-8 gap-1.5 rounded-lg px-2 text-footnote` |
| `default` (default) | `h-9 gap-[7px] rounded-[11px] px-[9px] text-body` |

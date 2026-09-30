# SearchField

The iOS search field: a rounded secondary-colored bar with a magnifier, a borderless input and a clear button that appears once there is a query. Built on react-aria's `SearchField`, so Esc clears a non-empty query and Enter submits. It is a finished, fixed-style control, not a wrapper: for a labelled, validated text field use [TextField](https://blamy.github.io/ui/#/text-field) with an [Input](https://blamy.github.io/ui/#/input).

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

Control it with `value` and `onChange`, or seed it with `defaultValue` and let it keep its own state. `onChange` receives the string on every keystroke and `''` when it is cleared; `onSubmit` receives the query on Enter.

{% demo src="search-field/filter" %}

```tsx
const [query, setQuery] = useState('')

<SearchField
  value={query}
  onChange={setQuery}
  onSubmit={runSearch}
  placeholder="Search people"
  aria-label="Search people"
/>
```

Uncontrolled: `<SearchField defaultValue="Wei" onChange={track} aria-label="Search contacts" />`.

## Accessibility

react-aria gives it `role="searchbox"`, Esc-to-clear and a clear button labelled "Clear search" that is left out of the Tab order (Esc is the keyboard route). The field's accessible name is `aria-label`, which defaults to "Search"; set it to say what is searched ("Search contacts") so it differs from other search fields on the page. Announce the result count yourself (an `aria-live` region) if the list updates as you type.

## Props

| Prop | Default | Effect |
| --- | --- | --- |
| `value` | — | Controlled query. |
| `defaultValue` | `''` | Initial query when uncontrolled. |
| `onChange` | — | Called with the string on each change, and `''` when cleared. |
| `onSubmit` | — | Called with the query when Enter is pressed. |
| `placeholder` | `Search` | Placeholder text. |
| `autoFocus` | — | Focus on mount. |
| `aria-label` | `Search` | Accessible name. |
| `className` / `style` | — | Merged onto the bar. |

Only these props are forwarded: there is no `isDisabled`, label, description or validation. Use `TextField` for those.

## Styling

The root is `data-slot="search-field"`, an 11px-radius `bg-secondary` row with a 17px `search` icon, an `input` with no chrome (the browser's own search cancel button is hidden) and, when the query is not empty, a 18px `xcirc` clear button. Because `className` merges last you can change the background (`bg-card` on a secondary surface) or the radius. To hold it above a list, pass it as the `header` of a `List`.

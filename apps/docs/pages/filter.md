# Filter

Linear-style filtering. A **Filter** button (and an optional `F` shortcut) opens a searchable list of fields; pick one and a searchable multi-select of its values (checkbox rows with colors, icons and counts) — or a date, number, text or Yes/No editor. The filter lands as a **chip**: `[field] [operator ▾] [value ▾] [×]`. The operator and the value are each a button of their own: the operator opens a small menu (`is`, `is not`, `is any of`, `is none of`; `contains`; `before`, `after`, `in the last`; `=`, `<`, `>`), the value opens the same picker you added it with. Everything is built on react-aria: a toolbar with arrow keys, menus, popovers, an autocomplete list.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/filter.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import {
  FilterBar, FilterToolbar, FilterMenu, FilterList, FilterChip,
} from '@/components/ui/filter'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import {
  FilterBar, FilterToolbar, FilterMenu, FilterList, FilterChip,
} from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

The filters themselves are plain data. `FilterBar` and its parts are one view of a small, UI-independent, serializable model (`lib/filter`): fields, operator tables per kind, a pure `matchFilters`, and a URL-safe `serializeFilters` / `parseFilters`. For describing filters in a sentence, see [FilterInput](https://blamy.github.io/ui/#/filter-input).

## Filtering a list

Give the bar `fields`, hold the filters in state, and derive the list with `matchFilters`. Edit the Status chip in place, add another with the Filter button (or press `F`), remove one with ×, Backspace or Delete.

{% demo src="filter/issue-tracker" %}

```tsx
const [filters, setFilters] = useState<Filter[]>([
  { id: 'status', field: 'status', operator: 'is_any_of', value: ['open', 'in_progress'] },
])
const shown = matchFilters(issues, filters, fields, (issue, field) => issue[field])

<FilterBar fields={fields} value={filters} onValueChange={setFilters} hotkey="f" />
```

`value` / `onValueChange` control the filters; `defaultValue` leaves them to the bar. `match` / `onMatchChange` (or `defaultMatch`) hold whether every filter must hold (`all`, the default) or any one (`any`); `showMatch` adds the "Match all ▾" menu from two filters on.

## Fields

```ts
const fields: FilterField[] = [
  {
    id: 'status', label: 'Status', icon: 'circle', kind: 'select',
    options: [{ value: 'open', label: 'Open', color: 'var(--primary)', count: 5 }, …],
  },
  { id: 'created', label: 'Created', icon: 'calendar', kind: 'date' },
]
```

| Kind | An item has… | Operators | Editor |
| --- | --- | --- | --- |
| `select` | one value (status) | `is`, `is not`, `is any of`, `is none of` | searchable checkbox rows |
| `multiselect` | several (labels) | `includes any of`, `includes all of`, `includes none of` | searchable checkbox rows |
| `boolean` | a flag | `is` | Yes / No |
| `date` | a date | `is`, `before`, `after`, `in the last` | presets, a picked day, or a span (N days / weeks / months / years) |
| `number` | a number | `=`, `≠`, `<`, `≤`, `>`, `≥` | a number box |
| `text` | a string | `contains`, `doesn't contain`, `is`, `is not` | a text box |

An option is `{ value, label, icon?, color?, count?, keywords? }`: `color` draws a dot, `icon` an [Icon](https://blamy.github.io/ui/#/icons) name or any node, `count` a trailing number, and `keywords` extra words the search matches. A field's `icon` is shown on its chip and in the field list; `aliases` are other words for it in a typed sentence.

Picking two values on a `select` turns "is" into "is any of" (and back when one is left); choosing "is" with several ticked keeps the first. Values keep the field's option order, so a chip reads the same however the boxes were ticked. A field is offered once; its chip is where you edit it (`allowDuplicates` lists it again).

## Matching and the model

```ts
import { matchFilters, describeFilter, serializeFilters, parseFilters } from '@/lib/filter'

matchFilters(items, filters, fields, (item, fieldId) => item[fieldId], { match: 'all', now })
// → the items that satisfy the filters, in their original order

describeFilter(filter, fields)       // "Status is any of Open, In progress"
serializeFilters(filters)            // 'status:is_any_of:open,in_progress;created:in_the_last:7d'
parseFilters(text, fields)           // the inverse, checked against the schema
```

`matchFilters` is pure. A filter with no value yet, or on a field the schema does not have, is ignored; no filters keeps everything. `getValue(item, fieldId)` returns whatever the item holds: a string or array for a select, a boolean, a number, a string, or a `Date`, epoch milliseconds or ISO string for a date (a bare `YYYY-MM-DD` is that local day).

Dates are values you can read and write: `{ type: 'preset', preset: 'last_7_days' }`, `{ type: 'date', date: '2026-01-31' }` or `{ type: 'relative', amount: 3, unit: 'month' }`. Presets are today, yesterday, this / last week, last 7 / 30 days, this / last month and this year; `now` and `weekStart` (default Monday) make them deterministic in tests and stories. `before` and `after` take a preset or a day; `in the last` takes a span, counted back from now.

The serialized form is `field:operator:value;…`, every part percent-encoded, a list comma-separated, a date `today` / `2026-01-31` / `7d`. It is safe in a query string as it is, round-trips (`parseFilters(serializeFilters(f), fields)` equals `f` apart from ids), and `parseFilters` drops — never throws on — a field, operator or value the schema does not allow.

| Export | Does |
| --- | --- |
| `matchFilters` / `matchesFilters` | The items that satisfy the filters / whether one item does. |
| `describeFilter` / `describeValue` | A filter, or just its value, as words. |
| `serializeFilters` / `parseFilters` | URL-safe text and back. |
| `operatorsFor(kind)` / `defaultOperator(kind)` / `operatorLabel(op, count)` | The operator tables. |
| `createFilter(field, value?, operator?)` / `withValue` / `withOperator` / `coerceFilter` | Build and edit filters so operator and value agree. |
| `dateRange(value, options)` / `toTime(raw)` | What a date value covers, and an item's date as milliseconds. |

## Parts

`FilterBar` provides the fields, the filters and their edits, and a polite live region; with no children it renders a `FilterToolbar`. Compose the rest yourself:

```tsx
<FilterBar fields={fields} value={filters} onValueChange={setFilters}>
  <FilterToolbar>
    <FilterMenu hotkey="f" />
    <FilterList />
    <FilterMatch />
    <FilterClear />
  </FilterToolbar>
</FilterBar>
```

| Part | Props |
| --- | --- |
| `FilterBar` | `fields`, `value` / `defaultValue` / `onValueChange`, `match` / `defaultMatch` / `onMatchChange`, `allowDuplicates`, `hotkey`, `showMatch`, `locale`, `children`. |
| `FilterToolbar` | The row: react-aria's Toolbar. `hotkey`, `showMatch`, `children`. |
| `FilterMenu` | The Filter button and its popover. `hotkey`, `children` (your own trigger — any pressable), `label`, `isOpen` / `defaultOpen` / `onOpenChange`, `placement`. Outside a bar also `fields` and `state`. |
| `FilterList` | The chips, as a list. A render function child draws each filter yourself. Renders nothing when empty. |
| `FilterChip` | One filter. `filter`, `field`, `onChange`, `onRemove`, `readOnly`, `size`, `tone`. Inside a bar it needs only `filter`. |
| `FilterClear` | "Clear all". Renders nothing when empty. |
| `FilterMatch` | "Match all ▾". Shown from two filters on. |
| `FilterValueEditor` | The value editor on its own: `field`, `operator`, `value`, `onChange`, `onDone`. |

The parts also work without a bar: `useFilters()` holds the state, `FilterMenu` adds to it (with a trigger of your own) and `FilterChip` draws and edits each filter. You give up the toolbar's arrow keys, the announcements and Clear all.

{% demo src="filter/composition" %}

### Field kinds

One field of each kind, the match all / any menu, and what `serializeFilters` makes of it.

{% demo src="filter/field-kinds" %}

## Hooks

### `useFilters(options?)`

The filters and their edits as state, controlled or not. `FilterBar` is built on it.

```tsx
const state = useFilters({ defaultValue: [], onValueChange: save })
state.filters                              // Filter[]
state.add(filter)                          // append
state.update(id, { operator, value })      // edit
state.remove(id)
state.clear()
state.setFilters((prev) => …)              // updater: sees the latest value even within one tick
state.match; state.setMatch('any')
```

Options: `value`, `defaultValue`, `onValueChange`, `match`, `defaultMatch`, `onMatchChange`.

### `useFilterBar()`

Inside a `FilterBar`, its `fields`, filters, `match`, edits, `announce(message)` (say something politely), `removeAndFocus(id)` and `apply(filters, mode)` (add filters from outside the menu: `merge` replaces a field's filter, `replace` swaps them all). It throws outside a bar; `useOptionalFilterBar()` returns `null` instead.

## Keyboard

| Keys | Effect |
| --- | --- |
| `F` (with `hotkey="f"`) | Open the Filter menu. Ignored while you type in a field, and with a modifier held. |
| `Tab` | The toolbar is one tab stop: Tab enters it and the next Tab leaves it. |
| `←` `→` | Move across the Filter button, every chip's operator, value and ×, Match and Clear all. |
| `Enter` `Space` | Open the focused operator or value, press the focused button. |
| `Backspace` `Delete` | On any part of a chip: remove it. Focus moves to the next chip, else the previous, else the Filter button. |
| In the menu: type, `↑` `↓`, `Enter` | The search keeps focus; arrows move the active row, Enter picks a field or ticks a value. |
| `Esc` | Clears the search, then closes the popover and returns focus to its button. A ticked value stays ticked. |
| `Backspace` on an empty search | Back from a field's values to the field list. |

## Accessibility

- The row is a `toolbar` labelled "Filters"; the chips are a labelled `list` of `group`s whose names are sentences — "Status is any of Open, In progress".
- The operator and value buttons are named by what they do and hold ("Status operator: is any of", "Status value: Open, In progress"), so their visible text is part of the name. The × reads "Remove filter: Status is any of Open, In progress".
- Menus and pickers are react-aria's: the search field keeps DOM focus and the active option is virtual (`aria-activedescendant`), selected options say so (`aria-selected`), focus returns to the button that opened them.
- Additions, edits, removals, Clear all and match changes are announced through a polite live region.
- Option colors are decoration; every option has its label, and counts are text.

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `filterBarVariants`

Defined in `@/components/ui/filter`. Base classes:

```text
flex min-w-0 flex-col gap-2
```

No variants.

### `filterToolbarVariants`

Defined in `@/components/ui/filter`. Base classes:

```text
flex min-w-0 flex-wrap items-center gap-1.5
```

No variants.

### `filterChipVariants`

Defined in `@/components/ui/filter`. Base classes:

```text
box-border inline-flex max-w-full min-w-0 items-stretch overflow-hidden rounded-lg text-foreground
```

**`size`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `h-7 text-footnote` |
| `sm` | `h-6 text-caption` |

**`tone`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `bg-secondary shadow-hairline` |
| `preview` | `bg-primary/10 text-foreground shadow-hairline` |

# Filter

Linear-style filtering. A **Filter** button (and an optional `F` shortcut) opens a searchable list of fields; pick one and a searchable multi-select of its values (checkbox rows with colors, icons and counts) — or a date, number, text or Yes/No editor. The filter lands as a **chip**: `[field] [operator ▾] [value ▾] [×]`. The operator and the value are each a button of their own: the operator opens a small menu (`is`, `is not`, `is any of`, `is none of`; `contains`; `before`, `after`, `in the last`; `=`, `<`, `>`), the value opens the same picker you added it with. Everything is built on UI SDK: a Toolbar with arrow keys, Menus with radio items, Popovers, a Command for the fields and an option search (`createListbox` with a list of ticked values) for the values.

Use it to narrow a list by structured fields (status, assignee, a date range). For a free-text query use [SearchInput](https://blamy.github.io/ui/#/search-input); to let people type the filters as a sentence, add a `FilterInput` to the bar ([below](#describing-filters-in-a-sentence)).

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/filter.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from), adds BL UI's tokens to your CSS and installs `@brett_lamy/ui` for UI SDK, which the copied files import by the package's name (`@brett_lamy/ui/sdk/…`). The copied source is yours to edit. Import from your alias:

```tsx
import {
  FilterBar, FilterToolbar, FilterMenu, FilterList, FilterChip,
} from '@/components/ui/filter'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from their module:

```tsx
import '@brett_lamy/ui/styles.css'

import {
  FilterBar, FilterToolbar, FilterMenu, FilterList, FilterChip,
} from '@brett_lamy/ui/filter'
```
{% endtab %}
{% endtabs %}

The filters themselves are plain data. `FilterBar` and its parts are one view of a small, UI-independent, serializable model (`lib/filter-model`): fields, operator tables per kind, a pure `matchFilters`, and a URL-safe `serializeFilters` / `parseFilters`. For describing filters in a sentence, see `FilterInput` [below](#describing-filters-in-a-sentence).

## Filtering a list

Give the bar `fields`, hold the filters in state, and derive the list with `matchFilters`. Edit the Status chip in place, add another with the Filter button (or press `F`), remove one with ×, Backspace or Delete.

{% demo src="filter/issue-tracker" %}

```tsx
const [filters, setFilters] = useState<Filter[]>([
  { id: 'status', field: 'status', operator: 'is_any_of', value: ['open', 'in_progress'] },
])
const shown = matchFilters(issues, filters, fields, (issue, field) => issue[field])

<FilterBar fields={fields} value={filters} onValueChange={setFilters}>
  <FilterToolbar>
    <FilterMenu shortcut="f" />
    <FilterList />
    <FilterClear />
  </FilterToolbar>
</FilterBar>
```

With no children, `<FilterBar fields={fields} … />` renders the same row without the shortcut: the Filter button, the chips and Clear all.

`value` / `onValueChange(filters, details)` control the filters. `details` are UI SDK's change details: `reason` (`add`, `update`, `remove`, `clear`, `apply`, or `imperative` for `setFilters` from code), the `event` behind it (the press, the key, the pick in a value list), `source` (`mouse`, `keyboard`, `agent`…, passed on from the UI SDK part that made the change) and `cancel()`, which keeps an uncontrolled bar as it was; `defaultValue` leaves them to the bar. `match` / `onMatchChange(match, details)` (or `defaultMatch`) hold whether every filter must hold (`all`, the default) or any one (`any`); compose a `<FilterMatch />` into the toolbar for the "Match all ▾" menu, which shows from two filters on.

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
import { matchFilters, describeFilter, serializeFilters, parseFilters } from '@/lib/filter-model'

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

`FilterBar` provides the fields, the filters and their edits, and announces what changes (UI SDK's `announce()`); with no children it renders a `FilterToolbar`, whose own default is `<FilterMenu /> <FilterList /> <FilterClear />`. Compose the rest yourself:

```tsx
<FilterBar fields={fields} value={filters} onValueChange={setFilters}>
  <FilterInput />
  <FilterToolbar>
    <FilterMenu shortcut="f" />
    <FilterList />
    <FilterMatch />
    <FilterClear />
  </FilterToolbar>
</FilterBar>
```

| Part | Props |
| --- | --- |
| `FilterBar` | `fields`, `value` / `defaultValue` / `onValueChange`, `match` / `defaultMatch` / `onMatchChange`, `allowDuplicates`, `locale`, `children`, and the props of a `<div>`. |
| `FilterToolbar` | The row: the kit [Toolbar](https://blamy.github.io/ui/#/toolbar) (`variant`, `size`, and UI SDK's `orientation`, `loop`, `disabled`, `controller`…). `children`. Its own buttons (Filter, Match, Clear all) are the Toolbar's quiet `sm` tools. |
| `FilterMenu` | The Filter button and its popover. `shortcut` (a single key such as `"f"`, which opens the menu while nothing editable has focus), `render` (your own trigger element, like `<Button variant="secondary" />`), `children` (the trigger's content; default a filter icon and "Filter"), `open` / `defaultOpen` / `onOpenChange(open, details)`, `side` / `align`, `className` (the trigger), `contentProps` (the popover content's props, such as its `className`). Outside a bar also `fields` and `state`. |
| `FilterList` | The chips, as a list. A render function child draws each filter yourself. Renders nothing when empty. |
| `FilterChip` | One filter. `filter`, `field`, `onValueChange(filter, details)` (an edit, reason `update`; in a bar, `details.cancel()` keeps the bar as it was), `onRemove`, `readOnly`, `size` (`default` 28px · `sm` 24px), `variant` (`default` · `preview`, the tinted chip of a filter not applied yet). Inside a bar it needs only `filter`. |
| `FilterClear` | "Clear all". Renders nothing when empty. |
| `FilterMatch` | "Match all ▾". Shown from two filters on. Takes a button's props. |
| `FilterValueEditor` | The value editor on its own: `field`, `operator`, `value`, `onValueChange(value, details)`, `onDone`. Typed values use the kit's [Input](https://blamy.github.io/ui/#/input) (`size="sm"`) and Button. |
| `FilterInput` | A sentence turned into filters, from its own registry item (`filter-input`): see [below](#describing-filters-in-a-sentence). |

The parts also work without a bar: `useFilters()` holds the state, `FilterMenu` adds to it (with a trigger of your own) and `FilterChip` draws and edits each filter. You give up the toolbar's arrow keys, the announcements and Clear all.

{% demo src="filter/composition" %}

### Field kinds

One field of each kind, the match all / any menu, and what `serializeFilters` makes of it.

{% demo src="filter/field-kinds" %}

## Describing filters in a sentence

`FilterInput` is a box above the bar where people type the filters in words — "urgent bugs assigned to bob" — and a live preview shows the chips it would create, plus anything it dropped and any assumption it made. Nothing is applied until Enter (or Apply); the chips then land in the bar, where they are ordinary, editable filters.

{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/filter-input.json{% endcommand %}

```tsx
import { FilterInput } from '@/components/ui/filter-input'
```

It is its own registry item (and file) so that a plain `filter` install never copies the model.

It is an experiment, and the page says so where it matters. The reading is done by [gpu-query](https://github.com/safzanpirani/gpu-query), a 29,597-parameter tagger that runs in your browser — on the CPU, with no WebGPU needed, sending nothing to a server. It is a feasibility spike: it reads simple filters joined by "and" and misses plenty of ordinary phrasing. The preview exists so you can see what it got wrong before it changes anything.

Try "urgent bugs assigned to bob", "open issues created in the last 3 days", "not done", or "high priority created after jan 5". Check the preview, press Enter, then edit a chip.

{% demo src="filter/natural-language" %}

```tsx
<FilterBar fields={fields} value={filters} onValueChange={setFilters}>
  <FilterInput />
  <FilterToolbar />
</FilterBar>
```

Inside a `FilterBar` it needs nothing else: it reads the fields and applies into the bar. Outside one, pass `fields` and `onApply`. The box is a small [SearchInput](https://blamy.github.io/ui/#/search-input) with a sparkle glyph and no Clear button, beside a small Apply button at the same 32px.

| Prop | Effect |
| --- | --- |
| `fields` | What can be filtered. Default: the enclosing bar's. |
| `onApply(filters, details)` | Called with the understood filters on Enter or Apply, and `details` (`reason: 'apply'`, the key or press as `event`, `cancel()` keeps the phrase in the box). Default: the bar's `apply`. |
| `mode` | With a bar: `merge` (default) replaces the filter of a field the sentence names and adds the rest; `replace` swaps them all. |
| `value` / `defaultValue` / `onValueChange(text, details)` | The sentence. `details` is the Input's: `reason` is `input-change` for typing, `clear-press` for Esc and `imperative` when the box empties after an apply; `cancel()` rejects the change. |
| `placeholder` | Default "Describe what you want…". |
| `description` | The line under the box, which also describes it to a screen reader. Default: a note that the model is experimental and the preview is to be checked. `false` hides it. |
| `parse` | How the phrase is read (`useFilterQuery`'s options): `debounceMs` (default 160), `reference` (the moment relative dates count from), `maxLength` (default 240; the box accepts no more), `enabled`. |
| `aria-label` | Default "Describe the filters you want". |

### What it understands, honestly

- **AND only.** "and" and "or" both just separate clauses, so everything is ANDed. When two values of one single-valued field are named ("urgent or high"), they are read as "any of" — and the preview says so — but there is no other OR. Use the bar's match all / any for that.
- **Simple clauses.** A field, an operator word, a value; or a bare value that only one field owns ("urgent"). Values are matched to your options exactly, then fuzzily (a word of a longer label, a prefix, a plural, a one-letter typo). A value it cannot place is reported, not guessed.
- **What it drops, it says.** A fragment that cannot form a clause is dropped by the model; the preview lists it under "Ignored", and so are words it called filler that are not obviously filler (a "bugs" when no value is called that).
- **Dates and numbers are parsed by this library, not the model**: today, yesterday, this / last week or month, "last 3 days", "3 weeks ago", `2026-01-05`, "jan 5", "5 March 2025"; numbers with `k` / `m`. A negated date comparison is not supported and is reported.
- **Quality.** Measured on a sample issue-tracker schema: **16 of 22** phrases came out exactly right with the model's output and a naive mapping; after the mapping learned to repair what the model got wrong (negation words it tags as `<`, a comparison on a select, several values in one clause, dates it splits) it reached **21 of 22** on those same phrases — which they were tuned against, so that number flatters it. On **32 fresh phrases** written afterwards and run once, it got **26 right (81%)**. The six misses were "at least 8" (read as `>`), "equal to 5" (read as `>`), "title mentions login" (took "mentions" for the value), "title contains crash and priority urgent" (kept "contains" in the text), "bob's open tasks" (a possessive is one token, so Bob is not found) and "urgent bug" (nothing: the singular "bug" is not a value the model flags). The model's own README reports 98.9% on its own generated corpus, which is a different and easier thing; treat 80% as the order of magnitude and always read the preview.
- **English only**, and tuned to short, imperative-ish phrases; the CPU path has no length cap, but the box takes at most 240 characters (`parse.maxLength`).

### Provenance

gpu-query is by Safzan Pirani (MIT, "feasibility spike — nothing is published to npm"). Its runtime is **vendored** into `lib/gpu-query/` with its LICENSE, an attribution header on every file and a README that records the commit (`41739a2`) and what changed: the ~40 KB weights load lazily by dynamic import (an app that never mounts a FilterInput never downloads them), `parse` is async with a synchronous `parseWith`, the compiler also reports the fragments it dropped and where each clause came from, an optional segmentation starts a clause where the model's own boundary score says so, the WebGPU types are local, and the demo's trace code is gone. On the CPU the vendored port reproduces the checkpoint's PyTorch logits on the upstream parity phrases to within quantization noise (tested). The WebGPU path (batches of 32 or more) is kept and unused by the input.

### FilterInput accessibility

- The box is a SearchInput (`searchbox`), named by its `aria-label` and described by its `description`.
- The preview is read out with UI SDK's `announce()` (its one polite live region) as one sentence — "2 filters understood: Priority is Urgent; Assignee is Bob. Ignored: bugs. Press Enter to apply." — and the chips beside it are a visual copy, hidden from assistive technology so it is not read twice.
- Enter while the preview is still catching up only brings it up; a second Enter applies. Esc clears the box, and is left alone when the box is empty, so a popover around it still closes. Applied filters are announced by the bar.

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

Every edit takes an optional last argument, `{ event, source }`, that reaches the change's details (`state.remove(id, { event })` from a click handler), and returns whether it went through: `false` when nothing changed or `details.cancel()` refused it.

Options: `value`, `defaultValue`, `onValueChange`, `match`, `defaultMatch`, `onMatchChange`.

### `useFilterQuery(text, fields, options?)`

The sentence as `Filter[]`: debounced, stale-guarded (an old phrase never overwrites a newer one's result), SSR-safe (nothing runs on the server), the model fetched on first use.

```tsx
const { filters, unresolved, notes, status, pending, refresh } = useFilterQuery(text, fields, { debounceMs: 160, reference: now })
```

| Result | |
| --- | --- |
| `filters` | The `Filter[]` it understood. |
| `unresolved` | `{ text, reason }[]`: fragments and words it could not use, with why. Show them. |
| `notes` | Assumptions it made ("Read “Urgent” and “High” as any of Priority"). |
| `status` | `idle` · `loading` (the model is downloading) · `ready` · `error`. |
| `pending` | The results are for an earlier phrase, or are about to be computed. |
| `refresh()` | Skip the debounce. |

`warmFilterQuery()` fetches the model ahead of the first phrase; `FilterInput` calls it on focus. `interpretQuery(model, text, fields)` is the synchronous core, `buildQuerySchema(fields)` the schema the model is asked about (aliases from labels, ids and `aliases`; enum values from options), `clausesToFilters(clauses, byName, { trace })` the mapping from gpu-query's clauses to filters, and `matchOption` / `parseDateText` the fuzzy option and date matchers.

### `useFilterBar()`

Inside a `FilterBar`, its `fields`, filters, `match`, edits, `announce(message)` (say something politely), `bindChip(el, id)` (UI SDK's `createFocusRecovery` for a chip you render yourself: a chip that leaves with focus hands it to the next chip's same part, else the previous chip's, else the Filter button; `FilterChip` binds itself) and `apply(filters, mode, options?)` (add filters from outside the menu: `merge` replaces a field's filter, `replace` swaps them all). It throws outside a bar; `useOptionalFilterBar()` returns `null` instead.

## Keyboard

| Keys | Effect |
| --- | --- |
| `F` (with `<FilterMenu shortcut="f" />`) | Open the Filter menu. Ignored while you type in a field, and with a modifier held. |
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
- Menus and pickers are UI SDK's: the search field (a `combobox`) keeps DOM focus and the active option is virtual (`aria-activedescendant`); a field's values are a `listbox` with `aria-multiselectable` whose ticked options say so (`aria-selected`); operator and match menus are `menuitemradio`s; focus returns to the button that opened them.
- Additions, edits, removals, Clear all and match changes are announced politely through UI SDK's `announce()` (one live region for the page), in the bar's own document. Each is said once the bar shows it: a controlled consumer that refuses a change (by not passing it back) hears nothing said, and focus stays where it was.
- Option colors are decoration; every option has its label, and counts are text.
- The × on a chip draws a 12px glyph, but its hit area reaches above and below the chip and widens on touch screens (`pointer: coarse`).

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `filterChipVariants`

Defined in `@/components/ui/filter`. Base classes:

```text
box-border inline-flex max-w-full min-w-0 items-stretch rounded-lg text-foreground
```

**`size`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `h-7 text-footnote` |
| `sm` | `h-6 text-caption` |

**`variant`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `bg-secondary shadow-hairline` |
| `preview` | `bg-primary/10 text-foreground shadow-hairline` |

# FilterInput

Describe the filters in a sentence. Type "urgent bugs assigned to bob" and a live preview shows the chips it would create — what it understood, what it dropped, anything it assumed. **Nothing is applied until you press Enter** (or Apply); the chips then land in the [Filter](https://blamy.github.io/ui/#/filter) bar, where they are ordinary filters you can edit or remove.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/filter-input.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { FilterInput } from '@/components/ui/filter-input'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { FilterInput } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

It is an experiment, and the page says so where it matters. The reading is done by [gpu-query](https://github.com/safzanpirani/gpu-query), a 29,597-parameter tagger that runs in your browser — on the CPU, with no WebGPU needed, sending nothing to a server. It is a feasibility spike: it reads simple filters joined by "and" and misses plenty of ordinary phrasing. The preview exists so you can see what it got wrong before it changes anything.

## Describing filters

Try "urgent bugs assigned to bob", "open issues created in the last 3 days", "not done", or "high priority created after jan 5". Check the preview, press Enter, then edit a chip.

{% demo src="filter/natural-language" %}

```tsx
<FilterBar fields={fields} value={filters} onValueChange={setFilters}>
  <FilterInput />
  <FilterToolbar />
</FilterBar>
```

Inside a `FilterBar` it needs nothing else: it reads the fields and applies into the bar. Outside one, pass `fields` and `onApply`.

| Prop | Effect |
| --- | --- |
| `fields` | What can be filtered. Default: the enclosing bar's. |
| `onApply(filters)` | Called with the understood filters on Enter or Apply. Default: the bar's `apply`. |
| `mode` | With a bar: `merge` (default) replaces the filter of a field the sentence names and adds the rest; `replace` swaps them all. |
| `value` / `defaultValue` / `onValueChange` | The sentence. |
| `placeholder` | Default "Describe what you want…". |
| `query` | Options for `useFilterQuery`: `debounce`, `now`, `enabled`, `maxLength`. |

## What it understands, honestly

- **AND only.** "and" and "or" both just separate clauses, so everything is ANDed. When two values of one single-valued field are named ("urgent or high"), they are read as "any of" — and the preview says so — but there is no other OR. Use the bar's match all / any for that.
- **Simple clauses.** A field, an operator word, a value; or a bare value that only one field owns ("urgent"). Values are matched to your options exactly, then fuzzily (a word of a longer label, a prefix, a plural, a one-letter typo). A value it cannot place is reported, not guessed.
- **What it drops, it says.** A fragment that cannot form a clause is dropped by the model; the preview lists it under "Ignored", and so are words it called filler that are not obviously filler (a "bugs" when no value is called that).
- **Dates and numbers are parsed by this library, not the model**: today, yesterday, this / last week or month, "last 3 days", "3 weeks ago", `2026-01-05`, "jan 5", "5 March 2025"; numbers with `k` / `m`. A negated date comparison is not supported and is reported.
- **Quality.** Measured on a sample issue-tracker schema: **16 of 22** phrases came out exactly right with the model's output and a naive mapping; after the mapping learned to repair what the model got wrong (negation words it tags as `<`, a comparison on a select, several values in one clause, dates it splits) it reached **21 of 22** on those same phrases — which they were tuned against, so that number flatters it. On **32 fresh phrases** written afterwards and run once, it got **26 right (81%)**. The six misses were "at least 8" (read as `>`), "equal to 5" (read as `>`), "title mentions login" (took "mentions" for the value), "title contains crash and priority urgent" (kept "contains" in the text), "bob's open tasks" (a possessive is one token, so Bob is not found) and "urgent bug" (nothing: the singular "bug" is not a value the model flags). The model's own README reports 98.9% on its own generated corpus, which is a different and easier thing; treat 80% as the order of magnitude and always read the preview.
- **English only**, and tuned to short, imperative-ish phrases; the CPU path has no length cap but the input is cut at 240 characters.

## Provenance

gpu-query is by Safzan Pirani (MIT, "feasibility spike — nothing is published to npm"). Its runtime is **vendored** into `lib/gpu-query/` with its LICENSE, an attribution header on every file and a README that records the commit (`41739a2`) and what changed: the ~40 KB weights load lazily by dynamic import (an app that never mounts a FilterInput never downloads them), `parse` is async with a synchronous `parseWith`, the compiler also reports the fragments it dropped and where each clause came from, an optional segmentation starts a clause where the model's own boundary score says so, the WebGPU types are local, and the demo's trace code is gone. On the CPU the vendored port reproduces the checkpoint's PyTorch logits on the upstream parity phrases to within quantization noise (tested). The WebGPU path (batches of 32 or more) is kept and unused by the input.

## Hooks

### `useFilterQuery(text, fields, options?)`

The sentence as `Filter[]`: debounced, stale-guarded (an old phrase never overwrites a newer one's result), SSR-safe (nothing runs on the server), the model fetched on first use.

```tsx
const { filters, unresolved, notes, status, pending, refresh } = useFilterQuery(text, fields, { debounce: 160, now })
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

## Accessibility

- The box is a labelled text field described by its hint and the preview.
- The preview is mirrored in a polite live region as one sentence — "2 filters understood: Priority is Urgent; Assignee is Bob. Ignored: bugs. Press Enter to apply." — and the chips beside it are a visual copy, hidden from assistive technology so it is not read twice.
- Enter while the preview is still catching up only brings it up; a second Enter applies. Esc clears the box. Applied filters are announced by the bar.

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `filterInputVariants`

Defined in `@/components/ui/filter-input`. Base classes:

```text
flex min-w-0 flex-col gap-1.5
```

No variants.

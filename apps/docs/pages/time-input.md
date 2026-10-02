# TimeInput

A text field that reads a date, a time or a repeating schedule written in English ("every weekday at 9am", "Sat Sun 1pm-8pm", "3rd friday of the month") and shows what it understood as you type: the words it recognised, the occurrences it resolved in a time zone, a **Repeats** chip for recurrences and the parser's own notes. It is built on [gpu-time](https://www.npmjs.com/package/gpu-time), a small neural parser (about 53 KB gzipped, English only, MIT) that runs on the CPU, or on the GPU for big batches, so the field works with or without WebGPU.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/time-input.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { TimeInput } from '@/components/ui/time-input'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { TimeInput } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## Read this first: it is a model, and it can be wrong

gpu-time is a very small neural network plus a date resolver, not a calendar engine. Its own README says it plainly: *the model can return incorrect dates, even without a diagnostic*, and you should check that a result's dates match the intended schedule before you use it. We have seen it read "at 1930" as the year 1930, and "before 6pm friday" as 6pm itself, with nothing flagged (see **Limits** below).

TimeInput is designed around that. It never shows a bare "OK": it lists the **resolved dates in full**, in the zone you gave it, so the person typing can see a wrong answer. Treat its output as a convenient first draft that a human confirms. Do not schedule, bill or notify from it unreviewed.

## Usage

```tsx
import { TimeInput } from '@brett_lamy/ui'

<TimeInput
  label="When"
  timeZone="Europe/Paris"
  onValueChange={({ text, result, pending }) => {
    if (!pending && result) save(result.occurrences, result.rrules)
  }}
/>
```

Everything is optional. Without `timeZone` the browser's zone is used, and without `reference` "now" is read each time the text is parsed.

{% demo src="time-input/basic" %}

### What the preview shows

- **Recognized.** Your text again, with the parts the parser matched highlighted (from the `spans` offsets it returns). A dotted underline marks a span the model is unsure of. The highlight is drawn in this echo line, not inside the input, so it stays correct whatever the field's font, scroll or wrapping.
- **Repeats.** One chip per RRULE: "Every weekday at 9:00 AM", "Every 2 weeks on Tuesday", "Every month on the first Monday". Simple rules are put into words; anything else shows the raw rule. The raw RFC 5545 rule is the chip's tooltip.
- **Occurrences.** Up to `maxOccurrences` (default 5) dates formatted with `Intl` in the field's zone. A repeating schedule says "and more" when there are further ones.
- **Notes.** The parser's diagnostics, with the words they point at: "Assumed a daytime working-hours range.", "No AM/PM marker; interpreted as a 24-hour clock.", "The model is uncertain about this expression."
- **Nothing found.** "No date or time found in that text." instead of silence.

While a new parse is pending the previous preview stays, dimmed, and the recognised-words line is hidden (its offsets belong to the old text). A visually hidden status line announces the outcome ("3 dates found.") to screen readers.

### Repeating schedules

{% demo src="time-input/recurrence" %}

### Day and month order

An ambiguous numeric date such as "3/4" is month first unless you pass `dateOrder="DMY"`. Named months and year-first dates mean the same either way.

{% demo src="time-input/date-order" %}

### Controlled

`value` makes the field controlled. `onValueChange` is called on every keystroke with `result: null` and `pending: true` (this is the call a controlled `value` follows) and again with the parse once it settles. Read `result` only when `pending` is `false`.

{% demo src="time-input/controlled" %}

## Limits

These are properties of gpu-time 0.5, found by trying it; the model may improve, but check before relying on any of them.

- **Wrong dates, no diagnostic.** "at 1930" resolves to the year 1930. "before 6pm friday" resolves to Friday 6pm, as if it said "at". "tonight" becomes an all-day event today. None of these carry a warning.
- **A small English vocabulary.** English only on npm. Many phrases it cannot read at all: "next friday 5-6pm until december" produced an `unsupported` diagnostic and no dates.
- **Ranges and bounds** are the weakest part: "1-3pm" comes back flagged as low confidence, "from 9 to 5" as an assumed working-hours range.
- **Defaults are opinions.** "Every weekday" with no time is an all-day recurrence, "twice a week" is spread over Monday and Thursday (with a warning), and a bare weekday means the next one. The options `weekStart`, `bareWeekday`, `bareWeekdays`, `nextWeekday` and `dayParts` change those defaults; they pass through to the parser.
- **Recurrences are previews.** Only the next `maxOccurrences` dates are listed; a rule with no end is previewed for up to a year. The RRULE is the authoritative output.

{% demo src="time-input/limits" %}

## CPU, GPU and the WebGPU requirement

gpu-time has two backends and picks one itself (`backend="auto"`, the default): it uses WebGPU only for batches of 32 or more inputs, or 512 or more tokens, and the CPU otherwise. TimeInput parses one line at a time, so in practice it always runs on the CPU, in a few milliseconds, and **needs no WebGPU**. If a GPU run ever fails in `auto` mode the parser falls back to the CPU and reports a `fallbackReason`. `showBackend` adds a "CPU" / "GPU" label to the preview, and every TimeInput carries `data-backend` for tests. Pass `backend="webgpu"` only if you want a hard requirement: it then reports an error where WebGPU is missing.

| Environment | TimeInput |
| --- | --- |
| Browser with WebGPU | Works, on the CPU for single lines. |
| Browser without WebGPU, or an insecure origin | Works, identically. |
| Headless browser or CI | Works, identically. This is what the end-to-end tests rely on. |
| Server rendering | The field renders on the server; parsing starts after hydration. `parseTime` also runs in Node (CPU). |
| `backend="webgpu"` where WebGPU is missing | The field shows an error. |

## Lazy loading, SSR and Next.js

- **Lazy.** gpu-time is a dynamic `import()` inside the first parse, so an app that never mounts a TimeInput never downloads it. The loader is cached; a failed load is retried on the next keystroke. One parser is kept per backend and date order.
- **SSR-safe.** Nothing touches `window` or `navigator` at module scope and the first render is the same on the server and the client: just the field. The preview appears after mount, once the first parse settles. "Now" and the browser's zone are read only inside that parse.
- **Next.js.** The module starts with `'use client'`, so it can be imported from a server component and used as is. The helpers in `lib/gpu-time` (`parseTime`, `formatOccurrence`, `describeRecurrence`) share that client boundary; call gpu-time directly from server code if you need to parse on the server.
- **Zone and locale.** Pass `timeZone` when the text should be read in a zone other than the viewer's (an event in another city). Pass `locale` to format the preview in a locale; the words around the dates ("Every weekday", "Repeats") are English because the parser is.

## Accessibility

The field is a react-aria `TextField`: the label, description and error are linked to the input, and `aria-invalid` is set when it is invalid. The preview is linked to the input with `aria-describedby`, its lists are real lists with names ("Repeats", "Upcoming", "Notes"), diagnostics carry a hidden "Warning:" or "Error:" prefix so severity is not conveyed by color alone, and a polite status line announces the result. Without a visible `label` the field is named "Date or time"; set `aria-label` to change it.

## API

### `<TimeInput>`

| Prop | Default | Effect |
| --- | --- | --- |
| `value` / `defaultValue` | — | The text, controlled or uncontrolled. |
| `onValueChange` | — | `({ text, result, pending, error }) => void`. Called on each keystroke with `result: null, pending: true`, then with the parse when it settles. |
| `onChange` | — | The react-aria `TextField` handler: the new string, on each keystroke. |
| `label`, `description` | — | The field's caption and help text. |
| `isInvalid`, `errorMessage` | — | Force the invalid state with your own message. A parser failure (for example an unknown `timeZone`) also invalidates the field and shows its message. |
| `reference` | now | The instant "tomorrow" is counted from: a `Date`, epoch milliseconds or an ISO string with `Z` or an offset. |
| `timeZone` | the browser's | IANA zone the text is read in and the preview is shown in. |
| `dateOrder` | `MDY` | `MDY` or `DMY`, for ambiguous numeric dates. |
| `backend` | `auto` | `auto`, `cpu` or `webgpu`. |
| `weekStart`, `bareWeekday`, `bareWeekdays`, `nextWeekday`, `dayParts`, `until` | parser defaults | Passed to gpu-time's context; see its README. |
| `maxOccurrences` | `5` | How many occurrences are listed (and parsed: it is the parser's `limit`). |
| `locale` | the browser's | BCP 47 locale of the dates and times in the preview. |
| `showBackend` | `false` | Show a "CPU" or "GPU" badge. |
| `variant` | `card` | `card` puts the preview on a filled panel; `plain` has no surface. |
| `size` | `default` | The text field's size: `sm`, `default` or `lg`. |
| `placeholder` | "e.g. tomorrow at 3pm" | Placeholder text. |
| `debounceMs` | `120` | Wait after typing before parsing. |
| `className`, `style` | — | Merged onto the root (`data-slot="time-input"`). |

The other react-aria `TextField` props (`name`, `isRequired`, `isDisabled`, `autoFocus`, …) pass through. The root carries `data-backend` and `data-pending`; the preview is `data-slot="time-input-preview"`, with `time-input-recognized`, `time-input-repeats`, `time-input-occurrences` and `time-input-diagnostics` inside it.

## Hooks and helpers

The engine is available without the component.

### `useTimeParse(text, options?)`

```tsx
const { result, error, pending, backend, parsedText } = useTimeParse(text, {
  timeZone: 'Europe/Paris',
  reference: '2026-09-09T12:00:00+02:00',
  debounceMs: 120,
})
```

Parses as you type: it **debounces**, **ignores answers that arrive out of order** (a slow answer to old text never overwrites a newer one) and **cancels on unmount**. The options are the `TimeInput` parser props above plus `limit`, `enabled` (default `true`; `false` pauses and clears) and `debounceMs`. Empty text means nothing to parse: no result, not pending.

| Field | Meaning |
| --- | --- |
| `result` | The latest settled `TimeParseResult`: `occurrences`, `rrules`, `spans`, `diagnostics`, `truncated`, `backend`, `timings`. While `pending` it is the answer to the previous text. |
| `parsedText` | The text `result` and `error` belong to. Compare it with your current text before using span offsets. |
| `pending` | `true` from a change of text or options until the parse for it settles. |
| `error` | Why the latest parse failed (an unknown time zone, a bad `reference`, a forced `webgpu` backend without WebGPU), or `null`. Unrecognised text is a result with no occurrences, not an error. |
| `backend` | `'cpu'` or `'webgpu'`, or `null` before the first result. |

{% demo src="time-input/use-time-parse" %}

| Export | Description |
| --- | --- |
| `parseTime(text, options?)` | `Promise<TimeParseResult>`: the same parse without React. Loads gpu-time on first call and keeps one parser per backend and date order. |
| `loadGpuTime()` | The cached `import('gpu-time')` promise; call it to preload while the user is likely to need it. |
| `formatOccurrence(occurrence, { timeZone, locale? })` | One occurrence as text: "Thu, Sep 10, 2026", "Sat, Sep 12, 2026, 1:00 – 8:00 PM", "From Fri, Sep 11, 2026, 6:00 PM". All-day ranges end on the last day included. |
| `describeRecurrence(rrule, { locale?, timeZone? })` | "Every weekday at 9:00 AM"; `null` for rules it cannot say in words. |
| `rruleLine(rrule)` | The `RRULE:…` line of a gpu-time rule, without its `DTSTART`. |
| `timeTextSegments(text, spans)` | Cuts text into `{ text, start, end, matched, confidence? }` pieces along the recognised spans (clamped, sorted and merged). Build your own highlight with it. |

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `timeInputVariants`

Defined in `@/components/ui/time-input`. Base classes:

```text
flex min-w-0 flex-col gap-2 text-footnote
```

**`variant`** — default `card`

| Value | Adds |
| --- | --- |
| `card` (default) | `[&_[data-slot=time-input-preview]]:rounded-panel [&_[data-slot=time-input-preview]]:bg-secondary [&_[data-slot=time-input-preview]]:p-3` |
| `plain` | `[&_[data-slot=time-input-preview]]:px-1` |

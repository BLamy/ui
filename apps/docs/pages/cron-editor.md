# CronEditor

Edit a 5-field cron expression with its meaning in view. Where the browser has WebGPU, the editor is a plain-English box ("every weekday at 9am") and the next runs: [gpu-cron](https://github.com/jlsajfj/gpu-cron), a tiny on-device model, turns the text into an expression on every keystroke, and that is the value. Everywhere else (and with `naturalLanguage={false}`) it is the raw expression: a plain text field with each of its five fields (minute, hour, day of month, month, day of week) labelled and checked on its own, an English description, preset chips and the next runs in any time zone, all computed locally.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/cron-editor.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { CronEditor } from '@/components/ui/cron-editor'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { CronEditor } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## Usage

The value is the expression, a string of five space-separated fields.

```tsx
import { CronEditor } from '@brett_lamy/ui'

const [cron, setCron] = useState('0 9 * * 1-5')

<CronEditor value={cron} onValueChange={setCron} timeZone="Europe/Paris" />
```

{% demo src="cron-editor/basic" %}

Where WebGPU works there are two parts:

1. **Describe the schedule.** Type English. Each answer the model gives for what the box says now becomes the value (`onValueChange`), as you type; an answer for older text never lands late.
2. **Next runs**: the next five times the value runs, in a time zone, with the zone named under the list. They are how you check the model's reading. See the section below.

Without WebGPU the box is replaced by a note, and the editor is the raw expression, top to bottom:

1. **The expression.** A monospace text field. Under it, the five fields are shown one per cell with their names, and the cell the caret is in is outlined. A field that is wrong is outlined in the error color, and the error text names it ("Minute: 60 is out of range (0–59)"). An empty field gets a prompt, not an error.
2. **A description**, in English, from [cronstrue](https://github.com/bradymholt/cRonstrue) (loaded on first use): "At 09:00 AM, Monday through Friday".
3. **Presets**, as toggle chips; the one that equals the current expression is pressed.
4. **Next runs**, as above.

### Raw only, and your own presets

`naturalLanguage={false}` never loads gpu-cron or asks for WebGPU. `presets` takes your own chips (or `false` for none), and `variant="plain"` drops the filled panels.

{% demo src="cron-editor/raw-only" %}

## The plain-English box, and why you must check it

The model (45,376 parameters, 89 KB, MIT) turns text into a cron expression by constrained decoding: the output is **always syntactically valid** cron. It is **not** always the schedule you meant, and it has **no way to say it did not understand**. Gibberish gets a confident, valid, meaningless expression back. gpu-cron's own tests put its semantic accuracy at 83 to 87 percent on held-out phrasings, and sub-minute requests ("every 30 seconds") and end-of-month requests ("the last day of the month") are known to come out wrong, because standard 5-field cron cannot say them.

So the answer is never out of sight: CronEditor applies it as you type, and the next runs right under the box show what it actually means — "every tuesday at 10pm" reads *Tue, Oct 6, 2026, 10:00 PM*, a misreading reads wrong at a glance. Show the value as well when it matters (the demo prints it under the editor). If you build your own UI on `useCronParse`, do the same: always show what the decoded expression does next to what the person typed.

Other facts about it:

- **5 fields only.** No `@daily` macros, `L`, `W`, `#`, `?` or names in what the model writes; Sunday is 0. (The raw field and the local calculator also accept names and macros.)
- **Its `next` times are in the machine's local zone** and the package has no option to change that. CronEditor ignores them and computes the runs itself with `nextCronRuns`, so the list follows `timeZone`.
- **One call at a time.** The package serialises calls, so one call per keystroke is safe. CronEditor asks on every keystroke (`debounceMs` 0); the hook's own default is 150 ms.
- **Long text is refused** (the model has a fixed context); the box shows "That description is too long".

## WebGPU: when the box is there

gpu-cron runs only on WebGPU. There is no CPU fallback. CronEditor therefore asks first, and what you see depends on the environment:

| Environment | Plain-English box | Raw expression, description, presets, next runs |
| --- | --- | --- |
| Browser with WebGPU and an adapter | Offered. gpu-cron (89 KB) loads when the editor mounts. | Works. |
| Browser without WebGPU (no `navigator.gpu`) | Hidden, with a note: "Describing a schedule in words needs WebGPU, which this browser does not offer." gpu-cron is never downloaded. | Works. |
| WebGPU present, no adapter (some VMs and blocklisted GPUs) | Hidden, with the same note. | Works. |
| Insecure origin (plain `http://` that is not localhost) | Hidden, with the same note: browsers do not expose WebGPU there. | Works. |
| Headless browser or CI | Offered if the browser can create an adapter (a software one is enough, though slower), else hidden. | Works. |
| Server rendering | The box is not rendered on the server and is decided after mount; no gpu-cron code runs. | The fields and description are rendered; the next runs appear after mount (they depend on the clock). |
| `naturalLanguage={false}` | Never offered; nothing is loaded. | Works. |

While the check runs (only in a browser that has `navigator.gpu`) the box is shown disabled with "Checking for WebGPU…". A browser without it is known immediately.

## The raw expression

The grammar is the portable subset every cron accepts:

| Field | Allowed |
| --- | --- |
| minute | 0–59 |
| hour | 0–23 |
| day of month | 1–31 |
| month | 1–12, or `jan`–`dec` |
| day of week | 0–7 (0 and 7 are Sunday), or `sun`–`sat` |

Each field is a comma list of `*`, a number, a range `a-b`, and `*` or a range followed by `/step`: `*/15`, `9-17/2`, `1,15`, `mon-fri`. The macros `@hourly`, `@daily` (`@midnight`), `@weekly`, `@monthly` and `@yearly` (`@annually`) expand to their five fields. `L`, `W`, `#`, `?` and a seconds or years field are not supported, and a step on a bare number (`5/15`) is rejected because crons disagree about it; write `5-59/15`.

When **both** day of month and day of week are restricted a day matches if **either** does, as POSIX and Vixie cron define it: `0 0 13 * 5` runs on every 13th and on every Friday. If either field starts with `*` (including `*/2`) the other alone decides, so `0 0 */2 * 5` is Fridays on odd days only.

## Next runs and time zones

`nextCronRuns` reads the expression in an IANA zone, using `Intl` for the zone's rules, so nothing is bundled. It is exact across daylight saving changes:

- A fixed-time job whose time **does not exist** (02:30 on the day clocks jump from 02:00 to 03:00) runs just after the gap, at 03:30.
- A job that **follows the clock** (the minute or hour field starts with `*`: `*/30 1-3 * * *`) simply has no 02:xx that day, and an hourly job stays hourly.
- A fixed-time job whose time happens **twice** (clocks fall back) runs once, at the first pass; a clock-following job runs on both.

{% demo src="cron-editor/daylight-saving" %}

Without `timeZone` the device's zone is used and the list says so. The runs count from "now", read after mount so the server and client HTML match, and refreshed every 30 seconds; pass `from` to pin the moment (the demos on this page do, so they read the same for everyone). An unknown zone is reported in place of the list. Expressions that never match a real date (`0 0 30 2 *`) say so; the search looks about eight years ahead, enough to find the next 29 February.

## SSR and Next.js

The module starts with `'use client'`. On the server it renders the labelled field, the five cells and the description area; the natural-language box, the description text and the next runs all arrive after mount, so the server and client HTML match. gpu-cron and cronstrue are dynamic imports and load only in the browser, when needed. `lib/cron` (validation, `nextCronRuns`, `describeCron`) has no React and no `'use client'`: it runs in server components and Node as well.

## Accessibility

The expression and the plain-English box are react-aria text fields with linked labels, descriptions and errors; `aria-invalid` follows the validation, and the error text lists every problem. The five-field breakdown is a description list (name and value pairs). Presets are toggle buttons that report their pressed state. Next runs is a list of `<time>` elements. The model's answer is dimmed and marked busy while a newer one is pending. Colors are never the only signal: invalid fields also carry error text.

## API

### `<CronEditor>`

| Prop | Default | Effect |
| --- | --- | --- |
| `value` / `defaultValue` | — | The expression, controlled or uncontrolled. |
| `onValueChange` | — | `(expression: string) => void`, on every edit, preset press and every answer of the plain-English box. |
| `label` | "Cron expression" | Label of the expression field. |
| `description` | "Five fields, separated by spaces." | Help text under it. |
| `name` | — | Form field name of the expression. |
| `timeZone` | the device's | IANA zone for "Next runs". |
| `from` | now | The moment the runs count from. A `Date`, epoch milliseconds or an ISO string. |
| `nextRunCount` | `5` | How many runs to list. |
| `presets` | `CRON_PRESETS` | `{ label, value }[]`, or `false`. |
| `naturalLanguage` | `true` | `false` never loads gpu-cron. |
| `naturalLanguageLabel` | "Describe the schedule" | Label of the plain-English box. |
| `locale` | the browser's | BCP 47 locale of the run times. |
| `debounceMs` | `0` | Wait after typing before asking the model (0: every keystroke). |
| `variant` | `card` | `card` puts the model's answer and the next runs on filled panels; `plain` has no surface. |
| `isDisabled` | `false` | Disables the fields and chips. |
| `className`, `style` | — | Merged onto the root (`data-slot="cron-editor"`). Other div props pass through. |

Parts carry `data-slot`s for tests and styling: `cron-editor-natural`, `cron-editor-note`, `cron-editor-fields` (each cell has `data-field`, and `data-active` / `data-invalid`), `cron-editor-description`, `cron-editor-presets` and `cron-editor-next`.

## Hooks and helpers

### `useCronParse(text, options?)`

```tsx
const { result, error, pending, supported, parsedText } = useCronParse(text, { debounceMs: 150, count: 5 })
```

Checks for WebGPU, then parses as you type. It **debounces**, **ignores answers that arrive out of order**, **cancels on unmount** and never parses where the model cannot run. `supported` is `null` until the check settles (and while `enabled` is `false`), then `true` or `false`: with no `navigator.gpu` it is `false` at once and gpu-cron is never downloaded. `result` is `{ expression, next }` (`next` are ISO times in the machine's zone) and, like the time hook's, belongs to `parsedText` while `pending`. Empty text means nothing to parse.

{% demo src="cron-editor/use-cron-parse" %}

| Export | Description |
| --- | --- |
| `parseCronText(text, { count? })` | `Promise<{ expression, next }>`; loads gpu-cron on first call. Rejects without WebGPU or for text that is too long. |
| `gpuCronAvailable()` | Cached `Promise<boolean>`. `false`, without loading the package, when there is no `navigator.gpu`; otherwise loads gpu-cron and asks it (which also uploads the weights, so the first parse is warm). |
| `describeCronError(error)` | A short message for an error from the model. |
| `validateCron(expression)` | `{ valid, parts, fields, message }`: an error string (or `null`) for each of the five fields, and a `message` when there are not exactly five. |
| `cronProblems(validation)` | The same problems as a list of `{ field, message }`, whole-expression one first. |
| `nextCronRuns(expression, { from?, count?, timeZone?, horizonDays? })` | The next runs as `Date[]`; `[]` for an invalid expression or one that never matches. Throws `RangeError` for an unknown zone. |
| `describeCron(expression, { use24HourTime? })` | `Promise<string \| null>`: the English description (cronstrue, loaded on first call); `null` when the expression is invalid. |
| `splitCron(expression)` | The whitespace-separated parts, with a macro expanded. |
| `CRON_FIELDS` | The five fields with their labels and ranges. |
| `CRON_PRESETS` | The default preset chips. |

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `cronEditorVariants`

Defined in `@/components/ui/cron-editor`. Base classes:

```text
flex min-w-0 flex-col gap-3 text-footnote
```

**`variant`** — default `card`

| Value | Adds |
| --- | --- |
| `card` (default) | `[&_[data-surface]]:rounded-panel [&_[data-surface]]:bg-secondary [&_[data-surface]]:p-3` |
| `plain` | `[&_[data-surface]]:px-1` |

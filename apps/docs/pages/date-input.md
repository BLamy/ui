# DateInput

A date, or a time, typed into segments: month, day and year (or hour, minute and AM/PM) are each their own small input in one field. `DateInput` and `TimeInput` are UI SDK's Date Input and Time Input in the iOS filled-field style. Use them when people know the value and typing is faster than hunting through a grid (a birthday, an alarm, a start time); add a calendar button with [DatePicker](https://blamy.github.io/ui/#/date-picker), or show the month on its own with [Calendar](https://blamy.github.io/ui/#/calendar). To read a date out of free text ("every weekday at 9am"), see [NaturalTimeInput](https://blamy.github.io/ui/#/natural-time-input).

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/date-input.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { DateInput, TimeInput } from '@/components/ui/date-input'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { DateInput, TimeInput } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

`DateInputSegment`, `TimeInputSegment`, `createDateInputController` and `createTimeInputController` come from the same module (`@/components/ui/date-input`, or the package root).

## Values are ISO strings

The value is a string, the one a native input submits: `"2026-09-09"` for a day, `"2026-09-09T09:30"` for a `DateInput` with a time `granularity` (a local date and time, no zone), and `"09:30"` (or `"09:30:15"` with seconds) for a `TimeInput`, always on the 24-hour clock whatever the field shows. It is `null` until every segment is filled, so `onValueChange` is never called with half a date. No date library is needed; `@ui-sdk/core/date` (installed with the field) has `todayDate()`, `addDays`, `weekday`, `formatDate` and `toISODate` when you need arithmetic or a label. Dates are Gregorian and carry no time zone.

## Anatomy

A `DateInput` is the row of segments. Put it in a [Field](https://blamy.github.io/ui/#/field) with a `FieldLabel`, and any `FieldDescription` and `FieldError`: the label names the group and a press on it focuses the first segment.

```tsx
<Field>
  <FieldLabel>Birthday</FieldLabel>
  <DateInput defaultValue="2026-09-09" />
  <FieldDescription>Month, day, then year.</FieldDescription>
  <FieldError />
</Field>
```

`TimeInput` is the same shape. Without a visible label, give the field an `aria-label`.

## Typing, locale and sizes

Click a segment (or Tab into the field) and type digits: a segment moves on by itself once the next digit could not fit, so "09092026" fills a US date, and typing a separator moves on too. The day stays within its month. A whole date can be pasted into any segment, as `2026-09-09` or the way the locale writes it. `locale` decides the order, the separators and the clock (a `de-DE` field is day.month.year); leave it out and the field follows the page's language once it has mounted, as the demos would if they did not pin `en-US`. The digits are always 0 to 9. `size` is `sm` (32px), `default` (44px) or `lg` (50px). `disabled` dims the field and takes it out of the tab order and its form; `readOnly` keeps it focusable and submitted, but locked.

{% demo src="date-input/basic" %}

## Times and date-times

`TimeInput` edits a time of day, and `granularity` (`hour`, `minute`, `second`) sets how fine it goes. A `DateInput` whose `granularity` is `hour`, `minute` or `second` edits a date and a time. The locale picks a 12- or 24-hour clock; `hourCycle={12}` or `{24}` overrides it. In the AM/PM segment, A and P pick one.

{% demo src="date-input/time" %}

## Validation

`min` and `max` bound the value and `unavailable` rules out days (the same matchers as [Calendar](https://blamy.github.io/ui/#/calendar): dates, `{ from, to }`, `{ weekday: [0, 6] }`, a function). A value that breaks them marks the field `data-invalid` at once, turning its outline red, and blocks its form. `required` blocks an empty field, and a half-typed date blocks the form too. The message appears in a `FieldError` after a submit attempt, and the first invalid field takes focus: leave the error empty for the browser's message, or give it `match="valueMissing"` and your own text. For a rule of your own, pass `invalid` to the Field: its `FieldError` then shows straight away.

{% demo src="date-input/validation" %}

Give the Field (or the `DateInput`) a `name` and a hidden input submits the ISO value with the form; an empty or half-typed field submits an empty string. A form reset restores `defaultValue`.

## From outside

`createDateInputController()` (and `createTimeInputController()`) returns a controller to pass as `controller`: `setValue`, `clear`, `getValue` and `focus('year')`, which focuses a segment by its unit.

## Custom segments

Pass a function as children to render the segments yourself. It receives the field's state, whose `segments` list every part in order with the text between them; render a `DateInputSegment` for each, and give the text between segments children of your own.

```tsx
<DateInput defaultValue="2026-09-09">
  {({ segments }) =>
    segments.map((segment) =>
      segment.editable
        ? <DateInputSegment key={segment.key} segment={segment} />
        : <DateInputSegment key={segment.key} segment={segment}>–</DateInputSegment>,
    )
  }
</DateInput>
```

## Accessibility

The field is a `group` named by its label, and each segment is a `spinbutton` named by its unit ("month", "day", "year", "hour", "AM/PM") with its current value and range. An empty segment reads as "Empty". The text between segments is hidden from assistive technology. Segments are real inputs, so phones show a number pad.

| Key | Action |
| --- | --- |
| Digits | Fill the focused segment; it moves on when full. In the AM/PM segment, A or P picks one. |
| Arrow Up / Down | Step the segment by one, wrapping within it. An empty segment starts at today. |
| Page Up / Page Down | Step by more: a year by 5, a month by 3, a day by 7, minutes by 15. |
| Home / End | Smallest / largest value for the segment. |
| Arrow Left / Right | Previous / next segment. |
| Tab / Shift + Tab | Next / previous segment, then out of the field. |
| Backspace | Remove the last digit, then empty the segment, then move back. |
| Delete | Empty the segment. |
| Enter | Submit the form. |

Give the field a visible `FieldLabel`, or an `aria-label`. Put `FieldDescription` and `FieldError` in the same Field so they are announced with it.

## Props

### DateInput and TimeInput

The roots are UI SDK's `DateInput` and `TimeInput`; every prop passes through, with `className` (a string or a function of the state) merged after the variant classes.

| Prop | Default | Effect |
| --- | --- | --- |
| `value` / `defaultValue` / `onValueChange` | — | The ISO string, `null` while a segment is empty. The callback gets `(value, details)`; `details.reason` is `input-change`, `step-key`, `paste`, `reset`… |
| `granularity` | `day` (`minute` for a `TimeInput`) | The finest segment shown: `day`, `hour`, `minute`, `second` (a `TimeInput` takes `hour`, `minute`, `second`). |
| `hourCycle` | the locale's | `12` or `24`. |
| `min` / `max` | — | Bounds, in the value's own form. |
| `unavailable` | — | `DateInput` only: days that cannot be chosen. |
| `locale` | the page's | Language whose order, separators and clock it shows. |
| `required` / `disabled` / `readOnly` | `false` | State. |
| `name` / `form` | — | Name of the hidden input (and the id of a form elsewhere on the page). |
| `controller` | — | From `createDateInputController()` / `createTimeInputController()`. |
| `variant` | `field` | `field` the kit's filled field · `bare` just the segments, for a field you draw yourself around them. |
| `size` | `default` | `sm` 32px · `default` 44px · `lg` 50px. |
| `aria-label` | — | The field's name when there is no `FieldLabel`. |
| `children` | the segments | A function of the state, to render `state.segments` yourself. |

### DateInputSegment and TimeInputSegment

| Prop | Default | Effect |
| --- | --- | --- |
| `segment` | — | The segment it shows, from the root's `segments`. |
| `children` | the segment's text | For the text between segments only: your own separator. |
| `className` | — | Merged onto the segment (an `<input>` for a part you type in, a `<span>` for the text between). |

## Styling

Slots: `date-input` and `date-input-segment` for a `DateInput`, `time-input` and `time-input-segment` for a `TimeInput` (UI SDK's names for the parts). The root carries `data-invalid`, `data-disabled`, `data-readonly`, `data-required` and `data-empty`, and is the kit's filled field (`fieldSurfaceVariants` from [Input](https://blamy.github.io/ui/#/input), the box every text-shaped control shares): a 1.5px primary edge while any segment has focus (`focus-within`) and a destructive one when invalid. A segment carries `data-type` (`month`, `day`, `year`, `hour`, `minute`, `second`, `dayPeriod`, `literal`) and `data-empty`; the focused one is filled with the tint (`:focus`), and an empty one shows dimmed dashes (its placeholder). Inside a [ThemeScope](https://blamy.github.io/ui/#/theming) the field follows the scope.

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `dateInputVariants`

Defined in `@/components/ui/date-input`. Base classes:

```text
flex min-w-0 items-center text-foreground tabular-nums [font-family:inherit] whitespace-nowrap
```

**`variant`** — default `field`

| Value | Adds |
| --- | --- |
| `field` (default) | `w-full` |
| `bare` | `flex-1` |

**`size`** — default `default`

| Value | Adds |
| --- | --- |
| `sm` | `text-subhead` |
| `default` (default) | `text-body` |
| `lg` | `text-body` |

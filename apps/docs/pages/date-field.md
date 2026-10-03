# DateField

A date, or a time, typed into segments: month, day and year (or hour, minute and day period) are each their own small editable part of one field. They are react-aria's `DateField` and `TimeField` in the iOS filled-field style. Use them when people know the value and typing is faster than hunting through a grid (a birthday, an alarm, a start time); add a calendar button with [DatePicker](https://blamy.github.io/ui/#/date-picker), or show the month on its own with [Calendar](https://blamy.github.io/ui/#/calendar). To read a date out of free text ("every weekday at 9am"), see [TimeInput](https://blamy.github.io/ui/#/time-input).

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/date-field.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import {
  DateField, TimeField, DateInput,
} from '@/components/ui/date-field'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { DateField, TimeField, DateInput } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## Values come from @internationalized/date

The value is a `DateValue` from `@internationalized/date`, not a `Date`: a `CalendarDate` for a day (`parseDate('2026-09-09')`), a `CalendarDateTime` for a day and a time (`parseDateTime('2026-09-09T09:30')`), a `ZonedDateTime` when it must carry a time zone, and a `Time` (`new Time(9, 30)`) for a `TimeField`. The shadcn registry item installs `@internationalized/date` as an npm dependency; with the npm package it is already one. The field is empty (`null`) until every segment is filled, so `onChange` is not called with half a date.

Besides the parts above, `TimeField` and `DateSegment` come from the same module (`@/components/ui/date-field`, or the package root).

## Anatomy

A `DateField` is a column holding a label, the `DateInput` (the row of segments) and any help or error text; react-aria wires them together. The input renders a `DateSegment` per part for you.

```tsx
<DateField defaultValue={parseDate('2026-09-09')}>
  <Label variant="field">Birthday</Label>
  <DateInput />
  <FieldDescription>Month, day, then year.</FieldDescription>
  <FieldError />
</DateField>
```

`TimeField` is the same shape. Import `Label` from [Label](https://blamy.github.io/ui/#/label), and `FieldDescription` and `FieldError` from [TextField](https://blamy.github.io/ui/#/text-field).

## Typing, locale and sizes

Click a segment (or Tab into the field) and type digits: a segment moves on by itself once the next digit could not fit, so "09092026" fills a US date. The locale decides the order, the separators and the numerals (a `de-DE` visitor sees day.month.year); set it for a subtree with react-aria's `I18nProvider`, as the demos do to read the same for everyone. `DateInput` takes `size` (`sm` 32px, `default` 44px, `lg` 50px). `placeholderValue` sets what the empty segments show and what the arrow keys start from; `isDisabled` dims the field and `isReadOnly` keeps it selectable but locked.

{% demo src="date-field/basic" %}

## Times and date-times

`TimeField` edits a time of day and `granularity` (`hour`, `minute`, `second`) sets how fine it goes. A `DateField` whose `granularity` is `hour`, `minute` or `second` edits a date and a time. The locale picks a 12- or 24-hour clock; `hourCycle={12}` or `{24}` overrides it. `shouldForceLeadingZeros` pads single-digit parts, and `hideTimeZone` hides the zone of a `ZonedDateTime`.

{% demo src="date-field/time" %}

## Validation

`minValue` and `maxValue` bound the value, `isDateUnavailable` rules out single days, `isRequired` blocks an empty field, and `validate` is your own function returning a message (or `null`). With `validationBehavior="aria"` the field is marked `data-invalid` as the value changes and a `FieldError` inside it shows the message; with the default `native` the errors appear when the surrounding [Form](https://blamy.github.io/ui/#/form) is submitted (give the field a `name`, and it submits its ISO value). An invalid field turns its outline and its segments red.

{% demo src="date-field/validation" %}

## Accessibility

The field is a `group` named by its label, and each segment is a `spinbutton` with its own name ("month", "day", "year"), current value and range, so screen readers read "September, month, spin button". A hidden native input carries the ISO value for forms and autofill. Empty segments show a placeholder and expose it to assistive technology as empty.

| Key | Action |
| --- | --- |
| Digits | Type into the focused segment; it advances when full. In the AM/PM segment, the first letter of AM or PM picks it. |
| Arrow Up / Down | Increment / decrement the segment, wrapping within it. |
| Page Up / Page Down | Increment / decrement by a larger step. |
| Home / End | Smallest / largest value for the segment. |
| Arrow Left / Right | Previous / next segment. |
| Tab / Shift + Tab | Next / previous segment, then out of the field. |
| Backspace / Delete | Clear the segment's last digit; an emptied segment clears the value. |

Give the field a visible `Label`, or an `aria-label`. Put `FieldDescription` and `FieldError` inside the field so they are announced with it.

## Props

### DateField and TimeField

The roots are react-aria's `DateField` and `TimeField`; every prop passes through, with `className` (a string or a function) merged onto `group flex flex-col gap-1.5`.

| Prop | Default | Effect |
| --- | --- | --- |
| `value` / `defaultValue` / `onChange` | — | The `DateValue` (a `TimeValue` for `TimeField`); `null` while a segment is empty. |
| `granularity` | `day` (`minute` for a time value) | The finest segment shown: `day`, `hour`, `minute`, `second` (a `TimeField` takes `hour`, `minute`, `second`). |
| `hourCycle` | locale's | `12` or `24`. |
| `minValue` / `maxValue` | — | Bounds. |
| `isDateUnavailable` | — | `DateField` only: `(date) => boolean`. |
| `placeholderValue` | today | What empty segments show and where stepping starts. |
| `isRequired` / `isDisabled` / `isReadOnly` / `isInvalid` | `false` | State. |
| `validate` / `validationBehavior` | `native` | Custom validation, and when its errors show (`native` on submit, `aria` live). |
| `name` | — | Form field name of the hidden input (ISO string). |
| `shouldForceLeadingZeros` / `hideTimeZone` | `false` | Formatting. |
| `autoFocus` | `false` | Focus the first segment on mount. |
| `aria-label` | — | The field's name when there is no `Label`. |

### DateInput and DateSegment

| Prop | Default | Effect |
| --- | --- | --- |
| `variant` | `field` | `field` the filled iOS field · `bare` just the segments, for a field you draw yourself around them (DatePickerField does this). |
| `size` | `default` | `sm` 32px · `default` 44px · `lg` 50px. |
| `slot` | — | `start` / `end` inside a range picker. |
| `className` | — | Merged onto the input row (`data-slot="date-input"`). |

`DateInput` renders a `DateSegment` for each part; to restyle a segment, edit `DateSegment` in your copy. A segment carries `data-type` (`month`, `day`, `year`, `hour`, `minute`, `second`, `dayPeriod`, `literal`), `data-placeholder`, `data-focused`, `data-invalid` and `data-disabled`.

## Styling

Slots: `date-field`, `time-field`, `date-input`, `date-segment`. The input row shows a primary ring while any segment has focus (`data-focus-within`) and a destructive ring when invalid; the focused segment is filled with the tint, and empty segments are dimmed to their name ("mm", "dd", "yyyy"). Inside a [ThemeScope](https://blamy.github.io/ui/#/theming) the field follows the scope.

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `dateInputVariants`

Defined in `@/components/ui/date-field`. Base classes:

```text
flex min-w-0 items-center text-foreground [font-family:inherit] whitespace-nowrap
```

**`variant`** — default `field`

| Value | Adds |
| --- | --- |
| `field` (default) | `[ 'box-border w-full rounded-ctl bg-input px-3 outline-none transition-[box-shadow,background-color] duration-spring-snappy ease-spring-snappy', …` |
| `bare` | `flex-1` |

**`size`** — default `default`

| Value | Adds |
| --- | --- |
| `sm` | `text-subhead` |
| `default` (default) | `text-body` |
| `lg` | `text-body` |

3 compound variants — see the source.

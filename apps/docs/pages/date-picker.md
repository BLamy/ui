# DatePicker

A date field with a calendar button: the segments of a [DateField](https://blamy.github.io/ui/#/date-field) at the start, a button at the end that opens a [Calendar](https://blamy.github.io/ui/#/calendar) in a [Popover](https://blamy.github.io/ui/#/popover). `DateRangePicker` does the same for a start and an end. They are react-aria's `DatePicker` and `DateRangePicker`, in the iOS filled-field style, and the API is compound: the field and the popover are parts you place yourself. Use a picker when a date is one field in a form and typing or picking are both fine; use the calendar on its own when it is the whole screen, and a bare DateField when a popover is not wanted.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/date-picker.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import {
  DatePicker, DatePickerField, DatePickerContent, DateRangePicker,
  DateRangePickerField, DateRangePickerContent,
} from '@/components/ui/date-picker'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import {
  DatePicker, DatePickerField, DatePickerContent, DateRangePicker,
  DateRangePickerField, DateRangePickerContent,
} from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## Values come from @internationalized/date

The value is a `DateValue` from `@internationalized/date`: a `CalendarDate` for a day (`parseDate('2026-09-09')`), a `CalendarDateTime` for a day and a time (`parseDateTime('2026-09-09T09:30')`), or a `ZonedDateTime`. A range is `{ start, end }`. The shadcn registry item installs `@internationalized/date` as an npm dependency; with the npm package it is already one. Typing into the segments and picking in the calendar edit the same value.

The parts not in the import line above, `DateRangePicker`, `DateRangePickerField` and `DateRangePickerContent`, come from the same module (`@/components/ui/date-picker`, or the package root).

## Anatomy

A `DatePicker` is a column holding a label, the field, the help or error text and, anywhere inside it, the popover. The popover is portalled, so it can sit next to the field in the source.

```tsx
<DatePicker defaultValue={parseDate('2026-09-09')}>
  <Label variant="field">Date</Label>
  <DatePickerField />
  <FieldDescription>Type a date, or open the calendar.</FieldDescription>
  <FieldError />
  <DatePickerContent />
</DatePicker>
```

```tsx
<DateRangePicker>
  <Label variant="field">Stay</Label>
  <DateRangePickerField />
  <DateRangePickerContent calendarProps={{ visibleMonths: 2 }} />
</DateRangePicker>
```

`DatePickerField` is the filled field: the date's segments and the calendar button. `DatePickerContent` is the popover holding a `Calendar`; pass `calendarProps` (`visibleMonths`, `defaultFocusedValue`, `variant`…) to configure it, or children to replace it. `DateRangePickerField` has a start and an end input with a dash between; its content holds a `RangeCalendar`.

## Picking a day

Choosing a day sets the value and closes the popover; Esc closes it without a change and focus returns to the calendar button. With no value the popover opens on today's month, so pass `calendarProps={{ defaultFocusedValue }}` to open somewhere else (the demos pin September 2026). `DatePickerField` takes `size` (`sm`, `default`, `lg`). The popover is portalled, so in a themed area wrap the demo in a [ThemeScope](https://blamy.github.io/ui/#/theming) (or put `BLProvider` at your root) for it to wear the same theme.

{% demo src="date-picker/basic" %}

## Ranges

`DateRangePicker` holds `{ start, end }`. The popover shows a `RangeCalendar`; it closes once the second end is chosen. Editing either input updates the calendar and the other way round. `allowsNonContiguousRanges` lets a range cross unavailable days, and `startName` and `endName` name the two hidden form inputs.

{% demo src="date-picker/range" %}

## Date and time

`granularity="minute"` (or `hour`, `second`) adds the time segments to the field and makes the value a `CalendarDateTime`. The popover has no time control, so the time is edited in the field: picking a day in the calendar keeps a time that is already there, and with none it commits the day at midnight (or at the time of `placeholderValue`). `hourCycle` and `hideTimeZone` work as on a [DateField](https://blamy.github.io/ui/#/date-field).

{% demo src="date-picker/with-time" %}

## In a form

A `name` on a `DatePicker` (or `startName` and `endName` on a range picker) submits ISO strings in `FormData`. `isRequired`, `minValue`, `maxValue` and `isDateUnavailable` are validated against the browser's constraints on submit by default, and a `FieldError` inside the picker shows the message and takes focus. Use `validationBehavior="aria"` to validate as the value changes. See [Form](https://blamy.github.io/ui/#/form) for the submit handling.

{% demo src="date-picker/form" %}

## Accessibility

The picker is a `group` named by its label. The segments are spin buttons exactly as in a [DateField](https://blamy.github.io/ui/#/date-field) (digits, Up and Down, Page Up and Page Down, Home and End, Left and Right between segments). The calendar button is labelled "Open calendar" (fixed English text in `DatePickerField`; edit it in your copy to localize it); it has `aria-haspopup="dialog"` and `aria-expanded`, and Enter, Space or a press opens a dialog named by the field's label. Inside, focus is in the calendar with the keys listed under [Calendar](https://blamy.github.io/ui/#/calendar): arrows, Page Up and Page Down, Home and End, Enter to choose. Esc or an outside press closes the popover and returns focus to the button; Tab stays inside while it is open.

## Props

### DatePicker and DateRangePicker

The roots are react-aria's `DatePicker` and `DateRangePicker`; every prop passes through, with `className` merged onto `group flex flex-col gap-1.5`.

| Prop | Default | Effect |
| --- | --- | --- |
| `value` / `defaultValue` / `onChange` | — | The `DateValue` (a `{ start, end }` range for `DateRangePicker`); `null` while incomplete. |
| `granularity` | `day` | `day`, `hour`, `minute`, `second`: how fine the field is (and its value type). |
| `hourCycle` / `shouldForceLeadingZeros` / `hideTimeZone` | locale's | Formatting of the segments. |
| `minValue` / `maxValue` / `isDateUnavailable` | — | Bounds and unavailable days (also given to the calendar). |
| `isRequired` / `isDisabled` / `isReadOnly` / `isInvalid` | `false` | State. |
| `isOpen` / `defaultOpen` / `onOpenChange` | closed | Control the popover. |
| `shouldCloseOnSelect` | `true` | Close the popover when a day is chosen. |
| `name` | — | Form field name (`startName` / `endName` for a range). |
| `validate` / `validationBehavior` | `native` | Custom validation, and when its errors show. |
| `placeholderValue` | today | What empty segments show. |
| `allowsNonContiguousRanges` | `false` | `DateRangePicker` only. |
| `aria-label` | — | The picker's name when there is no `Label`. |

### DatePickerField and DateRangePickerField

| Prop | Default | Effect |
| --- | --- | --- |
| `size` | `default` | `sm` 32px · `default` 44px · `lg` 50px. |
| `className` | — | Merged onto the field (`data-slot="date-picker-field"`, `date-range-picker-field`). |

The field takes no other props: the segments and the calendar button are fixed. To change them, compose a `Group`, a `DateInput variant="bare"` and a `Button` yourself, as `DatePickerField` does in your copy.

### DatePickerContent and DateRangePickerContent

| Prop | Default | Effect |
| --- | --- | --- |
| `calendarProps` | — | Props for the `Calendar` / `RangeCalendar` inside: `visibleMonths`, `variant`, `defaultFocusedValue`, `firstDayOfWeek`… (not `value`, `defaultValue` or `onChange`: the picker owns the value). Ignored when you pass children. |
| `children` | the calendar | Replace the calendar, for example to add presets beside it. |
| `placement` | `bottom start` | Popover placement. |
| `className` | — | Classes for the popover (`min-w-0`). |

Other [Popover](https://blamy.github.io/ui/#/popover) props pass through. The dialog around the calendar has 12px of padding.

## Styling

Slots: `date-picker`, `date-range-picker`, `date-picker-field`, `date-range-picker-field`, `date-picker-content`, `date-range-picker-content`, plus the `date-input` and `date-segment` of the field and the `calendar` in the popover. The root carries `data-open`, `data-invalid` and `data-disabled`; the field draws a primary ring while a segment is focused or the popover is open, and a destructive ring when invalid.

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `datePickerFieldVariants`

Defined in `@/components/ui/date-picker`. Base classes:

```text
[ 'flex min-w-0 items-center gap-1 bg-input pl-3 pr-1.5 text-foreground outline-none transition-[box-shadow,background-color] duration-spring-snappy ease-spring-snappy', 'data-focus-within:bg-transparent data-focus-within:ring-[1.5px] data-focus-within:ring-primary data-focus-within:ring-inset', 'group-data-open:bg-transparent group-data-open:ring-[1.5px] group-data-open:ring-primary group-data-open:ring-inset', 'data-invalid:ring-[1.5px] data-invalid:ring-destructive data-invalid:ring-inset data-disabled:cursor-not-allowed data-disabled:opacity-50', ]
```

**`size`** — default `default`

| Value | Adds |
| --- | --- |
| `sm` | `h-8 rounded-lg text-subhead` |
| `default` (default) | `h-11 rounded-ctl text-body` |
| `lg` | `h-[50px] rounded-xl text-body` |

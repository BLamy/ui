# DatePicker

A date input with a calendar button: type a date the way your language writes it, or press the button to pick it from a [Calendar](https://blamy.github.io/ui/#/calendar) in a popup. `mode="range"` does the same for a start and an end. It is UI SDK's Date Picker in the iOS filled-field style, and the API is compound: the field, its input and button, and the popup are parts you place yourself. Use a picker when a date is one field in a form and typing or picking are both fine; use the calendar on its own when it is the whole screen, and a [DateField](https://blamy.github.io/ui/#/date-field) when a popup is not wanted.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/date-picker.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import {
  DatePicker, DatePickerField, DatePickerContent,
} from '@/components/ui/date-picker'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import {
  DatePicker, DatePickerField, DatePickerContent,
} from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

The parts not in the import line above, `DatePickerInput`, `DatePickerTrigger`, `DatePickerClear`, `DatePickerHint` and `DatePickerPreset`, come from the same module (`@/components/ui/date-picker`, or the package root), with `createDatePickerController`.

## Values are ISO strings

The value is a date string such as `"2026-09-09"`, with no time and no time zone, or `null`. In `mode="range"` it is `[start, end]`, or `null` until both ends are valid. Typing into the input and picking in the calendar edit the same value, and no date library is needed; see [Calendar](https://blamy.github.io/ui/#/calendar) for the helpers in `@ui-sdk/core/date`.

## Anatomy

A `DatePicker` holds the field and, anywhere inside it, the popup. Put it in a [Field](https://blamy.github.io/ui/#/field) for its label, description and error.

```tsx
<Field>
  <FieldLabel variant="field">Date</FieldLabel>
  <DatePicker defaultValue="2026-09-09">
    <DatePickerField />
    <DatePickerContent />
  </DatePicker>
  <FieldDescription>Type a date, or open the calendar.</FieldDescription>
  <FieldError />
</Field>
```

`DatePickerField` is the filled field: a `DatePickerInput` and the `DatePickerTrigger` (in range mode, an input for each end with a dash between). `DatePickerContent` is the popup, which holds a calendar header and a grid per month. Both take children when you want your own layout, and every [Calendar](https://blamy.github.io/ui/#/calendar) part works inside the content:

```tsx
<DatePicker>
  <DatePickerField>
    <DatePickerInput aria-label="Due date" />
    <DatePickerClear />
    <DatePickerTrigger />
  </DatePickerField>
  <DatePickerHint />
  <DatePickerContent>
    <CalendarHeader />
    <CalendarGrid />
    <DatePickerPreset value="2026-12-25">Christmas</DatePickerPreset>
  </DatePickerContent>
</DatePicker>
```

`DatePickerClear` empties the value (it hides while there is nothing to clear), `DatePickerHint` shows the format to type ("MM/DD/YYYY", in the locale), and a `DatePickerPreset` selects the value it holds and closes the popup.

## Typing and picking

The input reads what was typed on Enter or when focus leaves it: the locale's order (`9/18/2026` in American English, `18.9.2026` in German), ISO dates, digits without separators, two-digit years and month names. A valid date is rewritten in the locale's format; text that is not a date stays as typed, marks the input `aria-invalid` and leaves the value alone. Choosing a day in the calendar sets the value and closes the popup; Esc closes it without a change, and focus returns to the calendar button. With no value the popup opens on today's month, so pass `defaultMonth` to open somewhere else (the demos pin September 2026). `DatePickerField` takes `size` (`sm`, `default`, `lg`). The popup renders outside the field, so in a themed area wrap the picker in a [ThemeScope](https://blamy.github.io/ui/#/theming) (or put `BLProvider` at your root) for it to wear the same theme.

{% demo src="date-picker/basic" %}

## Ranges

`mode="range"` holds `[start, end]`. The field has an input for each end and the popup's calendar picks a range: it stays open after the start and closes once the end is chosen. A typed end before the start is invalid. `months={2}` shows two months side by side, and `pageBy="page"` turns them together. `minDays` and `maxDays` bound the length, `allowUnavailable` lets a range cross unavailable days, and `startName` and `endName` name the two hidden form inputs.

{% demo src="date-picker/range" %}

## Date and time

A picker holds a date only. For a date and a time, put a `TimeField` beside it and join the two values, which are both ISO strings: the local date-time is `${date}T${time}`. For a single field that types both, use a [DateField](https://blamy.github.io/ui/#/date-field) with `granularity="minute"`.

{% demo src="date-picker/with-time" %}

## In a form

A `name` on the Field (or on the `DatePicker`; `startName` and `endName` for a range) submits ISO dates in `FormData`. `required` blocks an empty picker and text that is not a date blocks the form too; the `FieldError` shows the message after a submit attempt and the input takes focus. `min`, `max` and `unavailable` apply to typing, the calendar and presets alike. A form reset restores `defaultValue`. See [Form](https://blamy.github.io/ui/#/form) for the submit handling.

{% demo src="date-picker/form" %}

## Popup

`DatePickerContent` opens under the field, lined up with its start. Position it with `side`, `align`, `sideOffset` and `alignOffset`, or give it another `anchor`. `closeOnSelect={false}` on the picker keeps it open after a day is chosen, and `dismissible={false}` stops Esc and outside presses from closing it (`onDismissAttempt` reports them). `presentation="auto"` turns the popup into a bottom sheet in a compact container, and `presentation="sheet"` always does. `open`, `defaultOpen` and `onOpenChange(open, details)` control it, and `createDatePickerController()` drives the picker from elsewhere: `setValue`, `clear`, `setMonth`, `open`, `close` and `focus(date)`.

## Accessibility

It follows the WAI-ARIA date picker dialog. The input is a plain text input named by the Field's label, described by the hint, the description and any error. The calendar button has `aria-haspopup="dialog"` and `aria-expanded` and is named "Choose date" with the date chosen ("Choose dates" for a range); pass `aria-label` to name it in another language. The popup is a `dialog` holding the calendar's grid; focus moves to the selected day (else today) when it opens and back to the button when a day is picked or Esc closes it. Outside a Field, give each input an `aria-label`; the default field names them "Date", or "Start date" and "End date".

| Key | Where | Action |
| --- | --- | --- |
| Enter | Input | Commit the typed date. |
| Alt + Arrow Down | Input | Open the calendar. |
| Enter or Space | Calendar button | Open or close the calendar. |
| Escape | Popup | Cancel a range that is half chosen, otherwise close the popup. |
| Tab / Shift + Tab | Popup | Move through its controls; leaving it closes it. |

Inside the popup the keys are the [Calendar](https://blamy.github.io/ui/#/calendar)'s: arrows, Page Up and Page Down, Home and End, Enter to choose.

## Props

### DatePicker

The root is UI SDK's `DatePicker`; every prop passes through, with `className` merged onto `flex min-w-0 flex-col gap-1.5`. `value`, `defaultValue` and `onValueChange` are typed by `mode`.

| Prop | Default | Effect |
| --- | --- | --- |
| `mode` | `single` | `single` or `range`. |
| `value` / `defaultValue` / `onValueChange` | — | The ISO date, or `[start, end]`; `null` while empty. The callback gets `(value, details)`; `details.reason` is `item-press`, `input-commit`, `preset-press`, `clear-press`, `reset`… |
| `open` / `defaultOpen` / `onOpenChange` | closed | Control the popup. |
| `month` / `defaultMonth` / `onMonthChange` | the value's month, else today's | The first month the calendar shows, as `"2026-09"`. |
| `closeOnSelect` | `true` | Close the popup when a day, a range's end or a preset is chosen. |
| `presentation` | `popover` | `popover`, `sheet`, or `auto` (a sheet in a compact container). |
| `dismissible` / `onDismissAttempt` | `true` | Whether Esc, an outside press and focus leaving close the popup. |
| `min` / `max` / `unavailable` | — | Bounds and unavailable days, for typing and picking alike. |
| `required` / `disabled` / `readOnly` | `false` | State. |
| `name` / `startName` / `endName` / `form` | — | Names of the hidden inputs that submit the ISO dates. |
| `months` / `pageBy` / `locale` / `weekStartsOn` / `weekdayFormat` / `monthFormat` / `fixedWeeks` / `showOutsideDays` / `today` / `timeZone` | as on Calendar | Given to the calendar; `locale` also sets the input's format and the hint. |
| `minDays` / `maxDays` / `allowUnavailable` | — | In `range` mode. |
| `controller` | — | From `createDatePickerController()`. |
| `children` | the field and the popup | The parts, or a function of the picker's state. |

### DatePickerField

| Prop | Default | Effect |
| --- | --- | --- |
| `size` | `default` | `sm` 32px · `default` 44px · `lg` 50px. |
| `children` | the input (or two) and the button | Your own `DatePickerInput`, `DatePickerClear` and `DatePickerTrigger`. |
| `className` | — | Merged onto the field (`data-slot="date-picker-field"`). |

The popup anchors to this element.

### DatePickerContent

| Prop | Default | Effect |
| --- | --- | --- |
| `side` / `align` | `bottom` / `start` | Where the popup sits against the field. |
| `sideOffset` / `alignOffset` | `8` / `0` | Gap from the field and shift along it, in pixels. |
| `anchor` | the `DatePickerField` | Another element to position against. |
| `children` | a header and a grid per month | Your own Calendar parts, with presets beside them. |
| `className` | — | Classes for the popup, which has 12px of padding. |

### Other parts

| Part | Notes |
| --- | --- |
| `DatePickerInput` | The text input. `end` makes it a range's end. Takes the props of an `<input>` (`placeholder`, `aria-label`). |
| `DatePickerTrigger` | The calendar button. Children replace the icon. |
| `DatePickerClear` | Clears the value and focuses the input. Named "Clear"; children replace the icon. |
| `DatePickerHint` | The format to type, which describes the inputs. Its state has `placeholder` and `example`. |
| `DatePickerPreset` | A button that selects its `value`: a date, or `[start, end]` in range mode. |

## Styling

Slots: `date-picker`, `date-picker-field`, `date-picker-input`, `date-picker-trigger`, `date-picker-clear`, `date-picker-hint`, `date-picker-preset`, `date-picker-content`, plus the calendar's slots in the popup. The root carries `data-open` or `data-closed`, `data-mode`, `data-invalid`, `data-disabled` and `data-readonly`; an input carries `data-invalid` and `data-disabled`, a preset `data-selected`, Clear `data-empty`, and the content `data-side`, `data-align`, `data-presentation` and `data-starting-style` / `data-ending-style` while it enters and leaves. The field draws a primary ring while it has focus or the popup is open, and a destructive ring while an input is invalid.

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `datePickerFieldVariants`

Defined in `@/components/ui/date-picker`. Base classes:

```text
[ 'flex min-w-0 items-center gap-1 bg-input pl-3 pr-1.5 text-foreground outline-none transition-[box-shadow,background-color] duration-spring-snappy ease-spring-snappy', 'focus-within:bg-transparent focus-within:ring-[1.5px] focus-within:ring-primary focus-within:ring-inset', 'group-data-open/date-picker:bg-transparent group-data-open/date-picker:ring-[1.5px] group-data-open/date-picker:ring-primary group-data-open/date-picker:ring-inset', 'has-aria-invalid:ring-[1.5px] has-aria-invalid:ring-destructive has-aria-invalid:ring-inset group-data-disabled/date-picker:cursor-not-allowed group-data-disabled/date-picker:opacity-50', ]
```

**`size`** — default `default`

| Value | Adds |
| --- | --- |
| `sm` | `h-8 rounded-lg text-subhead` |
| `default` (default) | `h-11 rounded-ctl text-body` |
| `lg` | `h-[50px] rounded-xl text-body` |

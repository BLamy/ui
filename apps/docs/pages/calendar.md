# Calendar

A month grid for picking a day, and its range twin for picking a start and an end. They are react-aria's `Calendar` and `RangeCalendar` drawn as iOS: round day cells, a tint-filled selection and, for a range, a soft band joining its two ends. Use a calendar when the date is the whole interface (booking, scheduling); put it behind a button with [DatePicker](https://blamy.github.io/ui/#/date-picker) when it is one field among others, and use a [DateField](https://blamy.github.io/ui/#/date-field) when people know the date and only need to type it.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/calendar.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { Calendar, RangeCalendar } from '@/components/ui/calendar'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { Calendar, RangeCalendar } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## Values come from @internationalized/date

A calendar does not use `Date`. Its value is a `DateValue` from `@internationalized/date` (a `CalendarDate`, a `CalendarDateTime` or a `ZonedDateTime`), so there are no time-zone off-by-one days and non-Gregorian calendars work. Build one with `parseDate('2026-09-09')` or `new CalendarDate(2026, 9, 9)`, and read it with `value.toString()` (ISO) or `value.toDate(timeZone)`. A range is `{ start, end }`. The shadcn registry item installs `@internationalized/date` as an npm dependency; with the npm package it is already one.

## Anatomy

`Calendar` renders a header and the month grid for you. Give it children to compose your own from `CalendarHeader` and `CalendarGrid`; the cells inside the grid are `CalendarCell`s.

```tsx
<Calendar aria-label="Appointment date" defaultValue={parseDate('2026-09-09')} />

<RangeCalendar aria-label="Stay" visibleMonths={2} />
```

```tsx
<Calendar aria-label="Appointment date">
  <CalendarHeader />
  <CalendarGrid />
</Calendar>
```

A calendar needs a name: pass `aria-label` or `aria-labelledby` (the visible month is appended to it for screen readers).

## A single day

`value` and `onChange` work on `DateValue`s (`null` is "nothing selected"); `defaultValue` leaves it uncontrolled. Without a value the calendar opens on today's month; `defaultFocusedValue` (or `focusedValue` / `onFocusChange` to control it) decides which month it opens on and which day takes the first Tab. `variant="card"` sits it on its own filled panel; the default `plain` has no surface, for use inside a popover or a sheet.

{% demo src="calendar/basic" %}

## Ranges

`RangeCalendar` takes a `{ start, end }` value. The first press sets the anchor and the second sets the other end, in either order; the days between are joined by a band, half a cell at each end, and a one-day range shows no band. Escape cancels a range that is half chosen. `allowsNonContiguousRanges` lets the range span unavailable days.

{% demo src="calendar/range" %}

## Minimum, maximum and unavailable days

`minValue` and `maxValue` dim every day outside them and stop the previous and next buttons at the edge. `isDateUnavailable` is a function from a date to a boolean for rules the range cannot say (weekends, holidays, booked days): those days are struck through in red and cannot be picked, but they stay focusable, so keyboard users can still land on them and hear why. If the selected value is outside the bounds or on an unavailable day the calendar is `isInvalid`. `isDisabled` dims the whole calendar and `isReadOnly` keeps the selection but blocks changes.

{% demo src="calendar/min-max" %}

{% demo src="calendar/unavailable" %}

`@internationalized/date` has the helpers these rules want: `isWeekend(date, locale)`, `isSameDay`, `today(timeZone)`, `getDayOfWeek`.

## More than one month

`visibleMonths` shows one to three months side by side, on both calendars. The previous and next buttons move by that many months (`pageBehavior="single"` moves by one). The grids sit in a row, so give the calendar room or let it scroll.

{% demo src="calendar/two-months" %}

## Locale and week start

Month names, weekday headers, number systems, the first day of the week and right-to-left layout all follow the locale. Set it for a subtree with react-aria's `I18nProvider locale="de-DE"` (the demos pin `en-US` so they read the same for everyone); `firstDayOfWeek="mon"` overrides just the week start. Other calendar systems work through the value: a `CalendarDate` made with `new CalendarDate(new JapaneseCalendar(), …)` shows that calendar.

## Accessibility

The calendar is a `group` containing a `grid` per month with row and column headers, and each day is a `gridcell` whose accessible name is its full date ("Wednesday, September 9, 2026"), plus "selected", "today" or "unavailable" where they apply. A visually hidden status announces the visible month when it changes. Focus is a single tab stop (roving) in the grid, and the previous and next buttons are labelled by locale.

| Key | Action |
| --- | --- |
| Arrow Left / Right | Previous / next day (swapped in right-to-left locales). |
| Arrow Up / Down | Same weekday, previous / next week. |
| Page Up / Page Down | Same day, previous / next month. |
| Shift + Page Up / Page Down | Same day, previous / next year. |
| Home / End | First / last day of the visible month. |
| Enter or Space | Select the focused day (in a range: set the anchor, then the other end). |
| Escape | Cancel a range that has an anchor but no end yet. |

State is not conveyed by color alone: unavailable days are struck through, today is bold, and each state is in the cell's accessible name. Keyboard focus shows a ring on the day (`data-focus-visible`).

## Props

### Calendar

The root is react-aria's `Calendar`; every prop passes through, with `className` (a string or a function) merged after the variant classes. `RangeCalendar` takes the same, with a `{ start, end }` value.

| Prop | Default | Effect |
| --- | --- | --- |
| `value` / `defaultValue` / `onChange` | — | The selected `DateValue` (a range for `RangeCalendar`); `null` clears it. |
| `focusedValue` / `defaultFocusedValue` / `onFocusChange` | today | The date that has keyboard focus, and so the month on show. |
| `minValue` / `maxValue` | — | Earliest and latest selectable day. |
| `isDateUnavailable` | — | `(date) => boolean`: days that cannot be picked. |
| `isDisabled` / `isReadOnly` / `isInvalid` | `false` | State. |
| `visibleMonths` | `1` | `1`, `2` or `3` months side by side. |
| `variant` | `plain` | `plain` no surface · `card` a filled panel with padding. |
| `pageBehavior` | `visible` | `visible` pages by the months on show · `single` by one month. |
| `firstDayOfWeek` | locale's | `sun` … `sat`. |
| `autoFocus` | `false` | Focus the selected (or focused) day on mount. |
| `errorMessage` | — | Message for an invalid value. |
| `aria-label` / `aria-labelledby` | — | The calendar's name (required, unless you label it with a heading). |
| `children` | header and grids | Replace the layout with `CalendarHeader` and `CalendarGrid`s. |

`RangeCalendar` also takes `allowsNonContiguousRanges`.

### CalendarHeader, CalendarGrid and CalendarCell

| Part | Notes |
| --- | --- |
| `CalendarHeader` | A `<header>` with the previous and next buttons around the month and year heading. Takes the props of a `<header>`. Must sit inside a calendar. |
| `CalendarGrid` | One month: the weekday row and its days. `offset={{ months: 1 }}` shows the following month (what `visibleMonths` does for you); `weekdayStyle` is `narrow`, `short` or `long`. |
| `CalendarCell` | One day, given its `date`. In a `RangeCalendar` it draws the band; today is tinted. Its render props and `data-` attributes are react-aria's. |

## Styling

Slots: `calendar` (`range-calendar` for the range), `calendar-header`, `calendar-grid`, `calendar-cell`. The root carries `data-disabled` and `data-invalid`. A day carries `data-selected`, `data-hovered`, `data-pressed`, `data-focus-visible`, `data-disabled`, `data-unavailable`, `data-outside-month` and, in a range, `data-selection-start` and `data-selection-end`; the circle is drawn off those through a `group/cell`, so changing a state's look is a class edit. Inside a popover, the calendar uses the [Popover](https://blamy.github.io/ui/#/popover)'s surface; inside a [ThemeScope](https://blamy.github.io/ui/#/theming) it follows the scope.

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `calendarVariants`

Defined in `@/components/ui/calendar`. Base classes:

```text
flex w-fit max-w-full flex-col text-foreground data-disabled:opacity-50
```

**`variant`** — default `plain`

| Value | Adds |
| --- | --- |
| `plain` (default) | — |
| `card` | `rounded-panel bg-secondary p-3` |

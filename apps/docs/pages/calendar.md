# Calendar

A month grid for picking a day, several days, or a start and an end. It is UI SDK's `Calendar` drawn as iOS: round day cells, a tint-filled selection and, for a range, a soft band joining its two ends. Use a calendar when the date is the whole interface (booking, scheduling); put it behind a button with [DatePicker](https://blamy.github.io/ui/#/date-picker) when it is one field among others, and use a [DateInput](https://blamy.github.io/ui/#/date-input) when people know the date and only need to type it.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/calendar.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { Calendar } from '@/components/ui/calendar'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from their module:

```tsx
import '@brett_lamy/ui/styles.css'

import { Calendar } from '@brett_lamy/ui/calendar'
```
{% endtab %}
{% endtabs %}

The parts a calendar is built from come from the same module (`@/components/ui/calendar`, or the package root): `CalendarHeader`, `CalendarHeading`, `CalendarPrevious`, `CalendarNext`, `CalendarMonthSelect`, `CalendarYearSelect`, `CalendarMonths`, `CalendarGrid`, `CalendarGridHeading`, `CalendarWeekdays`, `CalendarWeekday`, `CalendarWeeks` and `CalendarDay`, with `createCalendarController`.

## Dates are ISO strings

A calendar does not use `Date`. A date is a string such as `"2026-09-09"`: a calendar day with no time and no time zone, the same value `<input type="date">` submits, so there are no off-by-one days and nothing to parse. A month is `"2026-09"`. Strings in this form sort in date order, so `start < end` compares them. What `value` holds depends on `mode`:

| `mode` | `value` |
| --- | --- |
| `single` (default) | A date, or `null`. |
| `multiple` | A sorted array of dates. |
| `range` | `[start, end]`, or `null`. |

No date library is needed. For arithmetic and labels use the helpers in `@ui-sdk/core/date`, which is installed with the calendar: `todayDate()`, `addDays`, `addMonths`, `daysBetween`, `weekday`, `formatDate`, and `toISODate` to bring in a `Date` or any `{ year, month, day }` object. Dates are always Gregorian; a locale's own year system (Buddhist, Japanese era) can still appear in the labels.

## Anatomy

`Calendar` renders a header and a grid per month for you. Give it children to compose your own from its parts.

```tsx
<Calendar defaultValue="2026-09-09" />

<Calendar mode="range" months={2} />
```

```tsx
<Calendar>
  <CalendarHeader />
  <CalendarGrid />
</Calendar>
```

`CalendarHeader` holds `CalendarPrevious`, `CalendarHeading` and `CalendarNext`; `CalendarMonths` holds a `CalendarGrid` per month on show (it is what a Calendar renders under its header); `CalendarGrid` holds `CalendarWeekdays` (a `CalendarWeekday` per column) and `CalendarWeeks` (a `CalendarDay` per date). Each grid is named by its month, so the calendar needs no label of its own; when several months stack (on a phone, in a narrow column), each also shows its month over it, and a range's band is rounded where one month ends and the next begins.

## A single day

`value` and `onValueChange(value, details)` control the selection (`null` is "nothing selected"); `defaultValue` leaves it uncontrolled. `details.reason` says why it changed (`item-press`, or `imperative` from a controller) and `details.cancel()` keeps the old value. `deselectable` lets a second press on the selected day clear it. Without a value the calendar opens on today's month; `defaultMonth` (or `month` and `onMonthChange` to control it) decides which month it shows. `variant="card"` sits it on its own filled panel; the default `plain` has no surface, for use inside a popup or a sheet.

{% demo src="calendar/basic" %}

## Ranges and several days

`mode="range"` takes a `[start, end]` value. The first press sets the start and the second sets the end; a press before the start becomes the new start. Moving the pointer or the focus previews the range, and the value changes once, when both ends are chosen. The days between are joined by a band, half a cell at each end, and a one-day range shows no band. Escape drops a range that is half chosen. `minDays` and `maxDays` bound its length (both ends count), and `allowUnavailable` lets it span unavailable days. `onAnchorChange` reports the start while the end is still being picked.

{% demo src="calendar/range" %}

`mode="multiple"` toggles each day on its own; its value is an array, kept sorted.

## Minimum, maximum and unavailable days

`min` and `max` dim every day outside them, stop the arrow keys there and stop the previous and next buttons at their months. `unavailable` is for rules a range cannot say (weekends, holidays, booked days). It is data: a date, `{ from, to }`, `{ weekday: [0, 6] }` (0 is Sunday), `{ before }`, `{ after }`, a function of the date, or an array of these. Unavailable days are struck through in red and cannot be picked, but they stay focusable, so keyboard users can still land on them and hear why. `disabled` dims the whole calendar and takes it out of the tab order; `readOnly` lets people move through the dates but not change the selection.

{% demo src="calendar/min-max" %}

{% demo src="calendar/unavailable" %}

## More than one month

`months` shows that many months side by side, each in its own grid, and the arrow keys cross from one to the next. The previous and next buttons move by one month; `pageBy="page"` moves by all the months on show. The grids sit in a row while they fit and wrap one under the other, centred, in a narrow container (a phone, a sidebar). In a compact (phone-sized) scope the days are 44px touch targets while they fit: a month is 308px wide and never wider than its container, so in a narrow sidebar or a 320px phone its seven columns share the room (the `card` keeps its padding) and the header keeps to one month's width, with Previous and Next beside it. `fixedWeeks` gives every month six rows so the height never changes, and `showOutsideDays` fills the edges with the days of the months around (hidden by default here: each grid shows its own month only).

{% demo src="calendar/two-months" %}

## Month and year selects

For a date far from today (a birthday), put `CalendarMonthSelect` and `CalendarYearSelect` in the header. They are native selects, drawn as iOS header pop-up buttons (as wide as their text, with the up-down glyph), that jump straight to a month; the years run from `min` to `max`, or ten either side of the year on show. Keep a `CalendarHeading` in the header, visually hidden if you like, so the grids stay named.

```tsx
<Calendar min="1950-01-01" max="2026-12-31">
  <CalendarHeader>
    <CalendarHeading className="sr-only" />
    <CalendarMonthSelect className="flex-1" />
    <CalendarYearSelect />
  </CalendarHeader>
  <CalendarGrid />
</Calendar>
```

## Locale, week start and today

Month names, weekday headers, the full date each day is named by and the first day of the week follow `locale`. Leave it out and the calendar reads the page's `lang` once it has mounted, then the browser's language; the first render (on the server too) is English, so the two always match. The demos pin `en-US` so they read the same for everyone. `weekStartsOn` overrides the week start (0 is Sunday), and `weekdayFormat` and `monthFormat` take `narrow`, `short` or `long`. In a right-to-left page the left and right arrow keys follow the order on screen.

Today is read on the client and gets `aria-current="date"`; `timeZone` says which zone decides what day that is, and `today` pins it (a fixed date in a test or a screenshot).

## From outside

`createCalendarController()` returns a controller to pass as `controller`: `setValue`, `setMonth`, `previous`, `next` and `focus(date)`, which turns to the date's month first. Every write method returns `false` when the change was canceled or the calendar is disabled.

```tsx
const [calendar] = useState(() => createCalendarController())

<Button onClick={() => { calendar.setValue('2026-12-25'); calendar.focus('2026-12-25') }}>Christmas</Button>
<Calendar controller={calendar} />
```

## Accessibility

Each month is a `grid` named by its month, with `columnheader`s named by the full weekday, and each day is a `gridcell` whose accessible name is its full date ("Wednesday, September 9, 2026"), with `aria-selected`, `aria-disabled` and `aria-current="date"` where they apply. A grid that selects several days or a range is `aria-multiselectable`. The heading is a polite live region, so the month is announced when it changes. The grid is a single tab stop: the selected day when it is on show, otherwise today, otherwise the first day that can be picked. The previous and next buttons are named "Previous month" and "Next month"; pass `aria-label` to name them in another language.

| Key | Action |
| --- | --- |
| Arrow Left / Right | Previous / next day (following the page's direction). |
| Arrow Up / Down | Same weekday, previous / next week. |
| Home / End | First / last day of the week. |
| Page Up / Page Down | Same day, previous / next month. |
| Shift + Page Up / Page Down | Same day, previous / next year. |
| Enter or Space | Select the focused day (in a range: the start, then the end). |
| Escape | Cancel a range that has a start but no end yet. |

State is not conveyed by color alone: unavailable days are struck through, today is bold, and each state is an ARIA attribute on the cell. Keyboard focus shows a ring on the day.

## Props

### Calendar

The root is UI SDK's `Calendar`; every prop passes through, with `className` (a string or a function of the state) merged after the variant classes. `value`, `defaultValue` and `onValueChange` are typed by `mode`.

| Prop | Default | Effect |
| --- | --- | --- |
| `mode` | `single` | `single`, `multiple` or `range`. |
| `value` / `defaultValue` / `onValueChange` | — | The selection, in the shape of the `mode`. The callback gets `(value, details)`. |
| `month` / `defaultMonth` / `onMonthChange` | the value's month, else today's | The first month on show, as `"2026-09"`. |
| `min` / `max` | — | Earliest and latest day that can be picked. |
| `unavailable` | — | Days that cannot be picked: dates, spans, weekdays, a function, or an array of these. |
| `disabled` / `readOnly` | `false` | State. |
| `deselectable` | `false` | In `single` mode, a second press on the selected day clears it. |
| `months` | `1` | How many months to show side by side. |
| `pageBy` | `month` | `month` turns one month at a time · `page` turns all the months on show. |
| `minDays` / `maxDays` / `allowUnavailable` | — | In `range` mode: the shortest and longest range, and whether it may span unavailable days. |
| `locale` | the page's | Language of the names and labels. |
| `weekStartsOn` | the locale's | First day of the week, 0 for Sunday. |
| `weekdayFormat` / `monthFormat` | `narrow` / `long` | `narrow`, `short` or `long`. |
| `fixedWeeks` | `false` | Six rows in every month. |
| `showOutsideDays` | `false` | Show the days of the months around at the edges. |
| `today` / `timeZone` | today in the browser's zone | The day marked as today. |
| `onFocusedChange` / `onAnchorChange` | — | The day focus moves to, and a range's start while it is being picked. |
| `controller` | — | From `createCalendarController()`. |
| `variant` | `plain` | `plain` no surface · `card` a filled panel with padding. |
| `children` | header and grids | Replace the layout with your own parts. |

### Parts

| Part | Notes |
| --- | --- |
| `CalendarHeader` | A `<header>` with the previous and next buttons around the heading. Give it children to lay out your own. |
| `CalendarPrevious` / `CalendarNext` | The step buttons. Disabled at the month of `min` / `max`. |
| `CalendarHeading` | The months on show ("September 2026", "September – October 2026"). |
| `CalendarMonthSelect` / `CalendarYearSelect` | Native selects that jump to a month or a year. |
| `CalendarMonths` | The grids on show, one per month, wrapping in a narrow container. `months` defaults to the Calendar's or DatePicker's. With more than one month, each grid gets its `CalendarGridHeading`, shown while the months stack. |
| `CalendarGrid` | One month: the weekday row and its days. `offset={1}` shows the following month (what `CalendarMonths` does for you). |
| `CalendarGridHeading` | A month's caption over its grid ("October 2026"), a `<caption>` hidden from screen readers (the grid is already named). `CalendarMonths` adds one per grid when it shows several months; it is visible only while they stack (a compact scope), where the shared header can't say which grid is which. |
| `CalendarWeekdays` / `CalendarWeekday` | The header row and one column header. `CalendarWeekdays` takes a function of the column's index as children. |
| `CalendarWeeks` / `CalendarDay` | The week rows and one day, given its date as `value`. `CalendarWeeks` takes a function of the cell as children; a day's children replace its number and can be a function of its state. |

Every part takes `className` (a string or a function of its state) and `render` to change its element.

## Styling

Slots: `calendar`, `calendar-header`, `calendar-heading`, `calendar-previous`, `calendar-next`, `calendar-month-select`, `calendar-year-select`, `calendar-grid`, `calendar-weekdays`, `calendar-weekday`, `calendar-week`, `calendar-day`. The root carries `data-mode`, `data-disabled`, `data-readonly` and `data-size-class` (the size class it sits in): in a `compact` one the days are 44px touch targets instead of 36px. A day carries `data-value`, `data-selected`, `data-today`, `data-outside`, `data-disabled`, `data-unavailable` and, in a range, `data-range-start`, `data-range-middle`, `data-range-end` and `data-preview` (a range still being picked); hover and keyboard focus are the native `:hover` and `:focus-visible`. The circle inside a day reads them through a `group/day` (and the fill and today's tint from the day's state), so changing a state's look is a class edit. A range's band is rounded where a week row cuts it. Inside a popup the calendar sits on the popup's surface; inside a [ThemeScope](https://blamy.github.io/ui/#/theming) it follows the scope.

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

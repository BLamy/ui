# RequestTable

A network pane: a virtualized table of requests that stays smooth at 10,000 rows, with a waterfall on a shared time range and a playhead that moves across it without rendering a single row. Columns are configurable, resizable and sort. Each row can link to the other end of its call. Under 480 px of its own width it becomes two-line rows. Rows are plain data, so it doesn't know what produced them. Its partner for logs is [LogList](https://blamy.github.io/ui/#/log-list).

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/request-table.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import {
  RequestTable, RequestLink,
} from '@/components/ui/request-table'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { RequestTable, RequestLink } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## Usage

Give it rows and a sized parent. A row needs an `id` and a `url`; the rest fill in the columns they belong to, and a dash shows where the recording doesn't say. `time` and `duration`, in ms, draw its bar.

```tsx
const rows: RequestRow[] = [
  { id: 1, url: 'https://shop.example.com/api/cart', method: 'GET', status: 200, type: 'fetch', size: 1840, time: 40, duration: 72 },
  { id: 2, url: 'https://shop.example.com/api/checkout', method: 'POST', status: 500, type: 'fetch', size: 420, time: 180, duration: 240 },
]

<RequestTable aria-label="Requests" rows={rows} playhead={time} onAction={(id, { row }) => seek(row.time)} className="h-96" />
```

{% demo src="request-table/waterfall" %}

## The waterfall

Every bar sits on one time range: `timeRange`, or by default from the first request to the last answer. Give it the recording's own range if rows come and go with a playhead, or every bar moves when they do. `tone` colors a bar (`primary`, `success`, `warning`, `danger`, `accent` or `neutral`), and a failed request is `danger` unless it says otherwise. A `pending` request runs on to the end of the range.

`playhead` draws a line on the range and dims the requests sent after it, whatever order the rows are sorted in. It's one element over the whole table, and moving it writes that element's position and a few attributes and renders nothing, so it can change on every frame. The controller's `setPlayhead(time)` does the same with no React at all, for a clock's every tick:

```tsx
const [table] = useState(createRequestTableController)

useEffect(() => clock.subscribe(() => table.setPlayhead(clock.getState().time * 1000)), [clock, table])

<RequestTable controller={table} rows={rows} />
```

## Both ends of a call

`renderLink` puts links at the end of a row's name (at the end of its second line in two-line rows), for the other end of the call: the server function that answered a request, or the code that made it. `RequestLink` is small enough for a row, and a press on it isn't a press of the row. Setting `value` to the other row's id selects it and brings it into view.

{% demo src="request-table/pair" %}

```tsx
const renderLink = useCallback((row: Row) => (
  <RequestLink onClick={() => setSelected(row.other)}>{row.otherLabel}</RequestLink>
), [])

<RequestTable rows={rows} value={selected} onValueChange={setSelected} renderLink={renderLink} />
```

## Columns

`columns` is which columns, in order: a built-in's id, or a column of your own. Built-ins are `name`, `url`, `method`, `status`, `type`, `size`, `duration` and `waterfall`. A column with a built-in's `id` adjusts that one, and a list of ids can be written inline.

```tsx
const columns: RequestColumn<Row>[] = [
  { id: 'url', title: 'Channel', flex: 2, minWidth: 140 },
  { id: 'from', title: 'From', width: 90 },
]

<RequestTable rows={rows} columns={[...columns, 'status', 'duration', 'waterfall']} />
```

Dragging a header's edge resizes its column, and double-clicking the edge puts it back. While it drags it only writes a CSS variable, so no rows render, and it asks for the new width once, on release. `columnWidths` and `onColumnWidthsChange(widths, details)` are there to save what the user chose; `details.reason` is `drag`, `resize-key`, `handle-press` (the double click) or `imperative`. Wider than the table, the columns scroll sideways. `type` and `size` have `hideBelow: 'regular'`, so they go first as the table narrows.

Pressing a header sorts: ascending, descending, then back to the rows' own order. Rows with nothing in that column stay at the end both ways. A column of your own sorts by its field of the same name, or by its `sortValue`, and with a `render` and no `sortValue` it doesn't sort at all. A new sort goes to the selected row, or else the top. `onSortChange(sort, details)` has `details.reason`: `trigger-press` for a header, `item-press` for the sort menu, `imperative` for the controller.

## Narrow windows

The table has a size class of its own, from its own width and not the viewport's, so a side panel gets it too. It's written on the root as `data-size-class`, for your styles. Compact, under 480 px, it becomes two-line rows: the name, then status, method, duration and any links, with a small waterfall beside them, and sorting moves into a menu. Medium, under 760 px, leaves out the columns with `hideBelow: 'regular'`. `breakpoints={{ medium, regular }}` moves those widths, and `layout="table"` or `layout="stacked"` holds it to one layout. The row at the top of the view and the selection stay as they are when it changes.

{% demo src="request-table/narrow" %}

## Keyboard

| Key | Effect |
| --- | --- |
| `↑` `↓` | Move the active row. `↑` from the first row goes up to the headers, `↓` from a header back to the rows. |
| `Page Up` `Page Down` `Home` `End` | Move a screen, or to the first or last row. On the headers, `Home` and `End` go to the first or last. |
| `Enter` `Space` | Press the active row, or sort by the active header. |
| `←` `→` | Scroll sideways. On the headers, move between them. |
| `⌥←` `⌥→` | On a header, narrow or widen its column. With `⇧`, by more. |
| `Tab` | Go through the active row's links, then out of the table. |
| `Esc` | From a link, back to its row. On the headers, back to the rows. |

## Accessibility

It's an ARIA grid with one tab stop, built on [UI SDK](https://ui-sdk.dev)'s virtualizer, grid focus and resize: focus is on the active row or header itself, and the active row stays rendered while it has focus, so it can't be lost when the rows around it scroll out and unmount. A key that moves to a row that isn't rendered yet scrolls it in first. `aria-rowcount` gives the full length, each row has `aria-rowindex`, and a sorted column has `aria-sort`. Links are UI SDK buttons, the sort menu is [DropdownMenu](https://blamy.github.io/ui/#/dropdown-menu), and a column's edge is a `separator` you can drag with a mouse or a finger, or move with `←` `→` once it has focus. A press on a row is the row's own click, so touch, mouse and a screen reader's click all reach it.

UI SDK's [Waterfall](https://ui-sdk.dev) draws a trace's spans as a tree of rows on a time axis; RequestTable is a flat, sortable table of requests with a waterfall column, so it places its bars with `requestBar` and leaves Waterfall to traces.

## Props

### RequestTable

| Prop | Default | Effect |
| --- | --- | --- |
| `rows` | required | The rows. Keep the array stable between renders when nothing changed. |
| `columns` | all but `url` | Which columns, in order. |
| `timeRange` | first request to last answer | The waterfall's range. |
| `playhead` | none | The playhead's time, in ms. |
| `value` / `defaultValue` / `onValueChange` | none | The selected row's id, or `null`. A new one that's out of view is scrolled to. `details.reason` is `item-press` or `imperative`. |
| `onAction` | none | `(id, details)`: a press, or Enter or Space on the active row, with `details.row` and `details.index`. |
| `renderLink` | none | Links to the other end of a call, in the row. Must be stable. |
| `sort` / `defaultSort` / `onSortChange` | none | `{ column, direction }`, or `null` for the rows' own order. |
| `columnWidths` / `defaultColumnWidths` / `onColumnWidthsChange` | their own sizes | Widths set so far, by column id. |
| `controller` | none | `createRequestTableController()`, to drive it from outside. |
| `layout` | `auto` | `auto`, `table` or `stacked`. |
| `breakpoints` | `{ medium: 480, regular: 760 }` | Where the table's own size classes start, in px. `auto` stacks while it's compact. |
| `density` | `compact` | `comfortable` for touch. |
| `emptyState` / `footer` | "No requests" / none | Shown with no rows, and after the last row. |

### A row

| Field | Effect |
| --- | --- |
| `id` | Unique in the table: rows and the selection follow it. |
| `url` | The full URL or an IPC channel. It's the name's tooltip. |
| `name` | What the Name column shows. By default, the end of the URL. |
| `method` / `type` | Shown as they are. |
| `status` | An HTTP status, where 0 means it failed without one, or any word. |
| `size` | Bytes. |
| `time` / `duration` | When it was sent and how long it took, in ms. A row with no `time` has no bar and is never dimmed. |
| `tone` | The bar's color. |
| `pending` | Still waiting. |
| `failed` / `error` | It failed whatever its status, and why. |

### A column

| Field | Effect |
| --- | --- |
| `id` / `title` / `label` | Which one, its header, and its name in words when `title` isn't a string. |
| `width` / `flex` | A fixed width in px, or a share of the spare width. |
| `minWidth` / `maxWidth` | How far a resize can go. |
| `hideBelow` | `'regular'` (or `'medium'`): hidden while the table's size class is below that one. |
| `align` | `start` or `end`. |
| `render` | The cell. Must be stable. |
| `sortable` / `sortValue` | Whether it sorts, and by what. |

### The controller

`createRequestTableController()` makes one; pass it as `controller`.

| Method | Effect |
| --- | --- |
| `focus()` | Focuses the active row, or the row focus would start on. |
| `scrollToId(id, { align? })` | Scrolls to a row: `center` by default, or `start`, `end`, `auto` (only if it's out of view). |
| `setPlayhead(time)` | Moves the playhead with no React. The `playhead` prop takes over when it next changes. |
| `setValue(id)` / `setSort(sort)` / `setColumnWidths(widths)` | Selects a row, sorts, or sets the widths, as code (`reason: 'imperative'`). |

### Helpers

`REQUEST_COLUMNS` has the built-in columns. `requestName(url)`, `requestStatusText(row)`, `requestDurationText(row)`, `requestSizeText(row)`, `requestTimeRange(rows)`, `isRequestFailed(row)` and `sortRequests(rows, sort, valueOf)` are the logic behind them, for a host showing the same request elsewhere.

## Styling

The root is `data-slot="request-table"`, with `data-layout` of `table` or `stacked`, inside it `request-table-grid` (with `data-playhead` while the playhead is on the range), `request-table-head` around `request-table-header`, `request-table-rows`, `request-table-playhead`, `request-table-empty` and `request-table-footer`. A header is `request-table-column`, with `data-active` and `request-table-resizer` (`data-dragging` while it drags), and the stacked header has `request-table-heading`s, one with the sort menu. A row is `request-table-row`, with `data-selected`, `data-active`, `data-future`, `data-failed` and `data-pending`, its cells are `request-table-cell`, and it has `request-table-name`, `request-table-links`, `request-table-waterfall` and `request-table-bar`; a link is `request-table-link`. It takes its colors from the theme, on the surface [ResultTable](https://blamy.github.io/ui/#/result-table) and Spreadsheet use.

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `requestTableVariants`

Defined in `@/components/ui/request-table`. Base classes:

```text
group/table relative flex h-full w-full min-h-0 min-w-0 flex-col overflow-hidden rounded-panel bg-card text-card-foreground after:pointer-events-none after:absolute after:inset-0 after:z-3 after:rounded-[inherit] after:shadow-hairline after:content-['']
```

**`density`** — default `compact`

| Value | Adds |
| --- | --- |
| `compact` (default) | — |
| `comfortable` | — |

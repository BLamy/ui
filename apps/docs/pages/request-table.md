# RequestTable

A network pane: a table of requests with a waterfall on a shared time range and a playhead that moves across it without rendering a single row. Each row can link to the other end of its call. Rows are plain data, so it doesn't know what produced them. Its partner for logs is [LogList](https://blamy.github.io/ui/#/log-list).

It is a preset of [DataTable](https://blamy.github.io/ui/#/data-table): the request columns, the waterfall, the playhead's line and the two-line rows of a narrow table. Everything else, virtual rows (smooth at 10,000), sorting, resizing, selection, the keyboard, its own size class, and the props and controller for them, is DataTable's and documented there. For rows that aren't requests, use DataTable itself.

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
const [table] = useState(createDataTableController)

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

`columns` is which columns, in order: a built-in's id, or a [DataTable column](https://blamy.github.io/ui/#/data-table) of your own. Built-ins are `name`, `url`, `method`, `status`, `type`, `size`, `duration` and `waterfall`; `REQUEST_COLUMNS` has their sizes and titles. A column with a built-in's `id` adjusts that one (and keeps its cell unless it brings a `render`), and a list of ids can be written inline.

```tsx
const columns: DataTableColumn<Row>[] = [
  { id: 'url', title: 'Channel', flex: 2, minWidth: 140 },
  { id: 'from', title: 'From', width: 90 },
]

<RequestTable rows={rows} columns={[...columns, 'status', 'duration', 'waterfall']} />
```

Resizing (`columnWidths`), sorting (`sort`, by the built-ins' own values: the name, the status with pending rows last, the start time for the waterfall) and selection work as on DataTable. `type` and `size` have `hideBelow: 'regular'`, so they go first as the table narrows.

## Narrow windows

The table has DataTable's size class of its own, from its own width and not the viewport's. Compact, under 480 px, it becomes two-line rows: the name, then status, method, duration and any links, with a small waterfall beside them (the playhead crosses it), and sorting moves into a menu. Medium, under 760 px, leaves out `type` and `size`. `breakpoints` and `layout` work as on DataTable.

{% demo src="request-table/narrow" %}

## Keyboard and accessibility

DataTable's: an ARIA grid with one tab stop, where ↑ ↓ move between rows, ↑ from the first row reaches the headers, Enter presses a row or sorts by a header, ⌥← ⌥→ resize a column, and Tab goes through the active row's links and on out (Esc comes back). See [DataTable](https://blamy.github.io/ui/#/data-table#keyboard). Links are UI SDK buttons, and a press on one isn't a press of its row. The playhead's line is drawn for sighted users; the dimmed rows (`data-future`) say the same.

UI SDK's [Waterfall](https://ui-sdk.dev) draws a trace's spans as a tree of rows on a time axis; RequestTable is a flat, sortable table of requests with a waterfall column, so it places its bars with `requestBar` and leaves Waterfall to traces.

## Props

### RequestTable

RequestTable takes DataTable's props (`value`, `onAction`, `sort`, `columnWidths`, `controller`, `layout`, `breakpoints`, `density`, `emptyState`, `footer`, `toolbar`, `selectionMode`…) except the ones it fills in itself (`rowTime`, `overlay`, `renderStackedRow`, `countLabel`), and these:

| Prop | Default | Effect |
| --- | --- | --- |
| `rows` | required | The requests. Keep the array stable between renders when nothing changed. |
| `columns` | all but `url` | Which columns, in order: built-in ids or DataTable columns. |
| `timeRange` | first request to last answer | The waterfall's range. |
| `playhead` | none | The playhead's time, in ms. |
| `renderLink` | none | Links to the other end of a call, in the row. Must be stable. |
| `density` | `compact` | As DataTable's, with `compact` the default here. |
| `emptyState` | "No requests" | Shown with no rows. |
| `aria-label` | "Requests" | The grid's name. |

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

### The controller

`createDataTableController()` from DataTable; `setPlayhead(time)` moves the playhead with no React.

### Helpers

`REQUEST_COLUMNS` has the built-in columns' sizes and titles. `requestName(url)`, `requestStatusText(row)`, `requestDurationText(row)`, `requestSizeText(row)` ("280 B", "1.7 kB"), `requestTimeRange(rows)` and `isRequestFailed(row)` are the logic behind them, for a host showing the same request elsewhere.

## Styling

It is a DataTable (`data-slot="data-table"`, with its parts: see [DataTable](https://blamy.github.io/ui/#/data-table#styling)). What it adds: a row has `data-failed` and `data-pending`; a cell has `request-table-name`, `request-table-links` and `request-table-bar` (with `data-tone` and `data-pending`), a two-line row `request-table-waterfall`, the playhead's line is `request-table-playhead` in the grid's overlay, and a link is `request-table-link`. It takes its colors from the theme, on the surface DataTable and Spreadsheet use.

## cva recipes

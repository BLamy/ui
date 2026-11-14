# DataTable

Rows of data under columns that sort and resize: a virtualized grid that stays smooth at 100,000 rows, with a size class of its own that stacks the rows when it is narrow. Rows are plain objects with an `id`; a column says how wide it is, what its cells show and what it sorts by. It is the table under [RequestTable](https://blamy.github.io/ui/#/request-table) (a network pane with a waterfall and a playhead) and under the [SQL console](https://blamy.github.io/ui/#/sql-console)'s query results.

Use a sibling instead when the cells **edit** and select as ranges ([Spreadsheet](https://blamy.github.io/ui/#/spreadsheet)), when the rows are **log lines** of different heights with a "now" marker ([LogList](https://blamy.github.io/ui/#/log-list)), when they are **pressable rows** of a settings or navigation screen ([List](https://blamy.github.io/ui/#/lists)), when they form a **hierarchy** ([Tree](https://blamy.github.io/ui/#/tree)), or when they are requests ([RequestTable](https://blamy.github.io/ui/#/request-table), which is this with the request columns built in).

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/data-table.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { DataTable } from '@/components/ui/data-table'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { DataTable } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## Usage

Give it rows, columns and a sized parent (it fills it, and scrolls inside). A column without a `render` shows the row's field of the same name, and sorts by it.

```tsx
const columns: DataTableColumn<Order>[] = [
  { id: 'customer', title: 'Customer', flex: 2, minWidth: 140 },
  { id: 'items', title: 'Items', width: 64, align: 'end' },
  { id: 'total', title: 'Total', width: 96, align: 'end', render: (o) => money.format(o.total), sortValue: (o) => o.total },
]

<DataTable aria-label="Orders" rows={orders} columns={columns} value={selected} onValueChange={setSelected} className="h-96" />
```

{% demo src="data-table/basic" %}

Keep `columns` stable (a constant, or `useMemo`): a row only renders again when its row object or the columns change, which is what lets a table of 100,000 rows scroll at full speed.

## Columns

A column's width is fixed (`width`, in px) or a share of the spare width (`flex`, like `fr`, never under `minWidth`). Wider than the table, the columns scroll sideways. `align: 'end'` puts the header and the cells at the end in tabular figures, for numbers. `className` styles the cells (`text-muted-foreground`, `font-mono`), and `headerEnd` puts something after the title, like a unit or a total.

Dragging a header's edge resizes its column, and double-clicking the edge puts it back. While it drags it only writes a CSS variable, so no rows render, and it asks for the new width once, on release. `columnWidths` and `onColumnWidthsChange(widths, details)` save what the user chose, by column id; `details.reason` is `drag`, `resize-key`, `handle-press` (the double click) or `imperative`.

Pressing a header sorts: ascending, descending, then back to the rows' own order. Rows with nothing in the column stay at the end both ways, strings compare without regard to case, and dates sort by time. A column sorts by its `sortValue`, or its field; with a `render` and no `sortValue` it doesn't sort (set `sortable` to say otherwise). A new sort goes to the selected row, or else the top. `sort` / `defaultSort` / `onSortChange(sort, details)` make it controlled; `details.reason` is `trigger-press` for a header, `item-press` for the sort menu, `imperative` for the controller.

## Selection and presses

`selectionMode="single"` (the default) selects the row a press lands on: `value` / `defaultValue` / `onValueChange(id, details)`, with `aria-selected` and `data-selected` on the row. A new `value` that's out of view is scrolled to. `selectionMode="none"` leaves rows unselected, for a table whose rows open something. Either way `onAction(id, details)` hears a press, or Enter or Space, with `details.row` and `details.index`. A press on a control inside a row (a button, a link) is the control's, not the row's.

`rowProps(row)` gives a row `data-*` attributes from its data, for the cells' classes to read: `rowProps={(r) => ({ 'data-failed': r.failed })}` with a column `className` of `group-data-failed/row:text-destructive`.

## Narrow windows

The table has a size class of its own, from its own width and not the viewport's, so a side panel gets it too. It's written on the root as `data-size-class`. Compact, under 480 px, the rows stack: the first column's cell on the first line, the others' after it on a second, and sorting moves into a menu. `renderStackedRow(row)` draws a stacked row of your own (in a `DataTableCell` with `col={0}`), and `countLabel(count)` is what the stacked header says ("12 rows"). Medium, under 760 px, leaves out the columns with `hideBelow: 'regular'`. `breakpoints={{ medium, regular }}` moves those widths, and `layout="table"` or `layout="stacked"` holds it to one layout.

{% demo src="data-table/narrow" %}

## Toolbar, footer and empty state

`toolbar` sits above the grid, outside the scroller: a summary, a filter, actions. `footer` sits after the last row. With no rows the table shows `emptyState`, by default `<EmptyState size="sm" title="No rows" />`; give it an [EmptyState](https://blamy.github.io/ui/#/empty-state) of your own to say why and what to do.

{% demo src="data-table/toolbar" %}

## Rows on a timeline

For rows that happen in time (a recording's requests, a trace's events), `playhead`, `timeRange` and `rowTime(row)` dim the rows after the playhead (`data-future`) and write the playhead's share of the range on the grid as `--data-table-playhead` (with `data-playhead` while it's on the range), for an `overlay` to draw a line at. The overlay is drawn over the rows, sticky to the view and hidden from screen readers; it gets the columns shown and whether the rows are stacked. Moving the playhead renders no row, and the controller's `setPlayhead(time)` moves it with no React at all, for a clock's every tick. RequestTable is built this way.

## Query results

The SQL console shows each statement's result as a DataTable: one column per field, with the field's type in its header, numbers at the end, a long or structured value behind a button that shows all of it, and Copy CSV / Copy JSON in the `toolbar`. See [SqlConsole](https://blamy.github.io/ui/#/sql-console).

## Keyboard

| Key | Effect |
| --- | --- |
| `↑` `↓` | Move the active row. `↑` from the first row goes up to the headers, `↓` from a header back to the rows. |
| `Page Up` `Page Down` `Home` `End` | Move a screen, or to the first or last row. On the headers, `Home` and `End` go to the first or last. |
| `Enter` `Space` | Press the active row, or sort by the active header. |
| `←` `→` | Scroll sideways. On the headers, move between them. |
| `⌥←` `⌥→` | On a header, narrow or widen its column. With `⇧`, by more. |
| `Tab` | Go through the active row's own controls, then out of the table. |
| `Esc` | From a control, back to its row. On the headers, back to the rows. |

## Accessibility

It's an ARIA grid with one tab stop, built on [UI SDK](https://ui-sdk.dev)'s virtualizer, grid focus and resize: focus is on the active row or header itself, and the active row stays rendered while it has focus, so it can't be lost when the rows around it scroll out and unmount. A key that moves to a row that isn't rendered yet scrolls it in first. `aria-rowcount` gives the full length, each row has `aria-rowindex`, and a sortable column has `aria-sort`. The stacked sort menu is a [DropdownMenu](https://blamy.github.io/ui/#/dropdown-menu), and a column's edge is a `separator` you can drag with a mouse or a finger, or move with `←` `→` once it has focus. A press on a row is the row's own click, so touch, mouse and a screen reader's click all reach it. Name the table with `aria-label` (default "Rows").

## Props

### DataTable

| Prop | Default | Effect |
| --- | --- | --- |
| `rows` | required | The rows, each with an `id`. Keep the array stable between renders when nothing changed. |
| `columns` | required | The columns, in order. Keep it stable. |
| `selectionMode` | `single` | `single` or `none`. |
| `value` / `defaultValue` / `onValueChange` | none | The selected row's id, or `null`. `details.reason` is `item-press` or `imperative`. |
| `onAction` | none | `(id, details)`: a press, or Enter or Space on the active row, with `details.row` and `details.index`. |
| `sort` / `defaultSort` / `onSortChange` | none | `{ column, direction }`, or `null` for the rows' own order. |
| `columnWidths` / `defaultColumnWidths` / `onColumnWidthsChange` | their own sizes | Widths set so far, by column id. |
| `density` | `default` | `compact` (26 px rows, caption text), `default` (30 px) or `comfortable` (34 px, for touch). |
| `layout` | `auto` | `auto`, `table` or `stacked`. |
| `breakpoints` | `{ medium: 480, regular: 760 }` | Where the table's own size classes start, in px. |
| `renderStackedRow` / `countLabel` | first column over the rest / "12 rows" | The stacked layout's row and header. |
| `rowProps` | none | `data-*` attributes for a row, from its data. |
| `playhead` / `timeRange` / `rowTime` / `overlay` | none | Rows on a timeline (above). |
| `toolbar` / `footer` / `emptyState` | none / none / "No rows" | Above the grid, after the last row, and with no rows. |
| `controller` | none | `createDataTableController()`, to drive it from outside. |
| `aria-label` | "Rows" | The grid's name. |

`className`, `style` and the other props go to the root.

### A column

| Field | Effect |
| --- | --- |
| `id` / `title` / `label` | Which one (also the field it reads), its header, and its name in words when `title` isn't a string. |
| `width` / `flex` | A fixed width in px, or a share of the spare width. |
| `minWidth` / `maxWidth` | How far a resize can go. |
| `hideBelow` | `'regular'` (or `'medium'`): hidden while the table's size class is below that one. |
| `align` | `start` or `end`. |
| `render` / `className` / `headerEnd` | The cell (must be stable), the cells' classes, and what follows the title. |
| `sortable` / `sortValue` | Whether it sorts, and by what. |

### The controller

`createDataTableController()` makes one; pass it as `controller`.

| Method | Effect |
| --- | --- |
| `focus()` | Focuses the active row, or the row focus would start on. |
| `scrollToId(id, { align? })` | Scrolls to a row: `center` by default, or `start`, `end`, `auto` (only if it's out of view). |
| `setPlayhead(time)` | Moves the playhead with no React. The `playhead` prop takes over when it next changes. |
| `setValue(id)` / `setSort(sort)` / `setColumnWidths(widths)` | Selects a row, sorts, or sets the widths, as code (`reason: 'imperative'`). |

`sortDataTableRows(rows, sort, valueOf)` is the sort itself, for a host that shows the same rows elsewhere in the same order.

## Styling

The root is `data-slot="data-table"`, with `data-layout` (`table` or `stacked`), `data-density` and `data-size-class`; inside it `data-table-toolbar`, then `data-table-grid` (with `data-playhead` while the playhead is on the range), `data-table-overlay`, `data-table-head` around `data-table-header`, `data-table-rows`, `data-table-empty` and `data-table-footer`. A header is `data-table-column`, with `data-active`, and `data-table-resizer` (`data-dragging` while it drags); the stacked header has `data-table-heading`s. A row is `data-table-row`, with `data-selected`, `data-active`, `data-future` and whatever `rowProps` adds, and its cells are `data-table-cell` with `data-column`. Rows take the kit's data-row layers (`dataRowLayers`: hover, press, selection and the hairline under each row), the header cells `tableHeaderCellClass` and the edges `columnResizerClass`, which [Spreadsheet](https://blamy.github.io/ui/#/spreadsheet) shares.

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `dataTableVariants`

Defined in `@/components/ui/data-table`. Base classes:

```text
group/table relative flex h-full w-full min-h-0 min-w-0 flex-col overflow-hidden rounded-panel bg-card text-card-foreground after:pointer-events-none after:absolute after:inset-0 after:z-3 after:rounded-[inherit] after:shadow-hairline after:content-['']
```

**`density`** — default `default`

| Value | Adds |
| --- | --- |
| `compact` | `text-caption` |
| `default` (default) | `text-footnote` |
| `comfortable` | `text-footnote` |

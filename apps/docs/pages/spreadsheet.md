# Spreadsheet

A grid of cells for CSV files and other tables, from ten rows up to millions. Only the cells in view are in the page, so a million-row file scrolls as smoothly as a short one. You can edit cells in place, select ranges, copy and paste to and from other spreadsheets, undo, and resize columns. Sorting a number or date column runs as a WebGPU compute shader, and each number column's header shows a histogram tallied on the GPU. Without WebGPU, both run on the CPU and give the same answers.

Use [DataTable](https://blamy.github.io/ui/#/data-table) instead when people read and pick rows rather than edit cells: its unit is a row (selected and pressed as one, its cells reached one by one), with typed columns rendered by you. The two share the column edge (`columnResizerClass`) and the empty state.

It's one primitive built from UI SDK behaviors: [`createGridFocus`](https://ui-sdk.dev/docs/core/behaviors/focus) moves the active cell, [`createCellRange`](https://ui-sdk.dev/docs/core/behaviors/selection) selects blocks and reads them as tab-separated text (`cellsToText` / `textToCells`), [`createInlineEdit`](https://ui-sdk.dev/docs/core/behaviors/lists) edits a cell in place, `createUndoStack` keeps the history, [`createResize`](https://ui-sdk.dev/docs/core/behaviors/direct-manipulation) sizes the columns, and two [`createVirtualizer`](https://ui-sdk.dev/docs/core/behaviors/lists)s render only the rows and columns in view.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/spreadsheet.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { Spreadsheet } from '@/components/ui/spreadsheet'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from their module:

```tsx
import '@brett_lamy/ui/styles.css'

import { Spreadsheet } from '@brett_lamy/ui/spreadsheet'
```
{% endtab %}
{% endtabs %}

## Edit a table

Double-click a cell, or select it and start typing. Enter and Tab save the edit and move on; Esc cancels it. Drag across cells to select them, and the status bar shows their sum, average and count. Click a column's arrows to sort it: ascending, then descending, then back to the file's order.

{% demo src="spreadsheet/basic" %}

```tsx
import { Spreadsheet } from '@/components/ui/spreadsheet'
import { parseCsv } from '@/lib/csv'

const [rows, setRows] = useState(() => parseCsv(text).rows)

<Spreadsheet aria-label="Parts" value={rows} onValueChange={setRows} />
```

Cells are strings and are shown as written: `1,234.50` stays `1,234.50`. A column whose values all read as numbers (thousands commas, a currency sign, `%` and `(12)` negatives included) or as ISO dates is right-aligned, sorts by value and gets a histogram. Any other column sorts as text, in natural order ("file 2" before "file 10"), ignoring case. Empty cells sort last in both directions.

With titles and no rows, the titles stay and `emptyState` shows under them: a `status` region beside the grid, not in it (a grid owns only rows). To start, press Add Row, or paste: an empty sheet's grid is itself the tab stop (Tab to it, or click the empty region), described by the empty state, and ⌘V / Ctrl+V there writes the clipboard's cells from the first one. A read-only empty sheet takes no focus.

{% demo src="spreadsheet/empty" %}

## Open and save a CSV

`parseCsv` reads RFC 4180 CSV (quoted fields, `""` escapes, line breaks inside quotes). It detects the delimiter (comma, tab, semicolon or pipe) and remembers the line ending, byte-order mark and final newline. `stringifyCsv` writes the rows back in that same format, so a file you open and save changes only where you edited it.

{% demo src="spreadsheet/csv-file" %}

```tsx
import { delimiterForPath, parseCsv, stringifyCsv } from '@/lib/csv'

const { rows, ...format } = parseCsv(await file.text(), { delimiter: delimiterForPath(file.name) })
// … edit rows in a Spreadsheet …
const text = stringifyCsv(rows, format)
```

The [Apple Notes block](https://blamy.github.io/ui/#/blocks) opens `.csv` and `.tsv` files from a folder this way and saves your edits back to the file.

## A million rows on the GPU

{% demo src="spreadsheet/million-rows" %}

When you sort a number or date column, each value becomes an exact 64-bit key: the double's bits in an order-preserving encoding, split into two 32-bit words, so nothing is rounded to a 32-bit float. A bitonic sort in a WebGPU compute shader sorts the keys together with the row indexes. Each step of the network is one dispatch in a single compute pass, and the row index breaks ties, so the sort is stable. The CPU fallback compares the same keys and returns the same order.

The histograms use one GPU thread per value. Each workgroup tallies its values in shared memory, then adds its tally to the output once. The bin edges are computed in 32-bit floats on both paths.

Sorting is a view: `onValueChange` always gets rows in the file's order, and editing a sorted table doesn't move rows around. Sort again to re-sort. The sort itself is state you can hold: `sort` / `defaultSort` / `onSortChange(sort, details)`, with `{ column, direction }` by column index (`details.reason` is `trigger-press` for a column's button, `imperative` for the controller, and `details.cancel()` keeps the current sort). New rows from outside keep the sort, sorted again.

{% hint style="info" %}
**When the GPU runs.** With `engine="auto"` (the default), the GPU handles sorts and histograms of at least `gpuMinRows` rows (20,000 by default) on a hardware adapter. Smaller jobs stay on the CPU, because uploading the data and reading it back costs more than the GPU saves. A software adapter (SwiftShader in headless CI, llvmpipe), no WebGPU at all, or a GPU error also means the CPU. `engine="gpu"` uses any adapter at any size; `engine="fallback"` never touches the GPU. Text columns always sort on the CPU, and so do tables over 8 million rows (the most one 128 MiB buffer holds). The status bar and `onSorted` say which engine ran and how long it took, upload and readback included.
{% endhint %}

## Keyboard

The grid is one tab stop: the active cell, or, while the sheet has no rows, the grid itself, which takes a paste. Inside it:

| Keys | Action |
| --- | --- |
| Arrow keys | Move; with ⇧, extend the selection; with ⌘ / Ctrl, jump to the edge (with ⇧ too, extend to it). Left and right swap in right-to-left text |
| Home / End, Page Up / Page Down | Start or end of the row (⌘ for the whole table, ⇧ to extend), a screen up or down |
| ⇧ Space, Ctrl Space | Select the rows, or the columns, the selection covers |
| Enter, F2, or typing | Edit the cell (typing replaces it) |
| Enter / ⇧ Enter, Tab / ⇧ Tab | While editing: save and move down / up, right / left |
| Esc | Cancel the edit, or shrink the selection to one cell |
| Delete, Backspace | Clear the selected cells |
| ⌘C, ⌘X, ⌘V | Copy, cut and paste tab-separated text. Pasting one value into a larger selection fills it, and a paste past the last row adds rows |
| ⌘A | Select all |
| ⌘Z, ⇧⌘Z (or ⌘Y) | Undo, redo (100 steps) |
| ⌥← / ⌥→ | Narrow or widen the column (16 px, 64 px with ⇧) |

Screen readers hear each change of the selection from the keyboard ("2 rows by 2 columns selected"), and the result of a sort.

With the mouse, click a column's title to select the column, a row number to select the row, and the corner to select everything; ⇧-click stretches the selection from the active cell, and dragging across cells paints it, scrolling near the edges. Drag a column's right edge to resize it, or double-click the edge to fit the column again. With `header`, double-click a title to rename the column.

## Props

| Prop | Default | Effect |
| --- | --- | --- |
| `value` / `defaultValue` | — | Rows of string cells; rows may differ in length. With `header`, row 0 holds the titles. |
| `onValueChange` | — | `(rows, details)`: every edit, paste, cut, undo and added row, in the data's own order. `details.reason` is `cell-edit`, `paste`, `cut`, `clear`, `add-row`, `undo`, `redo` or `imperative`; `details.source` says whether a person or an agent did it, and `details.cancel()` refuses it. |
| `header` | `true` | The first row is column titles. Without it, columns are lettered A, B, C… |
| `readOnly` | `false` | No editing, pasting or Add Row. Selecting, copying and sorting still work. |
| `engine` | `auto` | Where sorts and histograms run: `auto`, `gpu` or `fallback` (see above). |
| `gpuMinRows` | `20000` | The smallest job `auto` sends to the GPU. |
| `histograms` | `true` | A histogram under each number or date column's title. |
| `sort` / `defaultSort` / `onSortChange` | none | The sort asked for, `{ column, direction }` by column index, or `null` for the file's order. `onSortChange` hears it before it runs. |
| `onSorted` | — | `{ column, direction, ranOn, ms, rows }` once a sort has run; `null` when the sort is cleared. |
| `density` | `compact` | Row height: `compact` (28 px), `default` (32 px) or `comfortable` (36 px, for touch). |
| `statusBar` | `true` | The status bar: size, sort timing, the selection's sum and average, Add Row. |
| `actions` | — | Extra controls at the end of the status bar. |
| `emptyState` | "No rows" | Shown under the titles with no rows: an [EmptyState](https://blamy.github.io/ui/#/empty-state) that says to paste cells or add a row (not when read-only). A string replaces the whole default, so it is a title with no description. |
| `columnWidth` | `120` | Width of an empty column. Other columns start sized to their title and first rows (up to 320 px). |
| `columnWidths` / `defaultColumnWidths` | — | Widths set so far, in px by column index (`{ "0": 180 }`). A column with none keeps its estimated size. |
| `onColumnWidthsChange` | — | `(widths, details)` after a drag ends (`drag`), a key moves an edge (`resize-key`), a double-click fits a column (`handle-press`), or code sets them (`imperative`). |
| `controller` | — | A `createSpreadsheetController()` handle (see below). |

Give the Spreadsheet a height (`h-[420px]`, or `flex-1` in a flex column), because it scrolls inside itself.

## Drive it from outside

A controller calls the grid's own actions, the same ones an agent gets through UI SDK's agent bridge. Cells are in view coordinates: `{ row, col }`, where `row` counts the displayed rows (after sorting) from 0, and row `-1` is the titles.

```tsx
import { Spreadsheet, createSpreadsheetController } from '@/components/ui/spreadsheet'

const sheet = createSpreadsheetController()

<Spreadsheet controller={sheet} value={rows} onValueChange={setRows} />

sheet.select({ row: 0, col: 0 }, { row: 9, col: 2 })   // a block, scrolled into view
sheet.copy()                                            // its tab-separated text
sheet.edit({ row: 3, col: 1 }, '42')
sheet.paste('a\tb\nc\td')
await sheet.sort(2, 'descending')                       // or null to clear; no direction steps like the button
sheet.undo()
```

It also has `focus()`, `clear()`, `redo()`, `addRow()` and `setColumnWidths(widths)`.

## Parts and attributes

The root is `data-slot="spreadsheet"`, and inside it `spreadsheet-grid` (`role="grid"`), two `spreadsheet-rowgroup`s, `spreadsheet-row`s, `spreadsheet-corner`, `spreadsheet-column` (a title, with `data-selected` when the selection covers it, and its `spreadsheet-resizer`, with `data-dragging`), `spreadsheet-rowheader` (`data-selected`), `spreadsheet-cell`, `spreadsheet-editor`, then, with no rows, `spreadsheet-empty` after the grid, and `spreadsheet-footer` (the status bar). The corner's column header is named "Row number" by visually hidden text. A cell has `data-active` while it is the active cell, `data-editing`, and from the cell range `aria-selected`, `data-selected` and `data-range-edge` (`top`, `right`, `bottom`, `left`), which draws the selection's outline.

## The model

The data side has no UI and works on its own, for example to sort rows on a server or in a worker:

```tsx
import { sortRows, selectionStats, columnHistogram, columnNumbers } from '@/lib/spreadsheet-model'

const { order, ranOn, ms } = await sortRows(rows, { column: 2, direction: 'descending' }, { from: 1 })
const sorted = Array.from(order, (i) => rows[i + 1])

selectionStats(['12', '3.5', 'n/a'])   // { count: 3, numbers: 2, sum: 15.5, average: 7.75, min: 3.5, max: 12 }
await columnHistogram(columnNumbers(rows, 2, 1), 16)   // { bins, min, max, ranOn }
```

`sortKeys` and `sortPermutationCpu` give you the exact keys and the stable CPU sort, and `parseCellNumber` / `parseCellDate` read a cell the way the grid does.

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `spreadsheetVariants`

Defined in `@/components/ui/spreadsheet`. Base classes:

```text
relative flex min-h-0 min-w-0 flex-col overflow-hidden rounded-panel bg-card text-card-foreground shadow-hairline
```

**`density`** — default `compact`

| Value | Adds |
| --- | --- |
| `compact` (default) | — |
| `default` | — |
| `comfortable` | — |

# Selection

Three UI SDK behaviors cover choosing things: `createSelection` picks item keys (one, many, or a Shift range), `createLasso` selects whatever a dragged rectangle touches, and `createCellRange` selects a block of grid cells and reads it as text for the clipboard. `cellsToText` and `textToCells` convert between rows of cells and the tab-separated text spreadsheets put on the clipboard, which is what replaces the old react-aria clipboard hooks. They are listed with the other behaviors in the [behaviors overview](https://blamy.github.io/ui/#/behaviors); the upstream reference is [Selection](https://ui-sdk.dev/docs/core/behaviors/selection).

Nothing to install: they come from `@ui-sdk/core`. Selection is about *which* items are chosen; moving between them is [Focus and keys](https://blamy.github.io/ui/#/behaviors-focus), and the two are used together.

```ts
import { createSelection, createLasso, createCellRange, byCellRange, cellsToText, textToCells, createChange } from '@ui-sdk/core'
```

## Already done for you

| Need | Use |
| --- | --- |
| A list to pick one or many from | [`Listbox`](https://blamy.github.io/ui/#/listbox) (`multiple`, `value`, `onValueChange`), on UI SDK's Listbox. |
| A tree with selectable rows | [`Tree`](https://blamy.github.io/ui/#/tree), on UI SDK's Tree. |
| Toggle buttons, radio, segmented | [`ToggleGroup`](https://blamy.github.io/ui/#/toggle), [`RadioGroup`](https://blamy.github.io/ui/#/radio-group), [`Segmented`](https://blamy.github.io/ui/#/segmented). |
| A sheet of cells | [`Spreadsheet`](https://blamy.github.io/ui/#/spreadsheet). |

Reach for the behaviors when you build a primitive of your own: a file grid, a canvas, a calendar of slots.

## Selecting items

`createSelection(context, { key, set, order, multiple, selectable })` keeps the selected keys in a `string[]` in your state (`key: 'value'`, even for single selection) and hands every change to `set`, which you connect to `createChange` so `onValueChange(value, details)` fires with a reason. `order()` is the list ranges and select-all walk through, usually `roving.items().map((item) => item.key)`; for a virtualized list, pass every key, rendered or not.

It gives you methods to call from your handlers:

| Method | Does |
| --- | --- |
| `choose(key, why)` | Select only this item. |
| `toggle(key, why)` | Add or remove it (in single mode, select or clear it). |
| `extend(key, { from, additive, ...why })` | Select from the anchor (the last item chosen or toggled without Shift) to `key`. `from` is the starting point when there is no anchor yet; `additive: false` replaces the selection with the range. |
| `toggleAll(why)` | In multiple mode, select every selectable key in `order`, or clear them if they are all selected. |
| `isSelected(key)`, `anchor()` | Read. |

`selectable(key)` skips keys that should not be chosen, toggled or ranged over. It doesn't pin a key in the selection: `choose` can still replace everything, so enforce "always selected" in `set` if you need it.

The example is a file list with the usual desktop rules: click, Command or Control-click, Shift-click, Shift+arrows, Space and Command or Control+A. Shift+arrows come from the roving focus handler, whose return value says where focus moved and whether Shift was held:

```ts
const moved = roving.keydown(event, el)
if (moved?.shift) selection.extend(moved.key, { from: moved.from, reason: 'list-navigation', event })
```

{% demo src="behaviors-selection/file-list" %}

Verified in happy-dom with the example above (UI SDK strict mode on):

- **Click** selects one file (`reason: 'item-press'`); **Shift-click** two rows down selects the three files between; **Command-click** adds a fourth without dropping the range.
- **Shift+ArrowDown** twice from the first file selects three files (`reason: 'list-navigation'`). A plain ArrowDown afterwards moves focus and keeps the selection; **Space** then adds the focused file.
- **Command+A** selects all six; pressed again it clears them.

For ARIA, the root is `role="listbox"` with `aria-multiselectable="true"`, each item `role="option"` with `aria-selected`; the kit's styles read `data-selected`, which the example writes too.

## Rectangle selection

`createLasso(context, { slot, draft, selected, set })` selects the items of `slot` that a dragged rectangle touches. Keep `selected: string[]` and `lasso: LassoDraft | null` in state, and list `lasso` in the primitive's `live` keys so the drag updates attributes without a render per pointer move. Start it on a press on the surface's empty space:

```ts
root: slot({
  on: { pointerdown: (event, { el, api }) => event.target === el && api.lasso.pointerdown(event, el!) },
}),
```

`lasso.touches(state, key)` is the preview (write it as `data-lassoed` through `live`), and `lasso.style(state)` positions the rectangle part, or hides it with `display: none` when nothing is being drawn. Give the surface `relative`, `touch-none` and `select-none` so drawing doesn't scroll or select text. `selectable(key)` leaves items out, and `message(count)` replaces the screen reader announcement made on release.

{% demo src="behaviors-selection/lasso" %}

Verified in happy-dom (with element boxes stubbed, since happy-dom has no layout):

- During the drag, the rectangle part gets its `left`, `top`, `width` and `height`, and only the shapes it touches get `data-lassoed`.
- The selection changes **once, on release**, with `reason: 'lasso'`. A plain drag replaces the selection.
- **Escape** during the drag cancels it: the earlier selection stays.

From the upstream docs: Shift adds to the selection, and `touches` then includes what was selected before the drag.

## Ranges of cells

`createCellRange(context, { key, grid, rows, cols })` sits on top of a [`createGridFocus`](https://blamy.github.io/ui/#/behaviors-focus) grid. Keep `range: CellRange | null` in state, then let the range handle the cell's events: `range.keydown` passes ordinary navigation on to the grid, and `range.bind` binds grid focus too, so you don't call both.

```ts
cell: slot({
  selects: selects({ active: byCell, range: byCellRange }),
  attrs: (state, { props, api }) => ({ role: 'gridcell', tabindex: api.grid.tabIndex(state, props), ...api.range.cellAttrs(state, props) }),
  on: {
    keydown: (event, { api }) => api.range.keydown(event),
    pointerdown: (event, { api, props }) => api.range.pointerdown(event, props),
  },
  bind: (el, { api, props }) => api.range.bind(el, props),
}),
```

`cellAttrs` writes `aria-selected`, `data-selected` and `data-range-edge` (the sides of the range a cell sits on, such as `"top left"`, for an outline with `[data-range-edge~="top"]`). Drag across cells or hold Shift with the arrows to grow the range; Shift+Space selects its rows, Control+Space its columns, Control+A everything, Escape clears it. From code: `select({ anchor, end })`, `selectRows(from, to)`, `selectColumns(from, to)`, `selectAll()`, `select(null)`. `bounds(state)` gives the inclusive `top`, `left`, `bottom`, `right` (or the active cell when there's no range), and `contains(state, cell)` is how the example totals the selected revenue.

### Copy and paste

Use the platform's `copy` and `paste` events on the grid element: their `clipboardData` reads and writes synchronously, with no permission prompt. Verified in headless Chromium: Command or Control+C on a focused, non-editable cell fires `copy` at that cell, so a listener on the grid gets it as it bubbles. (`document.execCommand('copy')` fires it at the body instead.)

```ts
copy(event: ClipboardEvent) {
  const state = store.get()
  event.preventDefault()
  event.clipboardData?.setData('text/plain', range.text(state, ({ row, col }) => state.cells[row][col]))
},
paste(event: ClipboardEvent) {
  const bounds = range.bounds(store.get())
  if (!bounds) return
  event.preventDefault()
  const rows = textToCells(event.clipboardData?.getData('text/plain') ?? '')
  // write rows into state from bounds.top / bounds.left, stopping at the grid's edges
},
```

`range.text` reads the selected block as tab-separated rows; `textToCells` turns pasted text (from this grid, a spreadsheet or a plain list) back into rows; `cellsToText(rows)` does the reverse for any rows, such as the whole sheet.

{% demo src="behaviors-selection/cell-range" %}

Verified in happy-dom:

- From Price on the Tea row, Shift+ArrowDown then Shift+ArrowRight selects the 2×2 block `3 12 / 4 9`; the four cells carry `data-range-edge` `top left`, `top right`, `bottom left`, `right bottom`, and the selected revenue reads 72.
- **Copy** writes `"3\t12\n4\t9"` as `text/plain` and the handler prevents the default. **Escape** clears the range.
- **Paste** with the empty bottom row's Price cell active writes `3` and `12` into that row and drops the second pasted row, which would fall off the sheet.
- **Control+A** selects all 12 cells.

### Outside a grid, and the async Clipboard API

For a "Copy" button there is no `copy` event to answer, so use `navigator.clipboard.writeText(text)` (the example's "Copy whole sheet" does, with `cellsToText`). It needs a secure context and a user gesture, and the promise rejects when the page isn't allowed to write, so catch it. Nothing on screen changes when a copy succeeds, so say so with `announce('Copied')` from `@ui-sdk/core` (see [Platform](https://ui-sdk.dev/docs/core/platform)). Reading with `navigator.clipboard.readText()` asks the user for permission in most browsers; prefer the `paste` event, which gets the text without asking.

For a single field or a code block, copy and paste need nothing from UI SDK: the browser handles text fields, and `copy` / `paste` listeners on any element let you change what goes to or comes from the clipboard (`event.clipboardData.setData('text/html', …)` next to `text/plain`, or `getData('text/html')` on paste). Files pasted from the system arrive in `event.clipboardData.files`; the kit's [`FileUpload`](https://blamy.github.io/ui/#/file-upload) takes them while focus is inside it.

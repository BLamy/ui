# Drag and drop

UI SDK's drag and drop works inside the page, with the pointer and the keyboard alike. `createReorder` sorts a list or a grid, `createTreeReorder` moves rows and their subtrees in an outline, and `createTransfer` moves items between lists; each keeps a draft while an item moves and commits it once, on drop, through your change, and each announces the pickup, the moves and the drop to screen readers. Under them are the pieces for a drag of your own: `bindDrag` follows a pointer, `bindDragPreview` drags a copy of an element, and `createAutoScroll` scrolls when the pointer nears an edge. They are listed with the other behaviors in the [behaviors overview](https://blamy.github.io/ui/#/behaviors); the upstream reference is [Drag and Drop](https://ui-sdk.dev/docs/core/behaviors/drag-and-drop).

Nothing to install: they come from `@ui-sdk/core`. For freely placed objects (stickers, windows, handles), see [Dragging and resizing](https://blamy.github.io/ui/#/behaviors-dragging).

```ts
import {
  createReorder, createTreeReorder, createTransfer,
  bindDrag, dragThreshold, bindDragPreview, createAutoScroll, announce, createChange,
} from '@ui-sdk/core'
```

{% hint style="warning" %}
**These are not HTML5 drag and drop.** None of them uses `draggable` or a `DataTransfer`, so nothing they drag can leave the page (into another window, an editor or the desktop), and they don't receive drops from outside it. UI SDK has no native drag source or drop target behavior. For **files from the operating system**, use the kit's [`FileUpload`](https://blamy.github.io/ui/#/file-upload) (`FileDropZone` is the target; it is built on UI SDK's FileInput and takes drops, browsing and pastes). For **other native drags**, use the platform events directly: `draggable` with `dragstart` and `event.dataTransfer.setData(type, value)` on the source, and `dragover` (call `preventDefault()` to accept), `dragleave` and `drop` (`event.dataTransfer.getData(type)`, `.files`) on the target. That is what the kit's `Tree` does for rows dragged out of a file tree. A native drag has no keyboard route, so keep another way to do the same thing, such as a "Move to…" menu.
{% endhint %}

## Already done for you

| Need | Use |
| --- | --- |
| Tabs dragged between panes and edges, with the keyboard too | [`Workspace`](https://blamy.github.io/ui/#/workspace): `createTransfer` for the move, `bindDrag` with `bindDragPreview` for the pointer, `createAutoScroll` near the tab strips. |
| Files dropped from the computer | [`FileUpload`](https://blamy.github.io/ui/#/file-upload). |
| Rows dragged out of a tree as data | [`Tree`](https://blamy.github.io/ui/#/tree)'s data form (native events, see the hint above). |

## Sorting a list

Keep the committed order in a `string[]` and a `ReorderDraft | null` beside it, starting at `null`:

```ts
const reorder = createReorder(context, {
  slot: 'item',
  key: 'value',
  draft: 'moving',
  set: (value, details) => change('value', value, details),
})
```

Render from `reorder.order(state)`, which reads the draft during a move, and keep each item's React key stable. On the item, run the reorder's handler **before** roving focus, so the arrows move focus until an item is picked up and move the item after:

```ts
on: {
  keydown: (event, { el, api, key }) => api.reorder.keydown(event, key) || api.roving.keydown(event, el!),
  pointerdown: (event, { api, key }) => api.reorder.pointerdown(event, key),
},
bind: (el, part) => {
  const cleanups = [part.api.roving.bind(el, part), part.api.reorder.bind(el, part)]
  return () => cleanups.forEach((cleanup) => cleanup())
},
```

During a pointer drag the behavior writes `--drag-x` and `--drag-y` on the item. The example keys its styles to its own `data-grabbed` (`state.moving?.key === key`): `data-grabbed:translate-x-(--drag-x) data-grabbed:translate-y-(--drag-y) data-grabbed:z-10`. Give items `touch-none select-none` so a drag doesn't scroll or select text.

{% demo src="behaviors-drag-drop/sortable" %}

Verified in happy-dom with the example above (UI SDK strict mode on):

- **Keyboard.** Space on Spring picks it up (`aria-selected="true"`); ArrowDown twice and Space drop it third: `Summer, Autumn, Spring, Winter`, reported once with `reason: 'move-key'`. Focus stays on Spring. A screen reader hears "Dropped Spring at position 3 of 4."
- **End and Escape.** Enter picks up Summer, End moves it last, and Escape puts it back: "Moved Summer back to position 1 of 4." No change is reported.
- With nothing picked up, Home is roving focus again.
- **The name read out comes from the item's text** (`labelOf`), so the position number is `aria-hidden`; without that the announcement read "Dropped 3Spring". Pass `label: (key) => …` when the visible text says more than the name.

Options worth knowing, from the types and upstream: `orientation: () => 'grid'` (or `'horizontal'`) for items that wrap; `group(key)` moves a selection together; `preview: true` drags a copy above the page, for a list that clips (auto-scroll comes with it); `disabled(item)` stops a pickup; `message` rewrites one announcement and keeps the rest (`reorderMessage` is the default). From code, `move(key, index)` (reason `imperative`), or `grab(key)`, `moveTo(index)` and `drop()` or `cancel()` for buttons that work one step at a time.

### Trees

`createTreeReorder(context, { key, draft, set, indent })` does the same for a flat array of `{ key, depth }` rows in reading order: moving a parent moves its subtree, and dragging sideways (or Left and Right with an item picked up) changes its depth, by `indent` pixels per level. `set` details carry the new `parent` and `index`, for an app that stores a nested tree; `maxDepth` and `disabled` limit what can go where. It places a row *between* rows at a depth, which is an outline; "drop into this folder" is not what it does.

## Moving between lists

`createTransfer` keeps every list in one `Record<string, string[]>` (item keys unique across all of them) with a `TransferDraft | null`. Bind each list with `bindList(el, key)` and each item with `bindItem(el, key)`, and run `transfer.keydown` before roving focus as above. It always drags a copy and auto-scrolls; the original gets `transfer.dragging(state, key)` (written as `data-dragging` here), and `transfer.moving(state, key)` covers a keyboard move too.

```ts
const transfer = createTransfer(context, {
  key: 'lists',
  draft: 'moving',
  set: (value, details) => change('lists', value, details), // details: key, from, to, index
  order: () => ['closet', 'bag'],      // how Left and Right travel between lists
  listLabel: (list) => NAMES[list],    // what the announcements call a list
})
```

{% demo src="behaviors-drag-drop/transfer" %}

Verified in happy-dom:

- Space on Boots, ArrowRight, ArrowDown and Space moves it from Closet to the end of Bag (`reason: 'move-key'`); while it moves, the draft already shows it in Bag. Focus stays on Boots. A screen reader hears "Dropped Boots in Bag, position 3 of 3."

`accepts(key, list)` refuses a destination (a column that holds at most two cards), `disabled(key)` a pickup. `transfer.move(key, list, index)` moves at once; `grab`, `moveTo(list, index)` and `drop` or `cancel` stage it.

## A drag of your own

When none of the above fits, build the drag from the same pieces:

- **`bindDrag(el, event, options)`** follows the pointer that pressed `el`. Call it from `pointerdown`, keep its cleanup (and call it from `context.onDestroy`). `threshold: dragThreshold` waits for a few pixels before `onStart`; `onMove({ x, y, movementX, movementY })` runs at most once a frame; `onEnd(event, canceled)` reports Escape (`cancelOnEscape`) or the browser taking the pointer. `lock: true` uses pointer lock for a scrubber that can go past the screen's edge. It only tracks the pointer: what each position means, and the keyboard route, are yours.
- **`bindDragPreview(el, { x, y })`** clones the element into the top layer (with a fixed-position fallback) and returns `{ el, move(x, y), remove() }`. The copy has `data-drag-preview`, no ids, and is hidden from assistive technology and from pointer hit-testing, so `elementFromPoint` sees what is under it. It does not re-render, so style it through `preview.el`, as the example does with `data-over`.
- **`createAutoScroll({ edge, speed, ignore, onScroll })`** scrolls the nearest scroller under the pointer when it is within `edge` pixels of its side. Call `update(x, y)` on each move and `stop()` on every way out.
- **`announce(text)`** tells a screen reader what happened, since nothing else will.

{% demo src="behaviors-drag-drop/drag-preview" %}

Verified in happy-dom: Enter on a focused tag adds it (`reason: 'item-press'`) and announces "Design added to Launch plan". The pointer path (threshold, preview, drop over the note) was not exercised, since happy-dom has no layout; it follows the upstream `drag-preview` example.

### Keeping focus and the draft

The sorting behaviors already keep focus on the moved item and keep a committed draft on screen while a controlled value catches up. In a drag of your own, call [`keepFocus`](https://blamy.github.io/ui/#/behaviors-focus) after moving a focused element, and see [handling changes](https://ui-sdk.dev/docs/core/kernel/handle-changes) for `settleDraft`.

# Drag and drop

react-aria's drag and drop is the browser's native drag and drop with a full keyboard and screen reader route on top. It comes in three layers: `useDrag` and `useDrop` for any element (and `DropZone`, a ready-made drop target), `useDragAndDrop` for reordering and moving between the items of a collection, and `useDraggableCollection` and `useDroppableCollection`, the low-level pieces under it. All of them are in the [react-aria hooks overview](https://blamy.github.io/ui/#/aria-hooks).

Nothing to install: `useDrag`, `useDrop` and the collection hooks come from `react-aria`, which BL UI already depends on; `DropZone`, `FileTrigger` and `useDragAndDrop` come from `react-aria-components`.

```tsx
import { useDrag, useDrop, isTextDropItem, isFileDropItem } from 'react-aria'
import { DropZone, FileTrigger, useDragAndDrop, useListData } from 'react-aria-components'
```

{% hint style="warning" %}
**Take `useDrag` and `useDrop` from the same package as the other end of the drag.** A drag session is module-level state, so two copies of react-aria cannot see each other's drags with the keyboard. Verified in this repository: `useDrag` from `react-aria` (3.52.1) starts a keyboard drag that cannot land on react-aria-components' `DropZone` (3.51.0); `useDrag` from `react-aria-components` can. See "One copy of react-aria" on the [overview](https://blamy.github.io/ui/#/aria-hooks).
{% endhint %}

## `useDrag` and `useDrop`

```ts
function useDrag(options: DragOptions): DragResult
function useDrop(options: DropOptions): DropResult
```

| `useDrag` option | Effect |
| --- | --- |
| `getItems` | Required. Returns the items being dragged: `DragItem[]`, each `{ [type]: string }`. |
| `onDragStart`, `onDragMove`, `onDragEnd` | The drag lifecycle. `onDragEnd` has the `dropOperation` that happened (`'copy'`, `'move'`, `'link'` or `'cancel'`). |
| `getAllowedDropOperations` | Which operations targets may choose. Default: all. |
| `preview` | A ref to a function that renders the drag image. |
| `hasDragButton` | The item has a separate focusable drag handle; then `dragProps` leave out the keyboard handlers and `dragButtonProps` carry them. |
| `isDisabled` | Not draggable. |

It returns `{ dragProps, dragButtonProps, isDragging }`.

| `useDrop` option | Effect |
| --- | --- |
| `ref` | Required. The drop target element. |
| `getDropOperation(types, allowedOperations)` | Returns `'copy'`, `'move'`, `'link'` or `'cancel'` for the drag's types. `'cancel'` means "not a valid target". Check with `types.has('text/plain')`. |
| `getDropOperationForPoint` | The same, with the pointer position. |
| `onDropEnter`, `onDropMove`, `onDropActivate`, `onDropExit` | The drag is over the target; held over it for a while; left. |
| `onDrop` | The drop. `e.items` is a `DropItem[]` (text, file or directory), `e.dropOperation` is what to do. |
| `hasDropButton` | A separate drop affordance, as `DropZone` has. |
| `isDisabled` | Accepts nothing. |

It returns `{ dropProps, isDropTarget, dropButtonProps }`. `DropItem` and its readers are the same as on the [Clipboard](https://blamy.github.io/ui/#/aria-clipboard) page: text and files are read asynchronously with `getText(type)` and `getFile()`.

{% demo src="aria-drag-drop/drag-text" %}

The draggable and the target both need to be focusable (`role="button"`, `tabIndex={0}`), because the keyboard route moves focus between them.

Verified in Chromium:

- **Mouse.** Dragging a chip onto the basket drops it. The target has `isDropTarget` while a valid drag is over it, and the chip has `isDragging` while it is being dragged; both clear on drop.
- **What travels.** During the drag, `dataTransfer.types` lists `text/plain`, `application/x-bl-fruit` and `application/vnd.react-aria.items+json`: an item with more than one representation also carries the JSON form, the same as on the clipboard.
- **Keyboard.** Focus a chip and press Enter. The drag starts and focus **moves to the first valid drop target**; press Enter again to drop. Escape cancels and focus returns to the chip. (From the source, the drag starts on the key's *release*.) With several targets, Tab moves between them.
- **Releasing over something that is not a target** drops nothing.
- **A press at the exact center of the draggable does not start a native drag.** react-aria reads a pointer within half a pixel of the element's center as an assistive-technology click (it is how Android TalkBack clicks arrive) and starts the *accessible* drag instead. That matters for tests: Playwright's `click()` and `dragTo()` press at the center, so offset the press by a few pixels (the specs for these pages do).
- **From the source:** a drag started by `useDrag` may only be dropped on a `useDrop` target; a drop anywhere else is prevented and logs a console warning. This was not triggered here.

### Screen reader announcements

react-aria writes to a live region (two `role="log"` elements, one assertive and one polite) as the drag moves. Read from the page's DOM during the keyboard runs above:

| When | Text (English) |
| --- | --- |
| Drag starts | "Started dragging. Press Tab to navigate to a drop target, then press Enter to drop, or press Escape to cancel." |
| Drag over a list position | "Insert between Nightcall and Midnight City" |
| Dropped | "Drop complete." |
| Cancelled | "Drop canceled." |

The draggable's `aria-describedby` points at a hidden description. Verified: "Press Enter to start dragging." once the page is in keyboard modality, and "Click to start dragging." when the modality is unknown. The source's string table also has "Double tap to start dragging." for touch, "Long press to start dragging." and, for a list, "Press Alt + Enter to start dragging." where Enter is already taken. The strings are translated with the active locale. **What a screen reader actually speaks was not verified**: only the text react-aria puts in the DOM was.

Moving the drop position with the arrow keys inside a list changes **focus** to a drop indicator with an accessible name such as "Insert between Heat Waves and Dreams" (verified); only the first position, not each later one, is added to the live region.

## `DropZone`

An area into which files or text can be dropped, built on `useDrop` with a visually hidden button so it works with the keyboard and screen readers. Pair it with `FileTrigger` for "or choose files".

```tsx
<DropZone onDrop={async (e) => setDropped(await read(e.items))} className="… data-drop-target:border-primary data-focus-visible:ring-[3px]">
  <Text slot="label">Drop files or text here</Text>
  <FileTrigger allowsMultiple onSelect={(files) => …}>
    <Button>Choose files</Button>
  </FileTrigger>
</DropZone>
```

Its props are `useDrop`'s (without `ref`, `getDropOperationForPoint` and `hasDropButton`), plus `className`/`style` that can be functions of its render state. The state is exposed as `data-hovered`, `data-focused`, `data-focus-visible`, `data-drop-target` and `data-disabled`.

{% demo src="aria-drag-drop/drop-zone" %}

Verified in Chromium: a text drop (dispatched as the native drag events, with `text/plain` and `text/html`) lists as `text · text/plain, text/html`; `data-drop-target` is set while the drag is over the zone; `FileTrigger` lists the files chosen through its hidden input; and the zone has its hidden button, reachable by name. **Not verified:** a real file drag from the operating system (Playwright cannot start one). A synthetic `DataTransfer` gives file items with no file-system entry, and react-aria skips items it cannot make an entry for, the same limit as for [pasted images](https://blamy.github.io/ui/#/aria-clipboard); the Composer's drop target keeps `dataTransfer.files` from the native `drop` event as a fallback for exactly that. The keyboard landing on the zone was verified only as far as the button existing.

## `useDragAndDrop`

Reordering and moving between collections. `useDragAndDrop` returns `dragAndDropHooks`; pass them to a react-aria-components `ListBox`, `GridList`, `Table` or `Tree` (each has the prop in its typings; BL UI's `ListBox` passes it through). It is in `react-aria-components`, with `useListData` for the state.

```ts
function useDragAndDrop<T = object>(options: DragAndDropOptions<T>): DragAndDrop<T>   // { dragAndDropHooks }
```

| Option | Effect |
| --- | --- |
| `getItems(keys, items)` | What each dragged row carries. Without it the collection is not draggable. |
| `onReorder` | A drop between items of the same collection. Only "between" positions; `e.keys`, `e.target` (`{ key, dropPosition: 'before' \| 'after' }`). |
| `onMove` | Like `onReorder`, and also allows dropping *on* items and, in a tree, into another parent. |
| `onInsert` | Items from another collection or app dropped between items. |
| `onRootDrop` | Items dropped on the collection itself, which is where an empty list receives them. |
| `onItemDrop` | Items dropped *on* an item (`isInternal` tells you whether they came from this collection). |
| `onDrop` | Overrides all of the above when set. |
| `acceptedDragTypes` | `'all'` or a list such as `['application/x-bl-task']`. Include `DIRECTORY_DRAG_TYPE` to accept directories. |
| `getDropOperation(target, types, allowed)` | `'move'`, `'copy'`, `'link'` or `'cancel'`. |
| `shouldAcceptItemDrop` | Which items are valid "on" targets. |
| `renderDragPreview`, `renderDropIndicator` | Customize the drag image and the indicator. |
| `onDragStart`, `onDragMove`, `onDragEnd` | The lifecycle. `onDragEnd` has `isInternal` and `dropOperation`. |
| `isDisabled` | Turn drag and drop off. |

### Reorder one list

{% demo src="aria-drag-drop/reorder" %}

```tsx
const list = useListData({ initialItems: tracks })
const { dragAndDropHooks } = useDragAndDrop({
  getItems: (keys) => [...keys].map((key) => ({ 'text/plain': list.getItem(key)?.name ?? '' })),
  onReorder(e) {
    if (e.target.dropPosition === 'before') list.moveBefore(e.target.key, e.keys)
    else if (e.target.dropPosition === 'after') list.moveAfter(e.target.key, e.keys)
  },
})

<ListBox aria-label="Up next" items={list.items} selectionMode="multiple" dragAndDropHooks={dragAndDropHooks}>
  {(track) => (
    <ListBoxItem id={track.id} textValue={track.name}>{track.name}</ListBoxItem>
  )}
</ListBox>
```

Verified in Chromium: with the mouse, pressing a row and moving it above the first row puts it first. With the keyboard, **Enter** on a focused row starts the drag and focus lands on the drop indicator nearest its own position ("Insert between Nightcall and Midnight City"); **ArrowDown** steps to the next position, **Enter** drops, **Escape** cancels and leaves the order alone. Touch was not tested.

- **No handle is required.** The whole row is draggable, and react-aria describes how to start it (the string table has "Long press to start dragging." for touch, which was **not** run here). react-aria-components also supports an explicit handle, a `<Button slot="drag">` inside the item, for touch and screen reader users. These examples leave it out on purpose: axe flags a button inside an `option` as `nested-interactive` (serious), which the repository's accessibility gate fails. If you add one, expect that finding and weigh it.
- **`id` and `textValue` on every item** are required for the keys and the announcements. Items from `useListData` need an `id` (or a `getKey`).
- A drag of a selected row drags the whole selection: `getItems` receives all the keys. (From the typings; selection drag was not exercised here.)
- **In BL UI,** `List`'s own `onReorder` (the iOS edit-mode grip in the Lists page) is a separate implementation with its own animation. Use `useDragAndDrop` when you are on a RAC collection (`ListBox`, `GridList`) and want move-between-lists and file drops as well.

### Move between lists

{% demo src="aria-drag-drop/move-between" %}

Each column accepts a drag from either column, reorders its own items, and removes a task from its source on a move:

```tsx
useDragAndDrop({
  getItems: (keys) => [...keys].map((key) => ({ 'text/plain': name(key), 'application/x-bl-task': JSON.stringify(task(key)) })),
  acceptedDragTypes: ['application/x-bl-task'],
  getDropOperation: () => 'move',
  async onInsert(e) { /* parse e.items, insertBefore / insertAfter e.target.key */ },
  async onRootDrop(e) { /* append to the list: how an empty list receives a drop */ },
  onReorder(e) { /* moveBefore / moveAfter */ },
  onDragEnd(e) { if (e.dropOperation === 'move' && !e.isInternal) list.remove(...e.keys) },
})
```

Verified in Chromium: a task dragged by mouse from "To do" into "Done" moves (the headings count 2 and 2 and the task is in the second list); the keyboard route is Enter on a row, **Tab** to the other list's drop target, Enter; and an emptied list shows its empty state and accepts a task dropped on it through `onRootDrop`. The `isInternal` check matters: without it a reorder inside one list would also delete the item.

## `useDraggableCollection` and `useDroppableCollection`

The pieces `useDragAndDrop` assembles. They are exported from `react-aria` and are for collections react-aria-components does not provide:

```ts
function useDraggableCollection(props: DraggableCollectionOptions, state: DraggableCollectionState, ref: RefObject<HTMLElement | null>): void
function useDroppableCollection(props: DroppableCollectionOptions, state: DroppableCollectionState, ref: RefObject<HTMLElement | null>): DroppableCollectionResult   // { collectionProps }

interface DroppableCollectionOptions extends DroppableCollectionProps {
  keyboardDelegate: KeyboardDelegate
  dropTargetDelegate: DropTargetDelegate
  onKeyDown?: (e: KeyboardEvent) => void
}
```

Each needs a state object from `react-stately` (`useDraggableCollectionState`, `useDroppableCollectionState`), per-item hooks (`useDraggableItem`, `useDroppableItem`, `useDropIndicator`) and a `ListDropTargetDelegate` or your own. That is a lot of machinery for something `useDragAndDrop` already wires for you; none of it is used in this repository and there is no example here.

## In BL UI

- **Composer.** The attach target (`useComposerDrop`) is `useDrop` with `hasDropButton` on a hidden button: the keyboard route of a file drop and paste, announced through a live region. It always answers `'copy'`, reads files from the drop items (directories are walked recursively, up to 500 files), and ignores drags that are not files so text dragged inside the editor keeps its own handling. `FileTrigger` is the "+" button. The [Composer page](https://blamy.github.io/ui/#/composer) documents the user-facing behavior.
- **Lists.** `List` has its own `onReorder` (see above); `ListBox` takes `dragAndDropHooks` like the react-aria-components one.

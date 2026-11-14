# Focus and keys

UI SDK's focus behaviors give a group one tab stop and arrow-key movement (`createRovingFocus` for a row or a list, `createGridFocus` for rows and columns), find items by typing (`createTypeahead`), choose a target by where it sits on screen (`spatialMove`, `nearestInDirection`), and put focus somewhere sensible when the focused element moves or disappears (`createFocusRecovery`, `keepFocus`). Next to them sit `inputHints`, which picks a phone's keyboard for a field, and the shortcut helpers, which match and label `mod+b` for the user's platform. They are listed with the other behaviors in the [behaviors overview](https://blamy.github.io/ui/#/behaviors); the upstream reference is [Focus and Keys](https://ui-sdk.dev/docs/core/behaviors/focus).

Nothing to install: they come from `@ui-sdk/core`, which BL UI already depends on. Use them inside a primitive you define with `definePrimitive` and render with `createParts` (see [Built on UI SDK](https://blamy.github.io/ui/#/ui-sdk)): never hand-roll a roving tabindex or a typeahead.

```ts
import {
  createRovingFocus, createGridFocus, spatialMove, nearestInDirection, createTypeahead, isTypeaheadKey, labelOf,
  createFocusRecovery, keepFocus, inputHints, isFocusFromKeyboard,
  matchesShortcut, formatShortcut, ariaKeyshortcuts,
} from '@ui-sdk/core'
```

## Already done for you

Reach for these only for a part the kit does not have. The kit's own parts already use them:

| Behavior | Where the kit uses it |
| --- | --- |
| Roving focus and typeahead | `Listbox` and `Tree`, `ObjectTree` and `CallStack` (UI SDK's Listbox and Tree), `DebugToolbar` and `EditBar` (UI SDK's Toolbar), the tab strips in `Workspace` (UI SDK's Tabs). Menus, Select and Combobox have it inside their UI SDK parts. |
| `createGridFocus` | `ResultTable`, `RequestTable` and `LogList` (through `lib/grid-behaviors.ts`). |
| `createFocusRecovery` | `Workspace` (a closed tab hands focus to its neighbour), and the grids above (a removed row hands focus back to the scroller). |
| `isFocusFromKeyboard` | `ResultTable`'s tab stop (`createTabStop` in `lib/grid-behaviors.ts`): Tab into the table moves on into the active cell; a click does not. |
| `nearestInDirection` | `CommandMenu`'s `columns` groups: the arrows follow the layout. |
| Shortcut labels | `Kbd` with `keys="mod+k"` (UI SDK's `useShortcutHint`), and a menu or command item's `shortcut` prop. |

## How keyboard focus is shown in 6.0

There is no `data-focus-visible` any more. 6.0 uses the browser's own `:focus-visible`, so the Tailwind variant is the plain `focus-visible:`:

- `Button`: `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`.
- List rows, cells and toolbar items in these examples: `focus-visible:ring-[3px] focus-visible:ring-ring/45`.
- A group that should light up while anything inside has focus: `focus-within:`.

The browser decides when `:focus-visible` matches: after Tab or an arrow key, and for a text field on any focus (a clicked field matches too). When a primitive needs the same answer in script, for example "did this focus come from the keyboard, or from a click or a popup handing focus back?", call `isFocusFromKeyboard()` in the `focusin` handler. That is how `ResultTable` decides whether to step into a cell.

## Roving focus

`createRovingFocus(context, { slot, key, … })` keeps the focused item's key in your state (`key: 'focused'`), gives that item `tabindex="0"` and every other one `-1` (`tabIndex(state, part)`), and moves focus on the arrows, Home and End (`keydown(event, el)`). `orientation` is `'vertical'` by default (Up and Down), `'horizontal'` (Left and Right, following the text direction) or `'both'`; `loop` wraps at the ends. The last focused item keeps the tab stop. `remember(key)` moves the tab stop without moving focus, and `focus(key)` moves focus, even to an item that is about to render.

The example is a formatting toolbar beside a field. Each format also has a shortcut, read in the field with `matchesShortcut`; using it calls `remember`, so Shift+Tab out of the field lands on the format you just used.

{% demo src="behaviors-focus/format-toolbar" %}

Verified in happy-dom with the example above (UI SDK strict mode on):

- **One tab stop.** The buttons start with `tabindex` `0, -1, -1`.
- **Wrapping.** With `loop`, ArrowRight goes Bold → Italic → Underline → Bold, and ArrowLeft from Bold goes to Underline. Home and End reach the ends.
- **A click** toggles a format and reports `(value, details)` with `details.reason === 'item-press'`.
- **The shortcut.** With the platform set to Apple, Command+U in the field toggles Underline (`reason: 'shortcut-key'`) and moves the tab stop to it (`tabindex` `-1, -1, 0`). Control+U does nothing on Apple: `mod` means Command there and Control elsewhere.
- `aria-keyshortcuts` reads `Meta+B`, `Meta+I`, `Meta+U` on Apple, and the `Kbd` shows ⌘B. The keycap is `aria-hidden`, so the button's name stays "Bold".

Other options, from the types and the upstream page: `disabled(item)` keeps an item reachable but prefers enabled ones for the tab stop (give it `aria-disabled`, not the native `disabled`, which can't take focus); `focusable(item)` skips an item altogether; `preferred` with `remember: false` returns the tab stop to the selected item; `move(event, { from, items, rtl })` replaces the built-in arrow rules, for a keypad that moves three at a time or a calendar that runs into the next month. `items()` lists the focusable items in document order, each with its `key`, `props` and `el`.

## Typeahead and focus recovery

`createTypeahead()` returns a matcher: give it the key, the items' labels (`labelOf(el)` reads what a user would type, skipping `aria-hidden` text such as shortcut hints) and the current index, and it returns the match. Typing the same letter again cycles through the matches; typing quickly builds a prefix. Call it after roving focus has had its turn and only for `isTypeaheadKey(event)`.

`createFocusRecovery({ fallback })` runs when a focused part unbinds, and waits for the render to finish. `fallback(lost)` receives the removed part's key, last props and element, and returns where focus should go; returning nothing leaves focus where it is. It never takes focus back from something else, such as a dialog that just opened.

```ts
const recovery = createFocusRecovery<{ value: string; index: number }>({
  fallback: (lost) => {
    const items = roving.items()
    return (items[lost.props.index] ?? items.at(-1))?.el // the task that took its place, or the last one
  },
})
```

{% demo src="behaviors-focus/task-list" %}

Verified in happy-dom:

- **Typeahead.** From "Draft the release notes", R goes to "Review the design" and a second R to "Rename the repo". After a pause, P goes to "Plan the offsite".
- **No wrap by default.** ArrowDown on the last task stays there.
- **Recovery.** Deleting "Plan the offsite" (the third task) puts focus on "Review the design", which took its place; deleting the last task puts it on the new last task.

### `keepFocus`

When an item moves to another list it renders as a new element, so the browser drops focus. Call `keepFocus` after changing state, with a function that finds the new element; it retries after the update, and leaves focus alone if the user moved it in the meantime:

```ts
move(task: string) {
  const { done } = context.store.get()
  context.store.set({ done: [...done, task] })
  keepFocus(() => context.element('task', task))
}
```

The drag-and-drop behaviors already do this for the items they move ([Drag and drop](https://blamy.github.io/ui/#/behaviors-drag-drop)).

## Spatial focus

On a board or a canvas, the next item in the document is not always the one to the right. `move: spatialMove()` makes roving focus pick the nearest item in the arrow's direction, measured from the elements (pass `rect(el, key)` when your app already knows the positions, such as a zoomed canvas). Home and End keep document order, and Alt, Control and Command combinations are left for other shortcuts.

```ts
const roving = createRovingFocus(context, { slot: 'note', key: 'focused', move: spatialMove() })
```

`nearestInDirection(from, candidates, [x, y])` is the same search on plain boxes, returning a key without moving focus: `[1, 0]` is right, `[0, -1]` is up, and `undefined` means nothing lies that way. `CommandMenu` uses it to move the highlight through a grid of commands while focus stays in the search field.

## Grids

`createGridFocus(context, { key, rows, cols })` addresses cells by zero-based `row` and `col`. Each cell gets its tab stop from `grid.tabIndex(state, cell)`, its keys from `grid.keydown(event)` and its element from `grid.bind(el, cell)`; a pointer press calls `grid.focus(cell, { reason: 'item-press', event })`. Render cells (`role="gridcell"`, each with a stable `id` like `"1:2"`) inside rows (`role="row"`) inside `role="grid"`, and add `selects: selects({ active: byCell })` so a move re-renders only the two cells involved.

`disabled(cell)` skips a cell during navigation (unlike roving focus's `disabled`, which only demotes it). `grid.isActive(state, cell)` stays true after focus leaves, so the example marks the active seat with `data-highlighted` and Tab back in returns to it.

{% demo src="behaviors-focus/seat-grid" %}

Verified in happy-dom:

- **Tab stop.** Only A1 has `tabindex="0"` before the grid is entered.
- **Skipping.** ArrowRight from A2 skips the taken A3 and lands on A4; from B1 it skips B2 and B3 to B4.
- **Ends and corners.** End goes to the row's end (B6); Control+End to the last cell (C6) and Control+Home to the first (A1). Control is Command on a Mac.
- After focus leaves, B4 keeps `data-highlighted` and the tab stop.

`onMove(cell, { from, shift, reason })` reports each move, which is where a Shift+arrow range starts (see [Selection](https://blamy.github.io/ui/#/behaviors-selection)). `pageSize` sets how far Page Up and Page Down go, and `reveal(cell)` brings a row that isn't rendered into view first, for a virtualized grid.

## Input hints

`inputHints(kind, { enter })` fills in `inputMode`, `enterKeyHint`, `autoComplete`, `autoCapitalize`, `autoCorrect` and `spellCheck` for a kind of field, spelled as React spells them. Spread it on an `<input>` or `<textarea>`; attributes after the spread win, and the field keeps its own `type` and validation.

```tsx
<input type="email" aria-label="Email" {...inputHints('email', { enter: 'next' })} />
// inputMode="email" enterKeyHint="next" autoComplete="email" autoCapitalize="none" autoCorrect="off" spellCheck="false"
```

Kinds: `email`, `url`, `tel`, `one-time-code`, `numeric`, `decimal`, `search`, `name`, `username`, `postal-code`, `current-password`, `new-password` and `message`. iPhone's number pads (`tel`, `numeric`, `decimal`, `one-time-code`) have no Return key, so `enter` only shows on other phones.

## Shortcuts

`mod` is Command on Apple platforms and Control elsewhere. One string gives you the match, the label and the ARIA value:

```ts
if (matchesShortcut(event, 'mod+b')) { event.preventDefault(); toggleBold() }
formatShortcut('mod+b')   // "⌘B" on Apple, "Ctrl+B" elsewhere (wrapped in a left-to-right isolate)
ariaKeyshortcuts('mod+b') // "Meta+B" or "Control+B"
```

`matchesShortcut` only checks the keys (letters match by physical key when the layout types another character, such as Option+N on a Mac); your handler prevents the default and acts. The labels depend on the platform, so set them after mount (in a slot's `bind`, as the toolbar example does for `aria-keyshortcuts`) or use `Kbd keys="mod+b"`, which renders the same text on the server and the first client render. In tests, `setPlatform('apple')` from `@ui-sdk/core/testing` fixes the platform. For app-wide shortcuts, `registerShortcut` from `@ui-sdk/react/shortcuts` is what `CommandMenu` uses.

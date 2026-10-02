# Press, hover, move and keyboard

The five hooks for custom interactive elements: `usePress`, `useHover`, `useLongPress`, `useMove` and `useKeyboard`, plus `useContextMenu`, which reports where a context menu was asked for. Each returns props to spread on your element. All of them are listed in the [react-aria hooks overview](https://blamy.github.io/ui/#/aria-hooks), with where BL UI uses them.

Nothing to install: they come from `react-aria`, which BL UI already depends on.

```tsx
import { mergeProps, useHover, useKeyboard, useLongPress, useMove, usePress, useContextMenu } from 'react-aria'
```

Prefer `Button` (or `PlainButton`, `ToggleButton`, `Link`) when the element is a button: it is `usePress` plus `useHover` plus `useFocusRing` already, and it sets `data-pressed`, `data-hovered` and `data-focus-visible` for you. Drop to the hooks for an element that is not a button, or that needs a second gesture.

## `usePress`

One press event for mouse, touch, pen, keyboard and screen readers. It handles the details that make `onClick` unreliable: the emulated mouse events after a touch, text selection, focus on press, cancelling when the pointer leaves, and Space and Enter.

```ts
function usePress(props: PressHookProps): PressResult

interface PressResult {
  isPressed: boolean
  pressProps: DOMAttributes   // spread on the element
}
```

| Option | Effect |
| --- | --- |
| `onPress` | A press released over the target. |
| `onPressStart`, `onPressEnd` | The press begins; it ends (over the target or after the pointer left). |
| `onPressChange(isPressed)` | The pressed state changed. |
| `onPressUp` | A press was released over the target, even if it started elsewhere. |
| `isPressed` | Controlled pressed state (for example, while an overlay it opens is open). |
| `isDisabled` | Turn the handlers off. |
| `preventFocusOnPress` | Do not move focus to the element on press. |
| `shouldCancelOnPointerExit` | Cancel the press for good when the pointer leaves, instead of resuming if it comes back. Default `false`. |
| `allowTextSelectionOnPress` | Keep text selection enabled on the element. |
| `ref` | The target element, for the hook's own checks. |
| `onClick` | An alias for `onPress`, "not recommended" in the typings. |

Every event is a `PressEvent` with `type`, `pointerType` (`'mouse' | 'pen' | 'touch' | 'keyboard' | 'virtual'`), `target`, `x`, `y`, the modifier keys, and, for the keyboard, `key`. `continuePropagation()` lets a parent also handle it: press events stop propagating by default.

{% demo src="aria-press/pressable" %}

Verified in Chromium with the example above:

- **Order.** A mouse click logs `pressstart`, `pressend`, then `press`. `onPress` fires after `onPressEnd`.
- **Pointer types.** A mouse click reports `mouse`; Enter and Space report `keyboard` with `key: 'Enter'` or `'Space'`; a touch tap reports `touch`; a pen (sent through the DevTools protocol) reports `pen`; `element.click()` from script reports `virtual`. `virtual` is also what a screen reader's "activate" arrives as.
- **Leaving.** Press, move off the button and `isPressed` goes false with a `pressend`. Move back over it while still holding and the press starts again. Release while off the button and no `press` fires.
- **Touch and hover.** After a touch tap the button is not left in the hovered state, which is what `useHover` is for (below).

Gotchas:

- **It adds no role and no tab stop.** On a `div`, give it `role="button"` and `tabIndex={0}` yourself, or use a native `<button>`, which is better. The keyboard part only works while the element has focus.
- **Pressing the exact center of a draggable is special**, and it applies when `usePress` shares an element with `useDrag`: see [Drag and drop](https://blamy.github.io/ui/#/aria-drag-drop).
- **`onClick` is not `onPress`.** The repository's convention is `onPress`, because it carries `pointerType` and the same behavior for every input.

## `useHover`

Hover state that ignores touch. A browser fires emulated mouse events after a tap, which would leave a "hovered" style stuck on a touch screen; `useHover` only reports real mouse and pen hovering.

```ts
function useHover(props: HoverProps): HoverResult

interface HoverResult {
  hoverProps: DOMAttributes
  isHovered: boolean
}
```

| Option | Effect |
| --- | --- |
| `onHoverStart`, `onHoverEnd` | Called with a `HoverEvent` (`pointerType` is `'mouse'` or `'pen'`). |
| `onHoverChange(isHovering)` | The state changed. |
| `isDisabled` | Turn it off. |

The example above shows it: the `isHovered` card is true while the mouse is over the button and false after it leaves, and a touch tap does not set it. Pass `{}` when you only want the state. In BL UI, the SplitView resizer shows its handle bar on hover with it.

## `useLongPress`

Press and hold. It is a pointer gesture, so it is not an alternative to a keyboard route: offer the same action another way.

```ts
function useLongPress(props: LongPressProps): LongPressResult   // { longPressProps }

interface LongPressProps {
  isDisabled?: boolean
  pointerType?: 'mouse' | 'touch'
  onLongPressStart?: (e: LongPressEvent) => void
  onLongPressEnd?: (e: LongPressEvent) => void
  onLongPress?: (e: LongPressEvent) => void
  threshold?: number                 // ms, default 500
  accessibilityDescription?: string
}
```

| Option | Effect |
| --- | --- |
| `threshold` | Hold time in milliseconds before `onLongPress`. The source's default is 500. |
| `onLongPressStart` | Called when the press begins. |
| `onLongPress` | Called once, when the threshold passes with the pointer still over the target. |
| `onLongPressEnd` | Called when the press ends, whether or not it got to the threshold. |
| `pointerType` | Listen for one pointer type only. Without it, `mouse` and `touch`. |
| `accessibilityDescription` | Text exposed through `aria-describedby`, such as "Hold to archive". Only added when `onLongPress` is set and the hook is enabled. |

{% demo src="aria-press/long-press" %}

Verified in Chromium:

- Holding the mouse for the full threshold fires `onLongPress` once. The release that follows is **not** also a press: after a long press the hook sends a synthetic `pointercancel` so other `usePress` handlers on the element stand down.
- Releasing earlier fires `onLongPressEnd` and then a normal press, so a quick tap is still a tap.
- Sliding off the button while holding ends the hold (`onLongPressEnd`) and no long press fires.
- A touch hold (sent through the DevTools protocol) fires it.
- **A pen does not fire it, and nor does a held Enter key.** `pointerType` only accepts `'mouse'` or `'touch'`, and the default filter is the same two. If a pen has to work, handle it yourself.
- `accessibilityDescription` appears as a hidden element referenced by the button's `aria-describedby` with exactly that text. What a screen reader then says was not verified.
- From the source: on a touch long press it also prevents the browser's context menu, and it focuses the target if the browser has not.

In BL UI, [ContextMenu](https://blamy.github.io/ui/#/context-menu) has its own 500 ms hold for touch and pen (`longPressDelay`, with an 8 px movement slop) rather than this hook, because iOS Safari never fires `contextmenu` for a long press.

## `useMove`

Drag deltas from the mouse, touch and pen, and from the arrow keys: the right hook for a resizer, a splitter, a slider track or a crop handle. It reports how far the pointer moved since the last event, not where it is.

```ts
function useMove(props: MoveEvents): MoveResult   // { moveProps }

interface MoveEvents {
  onMoveStart?: (e: MoveStartEvent) => void
  onMove?: (e: MoveMoveEvent) => void        // adds deltaX, deltaY
  onMoveEnd?: (e: MoveEndEvent) => void
}
```

Every event carries `pointerType` (`'mouse'`, `'touch'`, `'keyboard'`, and so on) and the modifier keys (`shiftKey`, `ctrlKey`, `metaKey`, `altKey`).

{% demo src="aria-press/move-handle" %}

The example is the same recipe as the SplitView resizer (`Resizer` in `split-view.tsx`):

```tsx
const acc = useRef(width)
const { moveProps } = useMove({
  onMoveStart() { acc.current = width },
  onMove(e) {
    acc.current += e.pointerType === 'keyboard' ? e.deltaX * (e.shiftKey ? 40 : 10) : e.deltaX
    setWidth(clamp(acc.current))
  },
})
// <div role="separator" tabIndex={0} aria-valuenow={width} … {...mergeProps(moveProps, focusProps, hoverProps)} />
```

Verified in Chromium:

- A mouse drag of 60 px changes the width by exactly 60, and a touch drag moves it (both report their own `pointerType` in `onMoveEnd`).
- Each arrow key press is one move of **1** in that axis (the example's step of 10 is `deltaX * 10`), with `shiftKey` set when Shift is held. The keyboard needs the element to be focused, so it needs `tabIndex={0}`.
- **Accumulate in a ref and clamp the displayed value.** If you add `deltaX` to the clamped state, a drag past the limit and back moves the handle before the pointer is back where it started, because the overshoot was thrown away.
- Give the handle `touch-none` (`touch-action: none`) so a touch drag is not taken as a scroll. The example has it; a touch drag without it was not tried.
- A pen was not tested.
- **Keep the accessibility part yourself.** `role="separator"`, `aria-orientation`, `aria-valuenow/min/max`, `aria-label` and Home/End are not part of the hook.

## `useKeyboard`

Key handlers for a focusable element, with two differences from `onKeyDown`: events do not propagate unless you ask, and a `shortcuts` map matches modifier combinations exactly.

```ts
function useKeyboard(props: KeyboardProps): KeyboardResult   // { keyboardProps }

interface KeyboardProps extends KeyboardEvents {
  isDisabled?: boolean
  shortcuts?: KeyboardShortcutBindings
  allowRepeats?: boolean     // only affects shortcuts
  allowComposing?: boolean   // only affects shortcuts
}
type KeyboardShortcutBindings = Record<string, KeyboardShortcutAction>
```

| Option | Effect |
| --- | --- |
| `onKeyDown`, `onKeyUp` | Plain handlers. They stop propagation; call `e.continuePropagation()` to let a parent hear the key. |
| `shortcuts` | Keys like `'Mod+s'`, `'Mod+Shift+k'`, `'Escape'`. Modifiers are Shift, Alt, Ctrl (or Control), Meta and **Mod**, which is Command on Apple platforms and Ctrl elsewhere. Order does not matter, and case does not. |
| `allowRepeats` | Let a held key fire a shortcut repeatedly. Off by default. |
| `allowComposing` | Let a shortcut fire during IME composition. Off by default. |

How a shortcut handler's return value is read (from the source):

| Returns | Effect |
| --- | --- |
| nothing | Handled: `preventDefault()` is called and the event stops here. |
| `true` | The same. |
| `false` | Not handled: the default is not prevented and the key carries on. |
| `{ shouldPreventDefault, shouldContinuePropagation }` | Choose each. |

A key that matches no shortcut always carries on. Shortcuts run on key down only.

{% demo src="aria-press/shortcuts" %}

Verified in Chromium: Mod+S is handled and the parent `div`'s own `onKeyDown` never hears the S; an unmatched key (`a`) does reach it; Mod+Shift+S does not match `Mod+s` (modifiers are exact); a handler that returns `false` (Escape on an empty note) lets the key through. The example's parent ignores bare modifier presses, because pressing Mod itself is a key down that no shortcut matches.

In BL UI, [`useHotkey`](https://blamy.github.io/ui/#/hooks-state) is the document-wide equivalent for app shortcuts such as the CommandMenu's. `useKeyboard` is scoped to the element it is spread on, so it only hears keys while that element (or a descendant) has focus. `shortcuts` ignore a key event that reached the element through a React portal rather than from inside it (from the source).

## `useContextMenu`

Reports that a context menu was requested, and where. It draws nothing.

```ts
function useContextMenu(props: ContextMenuProps): ContextMenuAria   // { contextMenuProps }

interface ContextMenuProps {
  onContextMenu?: (e: ContextMenuEvent) => void
}
interface ContextMenuEvent {
  target: Element
  x: number   // relative to the target
  y: number
}
```

From the source's comments, the triggers it covers: a right-click, Control-click on macOS, Shift+F10 and the menu key on Windows and Linux, a touch long press (it uses `useLongPress` on iOS, where `contextmenu` is never fired), and the macOS Control+Enter shortcut, for which it carries a workaround for WebKit and older Chrome. The handler calls `preventDefault()` and `stopPropagation()` on the native event, so the browser's own menu does not open.

{% demo src="aria-press/context-menu" %}

Verified in Chromium: a right-click reports the pointer's position relative to the element (a click 50 px right and 30 px down reports `x 50, y 30`), and a `contextmenu` event dispatched on the focused element reports its position too. **Not verified:** that Shift+F10 or the menu key produce that event; headless Chromium does not turn those keys into a `contextmenu` event, so the keyboard route was tested by dispatching the event a real browser sends. Touch long press was not verified either.

**Stability.** `useContextMenu` is a normal export of `react-aria` 3.51.0 and 3.52.1 with typed props and no experimental marker in the source or the typings, unlike `UNSTABLE_createLandmarkController`. It is newer than most of the hooks here, so check the version you resolve.

**Which to use.** If you want a menu, use [ContextMenu](https://blamy.github.io/ui/#/context-menu): it opens a `DropdownMenu` at the pointer, handles the menu key and Shift+F10 itself, and has a long-press route for touch and pen. Reach for `useContextMenu` when you place something else (a custom popover, a toolbar) where the request happened.

# Focus

Six pieces for working with focus: `useFocusRing` and `FocusRing` (a ring that shows for the keyboard), `useFocus` and `useFocusWithin` (react to focus), `useFocusVisible` (the page-wide keyboard flag) and `FocusScope` with `useFocusManager` (contain, restore and move focus). They are listed with the rest in the [react-aria hooks overview](https://blamy.github.io/ui/#/aria-hooks).

Nothing to install: they come from `react-aria`, which BL UI already depends on.

```tsx
import { FocusRing, FocusScope, mergeProps, useFocus, useFocusManager, useFocusRing, useFocusVisible, useFocusWithin } from 'react-aria'
```

## Focus-visible, and how it maps to BL UI

Browsers decide when to draw a focus ring with CSS `:focus-visible`. react-aria keeps its own idea of it, `isFocusVisible`, and BL UI's components use that one: react-aria-components writes it to the element as `data-focus-visible`, and the styles key off it.

- `Button`, `PlainButton`, toggles and the like: `data-focus-visible:ring-2 data-focus-visible:ring-ring data-focus-visible:ring-offset-2`.
- `ListBox`: `data-focus-visible:ring-[3px] data-focus-visible:ring-ring/45`.
- Text inputs use `data-focused` instead (`input.tsx`, `textarea.tsx`): a field highlights whenever it has focus, mouse or keyboard.

On your own element the hooks give you the same attribute. `useFocusRing` returns `isFocusVisible`; set `data-focus-visible={isFocusVisible || undefined}` and the Tailwind `data-focus-visible:` variants work exactly as they do on a library component.

{% demo src="aria-focus/focus-states" %}

Verified in Chromium with the example above:

- **Before any interaction** the page counts as keyboard modality: `useFocusVisible()` is already `true`, so a first Tab shows the ring. The first pointer interaction turns it off.
- **A mouse click** focuses the button (`isFocused`, and focus-within on the group) but does **not** make focus visible. **Tab** does, and then `useFocusVisible()` is true again.
- **A text field is different from CSS.** After clicking into it, the browser's own `:focus-visible` matches (the example reads it with `matches(':focus-visible')`) but react-aria's `isFocusVisible` stays false. If you want a ring on a clicked field, key it to focus, as BL UI's inputs do (`data-focused`), not to focus-visible.
- `FocusRing` with `within` adds its `focusRingClass` while a **child** has keyboard focus and removes it when focus leaves.

## `useFocusRing`

```ts
function useFocusRing(props?: AriaFocusRingProps): FocusRingAria

interface AriaFocusRingProps {
  within?: boolean       // react to focus anywhere inside, not only on the element
  isTextInput?: boolean
  autoFocus?: boolean
}
interface FocusRingAria {
  isFocused: boolean
  isFocusVisible: boolean
  focusProps: DOMAttributes
}
```

| Option | Effect |
| --- | --- |
| `within` | Use focus-within instead of focus on the element itself. |
| `isTextInput` | Tells the hook the element is a text input. From the source, this only changes how **key presses** are read: typing a letter in a field does not flip the page back to keyboard modality, but Tab, Escape and the arrows do. It does not make a clicked field show a ring. |
| `autoFocus` | The element will be focused on mount, so `isFocusVisible` starts as `true` (from the source) instead of waiting for a keyboard event. |

## `FocusRing`

`useFocusRing` as a wrapper: it clones its single child and adds `focusClass` while focused and `focusRingClass` while keyboard-focused. Same options (`within`, `isTextInput`, `autoFocus`).

```tsx
<FocusRing focusRingClass="ring-[3px] ring-ring/45" within>
  <div className="rounded-ctl …">…</div>
</FocusRing>
```

It takes class names, not render props, so with Tailwind it needs complete, literal class strings. In this codebase `data-focus-visible:` on an element that already has `useFocusRing` is the more common route, which is why the hook is the one to learn.

## `useFocus` and `useFocusWithin`

```ts
function useFocus<Target extends FocusableElement = FocusableElement>(props: FocusProps<Target>): FocusResult<Target>
function useFocusWithin(props: FocusWithinProps): FocusWithinResult
```

| `useFocus` option | Effect |
| --- | --- |
| `onFocus`, `onBlur`, `onFocusChange(isFocused)` | The element itself gained or lost focus. Events from children are ignored. |
| `isDisabled` | Turn it off. |

| `useFocusWithin` option | Effect |
| --- | --- |
| `onFocusWithin` | The element or a descendant received focus. |
| `onBlurWithin` | The element **and** all descendants lost focus. |
| `onFocusWithinChange(isFocusWithin)` | The state changed. |
| `isDisabled` | Turn it off. |

Both return props to spread (`focusProps`, `focusWithinProps`), not state: keep the state yourself (`onFocusChange={setFocused}`), as the example does. Reach for `useFocusRing` when you want to *show* focus, and for these when you want to *react* to it. `useFocusWithin` is the one for a group whose styling or timers depend on "is anything in here focused": it is what lets a card show its action bar, or a stack of notifications pause. BL UI's Toast pauses its timers while focus is inside the stack (see its page); the example above highlights the whole group.

## `useFocusVisible`

```ts
function useFocusVisible(props?: FocusVisibleProps): FocusVisibleResult   // { isFocusVisible }
function setInteractionModality(modality: 'keyboard' | 'pointer' | 'virtual'): void
```

`isFocusVisible` here is global, not per element: whether the last interaction anywhere on the page was the keyboard. It is true before any interaction (verified) and false after a pointer press. `setInteractionModality` sets it by hand.

## `FocusScope`

```ts
function FocusScope(props: FocusScopeProps): JSX.Element

interface FocusScopeProps {
  children: ReactNode
  contain?: boolean        // keep Tab and Shift+Tab inside
  restoreFocus?: boolean   // on unmount, focus what had focus when the scope mounted
  autoFocus?: boolean      // on mount, focus the first focusable element inside
}
```

`FocusScope` renders no element of its own (it adds invisible sentinels to find its children), so put it around your container, not in place of it. It is for hand-built panels; `Dialog`, `Popover`, `Modal` and `Menu` from react-aria-components already do all three, so use those first.

{% demo src="aria-focus/focus-scope" %}

Verified in Chromium, under StrictMode:

- **`autoFocus`:** opening the panel focuses its first control.
- **`contain`:** nine Tabs and nine Shift+Tabs from inside never leave the panel; focus wraps.
- **`restoreFocus`:** Escape or the Close button unmounts the scope and focus returns to the "React" button that opened it, whether it was opened by a click or by Enter.
- The scope does not close the panel for you: Escape handling is yours (`onKeyDown` in the example), as is the `role="dialog"` and its label.

### `useFocusManager`

Inside a `FocusScope`, `useFocusManager()` returns a manager to move focus programmatically:

```ts
function useFocusManager(): FocusManager | undefined

interface FocusManager {
  focusNext(opts?: FocusManagerOptions): FocusableElement | null
  focusPrevious(opts?: FocusManagerOptions): FocusableElement | null
  focusFirst(opts?: FocusManagerOptions): FocusableElement | null
  focusLast(opts?: FocusManagerOptions): FocusableElement | null
}
interface FocusManagerOptions {
  from?: Element                       // start point; the focused element by default
  tabbable?: boolean                   // only tabbable elements, or every focusable one
  wrap?: boolean                       // wrap at the ends
  accept?: (node: Element) => boolean  // filter
}
```

The example's reaction row uses it for arrow-key movement. Verified: ArrowRight moves Like → Love → Laugh and wraps back to Like, and ArrowLeft goes the other way. **The manager covers the whole scope**, so without `accept` the step after the last reaction would land on the text field below; the example passes `accept: (node) => row.current.contains(node)` to stay inside the row. It returns `undefined` outside a scope.

## In BL UI

- `SplitView`'s resizer uses `useFocusRing` (with `useHover` and `useMove`) to show its bar for keyboard focus only: `isFocusVisible || active || isHovered`.
- `Composer` uses `useFocusRing` on its attach target.
- Toast's region is a landmark from `useToastRegion` (see [Landmarks](https://blamy.github.io/ui/#/aria-landmark)); the Toast page documents that focus returns to where it was when the last toast closes.

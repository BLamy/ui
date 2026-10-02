# react-aria hooks

BL UI is built on react-aria-components, and react-aria-components is built on the hooks in `react-aria`. Almost everything in this library needs no hook at all: you use `Button`, `ListBox`, `Dialog` and friends, and press, focus, hover and keyboard behavior are already inside them. This section is for the moment you drop below the component: a custom pressable, a resizer, a drag handle, a "paste an image here" target, a region you can jump to with F6.

The pages cover the hooks that react-aria files under **Interactions**, plus the few utilities this codebase reaches for. Everything here was checked against `react-aria` 3.52.1 (the typings in `node_modules`, and the source where a page says "from the source") and then run in Chromium in the live examples; where something could not be checked, the page says so.

{% hint style="info" %}
Nothing to install. These hooks are exported from `react-aria`, which BL UI already depends on, so a project that uses the library has them. `npm install react-aria` only matters if you use a hook in a project that does not.
{% endhint %}

## Components first, hooks second

Reach for a hook when a component would be the wrong shape, not before.

| You want | Use | Not |
| --- | --- | --- |
| A button | `Button` from `@/components/ui/button` | `usePress` on a `div` |
| A focus ring on a custom element | `useFocusRing` | a `:focus` style (it shows after a mouse click) |
| A draggable, reorderable list | `ListBox` or `GridList` plus `useDragAndDrop` | `useDraggableCollection` by hand |
| A file drop area | `DropZone` | `useDrop` by hand |
| A right-click menu | `ContextMenu` | `useContextMenu` |
| A popover, dialog or menu | `Popover`, `Dialog`, `DropdownMenu` | `FocusScope` by hand |

The hooks return **props to spread** on your element (`pressProps`, `focusProps`, `hoverProps`, `moveProps`, `clipboardProps`, …) plus state (`isPressed`, `isFocusVisible`, `isHovered`). Several can go on one element: `mergeProps` chains their handlers instead of letting the last one win. The BL UI SplitView resizer is exactly that, `useMove` + `useFocusRing` + `useHover`, merged onto one `div`.

```tsx
import { mergeProps, useFocusRing, useHover, usePress } from 'react-aria'

function Tile({ onPress }: { onPress: () => void }) {
  const { pressProps, isPressed } = usePress({ onPress })
  const { hoverProps, isHovered } = useHover({})
  const { focusProps, isFocusVisible } = useFocusRing()
  return (
    <button
      {...mergeProps(pressProps, hoverProps, focusProps)}
      data-pressed={isPressed || undefined}
      data-hovered={isHovered || undefined}
      data-focus-visible={isFocusVisible || undefined}
      className="data-hovered:bg-accent data-pressed:scale-[.97] data-focus-visible:ring-2 data-focus-visible:ring-ring"
    />
  )
}
```

The `data-*` attributes above are what react-aria-components sets on its own elements, so the `data-pressed:`, `data-hovered:` and `data-focus-visible:` Tailwind variants BL UI uses everywhere work the same on your hand-built element. See [Styling and variants](https://blamy.github.io/ui/#/styling).

## Imports, SSR and the bundle

- **Import from `react-aria`** (`import { usePress } from 'react-aria'`) or from a subpath (`react-aria/usePress`). BL UI's own source uses both: the root in `split-view.tsx`, subpaths in `composer.tsx`. The package declares `"sideEffects": false`, so a bundler tree-shakes either form.
- **`useDrag`, `useDrop`, `isFileDropItem`, `isTextDropItem`, `VisuallyHidden`, `I18nProvider`, `useLocale`, `useFilter`, `SSRProvider` and `Pressable`** are also re-exported by `react-aria-components`. `useDragAndDrop`, `useListData`, `DropZone` and `FileTrigger` exist **only** in `react-aria-components`. The next section explains why the choice of import can matter.
- **Server rendering.** Every live example on these pages was rendered with `renderToString` on the server without an error. Hooks that need the DOM do their work in effects. `SSRProvider` is a no-op on React 18 and later (from its source: it renders its children and warns once in development), so a React 19 app does not need it. Separately, `useFocusVisible()` reports keyboard modality until the first pointer interaction, which is what the Focus page's example shows in the browser.
- **`'use client'`.** The hooks use state and effects, so a component that calls them must be a client component in Next.js. BL UI's own modules that use them start with `'use client'`.
- **React StrictMode.** The docs app renders every example in StrictMode, and every behavior on these pages, including FocusScope restore and the clipboard listeners, ran under it.

## One copy of react-aria

`react-aria-components@1.20.0` depends on `react-aria` at exactly `3.51.0`. A project that adds `react-aria@^3.52` itself therefore ends up with **two copies** (this repo does: the docs app resolves `react-aria` to 3.52.1 while the library's components resolve 3.51.0 through react-aria-components). Most hooks are fine with that, because their state is per component or per document, and the landmark manager is shared across copies on purpose (it hangs off `document` under a `Symbol.for` key).

The drag-and-drop **session** is not shared: it is module-level state. Verified in the browser: a draggable made with `useDrag` imported from `react-aria` (3.52.1) starts a keyboard drag but cannot land on react-aria-components' `DropZone` (3.51.0), while `useDrag` imported from `react-aria-components` can. The pages therefore import `useDrag` and `useDrop` from `react-aria` only when both sides of the drag are your own hooks, and from `react-aria-components` when a RAC collection or `DropZone` is on the other end. To see what you have, run `pnpm why react-aria`.

## Every hook

"In BL UI" says where the library itself uses the hook, from the source of this repository.

### Interactions

| Hook | What it does | Page | In BL UI |
| --- | --- | --- | --- |
| `usePress` | One press event across mouse, touch, pen, keyboard and screen readers | [Press, hover, move, keyboard](https://blamy.github.io/ui/#/aria-press) | Inside every react-aria-components button; not called directly |
| `useLongPress` | Press-and-hold for mouse and touch | [Press, hover, move, keyboard](https://blamy.github.io/ui/#/aria-press) | Not used. `ContextMenu` has its own 500 ms hold for touch and pen |
| `useHover` | Hover state that ignores the emulated mouse events after a tap | [Press, hover, move, keyboard](https://blamy.github.io/ui/#/aria-press) | `SplitView` resizer |
| `useMove` | Drag deltas from mouse, touch, pen and arrow keys | [Press, hover, move, keyboard](https://blamy.github.io/ui/#/aria-press) | `SplitView` resizer; the split-view-demos block |
| `useKeyboard` | Key handlers that stop propagation by default, plus a `shortcuts` map | [Press, hover, move, keyboard](https://blamy.github.io/ui/#/aria-press) | Not used. `useHotkey` is the document-wide equivalent |
| `useContextMenu` | Reports where a context menu was requested (right-click, menu key, touch hold) | [Press, hover, move, keyboard](https://blamy.github.io/ui/#/aria-press) | Not used; `ContextMenu` implements the same triggers itself |
| `useFocus` | Focus on the element itself, not its children | [Focus](https://blamy.github.io/ui/#/aria-focus) | Not used directly |
| `useFocusWithin` | Focus on the element or anything inside it | [Focus](https://blamy.github.io/ui/#/aria-focus) | Toast (see its page) |
| `useFocusRing` | `isFocusVisible` that follows keyboard modality | [Focus](https://blamy.github.io/ui/#/aria-focus) | `SplitView` resizer, `Composer` |
| `FocusRing` | `useFocusRing` as a wrapper that adds class names | [Focus](https://blamy.github.io/ui/#/aria-focus) | Not used |
| `useFocusVisible` | The page-wide "is the user on the keyboard" flag | [Focus](https://blamy.github.io/ui/#/aria-focus) | Not used directly |
| `FocusScope` | Contain, auto focus and restore focus; `useFocusManager` moves it | [Focus](https://blamy.github.io/ui/#/aria-focus) | Inside react-aria's `Overlay` and menu internals, which `Popover`, `Modal` and `Menu` use (from the source) |
| `useLandmark` | Registers a region for F6 / Shift+F6 | [Landmarks](https://blamy.github.io/ui/#/aria-landmark) | Through `useToastRegion` in `Toast` |
| `useClipboard` | Copy, cut and paste for the focused element, in any format | [Clipboard](https://blamy.github.io/ui/#/aria-clipboard) | `Composer` (its attach target) |
| `useDrag`, `useDrop` | Native drag and drop with a keyboard and screen reader route | [Drag and drop](https://blamy.github.io/ui/#/aria-drag-drop) | `Composer` (`useDrop` for its drop target) |
| `useDraggableCollection`, `useDroppableCollection` | The collection plumbing behind `useDragAndDrop` | [Drag and drop](https://blamy.github.io/ui/#/aria-drag-drop) | Not used |

### Utilities

Documented on [Utilities](https://blamy.github.io/ui/#/aria-utilities): `mergeProps`, `chain`, `mergeRefs`, `useObjectRef`, `useId`, `VisuallyHidden`, `useIsSSR` and `SSRProvider`, `I18nProvider` and `useLocale`, `useNumberFormatter`, `useDateFormatter`, `useCollator`, `useFilter`, `UNSAFE_PortalProvider`.

## What was documented in depth, and what was not

Picked from the evidence of this codebase and from what a person building with BL UI is likely to write:

- **In depth:** `usePress`, `useHover`, `useMove`, `useFocusRing`, `useFocusWithin`, `FocusScope` (the BL UI source uses the first four, and the SplitView resizer is a ready-made recipe), `useClipboard` (the request, and the Composer's paste route), `useDrag`/`useDrop`/`DropZone` and RAC's `useDragAndDrop` (the Composer and every file or reorder feature), `useLandmark` (the Toast region is one).
- **Shorter, with a runnable example:** `useLongPress`, `useKeyboard`, `useContextMenu`. They are small, correct, and not used by the library; each is the right tool for one job, and the page says which and how it differs from what BL UI already offers (`ContextMenu`, `useHotkey`).
- **Demoted to a paragraph:** `useFocus` (use `useFocusRing` or `useFocusWithin`; it only reports the element itself), `FocusRing` (a wrapper for `useFocusRing`; Tailwind's `data-focus-visible:` variants make it redundant), `useFocusVisible` (only for reading global modality; the examples show how), and `useDraggableCollection` / `useDroppableCollection`. The last two need a collection state, a keyboard delegate and a drop-target delegate, and a per-item hook for every row; you get all of that from `useDragAndDrop` on a RAC `ListBox`, `GridList`, `Table` or `Tree`. Writing them by hand is only for a collection react-aria-components does not have.

The library's own hooks (`useSplitView`, `useToast`, `usePersistentState`, `useHotkey`, …) are a different thing and are listed on the [Hooks](https://blamy.github.io/ui/#/hooks) page.

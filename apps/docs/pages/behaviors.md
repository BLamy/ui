# Behaviors

BL UI 6.0 is built on [UI SDK](https://ui-sdk.dev). Its components are UI SDK parts with the kit's look, and the containers UI SDK does not ship (NavigationStack, SplitView, Credenza, Sidebar, list rows) are primitives the kit defines from UI SDK's **behaviors**: the framework-free helpers in `@ui-sdk/core` for focus, selection, drag and drop, popups, motion and the phone's quirks. Almost everything you build with the kit needs none of them: you use `Button`, `Listbox`, `Dialog` and friends, and the keyboard, focus and ARIA are already inside. This section is for the moment you drop below the component: a toolbar of your own, a sortable board, a disclosure that animates its height, a frame that adapts to its own width.

The pages show each behavior the way the kit itself uses it: inside a primitive defined once with `definePrimitive` and rendered with `createParts` (see [Built on UI SDK](https://blamy.github.io/ui/#/ui-sdk) for a walk-through), or called directly on an element where a primitive would be overkill, and styled with the kit's tokens. Every example on these pages is live.

{% hint style="info" %}
Nothing to install. The behaviors come from `@ui-sdk/core`, and the React adapter (`createParts`, `usePart`, `usePreference`) from `@ui-sdk/react`, which BL UI already depends on (as aliases of our fork, `@brett_lamy/ui-sdk-core` and `@brett_lamy/ui-sdk-react`; see [Installation](https://blamy.github.io/ui/#/installation)).
{% endhint %}

## The pages

| Page | Helpers | Reach for it when |
| --- | --- | --- |
| [Focus and keys](https://blamy.github.io/ui/#/behaviors-focus) | `createRovingFocus`, `createGridFocus`, `spatialMove`, `nearestInDirection`, `createTypeahead`, `createFocusRecovery`, `keepFocus`, `inputHints`, `matchesShortcut`, `formatShortcut` | A group of controls should be one Tab stop with arrow keys; items are found by typing; focus must survive an item being removed or moved; a shortcut needs matching and a label. |
| [Selection](https://blamy.github.io/ui/#/behaviors-selection) | `createSelection`, `createLasso`, `createCellRange`, `cellsToText`, `textToCells` | Several items are selected with Shift and Command; a rectangle is drawn to select; a grid selects ranges of cells and copies and pastes them. |
| [Drag and drop](https://blamy.github.io/ui/#/behaviors-drag-drop) | `bindDrag`, `createReorder`, `createTreeReorder`, `createTransfer`, `bindDragPreview`, `createAutoScroll` | A list is sorted by dragging (and from the keyboard); items move between lists; a drag of your own needs a threshold, a preview and auto-scroll. |
| [Dragging and resizing](https://blamy.github.io/ui/#/behaviors-dragging) | `createMove`, `createResize`, `createSwipeActions`, `bindHold`, `bindRepeat`, `createArea`, `createSpans`, `createPreview` | Objects are moved or resized on a surface; a row reveals actions when swiped; a button acts when held or repeats while held. |
| [Popups and layers](https://blamy.github.io/ui/#/behaviors-popups) | `createPopup` and the popup slots, `position`, `bindLayer`, `bindPersistentLayer`, `isDismissal` | A floating panel the kit has no component for; something placed beside an anchor; a layer that closes on Escape and outside presses. |
| [Motion and gestures](https://blamy.github.io/ui/#/behaviors-motion) | `bindPanel`, `animateIn`, `animateOut`, `hiddenAttrs`, `@ui-sdk/core/gesture` | A panel animates its height; an element should stay mounted until its exit animation ends; a gesture needs velocity, a spring or rubber-banding. |
| [Mobile](https://blamy.github.io/ui/#/behaviors-mobile) | `bindViewport`, `bindAvoidKeyboard`, `createPointerKind`, `pointerKindOf`, `inputHints` | A bar must stay above the on-screen keyboard; content depends on whether a finger or a mouse is in use. |
| [The kit's behaviors](https://blamy.github.io/ui/#/behaviors-kit) | `bindSizeClass`, `sizeClassOf`, `SizeClassProvider`, `usePresentation`, `createStack`, `bindEdgeSwipe`, `bindBack`, `bindPullToRefresh`, `usePresence` (from `@/lib/*`, not `@ui-sdk/core`) | A layout adapts to its own box, not the viewport; pages push and pop with a swipe and the platform's back; a list reloads when pulled; an element stays mounted through its exit. UI SDK has none of these, so BL UI builds them on UI SDK's public API. |
| [Layer hosts](https://blamy.github.io/ui/#/behaviors-layer-hosts) | `data-layer-host`, `bindLayer`'s `when` | Popups stay inside an app's frame, modal only to it. The one behavior our fork adds to UI SDK. |

The complete list, with the helpers these pages don't cover (trees, lists and virtualizing, canvas, preferences and storage, numbers, dates and colors, agents and history), is UI SDK's [All Behaviors](https://ui-sdk.dev/docs/core/behaviors).

## Components first, behaviors second

Reach for a behavior when a component would be the wrong shape, not before.

| You want | Use | Not |
| --- | --- | --- |
| A button, a toggle, a toolbar | `Button`, `Toggle`, `ToggleGroup`, `DebugToolbar` | `createRovingFocus` on your own buttons |
| A list you pick from, or sort | `Listbox`, `Tree`, `Lists` | `createSelection` and `createReorder` by hand |
| A file drop area | `FileUpload` | native drag events by hand |
| A right-click menu | `ContextMenu` | a `contextmenu` handler and `bindLayer` |
| A popover, dialog, menu or sheet | `Popover`, `Dialog`, `DropdownMenu`, `Sheet` | `createPopup` by hand |
| Panes that resize | `SplitView` | `createResize` by hand |
| Pages that push and pop | `NavigationStack` | `createStack` by hand |

## What became of the react-aria hooks

Until 5.x these pages documented react-aria's interaction hooks. They are gone with react-aria; this is where each job went.

| 5.x (react-aria) | 6.0 |
| --- | --- |
| `usePress`, `onPress` | A native `<button>` and `onClick` (Enter and Space click a button), `Button` from the kit, or a slot's `press` handler in a primitive. Held-press styles are `active:`. |
| `useHover`, `isHovered` | `hover:` in CSS (Tailwind's skips touch) and pointer events. `createPointerKind` says whether anything can hover. |
| `useFocusRing`, `FocusRing`, `isFocusVisible` | The browser's `:focus-visible` (`focus-visible:`), and `isFocusFromKeyboard()` in script. See [Focus and keys](https://blamy.github.io/ui/#/behaviors-focus). |
| `useFocus`, `useFocusWithin` | `focus`/`focusin`/`focusout` events, `focus-within:`. |
| `FocusScope`, `useFocusManager` | A popup preset (`createPopup`) contains, moves in and restores focus; `createRovingFocus` and `createGridFocus` move it inside a group; `createFocusRecovery` and `keepFocus` keep it. |
| `useKeyboard` | A slot's `on: { keydown }`, `matchesShortcut`, and `useShortcut` from `@ui-sdk/react/shortcuts`. |
| `useLongPress` | `bindHold`. |
| `useMove` | `bindDrag`, `createMove`, `createResize`. |
| `useContextMenu` | `ContextMenu` (UI SDK's `MenuContextTrigger`: a right click, or a long press on touch). |
| `useClipboard` | The platform's `copy` and `paste` events, `navigator.clipboard`, and `cellsToText`/`textToCells`. See [Selection](https://blamy.github.io/ui/#/behaviors-selection). |
| `useDrag`, `useDrop`, `useDragAndDrop`, `DropZone` | `createReorder`, `createTransfer`, `bindDrag`; files from the computer through `FileUpload` (UI SDK's FileInput). UI SDK has no native (DataTransfer) drag source or drop target; see [Drag and drop](https://blamy.github.io/ui/#/behaviors-drag-drop). |
| `useLandmark` (F6 between regions) | Native landmarks (`<main>`, `<nav>`, `<aside>`, `role="region"` with a name). UI SDK has no F6 landmark cycling. |
| `useLocale`, `I18nProvider`, the formatters | `pageLocale()` and `userLocale()` from `@ui-sdk/core`, `Intl` directly, and `@ui-sdk/core/number` and `@ui-sdk/core/date`. UI SDK's components read the page's language (`lang`). |
| `useFilter`, `useCollator` | `fuzzyScore`, `matchRanges` and `matchSegments` from `@ui-sdk/core/text-match`; `Intl.Collator`. |
| `mergeProps`, `chain`, `mergeRefs` | Not needed: a part merges your handlers with its own (yours run first, and `event.preventDefault()` in yours skips the part's), and React 19 passes `ref` as a prop. |
| `useId`, `useIsSSR` | React's `useId`; UI SDK parts render the same markup on the server. |
| `VisuallyHidden` | Tailwind's `sr-only`. |
| `announce` (LiveAnnouncer) | `announce(message)` from `@ui-sdk/core`. |
| `UNSAFE_PortalProvider` | Popups render into the nearest layer host, BLProvider's root (`useLayerHost()`); see [Layer hosts](https://blamy.github.io/ui/#/behaviors-layer-hosts). |

The migration guide lists the component-level changes: [Migrating to 6.0](https://blamy.github.io/ui/#/migrating-to-6).

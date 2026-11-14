# Built on UI SDK

BL UI 6.0 is built on [UI SDK](https://ui-sdk.dev) (`@ui-sdk/core` and `@ui-sdk/react`, Apache-2.0, by Vercel). UI SDK owns behavior: keyboard, focus, selection, dismissal, popups and their placement, drag and drop, ARIA, and change events with reasons. BL UI owns the look (Tailwind classes on the kit's tokens), the iOS-flavored containers, and the compositions in the blocks. This page shows how the layers fit, how to build a component of your own the way the kit builds its own, what our fork of UI SDK adds and why, and what we would propose upstream: the additions, and the bugs and gaps we hit.

## How the kit is layered

| Layer | Where | What it is |
| --- | --- | --- |
| UI SDK behaviors | `@ui-sdk/core` | Framework-free helpers: `definePrimitive`, `createChange`, `createRovingFocus`, `createSelection`, `createPopup`, `bindDrag`, `bindPanel`… and the cores of UI SDK's own components. See [Behaviors](https://blamy.github.io/ui/#/behaviors). |
| UI SDK parts | `@ui-sdk/react/<component>`, `@ui-sdk/react/primitive` | The React parts of the components UI SDK ships (Button, Dialog, Popover, Menu, Select, Combobox, Tabs, Tooltip, Toast, Tree, Listbox…), and `createParts` / `usePart` / `usePrimitive`, which turn any primitive into React parts. |
| Kit behaviors | `lib/size-class.ts`, `lib/stack.ts`, `lib/edge-swipe.ts`, `lib/back.ts`, `lib/pull-to-refresh.ts`, `lib/presence.ts`; `lib/container.ts` (the size-class scope) | Generic behaviors UI SDK doesn't have (size classes, page stacks, edge swipes, the platform back, pull to refresh, React presence), framework-free and in UI SDK's shape, built only on its public API. See [The kit's behaviors](https://blamy.github.io/ui/#/behaviors-kit). |
| Kit styled parts | `components/<name>.tsx` | Where UI SDK ships the component, the kit's module wraps its parts with classes and re-exports them: same composition, same part suffixes (`DialogTrigger`, `DialogContent`…), same props, plus `variant`/`size` (a `cva` recipe) and layout props. It renders popups into BLProvider's layer host and carries the theme scope. |
| Kit primitives | `lib/<name>-primitive.ts` + `components/<name>.tsx` | Where UI SDK doesn't ship it (SplitView, NavigationStack, Sidebar, list rows, IndexBar, LogList, DataTable, Workspace, SearchInput's Escape-and-Enter, ToggleGroup's sliding card…), one primitive defined once with `definePrimitive` from UI SDK behaviors, framework-free, and rendered with `createParts`. |
| Blocks | `registry/blocks/<slug>` | Whole apps composed from the kit (and the product-specific parts that only make sense in one of them). |

The same rules hold at every layer, which is why a kit part reads like a UI SDK part:

- **UI SDK's API is the kit's.** `onClick`, `disabled`, `open`/`defaultOpen`/`onOpenChange(open, details)`, `value`/`defaultValue`/`onValueChange(value, details)`, `checked`, `pressed`. `details` carries `reason`, `source`, `event` and `cancel()`. A part's element changes with `render`, never `as` or `asChild`. Outside control goes through a controller.
- **State is on attributes.** Component state is UI SDK's `data-*` (`data-open`, `data-checked`, `data-pressed`, `data-highlighted`, `data-starting-style`, `data-side`…) and CSS variables (`--anchor-width`, `--available-height`, `--transform-origin`); hover, press and keyboard focus are the native `hover:`, `active:` and `focus-visible:`. `data-slot` comes from UI SDK, never by hand.
- **Responsive by container.** Shells follow their own box through size classes (the kit's own behavior, provided to what they render as a size-class scope that `presentation="auto"` follows), and popups stay in their layer host (the fork's one addition, below).
- **Agent-ready.** Every control has a name, and every primitive ends with `agent: { actions }`, so `createAgent` from `@ui-sdk/core/agent` can read and drive the page.

## Build a component the same way

A primitive describes behavior: state, the functions that change it, and the parts that use it. It renders nothing. Here is a mute toggle in the kit's look, the shape of every kit primitive in miniature.

{% demo src="ui-sdk/mute-button" %}

### 1. Define the primitive

In the kit this is `lib/mute-button-model.ts` (a `lib/` file can't share a component's name, or shadcn's CLI installs it over the component). No React import.

```ts
import { createChange, definePrimitive, type ChangeDetails } from '@ui-sdk/core'

type MuteReason = 'press' | 'imperative'
type MuteOptions = {
  pressed?: boolean
  defaultPressed?: boolean
  onPressedChange?: (pressed: boolean, details: ChangeDetails<MuteReason>) => void
}

export const muteButton = definePrimitive({
  name: 'mute-button',
  options: { pressed: 'boolean', defaultPressed: 'boolean', onPressedChange: 'callback' },
  state: (options: MuteOptions) => ({ pressed: options.pressed ?? options.defaultPressed ?? false }),
  sync: (options) => (options.pressed === undefined ? {} : { pressed: options.pressed }),
  api: (context) => {
    const change = createChange(context)
    return {
      setPressed: (pressed: boolean, details: { reason?: MuteReason; event?: Event } = {}) =>
        change('pressed', pressed, { reason: details.reason ?? 'imperative', event: details.event }),
      toggle: (event?: Event) => change('pressed', !context.store.get().pressed, { reason: 'press', event }),
    }
  },
  slots: (slot) => ({
    root: slot<object, { pressed: boolean }>({
      state: (state) => ({ pressed: state.pressed }),
      attrs: (state) => ({ type: 'button', 'aria-pressed': String(state.pressed), 'data-pressed': state.pressed ? '' : undefined }),
      press: ({ api }, event) => api.toggle(event),
    }),
  }),
  agent: { actions: ['setPressed', 'toggle'] },
})
```

- `options` names every option and its kind, so the adapter knows `onPressedChange` is a callback and `pressed` a controlled value.
- `state` starts from `pressed` or `defaultPressed`; `sync` keeps a controlled `pressed` in step.
- `createChange` is the only way state changes: it calls `onPressedChange(next, details)` first, with the reason and the event, and the app can `details.cancel()` it. The reason has to be in UI SDK's vocabulary for the event it carries (`press` takes a mouse or keyboard event); strict mode (`globalThis.__UI_SDK_STRICT__ = true`, which the kit's tests set) throws on a mismatch.
- A slot turns state into attributes and events into calls. `press` hears a click, Enter and Space alike on a native button.
- `agent.actions` lists the api methods an agent may call.

To compose behaviors, call them in `api` with the same `context` and wire them into the slots, as the [behavior pages](https://blamy.github.io/ui/#/behaviors) do: `createRovingFocus(context, { slot: 'item', key: 'focused' })` for one tab stop, `createPopup(context, { preset })` for a popup, and the kit's `createStack(context, …)` from `@/lib/stack` for pages.

### 2. Render it

In the kit this is `components/mute-button.tsx`. `createParts` maps each slot to an element and returns a component per slot: `Root` here, `Trigger`, `Content`, `Item`… for a primitive with more slots.

```tsx
'use client'
import type { ComponentProps } from 'react'
import { createParts } from '@ui-sdk/react/primitive'
import { cva } from 'class-variance-authority'
import { muteButton } from '@/lib/mute-button-model'
import { cx } from '@/lib/utils'

const { Root } = createParts(muteButton, { root: 'button' })

export const muteButtonVariants = cva(
  'inline-flex h-9 items-center gap-2 rounded-ctl bg-secondary px-4 text-subhead font-semibold text-secondary-foreground ' +
    'transition-[scale,background-color] duration-spring-snappy ease-spring-snappy hover:bg-secondary-strong active:scale-[.97] ' +
    'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 data-pressed:bg-destructive data-pressed:text-white motion-reduce:transition-none',
)

export function MuteButton({ className, ...props }: ComponentProps<typeof Root>) {
  return <Root className={cx(muteButtonVariants(), className)} {...props} />
}
```

- The classes are tokens only (`rounded-ctl`, `bg-secondary`, `text-subhead`, the snappy spring), the platform's states (`hover:`, `active:`, `focus-visible:`) and the primitive's (`data-pressed:`).
- A part's `className` may be a function of its state, so merge with `cx(ours, className)` from `@/lib/utils`, last. `cn()` is for plain elements.
- Children may be a function of the slot's state (`{({ pressed }) => …}`), and `ref` is an ordinary prop.
- A module that uses `createParts` starts with `'use client'`.

### 3. Use and test it

```tsx
<MuteButton onPressedChange={(pressed, details) => console.log(pressed, details.reason)}>
  <Icon name="speaker" size={16} />
  Mute
</MuteButton>
```

Keep the name stable ("Mute") and let `aria-pressed` say whether it is on. A component with behavior gets a vitest file in happy-dom (`// @vitest-environment happy-dom`) that sets `globalThis.__UI_SDK_STRICT__ = true` and covers its keyboard, focus and ARIA contract, and the reasons its callbacks report.

### A part's key

Parts of one slot are told apart by a key: the part's `id` prop if it has one, else `String(value)`. Give a repeated part a `value` (`<Item value="wifi">`), and read it as `key` in the slot's handlers. A repeated part with neither shares one key with its siblings, and every one of them then hears the last one's props. An `id` is also written to the element as its DOM `id`.


## What our fork adds

We consume UI SDK through our fork, [BLamy/ui-sdk](https://github.com/BLamy/ui-sdk), vendored as a submodule at `vendor/ui-sdk`, built into `packages/ui-sdk-core` and `packages/ui-sdk-react`, and published as `@brett_lamy/ui-sdk-core` and `@brett_lamy/ui-sdk-react`. Everything imports them under upstream's names, `@ui-sdk/core` and `@ui-sdk/react` (npm aliases), so moving back to upstream is a change of two dependency lines once upstream has what we need.

The fork is upstream ([vercel-labs/ui](https://github.com/vercel-labs/ui) at `724a7d6c`) plus three small additions. Against that commit it changes 10 files (217 lines added, 43 removed) and adds one source file (`packages/core/src/foundation/platform/layer-host.ts`, 11 lines), 25 jsdom tests (`packages/core/test/layer-host.test.ts`), a playground fixture (`apps/playground/src/fixtures/layer-host/react.tsx`) with a 9-test browser spec (`tests/specs/layer-host.spec.ts`), and two changesets (`layer-hosts.md`, minor; `slot-prop-types.md`, patch). `git -C vendor/ui-sdk diff --stat` shows it.

| Addition | What it does | Why it is in the fork |
| --- | --- | --- |
| Layer hosts: an element with `data-layer-host` | Popups whose top-layer element is inside it stay out of the top layer, are placed against its box, and are modal to it alone: only the rest of the host turns inert, presses, focus and Escape from outside it pass by its modal layers and the layers beneath them, and a contained modal pauses only its host's shortcuts. Each host has its own modal stack. No new export: the attribute is the contract, and the host's `contain: layout` is the app's to write. | It changes how core's popups (`popup.ts`, `modal.ts`), layer stack (`layers.ts`), positioning (`position.ts`) and shortcuts (`create-shortcuts.ts`) work; nothing public can keep a popup out of the top layer, or scope inert, scroll lock and dismissal to an element. |
| `when?: () => boolean` on the public `bindLayer`, which also keeps to a host | While `when()` returns false, the layer is skipped: Escape goes on to the layer beneath (unprevented), outside presses and window blur pass it by. Inside a host, `topLayer: true` stays out of the top layer and a modal layer hears only its host. | `bindLayer` always took Escape and called `preventDefault()`. A layer that is bound but has nothing to dismiss for a while (a page stack on its first page) can't say so from outside. A few lines in `bind-layer.ts`. |
| `SlotProps` exported from `@ui-sdk/core/renderer`, beside `BaseSlotProps` | A kernel type already used in emitted declarations is exported (and marked `@experimental`). | A library that exports a primitive (`lib/<name>-primitive.ts`) has to name them in its own `.d.ts`; unexported, tsc inlines them. |

Contracts, demo and known limits: [Layer hosts](https://blamy.github.io/ui/#/behaviors-layer-hosts). Each of the 10 files changed from upstream says so in a `Modified in BLamy/ui-sdk:` line at its top.

Everything else the kit needs and UI SDK doesn't have (size classes and `presentation="auto"` following them, page stacks, edge swipes, the platform back, pull to refresh, React presence) is built in this library on UI SDK's public API: [The kit's behaviors](https://blamy.github.io/ui/#/behaviors-kit). The rule for the fork is the one in the repository's `CONVENTIONS.md`: an addition goes there only when a kit component needs it, it is generic, and it can't be built on the public API. A UI SDK bug is worked around in the kit and listed below; the fork doesn't carry fixes.

## What we would propose upstream

### Additions

1. **Layer hosts.** The fork's change as it stands, with its changeset and tests. A maintainer would take it because any app shown inside another (a phone frame in docs, a window manager, an embedded widget, Storybook) wants its popups contained, and today there is no way to get it. What they would weigh: it touches the shared popup path every overlay runs through; the browser spec covers only React on Chromium (no Vue, Svelte, Solid or web fixture, and it is not in the `*-portal` projects because its popups pass `container` explicitly); a sheet presented from a Popover, Menu, Select or Combobox in a host has no dim (its dim is the top layer's `::backdrop` and those components have no Backdrop part); and on Android the `CloseWatcher` back gesture still closes the topmost contained modal while focus is on the page outside the host.
2. **`when` on `bindLayer`.** Named after `registerShortcut`'s `when`. Small, generic, and documented in the fork's `popups.mdx` ("A Layer in the Stack"). It fits "layers of your own" unchanged and is what lets a page stack live outside core. Low risk; likely to be taken.
3. **Export `SlotProps` and `BaseSlotProps`.** A patch for anyone who publishes primitives with declarations. Low risk.
4. **The kit's behaviors, offered as optional upstream behaviors** (`packages/ui/src/lib`, each with its tests, all on UI SDK's public API, so each could move as one file plus docs):
   - **`bindSizeClass` / `sizeClassOf`** (an element's own width as `compact` / `medium` / `regular`) and a size-class scope that `presentation="auto"` reads. *For:* container-relative adaptivity is what makes `presentation="auto"` right in a phone frame or a split column; a framework adapter could provide the scope the way the kit's React context does. *Against:* it is a ResizeObserver plus a naming policy, CSS container queries cover the styling half, and core's `"auto"` is a media query by design; a core version that reads `[data-size-class]` from the DOM reads the wrong ancestors for portaled content (we tried it in the fork and reverted it), so it needs adapter-level context.
   - **`createStack`** (pages that cover each other: push, pop, `popTo`, `replace`, presence, focus in and back, inert covered pages, Escape through `bindLayer`, nested stacks innermost first, `active` for a stack only at some sizes, a `data-swipe-settling` CSS hook for the settle after a swipe). *For:* every mobile navigation pattern needs it, and getting focus, Escape and controlled pops right is the kind of thing UI SDK owns. *Against:* no upstream component uses it (api-guide: public is what three or more components use), and its state shape (`key` + `exiting` in the primitive's store) is a design choice upstream may want to make differently.
   - **`bindEdgeSwipe`** (an edge swipe with axis lock, a commit threshold and a projected fling; nested bindings, innermost first). *For:* small, on `bindDrag` + `createVelocityTracker` + `projectDistance`, and it is what a Drawer opened by a swipe would need (see "Drawer can't be dragged open" below). *Against:* only a stack or drawer uses it.
   - **`bindBack`** (Android's `CloseWatcher`, one history entry on iOS, nothing on desktop; one coordinator per window). *For:* the platform back is hard to get right next to the popups' own `CloseWatcher`. *Against:* holding a history entry is policy a router may want to own, and its behavior under the HTML close-watcher grouping rules (a watcher made without user activation joins the newest group once the page has more groups than user activations) is unverified on a device.
   - **`bindPullToRefresh`** (touch pull with a pending hold, rubber-banding and a delayed announcement; non-passive `touchmove` only for a touch that can pull). *For:* generic, beside the other direct-manipulation behaviors. *Against:* touch-only and app-level; browsers have their own.
   - **React presence: `usePresence(present)`, `usePresenceList(items, keyOf)`, `useEnterExit(ref, present)`** on `animateIn` / `animateOut`. *For:* `@ui-sdk/react` has presence for its own parts but nothing for an element of yours, so every app that leaves framer-motion writes this. *Against:* it is per-framework (Vue and Svelte have transitions built in), so it would be React-only.

### Bugs and gaps to report

Each one is what we found, what the kit does meanwhile, and the smallest change in UI SDK that would close it. File and line references are to UI SDK's source at `724a7d6c` (`vendor/ui-sdk/packages/…`).

#### Popups, dialogs and drawers

1. **`aria-label` on popup content is shadowed.** `contentAttrs` (`core/src/foundation/popups/popup-features.ts`) always writes `aria-labelledby` (the title, else the trigger), and `aria-labelledby` wins in the accessible name, so `<PopoverContent aria-label="Location">` is named after its trigger. That contradicts "A name you pass replaces the part's own" (`parts-and-composition.mdx`). *Meanwhile* the kit and its docs name popovers with a visually hidden `<PopoverTitle className="sr-only">`. *Change:* leave out the fallback `aria-labelledby` when the part has an `aria-label`.
2. **A Dialog loses focus to `<body>` when the focused control inside it is removed** (a multi-step dialog swapping its view). Screen readers lose their place, and keys then come from `<body>`. *Meanwhile* `DialogView` binds `createFocusRecovery` from `@ui-sdk/core` on each view, falling back to the card. *Change:* bind `createFocusRecovery({ fallback: () => content })` in the dialog content's `bind`.
3. **Hover cards don't warm across independent cards.** Tooltips group without a provider (the next opens at once, `data-instant`); two separate `HoverCard` roots each wait their `delay`, so sweeping along a row of avatars waits at every stop. *Meanwhile* nothing hand-rolled: the docs recommend one shared `createHoverCardController()` for a list. *Change:* give `hoverCardPreset` a `group` like the tooltip preset's `group: warmGroup` (`core/src/foundation/popups/popup-hover-presets.ts`), keyed apart from tooltips, and set `data-instant` on a card that opens at once, as `components/tooltip/tooltip.ts` does from `group.instant()`.
4. **A Drawer can't be dragged open from its edge.** The pointer driver starts only on open content. *Meanwhile* `AdaptivePane swipeToOpen` binds the kit's `bindEdgeSwipe` on a strip; a committed swipe opens the drawer (`reason: 'swipe'`), which then animates in without following the finger. *Change:* a controller method that starts the pointer driver from an outside `PointerEvent` at the collapsed position (`controller.drag(event)`), or an `openSwipe: { edge, size }` option.
5. **A Drawer can't step down instead of closing on Escape or an outside press.** Android's back already steps a drawer down a snap point internally, but it isn't an option. *Meanwhile* FloatingSheet cancels the close, reports the drawer's reason and event to its own `onOpenChange` (cancelable), then calls `controller.setSnapPoint(peek, { reason: 'imperative' })`, so the drawer's own `onSnapPointChange` still says `imperative`. *Change:* `dismissStepsDown?: boolean` (or `stepDownOn: ('escape-key' | 'outside-press' | 'back')[]`) reusing that path, reporting `onSnapPointChange(snapPoint, { reason, event })`.
6. **No drag-to-snap for an element of your own.** Drawer's snap engine (projection, rubber band, flick thresholds) only exists inside the top-layer Drawer, and `chooseSnapTarget` (`core/src/foundation/motion/projection`) isn't exported from `@ui-sdk/core/gesture`. *Meanwhile* the Composer's bump is `bindDrag` + `createVelocityTracker` + `rubberBand` with the snap choice written out. *Change:* export `chooseSnapTarget` from `/gesture`, or a `bindSnapDrag(handle, { axis, extent, snapPoints, onSnap, onDrag })` behavior.
7. **`DrawerOutlet`'s `keyframes` follow only `--drawer-expand`.** It also gets `--drawer-progress`, but the progress variables are cleared on close, so nothing can cross-fade a sheet into another element along the close travel below its smallest snap point. *Meanwhile* FloatingSheet's FAB pops in once the sheet has gone. *Change:* `follow?: 'expand' | 'progress'` on `DrawerOutlet`. Low priority.

#### React adapter

8. **A data root that is open on its first commit, with its content part inside a component, loses its keyboard wiring.** `Menu`, `Select`, `Combobox`, `Autocomplete` and `Command` render their own bare content when no content part is visible in the markup (`hasChild` in `react/src/children.ts`); a content part inside a styled wrapper is noticed only in a layout effect, so with `defaultOpen` both render on the first commit, every item mounts twice under one key, and the survivors are unregistered (ArrowDown does nothing, submenus don't open). Repro: `<Menu defaultOpen items={data}><MenuTrigger>Open</MenuTrigger><Styled /></Menu>` where `Styled` returns `<MenuContent><MenuItems items={data} /></MenuContent>`. *Meanwhile* the kit's DropdownMenu, Select and Combobox add a never-rendered element holding UI SDK's own content part, so `hasChild` finds one. *Change:* never mount the root's own content in the same commit as a placed one, or let a wrapper mark itself as a content part with a static marker `hasChild` sees.
9. **`useNearest` and `useHandle` aren't exported.** They are declared in `react/src/use-primitive.tsx`, but `react/src/primitive.ts` re-exports only `createParts`, `usePart`, `usePrimitive`, `mergeProps` and `renderElement`, so a hook like `useNavigationStack()` can't reach the nearest instance, and a component that reads `handle.state` doesn't re-render. *Meanwhile* the kit's roots call `usePrimitive` + `usePart` and put the api in a context of their own. *Change:* export `useNearest` and `useHandle` from `@ui-sdk/react/primitive`, and a `usePrimitiveState(handle, select?)` over `instance.subscribe`.
10. **`createParts` keys a part only by `id` or `value`**, and an `id` is also written to the element. A slot whose parts need a key that must not be a DOM `id` (table header cells and their resizers, keyed by column id), and whose `value` means something else, can't have one; parts with no key share one, so a slot with handlers hears the wrong part's props (clicking "Time" sorted by "Waterfall"). *Meanwhile* DataTable's headers, resizers and cells call `usePart(primitive, slot, { id, … }, props, tag)` directly. *Change:* a key prop separate from the DOM id that `createParts` maps to the slot's id without copying it to the element, a dev warning when two mounted parts of a slot with `on`, `bind` or `press` share a key, and a sentence in the kernel docs on how a part's key is chosen.

#### Menus, Select, Command and Listbox

11. **A context menu can only anchor at the pointer.** The context trigger passes `{ x, y }` to `show`, which wins over the content's `anchor` (`menu-api.ts`), so a menu can't hang from the area's edge (a dock). *Meanwhile* `anchor` was removed from the kit's DropdownMenuContextTrigger; the recipe is a controller opened from the area's own `onContextMenu` with `{ x: event.clientX, y: areaRect.top }` and `side="top"`. *Change:* an `anchor(point, area)` prop on the context trigger, applied to the `contextmenu` event and the long press.
12. **A composed Select's first typed key can be lost if it arrives before the hidden items mount.** Without `items`, the options are known only once the item parts mount, which the trigger does on `focusin` and `pointerenter` (`core/src/components/select/select-parts.ts`); a key that arrives in the same task as programmatic focus finds no options. *Meanwhile* not worked around: pass `items`, or `keepMounted` on the content. *Change:* in the trigger's typeahead (`select-keyboard.ts`), keep a key that arrives before any item has registered and run it once they mount. Low priority.
13. **Command doesn't restore the highlight on going back.** After `pop()` it restores the previous page's query but highlights its first command. *Meanwhile* CommandMenu records `controller.getValue()` per depth and sets it back in a `requestAnimationFrame` after a pop (a frame of the first row can show). *Change:* keep the highlighted value per stack depth, as the query is, and restore it on pop.
14. **Command's automatic first highlight fires no change**, so a preview pane can't follow from the start. *Meanwhile* each row publishes itself to a store when it renders `highlighted`, read by `useCommandMenuValue()`. *Change:* emit `onValueChange(value, { reason: 'auto' })`, or a subscribable value on the controller.
15. **No two-dimensional navigation in a Command grid group.** *Meanwhile* `CommandMenuInput` handles the arrows inside a `[data-columns]` group with `nearestInDirection` and `controller.setValue(…, { reason: 'list-navigation' })`. *Change:* a `layout="grid"` option on CommandGroup using `nearestInDirection`.
16. **CommandPage takes only `value`.** *Meanwhile* `CommandMenuPage` registers its `filter`, placeholder, title and key handler with the menu. *Change:* `filter` (and `placeholder`) on CommandPage, applied while it is on top.
17. **No always-open, searchable multi-select list.** Command has no selection (its `aria-selected` is the highlight), Combobox and Autocomplete are always a popup of their own, and Listbox has no search field driving it. *Meanwhile* `lib/option-search-primitive.ts`, on core's `createListbox` with `focus: 'virtual'` and `query`. *Change:* `multiple` + `value` / `onValueChange` on Command, or an inline presentation for Combobox.
18. **A manual-activation Listbox reports nothing when the current option is picked again**, so a one-choice list in a popover can't close on it. *Meanwhile* left as is (Escape closes). *Change:* an `onAction(value, details)` on Listbox for every activation, like Command's.
19. **No list or command row with a secondary action** (react-aria's GridList): options are `role="option"` and can't own a button. *Meanwhile* the t3-clone ModelPicker's star is a pointer-only button and Shift+Enter stars the highlighted row. *Change:* a `secondaryAction` slot on Command and Listbox items reachable from the keyboard, or a grid-list primitive on `createGridFocus`.
20. **ToggleGroup has no indicator part**, though SegmentedControl and Tabs have one, and the helper they share isn't exported (`bindIndicator` in `core/src/foundation/selection/indicator.ts`, with `layoutBox` from `core/src/foundation/platform/layout.ts`). *Meanwhile* `lib/selection-indicator-primitive.ts` measures the group's single `[data-pressed]` item and writes `--selection-indicator-*`. *Change:* a `ToggleGroupIndicator` part writing `--toggle-group-indicator-*`, or export `bindIndicator` and `layoutBox`.

#### Inputs, forms and dates

21. **`input-commit` doesn't list a plain `Event`.** `ColorPickerChannelInput` commits from its native `change` event and reports `input-commit`, whose development vocabulary allows only `FocusEvent | KeyboardEvent` (`core/src/foundation/kernel/dev.ts`, typed in `details.ts`), so development warns on a real commit and strict mode throws and `onValueChange` never runs. Production is unaffected. *Meanwhile* `color-picker.test.tsx` turns strict mode off around that one event. *Change:* add `Event` to `input-commit` in `dev.ts` and `details.ts`, or commit the channel input from its own Enter `keydown` and `focusout`, as `ColorPickerInput` does.
22. **`InputValueChangeReason` has no `history-key`**, though `createInputHistory`'s docs ("Report It as a Change", `core/text.mdx`) say to write history steps with it and the shared vocabulary has it. At runtime `controller.setValue(v, { reason: 'history-key', event })` already works in strict mode; only the type (`core/src/foundation/forms/text-field.ts`) blocks it. *Meanwhile* SqlEditor reports a history step as `imperative`, without its event. *Change:* add `"history-key"` to the union.
23. **No `escape-key` among `InputValueChangeReason`, and no clear on Escape.** `controller.clear({ event })` with a keydown fails strict mode (`imperative` doesn't take a `KeyboardEvent`). *Meanwhile* `lib/search-input-primitive.ts` clears with `reason: 'clear-press'` from the Escape keydown. *Change:* add `escape-key` to the union, or a `clearOnEscape` option on InputGroup.
24. **An empty InputGroup has no name in the agent snapshot.** It is listed as an `input` with a `clear` action, named by its Clear part, which is absent while the field is empty, disabled or read-only. *Meanwhile* not worked around; `search-input.test.tsx` marks it `it.fails`. *Change:* `agent: { actions: ['clear'], shown: (state) => state.filled && !state.disabled && !state.readOnly }` on `inputGroup` (`core/src/components/input/input.ts`).
25. **A DatePicker's Field error doesn't clear when its value is set without typing.** A calendar pick, a preset or `controller.setValue` updates the hidden input programmatically, which fires no event, so the Field never re-validates. *Meanwhile* not worked around; `date-picker.test.tsx` marks it `it.fails`. *Change:* on a non-typed commit (and `clear-press`, `reset`), call the field control's revalidate hook or dispatch `input` on the hidden input.
26. **DatePicker holds a date only**, with no `granularity` or time in one field. *Meanwhile* a DatePicker beside a TimeInput, joined as `` `${date}T${time}` ``, or `DateInput granularity="minute"` without a popup. *Change:* a `granularity` option on date-picker that parses a time after the date and keeps it when a day is picked.
27. **No zoned date-times in Date Input.** *Meanwhile* not supported; hold the zone separately. *Change:* an optional time-zone segment or offset. Low priority.
28. **No public way to make change details outside a primitive.** `createChange` needs a primitive context, and `createDetails` / `resolveSource` (`core/src/foundation/kernel/details.ts`, `input-source.ts`) aren't exported, so a React hook that holds state of its own can't build UI SDK-shaped details (`source`, `cancel()`, `canceled`) without copying `createDetails`. *Meanwhile* `lib/change-details.ts` (`changeDetails`, which builds the details by hand and reads `source` with UI SDK's public `sourceOf(event)`; no event is `programmatic`). *Change:* export `createDetails` and `resolveSource` (or one `changeDetails({ reason, event, source? })`) from the root entry, `@experimental`.
29. **Docs: a slot's key handlers don't hear IME composition.** A slot's `keydown` and `keyup` aren't called for a key that belongs to an input-method composition (`isComposing`, key code 229; `core/src/foundation/kernel/part.ts`). The kernel docs cover only the already-prevented case. *Change:* one sentence in the "Events" section of `core/kernel/define-a-primitive.mdx`.

#### Files and drag and drop

30. **A picked folder keeps system files that a dropped folder skips.** `directory` with the picker hands over `.DS_Store` and friends; a drop goes through `readEntries` in `core/src/components/file-input/file-drop.ts`, which skips them. *Meanwhile* they are listed like any file. *Change:* export the `systemFiles` check and apply it in the input's `change` handler (`file-input-api.ts`) to files with a `webkitRelativePath`.
31. **No signal when a dropped folder is cut short.** `readEntries` stops at 1,000 files silently. *Meanwhile* the first 1,000 are listed, with no notice. *Change:* return `{ files, truncated }` and add `truncated?: boolean` to `FileInputChange`, so it reaches `onValueChange`, `onReject` and the announcement.
32. **`FileInputDropzone` takes pastes an inner handler already handled.** `bindDropzone`'s paste listener ignores only events another zone claimed, not `event.defaultPrevented`. *Meanwhile* `ComposerInput` stops propagation of every paste that carries files. *Change:* return early in `onPaste` when `event.defaultPrevented` (or export `claim`).
33. **No native (`DataTransfer`) drag and drop.** `createReorder`, `createTreeReorder` and `createTransfer` are pointer-driven drafts inside the page: they can't carry a `DataTransfer` to other targets or windows, can't receive OS files, and a tree reorder places a row between rows, not into a folder. The pieces exist inside FileInput's dropzone (`createDragTracker`, `carriesFiles`, `draggedTypes`, `claim`) but aren't public. *Meanwhile* the data Tree keeps native `dragstart` on its rows and `dragover` / `dragleave` / `drop` on its scroller (no keyboard way to move a row), and the apple-notes block keeps a ~35-line `useDropTarget` hook (`registry/blocks/apple-notes/drag.ts`). *Change:* a pair of behaviors, `bindDropTarget(el, { accepts(types, event), over(target), drop(dataTransfer, event), targetOf(event) })` and `bindDragSource(el, { canDrag, data(dataTransfer) })`, reporting through `createChange` with an announcement; or at least export `createDragTracker`, `draggedTypes` and `carriesFiles` from `@ui-sdk/core/file-input`.

#### Direct manipulation, grids and canvases

34. **`createSwipeActions` can full-swipe on both sides or neither** (`!!options.onFullSwipe`), so `data-full` shows on both sides. *Meanwhile* `onFullSwipe` returns `false` for the other side, and the row works out `data-full` per side; that side still doesn't rubber-band past its actions (visual only). *Change:* `fullSwipe?: (side, key) => number | false`.
35. **`createStickToBottom` treats any upward scroll it didn't make as the reader letting go**, and has no mode for keeping the newest item anchored near the top. *Meanwhile* `lib/message-scroller-primitive.ts` calls `stick.release()` on purpose and keeps its own spacer and anchor math. *Change:* `stick.scrollTo(top, { behavior })` marked as programmatic, and an `anchor` option (selector or key, plus a peek offset).
36. **`createResize`'s `step` is both the arrow distance and the drop grid**, and it has no Home / End. *Meanwhile* SplitView's divider uses `createResize` for the drag and handles arrows, Home, End and Enter itself on a `separator` slot. *Change:* a separate `keyStep?: () => number`, and Home / End moving an edge handle to its `min` / `max`.
37. **Grid focus has no mode for cells that hold controls of their own.** `createGridFocus` and `createRovingFocus` leave in-cell controls tabbable everywhere. *Meanwhile* `createTabStop` in `lib/grid-behaviors.ts` keeps DataTable and LogList one Tab stop that walks the active unit's controls and then leaves. *Change:* a `controls` option (a selector, or `(cell) => HTMLElement[]`) on `createGridFocus` and `createRovingFocus`.
38. **`createViewport` announces the old zoom when the viewport is controlled.** `keydown` calls `zoomBy` and then announces `api.get().zoom`, which still holds the old value until the app passes the new one back. *Meanwhile* `lib/canvas-primitive.ts` handles the zoom keys itself and announces the zoom its `set` last asked for. *Change:* announce from the value handed to `set`, or have `zoomBy` / `zoomTo` return it.
39. **`createViewport().pointerdown` can't adopt a pointer that went down earlier**, so a second finger on a drawing board can't turn the first into a pinch. *Meanwhile* the canvas synthesizes a `pointerdown` for the first finger at its last position. *Change:* `pointerdown(event, { with: [{ pointerId, clientX, clientY }] })` or an `adopt(pointerId, x, y)` method.
40. **`createViewport` has no keyboard pan, and `ViewportReason` no reason for one.** *Meanwhile* the canvas pans with arrows through `panBy` and reports `move-key` (cast). *Change:* arrows in `keydown` pan by a step, and `move-key` in `ViewportReason`.
41. **`bindDrag`'s `onEnd` can't say an Escape ended the drag**, or hand over the key event: Escape and `pointercancel` both arrive as `canceled: true` with the last pointer event, so a control can't report `escape-key` with its `KeyboardEvent`. *Meanwhile* `lib/trace-timeline-primitive.ts` reads `event.type !== 'pointercancel'` as Escape and reports `escape-key` without an event. *Change:* a third argument, `{ cause: 'release' | 'pointercancel' | 'escape', event }`.
42. **`createSpans` (experimental) doesn't fit a video timeline.** No hook to adjust a proposed span (snapping to other clips and the playhead, model limits) before it becomes the draft; the spans must be an array in state rather than derived from the value; keyboard resize moves only the end; spans own the plain arrows, so they can't pair with `createRovingFocus`; `tracks()` is global, not per span; and `max` must equal the track's extent while the lanes grow with the view. *Meanwhile* `lib/video-timeline-primitive.ts` gives `createSpans` a view of the store that derives the spans and rewrites each draft, and handles ⌥⇧ arrows (trim start) and ⌥ arrows (focus) itself. *Change:* `adjust?(span, { action, edge, event, from }) => span | null` (or `snap: { points, threshold }`), a `spans?(state)` getter, a start-edge key, a documented pairing with roving focus, `tracks?(span)`.
43. **`createVirtualizer`'s `scrollMargin` is a fixed number**, though it is read on every layout. *Meanwhile* the Spreadsheet passes an options object with a `get scrollMargin()` accessor. *Change:* `scrollMargin?: number | (() => number)`. (Related, not a request: `createGridFocus` leaves ⌘/Ctrl with the arrows unhandled; the Spreadsheet jumps to the edge itself. An opt-in `edges: true` would make it upstream's.)

#### Agents

44. **A popup trigger rendered as a Button is listed twice in the agent snapshot.** `<DialogTrigger render={<Button />}>Delete project</DialogTrigger>` (and Menu, AlertDialog, Drawer and Popover triggers) gives a `button` entry and the popup's entry with the same name, so `press` by that name fails as ambiguous. It reproduces with bare `MenuTrigger render={<Button />}`. *Meanwhile* the kit styles triggers with `className={buttonVariants(…)}` rather than `render={<Button />}`, so a kit trigger registers once; blocks that still render a trigger as `<Button>` hit it. *Change:* in `core/src/page/agent/agent.ts`, don't register a Button whose root is also a popup's trigger part, or prefer the popup when the other match is its own trigger.
45. **`press` with a Button's own text as the argument fails**: `buttonsOf(parts)` searches only inside the root. *Change:* include part elements that themselves match `button, [role=button]`.
46. **Command can't run a command from an agent.** Its actions are `setValue`, `setQuery`, `setPages`; `setValue` only highlights and items aren't buttons. *Change:* expose the existing `run(value?)` as an action, resolving labels through `items`.
47. **Toast buttons can't be pressed by an agent** (`agent: { actions: ['pause'] }`). *Change:* add `press` (or `dismiss`) to the toast's actions.
48. **DatePicker's agent `setValue` with a date in words returns `ok: true` and changes nothing**; only `YYYY-MM-DD` is taken. *Change:* parse with the picker's locale (the parser its input uses), or throw "takes a date as YYYY-MM-DD".
49. **The bridge names a one-tab Tabs by its tab, not by its list's `aria-label`.** `componentLabel` (`core/src/page/observe/registry.ts`) says "keyless first" but iterates in registration order. *Change:* sort keyless parts first, as its comment says.
50. **The snapshot copies a controlled value whole**: a Spreadsheet's `value` is the entire table. *Change:* an `agent.state?(state)` (or `summary`) a primitive can return a summary from, used instead of the controlled keys.
51. **`checkPattern(root, 'checkbox')` counts a Checkbox's hidden form input.** It doesn't skip `aria-hidden` elements, so UI SDK's own Checkbox fails "input: has no accessible name" when run on a container. *Meanwhile* `checkbox.test.tsx` runs it on the checkbox button. *Change:* skip elements inside `aria-hidden="true"` in `withRole` / `isGone` (`core/src/testing/aria.ts`), for example with the `isUnreachable` check that file already has.

#### Platform

52. **`alt+space` never matches on Apple platforms.** `matchesKey` (`core/src/foundation/platform/platform.ts`) compares `event.key` with `" "` for `Space`, but macOS types U+00A0 for ⌥Space. *Meanwhile* the macos block listens for `keydown` and matches `e.code === 'Space' && e.altKey`. *Change:* `if (key === "Space") return typed === " " || event.code === "Space"`, and the same `event.code` fallback for Option-modified punctuation (letters and digits already have it).

Not gaps: UI SDK's Listbox always selects, where react-aria's could be a list of actions (that is a Menu or a Command, or `value={null}` with `activation="manual"`); a Drawer's swipe-to-dismiss alone is turned off with `data-drawer-no-drag` on its content, or by canceling `onOpenChange` when `details.reason === 'swipe'`.

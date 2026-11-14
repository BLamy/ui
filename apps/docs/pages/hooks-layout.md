# Layout hooks

Hooks for sizing from a container instead of the viewport (a size class first, pixels when you really need them), the size-class scope that `presentation="auto"` popups follow, and for reading the state of the layout containers: `SplitView`, `SidebarProvider`, `Tabs`, `FloatingSheet` and `ArtifactChatContainer`. They are all listed with their siblings in the [Hooks overview](https://blamy.github.io/ui/#/hooks).

Each hook below is public: import it from the package root, or from the alias path a registry copy creates.

```tsx
// npm: import '@brett_lamy/ui/styles.css' once, then
import {
  useSizeClass, useSizeClassScope, SizeClassProvider, usePresentation, useContainerWidth, useContainerSize, useSplitView, useSidebar, useTabs, useFloatingSheet,
  useHideOnScroll, useArtifactChatContainer,
} from '@brett_lamy/ui'

// shadcn registry: each part is its own item, imported from its alias
import { useSizeClass, useSizeClassScope, SizeClassProvider, usePresentation, useContainerWidth, useContainerSize } from '@/lib/container' // npx shadcn@latest add https://blamy.github.io/ui/r/container.json
import { useSplitView } from '@/components/ui/split-view'                    // …/r/split-view.json
import { useSidebar } from '@/components/ui/sidebar'                         // …/r/sidebar.json
import { useTabs, useTabsTab } from '@/components/ui/tabs'                 // …/r/tabs.json
import { useFloatingSheet } from '@/components/ui/floating-sheet'          // …/r/floating-sheet.json
import { useHideOnScroll } from '@/lib/scroll-edge'                       // …/r/scroll-edge.json
import { useArtifactChatContainer } from '@/components/ui/artifact-chat-container' // …/r/artifact-chat-container.json
```

## `useSizeClass`

The size class of an element's own box: `compact`, `medium` or `regular`. This is the hook to reach for when a component only needs to know whether it is small, middling or wide; the containers (`BLProvider`, `SplitView`, `SidebarProvider`, `NavigationStack`, `ArtifactChatContainer`) use the same classes. It is the kit's `bindSizeClass` (`@/lib/size-class`), which also writes `data-size-class` on the element, so CSS can style from it. It does not make the element a size-class scope: wrap what it renders in [`SizeClassProvider`](#sizeclassprovider-and-usesizeclassscope) when popups inside with `presentation="auto"` should follow it.

- **Export:** public, with the `UseSizeClassOptions` type. Registry item `container` (`@/lib/container`).
- **Needs:** nothing.

```ts
function useSizeClass<T extends HTMLElement = HTMLDivElement>(options?: UseSizeClassOptions): [(el: T | null) => void, SizeClass]

interface UseSizeClassOptions {
  breakpoints?: { medium?: number; regular?: number }   // px the classes start at; default 640 and 1024
  initial?: SizeClass                                   // until the element is measured (and on the server); default: the nearest scope's, else 'regular'
}
// SizeClass: 'compact' | 'medium' | 'regular'
```

It returns `[ref, sizeClass]`: put `ref` (a ref callback) on the element to measure. Until the ref is attached, or if you never attach it, `sizeClass` is `initial`, else the nearest scope's class, so `const [, sizeClass] = useSizeClass()` reads the size class of where a component sits.

```tsx
function Inbox() {
  const [ref, sizeClass] = useSizeClass()
  return (
    <div ref={ref} className="grid data-[size-class=compact]:grid-cols-1 grid-cols-[240px_1fr]">
      <SizeClassProvider value={sizeClass}>
        <Mailboxes />
        {sizeClass === 'compact' ? <MessageListWithBack /> : <MessageList />}
      </SizeClassProvider>
    </div>
  )
}
```

Gotchas:

- Prefer the `data-size-class` attribute in classes (`data-[size-class=compact]:…`) over branching in render where the difference is only styling: it changes without a React render.
- It renders only when the class changes, not on every pixel, unlike `useContainerWidth`.
- Server render and the first client render use `initial` (else the scope's class), then a layout effect measures before paint. A component that starts compact (a phone frame) should pass `initial: 'compact'` to avoid a jump. A box with no width (`display: none`) isn't measured until it has one.
- The ref is a ref callback, so an element that renders later (behind a condition) is measured when it mounts.
- Reach for pixels (`useContainerWidth`, `useContainerSize`) only when you need them: a column count, a canvas size.
- A `<div data-size-class="compact">` wrapper doesn't change how popups present: only a `SizeClassProvider` does.

## `SizeClassProvider` and `useSizeClassScope`

The size-class scope: a React context that says what size class everything rendered inside lives in, popups included. Every kit container that measures its size class provides it (`BLProvider`'s root, `SplitView`, `NavigationStack`, `SidebarProvider`, `ArtifactChatContainer`); `AdaptivePane` and `FloatingSheet` don't measure one, so they pass the outer scope through (and `AdaptivePane`'s `presentation="auto"` reads it). React context crosses portals, so a popup whose content renders into `BLProvider`'s root still sees the scope it was written in, such as a compact SplitView column.

- **Export:** public. Registry item `container` (`@/lib/container`).
- **Needs:** nothing. **Outside every scope:** `useSizeClassScope()` returns `undefined`.

```ts
function SizeClassProvider(props: { value: SizeClass | undefined; children?: ReactNode }): JSX.Element
function useSizeClassScope(): SizeClass | undefined
```

```tsx
// A phone frame of your own: measure it, and make it the scope of what it renders.
function PhoneFrame({ children }: { children: ReactNode }) {
  const [ref, sizeClass] = useSizeClass<HTMLDivElement>({ initial: 'compact' })
  return (
    <div ref={ref} className="h-[720px] w-[390px] overflow-clip">
      <SizeClassProvider value={sizeClass}>{children}</SizeClassProvider>
    </div>
  )
}
```

Gotchas:

- `value={undefined}` (not measured yet) passes the scope around it through instead of clearing it.
- To keep popups inside the frame too, make it a layer host (`data-layer-host=""` and `[contain:layout]`, or a `BLProvider`): see [Layer hosts](https://blamy.github.io/ui/#/behaviors-layer-hosts).

## `usePresentation`

What a popup wrapper passes to UI SDK for `presentation`. `"auto"` becomes `"sheet"` inside a compact scope and `fallback` (the component's own presentation) inside a medium or regular one; with no scope at all `"auto"` goes through, and UI SDK's own rule decides (`(max-width: 640px) and (pointer: coarse)`). Any other value is returned as it is. The kit's `Dialog` (whose default is `"auto"`), `Popover`, `DropdownMenu`, `Select`, `Combobox` and `DatePicker` call it; call it in a wrapper of your own around a UI SDK popup.

- **Export:** public. Registry item `container` (`@/lib/container`).
- **Needs:** nothing.

```ts
function usePresentation<P extends string>(presentation: P | undefined, fallback: P): P | undefined
```

```tsx
import { Popover as SdkPopover } from '@ui-sdk/react/popover'

function MyPopover({ presentation, ...props }: ComponentProps<typeof SdkPopover>) {
  return <SdkPopover presentation={usePresentation(presentation, 'popover')} {...props} />
}
```

Gotchas:

- The decision is made when the popup opens; resizing the scope while it is open doesn't switch it.

## `useContainerWidth`

Measures an element's width with a `ResizeObserver`, so a component sizes itself from the box it is in. Use it when you need pixels; when you only need compact / medium / regular, use `useSizeClass`.

- **Export:** public. Registry item `container` (`@/lib/container`).
- **Needs:** nothing.

```ts
function useContainerWidth<T extends HTMLElement = HTMLDivElement>(initial = 1200): [RefObject<T | null>, number]
```

| Parameter | Default | Effect |
| --- | --- | --- |
| `initial` | `1200` | The width reported until the first real measurement. Also what you get while the element has zero width. |

It returns `[ref, width]`: put `ref` on the element to measure, and use `width` (px) in render.

```tsx
function Gallery({ items }: { items: Item[] }) {
  const [ref, width] = useContainerWidth<HTMLDivElement>()
  const columns = width < 320 ? 1 : width < 640 ? 2 : 3
  return (
    <div ref={ref} style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
      {items.map((item) => <Card key={item.id} item={item} />)}
    </div>
  )
}
```

{% demo src="hooks-layout/container-size" %}

Gotchas:

- **Observed at mount only.** The element is read once, in a layout effect with no dependencies. The element must exist when the component first commits; if `ref` points at something that renders later (behind a condition, after data loads), it is never measured and `width` stays at `initial`.
- **Zero is ignored.** A width of `0` (an element that is `display: none`, or not laid out yet) is not applied, so the last real width (or `initial`) stays.
- **Content box.** After the first callback the width is the observer's `contentRect.width`: the box without padding and border. The first synchronous read uses `getBoundingClientRect()`, which includes them, but the observer fires as soon as it starts observing and replaces it.
- **Re-renders on every width change.** The state is set for each distinct width, so a drag-resize renders the component each frame. Derive a small value in render (a column count, a class name) and keep expensive children memoized.
- **Server render.** Nothing is measured on the server, so the markup is rendered with `initial` (1200). The first client render uses `initial` too, so there is no hydration mismatch, then the layout effect measures before paint. Choose an `initial` close to your typical layout to avoid a visible jump.
- **No `ResizeObserver`.** Without it (very old browsers, some test environments) you get the one initial measurement and no updates.
- `ref` is a stable object.

## `useContainerSize`

The same, for width and height.

- **Export:** public. Registry item `container`.
- **Needs:** nothing.

```ts
function useContainerSize<T extends HTMLElement = HTMLDivElement>(
  initial: ContainerSize = { width: 1200, height: 800 },
): [RefObject<T | null>, ContainerSize]

interface ContainerSize { width: number; height: number }
```

```tsx
const [ref, { width, height }] = useContainerSize<HTMLDivElement>()
const landscape = width > height
```

Differences from `useContainerWidth`, from the source:

- A reading is skipped only when **both** dimensions are zero. An element that is 0 wide and 80 tall is applied.
- The size state keeps its identity when a reading repeats the current size, so an observer callback with an unchanged box does not re-render.
- It has the same mount-only observation, content-box measurement, server behavior and `ref` stability as the width hook.

## `useSplitView`

The state and actions of the nearest [SplitView](https://blamy.github.io/ui/#/split-view): the size class, which columns are showing, the value per column and navigation.

- **Export:** public. Registry item `split-view`.
- **Needs:** a `SplitView` ancestor. **Outside it:** throws `<useSplitView> must be rendered inside <SplitView>`.

```ts
function useSplitView(): SplitViewContextValue   // SplitViewState plus the actions below
```

| Member | Meaning |
| --- | --- |
| `sizeClass`, `collapsed` | The size class in effect (`compact`, `medium` or `regular`, measured from the split view's own box unless its `sizeClass` prop forces one), and whether the view is collapsed to one column at a time (compact). |
| `columns` | The columns that are shown, in order (a closed supplementary is left out). |
| `sidebarOpen`, `setSidebarOpen(open)`, `toggleSidebar()` | Whether the sidebar is open. |
| `sidebarBehavior` | The resolved behavior for this size class: `tile`, `overlay` or `displace`. |
| `value`, `select(column, value \| null)`, `isCurrent(column, value)` | The value per column. `select` shows the next column (a push when collapsed); `null` clears. `isCurrent` (what an item draws as current) is always `false` while collapsed, where rows are navigation. |
| `compactColumn`, `show(column)`, `back()`, `canGoBack` | Which column is on top of the compact stack, and how to move between them. `canGoBack` is true only while collapsed and not on the first column. |
| `columnWidths`, `setColumnWidth(column, width)` | Resized column widths in px. |
| `supplementaryOpen`, `setSupplementaryOpen(open)` | Whether the middle column is showing, or has slid away so the detail takes its space. |

Every action takes an optional last argument `{ reason?, event? }`, goes through the matching `on…Change(value, details)` callback on `SplitView` like a user's change, and returns `false` when nothing changed or the change was canceled.

```tsx
function DetailToolbar() {
  const split = useSplitView()
  return (
    <div className="flex items-center gap-2">
      {split.canGoBack ? <Button onClick={() => split.back()}>Back</Button> : null}
      <Button onClick={() => split.toggleSidebar()}>{split.sidebarOpen ? 'Hide' : 'Show'} sidebar</Button>
      <span>{split.value.detail ?? 'Nothing selected'}</span>
    </div>
  )
}
```

Gotchas:

- `select('sidebar', id)` also closes a floating sidebar (any behavior except `tile`) when the view is not collapsed.
- The returned object and its functions are kept while the split view's state is unchanged and rebuilt when it changes, so a dependency on them re-runs on every change. For code outside the split view, pass a controller to `SplitView` instead.

## `useSplitViewColumn`

Which column the calling component is rendered in.

- **Export:** public. Registry item `split-view`.
- **Needs:** to be rendered inside a column. **Outside it:** returns `null`; it never throws.

```ts
function useSplitViewColumn(): SplitViewColumn | null   // 'sidebar' | 'supplementary' | 'detail'
```

```tsx
function EmptyHint() {
  const column = useSplitViewColumn()
  return <p>{column === 'detail' ? 'Select a conversation' : null}</p>
}
```

## `useSplitViewBack`

For a container that draws its own bar at the root of a split view column. While the split view is collapsed and a column comes before this one, it returns that column's title and the way back to it.

- **Export:** public. Registry item `split-view`.
- **Needs:** nothing; it is for a bar of your own at the root of a column (a `NavigationStack` in a column does the same by itself, through `lib/stack-parent`). **Outside a column, or inside a NavigationStack's pages:** returns `null`.

```ts
function useSplitViewBack(title?: string): { title: string; back: () => void } | null
```

| Parameter | Effect |
| --- | --- |
| `title` | Registers this column's own title (in a layout effect, only when it is not `undefined`) so the column after it can use it as its back label. This is what a `SplitViewHeader` does. |

It returns `null` unless the split view is collapsed, the caller is in a column that is not the first, and it is not inside a page of a `NavigationStack` (whose way back is the stack's own). The returned `title` is the previous column's registered title, or `'Back'` when it registered none.

```tsx
function InboxScreen() {
  // In a custom screen with its own bar
  const back = useSplitViewBack('Mailboxes')
  return back ? <Button onClick={back.back}>‹ {back.title}</Button> : null
}
```

## `useSidebar`

State of the nearest [SidebarProvider](https://blamy.github.io/ui/#/sidebar).

- **Export:** public. Registry item `sidebar`.
- **Needs:** a `SidebarProvider` ancestor. **Outside it:** throws `Sidebar components must be rendered inside <SidebarProvider>`.

```ts
function useSidebar(): SidebarContextValue

interface SidebarContextValue {
  open: boolean
  setOpen: (open: boolean, options?: { reason?: SidebarOpenChangeReason; event?: Event }) => boolean
  toggle: (options?: { reason?: SidebarOpenChangeReason; event?: Event }) => boolean
  sizeClass: 'compact' | 'medium' | 'regular' // measured on the provider (`bindSizeClass` from `@/lib/size-class`)
  compact: boolean // sizeClass === 'compact': narrower than `breakpoint` (default 560px)
}
```

```tsx
function MenuButton() {
  const { toggle, open, compact } = useSidebar()
  return <Button onClick={() => toggle()} aria-expanded={open}>{compact ? 'Menu' : 'Sidebar'}</Button>
}
```

Gotchas:

- `open` is reset whenever the provider crosses into or out of `compact`: closed when it becomes compact, and back to `defaultOpen` when it grows again, reported to `onOpenChange` with `reason: 'content-resize'` (cancel it to keep the state). The first measurement is where it starts, not a change: an uncontrolled sidebar mounted compact starts closed, and a controlled parent hears nothing at mount.
- `setOpen` and `toggle` go through `onOpenChange` like the user's own changes and return `false` when nothing changed or the change was canceled. For code outside the provider, pass a `createSidebarController()` as its `controller`.
- `useSidebarCollapsed()` says whether the sidebar around is a collapsed rail, for custom parts that hide their text (`false` outside a `Sidebar`).
- A `Sidebar` with `presentation="auto"` (its default) is a drawer while `compact`; a press on one of its rows closes the drawer by itself, so `setOpen(false)` after a pick is only needed for your own controls.

## `useTabs`

The enclosing `Tabs`' look, side and orientation.

- **Export:** public. Registry item `tabs`.
- **Needs:** to be called inside a `Tabs`. **Outside it:** returns `null`.

```ts
function useTabs(): { variant: TabsVariant; side: 'top' | 'bottom' | 'start' | 'end'; orientation: 'horizontal' | 'vertical' } | null
```

```tsx
function RailBadge() {
  const tabs = useTabs()
  return tabs?.orientation === 'vertical' ? <Dot /> : <Count />
}
```

`side` is the root's, or the default for its `variant` (`bottom` for `bar`, `start` for `rail` and `workspace`, `top` otherwise); `orientation` follows from it.

## `useTabsTab`

Inside a `TabsTab`: its UI SDK tab state, for custom tab content.

- **Export:** public. Registry item `tabs`.
- **Needs:** to be called from the content of a `TabsTab` (its `children`). **Outside it:** returns `null`.

```ts
function useTabsTab(): TabsTabState | null   // { selected: boolean; disabled: boolean }
```

```tsx
function InboxLabel() {
  const tab = useTabsTab()
  return <span className={tab?.selected ? 'font-semibold' : undefined}>Inbox</span>
}

<TabsTab value="inbox"><InboxLabel /></TabsTab>
```

`TabsTab` also passes the same state to a render-function child: `<TabsTab value="inbox">{({ selected }) => …}</TabsTab>`. The hook is for a nested component that cannot take it as a parameter.

Hover, press and keyboard focus are not part of the state: style them with the pseudo-classes. Every tab is a `group/tab`, so content inside it uses `group-hover/tab:`, `group-active/tab:` and `group-focus-visible/tab:`.

## `useFloatingSheet`

State of the enclosing [FloatingSheet](https://blamy.github.io/ui/#/floating-sheet).

- **Export:** public. Registry item `floating-sheet`.
- **Needs:** a `FloatingSheet` ancestor (anything inside `FloatingSheetBody`, `FloatingSheetFoot` or `FloatingSheetFab` counts). **Outside it:** throws `useFloatingSheet must be used within <FloatingSheet>`.

```ts
function useFloatingSheet(): FloatingSheetContextValue

interface FloatingSheetContextValue {
  open: boolean                      // grown to full height
  setOpen: (open: boolean, given?: { reason; event? }) => void
  progress: number                   // the resting stop: 0 at the peek, 1 fully grown, a snap point in between
  peek: number                       // body height visible while resting, px
  minimized: boolean                 // folded into its FAB
  setMinimized: (minimized: boolean, given?: { reason; event? }) => void
}
```

```tsx
function SheetTitle() {
  const { open, setOpen, progress } = useFloatingSheet()
  return (
    <button onClick={() => setOpen(!open)} style={{ opacity: 0.6 + 0.4 * progress }}>
      {open ? 'Close' : 'Details'}
    </button>
  )
}
```

`progress` is where the sheet rests, not where the finger is: it changes when a drag settles, not per frame. For styling that follows the drag, read the `--fs-grown` CSS variable on the surface (0 to 1, inherited by everything inside it). `setOpen` and `setMinimized` go through the component's controllable state: they call `onOpenChange` / `onMinimizedChange` (reason `imperative` unless you pass one) and, when you control the value, your state decides.

## `useHideOnScroll`

Whether floating chrome should hide: the shared chrome state says the bars are hidden (`useChromeHidden()`), or the scroller you pass was scrolled down. It shows again on a scroll up and at the top. `FloatingSheet` and `ArtifactChatContainer` use it for their `hideOnScroll` prop; use it for chrome of your own that should behave the same.

- **Export:** public, from `@/lib/scroll-edge` (beside `bindScrollEdge`, the framework-free scroll follower it is built on). Registry item `scroll-edge`.
- **Needs:** nothing.

```ts
function useHideOnScroll(hideOnScroll: boolean, scrollRef?: RefObject<HTMLElement | null>): boolean
```

It is always `false` when `hideOnScroll` is `false`. The scroller is read from `scrollRef` in an effect, so it must be mounted when the component commits.

## `useArtifactChatContainer`

State of the enclosing [ArtifactChatContainer](https://blamy.github.io/ui/#/artifact-chat-container): which layout is showing, and the floating chat's open, folded and composing state.

- **Export:** public. Registry item `artifact-chat-container`.
- **Needs:** an `ArtifactChatContainer` ancestor; anything inside `ArtifactChatContainerContent`, `ArtifactChatContainerChat` and `ArtifactChatContainerComposer` counts (the Chat and Composer are portalled into the current layout's docks, but React context follows where you wrote them). **Outside it:** throws `useArtifactChatContainer must be used within <ArtifactChatContainer>`.

```ts
function useArtifactChatContainer(): ArtifactChatContainerContextValue

interface ArtifactChatContainerContextValue {
  sizeClass: 'compact' | 'medium' | 'regular'   // the container's own size class
  layout: 'split' | 'floating'                  // the resolved presentation
  open: boolean                                 // the floating chat is grown (always false while docked)
  setOpen: (open: boolean, given?: { reason; event? }) => void
  composing: boolean                            // the real composer shows, not the working status
  setComposing: (composing: boolean, given?: { reason; event? }) => void
  minimized: boolean                            // the floating chat is folded into its FAB
  setMinimized: (minimized: boolean, given?: { reason; event? }) => void
}
```

```tsx
function ChatToggle() {
  const { layout, open, setOpen } = useArtifactChatContainer()
  if (layout === 'split') return null   // docked: the transcript is always visible
  return <Button onClick={() => setOpen(!open)}>{open ? 'Hide chat' : 'Show chat'}</Button>
}
```

The setters go through the container's controllable state (`onOpenChange`, `onComposingChange`, `onMinimizedChange`, reason `imperative` unless you pass one). The same composer and transcript elements move between the docked column and the floating sheet, so React state inside them survives a layout change; see [ArtifactChatContainer](https://blamy.github.io/ui/#/artifact-chat-container).

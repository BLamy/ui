# Layout hooks

Hooks for sizing from a container instead of the viewport, and for reading the state of the layout containers: `SplitView`, `SidebarProvider`, `TabView`, `FloatingSheet`, `FloatingChat` and `ArtifactChatContainer`. They are all listed with their siblings in the [Hooks overview](https://blamy.github.io/ui/#/hooks).

Each hook below is public: import it from the package root, or from the alias path a registry copy creates.

```tsx
// npm: import '@brett_lamy/ui/styles.css' once, then
import {
  useContainerWidth, useContainerSize, useSplitView, useSidebar, useTabView, useFloatingSheet, useArtifactChatContainer,
} from '@brett_lamy/ui'

// shadcn registry: each part is its own item, imported from its alias
import { useContainerWidth, useContainerSize } from '@/lib/container'        // npx shadcn@latest add https://blamy.github.io/ui/r/container.json
import { useSplitView } from '@/components/ui/split-view'                    // …/r/split-view.json
import { useSidebar } from '@/components/ui/sidebar'                         // …/r/sidebar.json
import { useTabView, useTabViewTab } from '@/components/ui/tab-view'         // …/r/tab-view.json
import { useFloatingSheet } from '@/components/ui/floating-sheet'            // …/r/floating-sheet.json
import { useFloatingChat } from '@/components/ui/floating-chat'              // …/r/floating-chat.json
import { useArtifactChatContainer } from '@/components/ui/artifact-chat-container' // …/r/artifact-chat-container.json
```

## `useContainerWidth`

Measures an element's width with a `ResizeObserver`, so a component sizes itself from the box it is in. Every adaptive shell (`SplitView`, `SidebarProvider`, `ArtifactChatContainer`) is built on it.

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

The state and actions of the nearest [SplitView](https://blamy.github.io/ui/#/split-view): the width class, which columns are showing, the selection and navigation.

- **Export:** public. Registry item `split-view`.
- **Needs:** a `SplitView` ancestor. **Outside it:** throws `<useSplitView> must be rendered inside <SplitView>`.

```ts
function useSplitView(): SplitViewState
```

| Member | Meaning |
| --- | --- |
| `widthClass`, `collapsed`, `width` | The width class in effect (`compact`, `medium` or `regular`), whether the view is collapsed to one column at a time (compact), and its measured width in px. |
| `columns` | The columns that are shown, in order (a hidden supplementary is left out). |
| `sidebarVisible`, `setSidebarVisible(visible)`, `toggleSidebar()` | Sidebar visibility. `sidebarVisible` is `false` when there is no sidebar column. |
| `sidebarBehavior` | The resolved behavior for this width class: `tile`, `overlay` or `displace`. |
| `selection`, `select(column, id \| null)`, `isSelected(column, id)` | The selection per column. `select` shows the next column (a push when collapsed); `null` clears. `isSelected` is always `false` while collapsed, where rows are navigation. |
| `topColumn`, `show(column)`, `back()`, `canGoBack` | Which column is on top when collapsed, and how to move between them. `canGoBack` is true only while collapsed and not on the first column. |
| `widths`, `setColumnWidth(column, width)` | Resized column widths in px. |
| `supplementaryVisible`, `setSupplementaryVisible(visible)` | Whether the middle column is showing, or has slid away so the detail takes its space. |

```tsx
function DetailToolbar() {
  const split = useSplitView()
  return (
    <div className="flex items-center gap-2">
      {split.canGoBack ? <Button onPress={split.back}>Back</Button> : null}
      <Button onPress={split.toggleSidebar}>{split.sidebarVisible ? 'Hide' : 'Show'} sidebar</Button>
      <span>{split.selection.detail ?? 'Nothing selected'}</span>
    </div>
  )
}
```

Gotchas:

- `select('sidebar', id)` also closes a floating sidebar (any behavior except `tile`) when the view is not collapsed.
- The returned object is rebuilt each render. `select`, `isSelected` and `toggleSidebar` are memoized (`isSelected` changes when the selection or `collapsed` does), so they are safe in dependency arrays; the object itself is not.

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
- **Needs:** nothing; it is meant for a `NavigationStack` at the root of a column, and `NavigationStack` already calls it for you. **Outside a SplitView:** returns `null`.

```ts
function useSplitViewBack(title?: string): { title: string; back: () => void } | null
```

| Parameter | Effect |
| --- | --- |
| `title` | Registers this column's own title (in a layout effect, only when it is not `undefined`) so the column after it can use it as its back label. This is what a `SplitViewHeader` does. |

It returns `null` unless the split view is collapsed, the caller is in a column that is not the first, and it sits on the root page of any `SplitViewStack` in that column. The returned `title` is the previous column's registered title, or `'Back'` when it registered none.

```tsx
function InboxScreen() {
  // In a custom screen with its own bar
  const back = useSplitViewBack('Mailboxes')
  return back ? <Button onPress={back.back}>‹ {back.title}</Button> : null
}
```

## `useSplitViewStack`

The nearest `SplitViewStack`'s push and pop. A column given the `stack` prop has one.

- **Export:** public. Registry item `split-view`.
- **Needs:** a `SplitViewStack` ancestor (or a column with `stack`). **Outside it:** throws `useSplitViewStack must be used inside <SplitViewStack> (or a column with \`stack\`)`.

```ts
function useSplitViewStack(): SplitViewStackApi

interface SplitViewStackApi {
  push: (page: ReactNode, options?: { key?: string }) => void
  pop: () => void               // no-op at the root
  popToRoot: () => void
  depth: number                 // pages including the root: 1 at the root
  canPop: boolean
}
```

```tsx
function ThreadRow({ thread }: { thread: Thread }) {
  const stack = useSplitViewStack()
  return <Button onPress={() => stack.push(<ThreadPage id={thread.id} />, { key: thread.id })}>{thread.title}</Button>
}
```

Pages are kept as elements, so a pushed page does not re-render with the component that pushed it. Read live data from hooks or context inside the page.

## `useSidebar`

State of the nearest [SidebarProvider](https://blamy.github.io/ui/#/sidebar).

- **Export:** public. Registry item `sidebar`.
- **Needs:** a `SidebarProvider` ancestor. **Outside it:** throws `Sidebar components must be rendered inside <SidebarProvider>`.

```ts
function useSidebar(): SidebarContextValue

interface SidebarContextValue {
  open: boolean
  setOpen: React.Dispatch<React.SetStateAction<boolean>>
  toggle: () => void
  narrow: boolean   // the provider is narrower than its `breakpoint` (default 560px)
}
```

```tsx
function MenuButton() {
  const { toggle, open, narrow } = useSidebar()
  return <Button onPress={toggle} aria-expanded={open}>{narrow ? 'Menu' : 'Sidebar'}</Button>
}
```

Gotchas:

- `open` is reset whenever `narrow` changes: closed when the provider becomes narrow, and back to `defaultOpen` when it becomes wide again. A manual open or close is overwritten at that moment. The first measurement counts too: `narrow` starts `false` (the provider measures with `useContainerWidth`, whose initial width is 1200), so a narrow provider closes its sidebar on the first layout.
- `toggle` and the context object are rebuilt each render.

## `useTabView`

The enclosing `TabView`'s orientation, placement and bar variant.

- **Export:** public. Registry item `tab-view`.
- **Needs:** nothing, but only means something inside a `TabView`. **Outside it:** no error: you get the defaults `{ orientation: 'horizontal', placement: 'bottom', variant: 'bar' }`.

```ts
function useTabView(): { orientation: 'horizontal' | 'vertical'; placement: 'top' | 'bottom' | 'start' | 'end'; variant: 'bar' | 'rail' | 'workspace' | 'plain' }
```

```tsx
function TabBadge() {
  const { orientation } = useTabView()
  return <span className={orientation === 'vertical' ? 'ms-auto' : 'absolute -top-1 -end-1'}>3</span>
}
```

`variant` depends on where you call it. In `TabView` itself it is `rail` for a vertical view and `bar` for a horizontal one; inside a `TabViewBar` it is that bar's `variant` prop.

## `useTabViewTab`

Inside a `TabViewTab`: its react-aria render state, for custom tab content.

- **Export:** public. Registry item `tab-view`.
- **Needs:** to be called from the content of a `TabViewTab` (its `children`). **Outside it:** returns `null`.

```ts
function useTabViewTab(): TabRenderProps | null   // isSelected, isHovered, isPressed, isFocused, isFocusVisible, isDisabled, …
```

```tsx
function InboxLabel() {
  const tab = useTabViewTab()
  return <span className={tab?.isSelected ? 'font-semibold' : undefined}>Inbox</span>
}

<TabViewTab id="inbox"><InboxLabel /></TabViewTab>
```

`TabViewTab` also passes the same state to a render-function child: `<TabViewTab>{({ isSelected }) => …}</TabViewTab>`. The hook is for a nested component that cannot take it as a parameter.

## `useFloatingSheet`

State of the enclosing [FloatingSheet](https://blamy.github.io/ui/#/floating-sheet).

- **Export:** public. Registry item `floating-sheet`.
- **Needs:** a `FloatingSheet` ancestor (its `Body`, `Foot` and `Fab` slots count). **Outside it:** throws `useFloatingSheet must be used within <FloatingSheet>`.

```ts
function useFloatingSheet(): FloatingSheetContextValue

interface FloatingSheetContextValue {
  open: boolean                      // grown to full height
  setOpen: (open: boolean) => void
  progress: number                   // 0 at rest (foot plus peek), 1 when the surface fills the host
  peek: number                       // body height visible while closed, px
  minimized: boolean                 // folded into its FAB
  setMinimized: (minimized: boolean) => void
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

`progress` is the growth past the resting height, so a sheet with a `peek` stays at `0` while it only shows its peek. `setOpen` goes through the component's controllable state: when you control `open`, it calls `onOpenChange` and your state decides.

## `useFloatingChat`

State of the enclosing [FloatingChat](https://blamy.github.io/ui/#/floating-chat).

- **Export:** public. Registry item `floating-chat`.
- **Needs:** a `FloatingChat` ancestor. **Outside it:** throws `useFloatingChat must be used within <FloatingChat>`.

```ts
function useFloatingChat(): FloatingChatContextValue

interface FloatingChatContextValue {
  open: boolean                             // the full transcript is revealed
  setOpen: (open: boolean) => void
  progress: number                          // 0 when only the composer floats, 1 when the transcript reaches the top
  composing: boolean                        // the real composer is showing, not the tappable working status
  setComposing: (composing: boolean) => void
  minimized: boolean                        // folded into its FAB
  setMinimized: (minimized: boolean) => void
}
```

```tsx
<FloatingChat working={busy}>
  <FloatingChat.Chat><Transcript /></FloatingChat.Chat>
  <FloatingChat.Composer><MyComposer /></FloatingChat.Composer>
</FloatingChat>

function Transcript() {
  const { open, progress } = useFloatingChat()
  return <div data-open={open} style={{ opacity: progress }}>…</div>
}
```

**Not inside `ArtifactChatContainer`.** There, the container renders the `Chat` and `Composer` slots itself, in portals created in its own tree and outside the `FloatingChat` it shows when compact. React context follows the tree, not the DOM, so `useFloatingChat()` throws in those slots even though the chat is on screen. Use `useArtifactChatContainer()` below instead.

## `useArtifactChatContainer`

State of the enclosing [ArtifactChatContainer](https://blamy.github.io/ui/#/artifact-chat-container): which layout is showing, and the chat's open and composing state.

- **Export:** public. Registry item `artifact-chat-container`.
- **Needs:** an `ArtifactChatContainer` ancestor; its `Content`, `Chat` and `Composer` slots are all inside it. **Outside it:** throws `useArtifactChatContainer must be used within <ArtifactChatContainer>`. The same hook is `ArtifactChatContainer.useContainer`, and the context itself is `ArtifactChatContainer.Context`.

```ts
function useArtifactChatContainer(): ArtifactChatContainerContextValue

interface ArtifactChatContainerContextValue {
  width: number                  // the container's measured width
  layout: 'split' | 'floating'   // the resolved presentation
  compact: boolean               // true when the floating layout is active
  chatOpen: boolean
  setChatOpen: (open: boolean) => void
  composing: boolean
  setComposing: (composing: boolean) => void
}
```

```tsx
function ChatToggle() {
  const { compact, chatOpen, setChatOpen } = useArtifactChatContainer()
  if (!compact) return null            // docked: the transcript is always visible
  return <Button onPress={() => setChatOpen(!chatOpen)}>{chatOpen ? 'Hide chat' : 'Show chat'}</Button>
}
```

The value is rebuilt each render and `chatOpen` follows the component's controllable-state rules (controlled by `chatOpen` and `onChatOpenChange`). The same composer and transcript elements move between the docked column and the floating sheet, so React state inside them survives a layout change; see [ArtifactChatContainer](https://blamy.github.io/ui/#/artifact-chat-container).

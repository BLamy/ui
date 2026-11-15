# State and platform hooks

Small utilities for state that survives a reload, the system back gesture, labelling controls inside list rows, and moving one DOM element between homes. The other hooks are in the [Hooks overview](https://blamy.github.io/ui/#/hooks).

`usePersistentState`, `useControllableChange`, `useKeptChildren`, `useCopy` and `usePaced` are public. `useRowLabel` is **registry-only**: it is not in `@brett_lamy/ui`. A component that uses it brings it along when you add the component, and you can add it by itself.

```tsx
// npm (the public hooks)
import { usePersistentState, useControllableChange } from '@brett_lamy/ui'
import { useKeptChildren } from '@brett_lamy/ui/lib/kept-children'
import { useCopy } from '@brett_lamy/ui/lib/use-copy'
import { usePaced } from '@brett_lamy/ui/lib/use-paced'

// shadcn registry (aliases)
import { usePersistentState, loadJSON, saveJSON } from '@/lib/persistent-state'   // …/r/persistent-state.json
import { useControllableChange } from '@/lib/controllable-state'             // …/r/controllable-state.json
import { useKeptChildren } from '@/lib/kept-children'                          // …/r/kept-children.json
import { useCopy } from '@/lib/use-copy'                                        // …/r/use-copy.json
import { usePaced } from '@/lib/use-paced'                                      // …/r/use-paced.json
import { useRowLabel } from '@/lib/row-label'                                    // …/r/row-label.json (registry-only)
```

## `usePersistentState`

`useState` backed by `localStorage` as JSON. A missing, unparseable or invalid stored value falls back to the initial one, and storage that throws (private mode, quota, disabled) is ignored: the state just does not persist.

- **Export:** public, with `loadJSON` and `saveJSON`. Registry item `persistent-state` (`@/lib/persistent-state`).
- **Needs:** nothing.

```ts
function usePersistentState<T>(
  key: string | null,
  initial: T | (() => T),
  isValid?: (value: unknown) => value is T,   // default: value !== undefined
): [T, Dispatch<SetStateAction<T>>]

function loadJSON(key: string): unknown   // undefined when missing, malformed, or storage is unavailable
function saveJSON(key: string, value: unknown): void   // storage that throws is ignored
```

| Parameter | Effect |
| --- | --- |
| `key` | The `localStorage` key. `null` turns persistence off and gives you a plain `useState`. |
| `initial` | The value, or a function returning it, used when nothing valid is stored. A function runs only then. |
| `isValid` | A type guard for a stored value. Anything it rejects is ignored, so a stale or hand-edited value cannot reach your state. The default accepts anything except `undefined` (`null` counts as valid). |

It returns the same pair as `useState`; the setter is React's, so it is stable and accepts an updater function.

```tsx
type Sort = 'name' | 'date'
const isSort = (v: unknown): v is Sort => v === 'name' || v === 'date'

function Inbox() {
  const [sort, setSort] = usePersistentState<Sort>('inbox:sort', 'date', isSort)
  const [collapsed, setCollapsed] = usePersistentState('inbox:collapsed', false)
  return <SortMenu value={sort} onValueChange={setSort} />
}
```

{% demo src="hooks-state/persistent-state" %}

Gotchas, from the source:

- **Written after the commit, not on mount.** The write is an effect keyed on `[key, state]`. It is skipped on the first run, so a visitor who never changes anything has nothing stored.
- **Changing `key` loads the new key.** The state becomes the new key's stored value (or `initial` when nothing valid is stored there), and the old key's value is left alone. Nothing is written until the state next changes.
- **Server render and hydration.** The stored value is read in the `useState` initializer. On the server there is no `localStorage`, so the server renders `initial`; the first client render reads the stored value, which can differ from the HTML. In an SSR framework, render values that come from storage after mount, or keep them out of server-rendered text.
- **Not synchronized across tabs.** There is no `storage` event listener; each tab reads once at mount.
- **JSON only.** Values go through `JSON.stringify` and `JSON.parse`: a `Date` comes back as a string, `undefined` and functions are lost. Use `isValid` to reject a shape you cannot restore.
- Storage errors are swallowed, so a full quota silently stops persisting.

## `useControllableChange`

State that is either controlled (a `value` is given) or held inside the hook, starting at `defaultValue`, with UI SDK-shaped change callbacks: `onChange(next, details)` gets the same `ChangeDetails` UI SDK's `createChange` hands out (`reason`, `event`, `source`, `cancel()`, `canceled`), before anything moves. It is the `value` / `defaultValue` / `onValueChange` pattern of `FloatingSheet`, `ArtifactChatContainer`, `FilterBar` and the Composer, for your own components.

- **Export:** public. Registry item `controllable-state` (`@/lib/controllable-state`).
- **Needs:** nothing.

```ts
function useControllableChange<T, Reason extends string>(
  value: T | undefined,
  defaultValue: T,
  onChange?: (next: T, details: ChangeDetails<Reason>) => void,
): [T, (next: T | ((prev: T) => T), given?: { reason: Reason; event?: Event; source?: ChangeSource }) => boolean]
```

```tsx
type DisclosureReason = 'trigger-press' | 'imperative'

function Disclosure({ open, defaultOpen = false, onOpenChange, children }: DisclosureProps) {
  const [shown, setShown] = useControllableChange<boolean, DisclosureReason>(open, defaultOpen, onOpenChange)
  return (
    <section data-open={shown || undefined}>
      <Button onClick={(event) => setShown(!shown, { reason: 'trigger-press', event: event.nativeEvent })}>Toggle</Button>
      {shown ? children : null}
    </section>
  )
}
```

The consumer hears every change first. Uncontrolled, the value moves unless it called `details.cancel()`; controlled, nothing is written here and the parent decides by what it passes back.

Gotchas, from the source:

- Only `undefined` means uncontrolled, so a controlled `null` (or `false`, or `0`) is a real value.
- The setter returns `false` when nothing was asked for (the same value, by `Object.is`) or the change was canceled; the same value never calls `onChange`.
- Without `given` the reason is `imperative`. `source` falls back to what the event says (UI SDK's `sourceOf`), and is `programmatic` with no event.
- An updater sees the latest value, even twice within one tick when uncontrolled. The setter keeps its identity while the hook stays controlled or uncontrolled.
- `defaultValue` is read once, on the first render.

## `useCopy`

Copies text, tells screen readers ("Copied"), and keeps `copied` set for a moment so a button can show a check. Every copy button in the kit uses it (CodeEditor, ObjectValue, ObjectTree, CallStack, LogList, the SQL console, the vault's recovery key).

- **Export:** public, with the `UseCopy` and `UseCopyOptions` types. Registry item `use-copy` (`@/lib/use-copy`).
- **Needs:** nothing.

```ts
function useCopy<K = true>(options?: { write?: (text: string) => void | Promise<void>; resetMs?: number; announcement?: string }): {
  copy: (text: string | Promise<string>, key?: K) => Promise<boolean>
  copied: K | true | null
}
```

```tsx
const { copy, copied } = useCopy<string>()
<Button onClick={() => copy(row.url, row.id)}>{copied === row.id ? 'Copied' : 'Copy link'}</Button>
```

- `copy(text)` without a key sets `copied` to `true`; with one, to that key, so one hook serves a list of buttons.
- `copied` resets after `resetMs` (1200 ms). `copy` resolves `false` when the clipboard refused (no permission, an insecure page).
- `write` replaces `navigator.clipboard` for a host with a clipboard of its own (an editor's webview, Electron). An empty `announcement` says nothing.

## `usePaced`

The latest value, taken at a pace React can keep up with: at once while things are quiet, and, while new values keep coming (a playhead dragged through thousands of frames), the newest every `paceMs` (16 ms), skipping the ones in between.

- **Export:** public. Registry item `use-paced` (`@/lib/use-paced`).
- **Needs:** nothing.

```ts
function usePaced<T>(value: T, paceMs?: number): T
```

```tsx
const frames = usePaced(framesProp) // a strip that redraws as fast as React can, not once per pointer move
```

- The wait starts after the last value has committed, so a slow render takes fewer values, never queues them. Without it, a new value every frame hits React's limit on nested updates.
- Values are compared with `Object.is`: pass a stable value (a memoized array) or it is a new value every render.

## Keyboard shortcuts

BL UI has no shortcut hook of its own: shortcuts are UI SDK's. `useShortcut` from `@ui-sdk/react/shortcuts` registers a shortcut while the component is mounted, in UI SDK's shared shortcut registry, so it takes part in the same layering as menus, dialogs and command palettes (a shortcut can belong to a popup with `layer`).

```ts
import { useShortcut, useShortcutHint } from '@ui-sdk/react/shortcuts'

function useShortcut(keys: string | null | undefined, handler: ShortcutHandler, options?: UseShortcutOptions): void
function useShortcutHint(keys: string): { text: string; ariaKeyshortcuts: string }   // '⌘K' on Apple platforms, 'Ctrl+K' elsewhere
```

```tsx
function Shell() {
  const [open, setOpen] = useState(false)
  useShortcut('mod+k', () => setOpen((o) => !o))
  useShortcut(open ? 'escape' : null, () => setOpen(false))   // `null` registers nothing
  return <Palette open={open} onOpenChange={setOpen} />
}
```

Keys are written like `mod+k` or `mod+shift+o`; `mod` is Command on Apple platforms and Ctrl elsewhere. The latest `handler` always runs, so it need not be stable. Components that take a shortcut use the same format: a menu item's `shortcut="mod+r"`, `Tooltip shortcut`, `DialogTrigger shortcut="mod+k"` (the ⌘K command menu's), `Kbd keys="mod+k"`. See [Behaviors](https://blamy.github.io/ui/#/behaviors) for the rest of UI SDK's behaviors you can use beside the kit.

## `useKeptChildren`

Children that survive a change of home. A region that moves between a column, a drawer and a pushed page (AdaptivePane, Sidebar), or a chat that moves between a docked column and a floating sheet (ArtifactChatContainer), renders its children once, through a portal, into a detached `display: contents` element, and the current home docks that element. The same React tree and the same DOM nodes, so a draft, the caret, selection, scroll and a streaming reply carry over. It is the kit's one way to keep children mounted across presentations.

- **Export:** public, with the `KeptChildren` type. Registry item `kept-children` (`@/lib/kept-children`).
- **Needs:** nothing.

```ts
function useKeptChildren(children: ReactNode, options?: { slot?: string }): {
  dock: (el: HTMLElement | null) => void   // a ref for the element the children show in now
  portal: ReactNode                        // render once, at a stable place under the component
  inline: ReactNode                        // render inside the dock: the children before hydration, else nothing
}
```

```tsx
function Player({ compact }: { compact: boolean }) {
  const kept = useKeptChildren(<VideoPlayer />)
  return (
    <>
      {kept.portal}
      {compact ? <div ref={kept.dock}>{kept.inline}</div> : <aside ref={kept.dock}>{kept.inline}</aside>}
    </>
  )
}
```

`slot` sets a `data-slot` on the detached element, as a styling hook.

Gotchas:

- **A dock only claims.** When a dock unmounts the children stay where they were, still mounted, until another dock claims them, so a presentation that is animating out never takes them back from the one arriving. They are removed when the component unmounts.
- **Before hydration** the children render in the dock (`inline`), so the server's markup matches; after it they move into the portal once.
- **Context comes from the portal's place**, not the dock's: the children see the providers of the component that calls the hook. That is why `useArtifactChatContainer()` works inside the container's Chat and Composer wherever they are docked, and why a hook of the layout they are docked in (`useFloatingSheet`) does not reach them.
- **A compound component** whose slot part owns the children and whose root owns the docks calls the hook in the part and hands `kept.dock` to the root through context (ArtifactChatContainer does this).

## The system back gesture

6.0 removed `useBackHistory` and `armBackHistory` (`@/lib/back-history`). The system back (an Android back, an iOS edge swipe that would leave the page) is the kit's `bindBack` from `@/lib/back` (a framework-free behavior, also exported from `@brett_lamy/ui`), which `NavigationStack` binds while it can pop:

```ts
import { bindBack } from '@/lib/back'

// bind only while there is somewhere to go back to; the cleanup disarms it
const unbind = bindBack(el, { onBack: () => stack.pop() })
```

The newest bound consumer hears a back first; return `false` from `onBack` to pass it on. On Android it uses a `CloseWatcher`, on other touch devices it holds one history entry of its own, and on a desktop it does nothing (Escape goes through UI SDK's layers instead). Details are on [The kit's behaviors](https://blamy.github.io/ui/#/behaviors-kit).

## `useRowLabel`

Registry-only. `aria-labelledby` for a control inside a list row: the control's own label wins, else the row's title. `ListRow` publishes its title's id, so a `Switch` or `Slider` anywhere in the row (even wrapped in your own component) is named by the row title. `Switch` and `Slider` call it for you.

- **Export:** not in `@brett_lamy/ui`. Registry item `row-label` (`@/lib/row-label`), installed with `switch`, `slider` and `list`.
- **Needs:** to be inside a `ListRow` for it to find a title. **Outside one:** returns the control's own `aria-labelledby`, else `undefined`.

```ts
function useRowLabel(props: { 'aria-label'?: string; 'aria-labelledby'?: string }): string | undefined
```

```tsx
function BrightnessControl(props: { 'aria-label'?: string; 'aria-labelledby'?: string }) {
  const labelledBy = useRowLabel(props)
  return <input type="range" aria-label={props['aria-label']} aria-labelledby={labelledBy} />
}

<ListRow title="Brightness" accessory={<BrightnessControl />} />   // named "Brightness"
```

A row only publishes its title when it has one: a row with `children` (the full-width layout that replaces the title) publishes nothing, so a control there needs its own label.

It returns `props['aria-labelledby']` when either of the two props is set. That means a control given an `aria-label` gets `undefined` back, so spread both: pass the result as `aria-labelledby` and keep passing `aria-label` yourself, as `Switch` does.

Note: it reads the context with React's `use(...)`, and `ListRow` provides it with `<RowLabelContext value={…}>`, both of which need **React 19**, which is the package's peer range.

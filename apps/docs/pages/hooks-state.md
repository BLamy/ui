# State and platform hooks

Small utilities for state that survives a reload, the system back gesture, labelling controls inside list rows, and moving one DOM element between homes. The other hooks are in the [Hooks overview](https://blamy.github.io/ui/#/hooks).

`usePersistentState` and `useControllableChange` are public. `usePersistentHost`, `useAttachHost` and `useRowLabel` are **registry-only**: they are not in `@brett_lamy/ui`. A component that uses one brings it along when you add the component, and you can add one by itself.

```tsx
// npm (the two public hooks)
import { usePersistentState, useControllableChange } from '@brett_lamy/ui'

// shadcn registry (aliases)
import { usePersistentState, loadJSON, saveJSON } from '@/lib/persistent-state'   // …/r/persistent-state.json
import { useControllableChange } from '@/lib/controllable-state'             // …/r/controllable-state.json
import { usePersistentHost, useAttachHost } from '@/lib/persistent-host'         // …/r/persistent-host.json (registry-only)
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

## `usePersistentHost`

Registry-only. A stable, detached element to portal into, so one piece of UI can move between homes without remounting. `ArtifactChatContainer` uses it to keep a composer and transcript (the draft, the caret, a streaming reply) alive while it moves them between a docked column and a floating sheet.

- **Export:** not in `@brett_lamy/ui`. Registry item `persistent-host` (`@/lib/persistent-host`), installed with `artifact-chat-container`.
- **Needs:** nothing.

```ts
function usePersistentHost(slot: string): HTMLElement | null
```

It creates one `<div data-slot={slot} style="display: contents">` the first time the component renders on the client and returns the same element for the life of the component. `display: contents` means the host adds no box. On the server (no `document`) it returns `null`, so guard the portal.

## `useAttachHost`

Registry-only. Moves a host element into a dock whenever the dock changes.

- **Export:** not in `@brett_lamy/ui`. Registry item `persistent-host`.
- **Needs:** nothing.

```ts
function useAttachHost(host: HTMLElement | null, dock: HTMLElement | null): void
```

Together:

```tsx
function Player({ compact }: { compact: boolean }) {
  const host = usePersistentHost('player')
  const [full, setFull] = useState<HTMLElement | null>(null)
  const [mini, setMini] = useState<HTMLElement | null>(null)
  useAttachHost(host, compact ? mini : full)
  return (
    <>
      {compact ? <div ref={setMini} /> : <aside ref={setFull} />}
      {host ? createPortal(<VideoPlayer />, host) : null}
    </>
  )
}
```

Docks are state set by a callback ref, so the hook re-runs when a dock mounts. The React tree of `VideoPlayer` is the portal's, so its state is unaffected by where the host lands.

Gotchas:

- **A `null` dock does not detach the host.** The host is appended only when both `host` and `dock` exist and the host is not already in the dock. If the dock goes away the host stays where it was, until it is moved or the component unmounts, which removes it.
- It runs in a layout effect, so the move happens before paint.
- A portal's React context is the context of where `createPortal` is called, not of the dock: components inside a persistent host see the providers of the component that owns it. That is why `useArtifactChatContainer()` works inside the container's Chat and Composer wherever they are docked, and why a hook of the layout they are docked in (`useFloatingSheet`) does not reach them.

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

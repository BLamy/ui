# State and platform hooks

Small utilities for state that survives a reload, keyboard shortcuts, the system back gesture, labelling controls inside list rows, and moving one DOM element between homes. The other hooks are in the [Hooks overview](https://blamy.github.io/ui/#/hooks).

`usePersistentState`, `useControllableState` and `useHotkey` are public. `usePersistentHost`, `useAttachHost`, `useBackHistory` and `useRowLabel` are **registry-only**: they are not in `@brett_lamy/ui`. A component that uses one brings it along when you add the component, and you can add one by itself.

```tsx
// npm (the two public hooks)
import { usePersistentState, useControllableState, useHotkey } from '@brett_lamy/ui'

// shadcn registry (aliases)
import { usePersistentState, loadJSON, saveJSON } from '@/lib/persistent-state'   // …/r/persistent-state.json
import { useControllableState } from '@/lib/controllable-state'              // …/r/controllable-state.json
import { useHotkey, matchesHotkey } from '@/components/ui/command-menu'          // …/r/command-menu.json
import { usePersistentHost, useAttachHost } from '@/lib/persistent-host'         // …/r/persistent-host.json (registry-only)
import { useBackHistory, armBackHistory } from '@/lib/back-history'              // …/r/back-history.json (registry-only)
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
  return <SortMenu value={sort} onChange={setSort} />
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

## `useControllableState`

State that is either controlled (a `value` is given) or held inside the hook, starting at `defaultValue`. It is the `value` / `defaultValue` / `onChange` pattern of `FloatingSheet`, `FloatingChat` and `ArtifactChatContainer`, for your own components.

- **Export:** public. Registry item `controllable-state` (`@/lib/controllable-state`).
- **Needs:** nothing.

```ts
function useControllableState<T>(
  value: T | undefined,
  defaultValue: T,
  onChange?: (next: T) => void,
): [T, (next: T) => void]
```

```tsx
function Disclosure({ open, defaultOpen = false, onOpenChange, children }: DisclosureProps) {
  const [isOpen, setOpen] = useControllableState(open, defaultOpen, onOpenChange)
  return <section data-open={isOpen}><Button onPress={() => setOpen(!isOpen)}>Toggle</Button>{isOpen ? children : null}</section>
}
```

The setter updates the internal copy only when `value` is `undefined` (uncontrolled), and always calls `onChange`, so a controlled parent decides what happens.

Gotchas, from the source:

- Only `undefined` means uncontrolled, so a controlled `null` (or `false`, or `0`) is a real value.
- The setter takes a value, not an updater function, and is a new function each render.
- `defaultValue` is read once, on the first render.

## `useHotkey`

Calls a handler when a key combination is pressed anywhere in the document. It is what `CommandMenu`'s `hotkey` prop is built on.

- **Export:** public, with `matchesHotkey(event, hotkey)`. Registry item `command-menu` (`@/components/ui/command-menu`).
- **Needs:** nothing.

```ts
function useHotkey(hotkey: string | undefined, handler: (e: KeyboardEvent) => void, enabled = true): void
function matchesHotkey(e: { key: string; code?: string; metaKey: boolean; ctrlKey: boolean; altKey: boolean; shiftKey: boolean }, hotkey: string): boolean
```

| Parameter | Effect |
| --- | --- |
| `hotkey` | `'mod+k'`, `'shift+mod+o'`, `'alt+shift+mod+t'`, `'alt+space'`. `mod` is Command on Apple platforms (it checks for Mac, iPhone or iPad) and Ctrl elsewhere; `meta`, `ctrl`, `alt` and `shift` also work. `undefined` turns it off. |
| `handler` | Called with the `KeyboardEvent`. It is read through a ref, so a new function each render is fine and nothing re-subscribes. |
| `enabled` | `false` removes the listener. Default `true`. |

Named keys are `space`, `enter` (`return`), `escape` (`esc`), `tab`, `backspace`, `delete`, `up`, `down`, `left`, `right`, `comma`, `period` and `slash`.

```tsx
function Shell() {
  const [open, setOpen] = useState(false)
  useHotkey('mod+k', () => setOpen((o) => !o))
  useHotkey('escape', () => setOpen(false), open)   // only listens while the palette is open
  return <Palette open={open} onOpenChange={setOpen} />
}
```

{% demo src="hooks-state/hotkey" %}

Gotchas:

- **It listens on `document`, in the bubble phase**, whatever has focus. A shortcut with no modifier (`'k'`) also fires while the user types in a text field. Use a modifier, or check `e.target` in the handler and ignore editable elements.
- **On a match it calls `preventDefault()` before your handler.** An event that something else already prevented (`defaultPrevented`) is skipped, so a nested handler that wants to claim the key can.
- **Modifiers must match exactly.** `'mod+k'` does not fire when Shift is also held. Each of meta, ctrl, alt and shift on the event has to equal what the string asks for.
- **Letters and digits match the physical key**, by `event.code` (`KeyK`, `Digit1`), so Option or Shift changing `event.key` on macOS does not break a shortcut, and the shortcut stays on the same physical key on other layouts. The key you press may not be the letter printed on the keycap on a non-QWERTY layout.
- No chords (`g` then `i`) and no way to name a literal `+` key.
- It subscribes in an effect, so nothing happens on the server.

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
- A portal's React context is the context of where `createPortal` is called, not of the dock: components inside a persistent host see the providers of the component that owns it. That is also why `useFloatingChat` does not work inside an `ArtifactChatContainer` slot (see [Layout hooks](https://blamy.github.io/ui/#/hooks-layout)).

## `useBackHistory`

Registry-only. A bridge for the system back gesture on touch devices. A system edge swipe would navigate the page itself away (a blank screen); while a stack can pop, one history sentinel stays armed, so the gesture lands as `popstate` and pops **your** stack instead. `NavigationStack` uses it.

- **Export:** not in `@brett_lamy/ui`. Registry item `back-history` (`@/lib/back-history`), installed with `navigation-stack`.
- **Needs:** nothing.

```ts
function useBackHistory(depth: number, pop: () => void): void
function armBackHistory(): void
```

`useBackHistory` registers a stack with the bridge for as long as it is mounted: `depth` is its screen count (it can pop above `1`), `pop` pops one screen. The latest values are read through a ref, so there is no need to memoize `pop`.

**The hook does not arm the sentinel.** Call `armBackHistory()` yourself when a push happens; `NavigationStack` does it right after one.

```tsx
function Stack({ screens, onPop }: { screens: Screen[]; onPop: () => void }) {
  useBackHistory(screens.length, onPop)
  const push = (screen: Screen) => {
    armBackHistory()   // pushes the history sentinel the system back gesture will land on
    setScreens((s) => [...s, screen])
  }
  // …
}
```

How it behaves, from the source:

- It does nothing on devices without a coarse pointer. That is decided **once, when the module loads** (`(any-pointer: coarse)`), and a failure to push history turns it off for the page.
- Arming pushes `history.pushState({ blNav: 1 }, '')`: no URL change, but one extra history entry. It arms once at a time.
- One `popstate` listener serves the page, even if the module is loaded twice. On `popstate` the deepest registered stack that can pop (`depth > 1`; the last registered wins) is popped, and 80ms later the bridge re-arms if any stack can still pop.
- Server-safe: the listener is only added where `window` exists.

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

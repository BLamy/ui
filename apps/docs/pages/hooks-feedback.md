# Feedback hooks

Hooks for showing feedback and reading the state of a command palette: `useToast` for the toast API of a queue, and `useCommandMenu` and `useCommandActive` for custom parts inside a `CommandMenu`. The keyboard-shortcut hook `useHotkey`, which `CommandMenu` is built on, is in [State and platform hooks](https://blamy.github.io/ui/#/hooks-state). The other hooks are in the [Hooks overview](https://blamy.github.io/ui/#/hooks).

All three are public.

```tsx
// npm
import { useToast, useCommandMenu, useCommandActive } from '@brett_lamy/ui'

// shadcn registry (aliases)
import { useToast } from '@/components/ui/toast'                                      // …/r/toast.json
import { useCommandMenu, useCommandActive } from '@/components/ui/command-menu'      // …/r/command-menu.json
```

## `useToast`

The toast API of the nearest `<Toaster>`'s queue. It is the same shape as the global `toast` function, bound to whichever queue the component sits under.

- **Export:** public, with `toast`, `Toaster`, `ToastProvider`, `createToastQueue` and `toastApi`. Registry item `toast`.
- **Needs:** a `<Toaster queue>` or `<ToastProvider queue>` ancestor to pick a queue. **Outside one:** returns the API of the page's default queue (the one `toast(…)` uses), it does not throw. A toast is only drawn where a `<Toaster>` renders its queue.

```ts
function useToast(): ToastApi

interface ToastApi {
  (title: string, options?: Omit<ToastData, 'title'> & ToastOptions): string
  hud: (title: string, options?: …) => string          // the dark pill; one at a time, updated in place
  success: (title: string, options?: …) => string      // tone: 'success'
  warning: (title: string, options?: …) => string
  error: (title: string, options?: …) => string        // tone: 'destructive'
  loading: (title: string, options?: …) => string      // a spinner, no timeout until updated
  update: (id: string, patch: Partial<ToastData>, options?: ToastOptions) => void
  dismiss: (id?: string) => void                       // one, or every toast when called with no id
  queue: ToastQueue
}
```

Every call that shows a toast returns its id. The options are listed on the [Toast](https://blamy.github.io/ui/#/toast) page; `timeout` and `onClose` are the two that live in `ToastOptions`.

```tsx
function SaveButton() {
  const toast = useToast()
  const save = async () => {
    const id = toast.loading('Saving…')
    try {
      await persist()
      toast.update(id, { title: 'Saved', tone: 'success' }, { timeout: 2500 })
    } catch {
      toast.update(id, { title: 'Couldn’t save', tone: 'destructive', action: { label: 'Retry', onAction: save } })
    }
  }
  return <Button onPress={save}>Save</Button>
}
```

{% demo src="hooks-feedback/toast-queue" %}

Gotchas, from the source:

- **The API object is stable** for as long as the nearest queue stays the same. It is created once per hook call and replaced only when the queue changes, so it is safe in dependency arrays and in effects.
- **`update` needs the toast to still be visible.** If the toast has closed (it timed out, or the user dismissed it) `update` does nothing and does not show a new one. To always show the result, `toast(…, { id })` with the same `id`: that updates a visible toast and shows a new one otherwise.
- **`update` keeps the toast's timeout.** It restarts the timer with the timeout the toast was shown with (a toast shown with `timeout: 0` stays until closed), or the variant's default for a `loading` toast (1600ms for a HUD, 5000ms for a banner), unless you pass `{ timeout }`. It sets `loading: false` unless the patch says otherwise.
- **A toast shown with the `id` of a visible one updates it** (content changes, timer restarts) instead of stacking. HUDs do this automatically: one pill at a time.
- `onClose` is taken from the toast when it was first shown; passing it to `update` does not replace it.
- The queue shows at most 4 toasts at once unless you create it with `createToastQueue({ maxVisibleToasts })`.

## `useCommandMenu`

The state and actions of the enclosing `CommandMenu`: the query, the page stack, and the actions that move, select and close. For custom rows, pages and footers.

- **Export:** public. Registry item `command-menu`.
- **Needs:** a `CommandMenu` ancestor. **Outside it:** throws `<useCommandMenu> must be used within <CommandMenu>`.

```ts
function useCommandMenu(): CommandMenuApi
```

| Member | Meaning |
| --- | --- |
| `query`, `setQuery(q)` | The current input text. |
| `page` | The current page id (`'root'` at the bottom of the stack). |
| `pages`, `depth` | Page ids from the root to the current page, and how many pages deep (`0` at the root). |
| `push(page)` | Pushes a page. The query clears, and comes back when the page pops. |
| `pop()` | Pops one page. Returns `false` at the root; safe to call repeatedly in one handler. |
| `popTo(page)` | Pops back to the nearest page with this id (`'root'` for the bottom). Returns `false` if it is not on the stack. |
| `reset()` | Back to the root with an empty query: a fresh menu, without remounting it. |
| `close()` | Closes the menu: the dialog's `onOpenChange(false)`, or the inline menu's `onOpenChange` or `onClose`. |
| `move(delta)` | Moves the active item by `delta` visible items, wrapping when `loop` is on. |
| `setActive(value)` | Makes the visible row with this `value` active and scrolls it into view, without selecting it. |
| `select(value?)` | Selects the active item, or the item with this `value`. |

```tsx
function PageBar() {
  const { page, depth, pop, close } = useCommandMenu()
  return (
    <div className="flex items-center justify-between px-3 py-2">
      <Button onPress={() => pop()} isDisabled={depth === 0}>Back</Button>
      <span>{page}</span>
      <Button onPress={close}>Close</Button>
    </div>
  )
}

<CommandMenu variant="dialog" hotkey="mod+k">
  <CommandInput />
  <CommandList>…</CommandList>
  <PageBar />
</CommandMenu>
```

Code outside the menu (a launcher button that should reset it when it reopens) cannot call the hook; pass `menuRef` to `CommandMenu`, which hands you the same `CommandMenuApi`.

The returned object is rebuilt on each render, and the menu's context value is a new object every time `CommandMenu` renders, so a component using the hook re-renders whenever the menu does (a keystroke, a page change). The active row is not part of it: read that with `useCommandActive`.

## `useCommandActive`

The `value` of the active item, or `null` when nothing is active, for preview panes that follow the highlighted row.

- **Export:** public. Registry item `command-menu`.
- **Needs:** a `CommandMenu` ancestor. **Outside it:** throws `<useCommandActive> must be used within <CommandMenu>`.

```ts
function useCommandActive(): string | null
```

```tsx
function Preview() {
  const active = useCommandActive()
  return <aside>{active ? <FilePreview path={active} /> : 'Move down to preview a file'}</aside>
}
```

It reads the active row from the menu's store (a store subscription, so it updates when the highlight moves) and also reads the menu context to find the store, so like `useCommandMenu` it re-renders whenever the menu does. The `value` is the item's `value` prop, not its label.

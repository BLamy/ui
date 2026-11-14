# Feedback hooks

Hooks for showing feedback and reading the state of a command palette: `useToast` for the nearest toast queue, and `useCommandMenu` and `useCommandMenuValue` for custom parts inside a `CommandMenu`. Keyboard shortcuts come from UI SDK (`useShortcut` from `@ui-sdk/react/shortcuts`); see [State and platform hooks](https://blamy.github.io/ui/#/hooks-state). The other hooks are in the [Hooks overview](https://blamy.github.io/ui/#/hooks).

All three are public.

```tsx
// npm
import { useToast, useCommandMenu, useCommandMenuValue } from '@brett_lamy/ui'

// shadcn registry (aliases)
import { useToast } from '@/components/ui/toast'                                         // …/r/toast.json
import { useCommandMenu, useCommandMenuValue } from '@/components/ui/command-menu'      // …/r/command-menu.json
```

## `useToast`

The queue of the nearest `<ToastProvider>`, or the page's `toast` outside one. A queue is UI SDK's toaster: a function you call to show a toast, with methods for the rest. `useToast()` returns the same kind of value as `toast` and `createToaster()`, so a component can send to whichever queue it sits under.

- **Export:** public, with `toast`, `createToaster`, `hud`, `createHud`, `ToastProvider` and `ToastRegion`. Registry item `toast`.
- **Needs:** a `<ToastProvider toaster={queue}>` ancestor to pick a queue. **Outside one:** returns the page's `toast`; it does not throw. A toast is only drawn where a `<ToastRegion>` shows its queue (`<ToastRegion toaster={queue} />`; without `toaster`, the page's queue).

```ts
function useToast(): Toaster

type Toaster = {
  (message: string | ToastOptions, options?: ToastOptions): string   // returns the toast's id
  success: (message, options?) => string     // type: 'success'
  error: (message, options?) => string       // type: 'error', announced assertively
  info: (message, options?) => string
  warning: (message, options?) => string
  loading: (message, options?) => string     // a spinner; stays until updated or dismissed
  promise: (promise, { loading, success?, error? }, options?) => string
  update: (id: string, options: string | ToastOptions) => boolean
  dismiss: (id?: string) => void             // one, or every toast with no id
  toasts: () => readonly Toast[]             // the queue, newest first
  subscribe: (listener: () => void) => () => void
}
```

The options (`title`, `description`, `type`, `duration`, `action`, `cancel`, `dismissible`, `data`, `onDismiss`, `id`, `priority`) are listed on the [Toast](https://blamy.github.io/ui/#/toast) page. An icon goes in `data`: `toast('Sent', { data: { icon: 'paperplane' } })`.

```tsx
function SaveButton() {
  const toast = useToast()
  const save = () =>
    toast.promise(persist(), {
      loading: 'Saving…',
      success: 'Saved',
      error: { title: 'Couldn’t save', action: { label: 'Retry', onAction: () => void save() } },
    })
  return <Button onClick={save}>Save</Button>
}
```

{% demo src="hooks-feedback/toast-queue" %}

Gotchas, from the source:

- **The queue is stable.** `useToast()` returns the provider's `toaster` (or the module-level `toast`), not a new object per render, so it is safe in dependency arrays and effects.
- **`update` needs the toast to still be in the queue.** It returns `false` and shows nothing once the toast has closed (timed out, swiped, dismissed). To always show the result, call the queue with the same `id`: `toast({ id, title: 'Saved', type: 'success' })` updates a toast that is still showing and adds a new one otherwise.
- **`update` merges.** Fields you leave out keep their values. Changing `type` resets `duration` to that type's default (a `loading` toast has none: it stays until updated), unless you pass `duration` too. Every update restarts the timer.
- **A sticky toast** takes `duration: Infinity`.
- **Keep an action's toast open** with `action: { label, onAction, dismiss: false }`. An `onAction` that returns a Promise marks the action pending and dismisses the toast once it resolves; a rejection keeps it.
- `onDismiss(details)` runs when it closes, with `details.reason` (`timeout`, `close-press`, `swipe`, `escape-key`, `action`, `imperative`); `details.cancel()` keeps it.
- **HUDs are a separate queue.** `hud('Copied')` sends to the page's HUD pill, shown by `<ToastRegion variant="hud" />`; `createHud()` makes one of your own. `useToast()` never returns a HUD.
- How many show at once is the region's `maxVisible` (5 banners, 1 HUD by default), not the queue's.

## `useCommandMenu`

The enclosing `CommandMenu`'s search text and page stack, and its controller. For custom rows, bars and footers.

- **Export:** public, with `createCommandMenuController`. Registry item `command-menu`.
- **Needs:** a `CommandMenu` ancestor. **Outside it:** throws `<useCommandMenu> must be used within <CommandMenu>`.

```ts
function useCommandMenu(): CommandMenuState

interface CommandMenuState {
  query: string                      // the search text
  pages: string[]                    // open pages, first to current; [] on the first page
  page: string | null                // the current page; null on the first page
  controller: CommandMenuController  // UI SDK's Command controller
}
```

| Controller member | Meaning |
| --- | --- |
| `getQuery()`, `setQuery(query)` | Read or set the search text. |
| `getPages()`, `setPages(pages)` | Read or replace the page stack (`setPages([])` goes back to the first page). |
| `push(page)`, `pop()` | Open a page, or go back one. Both return `false` when nothing changed or the change was canceled. |
| `getValue()`, `setValue(value)` | Read or move the highlight (the command's `value`; `null` for none). |
| `run(value?)` | Run a command as Enter would: the highlighted one, or the one with this `value`. |
| `focus()` | Move focus to the search field. |

Writes take an optional last argument, `{ reason?, event? }`, and report as `details.reason` (`imperative` by default) to the menu's change callbacks.

```tsx
function PageBar() {
  const { page, pages, controller } = useCommandMenu()
  return (
    <div className="flex items-center justify-between px-3 py-2">
      <Button onClick={() => controller.pop()} disabled={pages.length === 0}>Back</Button>
      <span>{page ?? 'Home'}</span>
      <Button onClick={() => { controller.setPages([]); controller.setQuery('') }}>Start over</Button>
    </div>
  )
}

<CommandMenu>
  <CommandMenuInput />
  <CommandMenuList>…</CommandMenuList>
  <PageBar />
</CommandMenu>
```

Code outside the menu (a launcher that resets it when it reopens) cannot call the hook: create the controller yourself and pass it in, `const [controller] = useState(createCommandMenuController)` and `<CommandMenu controller={controller}>`. Closing a dialog menu is the dialog's job: pass a `createDialogController()` to `CommandMenuDialog controller`, or control its `open`.

A component using the hook re-renders when the query or the page stack changes. The highlight is not part of it: read that with `useCommandMenuValue`.

## `useCommandMenuValue`

The `value` of the highlighted command, or `null` when nothing is highlighted, for preview panes that follow the highlight.

- **Export:** public. Registry item `command-menu`.
- **Needs:** a `CommandMenu` ancestor. **Outside it:** throws `<useCommandMenuValue> must be used within <CommandMenu>`.

```ts
function useCommandMenuValue(): string | null
```

```tsx
function Preview() {
  const value = useCommandMenuValue()
  return <aside>{value ? <FilePreview path={value} /> : 'Move down to preview a file'}</aside>
}
```

It subscribes to the highlight alone (a store subscription), so it re-renders when the highlight moves and not on every keystroke. The `value` is the command's `value` prop, not its label.

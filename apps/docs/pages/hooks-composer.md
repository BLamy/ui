# Composer hooks

Hooks for building parts that live inside a [Composer](https://blamy.github.io/ui/#/composer): reading the draft and sending it, reading a draggable bump's progress, and undo and redo for [PencilKit](https://blamy.github.io/ui/#/pencilkit) strokes. The image annotator's engine is chosen with props and a provider, not a hook (see [ImageAnnotator](https://blamy.github.io/ui/#/pencilkit)). The other hooks are in the [Hooks overview](https://blamy.github.io/ui/#/hooks).

All three are public, on the entries below and not on the package root: `@brett_lamy/ui/composer` is the Composer library, and `usePencilHistory` is also on the Canvas library's entry, `@brett_lamy/ui/canvas`.

```tsx
// npm
import { useComposer, useComposerBump } from '@brett_lamy/ui/composer'
import { usePencilHistory } from '@brett_lamy/ui/pencilkit'

// shadcn registry (aliases)
import { useComposer, useComposerBump } from '@/components/ui/composer'              // …/r/composer.json
import { usePencilHistory } from '@/components/ui/pencilkit'               // …/r/pencilkit.json
```

## `useComposer`

The state and actions of the nearest `Composer`: the Markdown draft, the attachments, whether it is expanded or streaming, and `send`. Custom parts (a send button, a status line, a toolbar action) read it instead of taking props.

- **Export:** public. Registry item `composer`.
- **Needs:** a `Composer` ancestor. **Outside it:** throws `useComposer must be used within <Composer>`.

```ts
function useComposer(): ComposerContextValue
```

| Member | Meaning |
| --- | --- |
| `value`, `setValue(markdown, given?)` | The draft as GitBook-flavored Markdown (attachment chips serialize as `![name](attachment:id)`). |
| `attachments`, `addAttachment(a, given?)`, `removeAttachment(id, given?)`, `updateAttachment(id, patch, given?)` | The attachments. `removeAttachment` also removes the chip in the editor. Each setter returns `false` when the change was canceled. |
| `attachFiles(files, { source?, point?, event? })` | Adds files after the `accept`, `maxSize` and `maxFiles` checks and the `onDropFiles` hook. Images chip into the editor (at `point` when it is over the editor, else at the caret); other files become tiles. |
| `accept` | The Composer's own `accept`, as a list. |
| `expanded`, `setExpanded(expanded, given?)` | Whether the editor is expanded. |
| `streaming` | The Composer's `streaming` prop. |
| `canSend` | Whether there is anything to send. |
| `send(event?)` | Sends the draft. Pass the click or key behind it, so the `send` changes' details carry it. |
| `stop()` | Calls the Composer's `onStop`. |
| `submit(markdown, attachments)`, `canQueue` | Hands a message to `onSubmit` without touching the draft (a queue feeding one in), and whether a `ComposerQueue` is mounted. |
| `annotate(id)`, `canAnnotate` | Opens the ImageAnnotator for an image attachment (a plain preview when the annotator is opted out), and whether an engine is in effect. |
| `disabled` | The Composer's `disabled`: a part of your own should not act while it is set. |
| `editor` | The editor instance, or `null` until it is ready. |
| `collapsed`, `setCollapsed(collapsed, given?)` | How far the Composer is collapsed: `'none'` (the full card), `'compact'` (one row, options in the bottom bump) or `'fab'` (a floating button). |

`given` is an optional `{ reason, event }` for the change's details (reason `imperative` when left out).

```tsx
function SendButton() {
  const { canSend, send, streaming, stop } = useComposer()
  return (
    <Button disabled={!streaming && !canSend} onClick={(event) => (streaming ? stop() : send(event.nativeEvent))}>
      {streaming ? 'Stop' : 'Send'}
    </Button>
  )
}

<Composer onSubmit={(markdown, attachments) => post(markdown, attachments)} streaming={busy} onStop={cancel}>
  <ComposerInput />
  <SendButton />
</Composer>
```

Behaviors to know:

- **`send()` does nothing** unless `canSend` is true, and while streaming unless a `ComposerQueue` is mounted (then the draft goes into the queue). It first empties the draft through `onValueChange` and `onAttachmentsChange` (reason `send`): if either cancels, or the queue's `onItemsChange` does, nothing is sent and the draft stays. Otherwise it passes the **trimmed** Markdown and the attachments to `onSubmit` and clears the editor. It reads the latest draft through a ref, so calling it from a stale closure is safe.
- The attachments you receive in `onSubmit` carry object URLs that stay valid until the Composer unmounts.
- The context value is rebuilt each render and its functions are not memoized, so do not use them in dependency arrays.

## `useComposerBump`

State of the enclosing `ComposerBump`: the strip attached above (`side="top"`) or below the card. With `draggable`, a top bump is a sheet whose handle pulls its content open one-to-one with the pointer.

- **Export:** public. Registry item `composer`.
- **Needs:** a `ComposerBump` ancestor (its `ComposerBumpHandle` and `ComposerBumpContent` are inside it). **Outside it:** throws `useComposerBump must be used within <ComposerBump>`.

```ts
function useComposerBump(): ComposerBumpContextValue
```

| Member | Meaning |
| --- | --- |
| `side` | `'top'` or `'bottom'`. |
| `draggable` | Whether the handle drags the content open. |
| `open`, `setOpen(open)` | Whether it is open. |
| `reveal` | The revealed body height, px: the finger's while dragging, else the height it rests at. |
| `progress` | 0 at rest (peek), 1 fully open. |
| `peek`, `maxReveal` | The resting and fully open body heights, px. |
| `dragging` | A finger is on the handle. |
| `settling` | The bump's own CSS transition is carrying the body to rest (after a release, a tap or Escape). |
| `contentId` | The id of the bump's content element. |

The drag itself belongs to `ComposerBumpHandle`: style it, or put your own content in it, rather than building a second handle.

```tsx
function BumpHint() {
  const { progress, dragging } = useComposerBump()
  return <span style={{ opacity: 1 - progress }}>{dragging ? 'Release to snap' : 'Drag to see more'}</span>
}
```

The gesture is UI SDK's `bindDrag` (with `createVelocityTracker` and `rubberBand`), so `reveal` and `progress` change every frame while dragging. On release they jump to the rest value and the body gets there with a CSS transition on the `tray` spring, while `settling` is `true`. Something that follows the bump should transition too while it settles, and only turn its transition off while `dragging`. Read it from a part inside the bump; the bump drives nothing outside itself.

## `usePencilHistory`

Undo, redo and clear for a `PencilCanvas`'s strokes. It keeps the strokes in state, with a snapshot of them before each change.

- **Export:** public. Registry item `pencilkit` (`@/components/ui/pencilkit`).
- **Needs:** nothing.

```ts
function usePencilHistory(initial: PencilStroke[] = []): PencilHistory

interface PencilHistory {
  strokes: PencilStroke[]
  onStrokesChange: (next: PencilStroke[], details: ChangeDetails<'draw' | 'erase'>) => void   // wire to PencilCanvas
  undo: () => void
  redo: () => void
  clear: () => void
  canUndo: boolean
  canRedo: boolean
  canClear: boolean
}
```

```tsx
function Sketch() {
  const history = usePencilHistory()
  return (
    <>
      <PencilCanvas strokes={history.strokes} onStrokesChange={history.onStrokesChange} />
      <Button disabled={!history.canUndo} onClick={history.undo}>Undo</Button>
      <Button disabled={!history.canRedo} onClick={history.redo}>Redo</Button>
      <Button disabled={!history.canClear} onClick={history.clear}>Clear</Button>
    </>
  )
}
```

Behaviors to know:

- `initial` is read once, on the first render.
- Every change is one step: a **draw**, an **erase** (`details.reason`), and a `clear`. Each clears the redo stack.
- `undo` restores the strokes as they were before the last step, so undoing an erase brings the erased strokes back. `redo` reapplies it. A clear can be undone.
- There is no limit on history length.
- `undo`, `redo`, `clear` and `onStrokesChange` are rebuilt each render; they update state from its latest value.

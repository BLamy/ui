# Composer hooks

Hooks for building parts that live inside a [Composer](https://blamy.github.io/ui/#/composer): reading the draft and sending it, reading a draggable bump's progress, choosing the image annotator, and undo and redo for [PencilKit](https://blamy.github.io/ui/#/pencilkit) strokes. The other hooks are in the [Hooks overview](https://blamy.github.io/ui/#/hooks).

All four are public.

```tsx
// npm
import { useComposer, useComposerBump, useComposerAnnotator, usePencilHistory } from '@brett_lamy/ui'

// shadcn registry (aliases)
import { useComposer, useComposerBump } from '@/components/ui/composer/composer'              // …/r/composer.json
import { useComposerAnnotator } from '@/components/ui/composer/annotator'                     // …/r/composer.json
import { usePencilHistory } from '@/components/ui/pencilkit/use-pencil-history'               // …/r/pencilkit.json
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
| `value`, `setValue(markdown)` | The draft as GitBook-flavored Markdown (attachment chips serialize as `![name](attachment:id)`). |
| `attachments`, `addAttachment(a)`, `removeAttachment(id)`, `updateAttachment(id, patch)` | The attachments. `removeAttachment` also removes the chip in the editor. |
| `attachFiles(files, { source?, point? })` | Adds files after the `acceptedFileTypes`, `maxFileSize` and `maxFiles` checks and the `onDropFiles` hook. Images chip into the editor (at `point` when it is over the editor, else at the caret); other files become tiles. |
| `acceptedFileTypes` | The Composer's own setting. |
| `expanded`, `setExpanded(expanded)` | Whether the editor is expanded. |
| `streaming` | The Composer's `streaming` prop. |
| `canSend` | Whether there is anything to send. |
| `send()` | Sends the draft. |
| `stop()` | Calls the Composer's `onStop`. |
| `annotate(id)`, `canAnnotate` | Opens the annotator for an attachment (a plain preview when the annotator is opted out), and whether an annotator is in effect. |
| `editor` | The editor instance, or `null` until it is ready. |
| `rootRef` | The Composer's root element; bumps measure against it. |
| `collapsed`, `setCollapsed(collapsed)` | How far the Composer is collapsed: `'none'` (the full card), `'compact'` (one row, options in the bottom bump) or `'fab'` (a floating button). |

`setEditor`, `renderCard`, `optionsOutlet`, `setOptionsOutlet` and `fab` are in the type but marked `@internal`: they are wiring between the Composer's own parts, not an API.

```tsx
function SendButton() {
  const { canSend, send, streaming, stop } = useComposer()
  return (
    <Button isDisabled={!streaming && !canSend} onPress={streaming ? stop : send}>
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

- **`send()` does nothing** unless `canSend` is true and the Composer is not streaming. When it sends, it passes the **trimmed** Markdown and the attachments to `onSubmit`, then clears the attachments and the editor. It reads the latest draft through a ref, so calling it from a stale closure is safe.
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
| `reveal` | The revealed body height, px, this frame. |
| `progress` | 0 at rest (peek), 1 fully open. |
| `peek`, `maxReveal` | The resting and fully open body heights, px (`maxReveal` is measured from `bounds` when given). |
| `dragging` | A finger is on the handle. |
| `contentId` | The id of the bump's content element. |

`handleProps`, `toggle` and `windowRef` are marked `@internal`.

```tsx
function BumpHint() {
  const { progress, dragging } = useComposerBump()
  return <span style={{ opacity: 1 - progress }}>{dragging ? 'Release to snap' : 'Drag to see more'}</span>
}
```

The gesture is [`useSheetDrag`](https://blamy.github.io/ui/#/hooks-motion), so `reveal` and `progress` change every frame while dragging or settling. To follow the motion from outside the bump, use its `onProgressChange` prop, which reports `{ progress, reveal, minimize, dragging, settling }`.

## `useComposerAnnotator`

The annotator in effect: the nearest `ComposerAnnotatorProvider`'s, else the default `PencilKitAnnotator`; `null` if a provider opted out (pressing an attachment then opens a plain preview). It is how the Composer and its lightbox choose what draws on an image.

- **Export:** public, with `ComposerAnnotatorProvider`. Registry item `composer`.
- **Needs:** nothing. **Outside a provider:** returns `PencilKitAnnotator`, so it never throws and is `null` only when something opted out.

```ts
function useComposerAnnotator(): ComposerAnnotator | null
type ComposerAnnotator = React.ComponentType<{ children: (surface: ComposerAnnotatorSurface) => React.ReactNode }>
```

An annotator is a component that hands the lightbox a drawing surface and optional tools through its render-prop child: `{ canvas, toolbar?, title? }`. Save flattens the surface's first `<svg>` into the image as one PNG.

```tsx
<ComposerAnnotatorProvider annotator={MyAnnotator}>
  <Composer>…</Composer>
</ComposerAnnotatorProvider>

<Composer annotator={null}>…</Composer>   // opt out for one composer

function PreviewWithAnnotator({ src }: { src: string }) {
  const Annotator = useComposerAnnotator()
  if (!Annotator) return <img src={src} alt="" />        // opted out: a plain preview
  return (
    <Annotator>
      {({ canvas, toolbar }) => (
        <div>
          <div className="relative"><img src={src} alt="" />{canvas}</div>
          {toolbar}
        </div>
      )}
    </Annotator>
  )
}
```

`Composer` also takes an `annotator` prop that overrides the provider for that one Composer; `useComposer().canAnnotate` already combines the prop, a provider and `annotateCanvas`, so prefer it when you only need to know whether to show an Annotate action.

## `usePencilHistory`

Undo, redo and clear for a `PencilCanvas`'s strokes. It keeps the strokes in state and a redo stack beside them.

- **Export:** public. Registry item `pencilkit` (`@/components/ui/pencilkit/use-pencil-history`).
- **Needs:** nothing.

```ts
function usePencilHistory(initial: PencilStroke[] = []): PencilHistory

interface PencilHistory {
  strokes: PencilStroke[]
  onStrokesChange: (next: PencilStroke[], source: 'draw' | 'erase') => void   // wire to PencilCanvas
  undo: () => void
  redo: () => void
  clear: () => void
  canUndo: boolean
  canRedo: boolean
}
```

```tsx
function Sketch() {
  const history = usePencilHistory()
  return (
    <>
      <PencilCanvas strokes={history.strokes} onStrokesChange={history.onStrokesChange} />
      <Button isDisabled={!history.canUndo} onPress={history.undo}>Undo</Button>
      <Button isDisabled={!history.canRedo} onPress={history.redo}>Redo</Button>
      <Button isDisabled={!history.canUndo} onPress={history.clear}>Clear</Button>
    </>
  )
}
```

Behaviors to know:

- `initial` is read once, on the first render.
- A **draw** (`source === 'draw'`) clears the redo stack; an **erase** replaces the strokes and leaves the redo stack as it was.
- `undo` moves the last stroke to the redo stack. `redo` moves it back. `clear` empties both, so a clear cannot be undone.
- There is no limit on history length.
- `undo`, `redo`, `clear` and `onStrokesChange` are rebuilt each render and close over the current state.

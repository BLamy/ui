# Clipboard

`useClipboard` handles copy, cut and paste for one focusable element, in any number of formats, and gives pasted data back in the same shape react-aria uses for drag and drop. It is listed with the other hooks in the [react-aria hooks overview](https://blamy.github.io/ui/#/aria-hooks).

Nothing to install: it comes from `react-aria`, which BL UI already depends on.

```tsx
import { useClipboard, isTextDropItem, isFileDropItem } from 'react-aria'
```

## Signature

```ts
function useClipboard(options: ClipboardProps): ClipboardResult

interface ClipboardProps {
  getItems?: (details: { action: 'cut' | 'copy' }) => DragItem[]
  onCopy?: () => void
  onCut?: () => void
  onPaste?: (items: DropItem[]) => void
  isDisabled?: boolean
}
interface ClipboardResult {
  clipboardProps: DOMAttributes   // spread on the focusable element
}
```

| Option | Effect |
| --- | --- |
| `getItems` | Returns what to put on the clipboard: an array of `DragItem`, each an object of `{ [type]: string }`. Required for copy and for cut. |
| `onCopy` | Called after the items were written for a copy. |
| `onCut` | Called after the items were written for a cut: remove the originals here. A cut needs both `onCut` and `getItems`. |
| `onPaste` | Called with the pasted `DropItem[]`. |
| `isDisabled` | Remove the listeners. |

A `DragItem` can carry several representations of one item: `{ 'text/plain': '…', 'text/html': '…', 'application/x-my-type': '…' }`. A `DropItem` is one of three kinds:

| Kind | Fields | Read with |
| --- | --- | --- |
| `text` | `types: Set<string>` | `await item.getText(type)` |
| `file` | `name`, `type` | `await item.getFile()` (a `File`), or `item.getText()` |
| `directory` | `name` | `item.getEntries()` (an async iterable) |

`isTextDropItem`, `isFileDropItem` and `isDirectoryDropItem` narrow the union.

## Copy and cut

{% demo src="aria-clipboard/copy-cut" %}

```tsx
const { clipboardProps } = useClipboard({
  getItems: ({ action }) => [{
    'text/plain': snippet.code,
    'text/html': `<pre><code>${escapeHtml(snippet.code)}</code></pre>`,
    'application/x-bl-snippet': JSON.stringify(snippet),
  }],
  onCopy: () => toast.hud('Copied', { tone: 'success' }),
  onCut: () => { remove(snippet); toast.hud('Cut') },
})

<div tabIndex={0} role="group" aria-label="Install snippet" {...clipboardProps}>…</div>
```

Verified in Chromium (real Mod+C, Mod+X and Mod+V key presses, with the clipboard read back through `navigator.clipboard`):

- **Mod+C** on a focused snippet puts `text/plain` and `text/html` on the system clipboard, with exactly the strings `getItems` returned. **Mod+X** does the same and then calls `onCut`, which removed the row.
- **Only the focused element answers.** With focus elsewhere, a Mod+C leaves the clipboard untouched, and each snippet copies its own content. From the source, the hook listens on the document, and counts the element as focused only when focus is **on the element itself** (it uses `useFocus`, which ignores events from children): so give the element `tabIndex={0}`, and do not expect it to answer while a button inside it has focus.
- **A multi-format item adds a JSON copy.** In the `copy` event's `DataTransfer` there are four types: `text/plain`, `text/html`, `application/x-bl-snippet` and `application/vnd.react-aria.items+json`. The last one is how the hook round-trips an item with several representations, or several items of one type, through a clipboard that takes one value per type. `text/plain`, `text/uri-list` and `text/html` are the native types: several items of the same native type are joined with newlines.
- **Custom types survive a paste in the browser, not the async API.** After the copy, `navigator.clipboard.read()` lists only `text/plain` and `text/html`, while a `paste` event on another page in the same browser sees all four types, and the hook hands them back as one text item (`text · text/plain, text/html, application/x-bl-snippet`). Do not count on a custom type reaching another application.
- **The hook calls `preventDefault()`** on the copy, cut and paste events it answers (from the source). So do not spread `clipboardProps` on an `<input>` or `<textarea>`: the field would lose its native copy and paste. Use a native `onPaste` there.

### A button is not a keyboard shortcut

`useClipboard` answers *clipboard events* (the Mod+C shortcut, the browser's Edit menu, the context menu). A **Copy button** has no event to answer, so it uses the async Clipboard API, as the example's buttons do:

```ts
await navigator.clipboard.write([
  new ClipboardItem({
    'text/plain': new Blob([code], { type: 'text/plain' }),
    'text/html': new Blob([html], { type: 'text/html' }),
  }),
])
```

Verified: the button writes the same two formats. The async API needs a **secure context** (HTTPS, or `localhost`) and is called from a user gesture, and reading with it asks for permission; those are properties of the browser API, not of react-aria, and the example's test grants the permission up front. In an insecure page `navigator.clipboard` is undefined, so guard the call and show a fallback, as the example does with a warning HUD.

### Feedback with Toast

Pair either route with a [Toast](https://blamy.github.io/ui/#/toast) HUD, which is built for this: `toast.hud('Copied', { tone: 'success' })`. Copying again while the pill is up updates it in place. The example gives itself a queue and an `inline` Toaster so the HUD stays inside the demo box (see [A Toaster of its own](https://blamy.github.io/ui/#/toast)); in an app, `useToast()` or `toast` is all you need.

## Paste

{% demo src="aria-clipboard/paste-inspector" %}

```tsx
const { clipboardProps } = useClipboard({
  onPaste: async (items) => {
    for (const item of items) {
      if (isTextDropItem(item)) console.log(await item.getText('text/plain'))
      else if (isFileDropItem(item)) upload(await item.getFile())
    }
  },
})
```

Verified in Chromium:

- **Text** pasted with the real Mod+V arrives as `text · text/plain` (a copy made with the async API as text and HTML arrives as `text · text/plain, text/html`). Text is **one item** listing every format it carries; read each with `getText(type)`. `getText` for a type the item does not have resolves to `undefined` (from the source), so check `item.types.has(…)` first.
- **A paste with the element not focused is ignored.**
- **Pasted images are the sharp edge.** Chromium reports a pasted image as a file item whose `webkitGetAsEntry()` is `null` (checked in the page: `{kind: 'file', type: 'image/png', entry: null}`), and react-aria skips such items, so `onPaste` is called with an **empty array**: the example's "The clipboard was empty" case. The file is still on the native event. The example sets it aside from an `onPaste` on the same element, which React runs before the document-level listener the hook uses, and appends it when the hook delivered no file; with that, a copied image arrives as `image.png`, `image/png`, with its bytes, and previews. Without it, an image paste in this browser does nothing. Pasting a *file* from a file manager was not tested.
- If an image paste has to work in an app, either read `e.clipboardData.files` yourself on the paste event, as above, or use `FileTrigger` and drag and drop as additional routes.

### The `ClipboardEvent` versus the hook

| | React `onPaste` / native `paste` | `useClipboard` |
| --- | --- | --- |
| Data | Raw `DataTransfer`; strings by type, files in `files` | `DropItem[]`: the same shape as drag and drop, with text and files read lazily |
| Who answers | Any element inside the one with the handler | Only the element that has focus itself |
| Copy and cut | You set `clipboardData` and `preventDefault` yourself | `getItems`, with several formats and a JSON copy for multi-format items |
| Default behavior | Yours to prevent | Prevented for you |
| Safari's Edit menu | Yours to enable | The hook also handles `beforecopy`, `beforecut` and `beforepaste` so those menu items are enabled while the element is focused (from the source) |

Use the hook when the same code should also take dropped data (it is the same `DropItem`), or when the target is a custom control that only reacts while focused. Use a plain `onPaste` for text fields and when you need every file.

## In BL UI

- **Composer.** The Composer's hidden attach target (`useComposerDrop` in `composer.tsx`) combines `useDrop` and `useClipboard`: `onPaste` hands its items to the same function that handles drops and the file picker. The editor has its own paste handler for text and images; the [Composer page](https://blamy.github.io/ui/#/composer) documents how files come in. Whether that hidden target receives pasted images in Chromium, given the sharp edge above, was not tested.
- **Toast** supplies the "Copied" HUD; the Toast page's own copy demo uses `navigator.clipboard.writeText` with the same pill.
- For a complete file picker, drop zone and paste target with validation, previews and uploads, use [FileUpload](https://blamy.github.io/ui/#/file-upload), which is built on `FileTrigger` and `DropZone` and handles the pasted-image case above.

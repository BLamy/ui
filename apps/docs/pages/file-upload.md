# FileUpload

Pick, drop or paste files and see what happens to them: a drop zone, a list with a thumbnail, progress, retry and remove for every file, validation that says *why* a file was turned away, and an upload queue behind it. It is built on UI SDK's [FileInput](https://ui-sdk.dev/docs/react/components/file-input): its trigger opens the system chooser, its drop zone takes drops (folders included) and pastes, its checks run on every file, and its list has one Tab stop. `useFileUpload` keeps the rows and sends them. There is no server in the box: you give it an `upload(file)` function, or `xhrUpload(url)` for the common case.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/file-upload.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import {
  FileUpload, FileDropZone, FileList,
} from '@/components/ui/file-upload'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { FileUpload, FileDropZone, FileList } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## Usage

Three levels, from least to most:

- **`FileUploadButton`** when all you need is "choose a file": FileInput's trigger with the [Button](https://blamy.github.io/ui/#/button) look. Give it `onFiles` and it gets a FileInput of its own; you receive plain `File`s and do what you like with them.
- **`FileDropZone`** when people should be able to drag files in too. Same `onFiles`, plus the drag-over, disabled and error states, an accepted-types hint and paste.
- **`FileUpload`** when you want the whole thing: it owns a `useFileUpload`, runs the rules and the queue, and renders the zone and the list. Pass children to arrange it yourself.

```tsx
import { FileUpload, xhrUpload } from '@brett_lamy/ui'

<FileUpload
  accept={['image/*', '.pdf']}
  maxSize={10_000_000}
  maxFiles={5}
  upload={xhrUpload('/api/upload')}
/>
```

{% demo src="file-upload/basic" %}

In that demo, drop or choose a few files. A file with "fail" in its name loses its connection once, so you can see the error row and press **Retry**.

The default children are a `FileDropZone` and a `FileList`. Compose your own order, add a `FileUploadButton`, or use a function child to read the state:

```tsx
<FileUpload accept={['image/*']} upload={send}>
  <FileDropZone title="Drop photos here" icon="photo" />
  <FileUploadButton variant="ghost">Or browse</FileUploadButton>
  <FileList />
</FileUpload>

<FileUpload upload={send}>
  {(up) => <p>{up.counts.done} of {up.files.length} uploaded</p>}
</FileUpload>
```

## Validation

Every file is checked by FileInput, in this order: **type** (`accept`), **size** (`maxSize`, `minSize`), your own **`validate`**, then **duplicates** (same path, size and modified time, against the list and the rest of the batch; `allowDuplicates` turns it off), and finally the **count** (`maxFiles`). A file that fails is listed under *Not added* with its reason and a Dismiss button; it is never uploaded and does not count toward `maxFiles`.

```tsx
<FileUpload
  accept={['image/*', '.pdf']}          // MIME types, wildcards and extensions, as in <input accept>
  maxSize={2_000_000}
  maxFiles={3}
  validate={(file) => (/\s/.test(file.name) ? 'Rename it without spaces first.' : undefined)}
  messages={{ duplicate: 'You already added this file.', 'file-too-large': ({ maxSize }) => `Max ${maxSize} bytes` }}
/>
```

`validate(file)` is FileInput's: return a reason to reject (it is the row's text unless `messages` has one for it), or nothing to accept. `messages` replaces the text for a reason (FileInput's `file-type`, `file-too-large`, `file-too-small`, `too-many-files`, plus `duplicate` and any reason your `validate` returns) with a string or a function of the file and the rules.

{% demo src="file-upload/validation" %}

`rejectionMessage(reason, context, messages)` gives the same text for your own UI, and UI SDK's `formatFileSize(n)` the sizes (decimal units in the reader's locale: "1.5 kB", "5 MB").

> **The browser's `accept` is a hint, and these rules are a convenience.** `<input accept>` only filters the chooser (and is ignored by drag and drop and paste), and anything checked in the browser can be bypassed. Validate type, size and content again on the server. Never trust `file.type`: it comes from the file's extension, not its bytes.

## Uploading

`upload(file, { signal, onProgress })` returns a promise; resolve with `{ url }` (optional) or reject with an `Error` whose message becomes the row's failure text.

```tsx
async function upload(file: File, { signal, onProgress }: UploadContext) {
  // …send it, calling onProgress(0..1) as bytes go out…
  return { url }
}
```

Uploads run through a queue: `concurrency` at a time (default 3), in list order. The `signal` is aborted when the row is removed or the component unmounts, so honor it. `autoUpload={false}` keeps files queued until you call `uploadAll()`. **Retry** (and `retry(id)`) always sends the file, even with `autoUpload` off.

### `xhrUpload`

`fetch` cannot report upload progress; `XMLHttpRequest` can. `xhrUpload(url, options)` makes an `upload` function on it:

```tsx
import { xhrUpload } from '@brett_lamy/ui'

const upload = xhrUpload('/api/upload', {
  fieldName: 'file',                       // multipart field (default "file")
  extraFields: { folder: 'avatars' },      // or (file) => ({ … })
  headers: { Authorization: `Bearer ${token}` },
  withCredentials: true,
})

// A presigned PUT: the file itself is the body.
const toS3 = xhrUpload((file) => presigned[file.name], { method: 'PUT', body: 'raw' })
```

It rejects with a readable error for a non-2xx status, a network error or a timeout, and with an `AbortError` when the signal fires. The result is read from a JSON `{ url }` (or `{ location }`) response, else the `Location` header; pass `parseResponse(xhr)` for anything else. To ask your server for a presigned URL first, write your own `upload` and call `xhrUpload(presignedUrl, { method: 'PUT', body: 'raw' })(file, context)` inside it.

## Controlled mode

The list is uncontrolled by default (`defaultValue` seeds it). Pass `value` and `onValueChange` to keep it in your state (to persist it, show it elsewhere, or validate on submit), and pass a `useFileUpload` of your own as `state` when something outside the component needs the counts. To only start, retry or clear uploads from outside, a `controller` is enough:

```tsx
const [files, setFiles] = useState<UploadFile[]>([])
const up = useFileUpload({ value: files, onValueChange: setFiles, upload, autoUpload: false })

<FileUpload state={up} />
<Button disabled={!up.counts.queued} onClick={up.uploadAll}>Submit</Button>

// Or, without the hook:
const uploads = createFileUploadController()
<FileUpload controller={uploads} upload={upload} autoUpload={false} />
<Button onClick={() => uploads.uploadAll()}>Submit</Button>
```

Every change to the list comes with `details`: `reason` (FileInput's own `picker`, `drop`, `paste`, `remove-press`, `reset` or `imperative` for files that arrive or leave through it; `reject` when the checks turn files away; `retry`, `clear`; and an upload's own steps, `upload-start`, `progress` and `settle`), `source` (`'agent'` for an agent's files), `id` (the row a one-row change is about), the `added` and `removed` rows, and `cancel()`. Canceling keeps the list as it was: nothing is listed, removed, aborted or sent. A controlled list can also refuse by not passing the change back: the list stays yours, and the refused files are not resent with the next change, offered to agents, or counted as duplicates.

```tsx
<FileUpload
  upload={upload}
  onValueChange={(files, details) => {
    // Refuse files an agent adds while the form is locked.
    if (locked && details.source === 'agent') details.cancel()
  }}
/>
```

{% demo src="file-upload/controlled" %}

## Images with previews

Image files get a thumbnail made from an object URL, created when the row mounts and revoked when it unmounts, so removing a file frees its preview. Files that were rejected are not decoded. Other kinds get an icon (document, video, audio, archive). `FileThumbnail` and `useFilePreview(file)` are exported for your own rows.

{% demo src="file-upload/images" %}

## Paste

The zone takes files and images pasted from the clipboard (⌘V / Ctrl+V) while focus is inside it: copy a screenshot, focus **Browse files**, paste. Text pastes are left alone. `pasteTarget` on `FileDropZone` takes pastes from somewhere else too: `"document"`, an element, a CSS selector or a function returning one (a message box, say).

{% demo src="file-upload/paste" %}

## Folders

A dropped folder is always read. `directory` makes the button choose a folder too (and turns on `multiple`). The folder is **flattened**: every file inside, however deep, joins the list with its path inside the folder (`photos/2024/a.jpg`, UI SDK's `relativePath(file)`), shown under the file's name. System files (`.DS_Store`, `Thumbs.db`, `desktop.ini`) are skipped, and at most 1000 files are read from one drop.

Dropped folders are read through the browser's entry API (`webkitGetAsEntry`); the chooser's folder mode is `webkitdirectory`. Both work in current Chrome, Edge, Safari and Firefox on desktop. Mobile browsers mostly can't pick folders at all.

{% demo src="file-upload/folder" %}

## Mobile camera

`capture="environment"` (rear) or `"user"` (front) sets the input's `capture` attribute, and phones open the camera instead of the chooser. It does nothing on desktop. Since it replaces the chooser, give it its own button next to the zone, as in the images demo: a `FileUploadButton` with `capture`, `accept={['image/*']}` and `onFiles={(files) => up.add(files)}` has a FileInput of its own and hands the photos to the upload's list, where they are checked like the rest.

## Server rendering and Next.js

Everything here is a client module (`'use client'`) and is safe to import from a server component's tree. Nothing touches `window`, `File` or `URL` at module scope; previews appear after mount, so the server renders the icon and the browser swaps in the thumbnail. The hidden input is FileInput's; with `name` it submits the files with a native form, even before hydration. The upload itself runs only in the browser: your route handler receives an ordinary multipart request.

## Accessibility

- **Browse files** is FileInput's trigger, a real button in the Tab order; `Enter` or `Space` opens the chooser. It is described by the zone's hint and error. The drop zone itself is not a control, so keep a trigger in it.
- The listed files are FileInput's list: one Tab stop, arrow keys, `Home` and `End` move between files, `Delete` or `Backspace` removes the focused one and focus moves to its neighbor. Each Remove button is named for its file ("Remove a.png", "Cancel upload of a.png") and stays out of the Tab order. Retry is a button in the row ("Retry a.png").
- Files that were turned away follow in their own list, "Not added", each a labelled group with its reason and a "Dismiss name" button; dismissing one returns focus to Browse files.
- FileInput announces what changed in a polite live region: files added, rejected (with the reason for a single file) and removed. Uploads that finish or fail are announced too, batched into one sentence; progress ticks never are.
- The progress bar is a real `progressbar` named "Uploading name".
- Color is never the only signal: errors and rejections carry an icon and the words "Upload failed" or "Not added"; a finished file has a check and "Uploaded".
- Transitions are disabled under `prefers-reduced-motion`.

## API

### `<FileUpload>`

UI SDK's `FileInput` root, fed by a `useFileUpload`. Takes every option of `useFileUpload` below, plus:

| Prop | Default | Effect |
| --- | --- | --- |
| `state` | — | A `useFileUpload` result from your own code; the list props are then ignored. |
| `controller` | — | From `createFileUploadController()`: `add`, `remove`, `retry`, `clear`, `uploadAll` and `files()` from anywhere. |
| `multiple` | unless `maxFiles` is 1 | Whether the chooser takes several files. Without it a new file replaces the one listed. |
| `directory` | `false` | The chooser picks whole folders. |
| `capture` | — | `user`, `environment` or `true`: open the camera on phones. |
| `disabled` | `false` | Disables choosing, dropping and pasting (`data-disabled`). |
| `name`, `form`, `required` | — | Submit the files with a form. |
| `children` | zone + list | Nodes, or `(api) => node` with the context. |
| `className`, `style` | — | Merged onto the root (`data-slot="file-upload"`, `data-busy` while anything is queued or sending): one element that is both FileInput's root and the `fileUpload` primitive's. |

### `<FileDropZone>`

UI SDK's `FileInputDropzone` with a title, a hint, an icon and a Browse button (`FileInputTrigger`). Inside a `FileUpload` it reads its rules and its files join the list; with `onFiles` it has a FileInput of its own. Also takes the drop zone's `target` (`"document"` takes drops anywhere on the page) and `pasteTarget`.

| Prop | Default | Effect |
| --- | --- | --- |
| `onFiles(files, details)` | — | Plain `File`s that passed the checks; `details.reason` is `picker`, `drop` or `paste`. |
| `onReject(rejected)` | — | With `onFiles`: `{ file, reasons }` for each file turned away. |
| `rules` | context's rules | `{ accept, maxSize, minSize, maxFiles }`: the hint, and with `onFiles` the checks. |
| `hint` | built from `rules` | The line under the title ("Images · up to 5 MB each"). |
| `title`, `icon`, `browseLabel` | "Drag files here", `arrow-up`, "Browse files" | Copy and glyph. |
| `size` | `default` | `compact` lays it out in a row. |
| `multiple`, `directory`, `capture`, `disabled` | — | With `onFiles`, as on `FileUpload`. |
| `invalid`, `error` | — | Red outline and the message, with an icon. |
| `children` | the default layout | Nodes or `(state) => node` with `dragging`, `dragAccept`, `dragReject`, `disabled`. |

Styled by the drop zone's data attributes: `data-dragging`, `data-drag-accept`, `data-drag-reject`, `data-disabled`, plus `data-invalid`.

### `<FileUploadButton>`

FileInput's trigger with the `Button` look (`variant`, `size`). Inside a `FileUpload` it opens that upload's chooser; with `onFiles` (and `onReject`, `accept`, `multiple`, `directory`, `capture`, `disabled`) it has a FileInput of its own.

### `<FileList>` and `<FileItem>`

`FileList` renders the context's files (or `files`) as `FileItem`s, and nothing while empty; `children={(item) => <FileItem item={item} … />}` renders your own row. Inside a `FileUpload`, listed files are `FileInputItem`s (`data-slot="file-input-item"`) of FileInput's list, and rejected files follow in a list of their own (`data-slot="file-list-rejected"`) as groups (`data-slot="file-item"`). `FileItem` takes an `item` and optional `onRemove` / `onRetry` (defaults come from the context); its children replace the row's contents. `FileThumbnail` is the leading tile. Rows carry `data-status` and `data-file-id`.

### `useFileUpload(options)` and the `fileUpload` primitive

The list and its queue are a UI SDK primitive, `fileUpload` (`lib/file-upload-primitive`), built with `definePrimitive`: `value` is its controlled key, every write goes through `createChange` with one of the reasons above, and destroying it aborts every request in flight. `useFileUpload` renders it in React. It is on the page for agents through its root (FileInput's element): its rows are its items, named by path, and an agent can `remove`, `retry` (both take a row's id or path), `clear` and `uploadAll`, each reported with `source: 'agent'`.

| Option | Default | Effect |
| --- | --- | --- |
| `upload` | — | `(file, { signal, onProgress, id, path }) => Promise<{ url? } \| void>`. Without it files are validated and listed only. |
| `autoUpload` | `true` | Send as files are added; `false` waits for `uploadAll()`. |
| `concurrency` | `3` | Uploads at once. |
| `accept`, `maxSize`, `minSize`, `maxFiles` | — | FileInput's checks. |
| `allowDuplicates` | `false` | Allow the same file twice. |
| `validate`, `messages` | — | Your own check (`(file) => reason \| undefined`); a reason's text. |
| `value`, `defaultValue`, `onValueChange(files, details)` | — | Controlled / initial list. `details` has `reason`, `source`, `event`, `id`, `added`, `removed` and `cancel()` (see Controlled mode). |
| `onAdd(added, rejected, details?)`, `onRemove`, `onUploaded`, `onUploadError` | — | Events. |
| `controller` | — | A `createFileUploadController()` handle. |

It returns `{ files, add, remove, retry, clear, uploadAll, busy, counts, rules, inputController, inputProps }`. A file is `{ id, file, path, status, progress, error?, reason?, url? }` with `status` `queued`, `uploading`, `done`, `error` or `rejected`.

- `inputProps` goes on UI SDK's `FileInput` root (`<FileInput {...up.inputProps}>`), which `FileUpload` does for you. Its `render` makes FileInput's element the primitive's root, which is what puts the list on the page (for agents) and lets it abort its requests when it leaves. `inputController` is FileInput's controller (`open()`, `focus()`).
- `add(files)` takes `File`s or a `FileList`, runs them through the same FileInput's checks and returns `{ added, rejected }`. It works while that FileInput is mounted.
- `remove(id, { reason, event }?)` aborts an upload in flight (reason `imperative` unless given). `clear()` aborts everything (reason `clear`).
- `retry(id)` re-queues a failed file (reason `retry`). `remove`, `retry` and `clear` return whether they changed anything; `remove` and `retry` take a row's id or its path.

### Helpers

`describeAccept(accept)`, `describeRules(rules)`, `fileKind(file)`, `rejectionMessage(reason, context, messages)`, `useFilePreview(file)`. UI SDK's `relativePath(file)` and `formatFileSize(n)` come from `@ui-sdk/react/file-input`.

## Limits

- Not a transport: there is no server and no storage. You write (or point `xhrUpload` at) the endpoint.
- **Large and resumable uploads are out of scope.** Each file goes in a single request; there is no chunking, no resume after a reload and no background upload. For files that are gigabytes, use a protocol built for it (tus, S3 multipart) behind your own `upload`.
- Uploading state is in memory: reload the page and the queue is gone.
- Only the browser's own limits on file size and memory apply; the file is not read into memory by this code (previews are object URLs).
- A drop of folders needs the browser's entry API, and pasted files come from the clipboard as the browser provides them (screenshots arrive as PNGs named `image.png`).
- In `files`, a batch lists what it queued, then what it turned away (the `FileList` shows them apart anyway).

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `fileDropZoneVariants`

Defined in `@/components/ui/file-upload`. Base classes:

```text
group/zone relative box-border flex border-2 border-dashed border-border text-center outline-none transition-[border-color,background-color,box-shadow,opacity] duration-spring-snappy motion-reduce:transition-none data-dragging:border-primary data-dragging:bg-primary/10 data-invalid:border-destructive data-disabled:opacity-40
```

**`size`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `min-h-40 flex-col items-center justify-center gap-2 rounded-card p-6` |
| `compact` | `flex-row items-center justify-start gap-3 rounded-panel p-3 text-left` |

### `fileItemVariants`

Defined in `@/components/ui/file-upload`. Base classes:

```text
box-border flex items-center gap-3 rounded-panel border border-border bg-card p-3 text-card-foreground outline-none transition-colors duration-spring-snappy motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-ring data-[status=error]:border-destructive data-[status=rejected]:border-destructive
```

No variants.

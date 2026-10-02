# FileUpload

Pick, drop or paste files and see what happens to them: a drop zone, a list with a thumbnail, progress, retry and remove for every file, validation that says *why* a file was turned away, and an upload queue behind it. It is built on react-aria's `FileTrigger` (the hidden `<input type="file">`) and `DropZone` (drag and drop with a labelled button that keyboard and screen-reader users can reach), and driven by `useFileUpload`. There is no server in the box: you give it an `upload(file)` function, or `xhrUpload(url)` for the common case.

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

- **`FileUploadButton`** when all you need is "choose a file": a [Button](https://blamy.github.io/ui/#/button) inside a `FileTrigger`. You get the files in `onFiles` and do what you like with them.
- **`FileDropZone`** when people should be able to drag files in too. Same `onFiles`, plus the drag-over, focus, disabled and error states, an accepted-types hint and paste.
- **`FileUpload`** when you want the whole thing: it owns a `useFileUpload`, runs the rules and the queue, and renders the zone and the list. Pass children to arrange it yourself.

```tsx
import { FileUpload, xhrUpload } from '@brett_lamy/ui'

<FileUpload
  accept={['image/*', '.pdf']}
  maxSize={10 * 1024 * 1024}
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
  <FileUploadButton variant="ghost" defaultCamera="environment">Take a photo</FileUploadButton>
  <FileList />
</FileUpload>

<FileUpload upload={send}>
  {(up) => <p>{up.counts.done} of {up.files.length} uploaded</p>}
</FileUpload>
```

## Validation

Every file you add is checked, in this order: **type** (`accept`), **size** (`maxSize`, `minSize`), **duplicates** (same path, size and modified time; `allowDuplicates` turns it off), your own **`validate`**, and finally the **count** (`maxFiles`). A file that fails stays in the list as a *Not added* row with its reason and a Dismiss button; it is never uploaded and does not count toward `maxFiles`.

```tsx
<FileUpload
  accept={['image/*', '.pdf']}          // MIME types, wildcards and extensions, as in <input accept>
  maxSize={2 * 1024 * 1024}
  maxFiles={3}
  validate={(file) => (/\s/.test(file.name) ? 'Rename it without spaces first.' : undefined)}
  messages={{ duplicate: 'You already added this file.', 'too-large': ({ maxSize }) => `Max ${maxSize} bytes` }}
/>
```

`validate` returns a message to reject, `false` to reject with a generic one, or nothing to accept. `messages` replaces the text for a rule (`type`, `too-large`, `too-small`, `too-many`, `duplicate`, `invalid`) with a string or a function of the file and the rules.

{% demo src="file-upload/validation" %}

The same checks are available without React: `validateFiles(entries, existing, rules)`, `matchesAccept(file, accept)` and `formatBytes(n)`.

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

The list is uncontrolled by default. Pass `files` and `onFilesChange` to keep it in your state (to persist it, show it elsewhere, or validate on submit), and pass a `useFileUpload` of your own as `state` when something outside the component needs `uploadAll()` or the counts:

```tsx
const [files, setFiles] = useState<UploadFile[]>([])
const up = useFileUpload({ files, onFilesChange: setFiles, upload, autoUpload: false })

<FileUpload state={up} />
<Button isDisabled={!up.counts.queued} onPress={up.uploadAll}>Submit</Button>
```

{% demo src="file-upload/controlled" %}

## Images with previews

Image files get a thumbnail made from an object URL, created when the row mounts and revoked when it unmounts, so removing a file frees its preview. Files that were rejected are not decoded. Other kinds get an icon (document, video, audio, archive). `FileThumbnail` and `useFilePreview(file)` are exported for your own rows.

{% demo src="file-upload/images" %}

## Paste

`pasteable` takes files and images from the clipboard (⌘V / Ctrl+V) while the zone, or the button inside it, has focus: copy a screenshot, focus **Browse files**, paste. It is off by default, and it does not listen to the whole page. Clicking an empty part of the zone focuses it.

{% demo src="file-upload/paste" %}

## Folders

`acceptDirectory` lets people drop a folder or choose one with the button. The folder is **flattened**: every file inside, however deep, joins the list with its path relative to the folder (`photos/2024/a.jpg`), shown under the file's name. Dotfiles inside a folder (`.DS_Store`, `.git`) are skipped; a single file dropped on its own is always kept; at most 1000 files are read from one drop. Without `acceptDirectory`, a dropped folder is not read and the zone says so.

Dropped folders are read through the browser's entry API (react-aria's `isDirectoryDropItem` and `getEntries()`); the chooser's folder mode is `webkitdirectory`. Both work in current Chrome, Edge, Safari and Firefox on desktop. Mobile browsers mostly can't pick folders at all.

{% demo src="file-upload/folder" %}

`readDropItems(items)` and `entriesFromFileList(list)` do the flattening for your own drop targets.

## Mobile camera

`defaultCamera="environment"` (rear) or `"user"` (front) sets the `capture` attribute, and phones open the camera instead of the chooser. It does nothing on desktop. Since it replaces the chooser, give it its own button next to the zone, as in the images demo, and pair it with `accept={['image/*']}`.

## Server rendering and Next.js

Everything here is a client module (`'use client'`) and is safe to import from a server component's tree. Nothing touches `window`, `File` or `URL` at module scope; previews appear after mount, so the server renders the icon and the browser swaps in the thumbnail. The hidden input is rendered by react-aria and carries no state, so there is nothing to hydrate differently. The upload itself runs only in the browser: your route handler receives an ordinary multipart request.

## Accessibility

- The drop zone is react-aria's `DropZone`. It has a visually hidden, labelled button that starts keyboard drag and drop and takes pastes, plus our visible **Browse files** button; both are in the tab order and `Enter` or `Space` on the visible one opens the chooser.
- A polite live region announces what changed: files added, rejected (with the reason for a single file), removed, failed and uploaded. Changes that arrive together become one sentence, and progress ticks are never announced.
- Each file is a labelled group (`role="group"`, named by the file) inside a labelled list. The progress bar is a real `progressbar` named "Uploading name"; the buttons say what they act on ("Remove a.png", "Retry a.png", "Cancel upload of a.png", "Dismiss a.png").
- After a row is removed, focus moves to the next row's remove button, else the previous row's, else the zone's Browse button, so keyboard users are not dropped on the page.
- Color is never the only signal: errors and rejections carry an icon and the words "Upload failed" or "Not added"; a finished file has a check and "Uploaded".
- Transitions are disabled under `prefers-reduced-motion`.

## API

### `<FileUpload>`

Takes every option of `useFileUpload` below, plus:

| Prop | Default | Effect |
| --- | --- | --- |
| `state` | — | A `useFileUpload` result from your own code; the rule props are then ignored. |
| `multiple` | unless `maxFiles` is 1 | Whether the chooser takes several files. |
| `acceptDirectory` | `false` | Choose and read whole folders. |
| `defaultCamera` | — | `user` or `environment`: open the camera on phones. |
| `pasteable` | `false` | Take files pasted while the zone's buttons have focus. |
| `disabled` | `false` | Disables the zone and the button. |
| `children` | zone + list | Nodes, or `(api) => node` with the context. |
| `className`, `style` | — | Merged onto the root (`data-slot="file-upload"`). |

### `<FileDropZone>`

Inside a `FileUpload` it reads its rules and adds files to its list; alone, give it `onFiles`. Also takes react-aria's [DropZone props](https://react-aria.adobe.com/DropZone) (`getDropOperation`, `onDropEnter`, `aria-label`…).

| Prop | Default | Effect |
| --- | --- | --- |
| `onFiles(entries, info)` | context's `addFiles` | `entries` are `{ file, path }`; `info.source` is `drop`, `browse` or `paste`. |
| `rules` | context's rules | `{ accept, maxSize, minSize, maxFiles }`: the chooser's filter and the hint. |
| `hint` | built from `rules` | The line under the title ("Images · up to 5 MB each"). |
| `title`, `icon`, `browseLabel` | "Drag files here", `arrow-up`, "Browse files" | Copy and glyph. |
| `size` | `default` | `compact` lays it out in a row. |
| `multiple`, `acceptDirectory`, `defaultCamera`, `pasteable` | from the context | As on `FileUpload`. |
| `isInvalid`, `error` | — | Red outline and the message, with an icon. |
| `isDisabled` | from the context | Disabled state (`data-disabled`). |
| `children` | the default layout | Nodes or `(state) => node` with `isDropTarget`, `isFocusVisible`… |

Styled by react-aria's data attributes: `data-drop-target`, `data-focus-visible`, `data-hovered`, `data-disabled`, plus `data-invalid`.

### `<FileUploadButton>`

A `Button` (all its props) in a `FileTrigger`, with `onFiles`, `accept`, `multiple`, `acceptDirectory` and `defaultCamera`.

### `<FileList>` and `<FileItem>`

`FileList` renders the context's files (or `files`) as a list of `FileItem`s, and nothing while empty; `children={(item) => …}` renders your own row. `FileItem` takes an `item` and optional `onRemove` / `onRetry` (defaults come from the context); its children replace the row's contents. `FileThumbnail` is the leading tile. Rows carry `data-slot="file-item"`, `data-status` and `data-file-id`.

### `useFileUpload(options)`

| Option | Default | Effect |
| --- | --- | --- |
| `upload` | — | `(file, { signal, onProgress, id, path }) => Promise<{ url? } \| void>`. Without it files are validated and listed only. |
| `autoUpload` | `true` | Send as files are added; `false` waits for `uploadAll()`. |
| `concurrency` | `3` | Uploads at once. |
| `accept`, `maxSize`, `minSize`, `maxFiles` | — | The rules. |
| `allowDuplicates` | `false` | Allow the same file twice. |
| `validate`, `messages` | — | Your own rule; override a rule's text. |
| `files`, `defaultFiles`, `onFilesChange` | — | Controlled / initial list. |
| `onAdd`, `onRemove`, `onUploaded`, `onUploadError` | — | Events. |

It returns `{ files, add, remove, retry, clear, uploadAll, isBusy, counts, rules }`. A file is `{ id, file, path, status, progress, error?, reason?, url? }` with `status` `queued`, `uploading`, `done`, `error` or `rejected`.

- `add(files)` takes `File`s, a `FileList` or `{ file, path }` entries and returns `{ added, rejected }`.
- `remove(id)` aborts an upload in flight. `clear()` aborts everything.
- `retry(id)` re-queues a failed file.

### Helpers

`formatBytes(n)`, `matchesAccept(file, accept)`, `describeAccept(accept)`, `describeRules(rules)`, `fileKind(file)`, `validateFiles(entries, existing, rules)`, `readDropItems(items)`, `entriesFromFileList(list)`, `useFilePreview(file)`.

## Limits

- Not a transport: there is no server and no storage. You write (or point `xhrUpload` at) the endpoint.
- **Large and resumable uploads are out of scope.** Each file goes in a single request; there is no chunking, no resume after a reload and no background upload. For files that are gigabytes, use a protocol built for it (tus, S3 multipart) behind your own `upload`.
- Uploading state is in memory: reload the page and the queue is gone.
- Only the browser's own limits on file size and memory apply; the file is not read into memory by this code (previews are object URLs).
- A drop of folders needs the browser's entry API, and pasted files come from the clipboard as the browser provides them (screenshots arrive as PNGs named `image.png`).

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `fileDropZoneVariants`

Defined in `@/components/ui/file-upload`. Base classes:

```text
group/zone relative box-border flex border-2 border-dashed border-border text-center outline-none transition-[border-color,background-color,box-shadow,opacity] duration-spring-snappy motion-reduce:transition-none data-drop-target:border-primary data-drop-target:bg-primary/10 data-focus-visible:ring-2 data-focus-visible:ring-ring data-focus-visible:ring-offset-2 data-invalid:border-destructive data-disabled:opacity-40
```

**`size`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `min-h-40 flex-col items-center justify-center gap-2 rounded-card p-6` |
| `compact` | `flex-row items-center justify-start gap-3 rounded-panel p-3 text-left` |

### `fileItemVariants`

Defined in `@/components/ui/file-upload`. Base classes:

```text
box-border flex items-center gap-3 rounded-panel border border-border bg-card p-3 text-card-foreground transition-colors duration-spring-snappy motion-reduce:transition-none data-[status=error]:border-destructive data-[status=rejected]:border-destructive
```

No variants.

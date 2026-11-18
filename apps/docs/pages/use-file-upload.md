# useFileUpload

The logic behind [FileUpload](https://blamy.github.io/ui/#/file-upload), without its styling: the rows of a file list (queued, uploading, done, failed, and the files UI SDK's [FileInput](https://ui-sdk.dev/docs/react/components/file-input) turned away, with the reason in words), a concurrency-limited upload queue with abort, retry and controlled mode (the `fileUpload` primitive, so agents can reach it too), an `XMLHttpRequest` adapter that reports real progress, and helpers (`describeRules`, `rejectionMessage`; sizes read through the kit's `formatFileSize`, `@/lib/file-size`). Choosing, dropping, pasting and the checks are FileInput's: spread `inputProps` on its root and the hook does the rest. Use it to build your own drop target, rows or form; the options, the returned API and the helpers are documented under [FileUpload](https://blamy.github.io/ui/#/file-upload).

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/use-file-upload.json{% endcommand %}

Copies the source into your project's `lib/` (with the parts it is built from), adds BL UI's tokens to your CSS and installs `@brett_lamy/ui` for UI SDK, which the copied files import by the package's name (`@brett_lamy/ui/sdk/…`). The copied source is yours to edit. Import from your alias:

```tsx
import { useFileUpload } from '@/lib/use-file-upload'
import { xhrUpload } from '@/lib/file-upload-model'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from their module:

```tsx
import '@brett_lamy/ui/styles.css'

import { useFileUpload } from '@brett_lamy/ui/lib/use-file-upload'
import { xhrUpload } from '@brett_lamy/ui/lib/file-upload-model'
```
{% endtab %}
{% endtabs %}

## Usage

```tsx
import { FileInput, FileInputDropzone, FileInputTrigger } from '@brett_lamy/ui/sdk/react/file-input'

const up = useFileUpload({
  accept: ['image/*'],
  maxSize: 5_000_000,
  upload: xhrUpload('/api/upload'),
})

<FileInput {...up.inputProps} className="grid gap-2">
  <FileInputDropzone>
    Drop photos here <FileInputTrigger>Add photos</FileInputTrigger>
  </FileInputDropzone>
</FileInput>
{up.files.map((f) => (
  <FileUploadItem key={f.id} item={f} onRemove={(x) => up.remove(x.id)} onRetry={(x) => up.retry(x.id)} />
))}
```

`inputProps` includes a `render` that makes the FileInput's element the list's root, so the list is on the page for agents and aborts its uploads when it leaves. `up.add(files)` runs files from anywhere (a camera button, a paste handler of your own) through the same FileInput while it is mounted. Apart from that FileInput, `useFilePreview` (object URLs) and `xhrUpload` (`XMLHttpRequest`), it needs no DOM, and its helpers run anywhere. See the [API](https://blamy.github.io/ui/#/file-upload) and the [limits](https://blamy.github.io/ui/#/file-upload): the browser's `accept` is a hint, and everything must be validated again on the server.

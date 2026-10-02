# useFileUpload

The logic behind [FileUpload](https://blamy.github.io/ui/#/file-upload), without any UI: a list of files with validation (type, size, count, duplicates, your own rule), a concurrency-limited upload queue with abort, retry and controlled mode, an `XMLHttpRequest` adapter that reports real progress, and the pure helpers (`formatBytes`, `matchesAccept`, folder flattening). Use it to build your own drop target, rows or form; the options, the returned API and the helpers are documented under [FileUpload](https://blamy.github.io/ui/#/file-upload).

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/use-file-upload.json{% endcommand %}

Copies the source into your project's `lib/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { useFileUpload, xhrUpload } from '@/lib/file-upload'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { useFileUpload, xhrUpload } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## Usage

```tsx
const up = useFileUpload({
  accept: ['image/*'],
  maxSize: 5 * 1024 * 1024,
  upload: xhrUpload('/api/upload'),
})

<FileUploadButton onFiles={(entries) => up.add(entries)}>Add photos</FileUploadButton>
{up.files.map((f) => (
  <FileItem key={f.id} item={f} onRemove={(x) => up.remove(x.id)} onRetry={(x) => up.retry(x.id)} />
))}
```

It has no DOM dependency apart from `useFilePreview` (object URLs) and `xhrUpload` (`XMLHttpRequest`), and its pure helpers run anywhere. See the [API](https://blamy.github.io/ui/#/file-upload) and the [limits](https://blamy.github.io/ui/#/file-upload): the browser's `accept` is a hint, and everything must be validated again on the server.

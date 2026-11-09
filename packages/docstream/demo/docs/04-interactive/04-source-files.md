---
description: Render a real component or Storybook CSF story straight from a file in your repo with source-ref, keeping its provenance — and edit it in place during development.
---

# Source files

`{% source-ref %}` renders an **export of a real source file**: a React component, or a Storybook CSF story with its `args`. The Markdown holds only a pointer — mount, path, export, kind — never the implementation. During development the file is read and imported live from disk; a production build bundles the same modules as read-only previews.

These previews are not implemented in this page. They come from `demo/src/examples/Button.tsx` and `Button.stories.tsx`, mounted under the name `demo`.

## A component export

{% source-ref mount="demo" path="Button.tsx" export="Button" kind="component" title="Button component" %}

```md
{% source-ref mount="demo" path="Button.tsx" export="Button" kind="component" title="Button component" %}
```

## Storybook stories

A `kind="story"` reference loads a CSF file: the story's `render`, else the default export's `render`, else its `component` — with the default export's `args` merged under the story's own.

{% source-ref mount="demo" path="Button.stories.tsx" export="Primary" kind="story" title="Primary story" %}

The `Default` story has no `args` of its own, so the meta's `args` (`label: "Storybook file on disk"`) apply:

{% source-ref mount="demo" path="Button.stories.tsx" export="Default" kind="story" title="Default story — meta args" %}

`Toolbar` brings its own `render`, which receives the merged args as props:

{% source-ref mount="demo" path="Button.stories.tsx" export="Toolbar" kind="story" title="Toolbar story — custom render" %}

```tsx title="examples/Button.stories.tsx"
import { Button } from "./Button"

export default {
  component: Button,
  args: { label: "Storybook file on disk" },
}

export const Primary = {
  args: { label: "Primary story export" },
}

export const Default = {}

export const Toolbar = {
  args: { label: "Save" },
  render: ({ label }) => (
    <div style={{ display: "flex", gap: 8 }}>
      <Button label={label} />
      <Button label="Cancel" />
    </div>
  ),
}
```

## Attributes

| Attribute | Default | Meaning |
| --- | --- | --- |
| `mount` | `source` | The source mount's name, configured in the host (see below). |
| `path` | — | File path inside the mount (`src` is accepted as an alias). |
| `export` | `default` (component) / `Primary` (story) | The export to render. |
| `kind` | `component` | `component` or `story`. |
| `title` | `<path>#<export>` | Header label. The header also shows `mount:path` as provenance. |

Two shorter aliases parse to the same node:

```md
{% component mount="demo" src="Button.tsx" export="Button" %}
{% story mount="demo" src="Button.stories.tsx" export="Toolbar" %}
```

{% source-ref mount="demo" path="Button.stories.tsx" kind="story" title="No export attribute — defaults to Primary" %}

The tag takes no body, so no end tag is needed (a directly following `{% endsource-ref %}` is tolerated).

## Wiring it up

A source reference renders through the `sourceRenderer` you pass to a renderer — usually `SourcePreview` with a **source client**. Without a `sourceRenderer`, the block shows as a small file chip.

{% stepper %}
{% step %}
### Mount real directories in Vite

```ts title="vite.config.ts"
import { docstreamSources } from "@brett_lamy/docstream/vite"

export default defineConfig({
  plugins: [react(), docstreamSources({ mounts: [{ name: "demo", root: "src/examples" }] })],
})
```

Each mount has a unique `name`, a `root` (relative to the Vite root), `writable` (default `true`: allow PUT edits) and `reloadOnWrite` (default `true`). The dev server answers `/@docstream/source` (read / write the file) and `/@docstream/module` (import it), refusing paths that escape the mount. `apiBase` changes the `/@docstream` prefix.
{% endstep %}
{% step %}
### Pick a client per environment

```tsx title="main.tsx"
import { SourcePreview, createBundledSourceClient, createViteSourceClient, type SourceReferenceRenderer } from "@brett_lamy/docstream"
import * as ButtonModule from "./examples/Button"
import * as ButtonStoriesModule from "./examples/Button.stories"

const bundled = createBundledSourceClient({
  "Button.tsx": ButtonModule,                 // keys: "<path>" or "<mount>:<path>"
  "Button.stories.tsx": ButtonStoriesModule,  // values: a module, or () => import("…")
})
const client = import.meta.env.DEV ? createViteSourceClient() : bundled

const sourceRenderer: SourceReferenceRenderer = (reference) => <SourcePreview reference={reference} client={client} />
```
{% endstep %}
{% step %}
### Render

```tsx
<MarkdownContent markdown={page} sourceRenderer={sourceRenderer} />
```
{% endstep %}
{% endstepper %}

This is exactly how this site renders the previews above.

## Source clients

A client is three methods; write your own to load from anywhere:

```ts title="types.ts"
interface SourceReferenceClient {
  read(reference: SourceRefNode): Promise<SourceFileSnapshot>           // { content, provenance }
  write(reference: SourceRefNode, content: string): Promise<SourceFileSnapshot>
  importModule(reference: SourceRefNode): Promise<SourceModule>         // the module's exports
}
```

| Client | `read` | `write` | `importModule` |
| --- | --- | --- | --- |
| `createViteSourceClient(apiBase = "/@docstream")` | the file on disk | writes the file; Vite reloads | a fresh import of the module (cache-busted) |
| `createBundledSourceClient(modules)` | throws: no source text in a bundle | throws: read-only | the bundled module (eager or lazy) |

`provenance` carries `mount`, `path`, `exportName`, `kind`, and in dev the file's `absolutePath` and `mtimeMs`. An editor's source-file editing saves through the same `write`, writing the real file and letting Vite reload the preview.

### SourcePreview

| Prop | Type | Purpose |
| --- | --- | --- |
| `reference` | `SourceRefNode` | The parsed `source-ref` block. |
| `client` | `SourceReferenceClient` | Where to import it from. |
| `fallback` | `ReactNode` | Shown while importing (default "Loading source…"). |
| `onError` | `(error: Error) => void` | A missing export or failed import; the message also renders in place. |
| `className` | `string` | Appended to `docs-source-preview`. |

## Source refs or demos?

{% columns %}
{% column %}
**`{% source-ref %}`** — showcase components and stories that already exist in your codebase, unchanged, with their provenance. No demo folder, no variants, no Code view.
{% endcolumn %}
{% column %}
**`{% demo %}`** — a purpose-built example with variants, viewports, a multi-file Code view, fullscreen and copy-with-files. See [Folder demos](01-demos.md).
{% endcolumn %}
{% endcolumns %}

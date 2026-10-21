---
description: A source-ref block points at a component or story in your code. Give the editor a sourceClient and the block edits that file, saves it, and re-renders its export.
---

# Source files

`{% source-ref %}` shows a real export from your code base (a React component, or a Storybook story) in the page. In the editor the block's header edits the reference itself: mount, path, export, kind. With a `sourceClient`, the block also opens **the file it points at**: a code pane that writes back to disk, and a live preview of the export underneath. The Markdown doesn't change when you edit the file, because the document only stores where the code is.

{% demo src="files-source/virtual-client" %}

The client in this demo keeps three files in memory and runs them as plain JavaScript. With docstream's Vite plugin, the same blocks edit the files in your repo.

## The block

```md
{% source-ref mount="app" path="src/Badge.js" export="default" kind="component" title="Badge" %}

{% source-ref mount="ui" path="Button.stories.tsx" export="Primary" kind="story" title="Primary button" %}
```

| Attribute | Default | Meaning |
| --- | --- | --- |
| `mount` | `source` | Which of the host's source roots the path is in. |
| `path` | none | The file, relative to the mount. |
| `export` | `default` | The export to render. For a story, the story's export name. |
| `kind` | `component` | `component` renders the export with no props. `story` renders a CSF story: its `render`, or the meta's `render` or `component`, with the meta's `args` merged under the story's. |
| `title` | none | The preview's header. The editor keeps it but has no field for it. |

The slash menu has no source-ref item: write or paste the tag (pasted Markdown becomes blocks). In edit mode the header shows inputs for `mount`, `path` and `export`, and a `component` / `story` switch. A read-only editor shows the title, or `path#export`.

## sourceClient

```tsx title="DocsEditor.tsx"
import { createViteSourceClient } from "@brett_lamy/docstream/source"
import { GitbookEditor } from "@brett_lamy/docstream-editor"

const sourceClient = createViteSourceClient() // talks to docstreamSources() in vite.config

<GitbookEditor
  markdown={markdown}
  onChange={setMarkdown}
  sourceClient={sourceClient}
  onSourceSaved={(snapshot) => toast(`Saved ${snapshot.provenance.path}`)}
  onSourceError={(error) => console.error(error)}
/>
```

A `SourceReferenceClient` has three methods. Each one gets the parsed reference (`{ mount, path, exportName, kind, title }`):

```ts
interface SourceReferenceClient {
  read(reference: SourceRefNode): Promise<SourceFileSnapshot>
  write(reference: SourceRefNode, content: string): Promise<SourceFileSnapshot>
  importModule(reference: SourceRefNode): Promise<SourceModule>
}

interface SourceFileSnapshot {
  content: string
  provenance: { mount: string; path: string; exportName: string; kind: "component" | "story"; absolutePath?: string; mtimeMs?: number }
}
```

- `read` loads the file into the block's code pane when the block mounts, and again when the reference changes.
- `write` saves it. The block shows **Saving…** and then **Saved**, or the error.
- `importModule` loads the module to preview. It runs on mount and again after every save, so the preview always shows the file as saved.

docstream ships two clients. `createViteSourceClient(apiBase?)` talks to the dev-server endpoints that `docstreamSources()` from `@brett_lamy/docstream/vite` installs, and imports modules through Vite, so TypeScript, JSX and HMR all work. `createBundledSourceClient(modules)` previews modules compiled into a production bundle, and refuses `read` and `write`. Without a `sourceClient` the block is just its header, and the reference round-trips untouched. Setting up the plugin is covered in docstream's [Source files](https://blamy.github.io/ui/#/docstream/interactive/source-files) page.

### Writing your own client

Anything with those three methods works: a backend API, a GitHub contents client, a WebContainer, or a `Map` as in the demo. The demo's `memory-client.ts`, shortened:

```ts title="memory-client.ts"
export function createMemorySourceClient(seed: Record<string, string>): SourceReferenceClient {
  const files = new Map(Object.entries(seed))
  const snapshot = (ref: SourceRefNode, content: string) => ({
    content,
    provenance: { mount: ref.mount, path: ref.path, exportName: ref.exportName, kind: ref.kind },
  })
  return {
    async read(ref) {
      const content = files.get(ref.path)
      if (content === undefined) throw new Error(`${ref.mount}:${ref.path} does not exist`)
      return snapshot(ref, content)
    },
    async write(ref, content) {
      files.set(ref.path, content)
      return snapshot(ref, content)
    },
    async importModule(ref) {
      return evaluate(files.get(ref.path)!) // { default, …named exports }
    },
  }
}
```

{% hint style="info" %}
The demo's `evaluate` only understands plain JavaScript with simple `import` and `export` lines (components call `h()`, which is `React.createElement`). That keeps it to a few lines. A real client compiles the file first: through Vite, esbuild-wasm, or a server.
{% endhint %}

## Saving and previews

| Prop | Type | Default | Purpose |
| --- | --- | --- | --- |
| `sourceClient` | `SourceReferenceClient` | none | Turns source-ref blocks into file editors. |
| `sourcePreview` | `boolean` | `true` | Show the rendered export below the code pane. |
| `sourceAutoSave` | `boolean \| number` | `true` | Save after a pause in typing: `true` is 500 ms, a number sets the delay, `false` saves only on **Save file**. |
| `onSourceSaved` | `(snapshot: SourceFileSnapshot) => void` | none | After each successful write, with what the client returned. |
| `onSourceError` | `(error: Error) => void` | none | A read or write failed. |

With auto-save on, the header reads **Unsaved**, **Saving…** or **Saved**, and the button becomes **Save now**. A read-only editor (`editable={false}`) never auto-saves.

The third block in the demo points at a file that doesn't exist: `read` rejects, the block shows the message, and `onSourceError` fires. The preview reports its own failure (the import fails too) inside the preview frame.

{% hint style="info" %}
The file editor reads a file when the reference names a different file (mount, path, export or kind) or the `sourceClient` changes. Re-rendering your component — with inline callbacks or a fresh but equal reference object — never re-reads it, so unsaved edits are safe.
{% endhint %}

## SourceFileEditor

The file editor inside the block is exported. Use it to edit a referenced file anywhere, without a document around it:

{% demo src="files-source/standalone" %}

```tsx title="StoryEditor.tsx"
import { createViteSourceClient } from "@brett_lamy/docstream/source"
import type { SourceRefNode } from "@brett_lamy/docstream/gitbook"
import { SourceFileEditor } from "@brett_lamy/docstream-editor"

const client = createViteSourceClient()
const reference: SourceRefNode = {
  type: "source-ref",
  mount: "ui",
  path: "Button.stories.tsx",
  exportName: "Primary",
  kind: "story",
}

export function StoryEditor() {
  return <SourceFileEditor reference={reference} client={client} autoSave={1000} />
}
```

| Prop | Type | Default | Purpose |
| --- | --- | --- | --- |
| `reference` | `SourceRefNode` | required | The file and export. |
| `client` | `SourceReferenceClient` | required | Reads, writes and imports. |
| `preview` | `boolean` | `true` | Show the export below the code pane (docstream's `SourcePreview`). |
| `autoSave` | `boolean \| number` | `false` | As `sourceAutoSave`. Note the default: off here, on in the editor. |
| `onSaved` | `(snapshot) => void` | none | After a write. |
| `onError` | `(error: Error) => void` | none | A read or write failed. |
| `className` | `string` | none | Added to `gb-source-file-editor`. |

The code pane is a plain `<textarea>`, not a highlighted code editor.

## See also

{% content-ref url="04-demo-blocks.md" %}
Demo blocks: live examples with their files
{% endcontent-ref %}

{% content-ref url="https://blamy.github.io/ui/#/docstream/interactive/source-files" %}
docstream: source files and the Vite plugin
{% endcontent-ref %}

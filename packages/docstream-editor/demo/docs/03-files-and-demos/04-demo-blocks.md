---
description: Live demo blocks in the editor. Resolve them by src or carry their files inline, edit those files in the block, run them with a runtime, copy or drag them between editors with their files, and edit standalone React demos with ReactDemoEditor.
---

# Demo blocks

`{% demo %}` is docstream's live example: a component with its real source files beside it. In `GitbookEditor` the block stays live. It shows the same viewer readers get (Preview and Code), with a header for its `src` and title and an editor for the files it carries. Copy it, or drag it by its grip, into another editor and its files come along.

{% demo src="demos-blocks/resolver" %}

## The block

````md
{% demo src="widgets/counter" %}

{% demo src="pasted/hello" title="Hello" %}
```tsx title="index.tsx"
export default function Hello() { return <p>Hello!</p> }
```
{% enddemo %}
````

The first form names a demo the host knows by `src`. The second carries its files inline, one titled fence per file, entry first; docstream's **Copy page** writes every demo this way, so a copied page is self-contained. The editor keeps every tag attribute on the node (`src`, `title`, `description`, `height`, `layout`, `variants`, `viewport`, `entry`, `status`, `bleed`, `className`, `surface`, `variantsWidth`) and the inline files with them, so the block serializes back exactly as written.

In edit mode the block header has:

- a **grip** to drag the block (see [Drag a demo](#drag-a-demo));
- inputs for `src` and the title;
- a **Files** toggle (it reads "1 file", "3 files" when the block carries some) that opens the inline file editor.

The file editor has a tab per file. Rename a file in its tab, mark it the entry with the **Entry** radio, set its language, or remove it with ×. **+** adds a file (`index.tsx` first, then `file2.tsx`, …). Tab in the code area indents by two spaces. Remove every file and the block is the one-line tag again. Insert a new block with **Demo** from the slash menu.

## What the preview shows

Under the header, docstream's `DemoViewer` renders the demo, in this order:

1. the host's **`demoResolver`**, when it knows `src` (a resolver with `list()` that doesn't list `src` is skipped for blocks with their own files);
2. otherwise the block's **inline files**, or the files the editor's demo VFS holds for `src` (see [the demo VFS](#the-demo-vfs)), run by **`demoRuntime`**;
3. otherwise the files' code, with a note that the preview needs a runtime.

A block with no resolver, no files and nothing in the VFS shows only its header. Edits to `src` and to the files are debounced, so typing doesn't re-run the demo on every keystroke.

| Prop | Type | Purpose |
| --- | --- | --- |
| `demoResolver` | `DemoResolver` | Resolves `src` to a component, its files and its `meta.json`. `createGlobDemoResolver` builds one from Vite globs. |
| `demoRuntime` | `InlineDemoRuntime` | Runs inline files, e.g. `createAlmostNodeDemoRuntime()` from `@brett_lamy/docstream/playground`. |
| `demoDependencies` | `Record<string, string>` | Extra npm packages inline demos may import, handed to the runtime. |

### demoResolver

```tsx title="DocsEditor.tsx"
import { createGlobDemoResolver } from "@brett_lamy/docstream/demo"
import { GitbookEditor } from "@brett_lamy/docstream-editor"

const demoResolver = createGlobDemoResolver({
  root: "./examples",
  modules: import.meta.glob("./examples/*/*/index.tsx"),
  sources: import.meta.glob("./examples/*/*/**/*.{ts,tsx,css,json}", { query: "?raw", import: "default" }),
  metas: import.meta.glob("./examples/*/*/meta.json", { eager: true, import: "default" }),
})

<GitbookEditor markdown={markdown} onChange={setMarkdown} demoResolver={demoResolver} />
```

Pass the same resolver your docs site renders with, and the editor shows each demo exactly as the published page will. A resolver is any object with `meta(src)`, `files(src)` and `load(src)` (and optionally `list()` and `href(src)`). The demo above uses a hand-written one over two imported components; its `resolver.ts` is in the demo's **Code** tab. docstream's [Demos](https://blamy.github.io/ui/#/docstream/interactive/demos) page covers folders, `meta.json` and variants.

### demoRuntime

The editor never loads a runtime itself. Without `demoRuntime`, a block with inline files shows their code. With one, the viewer calls it with the block's files:

```ts
type InlineDemoRuntime = (props: {
  src: string
  title: string
  files: DemoFile[] // entry first: { path, content, language? }
  entry: string
  variant?: string
  dependencies?: Record<string, string>
}) => ReactNode
```

```tsx title="DocsEditor.tsx"
import { createAlmostNodeDemoRuntime } from "@brett_lamy/docstream/playground" // needs @agent-wasm/core

const demoRuntime = createAlmostNodeDemoRuntime()

<GitbookEditor demoRuntime={demoRuntime} demoDependencies={{ "@brett_lamy/ui": "^1.2.0" }} … />
```

{% hint style="info" %}
This site doesn't install `@agent-wasm/core`, so the demos on this page can't run inline files for real. They pass a stand-in `demoRuntime` that shows what it was called with. In your app, `createAlmostNodeDemoRuntime()` bundles and runs the files in the browser instead. See docstream's [Inline demos](https://blamy.github.io/ui/#/docstream/interactive/inline-demos).
{% endhint %}

## Copy and paste demos between editors

Copying (or cutting) a selection with demo blocks in it, a single selected demo or prose around one, writes the docstream clipboard instead of ProseMirror's:

| Type | Content |
| --- | --- |
| `text/plain`, `text/markdown` | Renderable Markdown. Every demo carries its files inline. `src`-only demos get the resolver's files and `meta.json`, so the text renders anywhere. |
| `application/x-docstream+json` | `{ kind: "docstream", version: 1, markdown, files: { [src]: DemoFile[] }, meta: { [src]: DemoMeta } }`: the exact Markdown plus every demo's files. |

Any other selection keeps ProseMirror's normal copy. The viewer's own **Copy demo** button writes the same clipboard for one demo. Pasting prefers the JSON payload and falls back to Markdown with inline-file demos.

Try it: editor A below knows `widgets/counter` through its resolver, editor B has no resolver. Select the demo in A, copy it, and paste into B.

{% demo src="demos-blocks/copy-paste" %}

### pastedDemoFiles

A pasted `src`-only demo needs its files somewhere. `pastedDemoFiles` decides where:

| Value | The block | The files |
| --- | --- | --- |
| `"inline"` (default) | gains the files inline, unless the host resolver lists its `src` | in the demo VFS too |
| `"vfs"` | keeps exactly the structure it was copied with (src-only stays src-only) | only in the demo VFS: persist them with `onDemoFilesChange` |

Switch the demo to **vfs** and paste again: B's Markdown keeps the one-line tag, B still finds the counter's files in its VFS and hands them to its runtime, and `onDemoFilesChange` reports the files to save. Tick **share A's demoVFS** to give both editors one store.

### The demo VFS

Every editor holds a demo VFS: an in-memory `{ [src]: { files, meta } }` store. Pasted and dropped demos register their files in it (inline-file demos pasted as Markdown too), and a demo block whose `src` the resolver doesn't know renders from it. By default each editor has its own. Pass one VFS to several editors, and to renderers, to share the files:

```tsx title="TwoPanes.tsx"
import { GitbookEditor, useDemoVFS, useDemoVFSFiles } from "@brett_lamy/docstream-editor"
import { MarkdownContent } from "@brett_lamy/docstream"

const vfs = useDemoVFS()           // one VFS for every pane
const files = useDemoVFSFiles(vfs) // { [src]: DemoFile[] }, re-renders on change

<GitbookEditor markdown={a} onChange={setA} demoResolver={demoResolver} demoVFS={vfs} />
<GitbookEditor markdown={b} onChange={setB} demoVFS={vfs} pastedDemoFiles="vfs"
  onDemoFilesChange={(files, change) => saveDemoFiles(files)} />
<MarkdownContent markdown={b} demoVFS={vfs} />
```

| Prop | Type | Default | Purpose |
| --- | --- | --- | --- |
| `demoVFS` | `DemoVFS` | a private one | The VFS this editor reads and registers into. |
| `onDemoFilesChange` | `(files, change) => void` | none | The VFS changed: every `{ [src]: files }` it holds, and `change` (`{ src, entry }`, `entry` undefined when removed). |
| `pastedDemoFiles` | `"inline" \| "vfs"` | `"inline"` | See above. |
| `demoClipboard` | `boolean` | `true` | `false` turns the demo copy, paste and drop handling off. |

`createDemoVFS(initial?)` makes a VFS outside React. A VFS has `get`, `has`, `list`, `set(src, files, meta?)`, `delete`, `clear`, `snapshot()`, `files()` and `subscribe`.

### Drag a demo

Each demo block has a grip in its header. Drag it into another docstream editor to copy the demo there, files included (the drag carries the same payload as a copy), or within its own editor to move it. Dropping a block on itself does nothing. The drag is native HTML5 drag and drop, with the payload in the drag data. There is no keyboard drag yet; copy and paste covers it.

<details>
<summary>Lower-level pieces for custom editors</summary>

These are exported for a hand-built editor (see [Extensions and composition](05-extensions.md)):

| Export | Purpose |
| --- | --- |
| `selectionClipboard(editor, { resolver, vfs })` | The docstream clipboard for the current selection, or `null` when it holds no demo. |
| `clipboardForDoc(doc, { resolver, vfs })` | The clipboard for any docstream document. |
| `payloadContent(payload, { resolver, vfs, mode })` | Editor content for a pasted payload, registering its files. |
| `registerPayloadFiles(vfs, payload)` | Just the registering. |
| `lookupDemoSource(node, { resolver, vfs })` | A demo's files as the editor knows them now. |
| `useEditorClipboard(editor, { onCut, onPastePayload })` | The react-aria clipboard bridge the editor uses. |
| `readDocstreamClipboard`, `DOCSTREAM_CLIPBOARD_TYPE` | Read a payload from a `DataTransfer`; its MIME type. |

Resolver files are fetched ahead of time (`prefetchDemoSources`), since a copy event can't wait for a network request.

</details>

## ReactDemoEditor

`ReactDemoEditor` is a separate component, not a block: a small multi-file editor with a file list, a code pane, and a live preview drawn by the host's `liveRenderer`. Use it for a playground page, or wherever readers should edit a whole demo project.

{% demo src="demos-blocks/react-demo-editor" %}

```tsx title="Playground.tsx"
import { ReactDemoEditor } from "@brett_lamy/docstream-editor"
import { almostNodeLiveRenderer } from "@brett_lamy/docstream/playground" // needs @agent-wasm/core

export function Playground() {
  return (
    <ReactDemoEditor
      liveRenderer={almostNodeLiveRenderer}
      files={{
        "/src/main.jsx": mainSource,
        "/src/App.jsx": appSource,
      }}
      entry="/src/main.jsx"
      height={360}
      onChange={(files) => save(files)}
    />
  )
}
```

| Prop | Type | Default | Purpose |
| --- | --- | --- | --- |
| `files` | `Record<string, string>` | required | Source files by path. The list shows them sorted, and the first one is selected. |
| `entry` | `string` | `"/src/main.jsx"` | The entry handed to the renderer. |
| `liveRenderer` | `LivePreviewRenderer` | none | Draws the preview: `({ files, entry, title }) => ReactNode`. Without it, a note replaces the preview and the files stay editable. |
| `autoPreview` | `boolean` | `true` | Send edits to the preview after a pause. `false` shows **Run demo** instead. |
| `previewDebounceMs` | `number` | `350` | The pause. |
| `height` | `number \| string` | `320` | Minimum height of the preview. |
| `onChange` | `(files: Record<string, string>) => void` | none | Every edit, with all files. |
| `className` | `string` | none | Added to `gb-react-demo-editor`. |

Passing a new `files` object resets the drafts and the preview. Keep it stable (a constant or `useMemo`) unless you mean to reset. If the selected file disappears, the first file is selected.

{% hint style="info" %}
The renderer in this demo is a stand-in: it evaluates plain JavaScript modules and renders the entry's default export, so the files call `h()` instead of using JSX. `almostNodeLiveRenderer` runs a real Vite project in the page, JSX and npm packages included, and treats `entry` as the Vite entry (which mounts itself with `createRoot`).
{% endhint %}

## See also

{% content-ref url="05-extensions.md" %}
Extensions and composition
{% endcontent-ref %}

{% content-ref url="https://blamy.github.io/ui/#/docstream/interactive/demos" %}
docstream: demos, demo folders and meta.json
{% endcontent-ref %}

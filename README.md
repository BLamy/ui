# @brett_lamy/docstream-editor

TipTap editor components for Docstream GitBook-style markdown documents.

`@brett_lamy/docstream-editor` provides the editable layer for the same document model rendered by `@brett_lamy/docstream`. It is intended for docs apps that need rich editing while preserving GitBook-flavored markdown blocks for preview, storage, and AI stream rendering.

## Features

- Controlled React editor component for GitBook-style markdown.
- TipTap extensions for common writing flows.
- Conversion helpers between the Docstream AST and TipTap JSON.
- Slash menu for inserting supported blocks.
- Code block syntax highlighting through [`gpu-lexer`](https://gpu-lexer.vercel.app/) (language-agnostic, WebGPU; plain text where WebGPU is unavailable).
- Table, task list, heading, quote, and inline formatting support.
- Preserves Docstream/GitBook block semantics when converting back to markdown.
- Copy a docs page (docstream's "Copy page") and paste it in: the editor shows the same page and
  serializes it back byte-for-byte — demos with their inline files, install command boxes, titled
  tab sets and all. Inline code may combine with links, bold, italic and strike
  (``[`@brett_lamy/ui`](url)``, ``**bold `x` text**``); the editor's `GbCode` mark allows it.
- Lossless: any Markdown page comes back byte-for-byte through the editor. docstream's layout fields
  (blank lines, fences, list markers, tag lines, raw HTML, …) ride on each node's `md` attribute
  (`GbMarkdownLayout`); link details and code-span backticks on the link / code marks; escapes as the
  `mdEscaped` mark; nested same-type emphasis as `more` on the mark; reference definitions and unknown
  `{% tags %}` as `gbDefinition` / `gbRaw` blocks; chips and inline images carry emphasis and link marks.
- Preserves mounted source-file/export provenance and can write edits to the real file through Vite.

## Installation

```sh
pnpm add @brett_lamy/docstream-editor @tiptap/core @tiptap/extension-code @tiptap/extension-code-block \
  @tiptap/extension-list @tiptap/extension-placeholder @tiptap/extension-table @tiptap/pm \
  @tiptap/react @tiptap/starter-kit @tiptap/suggestion
```

React and the TipTap packages (including `@tiptap/extension-code`) are peer dependencies. `@brett_lamy/docstream` is a runtime dependency (pinned to the same version as the editor) because the editor uses the same parser, serializer, OpenAPI rendering, and asset helpers. Nothing in the install runs a build script, and the editor never references Docstream's optional almost-node playground (`@agent-wasm/core`) — see `liveRenderer` below to opt in.

### Document properties and task states (1.9)

YAML frontmatter is part of the document model. The editor shows a compact, editable property sheet
above the body; `documentProperties={false}` hides it and `documentProperties={{ defaultOpen: true }}`
expands it. Property edits use the normal `onChange` and undo/redo history. Body edits preserve the
original YAML, and controlled Markdown updates refresh both properties and body. Custom editors can
use `GbDocumentProperties`, `DocumentPropertiesEditor` and `editor.commands.setDocumentProperties()`.

Task checkboxes support `[ ]`, `[~]`, `[?]`, `[b]`, `[d]`, `[!]`, `[x]`, and `[-]` with shared Docstream
icons and tooltips. Click any marked state to clear it, then click again to verify it. Right-click or
Shift+F10 opens the state picker with every icon and label. Choices serialize to the original marker
and participate in undo/redo. `GbTaskItem` and `editor.commands.setTaskState(state)` are available to
custom editors built with `createGitbookExtensions`.

### Migrating to 1.5

No breaking changes. Copying a selection with demo blocks now writes the docstream
clipboard (see [Copy and paste demos between editors](#copy-and-paste-demos-between-editors)),
pasting one restores the demos with their files, and demo blocks gain a drag grip. New props:
`demoVFS`, `onDemoFilesChange`, `pastedDemoFiles`, `demoClipboard`. `react-aria` is now a
dependency (`useClipboard`).

### Migrating to 1.4

No API changes. Exports resolve to compiled `dist/*.js` + `.d.ts` instead of `src/*.ts(x)`
(Docstream 1.4 does the same); drop any `optimizeDeps` / `transpilePackages` entries or
type-check settings you added for the raw sources.

### Migrating to 1.3

- `GitbookEditor` no longer runs `live` jsx/tsx code blocks in almost-node on its own. Pass
  `liveRenderer={almostNodeLiveRenderer}` (from `@brett_lamy/docstream/playground`) to keep the preview.
- `ReactDemoEditor` takes the same `liveRenderer` prop; without it the files stay editable and a
  short note replaces the preview.

## Basic Setup

Import both package styles near your app entrypoint:

```ts
import "@brett_lamy/docstream/styles.css"
import "@brett_lamy/docstream-editor/styles.css"
```

If your TypeScript app checks CSS side-effect imports, include Vite's standard environment declaration or an equivalent CSS module declaration:

```ts
/// <reference types="vite/client" />
```

## Usage

`GitbookEditor` is a controlled component. Pass the current markdown and receive updated markdown through `onChange`.

```tsx
import { useState } from "react"
import { GitbookEditor } from "@brett_lamy/docstream-editor"
import "@brett_lamy/docstream/styles.css"
import "@brett_lamy/docstream-editor/styles.css"

const initialMarkdown = `# Getting started

{% hint style="info" %}
Type / to insert supported blocks.
{% endhint %}
`

export function EditorPage() {
  const [markdown, setMarkdown] = useState(initialMarkdown)

  return (
    <GitbookEditor
      markdown={markdown}
      onChange={setMarkdown}
    />
  )
}
```

## Props

```ts
export interface GitbookEditorProps {
  markdown: string
  onChange: (markdown: string) => void
  onKeyDown?: (event: KeyboardEvent) => boolean
  onPaste?: (event: ClipboardEvent) => boolean
  imagePaste?: "inline" | "chip"
  attachments?: EditorAttachment[]
  onAttachmentAdd?: (attachment: EditorAttachment & { file: File }) => void
  onAttachmentRemove?: (ids: string[]) => void
  onAttachmentOpen?: (attachment: EditorAttachment) => void
  demoResolver?: DemoResolver
  demoRuntime?: InlineDemoRuntime
  liveRenderer?: LivePreviewRenderer
  demoDependencies?: Record<string, string>
  markdownPaste?: boolean
  demoVFS?: DemoVFS
  onDemoFilesChange?: (files: Readonly<Record<string, DemoFile[]>>, change: DemoVFSChange) => void
  pastedDemoFiles?: "inline" | "vfs"
  demoClipboard?: boolean
}
```

- `markdown`: Source markdown to load into the editor.
- `onChange`: Called with serialized markdown whenever TipTap content changes.
- `onKeyDown` / `onPaste`: Optional host hooks that run before the built-in editor behavior;
  return `true` when the application handled the event.
- `imagePaste`, `attachments`, `onAttachmentAdd`, `onAttachmentRemove`, `onAttachmentOpen`:
  how pasted/dropped images are handled — see [Pasted and dropped images](#pasted-and-dropped-images).
- `demoResolver`: resolves `{% demo src %}` ids so demo blocks show a live, read-only
  preview — see [Demo blocks](#demo-blocks).
- `demoRuntime` / `demoDependencies`: run demos that carry their files inline and have no
  resolver behind them — the same options as Docstream's `DocRenderOptions`.
- `liveRenderer`: renders the preview above `live` jsx/tsx code blocks (as Docstream's
  `liveRenderer`). The editor never imports Docstream's almost-node playground itself; to run
  live code, pass `almostNodeLiveRenderer` / `createAlmostNodeDemoRuntime()` from
  `@brett_lamy/docstream/playground` (and install `@agent-wasm/core`). Without them, live code
  blocks are edited as plain code and inline demos open on their Code view.
- `markdownPaste` (default `true`): plain-text Markdown pasted into the editor that contains
  blocks (a "Copy page" export, `{% … %}` tags, fences, lists, headings …) is parsed into
  editor blocks instead of pasted as literal text. Plain prose pastes as usual; HTML clipboards
  keep TipTap's own handling (except VS Code's, which is treated as plain text).

- `demoVFS`, `onDemoFilesChange`, `pastedDemoFiles`, `demoClipboard`: demo copy / paste and the
  demo virtual file system — see [Copy and paste demos between editors](#copy-and-paste-demos-between-editors).

The editor tracks the last markdown it emitted so normal controlled updates do not continuously reset the TipTap document. Passing a different external `markdown` value replaces the editor content.

## Supported Editing Surface

The editor supports common ProseMirror/TipTap content plus GitBook-flavored blocks from Docstream.

- Headings
- Paragraphs
- Bold, italic, strike, inline code, and links (a link inside emphasis, `**[x](url)**`, stays
  distinct from emphasis inside a link, `[**x**](url)`)
- Bullet, ordered, and task lists
- Blockquotes
- Code blocks
- Tables
- Hints
- Tabs (including `{% tabs sync="key" %}` sync groups, and titled sets
  `{% tabs title="Installation" level="3" %}` rendered as a section heading with the switch on
  its row — click the heading icon in the tab strip to add a title)
- Package-manager command boxes (`{% command %}npm install x{% endcommand %}`, `/install command`)
- Expandables
- Steppers
- Embeds
- Content references
- Component and Storybook source references
- Live demos (`{% demo %}`), resolver-backed or carrying their files inline
- Columns
- Figures and images
- OpenAPI operation placeholders

Some blocks are intentionally represented as structured nodes rather than fully bespoke editing controls. They are preserved through parse, edit, and serialize flows so the document can continue to round-trip as GitBook-style markdown.

## Mentions, channels, and codebases

Typing `@`, `#`, or `$` opens a picker and inserts a reference chip that serializes as
`@id`, `#id`, or `$id` (`$org/repo` works too). Feed each trigger a static list or an
async `(query) => options` function; options can carry a `label`, `description`, and
`group` (rendered as section headers). `$` is only enabled when `codebases` is set, so
dollar signs in ordinary prose never open a menu. Free-form entry is always offered.

```tsx
<GitbookEditor
  markdown={md}
  onChange={setMd}
  references={{
    mentions: [
      ...people.map((p) => ({ id: p.handle, label: p.name, description: p.email, group: "People" })),
      ...agents.map((a) => ({ id: a.handle, label: a.name, description: a.harness, group: "Agents" })),
    ],
    tags: async (query) => searchChannels(query), // [{ id: "general", description: "channel" }]
    codebases: async (query) => searchRepos(query), // [{ id: "reading-room" }]
  }}
/>
```

## Pasted and dropped images

`imagePaste` controls how pasted or dropped image files enter the document. It runs after
your `onPaste` (return `true` there to take over). Clipboard data that also carries plain
text, such as a Word or Excel selection, still pastes as text.

- `"inline"` (default): an image block with the file as a data URL, the way it will render.
- `"chip"`: a compact attachment chip at the caret. The host stores the file. The chip
  serializes as `![image.png](attachment:att-xyz)`, shows a thumbnail and size, previews the
  full image on hover, and opens it on click.

```tsx
const [markdown, setMarkdown] = useState("")
const [attachments, setAttachments] = useState<EditorAttachment[]>([])

<GitbookEditor
  markdown={markdown}
  onChange={setMarkdown}
  imagePaste="chip"
  attachments={attachments}
  // once per image: { id, name, src (data URL), size, type, file }
  onAttachmentAdd={({ file, ...attachment }) => setAttachments((all) => [...all, attachment])}
  // chips deleted, cut or cleared by the user
  onAttachmentRemove={(ids) => setAttachments((all) => all.filter((a) => !ids.includes(a.id)))}
  // optional; omit it to use the built-in full-screen viewer
  onAttachmentOpen={(attachment) => openLightbox(attachment)}
/>
```

`EditorAttachment` is `{ id, name, src?, size?, type? }`. Chips find their image in
`attachments` by id, so `src` can be a data URL or an uploaded URL. To remove a chip
from outside the editor, call `editor.commands.removeAttachment(id)` (get the instance
from `onEditorReady`). Markdown images with an `attachment:` URL always load as chips,
whatever the mode. `serializeEditorMarkdown(ast)` is the serializer that writes them in
this form.

## Files from the host's project

An app that edits Markdown from a folder can plug in its own files. All four props are optional.

```tsx
<GitbookEditor
  markdown={markdown}
  onChange={setMarkdown}
  // "./case/part.stl" as written → a URL the browser can load (blob: of the local file).
  resolveAsset={(url) => (url.startsWith("./") ? blobUrlFor(url) : null)}
  // Adds "Choose file…" to embed blocks ("Choose image…" to figures).
  pickFile={({ kind }) => openMyFilePicker({ imagesOnly: kind === "image" })}
  // Drops you claim become embeds at the drop point: images as figures, anything else as an embed.
  onDropEmbeds={(data) =>
    data.types.includes("Files") ? copyIntoProject([...data.files]).then((paths) => paths.map((p) => `./${p}`)) : null
  }
  // Adds "Upload…" to embed and image blocks; dropped or pasted files that aren't images land here too.
  uploadFile={(file) => saveNextToDocument(file).then((path) => `./${path}`)}
/>
```

- `resolveAsset` covers figures, inline images and `.stl` / `.strudel` / `.rrweb` embeds (they wait for a promise).
  A `.rrweb` embed is an rrweb recording (a JSON event array) played in docstream's replay player.
- `pickFile` resolves to the URL to write, or nothing when the user cancels.
- `onDropEmbeds` decides synchronously: return `null` and the editor handles the drop as before (images
  inline, demo blocks). `embedBlockFor(url)` is the block a URL becomes.
- Thumbnail images (`![alt](src "thumbnail: 0:39.8")`, docstream 1.18) show as docstream's thumbnail with its
  hover card; first in a stepper step's heading, the thumbnail sits beside the title input and survives
  retitling.
- `uploadFile(file, { kind })` stores the file and resolves to the URL to write, or nothing to skip it.
  Dropped or pasted files that aren't images (`.rrweb` recordings, `.stl` models, …) are uploaded and
  embedded where they land; images still go inline (or to chips) as before, and `onDropEmbeds` sees
  drops first. With docstream's Vite plugin, `POST /@docstream/source?mount=…&path=…` with the file as
  the body writes it to disk.

## Edit a referenced source file

`GitbookEditor` edits the Markdown composition, including a structured
`source-ref` node. `SourceFileEditor` edits the real file behind that node:

```tsx
import { createViteSourceClient, type SourceRefNode } from "@brett_lamy/docstream"
import { SourceFileEditor } from "@brett_lamy/docstream-editor"

const client = createViteSourceClient()
const reference: SourceRefNode = {
  type: "source-ref",
  mount: "ui",
  path: "Button.stories.tsx",
  exportName: "Primary",
  kind: "story",
}

<SourceFileEditor reference={reference} client={client} />
```

Saving calls the Docstream Vite plugin, writes the mounted file, returns its
provenance, and refreshes the live component/story preview. Configure the mount
with `docstreamSources()` from `@brett_lamy/docstream/vite` as shown in the
Docstream README.

## Demo blocks

`{% demo src="<page>/<example>" %}` becomes a `gbDemo` atom node. Every tag
attribute — `src`, `title`, `description`, `height`, `layout`, `variants`,
`viewport`, `entry` — is kept on the node, and so are the files the block form
carries inline (the titled fences between `{% demo … %}` and `{% enddemo %}`, as
`files: { path, content, language? }[]`), so the block serializes back exactly as
written. Docstream's "Copy page" writes every demo this way.

The node shows a compact header with editable `src` and `title` inputs (insert
one with `/demo`) and a **Files** toggle that opens a small file editor: a tab
per file (rename it in place, mark it the entry, remove it), a code area, and
`+` to add a file. Removing every file gives the one-line tag form again.

Under the header, Docstream's read-only `DemoViewer` renders the demo: from the
`demoResolver` when it knows `src`, otherwise from the inline files — so a
pasted docs page looks like the docs page. Inline files run in the Preview
through `demoRuntime` (e.g. `createAlmostNodeDemoRuntime()` from
`@brett_lamy/docstream/playground`) with `demoDependencies`; without a runtime
the viewer shows their code.

```tsx
import { createGlobDemoResolver } from "@brett_lamy/docstream/demo"
import { GitbookEditor } from "@brett_lamy/docstream-editor"

const demoResolver = createGlobDemoResolver({ /* see the Docstream README */ })

<GitbookEditor markdown={markdown} onChange={setMarkdown} demoResolver={demoResolver} />
```

## Copy and paste demos between editors

Copying (or cutting) a selection that contains demo blocks — a single selected
demo, or prose with demos in it — writes one clipboard item through react-aria's
`useClipboard`:

| Type | Content |
| --- | --- |
| `text/plain`, `text/markdown` | renderable Markdown: every demo carries its files inline (`src`-only demos get the resolver's files and `meta.json`), so it renders anywhere |
| `application/x-docstream+json` | `{ kind: "docstream", version: 1, markdown, files: { [src]: DemoFile[] }, meta: { [src]: DemoMeta } }` — the exact Markdown plus every demo's files |

Any other selection keeps ProseMirror's normal copy. Docstream's `DemoViewer`
**Copy demo** button (inside the editor and on rendered pages) writes the same
item for one demo. Resolver files are fetched ahead (`prefetchDemoSources`), as a
copy event can't wait for them.

Pasting prefers the JSON payload, and falls back to Markdown with inline-file
demos (`text/plain` / `text/markdown` only). Pasted demo blocks keep their inline
files, and every demo's files are registered in the editor's **demo VFS** — an
in-memory `{ [src]: { files, meta } }` store — so they render:

1. with the host `demoResolver` when it knows `src`;
2. otherwise from the block's inline files or the VFS files, run by `demoRuntime`
   (`createAlmostNodeDemoRuntime()` from `@brett_lamy/docstream/playground`, when installed);
3. otherwise in the Code view with the "needs runtime" note.

`pastedDemoFiles` decides where a pasted `src`-only demo's files go: `"inline"`
(default) — into the VFS and inline in the block (unless the host resolver lists
`src`), so the saved Markdown is self-contained; `"vfs"` — the VFS only, the block
keeps its exact copied structure; persist the files yourself.

```tsx
import { GitbookEditor, useDemoVFS, useDemoVFSFiles } from "@brett_lamy/docstream-editor"

const vfs = useDemoVFS()            // one VFS shared by both editors
const files = useDemoVFSFiles(vfs)  // { [src]: DemoFile[] } — or use onDemoFilesChange

<GitbookEditor markdown={a} onChange={setA} demoResolver={demoResolver} demoVFS={vfs} />
<GitbookEditor markdown={b} onChange={setB} demoVFS={vfs} demoRuntime={demoRuntime}
  pastedDemoFiles="vfs" onDemoFilesChange={(files) => save(files)} />
```

Without `demoVFS` each editor has its own. `demoClipboard={false}` turns the
demo copy / paste handling off. Pass the same VFS to a renderer (`demoVFS` on
Docstream's `MarkdownContent` / `DocsRenderer`) to render the saved Markdown with
the pasted files.

**Drag.** Each demo block has a grip: drag it into another docstream editor to
copy the demo there (same payload, files included), or within its editor to move
it. The drag uses native HTML5 drag-and-drop with the docstream payload rather than
react-aria's `useDrag` / `useDrop`: `useDrag` insists on `useDrop` targets, which
would sit on top of ProseMirror's own drop handling. Keyboard / screen-reader drag
is future work (copy / paste covers it).

Lower-level pieces are exported for custom editors: `selectionClipboard(editor, { resolver, vfs })`,
`payloadContent(payload, { resolver, vfs, mode })`, `registerPayloadFiles`,
`clipboardForDoc`, `useEditorClipboard`, plus Docstream's `createDemoVFS`,
`readDocstreamClipboard` and `DOCSTREAM_CLIPBOARD_TYPE`.

## Command boxes

`{% command %}npm install @brett_lamy/ui{% endcommand %}` (or the block form, for
several lines) becomes a `gbCommand` atom node rendered with Docstream's own
command box: terminal glyph, pnpm / npm / yarn / bun switch (synced page-wide),
copy button. When editable, the npm command and per-manager overrides
(`pnpm="…"`, `yarn="…"`, `bun="…"`; the placeholder shows the derived command)
are edited under the box. `sync` is preserved. Insert one with `/install command`.

## Slash Menu

The editor includes a slash menu extension for inserting supported block structures. Type `/` in an empty paragraph to open block insertion options.

## Conversion Helpers

Use the conversion helpers when you need to inspect or transform editor state directly.

```ts
import { astToTiptap, tiptapToAst } from "@brett_lamy/docstream-editor"
import { parseMarkdown, serializeMarkdown } from "@brett_lamy/docstream"

const ast = parseMarkdown(markdown)
const tiptapJson = astToTiptap(ast)
const markdownAgain = serializeMarkdown(tiptapToAst(tiptapJson))
```

Exports:

- `GitbookEditor`
- `GitbookEditorProps`
- `astToTiptap`
- `tiptapToAst`
- `PMNode`
- `EditorAttachment`
- `serializeEditorMarkdown`
- `markdownPasteContent` (the Markdown-paste parser behind `markdownPaste`)
- `SourceFileEditor`
- `SourceFileEditorProps`

Applications that only need the core editor can import the narrow entrypoint. It avoids loading
the source-file and React playground integrations:

```tsx
import { GitbookEditor } from "@brett_lamy/docstream-editor/editor"
import { astToTiptap } from "@brett_lamy/docstream-editor/convert"
```

## Styling and Theming

The editor CSS is designed to sit beside `@brett_lamy/docstream/styles.css` and inherit the same application theme tokens. In a shadcn-style app, define your theme variables globally and import both CSS entrypoints once.

```css
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --border: 214.3 31.8% 91.4%;
  --muted: 210 40% 96.1%;
  --muted-foreground: 215.4 16.3% 46.9%;
  --primary: 221.2 83.2% 53.3%;
}
```

The editor exposes classes such as `gb`, `gb-toolbar`, `gb-tool`, `gb-tool-active`, and `gb-content` for host app overrides.

## Bundler Notes

Since 1.4 the package ships compiled ES modules (ES2022, `react-jsx`) with type
declarations and declaration maps — one file per source module in `dist/`, TipTap,
Docstream and every other dependency left as imports:

```json
{
  "exports": {
    ".": {
      "source": "./src/index.ts",
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "default": "./dist/index.js"
    },
    "./editor": { "types": "./dist/editor/Editor.d.ts", "import": "./dist/editor/Editor.js" },
    "./convert": { "types": "./dist/editor/convert.d.ts", "import": "./dist/editor/convert.js" },
    "./styles.css": "./dist/styles.css"
  }
}
```

No bundler configuration is needed: Vite pre-bundles the editor (and TipTap's CommonJS
dependencies such as `use-sync-external-store`) like any other dependency, so no
`optimizeDeps` entries; Next.js and webpack consume it as plain ESM; your type-check
reads `.d.ts` files instead of the editor's sources. The TypeScript sources are
published too, behind a `source` export condition, for monorepos that compile from source.

## Renderer Pairing

For read-only previews or AI stream output, pair this package with `@brett_lamy/docstream`:

```tsx
import { GitbookStreamdown } from "@brett_lamy/docstream"

<GitbookStreamdown markdown={markdown} isStreaming={false} />
```

Embed nodes preserve the Docstream media attributes (`title`, `poster`,
`autoplay`, `loop`, `muted`, and `controls`) when converting between the
editable TipTap document and GitBook markdown. This makes short, muted,
autoplaying clips round-trip through the editor without losing their playback
contract.

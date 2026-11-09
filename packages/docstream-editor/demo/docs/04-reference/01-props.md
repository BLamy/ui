---
description: Every GitbookEditor prop with its type, default and effect, the props of SourceFileEditor and ReactDemoEditor, and every export of the package.
---

# Props

`GitbookEditor` takes 38 props, and all of them are optional. This page lists every one, checked against `src/editor/Editor.tsx`, grouped by what they connect the editor to.

{% demo src="ref-props/explorer" %}

```tsx title="Signature" lineNumbers="false"
import { GitbookEditor, type GitbookEditorProps } from "@brett_lamy/docstream-editor"

function GitbookEditor(props: GitbookEditorProps): JSX.Element | null
```

The component renders `null` until Tiptap has created the editor: always on the server, and on the client only for an instant. After that it renders `<div class="gb …">` containing the property sheet, the toolbar and the document.

{% hint style="warning" %}
**Read once, at creation:** `autofocus`, `placeholder`, `slashMenu`, `references`, `disableHistory` and `extensions` configure the Tiptap instance when it's created. Changing them later has no effect. To switch one, remount with a `key` (`<GitbookEditor key={JSON.stringify(references)} … />`). Every other prop — `editable` and the callbacks included — is read live.
{% endhint %}

## Document

| Prop | Type | Default | Effect |
| --- | --- | --- | --- |
| `markdown` | `string` | — | The document. When given, the editor is **controlled**: a new value that differs from the editor's last `onChange` output replaces the content, without emitting `onChange`. The editor's own output echoed back is ignored. Leave it out for an uncontrolled editor that starts empty. |
| `onChange` | `(markdown: string) => void` | — | Called on every edit with the serialized Markdown (`tiptapToAst` → `serializeEditorMarkdown`, footnote definitions re-attached). |
| `documentProperties` | `boolean \| { defaultOpen?: boolean }` | `true` | The YAML frontmatter as an editable property sheet above the body. `false` hides the sheet; the YAML is still kept. `{ defaultOpen: true }` starts it expanded. It only appears when the document has frontmatter, and is read-only when the editor is. |
| `editable` | `boolean` | `true` | `false` gives a read-only document: no caret, no slash or chip menus, no paste or drop handling, source-file autosave off. *Read at creation.* |
| `placeholder` | `string` | `"Write, or type / to insert a block…"` | Shown in an empty document. *Read at creation.* |
| `autofocus` | `boolean` | `false` | Focus the editor on mount. *Read at creation.* |

## Chrome and menus

| Prop | Type | Default | Effect |
| --- | --- | --- | --- |
| `toolbar` | `boolean` | `true` | The formatting toolbar: bold, italic, strike, inline code, link (prompts for a URL; an empty answer removes the link), and a "Type / for blocks" hint. |
| `slashMenu` | `boolean \| { items?: SlashItem[] }` | `true` | The `/` block menu: on, off, or your own item list (`SLASH_ITEMS` is the default list). See [Slash menu](../02-editing/02-slash-menu.md). *Read at creation.* |
| `references` | `boolean \| ReferenceSources` | `true` | The `@` / `#` / `$` chip pickers. `true`: `@` and `#` with free-form entry only. `false`: no pickers. Chips already in the Markdown still load. An object: `{ mentions?, tags?, codebases? }`, each a static list or `(query) => options` (sync or async). `$` is only enabled when `codebases` is given. See [References and citations](../02-editing/03-references-and-citations.md). *Read at creation.* |
| `className` | `string` | — | Added to the wrapper: `class="gb <className>"`. |

## Tiptap integration

| Prop | Type | Default | Effect |
| --- | --- | --- | --- |
| `onEditorReady` | `(editor: Editor \| null) => void` | — | Receives the Tiptap `Editor` once it exists, and `null` on teardown. Use it for commands (`removeAttachment`, `setDocumentProperties`, `setTaskState`), awareness, or selection state. |
| `extensions` | `AnyExtension[]` | — | Extra Tiptap extensions, appended after the GitBook set (e.g. `Collaboration`, `CollaborationCursor`). *Read at creation.* |
| `disableHistory` | `boolean` | `false` | Turns off StarterKit's undo / redo. Required with Yjs `Collaboration`, which keeps its own shared history. *Read at creation.* |
| `onKeyDown` | `(event: KeyboardEvent) => boolean` | — | Runs before the editor's keymaps. Return `true` when you handled the key. |
| `onPaste` | `(event: ClipboardEvent) => boolean` | — | Runs before every built-in paste behavior (demo clipboard, images, uploads, Markdown). Return `true` to take the paste over. |

## Paste and images

| Prop | Type | Default | Effect |
| --- | --- | --- | --- |
| `markdownPaste` | `boolean` | `true` | Plain-text Markdown that contains blocks (a **Copy page** export, `{% … %}` tags, fences, lists, headings, footnotes) is pasted as editor blocks. Plain prose pastes as text. HTML clipboards keep Tiptap's handling, except VS Code's, which counts as plain text. Never applies inside a code block. |
| `imagePaste` | `"inline" \| "chip"` | `"inline"` | Pasted or dropped image files. `"inline"`: an image block with the file as a data URL. `"chip"`: an attachment chip at the caret, serialized as `![name](attachment:<id>)`, with the file held by the host. A clipboard that also has text (a Word or Excel selection) still pastes as text. |
| `attachments` | `EditorAttachment[]` | — | Chip mode: your attachment store. Chips look up their thumbnail, full image and size here by `id`. |
| `onAttachmentAdd` | `(attachment: EditorAttachment & { file: File }) => void` | — | Chip mode: once per pasted or dropped image, with a fresh `id`, its `name`, `size`, `type`, the `file`, and `src` as a data URL (when the file could be read). Add it to `attachments`. |
| `onAttachmentRemove` | `(ids: string[]) => void` | — | Chips the user deleted, cut or cleared. Not fired when your own `markdown` replaces the document. |
| `onAttachmentOpen` | `(attachment: EditorAttachment) => void` | — | Click, Enter or Space on a chip. Leave it out to use the built-in full-screen viewer. |

Details and a live demo: [Images and attachments](../03-files-and-demos/01-images-and-attachments.md).

## Host files

| Prop | Type | Default | Effect |
| --- | --- | --- | --- |
| `resolveAsset` | `AssetResolver` | — | Maps URLs as written (`./models/part.stl`, `./photo.png`) to URLs the browser can load, typically `blob:` URLs of files next to the document. Return nothing for the default. |
| `pickFile` | `FilePicker` = `({ kind, current }) => Promise<string \| null \| undefined>` | — | Adds **Choose file…** to embed blocks and **Choose image…** to figures (`kind` is `"embed"` or `"image"`). Resolve with the URL to write, or nothing if the user cancels. |
| `uploadFile` | `FileUploader` = `(file, { kind }) => Promise<string \| null \| undefined>` | — | Adds **Upload…** to embed and image blocks. Dropped or pasted files that aren't images (`.rrweb`, `.stl`, …) are uploaded and embedded where they land. Resolve with the URL to write, or nothing to skip. |
| `onDropEmbeds` | `(data: DataTransfer) => Promise<readonly string[]> \| readonly string[] \| null` | — | Sees drops first (after demo-block drags). Return URLs (or a promise of them) to embed at the drop point: images become figures, anything else becomes an embed (`embedBlockFor`). Return `null` to let the editor handle the drop. Decide synchronously; the URLs may arrive later. |

Details: [Host files](../03-files-and-demos/02-host-files.md).

## Source files

| Prop | Type | Default | Effect |
| --- | --- | --- | --- |
| `sourceClient` | `SourceReferenceClient` | — | Reads, writes and imports the files behind `{% source-ref %}` blocks (`createViteSourceClient()` from `@brett_lamy/docstream`, or your own `{ read, write, importModule }`). Without it, source refs are structured blocks with no file editor. |
| `sourcePreview` | `boolean` | `true` | Render the referenced export below its file editor. |
| `sourceAutoSave` | `boolean \| number` | `true` | Autosave file edits: `true` waits 500 ms, a number sets the delay, `false` shows a **Save file** button. Always off while `editable` is `false`. |
| `onSourceSaved` | `(snapshot: SourceFileSnapshot) => void` | — | After a file is written, with its content and provenance. |
| `onSourceError` | `(error: Error) => void` | — | When reading, writing or previewing a file fails. |

Details: [Source files](../03-files-and-demos/03-source-files.md).

## Demos and live code

<details>
<summary>Eight props: resolver, runtimes, the demo VFS and the demo clipboard</summary>

| Prop | Type | Default | Effect |
| --- | --- | --- | --- |
| `demoResolver` | `DemoResolver` | — | Resolves `{% demo src %}` ids. Demo blocks show docstream's read-only `DemoViewer`, from the resolver when it knows `src`, and otherwise from the block's inline files. |
| `demoRuntime` | `InlineDemoRuntime` | — | Runs the Preview of demos that carry their files inline and have no resolver entry, e.g. `createAlmostNodeDemoRuntime()` from `@brett_lamy/docstream/playground`. Without it, those demos open on their code with a note. |
| `liveRenderer` | `LivePreviewRenderer` | — | Renders the preview above `live` jsx/tsx code blocks, e.g. `almostNodeLiveRenderer`. Without it, live fences are edited as plain code. |
| `demoDependencies` | `Record<string, string>` | — | Extra npm packages inline demos may import (as docstream's `demoDependencies`). |
| `demoVFS` | `DemoVFS` | a VFS private to this editor | Demo files in memory, by `src`. Pasted and dropped demos register theirs here, and blocks with no inline files and no resolver entry render from it. Pass one `useDemoVFS()` to several editors and renderers to share files. |
| `onDemoFilesChange` | `(files: Readonly<Record<string, DemoFile[]>>, change: DemoVFSChange) => void` | — | Fired when the VFS changes, with everything it holds. |
| `pastedDemoFiles` | `"inline" \| "vfs"` | `"inline"` | Where a pasted `src`-only demo's files go. `"inline"`: the VFS, and inline in the block unless the resolver lists that `src`, so the saved page is self-contained. `"vfs"`: the VFS only, and the block keeps its copied structure. Persist the files yourself. |
| `demoClipboard` | `boolean` | `true` | Copying or cutting a selection with demo blocks writes the docstream clipboard (renderable Markdown with files inline, plus `application/x-docstream+json`). Pasting or dropping one restores the demos with their files. |

</details>

Details: [Demo blocks](../03-files-and-demos/04-demo-blocks.md) and [Code, math and diagrams](../02-editing/04-code-math-and-diagrams.md).

## Commands on the Tiptap instance

The GitBook extensions add three commands to `editor.commands` (get the instance from `onEditorReady`):

| Command | Effect |
| --- | --- |
| `removeAttachment(id)` | Removes the chip(s) with that attachment id. |
| `setDocumentProperties(properties \| null)` | Replaces the frontmatter (a docstream `DocumentPropertiesNode`). Part of undo history and `onChange`. |
| `setTaskState(state)` | Sets the selected task item's state: `"pending"`, `"in-progress"`, `"implemented"`, `"blocked"`, `"parked"`, `"refuted"`, `"verified"` or `"cancelled"`. |

## Other components

### `SourceFileEditor`

Edits the real file behind one source reference, outside any document.

| Prop | Type | Default | Effect |
| --- | --- | --- | --- |
| `reference` | `SourceRefNode` | required | `{ type: "source-ref", mount, path, exportName, kind }`. |
| `client` | `SourceReferenceClient` | required | Reads, writes and imports the file. |
| `className` | `string` | — | Added to `gb-source-file-editor`. |
| `preview` | `boolean` | `true` | Render the export below the editor. It refreshes after each save. |
| `autoSave` | `boolean \| number` | `false` | `true` saves 500 ms after you stop typing, a number sets the delay. Note the default differs from `GitbookEditor`'s `sourceAutoSave`. |
| `onSaved` | `(snapshot: SourceFileSnapshot) => void` | — | After each write. |
| `onError` | `(error: Error) => void` | — | Read, write or preview failures. |

### `ReactDemoEditor`

A multi-file source editor with a live React preview supplied by the host.

| Prop | Type | Default | Effect |
| --- | --- | --- | --- |
| `files` | `Readonly<Record<string, string>>` | required | Source files by path. A new object resets the drafts and the preview. |
| `entry` | `string` | `"/src/main.jsx"` | The Vite entry file. |
| `height` | `number \| string` | `320` | Preview height. |
| `className` | `string` | — | Added to `gb-react-demo-editor`. |
| `onChange` | `(files: Record<string, string>) => void` | — | Every edit, with all files. |
| `liveRenderer` | `LivePreviewRenderer` | — | Renders the running preview, e.g. `almostNodeLiveRenderer`. Without it the files stay editable and a note replaces the preview. |
| `autoPreview` | `boolean` | `true` | Refresh the preview as files are edited. `false` brings back a manual **Run demo** button. |
| `previewDebounceMs` | `number` | `350` | Delay before edited files reach the preview. |

## Every export

`@brett_lamy/docstream-editor` (`src/index.ts`):

| Export | Kind | What it is |
| --- | --- | --- |
| `GitbookEditor` | component | The editor. |
| `GitbookEditorProps`, `EditorAttachment`, `FilePicker`, `FilePickKind`, `FileUploader`, `AssetResolver` | types | Its props and the types they use. |
| `embedBlockFor(url)` | function | The block a dropped URL becomes: a `gbFigure` for an image URL, a `gbEmbed` otherwise. |
| `astToTiptap`, `tiptapToAst`, `serializeEditorMarkdown`, `markdownPasteContent` | functions | Conversion. See [Conversion](02-conversion.md). |
| `PMNode` | type | Tiptap / ProseMirror JSON: `{ type, attrs?, content?, marks?, text? }`. |
| `SourceFileEditor`, `SourceFileEditorProps` | component, type | Edit a mounted source file. |
| `ReactDemoEditor`, `ReactDemoEditorProps` | component, type | Multi-file editor with a host-supplied live preview. |
| `GbDocumentProperties` | extension | Frontmatter on the doc node, with `setDocumentProperties`. |
| `DocumentPropertiesEditor` | component | The property sheet, for custom editors: `<DocumentPropertiesEditor editor={editor} defaultOpen />`. |
| `GbTaskItem` | extension | Task items with docstream's eight states, with `setTaskState`. |
| `TaskCheckbox`, `TASK_STATE_ICONS`, `TASK_STATES`, `TaskState` | re-exports | From `@brett_lamy/docstream/tasks` and `/gitbook`. |
| `DocumentPropertiesNode` | type | From `@brett_lamy/docstream/gitbook`. |
| `createGitbookExtensions(options?)` | function | The complete extension list `GitbookEditor` uses, for your own `useEditor`. |
| `GitbookExtensionOptions`, `ReferenceSources` | types | `{ placeholder?, slashMenu?, references?, disableHistory?, extensions? }` and `{ mentions?, tags?, codebases? }`. |
| `getGitbookSchema()` | function | The exact ProseMirror schema (for y-prosemirror, or for validating JSON). |
| `GbCode`, `GbTable`, `GbLinkInner`, `GbMarkSpelling` | extensions | Inline code that combines with other marks, tables with `data-view` and alignment, link-inside-emphasis, emphasis spelling. |
| `gitbookNodes` | extension array | Every GitBook node: hints, tabs, expandables, steppers, embeds, content refs, source refs, demos, command boxes, columns, figures, math, inline images, references, updates, OpenAPI, definitions, raw tags. |
| `GbCodeBlock`, `GbCommand`, `GbDemo`, `GbReference` | extensions | Individual nodes: code block, `{% command %}` box, `{% demo %}` block, `@` / `#` / `$` chip. |
| `GbAttachment`, `formatBytes` | extension, function | The attachment chip, with `removeAttachment`; `formatBytes(1536)` → `"2 KB"`. |
| `SlashMenu`, `createSlashMenu(items?)`, `SLASH_ITEMS`, `SlashItem` | extension, function, array, type | The `/` menu. `SlashItem` is `{ title, keywords, icon, run(editor) }`. |
| `createReferenceSuggestion({ char, items?, allowFreeForm? })`, `resolveReferenceOptions(source, query)` | functions | One chip picker as an extension, and the option filtering it uses. |
| `ReferenceOption`, `ReferenceSource`, `ReferenceSuggestionOptions`, `ReferenceTrigger` | types | `{ id, label?, description?, group? }`, list-or-function, picker options, `"@" \| "#" \| "$"`. |
| `SuggestionMenuView`, `createSuggestionRender`, `SuggestionMenuItem` | component, function, type | The popup the slash and reference menus share, for your own suggestion extensions. |
| `selectionClipboard`, `clipboardForDoc`, `payloadContent`, `registerPayloadFiles`, `lookupDemoSource`, `useEditorClipboard` | functions, hook | The demo clipboard, for custom editors. |
| `ClipboardBridge`, `DemoSources`, `PastedDemoFiles` | types | — |
| `DOCSTREAM_CLIPBOARD_TYPE`, `createDemoVFS`, `readDocstreamClipboard`, `useDemoVFS`, `useDemoVFSFiles` | re-exports | From `@brett_lamy/docstream/demo`. |
| `DemoVFS`, `DemoVFSChange`, `DemoVFSEntry`, `DocstreamClipboardPayload` | types | From `@brett_lamy/docstream/demo`. |

The narrow entries export a subset, plus a few internals:

| Entry | Exports |
| --- | --- |
| `@brett_lamy/docstream-editor/editor` | `GitbookEditor`, `embedBlockFor`, and the types `GitbookEditorProps`, `EditorAttachment`, `FilePicker`, `FilePickKind`, `FileUploader`, `AssetResolver`. |
| `@brett_lamy/docstream-editor/convert` | `astToTiptap`, `tiptapToAst`, `serializeEditorMarkdown`, `markdownPasteContent`, `PMNode`, and the node helpers `pmToDemo`, `pmDemoFiles`, `pmToCommand` (only exported here). |
| `@brett_lamy/docstream-editor/styles.css` | The stylesheet. See [Theming](03-theming.md). |

---
description: Build your own TipTap editor from the GitBook pieces. The extension list, the exact schema for Yjs and y-prosemirror, turning history off, adding your own extensions, and what you give up by leaving GitbookEditor.
---

# Extensions and composition

`GitbookEditor` is one way to put the pieces together. When you need your own `useEditor()`, for real-time collaboration, a different toolbar, extra marks or a different paste policy, use the same pieces directly. You keep every GitBook block and the byte-for-byte Markdown round trip.

{% demo src="demos-extensions/custom-editor" %}

```tsx title="MyEditor.tsx"
import { useState } from "react"
import { EditorContent, useEditor } from "@tiptap/react"
import { astToTiptap, createGitbookExtensions, serializeEditorMarkdown, tiptapToAst, type PMNode } from "@brett_lamy/docstream-editor"
import { parseMarkdown } from "@brett_lamy/docstream/gitbook"
import "@brett_lamy/docstream-editor/styles.css"

export function MyEditor({ initial }: { initial: string }) {
  const [markdown, setMarkdown] = useState(initial)
  const editor = useEditor({
    extensions: createGitbookExtensions({ slashMenu: true, extensions: [/* yours */] }),
    content: astToTiptap(parseMarkdown(initial)),
    onUpdate: ({ editor }) => setMarkdown(serializeEditorMarkdown(tiptapToAst(editor.getJSON() as PMNode))),
  })
  // The .gb / .gb-content classes carry the editor's styles.
  return (
    <div className="gb">
      <EditorContent editor={editor} className="gb-content" />
    </div>
  )
}
```

## createGitbookExtensions(options?)

Returns the extension list `GitbookEditor` itself uses, in this order:

1. TipTap's `StarterKit`, with its code block and inline code turned off (and its undo / redo, with `disableHistory`);
2. `GbCode`, inline code that combines with links and emphasis;
3. `GbCodeBlock`, code fences with title, line numbers, live previews, Mermaid and Strudel;
4. `TaskList` and `GbTaskItem` (nested), `GbTable` with `TableRow`, `TableHeader`, `TableCell`;
5. `Placeholder`;
6. the Markdown-fidelity extensions: `GbLinkInner`, `GbMarkSpelling`, and two internal ones that keep layout and backslash escapes;
7. `GbDocumentProperties`, the frontmatter;
8. `gitbookNodes`, every GitBook block and inline node;
9. the slash menu, if on;
10. the `@` and `#` reference pickers (and `$`), if on;
11. your `extensions`, last.

| Option | Type | Default | Purpose |
| --- | --- | --- | --- |
| `placeholder` | `string` | `"Write, or type / to insert a block…"` | Shown in an empty document. |
| `slashMenu` | `boolean \| { items?: SlashItem[] }` | `true` | The `/` menu, off, or your own items. See [Slash menu](../02-editing/02-slash-menu.md). |
| `references` | `boolean \| ReferenceSources` | `true` | `@` and `#` chips with free entry, off, or per-trigger sources. A `codebases` source adds `$`. See [References and citations](../02-editing/03-references-and-citations.md). |
| `disableHistory` | `boolean` | `false` | Leave out StarterKit's undo / redo. |
| `extensions` | `AnyExtension[]` | `[]` | Appended after everything else. |

`GitbookEditor` takes `disableHistory` and `extensions` too, so you can add a TipTap extension, collaboration included, without leaving the component:

```tsx
import CharacterCount from "@tiptap/extension-character-count"

<GitbookEditor markdown={markdown} onChange={setMarkdown} extensions={[CharacterCount.configure({ limit: 20000 })]} />
```

{% hint style="warning" %}
Build from `createGitbookExtensions` rather than from the individual exports. The two internal fidelity extensions (Markdown layout and backslash escapes) are in the list but not exported, and without them pages no longer round-trip byte for byte.
{% endhint %}

## Undo, redo and Yjs

A Yjs `Collaboration` extension keeps a shared history across every client, and it conflicts with StarterKit's local undo / redo. `disableHistory: true` configures StarterKit with `undoRedo: false`, so the `undo` and `redo` commands and their ⌘Z / ⌘⇧Z shortcuts are gone, and Collaboration's own undo takes over. Switch the demo above to **disableHistory**: the Undo and Redo buttons go dead, because `editor.commands.undo` no longer exists.

```tsx title="CollabEditor.tsx"
import * as Y from "yjs"
import Collaboration from "@tiptap/extension-collaboration"
import { GitbookEditor } from "@brett_lamy/docstream-editor"

const ydoc = new Y.Doc()

<GitbookEditor
  disableHistory
  extensions={[Collaboration.configure({ document: ydoc })]}
  onChange={(markdown) => saveSnapshot(markdown)}
/>
```

{% hint style="info" %}
With Collaboration the shared Y.Doc owns the content. Don't also pass a controlled `markdown` that you keep setting back, or every client resets the document. Seed the Y.Doc once (below) and treat `onChange` as an export.
{% endhint %}

## getGitbookSchema()

Returns the ProseMirror `Schema` for GitBook documents, built from `createGitbookExtensions({ slashMenu: false })`, so it's identical to the editor's. A server or worker that converts between Markdown and a shared Yjs document needs this exact schema; any other schema rejects the GitBook nodes.

{% demo src="demos-extensions/schema" %}

```ts title="seed.ts"
import * as Y from "yjs"
import { prosemirrorJSONToYXmlFragment, yXmlFragmentToProseMirrorRootNode } from "y-prosemirror"
import { astToTiptap, getGitbookSchema, serializeEditorMarkdown, tiptapToAst, type PMNode } from "@brett_lamy/docstream-editor"
import { parseMarkdown } from "@brett_lamy/docstream/gitbook"

const schema = getGitbookSchema()

/** Markdown → a Y.Doc's fragment (the one Collaboration uses: "default"). */
export function seed(ydoc: Y.Doc, markdown: string) {
  prosemirrorJSONToYXmlFragment(schema, astToTiptap(parseMarkdown(markdown)), ydoc.getXmlFragment("default"))
}

/** A Y.Doc → Markdown, e.g. to save a snapshot on the server. */
export function toMarkdown(ydoc: Y.Doc): string {
  const node = yXmlFragmentToProseMirrorRootNode(ydoc.getXmlFragment("default"), schema)
  return serializeEditorMarkdown(tiptapToAst(node.toJSON() as PMNode))
}
```

The schema has StarterKit's nodes and marks — except `underline`, which is turned off because Markdown can't hold it — plus the GitBook ones.

## The exports

Every piece is exported from `@brett_lamy/docstream-editor`:

| Export | What it is |
| --- | --- |
| `createGitbookExtensions`, `GitbookExtensionOptions` | The full list, above. |
| `getGitbookSchema` | The schema, above. |
| `gitbookNodes` | The GitBook node extensions: `gbHint`, `gbTabs` / `gbTab`, `gbExpandable`, `gbStepper` / `gbStep`, `gbEmbed`, `gbContentRef`, `gbSourceRef`, `gbDemo`, `gbCommand`, `gbColumns` / `gbColumn`, `gbFigure`, `gbMath`, `gbUpdates` / `gbUpdate`, `gbOpenapi`, `gbInlineImage`, `gbReference`, `gbAttachment`, `gbDefinition`, `gbRaw`, `gbEmptyLink`. Most have React node views. |
| `GbCodeBlock`, `GbCommand`, `GbDemo`, `GbReference`, `GbAttachment` | Single nodes from that list, e.g. to `.extend()` one. |
| `GbCode`, `GbTable`, `GbLinkInner`, `GbMarkSpelling` | Inline code that combines with other marks; tables that keep `data-view` and column alignment; link and emphasis spelling for the round trip. |
| `GbDocumentProperties`, `DocumentPropertiesEditor` | The frontmatter as a doc attribute, and the properties panel `GitbookEditor` shows above the body. |
| `GbTaskItem` | Task items with docstream's task states and a `setTaskState` command. See [Properties and tasks](../02-editing/06-properties-and-tasks.md). |
| `SlashMenu`, `createSlashMenu`, `SLASH_ITEMS`, `SlashItem` | The `/` menu, and its default items to filter or extend. |
| `createReferenceSuggestion`, `resolveReferenceOptions` | The `@` / `#` / `$` pickers. |
| `SuggestionMenuView`, `createSuggestionRender` | The popup both menus use, for your own suggestion extensions. |
| `astToTiptap`, `tiptapToAst`, `serializeEditorMarkdown`, `markdownPasteContent` | The conversion. See [Conversion](../04-reference/02-conversion.md). |

## What GitbookEditor adds

The extensions give you the schema, the blocks and their node views. `GitbookEditor` adds the rest, and a hand-built editor has to bring its own:

- **Paste and drop.** Markdown paste (a copied docs page becomes blocks), image paste (inline or chips), the demo clipboard, `uploadFile` and `onDropEmbeds` all live in `GitbookEditor`'s `editorProps`. `markdownPasteContent(text)` turns plain-text Markdown into editor content for your own `handlePaste`.
- **The host runtime.** Node views read `sourceClient`, `pickFile`, `uploadFile`, `attachments`, `demoResolver`, `demoRuntime` and `liveRenderer` from a React context that `GitbookEditor` provides and the package doesn't export. In a hand-built editor, source refs show their header only, embeds and figures have no Choose / Upload buttons, chips have no store, and live code fences stay plain code. Asset resolution is the exception: wrap `EditorContent` in docstream's `AssetResolverProvider` (from `@brett_lamy/docstream/assets`) to give it a `resolveAsset`.
- **Controlled Markdown** (`markdown` / `onChange`), citation definitions carried across edits, attachment removal reports, the toolbar and the properties panel.

If you only need a different toolbar or an extra extension, stay with `GitbookEditor` and use `toolbar={false}`, `extensions`, and `onEditorReady` to get the instance.

## See also

{% content-ref url="../04-reference/02-conversion.md" %}
Conversion: Markdown ⇄ editor JSON
{% endcontent-ref %}

{% content-ref url="../04-reference/01-props.md" %}
Every GitbookEditor prop
{% endcontent-ref %}

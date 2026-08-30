# @brett_lamy/docstream-editor

TipTap editor components for Docstream GitBook-style markdown documents.

`@brett_lamy/docstream-editor` provides the editable layer for the same document model rendered by `@brett_lamy/docstream`. It is intended for docs apps that need rich editing while preserving GitBook-flavored markdown blocks for preview, storage, and AI stream rendering.

## Features

- Controlled React editor component for GitBook-style markdown.
- TipTap extensions for common writing flows.
- Conversion helpers between the Docstream AST and TipTap JSON.
- Slash menu for inserting supported blocks.
- Code block support through `lowlight`.
- Table, task list, heading, quote, and inline formatting support.
- Preserves Docstream/GitBook block semantics when converting back to markdown.
- Preserves mounted source-file/export provenance and can write edits to the real file through Vite.

## Installation

```sh
npm install @brett_lamy/docstream-editor @brett_lamy/docstream react
```

React is a peer dependency. `@brett_lamy/docstream` is a runtime dependency because the editor uses the same parser, serializer, OpenAPI rendering, and asset helpers.

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
}
```

- `markdown`: Source markdown to load into the editor.
- `onChange`: Called with serialized markdown whenever TipTap content changes.
- `onKeyDown` / `onPaste`: Optional host hooks that run before the built-in editor behavior;
  return `true` when the application handled the event.

The editor tracks the last markdown it emitted so normal controlled updates do not continuously reset the TipTap document. Passing a different external `markdown` value replaces the editor content.

## Supported Editing Surface

The editor supports common ProseMirror/TipTap content plus GitBook-flavored blocks from Docstream.

- Headings
- Paragraphs
- Bold, italic, strike, inline code, and links
- Bullet, ordered, and task lists
- Blockquotes
- Code blocks
- Tables
- Hints
- Tabs
- Expandables
- Steppers
- Embeds
- Content references
- Component and Storybook source references
- Columns
- Figures and images
- OpenAPI operation placeholders

Some blocks are intentionally represented as structured nodes rather than fully bespoke editing controls. They are preserved through parse, edit, and serialize flows so the document can continue to round-trip as GitBook-style markdown.

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

This release ships TypeScript and TSX source through ESM exports:

```json
{
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "import": "./src/index.ts"
    },
    "./styles.css": "./src/styles.css"
  }
}
```

It is validated with Vite and modern TypeScript `moduleResolution: "Bundler"`. Plain Node.js, CommonJS, or tooling that does not transpile TypeScript in dependencies may need a future precompiled JS build.

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

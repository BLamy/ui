/* Documentation content — prose is rendered by docstream; interactive demos
   are wired in main.tsx via the page's `demo` field. */

export interface DocPage {
  id: string;
  title: string;
  markdown: string;
  demo?: 'playground' | 'readonly';
}

export const PAGES: DocPage[] = [
  {
    id: 'introduction',
    title: 'Introduction',
    markdown: `# docstream-editor

A rich GitBook-flavored markdown **editor** built on [Tiptap](https://tiptap.dev), paired with [@brett_lamy/docstream](https://www.npmjs.com/package/@brett_lamy/docstream) for parsing and serialization.

{% hint style="info" %}
The prose on this site is rendered by docstream; the playground pages embed the actual \`GitbookEditor\`. The pair round-trips the same GitBook markdown.
{% endhint %}

## What it does

- WYSIWYG editing of GitBook-style markdown: hints, tabs, expandables, steppers, columns, embeds, figures, math, updates, OpenAPI blocks, tables, and code blocks with syntax highlighting.
- **Round-tripping** — the editor state serializes back to GitBook markdown via docstream's AST (\`tiptapToAst\` then \`serializeMarkdown\`), so what you edit is what you commit.
- A built-in formatting toolbar and a "/" slash menu for inserting blocks.
- Composable internals for custom editors: \`createGitbookExtensions\`, \`getGitbookSchema\`, \`gitbookNodes\`, \`createSlashMenu\` — including Yjs collaboration support via \`disableHistory\` + \`extensions\`.
- \`ReactDemoEditor\`, a multi-file source editor paired with docstream's live React preview.

## Exports at a glance

| Export | Kind | Purpose |
| --- | --- | --- |
| \`GitbookEditor\` | component | Batteries-included editor. |
| \`ReactDemoEditor\` | component | Multi-file code editor + live React preview. |
| \`astToTiptap\` / \`tiptapToAst\` | functions | Convert between docstream AST and TipTap JSON. |
| \`createGitbookExtensions\` | function | The full TipTap extension set, configurable. |
| \`getGitbookSchema\` | function | The exact ProseMirror schema (for Yjs). |
| \`gitbookNodes\`, \`GbCodeBlock\`, \`GbTable\` | extensions | Individual node building blocks. |
| \`SlashMenu\`, \`createSlashMenu\`, \`SLASH_ITEMS\` | extension/helpers | The "/" insert menu. |
| \`PMNode\`, \`GitbookEditorProps\`, \`GitbookExtensionOptions\`, \`SlashItem\`, \`ReactDemoEditorProps\` | types | — |

## Installation

\`\`\`sh
npm install @brett_lamy/docstream-editor @brett_lamy/docstream react
\`\`\`

Tiptap packages are peer dependencies: \`@tiptap/core\`, \`@tiptap/react\`, \`@tiptap/starter-kit\`, \`@tiptap/extension-code-block-lowlight\`, \`@tiptap/extension-list\`, \`@tiptap/extension-placeholder\`, \`@tiptap/extension-table\`, \`@tiptap/pm\`, and \`@tiptap/suggestion\` (all ^3.26).
`,
  },
  {
    id: 'quick-start',
    title: 'Quick start',
    markdown: `# Quick start

Import both stylesheets (the editor mirrors docstream's read-only styles so what authors see is what readers get), then render \`GitbookEditor\`:

\`\`\`tsx
import { useState } from "react"
import { GitbookEditor } from "@brett_lamy/docstream-editor"
import "@brett_lamy/docstream/styles.css"
import "@brett_lamy/docstream-editor/styles.css"

export function Editor() {
  const [md, setMd] = useState("# Hello")
  return <GitbookEditor markdown={md} onChange={setMd} />
}
\`\`\`

When \`markdown\` is provided the editor is **controlled**: external changes to the prop reset the document, while the editor's own \`onChange\` echoes are ignored (it tracks the last markdown it emitted). Omit \`markdown\` for an uncontrolled editor.

{% hint style="success" %}
Try it live on the **Playground** page — the right pane shows the serialized markdown on every keystroke.
{% endhint %}
`,
  },
  {
    id: 'editor-api',
    title: 'GitbookEditor API',
    markdown: `# GitbookEditor API

The complete prop reference for the batteries-included editor component.

| Prop | Type | Default | Purpose |
| --- | --- | --- | --- |
| \`markdown\` | \`string\` | — | Markdown source. When provided, the editor stays in sync with it (controlled). |
| \`onChange\` | \`(md: string) => void\` | — | Called with serialized GitBook markdown on every edit. |
| \`toolbar\` | \`boolean\` | \`true\` | Show the built-in formatting toolbar (bold, italic, strike, inline code, link). |
| \`slashMenu\` | \`boolean \\| { items?: SlashItem[] }\` | \`true\` | The "/" insert menu: on, off, or a custom item list. |
| \`editable\` | \`boolean\` | \`true\` | Read-only mode when false. |
| \`placeholder\` | \`string\` | \`"Write, or type / to insert a block…"\` | Placeholder shown in an empty document. |
| \`className\` | \`string\` | — | Appended to the \`gb\` wrapper class. |
| \`autofocus\` | \`boolean\` | \`false\` | Focus the editor on mount. |
| \`disableHistory\` | \`boolean\` | \`false\` | Disable StarterKit's undo/redo — required with Yjs Collaboration, which manages shared history itself. |
| \`extensions\` | \`AnyExtension[]\` | — | Extra TipTap extensions appended last (e.g. \`Collaboration\`, \`CollaborationCursor\`). |
| \`onEditorReady\` | \`(editor: TiptapEditor \\| null) => void\` | — | Receive the underlying TipTap editor instance (and \`null\` on teardown) for commands, awareness, etc. |

## Controlled sync semantics

The component tracks the last markdown it emitted through \`onChange\`. When the \`markdown\` prop changes to something else (e.g. the host switched files), the content is reset via \`setContent\` without emitting an update; when the prop merely echoes the editor's own output, nothing happens. This avoids caret jumps and infinite loops in the common state-lift pattern.

{% code title="GitbookEditor, toolbar={false}" live="true" %}
\`\`\`jsx
// demo:editor-basic
<GitbookEditor markdown={md} onChange={setMd} toolbar={false} />
\`\`\`
{% endcode %}

The serialized markdown below the editor updates on every edit.

## Yjs collaboration

\`\`\`tsx
import Collaboration from "@tiptap/extension-collaboration"

<GitbookEditor
  disableHistory
  extensions={[Collaboration.configure({ document: ydoc })]}
  onEditorReady={(editor) => { /* wire awareness */ }}
/>
\`\`\`

For deeper integrations (y-prosemirror without the component), see **Extensions & composition** — \`getGitbookSchema()\` returns the exact ProseMirror schema the editor uses.
`,
  },
  {
    id: 'playground',
    title: 'Playground',
    demo: 'playground',
    markdown: `# Playground

The real \`GitbookEditor\`, live. Type below — try the toolbar, or press \`/\` for the slash menu (hints, tables, code blocks…). The right pane shows the GitBook markdown the editor serializes on every edit.
`,
  },
  {
    id: 'playground-readonly',
    title: 'Read-only variant',
    demo: 'readonly',
    markdown: `# Read-only variant

The same component with \`toolbar={false}\` and \`editable={false}\` — useful for previews and review surfaces where the document should look exactly like the editing experience but not accept input:

\`\`\`tsx
<GitbookEditor markdown={md} toolbar={false} editable={false} />
\`\`\`

{% code title="Read-only GitbookEditor" live="true" %}
\`\`\`jsx
// demo:editor-readonly
<GitbookEditor markdown={md} toolbar={false} editable={false} />
\`\`\`
{% endcode %}
`,
  },
  {
    id: 'slash-menu',
    title: 'Slash menu',
    markdown: `# Slash menu

Typing \`/\` in the editor opens the block-insert menu, filtered as you type (matching titles and keywords), navigable with arrow keys and Enter, and repositioned to stay in the viewport.

## Default items (SLASH_ITEMS)

| Item | Keywords | Inserts |
| --- | --- | --- |
| Heading 1 / 2 / 3 | h1 title / h2 section / h3 subsection | Sets the heading level. |
| Bullet list | ul unordered | Toggles a bullet list. |
| Numbered list | ol ordered | Toggles an ordered list. |
| Task list | todo checkbox | Toggles a task list. |
| Quote | blockquote | Toggles a blockquote. |
| Divider | hr rule separator | Horizontal rule. |
| Code block | snippet pre | Toggles a code block. |
| Hint | callout info warning danger success admonition | \`gbHint\` (info style). |
| Tabs | tabbed switcher | \`gbTabs\` with two tabs. |
| Expandable | details accordion collapse | \`gbExpandable\`. |
| Stepper | steps guide step-by-step | \`gbStepper\` with two steps. |
| Embed | youtube video iframe url | \`gbEmbed\`. |
| Page link | content-ref reference | \`gbContentRef\`. |
| Columns | two column layout | \`gbColumns\` with two columns. |
| Image | figure picture photo | \`gbFigure\`. |
| Math | tex latex formula equation | \`gbMath\` (seeded with \`e = mc^2\`). |
| Table | grid cells | 2×2 table with header row. |
| Updates | changelog release notes | \`gbUpdates\` with today's date. |
| OpenAPI operation | api swagger endpoint rest | \`gbOpenapi\`. |
| Mermaid diagram | chart graph flowchart | A \`mermaid\` code block. |

## Customizing

Each \`SlashItem\` is \`{ title, keywords, icon, run(editor) }\`. Pass a custom list through the \`slashMenu\` prop, or build the extension directly with \`createSlashMenu\`:

\`\`\`tsx
import { SLASH_ITEMS, createSlashMenu, type SlashItem } from "@brett_lamy/docstream-editor"
import { Sparkles } from "lucide-react"

const items: SlashItem[] = [
  ...SLASH_ITEMS.filter((i) => i.title !== "OpenAPI operation"),
  {
    title: "AI summary",
    keywords: "ai generate summarize",
    icon: Sparkles,
    run: (editor) => editor.chain().focus().insertContent("Summary: ").run(),
  },
]

// Option 1: through the component
<GitbookEditor slashMenu={{ items }} />

// Option 2: as a raw extension for a custom useEditor()
const SlashMenuExt = createSlashMenu(items)
\`\`\`

\`SlashMenu\` (the default instance, \`createSlashMenu()\`) is also exported. On selection the menu deletes the "/query" range and calls the item's \`run\` with the editor.

## Try it

Click into the editor below and press \`/\`:

{% code title="Slash menu playground" live="true" %}
\`\`\`jsx
// demo:editor-slash
<GitbookEditor markdown="" toolbar={false} autofocus />
\`\`\`
{% endcode %}
`,
  },
  {
    id: 'extensions',
    title: 'Extensions & composition',
    markdown: `# Extensions & composition

Skip \`GitbookEditor\` and compose the parts when you need a custom \`useEditor()\` — collaboration, custom menus, extra marks.

## createGitbookExtensions(options?)

Returns the full TipTap extension list the editor uses: StarterKit (with its code block disabled), \`GbCodeBlock\`, task lists, \`GbTable\` + row/header/cell, \`Placeholder\`, all GitBook nodes, the slash menu, then your extras.

\`GitbookExtensionOptions\`:

| Field | Type | Default | Purpose |
| --- | --- | --- | --- |
| \`placeholder\` | \`string\` | \`"Write, or type / to insert a block…"\` | Empty-document placeholder. |
| \`slashMenu\` | \`boolean \\| { items?: SlashItem[] }\` | \`true\` | Built-in "/" menu, off, or custom items. |
| \`disableHistory\` | \`boolean\` | \`false\` | Turn off StarterKit undo/redo (required for Yjs). |
| \`extensions\` | \`AnyExtension[]\` | \`[]\` | Extra TipTap extensions appended last. |

\`\`\`tsx
import { useEditor, EditorContent } from "@tiptap/react"
import Collaboration from "@tiptap/extension-collaboration"
import { createGitbookExtensions, astToTiptap } from "@brett_lamy/docstream-editor"
import { parseMarkdown } from "@brett_lamy/docstream/gitbook"

const editor = useEditor({
  extensions: createGitbookExtensions({
    disableHistory: true,
    extensions: [Collaboration.configure({ document: ydoc })],
  }),
  content: astToTiptap(parseMarkdown(initialMarkdown)),
})

return <div className="gb"><EditorContent editor={editor} className="gb-content" /></div>
\`\`\`

## getGitbookSchema()

Returns the ProseMirror \`Schema\` for GitBook documents — identical to what \`GitbookEditor\` uses (built from \`createGitbookExtensions({ slashMenu: false })\`). Hosts wiring y-prosemirror need this exact schema to convert between a \`Y.XmlFragment\` and ProseMirror/markdown safely.

## gitbookNodes

The array of GitBook node extensions with React node views: \`GbHint\`, \`GbTabs\`/\`GbTab\`, \`GbExpandable\`, \`GbStepper\`/\`GbStep\`, \`GbEmbed\`, \`GbContentRef\`, \`GbColumns\`/\`GbColumn\`, \`GbFigure\`, \`GbMath\`, \`GbUpdates\`/\`GbUpdate\`, \`GbOpenapi\`, and \`GbInlineImage\`.

## GbCodeBlock

\`CodeBlockLowlight\` extended with GitBook code attributes — \`title\`, \`lineNumbers\`, \`live\`, \`entry\` — plus a React node view with a language selector, and configured with lowlight's common grammar set. These attributes round-trip to GitBook code tags in markdown.

## GbTable

TipTap's \`Table\` extended with a \`view\` attribute so GitBook's \`data-view\` (e.g. \`"cards"\`) survives editing untouched.
`,
  },
  {
    id: 'conversion',
    title: 'Conversion (how it works)',
    markdown: `# Conversion — how it works

## markdown ⇄ editor round trip

\`\`\`mermaid
graph LR
  MD[GitBook markdown] -->|parseMarkdown| AST[docstream AST]
  AST -->|astToTiptap| PM[Tiptap/ProseMirror doc]
  PM -->|edits| PM
  PM -->|tiptapToAst| AST2[docstream AST]
  AST2 -->|serializeMarkdown| MD2[GitBook markdown]
\`\`\`

\`convert.ts\` owns both directions. Because both ends share docstream's parser and serializer, the editor never invents syntax the renderer can't display.

## astToTiptap(doc)

Takes a docstream \`DocumentNode\` and returns TipTap JSON (\`PMNode\`). Mappings worth knowing:

- Inline marks map 1:1 (\`bold\`, \`italic\`, \`strike\`, \`code\`, \`link\`); inline images become \`gbInlineImage\` atoms.
- GitBook blocks map to \`gb*\` nodes: hint→\`gbHint\`, tabs→\`gbTabs\`/\`gbTab\`, expandable→\`gbExpandable\`, stepper→\`gbStepper\`/\`gbStep\`, embed→\`gbEmbed\`, content-ref→\`gbContentRef\` (label flattened via \`plainText\`), columns→\`gbColumns\`/\`gbColumn\`, figure→\`gbFigure\`, math→\`gbMath\`, updates→\`gbUpdates\`/\`gbUpdate\`, openapi-operation→\`gbOpenapi\`.
- Code blocks carry \`language\`, \`title\`, \`lineNumbers\`, \`live\`, \`entry\` as node attrs.
- Lists become \`bulletList\` / \`orderedList\` / \`taskList\`; tables become header row + body rows.
- Empty GitBook containers get a placeholder paragraph (ProseMirror containers require block content); an empty document becomes a single empty paragraph.

## tiptapToAst(doc)

The inverse: maps editor JSON back onto docstream's block AST. Empty paragraphs are dropped (markdown has no representation for them), table cells flatten their first paragraph to inline content, and unknown node types are skipped. Feed the result to \`serializeMarkdown\` for the final markdown.

\`\`\`ts
import { astToTiptap, tiptapToAst, type PMNode } from "@brett_lamy/docstream-editor"
import { parseMarkdown, serializeMarkdown } from "@brett_lamy/docstream/gitbook"

const pm = astToTiptap(parseMarkdown(md))       // -> editor content
const md2 = serializeMarkdown(tiptapToAst(pm))   // -> markdown again
\`\`\`

## PMNode

The loosely-typed TipTap/ProseMirror JSON shape used throughout:

\`\`\`ts
interface PMNode {
  type: string
  attrs?: Record<string, unknown>
  content?: PMNode[]
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>
  text?: string
}
\`\`\`
`,
  },
  {
    id: 'react-demo-editor',
    title: 'ReactDemoEditor',
    markdown: `# ReactDemoEditor

A small multi-file source editor paired with docstream's live React preview (\`ReactCodePreview\`). It shows a file list, a textarea editor for the selected file, and a **Run demo** button that boots the current draft in almost-node's Vite server.

{% hint style="warning" %}
The preview side requires the \`@agent-wasm/core\` peer (almost-node), same as docstream's live demos — the source-editing UI itself has no extra runtime requirements. This docs site excludes that runtime, so there is no live instance here.
{% endhint %}

| Prop | Type | Default | Purpose |
| --- | --- | --- | --- |
| \`files\` | \`Record<string, string>\` | — | Source files keyed by project-relative or absolute paths (required). |
| \`entry\` | \`string\` | \`"/src/main.jsx"\` | Vite entry file for the preview. |
| \`height\` | \`number \\| string\` | \`320\` | Preview height after the user runs the demo. |
| \`onChange\` | \`(files: Record<string, string>) => void\` | — | Called whenever a file is edited. |
| \`className\` | \`string\` | — | Appended to \`gb-react-demo-editor\`. |

\`\`\`tsx
import { ReactDemoEditor } from "@brett_lamy/docstream-editor"

<ReactDemoEditor
  files={{
    "/src/main.jsx": mainSource,
    "/src/App.jsx": appSource,
  }}
  entry="/src/main.jsx"
  height={360}
  onChange={(files) => save(files)}
/>
\`\`\`

Behavior notes: edits are kept as a local draft; the preview only updates when the user presses Run (each run remounts the preview with the drafted files). When the \`files\` prop changes, the draft resets and the selection falls back to the first file if the selected path disappeared.
`,
  },
  {
    id: 'theming',
    title: 'Theming',
    markdown: `# Theming

The editor stylesheet (\`@brett_lamy/docstream-editor/styles.css\`) follows the same token contract as docstream's renderer: every token on the \`.gb\` wrapper is declared as \`var(--host-token, default)\`, so the editor derives its chrome from shadcn-style host variables when present and falls back to neutral values otherwise — zero-setup light/dark adaptation. Only broadly-supported CSS is used (no \`oklch()\` or \`color-mix()\`).

## Tokens

| Editor token | Reads host token | Built-in default |
| --- | --- | --- |
| \`--gb-panel\` | \`--card\` | \`#ffffff\` |
| \`--gb-muted\` | \`--muted\` | \`#f4f4f5\` |
| \`--gb-muted-foreground\` | \`--muted-foreground\` | \`#6b7280\` |
| \`--gb-border\` | \`--border\` | \`#e5e7eb\` |
| \`--gb-accent\` | \`--accent\` | \`#f4f4f5\` |
| \`--gb-accent-foreground\` | \`--accent-foreground\` | \`#18181b\` |
| \`--gb-primary\` | \`--primary\` | \`#2563eb\` |
| \`--gb-text\` | \`--foreground\` | \`#111827\` |
| \`--gb-bg\` | \`--background\` | \`#ffffff\` |
| \`--gb-code-bg\` | — | \`rgba(128, 128, 128, 0.13)\` |
| \`--gb-code-fg\` | \`--foreground\` | \`#111827\` |
| \`--gb-radius\` | — | \`12px\` |

### Semantic hint palette

Identical to docstream's renderer palette, so authored hints look the same in the editor and in published docs:

| Token | Default | Companion tokens |
| --- | --- | --- |
| \`--gb-info\` | \`#3b82f6\` | \`--gb-info-border\` (45% tint), \`--gb-info-bg\` (10% tint) |
| \`--gb-success\` | \`#22c55e\` | \`--gb-success-border\` (45%), \`--gb-success-bg\` (10%) |
| \`--gb-warning\` | \`#f59e0b\` | \`--gb-warning-border\` (50%), \`--gb-warning-bg\` (12%) |
| \`--gb-danger\` | \`#ef4444\` | \`--gb-danger-border\` (45%), \`--gb-danger-bg\` (10%) |

## Overriding

Define the host tokens on \`:root\` and both the editor and the docstream renderer pick them up:

\`\`\`css
:root {
  --card: #0b0b10;
  --background: #0b0b10;
  --foreground: #e6e6f0;
  --border: #26263a;
  --muted: #17171f;
  --muted-foreground: #9a9ab0;
  --primary: #8b8bf0;
}
\`\`\`

To scope a theme to one editor instance, set the host tokens on a wrapper element around the \`.gb\` root — the \`var()\` fallbacks resolve against the nearest definition.

{% hint style="info" %}
Visual parity contract: every \`.gb-*\` block in the editor stylesheet mirrors its read-only twin in \`@brett_lamy/docstream/styles.css\` (\`.docs-*\`) — same radii, spacing, hint palette, and typography — so what authors see in the editor is what readers get from \`DocsRenderer\`.
{% endhint %}
`,
  },
];

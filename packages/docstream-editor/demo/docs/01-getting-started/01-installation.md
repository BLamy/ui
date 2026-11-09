---
description: Install the editor with its Tiptap and React peers, import both stylesheets, and opt into the extras (live code, source files) only when you need them.
---

# Installation

The editor is one package, `@brett_lamy/docstream-editor`. You install Tiptap and React yourself as peers, so your app keeps a single copy of each. docstream comes with it.

{% command %}npm install @brett_lamy/docstream-editor @tiptap/core @tiptap/extension-code @tiptap/extension-code-block @tiptap/extension-list @tiptap/extension-placeholder @tiptap/extension-table @tiptap/pm @tiptap/react @tiptap/starter-kit @tiptap/suggestion react react-dom{% endcommand %}

{% hint style="info" %}
The install runs no build or postinstall scripts, so `pnpm add` finishes without asking to approve any. The package ships compiled ES modules and `.d.ts` files, and needs no bundler configuration.
{% endhint %}

## Peer dependencies

Every Tiptap peer is `^3.26.1`. All of them are required: `createGitbookExtensions` imports each one.

| Peer | Range | What the editor uses it for |
| --- | --- | --- |
| `react`, `react-dom` | `>=18` | Everything that renders: the editor, its node views, its menus. |
| `@tiptap/core` | `^3.26.1` | `Node`, `Mark`, `Extension`, `getSchema`: the GitBook nodes and marks are built on it. |
| `@tiptap/react` | `^3.26.1` | `useEditor`, `EditorContent` and the React node views (`ReactNodeViewRenderer`). |
| `@tiptap/pm` | `^3.26.1` | ProseMirror: the schema, plugins, history (task-state changes close an undo step). |
| `@tiptap/starter-kit` | `^3.26.1` | Paragraphs, headings, lists, quotes, bold / italic / strike, links, undo / redo. Its code and code-block are switched off and replaced. |
| `@tiptap/extension-code` | `^3.26.1` | Base of `GbCode`, the inline-code mark that may combine with links and emphasis. |
| `@tiptap/extension-code-block` | `^3.26.1` | Base of `GbCodeBlock`: titles, line numbers, live fences, Mermaid, highlighting. |
| `@tiptap/extension-list` | `^3.26.1` | `TaskList` and the base of `GbTaskItem` (eight task states). |
| `@tiptap/extension-table` | `^3.26.1` | Tables; `GbTable` adds GitBook's `data-view` and GFM column alignment. |
| `@tiptap/extension-placeholder` | `^3.26.1` | The empty-document placeholder. |
| `@tiptap/suggestion` | `^3.26.1` | The `/` slash menu and the `@` / `#` / `$` reference pickers. |

### What installs with it

| Dependency | Version | Why |
| --- | --- | --- |
| `@brett_lamy/docstream` | `1.19.0` (exact) | The parser, the serializer, and every read-only piece the editor reuses: demo viewer, command box, Mermaid, KaTeX, OpenAPI, replays, 3D models, property sheet, task icons. |
| `gpu-lexer` | `0.0.2` | Code-block highlighting, language-agnostic, on WebGPU. Without WebGPU, blocks stay plain text. |
| `react-aria` | `^3.52.1` | `useClipboard`: copying and pasting demo blocks with their files. |
| `lucide-react` | `^1.17.0` | Toolbar, menu and block icons. |

docstream is pinned exactly, to the editor's own version. The editor converts docstream's AST node by node, so it is only correct against the docstream version it was built with. A test (`pins docstream to its own version`) fails the build if the two numbers ever differ. If your app also depends on docstream directly, use the same version so both resolve to one copy. See [With docstream](03-with-docstream.md).

## Import the stylesheets

Import both, once, at your app's entry, docstream's first:

```ts title="main.tsx" lineNumbers="false"
import "@brett_lamy/docstream/styles.css"
import "@brett_lamy/docstream-editor/styles.css"
```

- `@brett_lamy/docstream/styles.css` styles the renderer pieces that appear inside the editor: demo previews, command boxes, Mermaid and math cards, OpenAPI operations, replays.
- `@brett_lamy/docstream-editor/styles.css` styles the editor's own chrome: the `.gb` wrapper, toolbar, block node views, slash and reference menus, attachment chips. It already `@import`s docstream's property-sheet and task-checkbox styles.

Both read shadcn-style host tokens (`--card`, `--border`, `--primary`, …) and fall back to neutral defaults, so they need no setup and follow your theme if you have one. See [Theming](../04-reference/03-theming.md).

### TypeScript and CSS imports

If your type-check rejects side-effect CSS imports, add Vite's client types, or declare CSS modules yourself:

{% tabs %}
{% tab title="Vite" %}
```ts title="src/vite-env.d.ts"
/// <reference types="vite/client" />
```
{% endtab %}

{% tab title="Any bundler" %}
```ts title="src/css.d.ts"
declare module "*.css"
```
{% endtab %}
{% endtabs %}

## Optional extras

The editor itself never loads a code runtime, and never touches the file system. Two features are opt-in, and each needs something extra from the host:

{% tabs title="Opt-in features" level="3" %}
{% tab title="Live code and inline demos" %}
`live` jsx/tsx fences and `{% demo %}` blocks that carry their files inline run in almost-node, docstream's in-browser Vite. Install it and pass the renderers in:

{% command %}npm install @agent-wasm/core{% endcommand %}

```tsx title="Editor.tsx"
import { almostNodeLiveRenderer, createAlmostNodeDemoRuntime } from "@brett_lamy/docstream/playground"

const demoRuntime = createAlmostNodeDemoRuntime()

<GitbookEditor markdown={md} onChange={setMd} liveRenderer={almostNodeLiveRenderer} demoRuntime={demoRuntime} />
```

Without them, live fences are edited as plain code, and inline-file demos open on their Code view with a "needs runtime" note. A test (`never imports the almost-node playground`) checks every source and `dist/` file, so an app that never installs `@agent-wasm/core` still typechecks and bundles cleanly. See [Code, math and diagrams](../02-editing/04-code-math-and-diagrams.md) and [Demo blocks](../03-files-and-demos/04-demo-blocks.md).
{% endtab %}

{% tab title="Source files" %}
`{% source-ref %}` blocks edit the real component or story file behind them. In development that goes through docstream's Vite plugin:

```ts title="vite.config.ts"
import { defineConfig } from "vite"
import { docstreamSources } from "@brett_lamy/docstream/vite"

export default defineConfig({
  plugins: [docstreamSources({ mounts: [{ name: "ui", root: "src/components" }] })],
})
```

```tsx title="Editor.tsx" lineNumbers="false"
<GitbookEditor markdown={md} onChange={setMd} sourceClient={createViteSourceClient()} />
```

`createViteSourceClient` comes from `@brett_lamy/docstream`. Any object with `read`, `write` and `importModule` works too: the playground on the home page uses an in-memory one. See [Source files](../03-files-and-demos/03-source-files.md).
{% endtab %}
{% endtabs %}

## Framework notes

{% tabs %}
{% tab title="Vite" %}
Nothing to configure. Vite pre-bundles the editor, including Tiptap's CommonJS dependencies such as `use-sync-external-store`, like any other dependency. You don't need `optimizeDeps` entries.

Monorepos that compile from source can resolve the `source` export condition (`./src/*.ts(x)`) instead of `dist/`: add `"source"` to `resolve.conditions` in Vite and to `customConditions` in TypeScript.
{% endtab %}

{% tab title="Next.js" %}
The editor is plain ESM, so it needs no `transpilePackages` entry. Its modules carry no `"use client"` directive, and the editor uses hooks and the DOM, so render it from a client component:

```tsx title="app/edit/editor.tsx"
"use client"

import { useState } from "react"
import { GitbookEditor } from "@brett_lamy/docstream-editor"

export function Editor({ initial }: { initial: string }) {
  const [markdown, setMarkdown] = useState(initial)
  return <GitbookEditor markdown={markdown} onChange={setMarkdown} />
}
```

Import both stylesheets from your root layout.
{% endtab %}

{% tab title="SSR" %}
On the server, Tiptap's `useEditor` doesn't create an editor (it turns `immediatelyRender` off when it detects SSR), so `GitbookEditor` renders nothing there and mounts after hydration. For a server-rendered view of the same page, render the Markdown with docstream's `MarkdownContent`. It looks the same (see [Editing and reading look the same](../README.md)).

The conversion helpers (`astToTiptap`, `tiptapToAst`, `serializeEditorMarkdown`, `markdownPasteContent`) are plain functions over JSON and run anywhere. Import them from `@brett_lamy/docstream-editor/convert`.
{% endtab %}
{% endtabs %}

## Entry points

| Import | What it is |
| --- | --- |
| `@brett_lamy/docstream-editor` | Everything: the editor, `SourceFileEditor`, `ReactDemoEditor`, extensions, conversion, clipboard helpers. |
| `@brett_lamy/docstream-editor/editor` | `GitbookEditor` and `embedBlockFor` (plus their types). |
| `@brett_lamy/docstream-editor/convert` | The Markdown ⇄ Tiptap conversion functions. |
| `@brett_lamy/docstream-editor/styles.css` | The editor stylesheet. |

The full export list is in [Props](../04-reference/01-props.md#every-export). Bundling details are in [Bundling and migration](../04-reference/04-bundling-and-migration.md).

## Next

{% content-ref url="02-quick-start.md" %}
Quick start: from an empty component to an editor with a live docstream preview
{% endcontent-ref %}

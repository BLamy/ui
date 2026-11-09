---
description: Props and behavior of every React component docstream exports — the renderers, page actions, code and task primitives, split cards, diagrams, thumbnails and references.
---

# Components

Every component here is exported from the package root; narrower entries are noted where they exist. Props are taken from the source — a prop not listed doesn't exist.

## Renderers

Three components render documents. All of them parse with `parseMarkdown` (or take a parsed doc) and render the same blocks through the same code path, so a page looks identical whichever you use.

| Component | Input | Wrapper | Use for |
| --- | --- | --- | --- |
| `MarkdownContent` | `markdown` string | `div[data-docstream]` | Static pages, Markdown embedded in your UI |
| `GitbookStreamdown` | `markdown` (or children) | `div[data-docstream]` with streaming attributes | AI answers that arrive in chunks |
| `DocsRenderer` | `doc: DocumentNode` | `article.docs-article` (max-width 760px, page padding) | Parse once / render many, programmatic ASTs, editors |

### `GitbookStreamdown`

```tsx lineNumbers="false"
import { GitbookStreamdown } from "@brett_lamy/docstream" // also /streamdown
```

Parses `markdown ?? children` on each change (memoized on the content and `isStreaming`). While streaming, it first trims a half-arrived trailing token (`trimPartialInlineToken`) so chips and tags never flash as text, and it hides page actions.

| Prop | Type | Default | Purpose |
| --- | --- | --- | --- |
| `markdown` | `string` | — | The Markdown so far. Wins over `children`. |
| `children` | `string` | — | Alternative way to pass the source. |
| `isStreaming` | `boolean` | `false` | Sets `data-streaming` on the wrapper, trims partial tokens, hides page actions. |
| `isAnimating` | `boolean` | follows `isStreaming` | Overrides `aria-busy` — for typewriter effects that outlast the stream. |
| `className` | `string` | — | Class on the wrapper div. |
| `liveRenderer` | `LivePreviewRenderer` | — | Runs `live="true"` jsx/tsx/react fences. Without it they render as code. |
| `sourceRenderer` | `SourceReferenceRenderer` | — | Renders `{% source-ref %}` blocks. Without it they render as a labeled placeholder. |
| …`DocRenderOptions` | | | See [shared options](#shared-render-options). |

{% hint style="info" %}
The `/playground` entry exports a `GitbookStreamdown` (alias of `PlaygroundStreamdown`) with the same props that defaults `liveRenderer` to `almostNodeLiveRenderer` and `demoRuntime` to almost-node. Explicit props or an outer runtime context still win. Requires `@agent-wasm/core`.
{% endhint %}

### `MarkdownContent`

Parses and renders a Markdown string — a plain `div[data-docstream]` with no article chrome, so it composes into any layout.

| Prop | Type | Default | Purpose |
| --- | --- | --- | --- |
| `markdown` | `string` | — | Required. |
| `className` | `string` | — | Extra class on the wrapper. Also the hook for [per-document `--gb-*` tokens](01-theming.md#overriding). |
| `liveRenderer` | `LivePreviewRenderer` | — | As above. |
| `sourceRenderer` | `SourceReferenceRenderer` | — | As above. |
| …`DocRenderOptions` | | | See [shared options](#shared-render-options). |

### `DocsRenderer`

Renders an already-parsed `DocumentNode` as `<article class="docs-article">`.

```tsx
import { DocsRenderer, parseMarkdown } from "@brett_lamy/docstream"

const doc = parseMarkdown(source)
<DocsRenderer doc={doc} pageActions />
```

| Prop | Type | Default | Purpose |
| --- | --- | --- | --- |
| `doc` | `DocumentNode` | — | Required. |
| `markdown` | `string` | `serializeMarkdown(doc)` | Source for page actions. Serialized lazily, only when an action runs. |
| `liveRenderer` | `LivePreviewRenderer` | — | As above. |
| `sourceRenderer` | `SourceReferenceRenderer` | — | As above. |
| …`DocRenderOptions` | | | See below. |

### Shared render options

`DocRenderOptions` is accepted by all three renderers. The demo options are provided through context, so nested renderers (an OpenAPI description, a hint inside a tab) inherit them.

| Option | Type | Default | Purpose |
| --- | --- | --- | --- |
| `demoResolver` | `DemoResolver` | — | Resolves `{% demo src %}` to a folder's component, files and `meta.json`. See [Demos](../04-interactive/01-demos.md). |
| `demoRuntime` | `InlineDemoRuntime` | — | Runs inline-file demos no resolver knows (`createAlmostNodeDemoRuntime()` from `/playground`). Without it they open on their Code view with a note. |
| `demoDependencies` | `Record<string, string>` | — | Extra npm packages inline demos may import. Merged over inherited ones. |
| `demoVFS` | `DemoVFS` | — | In-memory demo files by `src` (pasted demos). Used when no resolver knows `src`. |
| `pageActions` | `boolean \| DocPageActionsOptions` | — | Render **Copy page ▾** above the content. |
| `documentProperties` | `boolean \| { defaultOpen?: boolean }` | `true` | Show YAML frontmatter as a collapsed property sheet; `false` hides it. |
| `onTaskStateChange` | `(item: ListItemNode, state: TaskState) => void` | — | Makes task checkboxes interactive. Update the item and re-render to persist. |

<details>
<summary>The renderer callback types</summary>

```ts
interface LivePreviewProps {
  files: Record<string, string> // { [entry]: code }
  entry: string                 // the fence's entry, default "/src/main.jsx"
  title: string                 // the fence's title, default "Live React preview"
  collapsedCodeLines?: number
  expandedCodeLines?: number
}
type LivePreviewRenderer = (props: LivePreviewProps) => ReactNode
type SourceReferenceRenderer = (reference: SourceRefNode) => ReactNode
```

A typical `sourceRenderer` is `(ref) => <SourcePreview reference={ref} client={client} />` — see [Vite plugin](05-vite-plugin.md).

</details>

## Editable properties and tasks

{% demo src="ref-components/editable" %}

### `DocumentProperties`

```tsx lineNumbers="false"
import { DocumentProperties } from "@brett_lamy/docstream" // also /properties (+ /properties/styles.css)
```

The property sheet the renderers show for frontmatter — a collapsible `<details>` with a count. With `onChange` it becomes an editor: text, number and boolean fields, a YAML textarea for lists and maps, add and remove buttons. Edits go through `setDocumentProperty` / `removeDocumentProperty`, so comments, key order and quoting survive. Invalid YAML shows the parse error (and, when editable, a raw YAML textarea).

| Prop | Type | Default | Purpose |
| --- | --- | --- | --- |
| `properties` | `DocumentPropertiesNode` | — | Required — `doc.properties`. |
| `onChange` | `(properties: DocumentPropertiesNode) => void` | — | Omit for read-only. |
| `defaultOpen` | `boolean` | `false` | Start expanded. |
| `className` | `string` | — | Appended to `docs-document-properties`. |

### `TaskCheckbox`

```tsx lineNumbers="false"
import { TaskCheckbox, TASK_STATE_ICONS } from "@brett_lamy/docstream" // also /tasks (+ /tasks/styles.css)
```

An accessible eight-state checkbox. A normal click clears any marked state, and on a pending box sets `verified`; right-click or Shift+F10 opens a keyboard-navigable state menu (arrows, Home/End, Escape). Hover or focus shows the state's label. Without `onChange` it is read-only.

| Prop | Type | Default | Purpose |
| --- | --- | --- | --- |
| `state` | `TaskState` | — | Required. |
| `onChange` | `(state: TaskState) => void` | — | Makes it interactive. |
| `label` | `string` | `"Task"` | Accessible name prefix (`"Ship it: In progress"`). |
| `className` | `string` | — | Appended to `docs-task-control`. |

`TASK_STATE_ICONS` maps each `TaskState` to its lucide icon component. The task and property styles read shadcn host tokens directly (`--primary`, `--destructive`, `--popover`, …).

## Primitives

{% demo src="ref-components/primitives" %}

### `CollapsibleCode`

The line-numbered panel under single-file demos: a few lines, then **View Code** to expand.

| Prop | Type | Default | Purpose |
| --- | --- | --- | --- |
| `code` | `string` | — | Required. |
| `language` | `string \| null` | — | Required (may be `null`). |
| `collapsedLines` | `number` | `3` | Lines visible collapsed. No toggle when the code is shorter. |
| `expandedLines` | `number` | `30` | Lines visible expanded before the panel scrolls. |
| `copy` | `boolean` | `true` | Show a copy button in the corner. |
| `copyLabel` | `string` | `"Copy code"` | The copy button's label. |

### `CopyButton` and `copyText`

| Prop | Type | Default | Purpose |
| --- | --- | --- | --- |
| `text` | `string \| (() => string \| Promise<string>)` | — | What to copy. A function is called on click — use it for text that's expensive or still being produced. |
| `label` | `string` | `"Copy code"` | `aria-label` and tooltip. |
| `className` | `string` | — | Appended to `docs-copy`. |

The icon swaps to a tick for 1.6 s. `copyText(text): Promise<void>` is the function behind it: the Clipboard API, falling back to a selection copy where it's unavailable. For lazy text the button hands the clipboard a pending `ClipboardItem` synchronously, so Safari keeps the click's user activation.

### Synced tabs

`useSyncedTab(key)`, `getSyncedTab(key)` and `setSyncedTab(key, title)` are the store behind `{% tabs sync="key" %}` and `{% command %}` (key `"pm"`). The choice is matched by tab title, persisted in `localStorage` under `docstream:tabs:<key>`, and synced across tabs of the browser via the `storage` event.

```tsx
const [manager, setManager] = useSyncedTab("pm") // e.g. "pnpm", null until chosen
```

### `SplitCard`, `SplitSource`, `SplitResult`

The source-and-result card used by Mermaid and math blocks: source left with a copy button, result right; side by side when the card is at least 640px wide, stacked below that (a container query, so it follows the card, not the window).

| Component | Props |
| --- | --- |
| `SplitCard` | `children`, `className?`, any `data-*` attributes |
| `SplitSource` | `label: string`, `code: string`, `language: string` |
| `SplitResult` | `label: string`, `children`, `action?: ReactNode` (right side of its header), `className?` |

### `Mermaid`, `PeleDiagram`, `usePele`, `pelePlaygroundUrl`

`Mermaid` is what a ```` ```mermaid ```` fence renders: a `SplitCard` with the source and a `PeleDiagram`. Pele loads on first use, only for the diagram type in the code, and draws synchronously without a layout pass; the pane shows the render time and **Open in Playground**.

| Export | Signature |
| --- | --- |
| `Mermaid` | `({ code: string; collapsedCodeLines?: number; expandedCodeLines?: number })` — the line props are accepted for older documents and ignored. |
| `PeleDiagram` | `({ code: string; className?: string; children?: ReactNode })` — the drawing pane alone, for hosts that show the source themselves. |
| `usePele` | `(code: string, host: RefObject<HTMLElement \| null>) => PeleDrawing \| null` — `{ svg?, error?, ms? }`; null until drawn. Uses the host's width and font. |
| `pelePlaygroundUrl` | `(code: string) => string \| null` — null for sources too long for a URL. |

A diagram Pele can't draw shows Pele's error as text.

### `MathFormula`

`({ formula: string })` — a formula typeset by KaTeX, which loads on first use; until then the TeX shows in its place. `$$` blocks render it inside a `SplitCard` with the LaTeX source.

## `ImageThumbnail`

An image whose Markdown title starts with `thumbnail` (`![Overview](shot.png "thumbnail: 0:39.8")`) renders as a small framed image with an optional badge; hovering or focusing it opens a card with the full image. First in a paragraph or list item, the text runs beside it; first in a step's heading, it takes a column of its own.

| Export | Signature |
| --- | --- |
| `ImageThumbnail` | `({ image: InlineImageNode; label: string })` — `label` is the badge (`""` for none). Resolves `src` through `useAsset`. |
| `thumbnailLabel` | `(node: Inline) => string \| null` — the badge, `""`, or `null` when the image isn't a thumbnail. |
| `leadingThumbnail` | `(nodes: Inline[]) => { image; label; rest } \| null` — a paragraph's leading thumbnail and the inlines after it. |

Size with `--docs-thumb-width` (168px) and `--docs-thumb-card-width` (720px).

## References and citations

```tsx
import { DocstreamRefContext, GitbookStreamdown } from "@brett_lamy/docstream" // also /reference

<DocstreamRefContext.Provider value={{
  onReferenceClick: (ref) => openPanel(ref.kind, ref.id),
  resolveCitationPreview: (c) => fetch(`/api/preview?url=${encodeURIComponent(c.url!)}`).then((r) => r.json()),
}}>
  <GitbookStreamdown markdown={answer} />
</DocstreamRefContext.Provider>
```

| `DocstreamRefContextValue` field | Type | Purpose |
| --- | --- | --- |
| `onReferenceClick` | `(ref: ReferenceNode) => void` | Mention, tag and codebase chip clicks (and citations without a URL). |
| `renderReference` | `(ref: ReferenceNode) => ReactNode \| null` | Replace chip rendering; return `null` for the default. |
| `resolveCitationPreview` | `(citation) => CitationPreview \| null \| Promise<…>` | Hovercard metadata (`title`, `description`, `image`, `siteName`, `favicon`), requested on first hover/focus and cached per URL per resolver. |

`InlineReference({ node })` renders one chip; `CitationSources({ citations })` renders the row of source-domain pills the renderers put at the end of a document with citations. See [References and citations](../06-ai/02-references-and-citations.md).

## Page actions — `DocPageActions`

A shadcn-style split button: **Copy page**, plus a menu with Copy as Markdown, View as Markdown, Open in ChatGPT and Open in Claude. The renderers place it for you with `pageActions`; render it yourself anywhere else. Copy and View produce renderable docstream Markdown: every `{% demo %}` keeps its tag, gains its `meta.json` defaults as attributes and carries its real files inline.

| Prop | Type | Default | Purpose |
| --- | --- | --- | --- |
| `markdown` | `string \| (() => string \| Promise<string>)` | — | Required. The page source, or a function producing it on demand. |
| `markdownUrl` | `string` | — | Public URL of the page as Markdown. View opens it, and the AI prompts reference it. Without it, View opens the resolved Markdown as a blob. |
| `pageUrl` | `string` | `location.href` | The URL the AI prompts reference when there's no `markdownUrl`. |
| `prompt` | `(url: string) => string` | `` `Read ${url}, I want to ask questions about it.` `` | The question handed to ChatGPT / Claude. |
| `actions` | `DocPageAction[]` | all four | Which entries, in order: `"copy" \| "view" \| "chatgpt" \| "claude"`. |
| `transform` | `(markdown: string) => string` | — | Final touch on the copied Markdown (a "Source:" footer…). |
| `demoOptions` | `ResolveDemosOptions` | `{ format: "inline" }` | `{ format: "plain" }` for prose + fences instead of renderable demos. |
| `resolver` | `DemoResolver` | from context | Overrides the context resolver. |
| `className` | `string` | — | Appended to `docs-page-actions`. |

See [Page actions](../06-ai/03-page-actions.md).

## Sources and assets

### `SourcePreview`

Imports and renders a component or Storybook CSF story from a source client. Stories merge `meta.args` with the story's `args` and render `story.render ?? meta.render ?? meta.component`.

| Prop | Type | Default | Purpose |
| --- | --- | --- | --- |
| `reference` | `SourceRefNode` | — | Required — the `{% source-ref %}` node. |
| `client` | `SourceReferenceClient` | — | Required — `createViteSourceClient()` or `createBundledSourceClient(…)`. |
| `className` | `string` | — | Appended to `docs-source-preview`. |
| `fallback` | `ReactNode` | `"Loading source…"` | Shown while importing. |
| `onError` | `(error: Error) => void` | — | Called when importing the module fails. |

See [Vite plugin](05-vite-plugin.md) and [Source files](../04-interactive/04-source-files.md).

### `AssetResolverProvider` and `useAsset`

```tsx
<AssetResolverProvider resolve={(url) => (url.startsWith("./") ? blobUrlFor(url) : null)}>
  <MarkdownContent markdown={markdown} />
</AssetResolverProvider>
```

`resolve: (url) => string | null | undefined | Promise<…>` maps a URL as written in the document to one to load; returning nothing falls back to `resolveAsset`. Images, figures, `.stl`, `.strudel` and `.rrweb` embeds use it. `useAsset(url)` gives the same answer in your own components (`undefined` while a promise is pending). See [Assets](../05-media/06-assets.md).

## Media and demo components

Documented with their features:

| Component | Page |
| --- | --- |
| `VideoEmbed` | [Embeds and video](../05-media/01-embeds-and-video.md) |
| `ReplayPreview` / `ReplayEmbed`, `ReplayFile`, `ReplayStage` | [Replays](../05-media/02-replays.md) |
| `StlViewer` | [3D models](../05-media/03-3d-models.md) |
| `StrudelPlayer`, `StrudelRack` | [Music](../05-media/04-music.md) |
| `OpenApiOperation` (`specUrl`, `path`, `method`) | [OpenAPI](../05-media/05-openapi.md) |
| `VizEmbed` | [Viz](../05-media/07-viz.md) |
| `DemoViewer`, `DemoFullscreen`, `DemoBlock`, `CopyDemoButton` | [Demos](../04-interactive/01-demos.md) |
| `ReactDemo` / `ReactCodePreview`, `InlineDemoPreview` | [Live code](../04-interactive/03-live-code.md) |

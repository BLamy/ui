# @brett_lamy/docstream

GitBook-aware markdown rendering for React applications and AI streaming surfaces.

`@brett_lamy/docstream` combines a small GitBook-flavored markdown parser with React renderers that can display docs blocks while a response is still streaming. It is designed for read-only documentation previews, AI answer panes, and apps that need GitBook-specific syntax without embedding a full editor.

## Features

- React renderer for GitBook-style markdown blocks.
- Streaming-friendly `GitbookStreamdown` component inspired by `vercel/streamdown`.
- Parser and serializer for round-tripping supported GitBook syntax.
- Syntax-highlighted code blocks through `lowlight`.
- GitBook block support for hints, tabs, expandables, steppers, embeds, content refs, columns, figures, tables, math, dividers, updates, and OpenAPI operations.
- CSS exported as a stable package entrypoint so host apps can theme with CSS variables or shadcn-style design tokens.
- Attribute-aware direct video embeds for muted, looping inline clips in long-form posts.
- Optional `VizEmbed` integration for mounting deterministic `@brett_lamy/viz-engine` scenes in a document.
- Vite source mounts for rendering and editing real component or Storybook files without copying implementations into Markdown.

## Installation

```sh
npm install @brett_lamy/docstream react
```

React is a peer dependency and must be provided by your app.

## Basic Setup

Import the package CSS once near your app entrypoint:

```ts
import "@brett_lamy/docstream/styles.css"
```

The stylesheet provides heading hierarchy and consistent spacing for the
`DocsRenderer`, `MarkdownContent`, and streaming render paths. Host CSS can
override those defaults through the normal cascade.

If your TypeScript app checks CSS side-effect imports, include Vite's standard environment declaration or an equivalent CSS module declaration:

```ts
/// <reference types="vite/client" />
```

## Render Streaming Markdown

Use `GitbookStreamdown` when markdown may arrive incrementally from an AI stream. The component accepts either `markdown` or string children.

Markdown-only applications can import the renderer from the `streamdown`
subpath. This keeps optional playground integrations out of the host bundle:

```tsx
import { GitbookStreamdown } from "@brett_lamy/docstream/streamdown"
```

```tsx
import { GitbookStreamdown } from "@brett_lamy/docstream"
import "@brett_lamy/docstream/styles.css"

export function Answer({ text, isStreaming }: { text: string; isStreaming: boolean }) {
  return (
    <GitbookStreamdown markdown={text} isStreaming={isStreaming} />
  )
}
```

`isStreaming` adds `aria-busy` and a `data-streaming` attribute to the wrapper. `isAnimating` is also accepted for compatibility with stream UI state.

## Render Parsed Documents

Use `parseMarkdown` and `DocsRenderer` when you want to parse once, inspect the AST, or serialize it later.

```tsx
import { DocsRenderer, parseMarkdown, serializeMarkdown } from "@brett_lamy/docstream"

const doc = parseMarkdown(markdown)
const roundTripped = serializeMarkdown(doc)

export function Preview() {
  return <DocsRenderer doc={doc} />
}
```

## Markdown Helper Component

`MarkdownContent` parses and renders a markdown string in one step:

```tsx
import { MarkdownContent } from "@brett_lamy/docstream"

export function Preview({ markdown }: { markdown: string }) {
  return <MarkdownContent markdown={markdown} />
}
```

## GitBook Syntax

The parser supports normal Markdown plus GitBook-style block tags.

### Hints

```md
{% hint style="info" %}
Helpful context for the reader.
{% endhint %}
```

Supported styles are `info`, `success`, `warning`, and `danger`.

### Tabs

````md
{% tabs %}
{% tab title="TypeScript" %}
```ts
export const ok = true
```
{% endtab %}
{% tab title="JSON" %}
```json
{ "ok": true }
```
{% endtab %}
{% endtabs %}
````

### Expandables

```md
{% expandable title="More details" %}
Hidden content goes here.
{% endexpandable %}
```

### Steppers

```md
{% stepper %}
{% step %}
Create a token.
{% endstep %}
{% step %}
Call the API.
{% endstep %}
{% endstepper %}
```

### OpenAPI Operations

```md
{% openapi-operation spec="petstore.yaml" path="/store/orders" method="get" /%}
```

When a spec cannot be resolved, the renderer displays a fallback asking for an OpenAPI spec URL.

### Inline video clips

Direct media embeds can opt into browser-safe inline playback. `muted` is
important when `autoplay` is enabled:

```md
{% embed url="/generated/example/clips/offsets.mp4"
  title="A reader resumes from its bookmark"
  autoplay="true" loop="true" muted="true" controls="false" %}
```

The attributes round-trip through `parseMarkdown` and `serializeMarkdown` and
are rendered as a native `<video playsInline>` element.

### VizEngine scenes

Install the optional peer dependency when a document needs a live, seekable
scene rather than a rendered clip:

```sh
npm install @brett_lamy/docstream @brett_lamy/viz-engine
```

```tsx
import { VizEmbed } from "@brett_lamy/docstream/viz"
import "@brett_lamy/docstream/styles.css"

<VizEmbed scene={scene} title="The same event, replayed into two projections" />
```

`VizEmbed` keeps the scene's timeline deterministic and delegates the clock to
VizEngine, so a reader can pause or scrub the same explanation used to produce
the short clip.

### File-backed components and stories

Markdown is the composition layer. Keep component and Storybook implementations
in normal source files, then mount their directory in Vite:

```ts
// vite.config.ts
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { docstreamSources } from "@brett_lamy/docstream/vite"

export default defineConfig({
  plugins: [
    react(),
    docstreamSources({
      mounts: [{ name: "ui", root: "src/components" }],
    }),
  ],
})
```

Reference a named component export or a CSF story from Markdown:

```md
{% source-ref mount="ui" path="Button.tsx" export="Button" kind="component" title="Button" %}

{% source-ref mount="ui" path="Button.stories.tsx" export="Primary" kind="story" title="Primary button" %}
```

Render references using the Vite client. The AST keeps `mount`, `path`,
`exportName`, and `kind`, so provenance survives parse/edit/serialize cycles:

```tsx
import { MarkdownContent, SourcePreview, createViteSourceClient } from "@brett_lamy/docstream"

const client = createViteSourceClient()

export function Guide({ markdown }: { markdown: string }) {
  return (
    <MarkdownContent
      markdown={markdown}
      sourceRenderer={(reference) => <SourcePreview reference={reference} client={client} />}
    />
  )
}
```

`client.read(reference)` returns the current file plus provenance.
`client.write(reference, content)` writes back to the mounted real file. The
plugin validates the mount boundary, only edits existing files, and notifies
Vite after a save so the preview reloads through Vite's normal module pipeline.
Set `writable: false` on a mount when a documentation site should only render.

The Vite endpoints exist only during development. For a deployed static site,
bundle the referenced modules and use the read-only production client:

```tsx
import { createBundledSourceClient } from "@brett_lamy/docstream"
import * as ButtonModule from "./components/Button"

const client = createBundledSourceClient({
  "ui:Button.tsx": ButtonModule,
})
```

Entries may also be lazy import functions. Keys can be `mount:path` (recommended)
or just `path` when names cannot collide.

### File-backed live demos

`{% demo %}` puts a live example into a page while the page stays **one Markdown
document**. The example is a folder of real files. The component renders in-page
(same React tree, lazily loaded near the viewport), and the Code view shows the
actual file contents.

```md
{% demo src="button/sizes" %}

{% demo src="blocks/inbox" title="Inbox" description="…" height="420" layout="auto" variants="full:Full,compact:Compact" viewport="tablet" %}
```

Only `src` (`<page>/<example>`) is required. `title`, `description`, `height`
and `variants` default to the folder's `meta.json`. `layout="auto"` (the default)
uses the **multi-file viewer** for two or more source files: Preview | Code,
desktop/tablet/phone widths, a draggable resize handle with a width readout,
variants, copy, a fullscreen overlay and an optional deep link. Code view has a
file tree (entry first) with a copy button per file. A single file gets the
**single-file card**: the preview with a collapsible code panel underneath.
`variant` is passed to the component as a prop. Frames are CSS size containers,
so a demo's `@container` queries respond to the preview width. The tag
round-trips through `parseMarkdown`/`serializeMarkdown`, and while streaming, a
half-arrived tag is hidden rather than shown as text.

```txt
examples/button/sizes/
  index.tsx     ← default export: ({ variant }) => …
  Sizes.css
  meta.json     ← { title, description, height, variants: [{ id, label }], entry, layout, bleed }
```

Tell docstream where demos live with a `DemoResolver`. With Vite, three
`import.meta.glob` maps are enough:

```tsx
import { MarkdownContent, createGlobDemoResolver, demoHref } from "@brett_lamy/docstream"

const demoResolver = createGlobDemoResolver({
  root: "./examples", // ids are <page>/<example> below this prefix
  modules: import.meta.glob("./examples/*/*/index.tsx"),
  sources: import.meta.glob("./examples/*/*/**/*.{ts,tsx,css,json}", { query: "?raw", import: "default" }),
  metas: import.meta.glob("./examples/*/*/meta.json", { eager: true, import: "default" }),
  href: (src) => demoHref(src), // optional "?demo=<src>" deep link → route it to <DemoFullscreen src={src} />
})

<MarkdownContent markdown={page} demoResolver={demoResolver} pageActions />
```

`demoResolver` is accepted by `DocsRenderer`, `MarkdownContent`,
`GitbookStreamdown` and the playground renderer, and it's provided through
`DocstreamDemoContext`, so nested renderers inherit it. You can also write a
resolver by hand:
`{ list?(), meta(src), files(src), load(src), href?(src, { variant }) }`.
`createGlobDemoResolver` is plain TypeScript, so it's exported from the package
root and from `@brett_lamy/docstream/demo`, not from the Node-only `./vite` entry.

### Page actions

`pageActions` renders a shadcn-style **Copy page ▾** above the content, with
Copy as Markdown, View as Markdown, Open in ChatGPT and Open in Claude. Pass
`true`, or pass options such as `{ markdownUrl, pageUrl, prompt, actions, transform }`.
You can also place `<DocPageActions markdown={page} />` yourself. Copying
resolves every `{% demo %}` into its real files as titled fences, so the copied
page is self-contained. The same resolution is available as a pure helper for
build-time `.md` or `llms.txt` generation:

```ts
import { resolveDemosToMarkdown } from "@brett_lamy/docstream/demo"

const md = await resolveDemosToMarkdown(page, demoResolver)
```

### Synced tabs (install instructions)

When every tab in a tab set is a single code block, the tabs render as one code
block, with pill tabs, a terminal glyph for shell code, and a copy button in its
header. Add `sync="<key>"` and every tab set with the same key follows the
reader's choice. The choice is matched by tab title and is remembered in
`localStorage` across the page and across visits:

````md
{% tabs sync="pm" %}
{% tab title="npm" %}
```sh
npm install @brett_lamy/docstream
```
{% endtab %}
{% tab title="pnpm" %}
```sh
pnpm add @brett_lamy/docstream
```
{% endtab %}
{% endtabs %}
````

Every code block now also has a copy button.

## Assets and OpenAPI Specs

Relative image and OpenAPI spec paths can be resolved against an asset base:

```ts
import { setAssetBase } from "@brett_lamy/docstream"

setAssetBase("/docs/assets/")
```

You can also resolve paths yourself with `resolveAsset`.

## API Reference

### Components

- `GitbookStreamdown`: Parses and renders markdown for read-only stream output.
- `DocsRenderer`: Renders a parsed `DocumentNode`.
- `MarkdownContent`: Parses and renders a markdown string.
- `OpenApiOperation`: Renders a parsed OpenAPI operation block.
- `SourcePreview`: Imports and renders a mounted component or CSF story export.
- `createViteSourceClient`: Reads, writes, and imports files exposed by the Vite plugin.
- `createBundledSourceClient`: Imports bundled source modules in read-only production builds.
- `DemoViewer` / `DemoFullscreen`: The `{% demo %}` viewer, and one demo filling the viewport (for `?demo=` deep links).
- `createGlobDemoResolver`, `demoHref`, `demoFromSearch`: Build a `DemoResolver` from `import.meta.glob` maps; deep-link helpers.
- `resolveDemosToMarkdown(markdown, resolver)`: Inlines each `{% demo %}` as its real files (pure, async).
- `DocPageActions`: The "Copy page ▾" menu.

### Parser and Serializer

- `parseMarkdown(markdown)`: Converts a full markdown document into a `DocumentNode`.
- `parseBlocks(markdown)`: Parses markdown into block nodes.
- `serializeMarkdown(doc)`: Converts a `DocumentNode` back to markdown.
- `serializeBlocks(blocks)`: Serializes block nodes.
- `parseInline(markdown)`: Parses inline markdown nodes.
- `serializeInline(nodes)`: Serializes inline nodes.
- `plainText(nodes)`: Extracts plain text from inline nodes.
- `refDefinitions(markdown)`: Reads reference-style link definitions.

### Types

All AST types are exported from the package root, including `DocumentNode`, `Block`, `Inline`, and `HintStyle`.

## Styling and Theming

The package CSS is intentionally token-driven. It uses normal CSS variables and class names so host apps can align the renderer with a shadcn-style theme.

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

Import the CSS once, then set tokens globally in your app. Components also expose stable classes such as `docs-code`, `docs-tabs`, `docs-hint`, `docs-table`, and `docs-openapi`.

Code highlighting follows the surrounding `color-scheme`: set `color-scheme: dark` on a dark page (or any dark container) and code switches to the dark palette. Each token color is a custom property (`--docs-tok-keyword`, `--docs-tok-string`, `--docs-tok-type`, `--docs-tok-function`, `--docs-tok-number`, `--docs-tok-constant`, `--docs-tok-operator`, `--docs-tok-comment`) if you want your own palette.

### Live demos with in-page components

`ReactDemo` from `@brett_lamy/docstream/playground` boots an almost-node Vite server for self-contained projects. When the components already run on your page, pass `preview` instead: you keep the same frame, header, and collapsible code panel without a runtime.

```tsx
import { ReactDemo } from "@brett_lamy/docstream/playground"

<ReactDemo
  title="Counter"
  status={false}
  preview={<Counter />}
  height="auto"
  code={`import { Counter } from "my-ui"\n\nexport default () => <Counter />`}
  language="tsx"
/>
```

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

## Related Package

Use `@brett_lamy/docstream-editor` when you need the editable TipTap experience for the same document model.

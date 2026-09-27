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

### Code fences

````md
```ts title="client.ts"
const client = createClient()
```
````

Titled (file) fences show line numbers; untitled fences don't. `lineNumbers="true"`
or `lineNumbers="false"` overrides either way, and an explicit attribute is kept on
serialize even when it matches the default.

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
  meta.json     ← { title, description, height, variants: [{ id, label }], entry, layout, bleed,
                    className, surface, status, variantsWidth }
```

`meta.height` is a minimum for single-file previews (in-page components may grow
past it; without a height they size to their content — hosts can set a floor with
`--docs-demo-preview-min-height`) and the stage height for the multi-file viewer.
`className` / `surface` (a style object, CSS custom properties welcome) style the
preview canvas, `bleed` drops its padding, `status` shows a small label in the
header ("Live", "Needs network"), and `variantsWidth` sizes the variant switch.
The canvas is block flow: block-level demo roots fill its width and lay out as on a
page (`max-width: 480px; margin: 0 auto` centres at 480px); intrinsically sized
(inline-level) ones — a button, a badge, an image — are centred.

Every `meta.json` field has a tag attribute of the same name:

```md
{% demo src="button/sizes" title="Sizes \"S\" to \"L\"" status="Live" bleed="true" className="brand"
  surface="background: var(--brand-50); --demo-gap: 12px" variantsWidth="220" %}
```

(one line in practice). `surface` is written as CSS declarations; `bleed="false"`
switches off a `meta.json` `bleed: true`. **Precedence:** a tag attribute wins,
then `meta.json`, then the built-in default — field by field. Copy page folds
`meta.json` into the tag, so the copied page renders the same without the resolver.

Attribute values are double-quoted; inside them a double quote is written `\"`, a
backslash `\\`, and `%}` as `%\}`. The serializer escapes, the parser unescapes
(other backslashes are kept as written).

#### Demos that carry their files (block form)

A `{% demo %}` can carry its files inline, one titled fence per file (entry
first, or `entry="App.tsx"`), closed by `{% enddemo %}`. A file that contains
fences gets a longer fence. This is what **Copy page** produces, so a copied page
renders back as the same page anywhere:

`````md
{% demo src="composer/scroll-fab" title="Scroll → FAB" height="380" variants="full:Full,compact:Compact" %}
```tsx title="index.tsx"
import { items } from "./data"
export default function ScrollFab({ variant }) { … }
```
```ts title="data.ts"
export const items = ["a", "b"]
```
````md title="README.md"
```sh
npm start
```
````
{% enddemo %}
`````

The self-closing tag (`{% demo … %}` or `{% demo … /%}`) keeps working. A tag
followed by a blank line and an ordinary code block (no `{% enddemo %}`) means
what it did before 1.2: a demo, then a code block. While streaming, a block whose
`{% enddemo %}` hasn't arrived is `open`: its code shows, its preview waits.

| The block has… | and there is… | Preview | Code view |
| --- | --- | --- | --- |
| `src` only | a resolver that knows `src` | the component, in-page | the resolver's files |
| inline files | a resolver that knows `src` (its `list()` includes it, and it loads) | the component, in-page | the resolver's files (they win) |
| inline files | no resolver, or one that doesn't know `src` | the files, run by the `demoRuntime` | the inline files |
| inline files | no runtime (e.g. the `/streamdown` entry) | a one-line note; the viewer opens on Code | the inline files |
| `src` only | no resolver | a placeholder chip | — |

The package root's `GitbookStreamdown` (`PlaygroundStreamdown`) runs inline demos
in almost-node by default. Elsewhere pass `demoRuntime`:

```tsx
import { createAlmostNodeDemoRuntime } from "@brett_lamy/docstream/playground"

const demoRuntime = createAlmostNodeDemoRuntime({ workspaceOptions: { basePath: "/docs" } })

<MarkdownContent markdown={page} demoResolver={demoResolver} demoRuntime={demoRuntime}
  demoDependencies={{ "@brett_lamy/ui": "^1.2.0" }} />
```

How it runs (`createInlineDemoProject`): the files go under `/src/demo/`; a tiny
wrapper entry imports the entry file's default export (or first exported
function) and renders it with `variant` from the iframe's `?variant=` query, so
switching variants reloads the iframe, not Vite. An entry that mounts itself
(`createRoot(…)`) is used directly and gets no `variant`. npm imports: `react`
and `react-dom` are provided; `demoDependencies` (or a `package.json` among the
files) declares others. Limits: almost-node resolves bare imports from esm.sh at
the declared major version, so packages must work as browser ESM there; CSS
imported from packages may not load (import the CSS file from the demo instead,
or inline it); each inline demo boots its own container (the fullscreen overlay
boots a second one). `preloadDemos(resolver, srcs)` settles resolver demos before
the first render (server rendering, static export).

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
You can also place `<DocPageActions markdown={page} />` yourself. Copy and View
give **renderable docstream Markdown**: every `{% demo %}` keeps its tag (with its
`meta.json` defaults folded in as attributes) and gains its files inline, and
everything else is returned byte-for-byte, so pasting the copy into docstream
renders the same page — with or without the resolver. Open in ChatGPT / Claude
send the page URL. The same resolution is a pure helper for build-time `.md` or
`llms.txt` generation; the plain form is only produced when you ask for it:

```ts
import { resolveDemosToMarkdown } from "@brett_lamy/docstream/demo"

const md = await resolveDemosToMarkdown(page, demoResolver) // renderable (default)
const prompt = await resolveDemosToMarkdown(page, demoResolver, { format: "plain" })
// plain: "**Example — Title**" + fences per demo, commands as npm `sh` fences,
// titled tab sets as a heading + a bold label per tab — for LLM prompts only.
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

Every code block has a copy button. Untitled blocks show just the code with the
button floating top-right; a header bar appears only when the block has a
`title` (file name).

### Installation sections and command boxes

`{% command %}` holds **one** npm / npx command. docstream derives the pnpm,
yarn and bun forms and shows them as tabs (pnpm first) with a terminal glyph and
a copy button; the reader's manager is synced page-wide and across visits (key
`pm`, shared with `{% tabs sync="pm" %}`). Derivations: `npm install|i x` → `pnpm
add x` / `yarn add x` / `bun add x` (`-D`, `-E`, `-O`, `-g` mapped), `npm install`
→ `<pm> install`, `npm uninstall x` → `<pm> remove x`, `npx x` / `npm exec x` →
`pnpm dlx x` / `yarn dlx x` / `bunx x`, `npm run s` → `pnpm s` / `yarn s` / `bun
run s`, `npm test|start` → `pnpm test` / `bun run test`, `npm create x` → `<pm>
create x`; other lines (comments, `cd`) are kept, `a && b` is converted per part.
Override a manager verbatim with `pnpm="…"`, `yarn="…"` or `bun="…"`; use another
sync group with `sync="…"`. Multi-line commands use the block form:

```md
{% command %}npm install @brett_lamy/ui{% endcommand %}

{% command bun="bun add -d vitest" %}
npm install -D vitest
npm run test -- --watch
{% endcommand %}
```

A tab set with a `title` renders as a section: the title is a real heading
(`h2`, or `level="3"`/`"4"`) with an anchor id, the tab switch sits as pill tabs
on the right of the heading row, and the active tab's blocks follow in the page
flow (no card around them). `documentOutline(doc)` lists these titles with the
page's headings for a table of contents.

`````md
{% tabs title="Installation" sync="install-method" %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts:

```tsx
import '@brett_lamy/ui/styles.css'
import { Composer } from '@brett_lamy/ui'
```
{% endtab %}

{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/composer.json{% endcommand %}
{% endtab %}
{% endtabs %}
`````

Both round-trip through `parseMarkdown`/`serializeMarkdown`, are kept as they are
by Copy page, and a half-streamed one-line `{% command %}` is held back until it
closes.

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
- `resolveDemosToMarkdown(markdown, resolver, { format })`: Gives each `{% demo %}` its real files inline — renderable docstream by default, `format: "plain"` for LLM prompts (pure, async).
- `inlineDemoMarkdown(node, files, meta)`: One demo as a pasteable block-form `{% demo %}`.
- `preloadDemos(resolver, srcs)`: Settle resolver demos before the first render (SSR, static export).
- `createAlmostNodeDemoRuntime(options)` / `InlineDemoPreview` / `createInlineDemoProject(files, { entry, dependencies })` (`/playground`): Run inline demo files in almost-node.
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
- `packageManagerCommands(npmCommand, overrides)`: The npm / pnpm / yarn / bun forms of a command.
- `documentOutline(doc)` / `slugify(text)`: Headings (incl. titled tab sets) with anchor ids, for a TOC.
- `flattenForPlainMarkdown(doc)`: docstream-only blocks (commands, titled tabs) as plain Markdown.

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

Import the CSS once, then set tokens globally in your app. The command box's
terminal glyph has its own tokens (`--gb-term-bg`, `--gb-term-fg`), so setting
panel colors to `currentColor` doesn't blank it. Components also expose stable classes such as `docs-code`, `docs-tabs`, `docs-hint`, `docs-table`, and `docs-openapi`.

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

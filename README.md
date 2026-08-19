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

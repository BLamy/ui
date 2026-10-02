# MarkdownView

Workbench chat replies and these docs use `@brett_lamy/docstream` through the package's `MarkdownView` adapter. Docstream provides GitBook-aware parsing, code highlighting, tables, hints, and streaming-aware markup.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/markdown-view.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import {
  MarkdownView, HlPre, DocstreamRefContext,
} from '@/components/ui/markdown-view'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import {
  MarkdownView, HlPre, DocstreamRefContext,
} from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

```tsx
import { MarkdownView } from '@brett_lamy/ui'

<MarkdownView markdown={answer} />
```

## Supported syntax

- Headings, paragraphs, emphasis, strong text, strike-through, links, and inline code
- Ordered and unordered lists
- Task lists, nested lists, mentions, tags, codebase references, and citations
- Block quotes and horizontal rules
- Tables and fenced code blocks with syntax highlighting
- GitBook blocks supported by Docstream, including hints, tabs, expandables, and embeds
- Package-manager commands, steppers, columns, figures, card tables, math, Mermaid diagrams, updates, OpenAPI operations, source references, and live demos

The `MarkdownView` wrapper keeps BL UI's `wb-md` styling and sets `data-renderer="docstream"`. Docstream renders structured React elements rather than injecting raw HTML.

## Streaming updates

Pass the latest accumulated markdown as chunks arrive. `streaming` is forwarded to Docstream as `isStreaming`, which exposes accessible busy state and a streaming data attribute while content is arriving.

```tsx
<MarkdownView markdown={partialAnswer} streaming={isStreaming} />
```

## Styling

Import `@brett_lamy/ui/styles.css`. Docstream's styles are included by the Workbench adapter. The rendered wrapper uses `data-slot="markdown-view"` and class `wb-md`; pass `className` or `style` for layout-specific adjustments.

## Live example

The demo feeds an answer in chunks so you can inspect partial and completed rendering:

{% demo src="docstream/streamed-reply" %}

## Examples

### Kitchen sink

Every Docstream block type in one document: all six heading levels, inline formatting and reference chips, nested and task lists, quotes, code, all four hints, synchronized tabs and package-manager commands, expandables, steppers, columns, tables and cards, images and captions, math, Mermaid, video and replay, content and file links, updates, an OpenAPI operation, component and story references, and live demos with inline files.

Switch between **Rendered** and **Editor**, inspect or edit the **Markdown source**, or **Stream example** to watch partial blocks arrive. Both component pages use this same sample. Images, the API spec, demos, and replay are bundled; the video requires a network connection. Optional sandboxed React and VizEngine integrations are shown with their setup syntax.

{% demo src="docstream/kitchen-sink" %}

`demoResolver` connects live demo blocks to their components and files. `sourceRenderer` renders component and Storybook references; the example uses Docstream's `SourcePreview` with a bundled source client.

### Chat replies

Render each assistant turn with `MarkdownView` and keep your own bubbles for user turns. Fenced code gets highlighting and lists keep their spacing.

{% demo src="docstream/chat-transcript" %}

### Release notes

GitBook hints, tables and quotes all come through Docstream, so product copy can live in markdown.

{% demo src="docstream/release-notes" %}

### Mentions and tags

`@mentions` and `#tags` render as chips, and so do footnote citations (`[^id]` with a `[^id]: url "Label"` definition). `onReferenceClick` hands you the clicked reference; `renderReference` replaces the chip entirely.

{% demo src="docstream/mentions-and-tags" %}

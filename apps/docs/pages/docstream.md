# MarkdownView

Workbench chat replies and these docs use `@brett_lamy/docstream` through the package's `MarkdownView` adapter. Docstream provides GitBook-aware parsing, code highlighting, tables, hints, and streaming-aware markup.

## Installation

{% tabs %}
{% tab title="npm" %}
```sh
npm install @brett_lamy/ui
```

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import {
  MarkdownView, HlPre, DocstreamRefContext,
} from '@brett_lamy/ui'
```
{% endtab %}
{% tab title="pnpm" %}
```sh
pnpm add @brett_lamy/ui
```

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import {
  MarkdownView, HlPre, DocstreamRefContext,
} from '@brett_lamy/ui'
```
{% endtab %}
{% tab title="yarn" %}
```sh
yarn add @brett_lamy/ui
```

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import {
  MarkdownView, HlPre, DocstreamRefContext,
} from '@brett_lamy/ui'
```
{% endtab %}
{% tab title="bun" %}
```sh
bun add @brett_lamy/ui
```

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import {
  MarkdownView, HlPre, DocstreamRefContext,
} from '@brett_lamy/ui'
```
{% endtab %}
{% tab title="shadcn CLI" %}
```sh
npx shadcn@latest add https://blamy.github.io/ui/r/markdown-view.json
```

Adds `@/components/ui/markdown-view.tsx`, installs `@brett_lamy/ui`, and wires its stylesheet and tokens into your CSS. Import from your alias:

```tsx
import {
  MarkdownView, HlPre, DocstreamRefContext,
} from '@/components/ui/markdown-view'
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
- Block quotes and horizontal rules
- Tables and fenced code blocks with syntax highlighting
- GitBook blocks supported by Docstream, including hints, tabs, expandables, and embeds

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

### Chat replies

Render each assistant turn with `MarkdownView` and keep your own bubbles for user turns. Fenced code gets highlighting and lists keep their spacing.

{% demo src="docstream/chat-transcript" %}

### Release notes

GitBook hints, tables and quotes all come through Docstream, so product copy can live in markdown.

{% demo src="docstream/release-notes" %}

### Mentions and tags

`@mentions` and `#tags` render as chips, and so do footnote citations (`[^id]` with a `[^id]: url "Label"` definition). `onReferenceClick` hands you the clicked reference; `renderReference` replaces the chip entirely.

{% demo src="docstream/mentions-and-tags" %}

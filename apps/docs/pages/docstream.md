# MarkdownView

`MarkdownView` renders Markdown you only read: an AI reply as it streams in, release notes, a pull-request body, a docs article. It is [Docstream](https://github.com/BLamy/docstream)'s GitBook-flavored renderer (these docs use it too) behind one small component, so a host never imports Docstream itself.

Use a sibling when the job differs:

- **The user writes the Markdown:** [MarkdownEditor](https://blamy.github.io/ui/#/markdown-editor), a rich, form-ready field. Toggle between the two for an edit / preview pair.
- **Source code, not prose:** [CodeEditor](https://blamy.github.io/ui/#/code-editor), editable or read-only, with gutters and a windowed renderer for big files.
- **A whole chat transcript:** [Conversation](https://blamy.github.io/ui/#/conversation), whose `MessageMarkdown` is a `MarkdownView` with the reply styling.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/markdown-view.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { MarkdownView } from '@/components/ui/markdown-view'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { MarkdownView } from '@brett_lamy/ui'
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
- Package-manager commands, steppers, columns, figures, card tables, math (TeX beside KaTeX), Mermaid diagrams (drawn by [Pele](https://pele.run), source beside the drawing), updates, OpenAPI operations, source references, and live demos

The `MarkdownView` wrapper keeps BL UI's `wb-md` styling and sets `data-renderer="docstream"`. Docstream renders structured React elements rather than injecting raw HTML.

## Streaming updates

Pass the latest accumulated markdown as chunks arrive. `streaming` is forwarded to Docstream as `isStreaming`, which exposes accessible busy state and a streaming data attribute while content is arriving.

```tsx
<MarkdownView markdown={partialAnswer} streaming={isStreaming} />
```

## Props

| Prop | Type | Default | Effect |
| --- | --- | --- | --- |
| `markdown` | `string` | `''` | The Markdown source. Pass the whole text each time; while streaming, the latest accumulated text. |
| `streaming` | `boolean` | `false` | The text is still arriving: an unfinished block stays open, the region is marked busy, and the root gets `data-streaming`. |
| `onReferenceClick` | `(ref: ReferenceNode) => void` | | Called when an @mention, #tag or citation chip is clicked. |
| `renderReference` | `(ref: ReferenceNode) => ReactNode \| null` | | Draw a chip yourself; return `null` for the default chip. |
| `demoResolver` | Docstream's resolver | | Resolves `{% demo %}` blocks to components and their source files. |
| `sourceRenderer` | Docstream's renderer | | Renders component and Storybook source references. |
| `tui` | Docstream's TUI options \| `false` | | Configures the sandboxed terminal behind `tui` code fences (see [TuiPreview](https://blamy.github.io/ui/#/tui-preview)); `false` renders them as code. |
| `ref`, `className`, `style`, … | `div` props | | Passed to the root `div`; `className` merges after `wb-md`. |

`ReferenceNode` (the chip's `kind`, `label`, `id` and `url`) is exported with the component.

## Styling

Import `@brett_lamy/ui/styles.css`; the component brings Docstream's stylesheet with it. The root is `<div data-slot="markdown-view" data-renderer="docstream" class="wb-md">`. `.wb-md` sets the reading rhythm (headings, lists, inline code, tables) from the theme's variables, and code fences take their colors from `--code`, `--code-foreground` and CodeEditor's `--bl-syntax-*` knobs, so a dark scope or a custom palette restyles them. Pass `className` for layout. Docstream's own sheet is not in a cascade layer yet, so to override one of its rules use a selector at least as specific as its own.

## Accessibility

The output is semantic HTML: real headings, lists, tables, links and `code` elements, no injected raw HTML. Chips are buttons named by their label. While `streaming`, Docstream marks the region `aria-busy`, so a screen reader reads the reply once it settles instead of every chunk.

## Live example

The demo feeds an answer in chunks so you can inspect partial and completed rendering:

{% demo src="docstream/streamed-reply" %}

## Examples

### Kitchen sink

Every Docstream block type in one document: all six heading levels, inline formatting and reference chips, nested and task lists, quotes, code, all four hints, synchronized tabs and package-manager commands, expandables, steppers, columns, tables and cards, images and captions, math, Mermaid, video and replay, content and file links, updates, an OpenAPI operation, component and story references, and live demos with inline files.

Use the **Markdown**, **Rich editor**, and **Preview** tabs inside the example to switch modes. The Markdown tab starts with source on the left and rendered output on the right; the Rich editor tab opens the block editor beside the preview. **Stream example** shows partial blocks arriving. Both component pages use this same sample. Images, the API spec, demos, and replay are bundled; the video requires a network connection. Optional sandboxed React and VizEngine integrations are shown with their setup syntax.

{% demo src="docstream/kitchen-sink" %}

`demoResolver` connects live demo blocks to their components and files. `sourceRenderer` renders component and Storybook references; the example uses Docstream's `SourcePreview` with a bundled source client.

### XState and tscircuit

Use an `xstate` fence for a JSON machine config or TypeScript `createMachine(...)` source. Docstream reads the machine structure and draws a statechart with Pele. Actions and guards are never executed. Initial states, nested states, event transitions, delayed transitions, and final states appear in the diagram.

Use a `tscircuit` fence for a TSX circuit such as `circuit.add(<board>...</board>)`. The source sits beside an isolated [tscircuit RunFrame](https://github.com/tscircuit/runframe) with schematic, PCB, and 3D views. The hosted circuit runtime requires a network connection. Plain `tsx` fences remain code examples.

{% demo src="docstream/diagrams" %}

### Chat replies

Render each assistant turn with `MarkdownView` and keep your own bubbles for user turns. Fenced code gets highlighting and lists keep their spacing.

{% demo src="docstream/chat-transcript" %}

### Release notes

GitBook hints, tables and quotes all come through Docstream, so product copy can live in markdown.

{% demo src="docstream/release-notes" %}

### Mentions and tags

`@mentions` and `#tags` render as chips, and so do footnote citations (`[^id]` with a `[^id]: url "Label"` definition). `onReferenceClick` hands you the clicked reference; `renderReference` replaces the chip entirely.

{% demo src="docstream/mentions-and-tags" %}

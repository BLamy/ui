/* Documentation content — rendered by docstream itself, so every GitBook block
   shown below is also a live demonstration of the renderer. */

export interface DocPage {
  id: string;
  title: string;
  markdown: string;
}

export const PAGES: DocPage[] = [
  {
    id: 'introduction',
    title: 'Introduction',
    markdown: `# docstream

GitBook-aware markdown rendering for React applications and AI streaming surfaces.

\`@brett_lamy/docstream\` combines a small GitBook-flavored markdown parser with React renderers that can display docs blocks while a response is still streaming. It is designed for read-only documentation previews, AI answer panes, and apps that need GitBook-specific syntax without embedding a full editor.

{% hint style="info" %}
Everything on this site is rendered by docstream itself — the sidebar, this hint, the tabs and math on the syntax page. The site is its own test suite.
{% endhint %}

## Features

- React renderer for GitBook-style markdown blocks.
- Streaming-friendly \`GitbookStreamdown\` component inspired by \`vercel/streamdown\`.
- Parser and serializer for round-tripping supported GitBook syntax.
- Syntax-highlighted code blocks through \`lowlight\`.
- GitBook block support for hints, tabs, expandables, steppers, embeds, content refs, columns, figures, tables, math, dividers, updates, and OpenAPI operations.
- CSS exported as a stable package entrypoint so host apps can theme with CSS variables or shadcn-style design tokens.

## Installation

\`\`\`sh
npm install @brett_lamy/docstream react
\`\`\`

React is a peer dependency and must be provided by your app.
`,
  },
  {
    id: 'quick-start',
    title: 'Quick start',
    markdown: `# Quick start

Import the stylesheet once, then render markdown with \`MarkdownContent\` (static) or \`GitbookStreamdown\` (streaming):

\`\`\`tsx
import { MarkdownContent } from "@brett_lamy/docstream"
import "@brett_lamy/docstream/styles.css"

export function Preview({ markdown }: { markdown: string }) {
  return <MarkdownContent markdown={markdown} />
}
\`\`\`

For AI response panes where markdown arrives incrementally:

\`\`\`tsx
import { GitbookStreamdown } from "@brett_lamy/docstream"

<GitbookStreamdown markdown={partialMarkdown} isStreaming />
\`\`\`

While \`isStreaming\` is true the renderer tolerates unterminated blocks — a half-open code fence or hint renders progressively instead of erroring.

## Components

| Export | Purpose |
| --- | --- |
| \`GitbookStreamdown\` | Streaming-safe renderer. Props: \`markdown\`, \`isStreaming\`, \`isAnimating\`, \`className\`. |
| \`MarkdownContent\` | Static renderer for a finished document. |
| \`DocsRenderer\` | Renders a parsed document AST as \`<article class="docs-article">\`. |
| \`ReplayPreview\` / \`ReplayEmbed\` | Embeds public Loop QA replays (rrweb). |
| \`VideoEmbed\` | YouTube and direct \`.mp4/.webm/.ogg\` embeds. |
| \`OpenApiOperation\` | Renders a GitBook OpenAPI operation block. |
`,
  },
  {
    id: 'gitbook-syntax',
    title: 'GitBook syntax',
    markdown: `# GitBook syntax

The parser supports normal Markdown plus GitBook-style block tags. Each block below is live.

## Hints

{% hint style="info" %}
An **info** hint. Styles: info, success, warning, danger.
{% endhint %}

{% hint style="warning" %}
A **warning** hint.
{% endhint %}

{% hint style="success" %}
A **success** hint.
{% endhint %}

## Tabs

{% tabs %}
{% tab title="npm" %}
\`\`\`sh
npm install @brett_lamy/docstream
\`\`\`
{% endtab %}
{% tab title="pnpm" %}
\`\`\`sh
pnpm add @brett_lamy/docstream
\`\`\`
{% endtab %}
{% endtabs %}

## Expandables

<details>
<summary>Click to expand</summary>

Hidden content, with full markdown support — \`inline code\`, **bold**, lists.

</details>

## Steppers

{% stepper %}
{% step %}
### Install the package
Add docstream and React to your app.
{% endstep %}
{% step %}
### Import the stylesheet
One import of \`styles.css\` at the app root.
{% endstep %}
{% step %}
### Render markdown
\`MarkdownContent\` for static docs, \`GitbookStreamdown\` for streams.
{% endstep %}
{% endstepper %}

## Tables, math, dividers

| Feature | Streaming-safe |
| --- | --- |
| Hints | Yes |
| Code fences | Yes |
| Tables | Yes |

Inline math like $E = mc^2$ and block math:

$$
\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}
$$

---

## Code highlighting

\`\`\`ts
import { parseMarkdown } from "@brett_lamy/docstream"

const doc = parseMarkdown("# Title\\n\\nBody")
console.log(doc.children.length)
\`\`\`

## Mermaid

\`\`\`mermaid
graph LR
  MD[markdown] --> P(parseMarkdown)
  P --> AST[block AST]
  AST --> R[DocsRenderer]
  AST --> S(serialize)
  S --> MD
\`\`\`
`,
  },
  {
    id: 'streaming',
    title: 'Streaming',
    markdown: `# Streaming

\`GitbookStreamdown\` is built for AI answer panes: pass the partial markdown you have so far and set \`isStreaming\` while chunks arrive.

\`\`\`tsx
const [md, setMd] = useState("")
// append chunks as they arrive from your model
<GitbookStreamdown markdown={md} isStreaming={!done} />
\`\`\`

Below is a live simulation — the markdown is being appended a few words at a time and re-rendered through the streaming path:
`,
  },
  {
    id: 'parser-api',
    title: 'Parser & serializer',
    markdown: `# Parser & serializer

Everything the renderers do is built on a plain-data AST you can use directly.

\`\`\`ts
import {
  parseMarkdown,   // markdown -> { children: Block[] }
  parseBlocks,     // markdown -> Block[]
  parseInline,     // inline markdown -> InlineNode[]
  plainText,       // AST -> plain text
  serialize,       // AST -> markdown (round-trips supported syntax)
} from "@brett_lamy/docstream"

const doc = parseMarkdown(source)
const roundTripped = serialize(doc)
\`\`\`

## Assets

Relative asset paths in docs can be resolved against a base:

\`\`\`ts
import { setAssetBase, resolveAsset } from "@brett_lamy/docstream"

setAssetBase("https://cdn.example.com/docs/")
resolveAsset("images/figure.png")
// -> https://cdn.example.com/docs/images/figure.png
\`\`\`

## Theming

The stylesheet is exported as a stable entrypoint (\`@brett_lamy/docstream/styles.css\`) and driven by CSS variables, so hosts can theme with their own tokens — including shadcn-style design tokens.

## Embeds

\`embed\` blocks accept direct video assets, YouTube URLs, and public Loop QA replay URLs:

\`\`\`md
{% embed url="https://www.youtube.com/watch?v=dQw4w9WgXcQ" /%}
\`\`\`

Loop QA project URLs are converted to the chrome-free \`/p/...\` route automatically, and \`ReplayPreview\` can be used directly for custom sources or native rrweb events.
`,
  },
];

---
description: Render an AI answer while it is still arriving — every docstream block, citation and live demo renders progressively from a partial buffer, with no flicker.
---

# Streaming

`GitbookStreamdown` is built for AI answer panes. Hand it the Markdown received so far, set `isStreaming` while chunks arrive, and every block — hints, tabs, steppers, tables, code, math, citations, even live demos — renders from the partial buffer and grows in place.

```tsx title="Answer.tsx"
const [md, setMd] = useState("")
const [done, setDone] = useState(false)

for await (const chunk of stream) setMd((m) => m + chunk)
setDone(true)

<GitbookStreamdown markdown={md} isStreaming={!done} />
```

## Watch it stream

The buffer below arrives one to eight characters at a time — the shape of a real token stream — and is re-rendered on every chunk. Switch the variant for a docs-heavy answer (a stepper with an install box and a live folder demo, code tabs, an expandable) or a code-heavy one. Turn on **Show raw buffer** to see the exact text received so far, with the half-arrived token that is being held back highlighted.

{% demo src="ai-streaming/live-stream" %}

## In a chat UI

An answer pane on the same component: pick a prompt and the reply streams in. **Stop** freezes it mid-block — the unfinished block simply stays rendered as it was. Each finished answer gets its own **Copy page** (page actions are hidden while `isStreaming`), and clicking any chip or citation badge reaches `onReferenceClick`.

{% demo src="ai-streaming/chat-pane" %}

## How partial documents render

There is no separate streaming parser. The whole partial document is re-parsed on every update (`parseMarkdown` is memoized on the content string), and the parser is deliberately tolerant of unterminated input:

- **An unclosed block tag** — a hint, tabs, a stepper, columns, any template block whose end tag hasn't arrived — collects everything to the end of input as its body. The block appears as soon as its opening line does, and grows.
- **A half-open code fence** collects the rest of the input as code, so code renders line by line.
- **Unclosed `<details>`, `<figure>` and HTML tables** behave the same way.
- **An inline demo still streaming** (no `{% enddemo %}` yet) shows its files in the Code view while the Preview waits — a half-written file never runs.
- **A citation marker before its definition** renders as a plain badge, and becomes a link once `[^n]: url` arrives.

### trimPartialInlineToken

Some tokens would flash as the wrong thing for a chunk or two. While `isStreaming` is set, `GitbookStreamdown` runs the buffer through `trimPartialInlineToken` before parsing, which holds back:

| At the end of the buffer | Held back so it doesn't flash as |
| --- | --- |
| A block tag still arriving: `{% demo src="butt` | a paragraph of tag syntax |
| A one-line command still arriving: `{% command %}npm i x{% endcomm` | a half-rendered install box |
| A lone backtick or two, or a lone `~` (a fence starting) | stray text that would also end an open demo block |
| A partial citation: `[^1` | literal brackets |
| A partial mention or tag: `@bre`, `#seas` | a chip that changes id on every chunk |
| A trailing `\` | an escape with nothing to escape |

While a code fence is open (an odd number of fence lines), the buffer is passed through untouched — inside code, nothing is a token. The function is exported, so a custom renderer can apply the same rule:

```ts
import { trimPartialInlineToken } from "@brett_lamy/docstream"

trimPartialInlineToken("Ask @bre")        // "Ask "
trimPartialInlineToken("Sources [^1")     // "Sources "
trimPartialInlineToken("{% hint style=")  // ""
```

## Props

| Prop | Type | Default | Purpose |
| --- | --- | --- | --- |
| `markdown` (or `children`) | `string` | `""` | The Markdown so far. |
| `isStreaming` | `boolean` | `false` | Trims partial tokens before parsing, hides page actions, and sets `data-streaming` on the wrapper. |
| `isAnimating` | `boolean` | follows `isStreaming` | Controls the wrapper's `aria-busy`. Set it when your typewriter animation outlasts the network stream. |
| `className` | `string` | — | On the wrapper `div[data-docstream]`. |
| `demoResolver`, `demoRuntime`, `demoDependencies`, `demoVFS` | | — | Demos in answers — see [Folder demos](../04-interactive/01-demos.md) and [Inline demos](../04-interactive/02-inline-demos.md). |
| `liveRenderer`, `sourceRenderer` | | — | Live fences and source refs — see [Live code](../04-interactive/03-live-code.md). |
| `pageActions` | `boolean \| DocPageActionsOptions` | — | Copy page menu, shown once streaming ends — see [Page actions](03-page-actions.md). |
| `documentProperties` | `boolean \| { defaultOpen? }` | `true` | Frontmatter property sheet. |
| `onTaskStateChange` | `TaskStateChangeHandler` | — | Interactive task checkboxes. |

`isStreaming` does not change how blocks are parsed — the parser is always tolerant. `data-streaming` is a styling hook for cursors, shimmer or fade-ins; the live stream demo above uses it for its caret:

```css title="answer.css"
[data-streaming] .docs-article > p:last-child::after {
  content: "";
  display: inline-block;
  width: 0.5em;
  height: 1em;
  background: var(--gb-primary);
  animation: blink 0.9s steps(1) infinite;
}
```

## Streaming live demos

AI answers can carry runnable demos. Render them with `PlaygroundStreamdown` (see [Live code](../04-interactive/03-live-code.md)) and an inline demo streams in like any other block: its files appear in the Code view as they arrive, and the Preview boots in almost-node the moment `{% enddemo %}` lands. A src-only `{% demo src="…" %}` against your resolver renders the real component instantly — the third chat prompt above does exactly that.

{% hint style="success" %}
Emit blocks in natural order — opening tag, content, closing tag. There is no need to buffer a block until it is complete, and no need to defer closing tags.
{% endhint %}

## Lighter entries

`@brett_lamy/docstream/streamdown` exports `GitbookStreamdown` with the chip, citation and page-action exports a chat pane needs (`DocstreamRefContext`, `CitationSources`, `InlineReference`, `DocPageActions`, `DemoViewer`, …) without the rest of the package root. `@brett_lamy/docstream/playground` exports `PlaygroundStreamdown` (also as `GitbookStreamdown`) with almost-node wired in.

{% content-ref url="02-references-and-citations.md" %}
References and citations — footnote sources, preview cards, mentions, tags and codebase chips
{% endcontent-ref %}

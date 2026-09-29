# SyntaxHighlighting

Code blocks and inline code highlighted by [gpu-lexer](https://gpu-lexer.vercel.app/), a tiny WebGPU model that splits source into words, whitespace and symbols and labels each piece from its local and whole-file context. It needs no grammar or language setting (75+ languages, including mixed HTML, Vue and Svelte), and one lexer on one GPU device serves every block on the page.

{% tabs title="Installation" sync="install" %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import {
  SyntaxHighlighting, SyntaxHighlightingHeader,
  SyntaxHighlightingTitle, SyntaxHighlightingCopyButton,
} from '@brett_lamy/ui'
```
{% endtab %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/syntax-highlighting.json{% endcommand %}

Adds `@/components/ui/syntax-highlighting.tsx`, installs `@brett_lamy/ui`, and wires its stylesheet and tokens into your CSS. Import from your alias:

```tsx
import {
  SyntaxHighlighting, SyntaxHighlightingHeader,
  SyntaxHighlightingTitle, SyntaxHighlightingCopyButton,
} from '@/components/ui/syntax-highlighting'
```
{% endtab %}
{% endtabs %}

```tsx
import { SyntaxHighlighting } from '@brett_lamy/ui'

<SyntaxHighlighting
  code={source} language="ts" title="src/queue.ts" lineNumbers showCopy
/>
```

## Live examples

### File viewer

A filename header with a copy button, a line-number gutter, and a highlighted range. The gutter stays put while wide lines scroll sideways, and the numbers are drawn with CSS so copying a selection never picks them up.

{% demo src="syntax-highlighting/file-viewer" %}

### Inline code

`variant="inline"` renders a `<code>` span that flows with the sentence.

{% demo src="syntax-highlighting/inline-code" %}

### Showing a change

`addedLines` and `removedLines` tint whole lines and add a `+` / `−` column. The code inside keeps its syntax colors. For a full unified diff with two gutters, lay out rows yourself with `useSyntaxTokens` (the [GitHub clone](https://blamy.github.io/ui/#/blocks) block's Files changed tab does this).

{% demo src="syntax-highlighting/diff" %}

### Copyable snippets

`showCopy` adds a labelled copy button: in the header when there is a `title`, otherwise floating at the top right (it shows on hover and keyboard focus, and always on touch screens). A polite status message announces the copy.

{% demo src="syntax-highlighting/copyable-snippets" %}

### Theming

Token colors are CSS classes (`bl-tok-keyword`, `bl-tok-string`, …) that read `--bl-syntax-*` custom properties. The defaults use `light-dark()`, so they follow `BLProvider`, the docs' `AppearanceProvider`, or any `color-scheme`. Override the properties on the block or on any ancestor. `appearance="light" | "dark"` forces one palette.

{% demo src="syntax-highlighting/custom-theme" %}

### Composed from parts

Pass children and `SyntaxHighlighting` becomes a root: `SyntaxHighlightingHeader`, `SyntaxHighlightingTitle` and `SyntaxHighlightingCopyButton` read its `code`, and `SyntaxHighlightingContent` renders the `<pre>`.

{% demo src="syntax-highlighting/composed-parts" %}

### Your own layout

`useSyntaxTokens(code)` returns the lines as token arrays. `SyntaxTokens` renders one line of them.

{% demo src="syntax-highlighting/tokens-hook" %}

## GPU mode and the fallback

Highlighting runs on the GPU. The first block on a page loads gpu-lexer (about 28 KB), requests a WebGPU adapter, and compiles its pipelines. Every later block reuses that device and lexer.

- **No layout shift.** The block renders its plain text at once, in the final layout. The token colors swap in when the GPU answers, usually within a frame for small sources.
- **Shared and queued.** Parse calls from every instance go through one FIFO queue, and identical sources share a single call. Results are cached by source text, so remounts, repeated snippets and switching tabs show colors on the first frame.
- **Large files.** Sources over 64 KB are lexed in line-aligned pieces that stay under WebGPU's buffer limits. Files longer than 400 lines render in 200-line blocks with `content-visibility: auto`, so the browser skips layout and paint for blocks that are off screen.
- **Streaming.** While a source grows, the lines that haven't changed keep their tokens until the new result arrives.
- **Operators, not keywords.** gpu-lexer sometimes labels operators such as `=>`, `?.` and `??` (and some punctuation) as keywords. Those spans are re-cut before caching, so `=>`, `===`, `?.`, `??`, `&&`, `...`, `::` and `->` get the operator color. Brackets, commas, semicolons and a lone `.` or `:` stay plain, and words keep their label.

Before the first lex, the page asks for a WebGPU adapter once and caches the answer. The `engine` prop decides what to do with it:

| `engine` | Behavior |
| --- | --- |
| `'auto'` (default) | gpu-lexer on a hardware adapter (Metal, D3D12, Vulkan on a real GPU). If the only adapter is a software one (SwiftShader in headless CI, llvmpipe), there is no adapter, or the probe takes longer than 2.5 s, the fallback shows right away instead of waiting on a slow software GPU. |
| `'gpu'` | gpu-lexer on any adapter, software included. This was the old default. It is slow on software adapters, and falls back only where WebGPU is missing. |
| `'fallback'` | Always the fallback, for tests or pages that must not use the GPU. |

The fallback is a small lexer that only knows comments, strings, numbers, a shared keyword list, calls, capitalized types and operators. It is a stand-in, not a second highlighter.

{% demo src="syntax-highlighting/engines" %}

Each `<pre>` (and inline `<code>`) reports what it shows in `data-highlighter`:

| Value | Meaning |
| --- | --- |
| `pending` | Plain text, waiting for the adapter probe or the GPU. |
| `gpu` | Tokens from gpu-lexer on WebGPU. |
| `fallback` | No hardware WebGPU adapter (with `engine="auto"`), no WebGPU at all, or `engine="fallback"`. |
| `none` | Not lexed: `language="text"` or `highlight={false}`. |

An explicit `engine="gpu"` or `engine="fallback"` also sets `data-engine`.

Tests should wait for `pending` to go away before taking a screenshot. In headless CI without a GPU, `auto` settles on the fallback within the probe, so this wait is short. The GPU visual tests run in full Chromium on macOS, whose Metal adapter is hardware, so `auto` uses gpu-lexer there. gpu-lexer's labels are the same from run to run, so the screenshots are too.

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `code` | `string` | — | The source. A single trailing newline is dropped. |
| `language` | `string` | — | `ts`, `tsx`, `json`, `bash`, … Shown as `data-language` and used by the fallback. `text` / `plaintext` turns lexing off. gpu-lexer works out the language itself. |
| `variant` | `'default' \| 'ghost' \| 'inline'` | `'default'` | A bordered card, no chrome, or an inline `<code>` span. |
| `title` | `ReactNode` | — | Header title, usually a filename. It also names the `<pre>` for screen readers. |
| `showCopy` | `boolean` | `false` | A copy button in the header, or floating when there is no title. |
| `lineNumbers` | `boolean` | `false` | Line-number gutter (sticky when scrolling sideways). |
| `startLine` | `number` | `1` | Number of the first line. Line ranges use the displayed numbers. |
| `highlightLines` | `SyntaxLineRange[]` | — | Lines to highlight: `[3, [7, 9], '12-14']`. |
| `addedLines` / `removedLines` | `SyntaxLineRange[]` | — | Lines tinted green with a `+`, or red with a `−`. |
| `wrap` | `boolean` | `false` | Soft-wrap instead of scrolling sideways. |
| `maxHeight` | `number \| string` | — | Scroll past this height. |
| `lineProps` | `(line) => HTMLAttributes` | — | Extra attributes per line, such as `id` anchors or click handlers. |
| `highlight` | `boolean` | `true` | `false` renders plain text. |
| `engine` | `'auto' \| 'gpu' \| 'fallback'` | `'auto'` | `auto` uses the GPU only on a hardware adapter. `gpu` uses it on software adapters too. `fallback` never uses it. |
| `appearance` | `'light' \| 'dark'` | ambient | Force the token palette. It defaults to the `AppearanceProvider` value, and otherwise follows the color scheme. |
| `contentClassName` | `string` | — | Class for the inner `<pre>`. |

`className`, `style` and other `div` props go on the root. `SyntaxHighlightingContent` takes the line props (`lineNumbers` … `engine`) plus `code` / `language` overrides. `SyntaxHighlightingCopyButton` takes `value`, `label` (default `"Copy code"`) and `onCopy`, and it can be used outside a block (the GitHub clone's *Copy raw file* button is one). `syntaxHighlightingVariants` is the cva recipe.

### Hooks and helpers

| Export | Description |
| --- | --- |
| `useSyntaxTokens(code, { language?, enabled?, engine? })` | `{ lines: SyntaxToken[][], highlighter }`. It returns plain lines at first, then tokens. |
| `SyntaxTokens` | Renders one line's tokens as `bl-tok-*` spans. |
| `lexSyntax(code, engine?)` | `Promise<{ spans, highlighter }>` through the shared queue and cache. |
| `webgpuSupported(engine?)` | `false` once WebGPU is known to be missing, and for `auto` (the default) once the probe has found only a software adapter. |
| `probeWebGPU()` | `Promise<'hardware' \| 'software' \| 'none'>`, the cached one-time adapter probe. |
| `languageFromPath(path)` | `'src/queue.ts'` → `'ts'`, for `language` and labels. |
| `tokenizeLines(code, spans)` | Cuts gpu-lexer spans into per-line tokens. |

## Theming

| Property | Colors |
| --- | --- |
| `--bl-syntax-keyword`, `-type`, `-function`, `-string`, `-number`, `-constant`, `-operator`, `-comment` | Token colors. `--bl-syntax-comment-style` sets the comment font style (default `italic`). |
| `--bl-syntax-fg` | Plain text (default `--foreground`). |
| `--bl-syntax-surface` | Block background and the sticky gutter (default `--card`; transparent for `ghost`). |
| `--bl-syntax-border`, `--bl-syntax-radius`, `--bl-syntax-header-bg` | Card chrome. |
| `--bl-syntax-line-number` | Gutter numbers (default `--tertiary-foreground`). |
| `--bl-syntax-highlight`, `--bl-syntax-highlight-bar` | Highlighted lines (default: a tint wash and a tint bar). |
| `--bl-syntax-added`, `--bl-syntax-removed` (and `-gutter`) | Diff line backgrounds. |
| `--bl-syntax-font`, `--bl-syntax-font-size`, `--bl-syntax-line-height`, `--bl-syntax-padding-y`, `--bl-syntax-tab-size` | Type and spacing (defaults: `--font-mono`, 13px, 1.6, 12px, 2). |
| `--bl-syntax-inline-bg`, `--bl-syntax-inline-font-size` | The inline variant. |

## Accessibility

Blocks are real `<pre><code>` elements. The `<pre>` is focusable, so keyboard users can scroll it, and it is named by `title` (or the language). Line numbers and diff signs are CSS-generated and hidden from assistive tech, so they are neither read aloud nor copied. The copy button is a labelled react-aria `Button` whose label changes to "Copied", with a polite status message.

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
Everything on this site is rendered by docstream itself — the prose, this hint, the tabs and math on the syntax page. The site is its own test suite.
{% endhint %}

## Features

- React renderer for GitBook-style markdown blocks.
- Streaming-friendly \`GitbookStreamdown\` component inspired by \`vercel/streamdown\`.
- Parser and serializer for round-tripping supported GitBook syntax through a plain-data AST.
- Syntax-highlighted code blocks through \`lowlight\`, Mermaid diagrams, and math blocks.
- GitBook block support for hints, tabs, expandables, steppers, embeds, content refs, columns, figures, tables (including card views), math, dividers, updates/changelogs, and OpenAPI operations.
- Optional live React code demos powered by almost-node (\`@agent-wasm/core\`).
- CSS exported as a stable package entrypoint, driven by \`--gb-*\` CSS variables that map from shadcn-style host tokens with sensible built-in defaults.

## Package layout

The package ships TypeScript source with subpath exports so hosts only pull what they use:

| Entry | Contents |
| --- | --- |
| \`@brett_lamy/docstream\` | Everything: renderers, parser, embeds, playground helpers. |
| \`@brett_lamy/docstream/gitbook\` | Parser, serializer, and AST types only. |
| \`@brett_lamy/docstream/streamdown\` | \`GitbookStreamdown\` without the almost-node playground boundary. |
| \`@brett_lamy/docstream/assets\` | \`setAssetBase\` / \`resolveAsset\`. |
| \`@brett_lamy/docstream/openapi\` | \`OpenApiOperation\`. |
| \`@brett_lamy/docstream/replay\` | \`ReplayPreview\`, \`ReplayEmbed\`, URL helpers, source types. |
| \`@brett_lamy/docstream/video\` | \`VideoEmbed\`. |
| \`@brett_lamy/docstream/playground\` | Live React demos (\`ReactDemo\`, almost-node helpers). |
| \`@brett_lamy/docstream/styles.css\` | The stylesheet. |

## Installation

\`\`\`sh
npm install @brett_lamy/docstream react
\`\`\`

React is a peer dependency and must be provided by your app. \`@agent-wasm/core\` is an optional peer, only needed for live React code demos — see the **Live React demos** page.
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

{% stepper %}
{% step %}
### Install

\`npm install @brett_lamy/docstream react\`
{% endstep %}
{% step %}
### Import the stylesheet

One import of \`@brett_lamy/docstream/styles.css\` at the app root.
{% endstep %}
{% step %}
### Render markdown

\`MarkdownContent\` for finished docs, \`GitbookStreamdown\` for streams. Both parse the same GitBook-flavored syntax.
{% endstep %}
{% endstepper %}

## Where to go next

- **Components** — every exported React component and its props.
- **GitBook syntax** — the complete block reference, each demonstrated live.
- **Streaming** — how partial documents are handled, with a live simulation.
- **Theming** — the \`--gb-*\` token system and a live override example.
- **Parser & serializer** and **AST reference** — the plain-data layer under the renderers.
`,
  },
  {
    id: 'components',
    title: 'Components',
    markdown: `# Components

Every React export from \`@brett_lamy/docstream\`, with its real props.

## GitbookStreamdown

The streaming renderer. It parses the markdown with \`parseMarkdown\` on each render (memoized on content) and renders through \`DocsRenderer\`, wrapped in a \`div[data-docstream]\`. The export from the package root also wires a live-preview renderer for live code blocks (see **Live React demos**); the \`@brett_lamy/docstream/streamdown\` entry is the same component without that boundary.

| Prop | Type | Default | Purpose |
| --- | --- | --- | --- |
| \`markdown\` | \`string\` | — | Markdown source. Takes precedence over \`children\`. |
| \`children\` | \`string\` | — | Alternative way to pass the markdown source. |
| \`isStreaming\` | \`boolean\` | \`false\` | Sets the \`data-streaming\` attribute on the wrapper and (absent \`isAnimating\`) \`aria-busy\`. |
| \`isAnimating\` | \`boolean\` | — | Overrides the \`aria-busy\` value when provided. |
| \`className\` | \`string\` | — | Class on the wrapper div. |

\`\`\`tsx
<GitbookStreamdown markdown={md} isStreaming={!done} />
\`\`\`

{% code title="GitbookStreamdown rendering nested markdown" live="true" %}
\`\`\`jsx
// demo:nested-markdown
<GitbookStreamdown markdown={nestedGitbookMarkdown} />
\`\`\`
{% endcode %}

## MarkdownContent

Static renderer for a markdown string. Renders a plain \`div\` with the \`data-docstream\` attribute (plus your \`className\`) around the parsed blocks — no \`<article>\` chrome, so it composes into any layout (this page is rendered with it).

| Prop | Type | Purpose |
| --- | --- | --- |
| \`markdown\` | \`string\` | The markdown source (required). |
| \`className\` | \`string\` | Extra class on the \`data-docstream\` wrapper. |
| \`liveRenderer\` | \`LivePreviewRenderer\` | Optional renderer for live code blocks. |

{% code title="MarkdownContent with className" live="true" %}
\`\`\`jsx
// demo:markdown-classname
<MarkdownContent className="demo-compact-md" markdown={source} />
\`\`\`
{% endcode %}

## DocsRenderer

Lowest-level renderer: takes an already-parsed \`DocumentNode\` and renders \`<article class="docs-article">\`. Use it when you parse once and render many times, or when you build ASTs programmatically.

\`\`\`tsx
import { DocsRenderer, parseMarkdown } from "@brett_lamy/docstream"

const doc = parseMarkdown(source)
<DocsRenderer doc={doc} />
\`\`\`

| Prop | Type | Purpose |
| --- | --- | --- |
| \`doc\` | \`DocumentNode\` | Parsed document (from \`parseMarkdown\`). |
| \`liveRenderer\` | \`LivePreviewRenderer\` | Optional \`({ files, entry, title }) => ReactNode\` for live code blocks. |

## VideoEmbed

Renders a direct media file (\`.mp4\` / \`.webm\` / \`.ogg\`, detected by extension) as a native \`<video>\`, and anything else as a lazy-loading \`<iframe>\` (YouTube embed URLs, players).

| Prop | Type | Default | Purpose |
| --- | --- | --- | --- |
| \`src\` | \`string\` | — | Direct media asset or public player URL (required). |
| \`title\` | \`string\` | \`"Video"\` | Accessible title. |
| \`className\` | \`string\` | — | Appended to \`video-embed__media\`. |
| \`aspectRatio\` | \`CSSProperties["aspectRatio"]\` | \`"16 / 9"\` | Aspect ratio for iframe embeds. |
| \`controls\` | \`boolean\` | \`true\` | Native controls (direct video only). |
| \`autoplay\` | \`boolean\` | \`false\` | Autoplay (direct video only). |
| \`loop\` | \`boolean\` | \`false\` | Loop (direct video only). |
| \`muted\` | \`boolean\` | \`false\` | Muted (direct video only). |
| \`poster\` | \`string\` | — | Poster image (direct video only). |
| \`allowFullScreen\` | \`boolean\` | \`true\` | Fullscreen permission (iframe only). |

{% code title="VideoEmbed with a YouTube embed URL" live="true" %}
\`\`\`jsx
// demo:video-embed
<VideoEmbed src="https://www.youtube.com/embed/8aGhZQkoFbQ" title="Event loop talk" />
\`\`\`
{% endcode %}

## ReplayPreview / ReplayEmbed

Embeds session replays. \`ReplayEmbed\` is a semantic alias of \`ReplayPreview\`. The component accepts several source shapes via the \`source\` prop:

| \`ReplaySource\` shape | Behavior |
| --- | --- |
| \`string\` | Treated as a page URL; rendered as an iframe of the public embed route. |
| \`eventWithTime[]\` | In-memory rrweb events, played natively with the built-in player. |
| \`{ kind: "url", url, title? }\` | Explicit page-URL source (iframe). |
| \`{ kind: "events", events }\` | Explicit rrweb event source (native player). |
| \`{ kind: "events-url", url, fetchInit? }\` | Fetches a JSON event array (or \`{ events }\`) then plays natively. |

| Prop | Type | Default | Purpose |
| --- | --- | --- | --- |
| \`source\` | \`ReplaySource\` | — | Required, see above. |
| \`active\` | \`boolean\` | \`true\` | When false, renders an inert placeholder (defer mounting rrweb). |
| \`autoplay\` | \`boolean\` | \`false\` | Native playback starts automatically. |
| \`loop\` | \`boolean\` | \`false\` | Restart when finished. |
| \`speeds\` | \`number[]\` | \`[0.5, 1, 2, 4, 8]\` | Playback speed options. |
| \`title\` | \`string\` | — | iframe title. |
| \`className\` | \`string\` | — | Appended to \`replay-preview\`. |

The native player sanitizes events (\`sanitizeReplayEvent\` is exported from \`@brett_lamy/docstream/replay\`), skips idle periods over 5 s, scales to fit, and offers play/pause, restart, scrubbing, and speed selection.

### URL helpers

\`\`\`ts
import { isReplayQaUrl, normalizeReplayEmbedUrl } from "@brett_lamy/docstream"

normalizeReplayEmbedUrl("https://app.example.com/projects/p1/journeys/j1")
// -> "https://app.example.com/p/p1/journeys/j1"  (chrome-free public embed route)

isReplayQaUrl(url) // true for /p/... routes and *.replay.io hosts
\`\`\`

\`normalizeReplayEmbedUrl\` rewrites \`/projects/:id/(tasks|journeys|test-runs|explorations)/:rid\` to the public \`/p/...\` route (\`explorations\` maps to \`tasks\`) and returns \`null\` for non-http(s) or unparsable input. Embed blocks whose URL passes \`isReplayQaUrl\` render as a \`ReplayPreview\` automatically.

## OpenApiOperation

Fetches an OpenAPI spec (JSON or YAML, cached per URL), resolves refs, and renders one operation: method badge, server, path, description (itself rendered as GitBook markdown), authorizations, parameters, responses with schema fields, a generated cURL sample, and an example 200 response synthesized from the schema.

| Prop | Type | Purpose |
| --- | --- | --- |
| \`specUrl\` | \`string\` | URL of the OpenAPI document. |
| \`path\` | \`string\` | Path key inside \`paths\`, e.g. \`/pet/findByStatus\`. |
| \`method\` | \`string\` | HTTP method, e.g. \`get\`. |

It is also what \`openapi-operation\` blocks render to — see the live example on the GitBook syntax page.

## Streamdown re-export

The package root re-exports \`Streamdown\` (and \`StreamdownProps\`) from the upstream \`streamdown\` package for hosts that want the plain GFM streaming renderer without GitBook blocks.
`,
  },
  {
    id: 'live-demos',
    title: 'Live React demos',
    markdown: `# Live React demos

Docstream can run multi-file React projects inside the page through **almost-node** — a browser Node.js runtime with a virtual filesystem and a real Vite dev server, provided by the \`@agent-wasm/core\` peer dependency.

{% hint style="warning" %}
Live demos require the host app to install \`@agent-wasm/core\` (>= 0.4.0) and import from \`@brett_lamy/docstream/playground\` (or the package root, which includes it). The runtime is loaded lazily, so ordinary markdown rendering never pulls the WASM runtime into your bundle. The panel at the bottom of this page is a real \`ReactCodePreview\` booting Vite in your browser.
{% endhint %}

## ReactDemo / ReactCodePreview

\`ReactCodePreview\` is an alias of \`ReactDemo\`. It boots an almost-node workspace with your files, runs \`vite\`, and shows the served app in a sandboxed iframe with a status header (idle / starting / ready / error) and a Run/Retry button.

| Prop | Type | Default | Purpose |
| --- | --- | --- | --- |
| \`files\` | \`AlmostNodeFiles\` | — | Project file map (\`Record<path, content>\` or \`{ path, content }[]\`). Relative paths root at \`/\`. |
| \`entry\` | \`string\` | \`"/src/main.jsx"\` | Vite entry file. |
| \`port\` | \`number\` | \`4173\` | Preferred virtual port; almost-node picks the next free one if taken. |
| \`height\` | \`number \\| string\` | \`360\` | Preview height. |
| \`title\` | \`string\` | \`"Live React preview"\` | Header label. |
| \`autoStart\` | \`boolean\` | \`true\` | Start the runtime on mount. |
| \`sandbox\` | \`string\` | \`"allow-scripts allow-same-origin allow-forms allow-modals"\` | iframe sandbox; same-origin lets the almost-node service worker route the preview. |
| \`onReady\` | \`(url: string) => void\` | — | Called with the served URL. |
| \`onError\` | \`(error: Error) => void\` | — | Called on startup failure. |
| \`className\` | \`string\` | — | Appended to \`docs-react-demo\`. |

\`\`\`tsx
import { ReactDemo } from "@brett_lamy/docstream/playground"

<ReactDemo
  files={{ "/src/main.jsx": appSource }}
  entry="/src/main.jsx"
  height={420}
/>
\`\`\`

## Live code blocks in markdown

A code-tag-wrapped jsx/tsx fence with \`live="true"\` renders through the \`liveRenderer\` prop when one is supplied (the root \`GitbookStreamdown\` supplies \`ReactCodePreview\` automatically):

~~~md
{% code title="Counter" live="true" entry="/src/main.jsx" %}
\`\`\`jsx
// entry file contents...
\`\`\`
{% endcode %}
~~~

Live rendering applies to \`jsx\`, \`tsx\`, and \`react\` language fences; other languages keep their normal code chrome.

## Filesystem helpers

### createReactDemoFiles(files, options?)

Normalizes a file map and adds the tiny Vite/React shell a bare source map needs: a \`package.json\` (react + react-dom dependencies) and an \`index.html\` pointing at \`options.entry\` (default \`/src/main.jsx\`). Existing \`package.json\` / \`index.html\` files are always respected.

### createAlmostNodeFilesystem(files, options?)

Creates a standalone almost-node \`VirtualFS\` populated with your files. \`options.root\` prefixes relative paths.

\`\`\`ts
import { createAlmostNodeFilesystem } from "@brett_lamy/docstream/playground"

const vfs = await createAlmostNodeFilesystem({ "src/index.js": "..." }, { root: "/app" })
\`\`\`

### createAlmostNodeWorkspace(files, options?)

Creates a full almost-node container with the files written into its VFS. Options extend the container options (minus \`cwd\`) with \`root\`, used as cwd and Vite root. Returns:

| Member | Purpose |
| --- | --- |
| \`container\` | The \`ContainerInstance\` — \`run\`, \`runFile\`, npm installs, Vite. |
| \`root\` | Normalized project root. |
| \`writeFile(path, content)\` / \`writeFiles(files)\` | Update the VFS. |
| \`listFiles()\` | Sorted file paths in the VFS. |
| \`dispose()\` | Tear the container down. |

\`\`\`ts
const ws = await createAlmostNodeWorkspace({ "/src/main.jsx": code })
await ws.container.run("vite --port 4173")
\`\`\`

Also exported: \`normalizeAlmostNodeFiles\`, \`normalizeAlmostNodePath\`, \`toAlmostNodeFileMap\`, and the types \`AlmostNodeFile\`, \`AlmostNodeFileContent\`, \`AlmostNodeFiles\`, \`AlmostNodeFilesystemOptions\`, \`AlmostNodeWorkspace\`, \`AlmostNodeWorkspaceOptions\`.
`,
  },
  {
    id: 'source-files',
    title: 'File-backed components',
    markdown: `# File-backed components and stories

These previews are not implemented in this Markdown string. Vite mounts the real \`demo/src/examples\` directory, and each block retains its mount, file, export, and kind as provenance.

## Component export

{% source-ref mount="demo" path="Button.tsx" export="Button" kind="component" title="Button component" %}

## Storybook CSF export

{% source-ref mount="demo" path="Button.stories.tsx" export="Primary" kind="story" title="Primary story" %}

\`createViteSourceClient().read(reference)\` reads the authoritative file. The editor package's \`SourceFileEditor\` saves through the same client, writes the real file, preserves provenance, and lets Vite reload the preview.
`,
  },
  {
    id: 'gitbook-syntax',
    title: 'GitBook syntax',
    markdown: `# GitBook syntax

The complete block reference. The parser supports normal Markdown plus GitBook template tags and a few HTML forms GitBook exports. Every block below shows the literal syntax first, then the live rendered result.

## Headings

ATX (\`#\` through \`######\`) and setext (\`===\` / \`---\` underlines) headings are supported. Empty headings from GitBook exports (a bare \`##\`) parse without error.

## Hints

\`\`\`md
{% hint style="info" %}
An **info** hint. Styles: info, success, warning, danger (unknown styles fall back to info).
{% endhint %}
\`\`\`

{% hint style="info" %}
An **info** hint. Styles: info, success, warning, danger (unknown styles fall back to info).
{% endhint %}

{% hint style="success" %}
A **success** hint.
{% endhint %}

{% hint style="warning" %}
A **warning** hint.
{% endhint %}

{% hint style="danger" %}
A **danger** hint.
{% endhint %}

## Tabs

~~~md
{% tabs %}
{% tab title="npm" %}
\`\`\`sh
npm install @brett_lamy/docstream
\`\`\`
{% endtab %}
{% tab title="pnpm" %}
...
{% endtab %}
{% endtabs %}
~~~

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
{% tab title="yarn" %}
\`\`\`sh
yarn add @brett_lamy/docstream
\`\`\`
{% endtab %}
{% endtabs %}

## Expandables

GitBook expandables are HTML \`<details>\` blocks:

\`\`\`md
<details>
<summary>Click to expand</summary>

Hidden content, with full markdown support.

</details>
\`\`\`

<details>
<summary>Click to expand</summary>

Hidden content, with full markdown support — \`inline code\`, **bold**, lists:

- one
- two

</details>

## Steppers

By GitBook convention the first heading inside each step becomes the step title:

\`\`\`md
{% stepper %}
{% step %}
### Install the package
Add docstream and React to your app.
{% endstep %}
{% step %}
### Render markdown
Use MarkdownContent or GitbookStreamdown.
{% endstep %}
{% endstepper %}
\`\`\`

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

## Code blocks

Plain fences (backticks or tildes) work as usual, with lowlight syntax highlighting. Wrapping a fence in a \`code\` tag adds attributes: \`title\`, \`lineNumbers="true"\`, and for live React previews \`live="true"\` + \`entry\` (see **Live React demos**):

~~~md
{% code title="hello.ts" lineNumbers="true" %}
\`\`\`ts
export function hello(name: string) {
  return "Hello, " + name + "!"
}
\`\`\`
{% endcode %}
~~~

{% code title="hello.ts" lineNumbers="true" %}
\`\`\`ts
export function hello(name: string) {
  return "Hello, " + name + "!"
}
\`\`\`
{% endcode %}

Indented (4-space) code blocks are also recognized. Fences with language \`mermaid\` render as diagrams:

\`\`\`mermaid
graph LR
  MD[markdown] --> P(parseMarkdown)
  P --> AST[block AST]
  AST --> R[DocsRenderer]
  AST --> S(serializeMarkdown)
  S --> MD
\`\`\`

## Embeds

\`\`\`md
{% embed url="https://www.youtube.com/watch?v=aqz-KE-bpKQ" title="Big Buck Bunny" %}
\`\`\`

{% embed url="https://www.youtube.com/watch?v=aqz-KE-bpKQ" title="Big Buck Bunny" %}

Embed attributes: \`url\`, \`title\`, \`poster\`, and boolean \`autoplay\` / \`loop\` / \`muted\` / \`controls\`. A trailing end tag is tolerated. YouTube URLs become player iframes, direct \`.mp4/.webm/.ogg\` URLs become native video, Loop QA replay URLs become a \`ReplayPreview\`, and anything else falls back to a link card.

## Content refs

\`\`\`md
{% content-ref url="https://github.com/BLamy/docstream" %}
The docstream repository
{% endcontent-ref %}
\`\`\`

{% content-ref url="https://github.com/BLamy/docstream" %}
The docstream repository
{% endcontent-ref %}

GitBook \`file\` blocks (with \`src\` and \`caption\` attributes) render with the same card chrome.

## Columns

\`\`\`md
{% columns %}
{% column %}
Left column content.
{% endcolumn %}
{% column %}
Right column content.
{% endcolumn %}
{% endcolumns %}
\`\`\`

{% columns %}
{% column %}
**Left** — columns can contain any blocks, including hints and code.
{% endcolumn %}
{% column %}
**Right** — they flex to equal widths.
{% endcolumn %}
{% endcolumns %}

## Figures and images

Three forms parse to a figure block: a solo markdown image line, a solo HTML \`<img>\` line, and GitBook's \`<figure>\` export with an optional \`<figcaption>\`:

\`\`\`md
![A placeholder diagram](https://placehold.co/600x220/png)

<figure><img src="..." alt="..."><figcaption><p>Caption text</p></figcaption></figure>
\`\`\`

<figure><img src="https://placehold.co/600x220/e8e8f2/5b5bd6/png?text=docstream" alt="A placeholder diagram"><figcaption><p>Figures get rounded corners and centered captions</p></figcaption></figure>

Inline images (GitHub badge style) also work inside paragraphs, with optional links: <a href="https://www.npmjs.com/package/@brett_lamy/docstream"><img src="https://img.shields.io/npm/v/%40brett_lamy%2Fdocstream" alt="npm version"></a>

## Tables

GFM pipe tables (escaped pipes and pipes inside inline code are handled):

\`\`\`md
| Feature | Streaming-safe |
| --- | --- |
| Hints | Yes |
| Code fences | Yes |
\`\`\`

| Feature | Streaming-safe |
| --- | --- |
| Hints | Yes |
| Code fences | Yes |
| Tables | Yes |

HTML tables (as exported by GitBook) are parsed too, and \`<table data-view="cards">\` renders as a card grid — the first cell of each row is the card title:

\`\`\`md
<table data-view="cards"><thead><tr><th></th><th></th></tr></thead><tbody>
<tr><td><strong>Parser</strong></td><td>markdown to AST</td></tr>
<tr><td><strong>Renderer</strong></td><td>AST to React</td></tr>
</tbody></table>
\`\`\`

<table data-view="cards"><thead><tr><th></th><th></th></tr></thead><tbody><tr><td><strong>Parser</strong></td><td>markdown to AST</td></tr><tr><td><strong>Renderer</strong></td><td>AST to React</td></tr><tr><td><strong>Serializer</strong></td><td>AST back to markdown</td></tr></tbody></table>

## Lists

Unordered, ordered, task lists, and GFM nesting:

- unordered item
- item with nested content
  - nested item
  1. nested ordered item

1. ordered item
2. another

- [x] completed task
- [ ] open task

## Blockquotes and dividers

> Blockquotes support full block content, including nested markdown.

Three or more \`-\`, \`*\`, or \`_\` on a line render a divider:

---

## Math

\`\`\`md
$$
\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}
$$
\`\`\`

$$
\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}
$$

## Updates (changelog)

\`\`\`md
{% updates %}
{% update date="2026-08-01" %}
**Added** — theming tokens with built-in defaults.
{% endupdate %}
{% endupdates %}
\`\`\`

{% updates %}
{% update date="2026-08-01" %}
**Added** — theming tokens with built-in defaults, distinct syntax palette.
{% endupdate %}
{% update date="2026-07-15" %}
**Fixed** — nested list indentation in the serializer.
{% endupdate %}
{% endupdates %}

## OpenAPI operations

\`\`\`md
{% openapi-operation spec="petstore" path="/pet/findByStatus" method="get" %}
[petstore](https://petstore3.swagger.io/api/v3/openapi.json)
{% endopenapi-operation %}
\`\`\`

{% openapi-operation spec="petstore" path="/pet/findByStatus" method="get" %}
[petstore](https://petstore3.swagger.io/api/v3/openapi.json)
{% endopenapi-operation %}

## Inline syntax

**bold**, _italic_, ~~strike~~, \`code\`, [links](https://example.com), reference-style links, autolinks like https://example.com, and \`<a>\` / \`<img>\` inline HTML. Unknown template tags are skipped rather than corrupting output.
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

## How partial documents are handled

There is no separate streaming parser — the whole partial document is re-parsed on every update (\`parseMarkdown\` is memoized on the content string), and the parser is deliberately tolerant of unterminated input:

- An open hint, tabs, stepper, or any other template block whose closing tag hasn't streamed in yet simply collects everything to the end of input as its body — so the block renders immediately and grows as content arrives.
- A half-open code fence collects the rest of the input as code, so code renders progressively line by line.
- Unclosed \`<details>\`, \`<figure>\`, and HTML-table chunks behave the same way.

## What the props actually do

- \`isStreaming\` sets the \`data-streaming\` attribute on the wrapper \`div[data-docstream]\` — a styling hook for cursors, shimmer effects, or fade-ins in the host app. It does not change parsing.
- \`isAnimating\` controls the wrapper's \`aria-busy\` attribute; when omitted, \`aria-busy\` follows \`isStreaming\`. Use it when your typewriter animation outlasts the network stream.

Below is a live simulation — the markdown is appended a few words at a time and re-rendered through the streaming path:
`,
  },
  {
    id: 'theming',
    title: 'Theming',
    markdown: `# Theming

The stylesheet (\`@brett_lamy/docstream/styles.css\`) is driven entirely by CSS custom properties. Every \`--gb-*\` token is defined on \`[data-docstream]\` and \`.docs-article\` as \`var(--host-token, default)\` — it reads a shadcn-style host token when one exists and falls back to a neutral light-zinc default otherwise. Rendering therefore looks right with **zero setup**, and adapts automatically inside shadcn/tailwind themes.

## The token system

| docstream token | Reads host token | Built-in default |
| --- | --- | --- |
| \`--gb-panel\` | \`--card\` | \`#ffffff\` |
| \`--gb-panel-foreground\` | \`--card-foreground\` | \`#18181b\` |
| \`--gb-muted\` | \`--muted\` | \`#f4f4f5\` |
| \`--gb-muted-foreground\` | \`--muted-foreground\` | \`#71717a\` |
| \`--gb-border\` | \`--border\` | \`#e4e4e7\` |
| \`--gb-accent\` | \`--accent\` | \`#f4f4f5\` |
| \`--gb-accent-foreground\` | \`--accent-foreground\` | \`#18181b\` |
| \`--gb-primary\` | \`--primary\` | \`#4f46e5\` |
| \`--gb-primary-foreground\` | \`--primary-foreground\` | \`#fafafa\` |
| \`--gb-code-bg\` | — | \`rgba(128, 128, 128, 0.13)\` |
| \`--gb-code-fg\` | \`--foreground\` | \`#18181b\` |

A few rules read host tokens directly with the same fallback pattern: \`--background\` / \`--foreground\` (\`#ffffff\` / \`#18181b\`) for active tabs and mermaid surfaces.

### Semantic hint palette

Solid colors plus precomputed tints — plain rgba values, no \`color-mix()\` or \`oklch()\`, so the theme renders correctly in older Chromium forks. Matches the editor palette in \`@brett_lamy/docstream-editor\`.

| Token | Default | Companion tokens |
| --- | --- | --- |
| \`--gb-info\` | \`#3b82f6\` | \`--gb-info-border\` (45% tint), \`--gb-info-bg\` (10% tint) |
| \`--gb-success\` | \`#22c55e\` | \`--gb-success-border\` (45%), \`--gb-success-bg\` (10%) |
| \`--gb-warning\` | \`#f59e0b\` | \`--gb-warning-border\` (50%), \`--gb-warning-bg\` (12%) |
| \`--gb-danger\` | \`#ef4444\` | \`--gb-danger-border\` (45%), \`--gb-danger-bg\` (10%) |

### Syntax highlighting palette

Code tokens map to shadcn chart tokens, with distinct GitHub-flavored defaults:

| hljs group | Host token | Default |
| --- | --- | --- |
| strings, attrs, symbols, bullets | \`--chart-1\` | \`#0a7a4b\` |
| titles, sections, function names | \`--chart-2\` | \`#8250df\` |
| numbers, literals, variables | \`--chart-3\` | \`#0550ae\` |
| keywords, types, tags, built-ins | \`--chart-4\` | \`#cf222e\` |
| comments, quotes, meta | \`--gb-muted-foreground\` | — |

## Overriding

Define the host tokens on \`:root\` (the shadcn way) — docstream picks them up everywhere:

\`\`\`css
:root {
  --card: #0b0b10;
  --border: #26263a;
  --muted: #17171f;
  --muted-foreground: #9a9ab0;
  --primary: #8b8bf0;
}
\`\`\`

Or scope overrides by setting the \`--gb-*\` tokens directly on any wrapper element — they inherit into \`[data-docstream]\`... almost: because the tokens are *defined* on \`[data-docstream]\` itself, scoped overrides set the **host** tokens (\`--card\`, \`--border\`, …) on the wrapper instead, and the \`var()\` fallbacks pick them up. The block below is a **live demonstration**: the same \`MarkdownContent\` content twice — unthemed, and wrapped in a div that overrides a handful of host tokens (\`--card\`, \`--border\`, \`--primary\`, \`--gb-info\`, \`--chart-1..4\`) to a dark card theme.

{% code title="Scoped token overrides" live="true" %}
\`\`\`jsx
// demo:theme-tokens
<div style={darkHostTokens}>\n  <MarkdownContent markdown={content} />\n</div>
\`\`\`
{% endcode %}
`,
  },
  {
    id: 'parser-api',
    title: 'Parser & serializer',
    markdown: `# Parser & serializer

Everything the renderers do is built on a plain-data AST you can use directly. The pure-data layer is also available standalone from \`@brett_lamy/docstream/gitbook\`.

## Parsing

\`\`\`ts
import { parseMarkdown, parseBlocks, parseInline, plainText } from "@brett_lamy/docstream"

const doc = parseMarkdown(source)   // DocumentNode: { type: "doc", children: Block[] }
const blocks = parseBlocks(lines)   // string[] -> Block[] (no ref-definition pass)
const inline = parseInline("**hi** [x](https://a.b)")  // Inline[]
plainText(inline)                    // "hi x" — flattens to plain text (alt text for images)
\`\`\`

\`parseMarkdown\` first extracts reference-style link definitions into the exported \`refDefinitions\` map, then parses the remaining lines with \`parseBlocks\`. \`parseInline\` accepts an optional second argument of marks to apply to everything it emits.

### Try it

Type markdown on the left; the parsed \`DocumentNode\` JSON updates live:

{% code title="parseMarkdown explorer" live="true" %}
\`\`\`tsx
// demo:parse-explorer
const ast = parseMarkdown(textarea.value) // rendered as JSON below
\`\`\`
{% endcode %}

## Serializing

\`\`\`ts
import { serializeMarkdown, serializeBlocks, serializeInline } from "@brett_lamy/docstream"

serializeMarkdown(doc)      // DocumentNode -> markdown string (trailing newline)
serializeBlocks(blocks)     // Block[] -> markdown (blocks joined by blank lines)
serializeInline(inline)     // Inline[] -> inline markdown (escapes markdown specials)
\`\`\`

Serialization round-trips all supported syntax: hints, tabs, steppers, code attributes, embeds, content refs, columns, figures, tables (card views serialize back to HTML \`<table data-view>\`), math, updates, and OpenAPI blocks.

{% hint style="info" %}
Round-trip guarantee: \`serializeMarkdown(parseMarkdown(md))\` produces markdown that parses to the same AST. This is what lets \`@brett_lamy/docstream-editor\` edit documents without inventing syntax the renderer can't display.
{% endhint %}

## Assets

Relative image paths (e.g. from a GitHub README) can be resolved against the raw.githubusercontent.com URL of the file being rendered. The AST keeps the original relative \`src\`; only rendering resolves it.

\`\`\`ts
import { setAssetBase, resolveAsset } from "@brett_lamy/docstream"

// repo, branch, and the path of the markdown file being rendered
setAssetBase("BLamy/docstream", "main", "docs/guide/intro.md")

resolveAsset("images/figure.png")
// -> "https://raw.githubusercontent.com/BLamy/docstream/main/docs/guide/images/figure.png"

resolveAsset("https://cdn.example.com/x.png") // absolute URLs pass through
setAssetBase(null, null, null)                 // clear the base
\`\`\`

\`resolveAsset\` leaves absolute \`http(s):\`, \`data:\`, and \`blob:\` URLs untouched, and returns the input unchanged when no base is set.

## Subpath exports

| Import | What you get |
| --- | --- |
| \`@brett_lamy/docstream/gitbook\` | \`parseMarkdown\`, \`parseBlocks\`, \`parseInline\`, \`plainText\`, \`refDefinitions\`, \`serializeMarkdown\`, \`serializeBlocks\`, \`serializeInline\`, all AST types. |
| \`@brett_lamy/docstream/streamdown\` | \`GitbookStreamdown\` without the playground boundary. |
| \`@brett_lamy/docstream/assets\` | \`setAssetBase\`, \`resolveAsset\`. |
| \`@brett_lamy/docstream/openapi\` | \`OpenApiOperation\`. |
| \`@brett_lamy/docstream/replay\` | \`ReplayPreview\`, \`ReplayEmbed\`, \`isReplayQaUrl\`, \`normalizeReplayEmbedUrl\`, \`sanitizeReplayEvent\`, source types. |
| \`@brett_lamy/docstream/video\` | \`VideoEmbed\`. |
| \`@brett_lamy/docstream/playground\` | \`ReactDemo\`, \`ReactCodePreview\`, almost-node helpers (needs the \`@agent-wasm/core\` peer). |
| \`@brett_lamy/docstream/styles.css\` | The stylesheet. |
`,
  },
  {
    id: 'ast',
    title: 'AST reference',
    markdown: `# AST reference

The AST is the single source of truth shared by the parser, serializer, the editor's TipTap converters, and the docs renderer. All types are exported from the package root and from \`@brett_lamy/docstream/gitbook\`.

## Document

| Type | Fields |
| --- | --- |
| \`DocumentNode\` | \`type: "doc"\`, \`children: Block[]\` |

## Inline nodes

\`Inline\` is the union of \`TextNode\` and \`InlineImageNode\`:

| Type | Fields |
| --- | --- |
| \`TextNode\` | \`type: "text"\`, \`text: string\`, optional \`bold\`, \`italic\`, \`strike\`, \`code\` (booleans), \`link?: string\` |
| \`InlineImageNode\` | \`type: "image"\`, \`src: string\`, optional \`alt\`, \`width\`, \`height\`, \`link\` (strings) |

A \`text(t, marks?)\` helper constructs \`TextNode\` values.

## Block nodes

| Type | Fields |
| --- | --- |
| \`ParagraphNode\` | \`type: "paragraph"\`, \`children: Inline[]\` |
| \`HeadingNode\` | \`type: "heading"\`, \`level: 1–6\`, \`children: Inline[]\` |
| \`CodeBlockNode\` | \`type: "code"\`, \`language: string \\| null\`, \`title: string \\| null\`, \`lineNumbers: boolean\`, \`code: string\`, \`live?: boolean\`, \`entry?: string \\| null\` |
| \`HintNode\` | \`type: "hint"\`, \`style: HintStyle\`, \`children: Block[]\` |
| \`TabsNode\` | \`type: "tabs"\`, \`tabs: TabNode[]\` |
| \`TabNode\` | \`type: "tab"\`, \`title: string\`, \`children: Block[]\` |
| \`ExpandableNode\` | \`type: "expandable"\`, \`summary: string\`, \`children: Block[]\` |
| \`StepperNode\` | \`type: "stepper"\`, \`steps: StepNode[]\` |
| \`StepNode\` | \`type: "step"\`, \`title: string\`, \`children: Block[]\` |
| \`EmbedNode\` | \`type: "embed"\`, \`url: string\`, optional \`title\`, \`poster\` (strings), \`autoplay\`, \`loop\`, \`muted\`, \`controls\` (booleans) |
| \`ContentRefNode\` | \`type: "content-ref"\`, \`url: string\`, \`children: Inline[]\` |
| \`ColumnsNode\` | \`type: "columns"\`, \`columns: ColumnNode[]\` |
| \`ColumnNode\` | \`type: "column"\`, \`children: Block[]\` |
| \`FigureNode\` | \`type: "figure"\`, \`src: string\`, \`alt: string\`, \`caption: string\` |
| \`ListNode\` | \`type: "list"\`, \`ordered: boolean\`, \`task: boolean\`, \`items: ListItemNode[]\` |
| \`ListItemNode\` | \`type: "listItem"\`, \`children: Block[]\`, \`checked?: boolean\` (task lists only) |
| \`BlockquoteNode\` | \`type: "blockquote"\`, \`children: Block[]\` |
| \`DividerNode\` | \`type: "divider"\` |
| \`TableNode\` | \`type: "table"\`, \`header: Inline[][]\`, \`rows: Inline[][][]\`, \`view?: string\` (\`"cards"\` for card grids) |
| \`MathNode\` | \`type: "math"\`, \`formula: string\` |
| \`UpdatesNode\` | \`type: "updates"\`, \`format: string \\| null\`, \`updates: UpdateNode[]\` |
| \`UpdateNode\` | \`type: "update"\`, \`date: string\`, \`children: Block[]\` |
| \`OpenApiOperationNode\` | \`type: "openapi-operation"\`, \`spec\`, \`path\`, \`method\`, \`specUrl\`, \`label\` (all strings) |

\`HintStyle\` is \`"info" | "success" | "warning" | "danger"\`.

\`Block\` is the union of all top-level block types above. \`TabNode\`, \`StepNode\`, \`ColumnNode\`, \`ListItemNode\`, and \`UpdateNode\` are child-only shapes that appear inside their parent nodes.

{% hint style="info" %}
Nodes are plain JSON-serializable data — no classes, no prototypes. You can construct, diff, store, or stream them freely.
{% endhint %}
`,
  },
];

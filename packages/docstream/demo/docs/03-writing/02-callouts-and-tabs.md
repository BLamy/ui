---
description: Hints in four severities, tab sets that collapse, sync and become sections, and expandables for everything optional.
---

# Callouts and tabs

Three blocks do most of the work of shaping a page: **hints** pull a sentence out of the flow, **tabs** show one thing several ways without making the reader scroll past the others, and **expandables** fold away what most readers don't need. All three hold full Markdown — including each other.

## Hints

`{% hint style="…" %}` draws a callout with an icon. Four styles, from mild to severe:

{% tabs sync="example" %}
{% tab title="Preview" %}
{% hint style="info" %}
**Info** — background, a definition, a pointer elsewhere. The default style.
{% endhint %}

{% hint style="success" %}
**Success** — the recommended path, or what "done" looks like.
{% endhint %}

{% hint style="warning" %}
**Warning** — a gotcha, a requirement, something that will bite later.
{% endhint %}

{% hint style="danger" %}
**Danger** — data loss, a breaking change, a security footgun.
{% endhint %}
{% endtab %}
{% tab title="Markdown" %}
````md
{% hint style="info" %}
**Info** — background, a definition, a pointer elsewhere. The default style.
{% endhint %}

{% hint style="success" %}
**Success** — the recommended path, or what "done" looks like.
{% endhint %}

{% hint style="warning" %}
**Warning** — a gotcha, a requirement, something that will bite later.
{% endhint %}

{% hint style="danger" %}
**Danger** — data loss, a breaking change, a security footgun.
{% endhint %}
````
{% endtab %}
{% endtabs %}

### Anything goes inside

A hint's body is a full document: lists, code, tables, tabs, even a live demo.

{% tabs sync="example" %}
{% tab title="Preview" %}
{% hint style="warning" %}
**Live demos need a runtime.** Inline-file demos run only when the host passes one:

```tsx title="main.tsx"
import { createAlmostNodeDemoRuntime } from "@brett_lamy/docstream/playground"

<MarkdownContent markdown={md} demoRuntime={createAlmostNodeDemoRuntime()} />
```

- Folder demos (`{% demo src="…" %}` backed by a resolver) don't need it.
- Without either, the demo shows its code with a short note.
{% endhint %}
{% endtab %}
{% tab title="Markdown" %}
`````md
{% hint style="warning" %}
**Live demos need a runtime.** Inline-file demos run only when the host passes one:

```tsx title="main.tsx"
import { createAlmostNodeDemoRuntime } from "@brett_lamy/docstream/playground"

<MarkdownContent markdown={md} demoRuntime={createAlmostNodeDemoRuntime()} />
```

- Folder demos (`{% demo src="…" %}` backed by a resolver) don't need it.
- Without either, the demo shows its code with a short note.
{% endhint %}
`````
{% endtab %}
{% endtabs %}

| Attribute | Values | Default | Notes |
| --- | --- | --- | --- |
| `style` | `info`, `success`, `warning`, `danger` | `info` | Anything else — a typo, GitBook's older `tip` — falls back to `info`. |

{% hint style="info" %}
Keep hints to a sentence or two and don't stack more than two in a row: a page that is all callouts has no callouts.
{% endhint %}

## Tabs

`{% tabs %}` holds one `{% tab title="…" %}` per option. Each tab is a full document, and only the selected one is shown. Arrow keys move between tabs; the selected tab carries `aria-selected`.

{% tabs sync="example" %}
{% tab title="Preview" %}
{% tabs %}
{% tab title="Overview" %}
Tabs hold **any** blocks. This one has a list:

- Parser — Markdown to AST
- Renderer — AST to React
- Serializer — AST back to Markdown, byte-for-byte
{% endtab %}
{% tab title="With a hint" %}
{% hint style="success" %}
A hint inside a tab.
{% endhint %}

And a paragraph after it.
{% endtab %}
{% tab title="With a table" %}
| Package entry | What it adds |
| --- | --- |
| `@brett_lamy/docstream` | Parser, renderer, demos |
| `@brett_lamy/docstream/playground` | almost-node runtime for live code |
{% endtab %}
{% endtabs %}
{% endtab %}
{% tab title="Markdown" %}
````md
{% tabs %}
{% tab title="Overview" %}
Tabs hold **any** blocks. This one has a list:

- Parser — Markdown to AST
- Renderer — AST to React
- Serializer — AST back to Markdown, byte-for-byte
{% endtab %}
{% tab title="With a hint" %}
{% hint style="success" %}
A hint inside a tab.
{% endhint %}

And a paragraph after it.
{% endtab %}
{% tab title="With a table" %}
| Package entry | What it adds |
| --- | --- |
| `@brett_lamy/docstream` | Parser, renderer, demos |
| `@brett_lamy/docstream/playground` | almost-node runtime for live code |
{% endtab %}
{% endtabs %}
````
{% endtab %}
{% endtabs %}

A tab without a `title` is called "Tab". Lines between tabs that aren't inside a `{% tab %}` are ignored.

### Code-only tabs collapse

When **every** tab holds exactly one code block, the set renders as a single code block with the tabs in its header — the shape you want for "the same snippet in several languages". The copy button copies the selected tab, the header shows that tab's fence `title`, and when every fence is a shell language (`sh`, `bash`, `zsh`, `console`, `powershell` …) the header gets a terminal icon and line numbers are dropped.

{% tabs sync="example" %}
{% tab title="Preview" %}
{% tabs %}
{% tab title="TypeScript" %}
```ts title="slug.ts"
export function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
}
```
{% endtab %}
{% tab title="Python" %}
```python title="slug.py"
import re

def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
```
{% endtab %}
{% tab title="Rust" %}
```rust title="slug.rs"
pub fn slugify(text: &str) -> String {
    text.to_lowercase()
        .split(|c: char| !c.is_ascii_alphanumeric())
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join("-")
}
```
{% endtab %}
{% endtabs %}

{% tabs %}
{% tab title="macOS" %}
```sh
brew install ffmpeg
```
{% endtab %}
{% tab title="Debian" %}
```sh
sudo apt-get install -y ffmpeg
```
{% endtab %}
{% tab title="Windows" %}
```powershell
winget install --id Gyan.FFmpeg
```
{% endtab %}
{% endtabs %}
{% endtab %}
{% tab title="Markdown" %}
````md
{% tabs %}
{% tab title="TypeScript" %}
```ts title="slug.ts"
export function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
}
```
{% endtab %}
{% tab title="Python" %}
```python title="slug.py"
import re

def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
```
{% endtab %}
{% tab title="Rust" %}
```rust title="slug.rs"
pub fn slugify(text: &str) -> String {
    text.to_lowercase()
        .split(|c: char| !c.is_ascii_alphanumeric())
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join("-")
}
```
{% endtab %}
{% endtabs %}

{% tabs %}
{% tab title="macOS" %}
```sh
brew install ffmpeg
```
{% endtab %}
{% tab title="Debian" %}
```sh
sudo apt-get install -y ffmpeg
```
{% endtab %}
{% tab title="Windows" %}
```powershell
winget install --id Gyan.FFmpeg
```
{% endtab %}
{% endtabs %}
````
{% endtab %}
{% endtabs %}

Add a paragraph, a second fence, a live fence or a mermaid fence to any one tab and the set goes back to ordinary tabs.

{% hint style="info" %}
For npm / pnpm / yarn / bun, don't hand-write four tabs: write one `{% command %}` and docstream derives the rest. See [Install commands](05-code.md#install-commands).
{% endhint %}

## Synced tabs

Give tab sets the same `sync="key"` and they move together: choose a tab in one and every set with that key switches to the tab **with the same title** — on this page, on other pages, and on the reader's next visit. Sets that don't have a tab with that title keep their own choice.

{% tabs sync="example" %}
{% tab title="Preview" %}
{% tabs sync="lang" %}
{% tab title="TypeScript" %}
```ts
const doc = parseMarkdown(source)
```
{% endtab %}
{% tab title="JavaScript" %}
```js
const doc = parseMarkdown(source)
```
{% endtab %}
{% endtabs %}

Pick a language above, and this second set follows:

{% tabs sync="lang" %}
{% tab title="TypeScript" %}
```ts
import type { DocumentNode } from "@brett_lamy/docstream"

const html: string = renderToString(<DocsRenderer doc={doc as DocumentNode} />)
```
{% endtab %}
{% tab title="JavaScript" %}
```js
const html = renderToString(<DocsRenderer doc={doc} />)
```
{% endtab %}
{% endtabs %}
{% endtab %}
{% tab title="Markdown" %}
````md
{% tabs sync="lang" %}
{% tab title="TypeScript" %}
```ts
const doc = parseMarkdown(source)
```
{% endtab %}
{% tab title="JavaScript" %}
```js
const doc = parseMarkdown(source)
```
{% endtab %}
{% endtabs %}

Pick a language above, and this second set follows:

{% tabs sync="lang" %}
{% tab title="TypeScript" %}
```ts
import type { DocumentNode } from "@brett_lamy/docstream"

const html: string = renderToString(<DocsRenderer doc={doc as DocumentNode} />)
```
{% endtab %}
{% tab title="JavaScript" %}
```js
const html = renderToString(<DocsRenderer doc={doc} />)
```
{% endtab %}
{% endtabs %}
````
{% endtab %}
{% endtabs %}

Every **Preview / Markdown** switch on these pages is itself a synced tab set (`sync="example"`) — choose **Markdown** once and every example on the site shows its source.

- The choice is stored per key in `localStorage` and broadcast to the other tab sets on the page. `getSyncedTab`, `setSyncedTab` and the `useSyncedTab` hook are exported if your own UI should join a group.
- Use `sync="pm"` for package-manager tabs titled `npm` / `pnpm` / `yarn` / `bun`: that's the key [`{% command %}`](05-code.md#install-commands) boxes use, so hand-written tabs and command boxes agree.

## Section tabs

Add `title="…"` and the tab set becomes a **section**: the title renders as a real heading (anchored, and listed in the page outline), with the tabs as a pill switch beside it. It's the shape for "Installation" or "Usage" sections that have several methods. `level` picks the heading level — `2` (default), `3` or `4`.

{% tabs sync="example" %}
{% tab title="Preview" %}
{% tabs title="Add docstream to a project" level="3" sync="install-method" %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/docstream react react-dom{% endcommand %}

Then import the stylesheet once, at your app's entry:

```tsx lineNumbers="false"
import "@brett_lamy/docstream/styles.css"
```
{% endtab %}
{% tab title="From source" %}
```sh
git clone https://github.com/BLamy/ui/tree/main/packages/docstream && cd docstream
npm install && npm run build
```

Link the build into your app with `npm link`, or point a Vite alias at `src/index.ts` the way this site does.
{% endtab %}
{% endtabs %}
{% endtab %}
{% tab title="Markdown" %}
````md
{% tabs title="Add docstream to a project" level="3" sync="install-method" %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/docstream react react-dom{% endcommand %}

Then import the stylesheet once, at your app's entry:

```tsx lineNumbers="false"
import "@brett_lamy/docstream/styles.css"
```
{% endtab %}
{% tab title="From source" %}
```sh
git clone https://github.com/BLamy/ui/tree/main/packages/docstream && cd docstream
npm install && npm run build
```

Link the build into your app with `npm link`, or point a Vite alias at `src/index.ts` the way this site does.
{% endtab %}
{% endtabs %}
````
{% endtab %}
{% endtabs %}

### Tab attributes

| Tag | Attribute | Default | Meaning |
| --- | --- | --- | --- |
| `{% tabs %}` | `sync` | — | Sync group key. Same key → same choice, matched by tab title, remembered across pages and visits. |
| `{% tabs %}` | `title` | — | Turns the set into a titled section with pill tabs. |
| `{% tabs %}` | `level` | `2` | Heading level of `title`: `2`, `3` or `4`. Ignored without `title`. |
| `{% tab %}` | `title` | `Tab` | The tab's label (and its identity for `sync`). |

## Expandables

GitBook's expandable is an HTML `<details>` block. Leave a blank line after `<summary>` and before `</details>` and the body is full Markdown:

{% tabs sync="example" %}
{% tab title="Preview" %}
<details>

<summary>Why does my demo say "needs a runtime"?</summary>

An inline-file `{% demo %}` runs in almost-node, which the host has to provide:

```tsx
import { PlaygroundStreamdown } from "@brett_lamy/docstream/playground"
```

Folder demos backed by a `DemoResolver` run without it.

</details>

<details>

<summary>What can go inside?</summary>

Every other block:

{% hint style="success" %}
Hints, tabs, steppers, code, tables, demos.
{% endhint %}

- [x] Even task lists

</details>
{% endtab %}
{% tab title="Markdown" %}
````md
<details>

<summary>Why does my demo say "needs a runtime"?</summary>

An inline-file `{% demo %}` runs in almost-node, which the host has to provide:

```tsx
import { PlaygroundStreamdown } from "@brett_lamy/docstream/playground"
```

Folder demos backed by a `DemoResolver` run without it.

</details>

<details>

<summary>What can go inside?</summary>

Every other block:

{% hint style="success" %}
Hints, tabs, steppers, code, tables, demos.
{% endhint %}

- [x] Even task lists

</details>
````
{% endtab %}
{% endtabs %}

Edge cases worth knowing:

- `<summary>` may sit on the same line as `<details>` (`<details><summary>FAQ</summary>`) or on the next non-blank line.
- The summary is **plain text**: `**bold**` inside it shows the asterisks.
- The opening tag must be exactly `<details>` — `<details open>` isn't recognized, and expandables always start closed.
- Expandables don't nest: the first `</details>` closes the block. Put a nested level in a hint or tabs instead.
- Expandables are native `<details>` elements, so browser find-in-page opens them when it matches hidden text.

## Combining them

Blocks nest freely; around two levels deep is where pages stay readable. A typical troubleshooting section:

{% tabs sync="example" %}
{% tab title="Preview" %}
{% hint style="danger" %}
**`Cannot find module '@agent-wasm/core'`** — you rendered a live fence without installing the playground's peer.

{% tabs %}
{% tab title="Install it" %}
{% command %}npm install @agent-wasm/core{% endcommand %}
{% endtab %}
{% tab title="Or skip live code" %}
Render with `MarkdownContent` and don't pass a `liveRenderer`: `jsx live="true"` fences then show as ordinary highlighted code.
{% endtab %}
{% endtabs %}
{% endhint %}
{% endtab %}
{% tab title="Markdown" %}
````md
{% hint style="danger" %}
**`Cannot find module '@agent-wasm/core'`** — you rendered a live fence without installing the playground's peer.

{% tabs %}
{% tab title="Install it" %}
{% command %}npm install @agent-wasm/core{% endcommand %}
{% endtab %}
{% tab title="Or skip live code" %}
Render with `MarkdownContent` and don't pass a `liveRenderer`: `jsx live="true"` fences then show as ordinary highlighted code.
{% endtab %}
{% endtabs %}
{% endhint %}
````
{% endtab %}
{% endtabs %}

## Next

{% content-ref url="03-steppers.md" %}
Steppers — numbered walkthroughs with titles, thumbnails and nested steps
{% endcontent-ref %}

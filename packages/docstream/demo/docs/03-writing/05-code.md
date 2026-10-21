---
description: Code fences with titles, line numbers and copy buttons, GPU syntax highlighting, collapsible code panels, and install boxes that speak every package manager.
---

# Code

Code is most of what developers read in docs, so docstream gives fences real chrome: a file-name header, line numbers, a copy button, highlighting that follows your theme — and a `{% command %}` box that writes one install command for npm, pnpm, yarn and bun.

## Fences

Fence code with three or more backticks or tildes, and name the language right after the opening fence:

{% columns %}
{% column %}
````md
```ts
export const answer = 42
```

~~~sh
npm run build
~~~
````
{% endcolumn %}
{% column %}
```ts
export const answer = 42
```

~~~sh
npm run build
~~~
{% endcolumn %}
{% endcolumns %}

An untitled fence has no header: just the code, with a copy button that appears in its corner. Four-space **indented code blocks** are recognized too, with no language.

### Fences inside fences

The outer fence must be **longer** than any fence it contains — or use the other character. That's how every **Markdown** tab on this site shows its source:

`````md
````md
```ts
const x = 1
```
````
`````

A fence closes at the first line that starts with its own run of backticks, so a three-backtick fence can't hold a line beginning with three backticks.

## Titles

`title="…"` after the language adds a header with the file name, the language and a copy button. Titled fences show line numbers by default:

{% tabs sync="example" %}
{% tab title="Preview" %}
```tsx title="src/Docs.tsx"
import { MarkdownContent } from "@brett_lamy/docstream"
import "@brett_lamy/docstream/styles.css"

export function Docs({ markdown }: { markdown: string }) {
  return <MarkdownContent markdown={markdown} pageActions />
}
```
{% endtab %}
{% tab title="Markdown" %}
````md
```tsx title="src/Docs.tsx"
import { MarkdownContent } from "@brett_lamy/docstream"
import "@brett_lamy/docstream/styles.css"

export function Docs({ markdown }: { markdown: string }) {
  return <MarkdownContent markdown={markdown} pageActions />
}
```
````
{% endtab %}
{% endtabs %}

You can also leave the language out and write only attributes — ```` ```title="notes.txt" ```` — though the language is what tells readers (and the header) what they're looking at.

## Line numbers

| Fence | Line numbers |
| --- | --- |
| No `title` | Off |
| With a `title` | On |
| `lineNumbers="true"` / `"false"` | Forced on / off (`showLineNumbers` is accepted too) |

{% columns %}
{% column %}
```ts lineNumbers="true"
// Untitled, but numbered
const a = 1
const b = 2
```
{% endcolumn %}
{% column %}
```ts title="imports.ts" lineNumbers="false"
import { parseMarkdown } from "@brett_lamy/docstream"
```
{% endcolumn %}
{% endcolumns %}

````md
```ts lineNumbers="true"
// Untitled, but numbered
const a = 1
```

```ts title="imports.ts" lineNumbers="false"
import { parseMarkdown } from "@brett_lamy/docstream"
```
````

Turn numbers off for one- to three-line snippets — imports, a single command — where they're noise.

## Fence attributes

| Attribute | Applies to | Default | Effect |
| --- | --- | --- | --- |
| `title` | any fence | — | Header with file name, language and copy button; turns line numbers on. |
| `lineNumbers` | any fence | on if titled | `"true"` / `"false"`. Alias: `showLineNumbers`. |
| `live` | `jsx`, `tsx`, `react` | `false` | Run the fence as a live React preview — see [Live code](../04-interactive/03-live-code.md). |
| `entry` | live fences | `/src/main.jsx` | Virtual path of the file in the live project. |
| `collapsedCodeLines` | live fences | `3` | Source lines shown before **View Code**. |
| `expandedCodeLines` | live fences | `30` | Lines shown expanded before the panel scrolls. |

Attribute values are double-quoted. Inside one, write `"` as `\"`, `\` as `\\` and `%}` as `%\}`. Unknown attributes are kept in the source and ignored.

## Syntax highlighting

Highlighting comes from [gpu-lexer](https://www.npmjs.com/package/gpu-lexer), a **language-agnostic** tokenizer that runs on the GPU through WebGPU. It doesn't need a grammar per language, so every fence is highlighted — TypeScript, Python, Rust, Go, SQL, YAML, shell, WGSL, a language you invented last week — with the same small download:

{% tabs %}
{% tab title="Go" %}
```go title="main.go"
package main

import "fmt"

// Greet returns a greeting for name.
func Greet(name string) string {
	return fmt.Sprintf("Hello, %s!", name)
}

func main() { fmt.Println(Greet("docstream")) }
```
{% endtab %}
{% tab title="SQL" %}
```sql title="pages.sql"
-- The ten longest pages
SELECT slug, length(markdown) AS size
FROM pages
WHERE hidden = false
ORDER BY size DESC
LIMIT 10;
```
{% endtab %}
{% tab title="YAML" %}
```yaml title=".github/workflows/pages.yml"
name: Deploy docs
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm run build:demo
```
{% endtab %}
{% tab title="WGSL" %}
```wgsl title="tint.wgsl"
@fragment
fn main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
  let tint = vec3<f32>(0.36, 0.36, 0.84);
  return vec4<f32>(tint * uv.y, 1.0);
}
```
{% endtab %}
{% endtabs %}

Tokens fall into eight classes, each a CSS custom property with light and dark defaults. Override them to retheme every code block on the page:

```css title="theme.css"
:root {
  --docs-tok-keyword: #8839c4;
  --docs-tok-type: #a15c00;
  --docs-tok-function: #2f5bd3;
  --docs-tok-string: #23803a;
  --docs-tok-number: #c2410c;
  --docs-tok-constant: #c8283f;
  --docs-tok-operator: #0b7285;
  --docs-tok-comment: #6e6e7a;
}
```

The rest of the theme is on [Theming](../07-reference/01-theming.md). The language tag still matters — it labels the header, picks the shell treatment in tab sets, and switches on mermaid, live and music fences — but it doesn't change the colouring.

{% hint style="info" %}
Without WebGPU, code renders as plain, unhighlighted text — still selectable, copyable and numbered.
{% endhint %}

## Copy buttons

Every code surface has one:

| Block | What gets copied |
| --- | --- |
| Untitled fence | The code (button floats in the corner) |
| Titled fence | The code (button in the header) |
| Code-only [tab set](02-callouts-and-tabs.md#code-only-tabs-collapse) | The selected tab's code |
| `{% command %}` | The command for the selected package manager |
| Mermaid / math card | The diagram or TeX source |
| Demo code panel | The file shown |

Copy buttons write to the clipboard and confirm with a check mark. The `CopyButton` component and `copyText` helper are exported for your own chrome.

## Collapsible code

Under a live fence or a single-file demo, the source sits in a **collapsible panel**: the first few lines, then **View Code** to expand, with line numbers and a copy button. Tune it per fence with `collapsedCodeLines` and `expandedCodeLines`:

{% tabs sync="example" %}
{% tab title="Preview" %}
```jsx live="true" title="Counter" collapsedCodeLines="6" expandedCodeLines="12"
import { useState } from "react"
import { createRoot } from "react-dom/client"

function Counter() {
  const [count, setCount] = useState(0)
  return (
    <button onClick={() => setCount(count + 1)} style={{ padding: "8px 16px", borderRadius: 8 }}>
      Clicked {count} {count === 1 ? "time" : "times"}
    </button>
  )
}

createRoot(document.getElementById("root")).render(<Counter />)
```
{% endtab %}
{% tab title="Markdown" %}
````md
```jsx live="true" title="Counter" collapsedCodeLines="6" expandedCodeLines="12"
import { useState } from "react"
import { createRoot } from "react-dom/client"

function Counter() {
  const [count, setCount] = useState(0)
  return (
    <button onClick={() => setCount(count + 1)} style={{ padding: "8px 16px", borderRadius: 8 }}>
      Clicked {count} {count === 1 ? "time" : "times"}
    </button>
  )
}

createRoot(document.getElementById("root")).render(<Counter />)
```
````
{% endtab %}
{% endtabs %}

Live fences run only when the host passes a live renderer; without one, the same fence renders as an ordinary highlighted code block, so write it to read well as code too. More on [Live code](../04-interactive/03-live-code.md).

The panel is exported as `CollapsibleCode` for your own components:

```tsx title="Snippet.tsx"
import { CollapsibleCode } from "@brett_lamy/docstream"

export function Snippet({ source }: { source: string }) {
  return <CollapsibleCode code={source} language="tsx" collapsedLines={4} expandedLines={20} />
}
```

| Prop | Default | Meaning |
| --- | --- | --- |
| `code` | — | The source |
| `language` | — | Fence language (or `null`) |
| `collapsedLines` | `3` | Lines visible while collapsed; no toggle when the code is shorter |
| `expandedLines` | `30` | Lines visible when expanded before scrolling |
| `copy` | `true` | Show the copy button |
| `copyLabel` | — | Accessible label for the copy button |

## The legacy `{% code %}` wrapper

Older GitBook exports wrap a fence in `{% code %}` to give it a title. Docstream still reads it, with `title`, `lineNumbers`, `live` and `entry` attributes, and writes it back unchanged:

{% tabs sync="example" %}
{% tab title="Preview" %}
{% code title="legacy.js" lineNumbers="true" %}
```js
export const legacy = "still works"
```
{% endcode %}
{% endtab %}
{% tab title="Markdown" %}
````md
{% code title="legacy.js" lineNumbers="true" %}
```js
export const legacy = "still works"
```
{% endcode %}
````
{% endtab %}
{% endtabs %}

The wrapper's attributes replace the fence's own. For new pages, put the attributes on the fence.

## Install commands

`{% command %}` takes **one npm or npx command** and renders it as a terminal box with pnpm, npm, yarn and bun tabs and a copy button. You write the npm form; docstream derives the others.

{% tabs sync="example" %}
{% tab title="Preview" %}
{% command %}npm install @brett_lamy/docstream react react-dom{% endcommand %}

{% command %}npx shadcn@latest add https://example.com/r/composer.json{% endcommand %}
{% endtab %}
{% tab title="Markdown" %}
````md
{% command %}npm install @brett_lamy/docstream react react-dom{% endcommand %}

{% command %}npx shadcn@latest add https://example.com/r/composer.json{% endcommand %}
````
{% endtab %}
{% endtabs %}

Pick a manager in either box and every command box on the site follows — they share the `pm` [sync key](02-callouts-and-tabs.md#synced-tabs), remembered across visits. A reader who hasn't chosen sees pnpm first.

### How commands are derived

Try it — this is the same `packageManagerCommands` function the box calls:

{% demo src="writing-code/command" %}

| npm | pnpm | yarn | bun |
| --- | --- | --- | --- |
| `npm install x` (`i`, `add`) | `pnpm add x` | `yarn add x` | `bun add x` |
| `npm install` | `pnpm install` | `yarn install` | `bun install` |
| `npm install -D x` | `pnpm add -D x` | `yarn add -D x` | `bun add -d x` |
| `npm install -E x` | `pnpm add -E x` | `yarn add -E x` | `bun add --exact x` |
| `npm install -g x` | `pnpm add -g x` | `yarn global add x` | `bun add -g x` |
| `npm uninstall x` | `pnpm remove x` | `yarn remove x` | `bun remove x` |
| `npm ci` | `pnpm install --frozen-lockfile` | `yarn install --frozen-lockfile` | `bun install --frozen-lockfile` |
| `npx x` / `npm exec x` | `pnpm dlx x` | `yarn dlx x` | `bunx x` |
| `npm run build -- --watch` | `pnpm build --watch` | `yarn build --watch` | `bun run build -- --watch` |
| `npm test` / `start` | `pnpm test` | `yarn test` | `bun run test` |
| `npm create vite@latest app` | `pnpm create vite@latest app` | `yarn create vite@latest app` | `bun create vite@latest app` |
| `npm update` | `pnpm update` | `yarn upgrade` | `bun update` |

- `-y` / `--yes` are dropped from `npx`; `-S` / `--save` are dropped everywhere; `-P` / `--save-prod` becomes pnpm's `-P` and is dropped for yarn and bun. Unknown flags pass through.
- A command may span **several lines**, and `a && b` chains convert part by part. Lines that aren't npm commands (`cd app`, comments) are kept as written, and a leading `$ ` prompt survives.

### Multi-line commands

{% tabs sync="example" %}
{% tab title="Preview" %}
{% command %}
npm create vite@latest my-docs -- --template react-ts
cd my-docs
npm install @brett_lamy/docstream && npm run dev
{% endcommand %}
{% endtab %}
{% tab title="Markdown" %}
````md
{% command %}
npm create vite@latest my-docs -- --template react-ts
cd my-docs
npm install @brett_lamy/docstream && npm run dev
{% endcommand %}
````
{% endtab %}
{% endtabs %}

### Overrides and sync keys

When a derivation isn't what you want, give that manager its command verbatim with a `pnpm`, `yarn` or `bun` attribute. `sync` moves the box to its own group:

{% tabs sync="example" %}
{% tab title="Preview" %}
{% command bun="bun add @brett_lamy/docstream --trust" yarn="yarn add @brett_lamy/docstream --ignore-engines" %}npm install @brett_lamy/docstream{% endcommand %}
{% endtab %}
{% tab title="Markdown" %}
````md
{% command bun="bun add @brett_lamy/docstream --trust" yarn="yarn add @brett_lamy/docstream --ignore-engines" %}npm install @brett_lamy/docstream{% endcommand %}
````
{% endtab %}
{% endtabs %}

| Attribute | Default | Meaning |
| --- | --- | --- |
| `pnpm`, `yarn`, `bun` | derived | The command for that manager, used verbatim |
| `sync` | `pm` | Sync key. Boxes and `{% tabs %}` sharing a key share the reader's choice. |

{% hint style="info" %}
The one-line form `{% command %}…{% endcommand %}` must open and close on the same line. While an answer streams in, docstream holds a half-written one-line command back until its end tag arrives, so readers never see a box flash with a truncated command.
{% endhint %}

## Next

{% content-ref url="06-math-and-diagrams.md" %}
Math and diagrams — KaTeX equations and Mermaid diagrams drawn by Pele
{% endcontent-ref %}

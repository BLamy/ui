---
description: Install docstream, its peers and the stylesheet, and see exactly what loads up front and what waits until a page needs it.
---

# Installation

docstream is one package, `@brett_lamy/docstream`. It ships compiled ES modules with type declarations, needs no bundler configuration, and runs no install scripts — so `pnpm add` finishes without build-script prompts.

{% command %}npm install @brett_lamy/docstream react react-dom{% endcommand %}

{% hint style="info" %}
React and React DOM (18 or newer) are peer dependencies: docstream uses your app's copy. Everything else it needs — the GitBook parser, the code highlighter, Pele, KaTeX, rrweb, Strudel — is a regular dependency and installs with it.
{% endhint %}

## Peer dependencies

| Peer | Range | Required | Needed for |
| --- | --- | --- | --- |
| `react` | `>=18` | Yes | Everything that renders. |
| `react-dom` | `>=18` | Yes | Everything that renders. |
| `@agent-wasm/core` | `>=0.4.0` | Optional | The `@brett_lamy/docstream/playground` entry: live code fences and runnable inline `{% demo %}` files, run by almost-node (a Vite dev server in the browser). |
| `@brett_lamy/viz-engine` | `>=0.2.0` | Optional | The `@brett_lamy/docstream/viz` entry: `VizEmbed`. |
| `vite` | `>=5` | Optional | The `@brett_lamy/docstream/vite` plugin (`docstreamSources`), imported from `vite.config.ts`. |

The optional peers are only ever imported by their own entry. A test (`src/entry-boundary.test.ts`) walks the module graph of every other entry — static, type-only and dynamic imports — and fails if almost-node shows up, so an app that never installs `@agent-wasm/core` typechecks and bundles cleanly.

{% tabs title="Optional features" level="3" %}
{% tab title="Playground" %}
Run live React code fences and inline-file demos in the page:

{% command %}npm install @agent-wasm/core{% endcommand %}

```tsx lineNumbers="false"
import { GitbookStreamdown } from "@brett_lamy/docstream/playground" // = PlaygroundStreamdown
```

The runtime needs almost-node's service worker at `/__sw__.js`: add `almostnodePlugin()` from `@agent-wasm/core/vite` to your Vite dev server, or serve `getServiceWorkerContent()` from `@agent-wasm/core/next` in production. See [Live code](../04-interactive/03-live-code.md).
{% endtab %}

{% tab title="Viz engine" %}
Mount deterministic `@brett_lamy/viz-engine` scenes in a document:

{% command %}npm install @brett_lamy/viz-engine{% endcommand %}

```tsx lineNumbers="false"
import { VizEmbed } from "@brett_lamy/docstream/viz"
```

The `/viz` entry imports `@brett_lamy/viz-engine/styles.css` itself. See [Viz](../05-media/07-viz.md).
{% endtab %}

{% tab title="Vite source mounts" %}
Render (and edit) real component and Storybook files from Markdown:

```ts title="vite.config.ts"
import { defineConfig } from "vite"
import { docstreamSources } from "@brett_lamy/docstream/vite"

export default defineConfig({
  plugins: [docstreamSources({ mounts: [{ name: "demo", root: "src/examples" }] })],
})
```

`/vite` is Node-only — import it from `vite.config.ts`, never from browser code. See [Vite plugin](../07-reference/05-vite-plugin.md).
{% endtab %}
{% endtabs %}

## Import the stylesheet

Import the CSS once, at your app's entry:

```ts title="main.tsx" lineNumbers="false"
import "@brett_lamy/docstream/styles.css"
```

`styles.css` covers every block the renderer draws — headings, hints, tabs, code, demos, the replay player, the Strudel rack — and pulls in the property-sheet and task-checkbox styles. Its colors come from `--gb-*` tokens that read shadcn-style host tokens (`--card`, `--border`, `--primary`, …) with neutral defaults, so it looks right with no setup and follows your theme when there is one. See [Theming](../07-reference/01-theming.md).

If you use `DocumentProperties` or `TaskCheckbox` on their own, outside a rendered document, their styles are separate entries too:

```ts lineNumbers="false"
import "@brett_lamy/docstream/properties/styles.css"
import "@brett_lamy/docstream/tasks/styles.css"
```

### TypeScript and CSS imports

If your type-check rejects side-effect CSS imports, include Vite's client types, or declare CSS modules yourself:

{% tabs %}
{% tab title="Vite" %}
```ts title="src/vite-env.d.ts"
/// <reference types="vite/client" />
```
{% endtab %}
{% tab title="Any bundler" %}
```ts title="src/css.d.ts"
declare module "*.css"
```
{% endtab %}
{% endtabs %}

## What loads, and when

The renderer itself is small; the heavy pieces wait behind dynamic `import()` until a page actually contains the block that needs them.

| Feature | Library | Loads |
| --- | --- | --- |
| ```` ```mermaid ```` fences | [Pele](https://pele.run) (`pele/lazy`) | When a diagram mounts — and only the diagram types the page uses. |
| `$$ … $$` math | KaTeX (+ its stylesheet) | On the first formula. Until then the TeX source shows in its place. |
| Replay players (event lists, `.rrweb` files) | rrweb | In the lazily loaded stage chunk. Pages that only embed Loop QA URLs never download it. |
| ```` ```strudel ```` fences, `.strudel` embeds | `@strudel/web` | On the first press of Play. Samples load then too. |
| The Strudel rack's syntax tree | acorn | When a reader opens the rack. |
| Live code / inline demos | almost-node (`@agent-wasm/core`) | Only via `/playground`, and lazily even there. |
| Code highlighting | `gpu-lexer` | Asynchronously per block; code shows unhighlighted until it's ready. |

The bundle-boundary tests enforce the rrweb and acorn rows: no entry may import either one statically (acorn is allowed statically only in `/strudel`, which is the parser's own entry).

{% hint style="success" %}
To keep a bundle smaller still, import a narrower entry: `@brett_lamy/docstream/gitbook` is the parser and serializer with no React, `@brett_lamy/docstream/streamdown` is just the streaming renderer. See [Package entries](03-package-entries.md).
{% endhint %}

## Framework notes

{% tabs %}
{% tab title="Vite" %}
Nothing to configure. Vite pre-bundles docstream like any dependency — no `optimizeDeps` entries needed.

For monorepos that want to compile docstream from its TypeScript sources instead of `dist/`, every entry also has a `source` export condition (`./src/*.ts(x)`). Add `"source"` to Vite's `resolve.conditions` (keeping Vite's defaults after it), and to TypeScript's `customConditions` so the type-check follows the same files.
{% endtab %}

{% tab title="Next.js" %}
docstream is plain ESM, so no `transpilePackages` entry is needed.

docstream's modules don't carry a `"use client"` directive, and the renderers use hooks (state, effects, context). In the App Router, render them from a client component:

```tsx title="app/docs/answer.tsx"
"use client"

import { GitbookStreamdown } from "@brett_lamy/docstream"

export function Answer({ text, done }: { text: string; done: boolean }) {
  return <GitbookStreamdown markdown={text} isStreaming={!done} />
}
```

Import `@brett_lamy/docstream/styles.css` from your root layout. The pure parser (`@brett_lamy/docstream/gitbook`) has no React and is safe in server components, route handlers and edge functions.
{% endtab %}

{% tab title="SSR and Node" %}
Every `dist/` entry except `/playground` and `/viz` imports in plain Node without a bundler — the entry-boundary test checks exactly this — so server rendering, a host's vitest and the `/vite` plugin can all load docstream.

What to expect from a server render:

- Lazy renderers render their placeholder: a mermaid card shows "Drawing…", a math block shows its TeX, until the browser loads Pele or KaTeX after hydration.
- Synced tab sets render their first tab; the reader's saved choice (from `localStorage`) applies after hydration.
- File-backed demos load through the resolver asynchronously. To have them settled for the first render (static export, SSR), call `preloadDemos(resolver, srcs)` first — see [Demos](../04-interactive/01-demos.md).
{% endtab %}
{% endtabs %}

## Next

{% content-ref url="02-quick-start.md" %}
Quick start — from an empty component to a rendered page, a streaming answer and a live demo
{% endcontent-ref %}

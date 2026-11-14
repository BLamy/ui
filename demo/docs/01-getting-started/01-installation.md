---
description: Install docstream, its peers and the stylesheet, and see exactly what loads up front and what waits until a page needs it.
---

# Installation

docstream is one package, `@brett_lamy/docstream`. It ships compiled ES modules with type declarations, needs no bundler configuration, and runs no install scripts — so `pnpm add` finishes without build-script prompts.

{% command %}npm install @brett_lamy/docstream react react-dom @ui-sdk/core@beta @ui-sdk/react@beta{% endcommand %}

{% hint style="info" %}
React and React DOM (19 or newer) and [UI SDK](https://ui-sdk.dev) (`@ui-sdk/core` and `@ui-sdk/react`) are peer dependencies: docstream uses your app's copy. Its interactive parts (tabs, menus, popovers, hover cards, the site's sidebar and search, the replay and Strudel controls) are UI SDK components, sharing one copy of its core with your app. Everything else it needs — the GitBook parser, the code highlighter, Pele, KaTeX, rrweb, Strudel — is a regular dependency and installs with it.
{% endhint %}

## Peer dependencies

| Peer | Range | Required | Needed for |
| --- | --- | --- | --- |
| `react` | `>=19` | Yes | Everything that renders. |
| `react-dom` | `>=19` | Yes | Everything that renders. |
| `@ui-sdk/core` | `^0.1.0-beta.2` | Yes | The behaviors under every interactive part: keyboard, focus, dismissal, ARIA. |
| `@ui-sdk/react` | `^0.1.0-beta.2` | Yes | The UI SDK components docstream renders. |
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

### The `ui-sdk` layer

UI SDK adds a little CSS of its own (keeping closed popups hidden, for one) in a cascade layer named `ui-sdk` once a component mounts. `styles.css` declares that layer first, so docstream's rules win over it. If you import the stylesheet inside a layer of your own — `@import "@brett_lamy/docstream/styles.css" layer(docs)`, or through Tailwind's layers — declare it yourself at the very top of your global stylesheet, above `@import "tailwindcss"`:

```css title="app.css" lineNumbers="false"
@layer ui-sdk;
```

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

Only docstream's UI SDK part modules carry a `"use client"` directive; the renderers use hooks (state, effects, context) without one. In the App Router, render them from a client component:

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

## Upgrading to 2.0

2.0 rebuilds the interactive UI on UI SDK. Rendering, the parser and every component's props stay the same; this is what a host changes:

{% stepper %}
{% step %}
### React 19

`react` and `react-dom` are `>=19` now, as UI SDK requires (`@types/react` 19.2.10 or newer with TypeScript).
{% endstep %}
{% step %}
### Install the two UI SDK peers

{% command %}npm install @brett_lamy/docstream@2 @ui-sdk/core@beta @ui-sdk/react@beta{% endcommand %}

Both are peer dependencies (`^0.1.0-beta.2`), so your app and docstream share one copy of the core.
{% endstep %}
{% step %}
### Declare the layer, if you layer docstream

Importing `styles.css` inside a cascade layer (or Tailwind's)? Put `@layer ui-sdk;` at the top of your global stylesheet. A plain import needs nothing.
{% endstep %}
{% step %}
### Update custom styles that target state or markup

Widget state is styled from UI SDK's attributes now (`data-selected`, `data-open`, `data-pressed`, `data-checked`, `data-highlighted`, `data-current`, `data-starting-style` / `data-ending-style`), not `aria-*` or helper classes. Where UI SDK owns a part's `data-slot`, docstream's old name moved to `data-part`. Every hook that changed:

| Where | 1.x | 2.0 |
| --- | --- | --- |
| Tabs | `.docs-tab-active` | `.docs-tab[data-selected]`; one `.docs-tab-indicator` per strip |
| Pills | `.docs-pill[aria-selected="true"]`, `[aria-checked="true"]` | `.docs-pill[data-selected]`, `[data-checked]`; one `.docs-pill-indicator` |
| Page actions | `.docs-page-actions-caret-open` | `.docs-page-actions-more[data-open] .docs-page-actions-caret` |
| Tasks | `.docs-task-tooltip`; the checkbox an `input` | `.docs-tooltip`; the checkbox a `button[role=checkbox]` (`[data-checked]` / `[data-indeterminate]`) |
| Expandables, properties, OpenAPI | `<details>` with `.docs-expandable summary`, `.oas-response summary` | server HTML: still `<details>` / `<summary>` (`details[open]`); hydrated: `.docs-expandable-trigger`, `.oas-response-trigger`, `.docs-properties-trigger` buttons with `[data-open]`, panels `[hidden="until-found"]` while closed |
| Demo viewer | `.docs-demo-vp[aria-pressed]`, `.docs-demo-file[aria-selected]`, `.docs-demo-crumb[aria-expanded]` | `[data-pressed]`, `[data-selected]`, `[data-open]` |
| Demo viewer | `--docs-demo-files-w`; `--crumb-x` / `--crumb-y` | `--resizable-panel-size` on `.docs-demo-files-pane`; UI SDK places the crumb menu |
| Demo breadcrumb | segments `aria-haspopup` in server HTML | set once hydrated (the segments are triggers outside the one menu) |
| Site sidebar | `.ds-site-nav-row`; `aria-current` on the row; `.ds-site-nav-toggle` a `button`; `.ds-site-nav-children` a `div` | a UI SDK tree: `[data-slot="tree-item"]`, `.ds-site-nav-link[data-current]`; `.ds-site-nav-toggle` an indicator `span` inside the link (`[data-expanded]`); `.ds-site-nav-children` a `ul` |
| Site search | `.ds-site-search-hit[aria-selected]` | `[data-highlighted]` |
| Site overlays | drawer and search `position: absolute` in the site | the top layer. A site that is the page: modal over the window. An embedded site (`routing="memory"`, `.ds-site[data-embedded]`): `modal="trap-focus"` (host page stays usable), placed from `--ds-site-frame-top` / `-left` / `-width` / `-height` |
| Strudel | `.strudel-device__toggle[aria-pressed]`, `.docstream-strudel__toggle[aria-expanded]` | `[data-pressed]`, `[data-open]` |
| Replay | `[data-slot="replay-devtools-pane"]`, `-tablist`, `-section`, `-button`, `-buttons`, `-chips`, `-node`, `-code`, `-detail-body`, `[data-slot="replay-preview-captions"]` | the same names in `data-part` |
| Replay | the DevTools panel `role="dialog"` | a `section` named "DevTools" (a region docked in the player) |
| Replay | the scrubber fill from `--replay-progress` / `--replay-progress-start` on the track; `--replay-window-start` / `-size` on `[data-slot="replay-preview-window"]` | `[data-slot="slider-indicator"]`; the window's `--replay-window-start` / `-size` on the scrubber, `[data-slot="replay-preview-scrubber"][data-window]` |

No export was added or removed, and every component keeps its props.
{% endstep %}
{% step %}
### Expect popups and some keys to change

Menus, hover cards, search and the demo's fullscreen view render in place in the browser's top layer rather than in a portal, and hover-card content mounts only while open. Menus of choices (a task's state, a breadcrumb's files) open on the current item.

The rack's knobs take Shift+Arrow as the large step and Alt+Arrow as the fine one (Shift was fine). The fader is a slider: pressing the track jumps the thumb there (the drag was relative). A module's grip picks it up with Space or Enter before the arrows move it. In the replay player, Left and Right on the Console / Network buttons move between the two instead of seeking ±5 s.
{% endstep %}
{% step %}
### Drop react-aria if only docstream needed it

docstream no longer depends on `react-aria`: the Copy demo button writes its clipboard on the copy event itself.
{% endstep %}
{% endstepper %}

## Next

{% content-ref url="02-quick-start.md" %}
Quick start — from an empty component to a rendered page, a streaming answer and a live demo
{% endcontent-ref %}

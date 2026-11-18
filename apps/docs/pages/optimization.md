# Optimization

Two install paths, one set of source files. This page shows what each costs in a real app, how to keep bundles small with Vite and Next.js, and how to pick.

## Measured

Numbers from production builds of a fresh shadcn app (`shadcn create --base aria`, Vite 8, Tailwind 4, React 19), gzip level 6, one entry chunk. "Registry" is `npx shadcn add <item>`; "npm" is `npm install @brett_lamy/ui` (3.0.0) with `import '@brett_lamy/ui/styles.css'`. The app imports only what the row says. These numbers were measured on 3.0.0, when the parts were built on react-aria-components; 6.0's UI SDK parts have not been re-measured yet, so read them as an order of magnitude.

| App imports | Install | JS (raw / gzip) | CSS (raw / gzip) |
| --- | --- | --- | --- |
| nothing from BL UI (the shadcn starter) | — | 222.0 kB / 68.8 kB | 31.0 kB / 7.2 kB |
| `Button` | registry | 432.1 kB / 136.1 kB | 41.1 kB / 9.0 kB |
| `Button` | npm | 431.9 kB / 136.0 kB | 200.2 kB / 33.6 kB |
| `SplitView` (sidebar + detail) | registry | 481.2 kB / 152.9 kB | 48.5 kB / 10.4 kB |
| `SplitView` (sidebar + detail) | npm | 481.4 kB / 153.2 kB | 200.2 kB / 33.6 kB |

What the numbers say:

- **JavaScript is the same either way.** The npm package is built with one output module per source module and `sideEffects` limited to CSS, so a bundler drops what you don't import. Importing `Button` (from `@brett_lamy/ui/button` or from the root) does not pull the Composer: the root exports only the core, and the Composer is the entry `@brett_lamy/ui/composer`.
- **CSS is where they differ.** The registry adds Tailwind utilities only for the classes in the files you copied, because Tailwind scans your source. The npm stylesheet is precompiled for the whole library, including the Markdown editor's styles, so it is roughly 3–4× larger in gzip whatever you import. (Docstream's own sheet, `@brett_lamy/ui/docstream/styles.css`, is separate: import it when you render Markdown; KaTeX's styles load with the first math block.)
- **Motion was the real cost.** On 3.0.0 `Button` alone added about 210 kB raw (67 kB gzip) of JavaScript, because its label morph uses `framer-motion`. In 6.0 a Button no longer loads it: the animation engine is a chunk of its own that arrives after first paint (see [What already waits](#vite)). Measured with `pnpm size`, a Button went from 64.4 kB to 21.5 kB gzipped.

Your numbers will differ with your app, plugins and browser targets. To measure yours, run `vite build` (or `next build`) with and without the import.

## What an entry costs

The numbers above are from 3.0.0. For 6.0 the package measures itself. `pnpm size` (`tools/size/measure.mjs`) bundles every library entry on its own from the built package the way an app's bundler would (Rolldown, the bundler under Vite: minified, tree-shaken, code-split, with React and the optional peers left out and every other dependency counted in), and reports for each:

| | What it is |
| --- | --- |
| `load` | What the browser must fetch before the entry works: its chunk and everything it imports statically |
| `lazy` | What it may fetch later: the chunks behind a dynamic `import()` (KaTeX, Mermaid, the Cloudflare catalog) |

Both are minified and gzipped. Stylesheets, worker scripts, the wasm an entry loads by URL and the optional peers are not counted. Each library's page under [Libraries](https://blamy.github.io/ui/#/libraries) shows its numbers.

Two things are checked in CI and before a version is published (`pnpm size --check`), because they are what "you only ship what you import" rests on:

- **Budgets.** What a library entry loads, and what one import loads (a Button, a Dialog: the floor an app pays), may not grow past its budget (`tools/size/budget.json`, set 5% over what was measured).
- **Tree-shaking.** One name imported from a library entry (`import { Waveform } from '@brett_lamy/ui/audio'`) or from the root costs what its own module entry costs (`@brett_lamy/ui/waveform`), within a small tolerance.

Entries share code and never carry a copy each: the package is one file per module, UI SDK included, so two entries that use a module import the same file. `pnpm size --why @brett_lamy/ui/button` lists what an entry is made of, largest first.

## Registry or npm

| | Registry | npm |
| --- | --- | --- |
| You get | source files in your repo | one dependency |
| Unused code | never installed | dropped by the bundler |
| CSS | only the classes you use | the whole precompiled sheet (import once) |
| Change a component | edit your copy | wrap it, or override with `className` and [variables](https://blamy.github.io/ui/#/theming) |
| Updates | `shadcn add … -o` and review the diff | `npm update` |
| Best for | a product you will restyle | trying it, prototypes, several apps sharing one version |

Start with the registry for a product. Use npm when you want the parts unmodified, and switch later: every module is a package entry at the registry's path (`@/components/ui/dialog` ↔ `@brett_lamy/ui/dialog`, `@/lib/theme` ↔ `@brett_lamy/ui/lib/theme`), so your own code only changes the prefix of its imports. Either way `@brett_lamy/ui` is in your `node_modules`: the registry copies BL UI's source, and UI SDK and docstream come from the package.

## Vite

- **Import from the module.** With the package, import each part from its module's entry: `import { Button } from '@brett_lamy/ui/button'`. A production build tree-shakes the root (`@brett_lamy/ui`) and a library entry (`@brett_lamy/ui/time`) just as well, but the dev server and the type checker then load a whole index to resolve one name; a module entry loads only that module and what it imports.
- **Split the heavy parts.** The Composer (a TipTap editor), the Markdown renderer with syntax highlighting, maps and session replay load libraries you may not need on first paint. Load them lazily:

  ```tsx
  import { lazy, Suspense } from 'react'

  const Composer = lazy(() =>
    import('@/components/ui/composer').then((m) => ({ default: m.Composer })),
  )
  ```

  With the package it is the same line on `@brett_lamy/ui/composer`. A lazy import of the root would put the whole core behind the split point, and a lazy import of a library entry the whole library: split on a module's entry (`@brett_lamy/ui/markdown-editor`, not `@brett_lamy/ui/markdown`) when you want one part.

  Composer is a family of parts, so lazy-load the module that renders the whole composition (your `PromptBox` component) rather than one part at a time.
- **What already waits.** Some costs are deferred for you. The animation engine (framer-motion, about 29 kB gzipped for what the kit's everyday parts use) is one chunk that the kit fetches when the browser is idle, once a part that can animate has mounted: a Button, a Toast, a List, a Chevron or an AnimatedHeight draws without it, and a change that comes before it has arrived shows at once instead of animating ([Motion](https://blamy.github.io/ui/#/motion) says how to fetch it sooner). NumberMorph, Morph and Celebrate import framer-motion themselves. Docstream loads Mermaid (Pele), KaTeX and rrweb only when a page shows a diagram, math or a replay, and Strudel on the first play; the diagrams load ELK, in a worker, only when a layout is asked for; StateDiagram loads XState when it mounts (and Babel's parser only for `source`), CloudflareDiagram only for a service with a machine, and docstream's xstate fence loads StateDiagram itself only when a fence is shown; the Cloudflare catalog (about 26 kB gzipped) and `jsonc-parser` are only on `@brett_lamy/ui/cloudflare` (CloudflareDiagram's one entry), so no other import reaches them.
- **Pre-bundle in dev.** Vite discovers dependencies as they are first imported, and a late discovery reloads the page. The docs app lists the TipTap packages, and the libraries docstream loads lazily, in `optimizeDeps.include` for that reason (`apps/docs/vite.config.mts`); do the same for any package Vite reports as newly found. Docstream itself needs no entry: from `node_modules` it is pre-bundled like any dependency.
- **Chunking.** If one vendor chunk grows, `build.rollupOptions.output.manualChunks` can put UI SDK (the modules under `node_modules/@brett_lamy/ui/dist/vendor/ui-sdk`) in its own long-cached chunk. Measure before and after: most parts use it, and splitting it rarely shrinks the total. `framer-motion` needs no rule for the everyday parts: it is already a chunk of its own, behind the kit's one dynamic import. That holds unless your page also renders a part that imports it itself (`NumberMorph`, so `Progress` and `ProgressRing`; `Morph`; `Celebrate`) or your own code imports framer-motion: then it is in the static graph, and the lazy chunk is a few bytes of re-exports.

## Next.js

- **Server and client.** Component modules start with `'use client'` (in both the package and the registry copies), so a server component can import and render them. Props that are functions (`onClick`, `onValueChange`) have to come from a client component. See [Installation](https://blamy.github.io/ui/#/installation).
- **Browser-only parts.** Load anything that touches the browser on first paint with `next/dynamic`:

  ```tsx
  'use client'
  import dynamic from 'next/dynamic'

  const ReplayPreview = dynamic(
    () => import('@/components/ui/replay-preview').then((m) => m.ReplayPreview),
    { ssr: false },
  )
  ```
- **Root imports (npm).** Module entries (`@brett_lamy/ui/button`) need nothing. If you import from the root, `experimental.optimizePackageImports: ['@brett_lamy/ui']` in `next.config` makes Next rewrite those imports to the module that defines each name.
- **Tailwind sources.** With the registry, your copied files are already in your project, so nothing extra is needed. With npm, import `@brett_lamy/ui/styles.css` once in the root layout, and add `@source '../node_modules/@brett_lamy/ui'` only if you want Tailwind to generate utilities for class names you pass into its components.
- **`transpilePackages`** is not needed: the package ships compiled ESM.

## Keep it small in your own code

- Import a part where you use it; a page that never renders the Composer never loads the editor.
- Prefer the [variables](https://blamy.github.io/ui/#/theming) and [recipes](https://blamy.github.io/ui/#/styling) over new one-off classes: they reuse what is already in the stylesheet.
- Drop `bl-theme` if you keep your own shadcn theme; it only adds the iOS palette and scopes.

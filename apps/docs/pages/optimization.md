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

- **JavaScript is the same either way.** The npm package is built with one output module per source module and `sideEffects` limited to CSS, so a bundler drops what you don't import. Importing `Button` (from `@brett_lamy/ui/button` or from the root) does not pull the Composer.
- **CSS is where they differ.** The registry adds Tailwind utilities only for the classes in the files you copied, because Tailwind scans your source. The npm stylesheet is precompiled for the whole library, including the Markdown editor's styles, so it is roughly 3–4× larger in gzip whatever you import. (Docstream's own sheet, `@brett_lamy/ui/docstream/styles.css`, is separate: import it when you render Markdown; KaTeX's styles load with the first math block.)
- **Motion is the real cost.** `Button` alone adds about 210 kB raw (67 kB gzip) of JavaScript, because its label morph uses `framer-motion`. That is the price of the springs; it is shared by every other part, so `SplitView` adds only 49 kB raw on top of `Button`.

Your numbers will differ with your app, plugins and browser targets. To measure yours, run `vite build` (or `next build`) with and without the import.

## Registry or npm

| | Registry | npm |
| --- | --- | --- |
| You get | source files in your repo | one dependency |
| Unused code | never installed | dropped by the bundler |
| CSS | only the classes you use | the whole precompiled sheet (import once) |
| Change a component | edit your copy | wrap it, or override with `className` and [variables](https://blamy.github.io/ui/#/theming) |
| Updates | `shadcn add … -o` and review the diff | `npm update` |
| Best for | a product you will restyle | trying it, prototypes, several apps sharing one version |

Start with the registry for a product. Use npm when you want the parts unmodified, and switch later: every module is a package entry at the registry's path (`@/components/ui/dialog` ↔ `@brett_lamy/ui/dialog`, `@/lib/theme` ↔ `@brett_lamy/ui/lib/theme`), so your own code only changes the prefix of its imports.

## Vite

- **Import from the module.** With the package, import each part from its module's entry: `import { Button } from '@brett_lamy/ui/button'`. A production build tree-shakes the root (`@brett_lamy/ui`) just as well, but the dev server and the type checker then load the whole index to resolve one name; a module entry loads only that module and what it imports.
- **Split the heavy parts.** The Composer (a TipTap editor), the Markdown renderer with syntax highlighting, maps and session replay load libraries you may not need on first paint. Load them lazily:

  ```tsx
  import { lazy, Suspense } from 'react'

  const Composer = lazy(() =>
    import('@/components/ui/composer').then((m) => ({ default: m.Composer })),
  )
  ```

  With the package it is the same line on `@brett_lamy/ui/composer`. A lazy import of the root would put the whole library behind the split point.

  Composer is a family of parts, so lazy-load the module that renders the whole composition (your `PromptBox` component) rather than one part at a time.
- **What already waits.** Some costs are deferred for you. Docstream loads Mermaid (Pele), KaTeX and rrweb only when a page shows a diagram, math or a replay, and Strudel on the first play; the diagrams load ELK, in a worker, only when a layout is asked for, and CloudflareDiagram loads XState only for a service with a machine; the Cloudflare catalog (about 26 kB gzipped) and `jsonc-parser` are only on `@brett_lamy/ui/cloudflare` (CloudflareDiagram's one entry), so no other import reaches them.
- **Pre-bundle in dev.** Vite discovers dependencies as they are first imported, and a late discovery reloads the page. The docs app lists the TipTap packages, and the libraries docstream loads lazily, in `optimizeDeps.include` for that reason (`apps/docs/vite.config.mts`); do the same for any package Vite reports as newly found. Docstream itself needs no entry: from `node_modules` it is pre-bundled like any dependency.
- **Chunking.** If one vendor chunk grows, `build.rollupOptions.output.manualChunks` can put `framer-motion` and `@ui-sdk/react` / `@ui-sdk/core` in their own long-cached chunks. Measure before and after: the two are used together by most parts, and splitting them rarely shrinks the total.

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

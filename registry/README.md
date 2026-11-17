# registry

Source for the shadcn registry (`registry.json` at the repo root, built into the docs site under `/r`, i.e.
`https://blamy.github.io/ui/r/<item>.json`). The registry is **source-copy**: `shadcn add` writes the item's files into the
app, and the app's own bundler tree-shakes. The full explanation, with examples, is the docs page
[How the registry works](https://blamy.github.io/ui/#/registry).

## Where items come from

- **Library items** are computed from `packages/ui/src/{components,lib}` by `tools/registry/graph.mjs`. Every module is one item
  (named after its file or folder); `registry/components/<name>.json` groups several modules into one and carries the docs
  metadata (`{ name, title, description, page, exports, files?, … }`, see `components/types.ts`). `registryDependencies` and npm
  `dependencies` are derived from the real imports (`@/components/ui/<x>`, `@/lib/<x>`, bare specifiers); dependencies on our
  own items are full URLs, so the shadcn CLI never substitutes its stock `button`. Docstream isn't copied: an item that imports
  `@brett_lamy/ui/docstream…` gets the npm dependency `@brett_lamy/ui` at the library's version, and its manifest's `css` adds
  docstream's stylesheet to the app's CSS (`@import "@brett_lamy/ui/docstream/styles.css" layer(docstream)`).
- **Blocks** are `blocks/<slug>/` (e.g. `github-clone`, `discord-clone`, `t3-clone`, `map-chat`). Each has `meta.json`
  (`{ name, title, description, categories, files, dependencies? }`, see `blocks/types.ts`) and a `page.tsx` whose default export
  is the whole block. A block imports only `react`, `@/components/ui/*`, `@/lib/*`, its own files and the npm packages in
  `meta.json`'s `dependencies` (the build fails otherwise). Never the library's parts from `@brett_lamy/ui`; the one
  exception is docstream, which the registry doesn't copy: a block that uses it imports `@brett_lamy/ui/docstream/<entry>`
  (or `@brett_lamy/ui/docstream-editor/<entry>`) by name and lists `@brett_lamy/ui` in `dependencies`. Files are installed
  together into `components/blocks/<slug>/`. Blocks may own complex, product-specific components (for example
  `t3-clone/components/workbench/*`). An optional `<slug>.stories.tsx` is picked up by Storybook (not listed in `files`). Add the block to the docs Blocks page with a
  `{% demo src="blocks/<slug>" layout="multi" %}` line in `apps/docs/pages/blocks.md` (pages-md fails until you do).
- **`bl-ui`** (`registry:style`) is generated from `packages/ui/src/tokens.css` (the `@theme inline` variables) and `styles.css`.
  It adds no npm dependency on `@brett_lamy/ui`. **`bl-theme`** (`registry:theme`, opt-in) is generated from `theme.css`: the iOS
  palette, the sheet/glass/terminal/workbench scopes, and the font variables. A block that needs its own palette ships a
  stylesheet (`discord-clone/chat-theme.css`).
- `styles.css` — the library's sheet compiled together with the blocks' Tailwind classes, for the docs and Storybook.

## Commands (repo root)

- `pnpm registry` — regenerate `registry.json` and `packages/ui/package.json` `exports` (validates the import graph, the
  barrel, block imports, and that no two package entries export one name).
- `pnpm registry:static` — also run `shadcn build` into `apps/docs/public/r` (the docs build does this via
  `nx run @brett_lamy/registry:registry`).
- `node tools/registry/build.mjs --static --url http://localhost:4501/r --out /tmp/reg-root/r` — a static registry for another
  host, for testing `npx shadcn add http://localhost:4501/r/<item>.json` locally (`cd /tmp/reg-root && python3 -m http.server 4501`).
- `node tools/registry/build.mjs --check` — fail if the committed files (`registry.json`, the package's `exports`) are stale, a
  manifest exports a name that neither the npm barrel (`packages/ui/src/index.ts`) nor the module's own entry does, or two
  entries export one name (`tools/registry/one-path.mjs`) (CI).

## The npm package

`@brett_lamy/ui` is built from the same modules (`vite build` with `preserveModules`, `sideEffects: ["*.css"]`, `'use client'` on
client modules). Every module with an API has its own entry at its registry path (`@/components/ui/dialog` ↔
`@brett_lamy/ui/dialog`, `@/lib/cron` ↔ `@brett_lamy/ui/lib/cron`), written into `exports` from the same import graph, and the
root barrel re-exports the components, their parts and the kit's hooks. Blocks are registry-only; they are not part of the npm
package.

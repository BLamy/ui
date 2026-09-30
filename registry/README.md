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
  own items are full URLs, so the shadcn CLI never substitutes its stock `button`.
- **Blocks** are `blocks/<slug>/` (e.g. `github-clone`, `discord-clone`, `t3-clone`, `map-chat`). Each has `meta.json`
  (`{ name, title, description, categories, files, dependencies? }`, see `blocks/types.ts`) and a `page.tsx` whose default export
  is the whole block. A block imports only `react`, `@/components/ui/*`, `@/lib/*`, its own files and the npm packages in
  `meta.json`'s `dependencies` (the build fails otherwise). Files are installed together into `components/blocks/<slug>/`.
  Blocks may own complex, product-specific components (for example `t3-clone/components/workbench/*`). An optional
  `<slug>.stories.tsx` is picked up by Storybook (not listed in `files`). Add the block to the docs Blocks page with a
  `{% demo src="blocks/<slug>" layout="multi" %}` line in `apps/docs/pages/blocks.md` (pages-md fails until you do).
- **`bl-ui`** (`registry:style`) is generated from `packages/ui/src/tokens.css` (the `@theme inline` variables) and `styles.css`.
  It adds no npm dependency on `@brett_lamy/ui`. **`bl-theme`** (`registry:theme`, opt-in) is generated from `theme.css`: the iOS
  palette, the sheet/glass/terminal/workbench scopes, and the font variables. A block that needs its own palette ships a
  stylesheet (`discord-clone/chat-theme.css`).
- `styles.css` — the library's sheet compiled together with the blocks' Tailwind classes, for the docs and Storybook.

## Commands (repo root)

- `pnpm registry` — regenerate `registry.json` (validates the import graph, the barrel and block imports).
- `pnpm registry:static` — also run `shadcn build` into `apps/docs/public/r` (the docs build does this via
  `nx run @brett_lamy/registry:registry`).
- `node tools/registry/build.mjs --static --url http://localhost:4501/r --out /tmp/reg-root/r` — a static registry for another
  host, for testing `npx shadcn add http://localhost:4501/r/<item>.json` locally (`cd /tmp/reg-root && python3 -m http.server 4501`).
- `node tools/registry/build.mjs --check` — fail if the committed files are stale, or a manifest exports a name the npm barrel
  (`packages/ui/src/index.ts`) does not (CI).

## The npm package

`@brett_lamy/ui` is built from the same modules (`vite build` with `preserveModules`, `sideEffects: ["*.css"]`, `'use client'` on
client modules), and its barrel is the list of manifest exports. Blocks are registry-only; they are not part of the npm package.

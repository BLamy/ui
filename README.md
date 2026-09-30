# BL UI

BL UI is an iOS-flavored React component monorepo built with Nx and pnpm. It contains the component library, the shadcn registry, a Storybook catalog, and a GitBook-style documentation app.

Two ways to use it, from the same source files:

- **shadcn registry (recommended).** `npx shadcn add https://blamy.github.io/ui/r/<item>.json` copies the source of one component, and only what it imports, into your app. Blocks (full-app compositions) install the same way. See [How the registry works](https://blamy.github.io/ui/#/registry).
- **npm.** `npm i @brett_lamy/ui` gives you the whole library, packaged: ESM with one module per source module, so bundlers tree-shake it. See [Optimization](https://blamy.github.io/ui/#/optimization) for measured sizes.

## Workspace layout

- `packages/ui` — the core library, published as [`@brett_lamy/ui`](https://www.npmjs.com/package/@brett_lamy/ui): restyled react-aria/shadcn primitives, the iOS containers (NavigationStack, SplitView, TabView, sheets and drawers), icons, motion, theme, the Composer and PencilKit. Files import each other as `@/components/ui/<x>` and `@/lib/<x>`, the same paths a registry install uses. Stories and unit tests live next to their sources.
- `registry` — the shadcn registry source. `registry/blocks/<slug>` are the blocks (product-specific compositions with their own components: `t3-clone`, `discord-clone`, `loop-qa`, `map-chat`, …); `registry/components/*.json` are docs metadata for the library's items. See [registry/README.md](registry/README.md).
- `apps/docs` — the documentation site (`pages/*.md` + `pages/nav.json`, live examples in `examples/<page>/<example>`)
- `apps/catalog` — the Storybook catalog (stories from `packages/ui`, the registry blocks and `apps/catalog/stories`)
- `tools` — workspace scripts: `registry` (registry build), `tokens` (token generator and lint), `docs` (install sections, variant tables, Markdown export, copy-page check), `codemod` (one-off migrations), `vr` (Playwright visual regression), `smoke-stories.mjs`
- `docs` — design notes (the 2.0 plan and decision log)

## Development

```sh
pnpm install
pnpm dev:docs          # docs app on :4206
pnpm storybook         # component catalog on :6006
pnpm nx run-many -t typecheck,build,test,lint
pnpm tokens            # regenerate lib/tokens.generated.ts from tokens.css, then lint for literals
pnpm variants          # regenerate the cva variant tables in the docs
pnpm vr                # visual regression (needs Storybook on :6006 and docs on :4417)
pnpm knip              # dead-code check
```

The docs app renders markdown through [`@brett_lamy/docstream`](https://www.npmjs.com/package/@brett_lamy/docstream). Every push to `main` builds `apps/docs` and deploys it, with the registry under `/r`, to [GitHub Pages](https://blamy.github.io/ui/).

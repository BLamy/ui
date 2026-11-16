# BL UI

BL UI is an iOS-flavored React component monorepo built with Nx and pnpm. It contains the component library (with docstream and docstream-editor inside it), the shadcn registry, a Storybook catalog, and the BL site — a landing page, every library's docs, and the [roadmap](https://blamy.github.io/ui/#/roadmap) for splitting `@brett_lamy/ui` into packages.

Two ways to use it, from the same source files:

- **shadcn registry (recommended).** `npx shadcn add https://blamy.github.io/ui/r/<item>.json` copies the source of one component, and only what it imports, into your app. Blocks (full-app compositions) install the same way. See [How the registry works](https://blamy.github.io/ui/#/registry).
- **npm.** `npm i @brett_lamy/ui` gives you the whole library, packaged: ESM with one module per source module, so bundlers tree-shake it. See [Optimization](https://blamy.github.io/ui/#/optimization) for measured sizes.

## Workspace layout

- `packages/ui` — the core library, published as [`@brett_lamy/ui`](https://www.npmjs.com/package/@brett_lamy/ui): shadcn-style parts on [UI SDK](https://ui-sdk.dev) (our fork, `vendor/ui-sdk`, consumed as `@ui-sdk/core` and `@ui-sdk/react`), the iOS containers (NavigationStack, SplitView, Tabs, sheets and drawers), icons, motion, theme, the Composer and PencilKit. Files import each other as `@/components/ui/<x>` and `@/lib/<x>`, the same paths a registry install uses. Stories and unit tests live next to their sources.
- `registry` — the shadcn registry source. `registry/blocks/<slug>` are the blocks (product-specific compositions with their own components: `t3-clone`, `discord-clone`, `loop-qa`, `map-chat`, …); `registry/components/*.json` are docs metadata for the library's items. See [registry/README.md](registry/README.md).
- `apps/docs` — the BL site: the landing and library pages (`src/site/`, from the plan `src/site/libraries.ts`, which `src/site/libraries.test.ts` checks against the real imports), the roadmap (`roadmap/*.md`), docstream's and the editor's docs (their playgrounds' `docs/`, mounted with DocsSite at `#/docstream` and `#/docstream-editor`), and the ui docs (`pages/*.md` + `pages/nav.json`, live examples in `examples/<page>/<example>`)
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

The docs app renders markdown through docstream, which is part of the library (`packages/ui/src/docstream`, published as `@brett_lamy/ui/docstream`; its editor is `@brett_lamy/ui/docstream-editor`), with their own docs sites in `apps/docstream-playground` and `apps/docstream-editor-playground`. Every push to `main` builds `apps/docs` and deploys it, with the registry under `/r`, to [GitHub Pages](https://blamy.github.io/ui/).

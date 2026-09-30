# BL UI

BL UI is an iOS-flavored React component monorepo built with Nx and pnpm. It contains the component package, the shadcn registry, a Storybook catalog, and a GitBook-style documentation app.

The core package is published as [`@brett_lamy/ui`](https://www.npmjs.com/package/@brett_lamy/ui). Install it with `npm i @brett_lamy/ui`.

## Workspace layout

- `packages/ui` — the published `@brett_lamy/ui` package: components, containers and tokens, plus the workbench (composer, chat, terminal, surfaces, Docstream-backed markdown), team-chat shells and PencilKit drawing. Stories and unit tests live next to their sources; `src/demos` holds the full demo pages (Storybook `Pages/…`) and `src/templates` the app shells.
- `registry` — the shadcn registry source: full-app blocks (`registry/blocks/<slug>`) and per-component entries; see [registry/README.md](registry/README.md)
- `apps/docs` — the documentation site (`pages/*.md` + `pages/nav.json`, live examples in `examples/<page>/<example>`)
- `apps/catalog` — the Storybook catalog (stories from `packages/ui`, the registry blocks and `apps/catalog/stories`)
- `tools` — workspace scripts: `registry` (registry build), `docs` (install sections, Markdown export, copy-page check), `vr` (Playwright visual regression), `smoke-stories.mjs`
- `docs` — design notes (the 2.0 plan and decision log)

## Development

```sh
pnpm install
pnpm dev:docs          # docs app on :4206
pnpm storybook         # component catalog on :6006
pnpm nx run-many -t typecheck,build,test,lint
pnpm vr                # visual regression (needs Storybook on :6006 and docs on :4417)
pnpm knip              # dead-code check
```

The docs app renders markdown through [`@brett_lamy/docstream`](https://www.npmjs.com/package/@brett_lamy/docstream). Every push to `main` builds `apps/docs` and deploys it to [GitHub Pages](https://blamy.github.io/ui/).

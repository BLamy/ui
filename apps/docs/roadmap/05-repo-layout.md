---
description: Where everything lives — apps, the one package and what is inside it, the registry and the tools — and what still moves.
---

# Repository layout

## Today

```txt title="BLamy/ui"
apps/
  docs/                          the site (this page): landing, libraries, roadmap, the ui docs pages
    src/site/libraries.ts        the list of libraries: the source of the entries, the site and this roadmap
  catalog/                       Storybook
  docstream-playground/          docstream's docs (docs/) and live examples; also runs on its own
  docstream-editor-playground/   the editor's docs and examples
packages/
  ui/                            @brett_lamy/ui: the one published package, everything below
    src/index.ts                 the root: the core, with Tokens, Motion and Icons
    src/components/  src/lib/    the kit, one module per entry (@brett_lamy/ui/dialog)
    src/libraries/               one generated file per library (@brett_lamy/ui/time, /audio, /markdown…)
    src/docstream/               @brett_lamy/ui/docstream/*        ← was @brett_lamy/docstream
    src/docstream-editor/        @brett_lamy/ui/docstream-editor/* ← was @brett_lamy/docstream-editor
    src/sdk/                     one generated re-export per UI SDK entry (@brett_lamy/ui/sdk/…)
    src/cloudflare.ts            @brett_lamy/ui/cloudflare (the Cloudflare catalog, on an entry of its own)
    src/opencode.ts              @brett_lamy/ui/opencode (the OpenCode library: component and runtime)
    scripts/vendor-ui-sdk.mjs    copies the compiled fork into dist/vendor/ui-sdk at the end of the build
  ui-sdk-core/  ui-sdk-react/    private: the fork compiled, which the library's source imports as @ui-sdk/…
vendor/ui-sdk/                   our UI SDK fork (a submodule of BLamy/ui-sdk)
registry/                        the app blocks (registry-only) and the registry build's styles
tools/
  registry/                      registry.json, the package's exports, the library and UI SDK entries
  size/                          what each entry costs an app, and its budgets
  tokens/  docs/  cloudflare/    the token generator and lint, the docs generators, the Cloudflare catalog
  e2e/  vr/  codemod/  ui-sdk/   behavior tests, visual regression, codemods, the fork's compile step
  notes-desktop/  worktree-atlas-desktop/
```

## Where a library lives

A library is not a folder. It is a list of units of `packages/ui/src` in `apps/docs/src/site/libraries.ts`, and three things are generated from that list:

| From the list | Written by | Result |
| --- | --- | --- |
| `packages/ui/src/libraries/<entry>.ts` | `tools/registry/build.mjs` | The library's entry: one `export *` per module of the library |
| `"./<entry>"` in `packages/ui/package.json` `exports` | the same build | `@brett_lamy/ui/<entry>` resolves to it |
| the registry item `library-<entry>` | the same build | One `shadcn add` installs every item of the library |

Moving a module from one library to another is an edit to that list and a run of `pnpm registry`. `libraries.test.ts` fails if the module then imports from a library its new home does not build on, and the registry build fails if the package root still re-exports a module that left the core. The [module map](02-module-map.md) is the list, unit by unit.

## What still moves

```txt title="BLamy/ui, after the tidy"
apps/
  site/                  landing page, roadmap, and every library's docs (was apps/docs)
  catalog/               Storybook
  notes-desktop/         macOS wrapper for the Notes block (was tools/)
  worktree-atlas-desktop/
packages/
  ui/                    unchanged: the one package
    docs/<library>/      each library's pages, as Markdown — the site mounts them with DocsSite
  ui-sdk-core/  ui-sdk-react/
vendor/ui-sdk/
blocks/                  the app blocks: private, registry-only (was registry/)
tools/                   registry, size, tokens, docs generators, e2e, visual regression, codemod, ui-sdk
```

Nothing here changes what an app installs or imports. Docstream stays where it is, inside `packages/ui/src`, and its docs move from its playground to the package's docs folder when the libraries get theirs. The playgrounds stay as dev servers for working on docstream alone.

## How the pieces fit

- **One list decides the layers.** `libraries.ts` says what each library builds on, and `libraries.test.ts` holds the real imports to it: a library may import from the libraries it builds on and from nothing above it. The few lazy links against the layering are listed on the [module map](02-module-map.md).
- **One alias table.** `tools/alias.mjs` and `tsconfig.base.json` map `@/components/ui/<x>` and `@/lib/<x>` to `packages/ui/src`, the paths a registry install creates, so apps and blocks in this repository import the way a copied item does. `tools/alias.mjs` also maps `@brett_lamy/ui/sdk/<x>` to the generated re-export, so a block that imports UI SDK by the package's name shares the library's copy.
- **The registry and the package come from one graph.** `tools/registry` computes each item's dependencies from its imports, and writes the package's entries from the same graph, so a module has one path in both installs: `@/components/ui/dialog` and `@brett_lamy/ui/dialog`.
- **The site mounts each library's docs.** The way `#/docstream` mounts `apps/docstream-playground/docs` today, every library gets `#/<library>`, with its examples resolved from its own folder. See [Docs](04-docs.md).
